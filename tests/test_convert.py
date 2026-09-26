"""Page conversion: canvas reading order, binaries, ink detection."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))

from convert import convert_page  # noqa: E402

STUB = b"\x89PNG\r\n\x1a\nstub"


def _convert(html, tmp_path, **kwargs):
    return convert_page(
        html,
        page_slug="001-page",
        assets_dir=tmp_path / "assets",
        assets_rel="assets",
        **kwargs,
    )


def test_canvas_blocks_sorted_into_reading_order(tmp_path):
    html = """<html><body data-absolute-enabled="true">
      <div style="position:absolute;left:10px;top:900px"><p>LOWER</p></div>
      <div style="position:absolute;left:10px;top:10px"><p>UPPER</p></div>
    </body></html>"""
    md = _convert(html, tmp_path).markdown
    assert md.index("UPPER") < md.index("LOWER")


def test_mixed_positioning_leaves_document_order_alone(tmp_path):
    """Partially positioned pages must not be reordered — a partial sort would
    hoist unpositioned content to an arbitrary place."""
    html = """<html><body data-absolute-enabled="true">
      <div><p>FIRST</p></div>
      <div style="position:absolute;left:10px;top:50px"><p>SECOND</p></div>
    </body></html>"""
    md = _convert(html, tmp_path).markdown
    assert md.index("FIRST") < md.index("SECOND")


def test_non_canvas_page_is_not_reordered(tmp_path):
    html = """<html><body>
      <div style="position:absolute;top:900px"><p>LATER</p></div>
      <div style="position:absolute;top:10px"><p>EARLIER</p></div>
    </body></html>"""
    md = _convert(html, tmp_path).markdown
    assert md.index("LATER") < md.index("EARLIER")


def test_images_downloaded_and_rewritten_to_relative_paths(tmp_path):
    html = (
        '<html><body><img id="img:1" '
        'src="https://graph.microsoft.com/v1.0/me/onenote/resources/1-abc!1/$value" '
        'data-fullres-src-type="image/png"/></body></html>'
    )
    result = _convert(html, tmp_path, fetcher=lambda url: STUB)
    assert len(result.images) == 1
    name = result.images[0]
    assert (tmp_path / "assets" / name).read_bytes() == STUB
    assert f"assets/{name}" in result.markdown
    assert "graph.microsoft.com" not in result.markdown


def test_ink_is_flagged_not_transcribed(tmp_path):
    html = (
        '<html><body><img id="ink:1" '
        'data-render-src="https://graph.microsoft.com/v1.0/me/onenote/resources/1-ink!1/$value" '
        'src="https://graph.microsoft.com/v1.0/me/onenote/resources/1-ink!1/$value"/></body></html>'
    )
    result = _convert(html, tmp_path, fetcher=lambda url: STUB)
    assert result.has_ink is True


def test_attachment_becomes_a_link(tmp_path):
    html = (
        '<html><body><object data-attachment="telemetry.csv" type="text/csv" '
        'data="https://graph.microsoft.com/v1.0/me/onenote/resources/1-xyz!1/$value"/>'
        "</body></html>"
    )
    result = _convert(html, tmp_path, fetcher=lambda url: b"lap,time\n1,95.2\n")
    assert result.attachments == ["001-page-telemetry.csv"]
    assert "telemetry.csv" in result.markdown


def test_tables_survive_conversion(tmp_path):
    html = (
        "<html><body><table><tr><th>Driver</th><th>Stop</th></tr>"
        "<tr><td>HUG</td><td>5.39</td></tr></table></body></html>"
    )
    result = _convert(html, tmp_path)
    assert result.tables == 1
    assert "| HUG | 5.39 |" in result.markdown


def test_a_failing_image_does_not_abort_the_page(tmp_path):
    html = (
        '<html><body><p>keep me</p><img '
        'src="https://graph.microsoft.com/v1.0/me/onenote/resources/1-bad!1/$value"/>'
        "</body></html>"
    )

    def boom(url):
        raise RuntimeError("403")

    result = _convert(html, tmp_path, fetcher=boom)
    assert "keep me" in result.markdown
    assert "image unavailable" in result.markdown
    assert result.images == []


def test_no_fetcher_catalogues_without_writing(tmp_path):
    html = (
        '<html><body><img '
        'src="https://graph.microsoft.com/v1.0/me/onenote/resources/1-abc!1/$value"/>'
        "</body></html>"
    )
    result = _convert(html, tmp_path)
    assert len(result.images) == 1
    assert not (tmp_path / "assets").exists()
