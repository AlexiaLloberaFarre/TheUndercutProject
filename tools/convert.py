"""Turn a OneNote page's Graph HTML into Markdown, pulling down its binaries.

Two things here are worth more than the Markdown conversion itself:

1. Reading order. OneNote is a free canvas — the API emits one absolutely
   positioned <div> per text box, in no particular order. A naive convert
   interleaves a stint-notes box with a tyre-temps box. We sort the top-level
   divs by (top, left) first so the output reads down the page.
2. Binaries. Image src attributes point at Graph resource URLs that require the
   auth header, so a plain HTML-to-Markdown pass leaves you with dead links. We
   fetch each one and rewrite the reference to a relative path.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from bs4 import BeautifulSoup, Tag
from markdownify import markdownify

# "position:absolute;left:48px;top:115px" -> pull the numbers out.
_LEFT = re.compile(r"left:\s*(-?[\d.]+)px", re.IGNORECASE)
_TOP = re.compile(r"top:\s*(-?[\d.]+)px", re.IGNORECASE)

# Fetcher signature: (url) -> bytes
Fetcher = Callable[[str], bytes]


@dataclass
class ConvertedPage:
    markdown: str
    images: list[str] = field(default_factory=list)
    attachments: list[str] = field(default_factory=list)
    has_ink: bool = False
    tables: int = 0


def _offset(tag: Tag) -> tuple[float, float] | None:
    """Canvas coordinates of a block, or None if it is not absolutely placed."""
    style = tag.get("style") or ""
    top = _TOP.search(style)
    left = _LEFT.search(style)
    if not top or not left:
        return None
    return (float(top.group(1)), float(left.group(1)))


def _reorder_canvas(soup: BeautifulSoup) -> None:
    """Sort absolutely positioned top-level blocks into reading order.

    Only reorders when the page is genuinely an absolute canvas and *every*
    top-level block carries coordinates. If any block lacks them, document order
    is left untouched — a partial sort would hoist unpositioned content to an
    arbitrary place, which is worse than not reordering at all.
    """
    body = soup.body
    if body is None:
        return
    if str(body.get("data-absolute-enabled", "")).lower() != "true":
        return

    blocks = [child for child in body.find_all(recursive=False) if isinstance(child, Tag)]
    if len(blocks) < 2:
        return

    offsets = [_offset(block) for block in blocks]
    if any(offset is None for offset in offsets):
        return

    for block, _ in sorted(zip(blocks, offsets), key=lambda pair: pair[1]):
        body.append(block.extract())


def _safe_name(url: str, page_slug: str, index: int, fallback_ext: str) -> str:
    """Resource URLs carry no filename, so synthesise a stable one."""
    match = re.search(r"resources/([\w!.-]+)/", url)
    token = (match.group(1) if match else str(index)).replace("!", "-")
    token = re.sub(r"[^\w.-]", "", token)[:40]
    return f"{page_slug}-{index:02d}-{token}{fallback_ext}"


_MIME_EXT = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/gif": ".gif",
    "image/bmp": ".bmp",
    "image/tiff": ".tif",
    "image/webp": ".webp",
    "image/emf": ".emf",
}


def convert_page(
    html: str,
    *,
    page_slug: str,
    assets_dir: Path,
    assets_rel: str,
    fetcher: Fetcher | None = None,
) -> ConvertedPage:
    """Convert one page. With no fetcher, binaries are catalogued but not saved."""
    soup = BeautifulSoup(html, "html.parser")
    _reorder_canvas(soup)
    result = ConvertedPage(markdown="")
    result.tables = len(soup.find_all("table"))

    # -- images --------------------------------------------------------------
    for index, img in enumerate(soup.find_all("img"), start=1):
        # Ink strokes come back as rendered images, never as text.
        if img.get("data-render-src") or str(img.get("id", "")).startswith("ink"):
            result.has_ink = True

        url = img.get("data-fullres-src") or img.get("src") or ""
        if not url.startswith("http"):
            continue

        mime = img.get("data-fullres-src-type") or img.get("data-src-type") or "image/png"
        name = _safe_name(url, page_slug, index, _MIME_EXT.get(mime, ".png"))

        if fetcher is not None:
            try:
                payload = fetcher(url)
            except Exception as exc:  # noqa: BLE001 - one bad image must not kill the page
                img.replace_with(soup.new_string(f"[image unavailable: {exc}]"))
                continue
            assets_dir.mkdir(parents=True, exist_ok=True)
            (assets_dir / name).write_bytes(payload)

        result.images.append(name)
        img.attrs = {"src": f"{assets_rel}/{name}", "alt": img.get("alt") or page_slug}

    # -- attachments ---------------------------------------------------------
    for index, obj in enumerate(soup.find_all("object"), start=1):
        url = obj.get("data") or ""
        label = obj.get("data-attachment") or f"attachment-{index}"
        if not url.startswith("http"):
            continue

        name = re.sub(r"[^\w.-]", "_", label)[:80] or f"attachment-{index}"
        name = f"{page_slug}-{name}"

        if fetcher is not None:
            try:
                payload = fetcher(url)
            except Exception as exc:  # noqa: BLE001
                obj.replace_with(soup.new_string(f"[attachment unavailable: {label} ({exc})]"))
                continue
            assets_dir.mkdir(parents=True, exist_ok=True)
            (assets_dir / name).write_bytes(payload)

        result.attachments.append(name)
        link = soup.new_tag("a", href=f"{assets_rel}/{name}")
        link.string = f"📎 {label}"
        obj.replace_with(link)

    # -- markdown ------------------------------------------------------------
    body = soup.body or soup
    markdown = markdownify(
        str(body),
        heading_style="ATX",
        bullets="-",
        strip=["span", "font"],
    )
    # markdownify leaves long runs of blank lines where the canvas divs were.
    result.markdown = re.sub(r"\n{3,}", "\n\n", markdown).strip() + "\n"
    return result
