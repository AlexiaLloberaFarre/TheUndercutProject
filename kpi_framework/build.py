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


def build_html(payload_json: str, web_dir: Path | str = WEB_DIR, *, title: str | None = None) -> str:
    """`title` renames the page. The <title> tag is what names a published
    artifact, so the live board needs its own or it collides with the local one
    in the gallery."""
    web_dir = Path(web_dir)
    html = (web_dir / "index.html").read_text()
    if title:
        html = html.replace("<title>Simulator KPI Tracker</title>", f"<title>{title}</title>", 1)
        html = html.replace("<h1>Simulator KPI Tracker</h1>", f"<h1>{title}</h1>", 1)
    for placeholder, filename in PLACEHOLDERS.items():
        if placeholder not in html:
            raise ValueError(f"web/index.html is missing the {placeholder} placeholder")
        html = html.replace(placeholder, (web_dir / filename).read_text())
    if "/*__PAYLOAD__*/" not in html:
        raise ValueError("web/index.html is missing the /*__PAYLOAD__*/ placeholder")
    # Guard against a data value closing the inline script element early.
    safe = payload_json.replace("</", "<\\/")
    return html.replace("/*__PAYLOAD__*/", safe)
