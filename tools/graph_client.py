"""Authenticated, throttle-aware Microsoft Graph client for the OneNote API.

Auth is an interactive device-code flow the first time you run it: the script
prints a short code, you paste it into the URL it gives you, and the resulting
refresh token is cached so later runs are non-interactive.
"""

from __future__ import annotations

import atexit
import os
import sys
import time
from pathlib import Path
from typing import Any, Iterator

import msal
import requests

GRAPH_ROOT = "https://graph.microsoft.com/v1.0"
SCOPES = ["Notes.Read"]
DEFAULT_CACHE = Path.home() / ".cache" / "undercut" / "msal_token_cache.json"

# Graph throttles OneNote hard: content reads are the expensive call and a few
# hundred pages will trip 429 at least once. Six attempts with backoff is enough
# to ride out the usual Retry-After windows.
MAX_ATTEMPTS = 6


class GraphError(RuntimeError):
    """Any non-recoverable Graph or auth failure."""


def _token_cache(path: Path) -> msal.SerializableTokenCache:
    cache = msal.SerializableTokenCache()
    if path.exists():
        cache.deserialize(path.read_text())

    def _flush() -> None:
        if cache.has_state_changed:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(cache.serialize())
            path.chmod(0o600)

    atexit.register(_flush)
    return cache


class GraphClient:
    """Minimal Graph wrapper: silent-where-possible auth, retries, paging."""

    def __init__(
        self,
        client_id: str | None = None,
        tenant: str = "common",
        cache_path: Path = DEFAULT_CACHE,
    ) -> None:
        client_id = client_id or os.environ.get("ONENOTE_CLIENT_ID")
        if not client_id:
            raise GraphError(
                "ONENOTE_CLIENT_ID is unset. Put your Azure app registration's "
                "Application (client) ID there — see docs/EXTRACTION.md."
            )
        self._app = msal.PublicClientApplication(
            client_id,
            authority=f"https://login.microsoftonline.com/{tenant}",
            token_cache=_token_cache(cache_path),
        )
        self._session = requests.Session()
        self._cached_token: str | None = None

    # -- auth ----------------------------------------------------------------

    def _token(self, force: bool = False) -> str:
        if self._cached_token and not force:
            return self._cached_token

        accounts = self._app.get_accounts()
        result = None
        if accounts:
            result = self._app.acquire_token_silent(SCOPES, account=accounts[0])

        if not result:
            flow = self._app.initiate_device_flow(scopes=SCOPES)
            if "user_code" not in flow:
                raise GraphError(
                    f"Could not start device flow: {flow.get('error_description', flow)}"
                )
            print(f"\n{flow['message']}\n", file=sys.stderr, flush=True)
            result = self._app.acquire_token_by_device_flow(flow)

        if "access_token" not in result:
            raise GraphError(f"Auth failed: {result.get('error_description', result)}")

        self._cached_token = result["access_token"]
        return self._cached_token

    # -- transport -----------------------------------------------------------

    def raw(self, url: str, *, accept: str | None = None) -> requests.Response:
        """GET a URL, retrying throttles and transient 5xx. Returns the response."""
        if url.startswith("/"):
            url = GRAPH_ROOT + url

        for attempt in range(1, MAX_ATTEMPTS + 1):
            headers = {"Authorization": f"Bearer {self._token()}"}
            if accept:
                headers["Accept"] = accept

            try:
                response = self._session.get(url, headers=headers, timeout=120)
            except requests.RequestException as exc:
                if attempt == MAX_ATTEMPTS:
                    raise GraphError(f"GET {url} failed: {exc}") from exc
                time.sleep(min(2**attempt, 60))
                continue

            if response.status_code == 401 and attempt < MAX_ATTEMPTS:
                # Token expired mid-run; force a refresh and retry once more.
                self._token(force=True)
                continue

            if response.status_code in (429, 503, 504) and attempt < MAX_ATTEMPTS:
                delay = response.headers.get("Retry-After")
                time.sleep(float(delay) if delay else min(2**attempt, 60))
                continue

            if not response.ok:
                raise GraphError(
                    f"GET {url} -> {response.status_code}: {response.text[:400]}"
                )
            return response

        raise GraphError(f"GET {url} exhausted {MAX_ATTEMPTS} attempts")

    def get(self, url: str) -> dict[str, Any]:
        return self.raw(url).json()

    def paged(self, url: str) -> Iterator[dict[str, Any]]:
        """Yield every item across @odata.nextLink pages."""
        while url:
            payload = self.get(url)
            yield from payload.get("value", [])
            url = payload.get("@odata.nextLink", "")
