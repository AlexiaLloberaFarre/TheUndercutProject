"""Inlines the app sources and the data payload into one self-contained file.

The output has no external requests of any kind (bar the optional Google Fonts
link), so it works from a memory stick, an email attachment, or a published
Artifact URL."""

from __future__ import annotations

from pathlib import Path

WEB_DIR = Path(__file__).resolve().parent.parent / "web"

PLACEHOLDERS = {
    "<!--STYLES-->": "styles.css",
    "<!--ENGINE-->": "engine.js",
    "<!--STORE-->": "store.js",
    "<!--APP-->": "app.js",
}


def build_html(payload_json: str, web_dir: Path | str = WEB_DIR) -> str:
    web_dir = Path(web_dir)
    html = (web_dir / "index.html").read_text()
    for placeholder, filename in PLACEHOLDERS.items():
        if placeholder not in html:
            raise ValueError(f"web/index.html is missing the {placeholder} placeholder")
        html = html.replace(placeholder, (web_dir / filename).read_text())
    if "/*__PAYLOAD__*/" not in html:
        raise ValueError("web/index.html is missing the /*__PAYLOAD__*/ placeholder")
    # Guard against a data value closing the inline script element early.
    safe = payload_json.replace("</", "<\\/")
    return html.replace("/*__PAYLOAD__*/", safe)
