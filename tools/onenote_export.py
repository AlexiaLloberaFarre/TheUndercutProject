#!/usr/bin/env python3
"""Export OneNote notebooks to Markdown, one file per page.

    # See what's there without downloading any page content (fast, ~1 call/section)
    python tools/onenote_export.py --inventory

    # Full export
    python tools/onenote_export.py

    # Only what changed since the last run
    python tools/onenote_export.py --since-last-run

Run --inventory first. It tells you how many pages you're dealing with before
you commit to fetching every one of them.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

import yaml

from convert import convert_page
from graph_client import GraphClient, GraphError
from taxonomy import parse_section_name, slugify

REPO_ROOT = Path(__file__).resolve().parent.parent
NOTES_DIR = REPO_ROOT / "notes"
MANIFEST = NOTES_DIR / ".manifest.json"
INVENTORY = REPO_ROOT / "docs" / "inventory.json"

PAGE_FIELDS = "id,title,createdDateTime,lastModifiedDateTime,order,level"


# ---------------------------------------------------------------------------
# Tree walk
# ---------------------------------------------------------------------------


def walk_sections(
    client: GraphClient, container: str, container_id: str, trail: tuple[str, ...] = ()
) -> Iterator[tuple[tuple[str, ...], dict[str, Any]]]:
    """Yield (group_trail, section) for a notebook or section group, recursively.

    Section groups are the reason this recurses: a path like
    'Formula E - S09_10/Race_Events/S09/23W28_R13_R14_RME' is
    notebook / group / group / section, and a flat /sections call misses all of it.
    """
    for section in client.paged(f"/me/onenote/{container}/{container_id}/sections"):
        yield trail, section

    for group in client.paged(f"/me/onenote/{container}/{container_id}/sectionGroups"):
        name = group.get("displayName") or "unnamed-group"
        yield from walk_sections(client, "sectionGroups", group["id"], trail + (name,))


def list_pages(client: GraphClient, section_id: str) -> list[dict[str, Any]]:
    pages = list(
        client.paged(f"/me/onenote/sections/{section_id}/pages?$select={PAGE_FIELDS}&$top=100")
    )
    # OneNote's 'order' is the in-section position; fall back to creation time.
    pages.sort(key=lambda p: (p.get("order", 10**6), p.get("createdDateTime") or ""))
    return pages


def notebooks(client: GraphClient, name_filter: str | None) -> list[dict[str, Any]]:
    found = list(client.paged("/me/onenote/notebooks"))
    if name_filter:
        needle = name_filter.lower()
        found = [n for n in found if needle in (n.get("displayName") or "").lower()]
    return found


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------


def load_manifest() -> dict[str, Any]:
    if MANIFEST.exists():
        try:
            return json.loads(MANIFEST.read_text())
        except json.JSONDecodeError:
            print("! manifest unreadable, treating this as a fresh export", file=sys.stderr)
    return {"pages": {}, "last_run": None}


def write_page(
    client: GraphClient,
    page: dict[str, Any],
    *,
    out_dir: Path,
    index: int,
    context: dict[str, Any],
    fetch_binaries: bool,
) -> dict[str, Any]:
    page_id = page["id"]
    title = page.get("title") or "untitled"
    slug = f"{index:03d}-{slugify(title)}"

    html = client.raw(
        f"/me/onenote/pages/{page_id}/content?includeIDs=true", accept="text/html"
    ).text

    converted = convert_page(
        html,
        page_slug=slug,
        assets_dir=out_dir / "assets",
        assets_rel="assets",
        fetcher=(lambda url: client.raw(url).content) if fetch_binaries else None,
    )

    front: dict[str, Any] = {
        "onenote_page_id": page_id,
        "title": title,
        "created": page.get("createdDateTime"),
        "modified": page.get("lastModifiedDateTime"),
        **context,
        "images": len(converted.images),
        "attachments": len(converted.attachments),
        "tables": converted.tables,
        "has_ink": converted.has_ink,
    }
    # Drop empties so the front matter stays readable.
    front = {k: v for k, v in front.items() if v not in (None, [], "")}

    body = (
        "---\n"
        + yaml.safe_dump(front, sort_keys=False, allow_unicode=True)
        + "---\n\n"
        + f"# {title}\n\n"
        + converted.markdown
    )

    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / f"{slug}.md"
    target.write_text(body, encoding="utf-8")

    return {
        "path": str(target.relative_to(REPO_ROOT)),
        "modified": page.get("lastModifiedDateTime"),
        "has_ink": converted.has_ink,
        "images": len(converted.images),
        "attachments": len(converted.attachments),
    }


def run(args: argparse.Namespace) -> int:
    try:
        client = GraphClient(tenant=args.tenant)
    except GraphError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    manifest = load_manifest()
    seen_pages = manifest["pages"]
    cutoff = manifest.get("last_run") if args.since_last_run else args.since

    inventory: list[dict[str, Any]] = []
    stats = {"sections": 0, "pages": 0, "written": 0, "skipped": 0, "ink": 0}

    try:
        books = notebooks(client, args.notebook)
    except GraphError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    if not books:
        print("No notebooks matched.", file=sys.stderr)
        return 1

    print(f"{len(books)} notebook(s)", file=sys.stderr)

    for book in books:
        book_name = book.get("displayName") or "unnamed-notebook"
        for trail, section in walk_sections(client, "notebooks", book["id"]):
            section_name = section.get("displayName") or "unnamed-section"
            stats["sections"] += 1
            meta = parse_section_name(section_name)

            try:
                pages = list_pages(client, section["id"])
            except GraphError as exc:
                print(f"! {section_name}: {exc}", file=sys.stderr)
                continue

            stats["pages"] += len(pages)
            inventory.append(
                {
                    "notebook": book_name,
                    "groups": list(trail),
                    "section": section_name,
                    "pages": len(pages),
                    **{k: v for k, v in meta.as_dict().items() if k != "raw" and v},
                }
            )

            if args.inventory:
                print(
                    f"  {book_name}/{'/'.join(trail)}/{section_name}: {len(pages)} pages",
                    file=sys.stderr,
                )
                continue

            out_dir = NOTES_DIR.joinpath(
                slugify(book_name), *(slugify(t) for t in trail), slugify(section_name)
            )
            context = {
                "notebook": book_name,
                "section": section_name,
                "section_groups": list(trail) or None,
                **{k: v for k, v in meta.as_dict().items() if k != "raw" and v},
            }

            for index, page in enumerate(pages, start=1):
                modified = page.get("lastModifiedDateTime") or ""
                known = seen_pages.get(page["id"])
                unchanged = known and known.get("modified") == modified
                stale = cutoff and modified and modified <= cutoff
                if unchanged or stale:
                    stats["skipped"] += 1
                    continue

                try:
                    record = write_page(
                        client,
                        page,
                        out_dir=out_dir,
                        index=index,
                        context=context,
                        fetch_binaries=not args.no_binaries,
                    )
                except GraphError as exc:
                    print(f"! page '{page.get('title')}': {exc}", file=sys.stderr)
                    continue

                seen_pages[page["id"]] = record
                stats["written"] += 1
                if record["has_ink"]:
                    stats["ink"] += 1
                print(f"  + {record['path']}", file=sys.stderr)

    INVENTORY.parent.mkdir(parents=True, exist_ok=True)
    INVENTORY.write_text(json.dumps(inventory, indent=2, ensure_ascii=False) + "\n")

    if not args.inventory:
        manifest["last_run"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        NOTES_DIR.mkdir(parents=True, exist_ok=True)
        MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")

    print(
        f"\nsections={stats['sections']} pages={stats['pages']} "
        f"written={stats['written']} skipped={stats['skipped']} with-ink={stats['ink']}",
        file=sys.stderr,
    )
    if stats["ink"]:
        print(
            f"note: {stats['ink']} page(s) contain ink, which the API only returns as "
            "images — their handwriting is not in the Markdown.",
            file=sys.stderr,
        )
    print(f"inventory -> {INVENTORY.relative_to(REPO_ROOT)}", file=sys.stderr)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--inventory", action="store_true", help="count pages only, fetch no content")
    parser.add_argument("--notebook", help="only notebooks whose name contains this substring")
    parser.add_argument("--since", help="skip pages not modified after this ISO timestamp")
    parser.add_argument("--since-last-run", action="store_true", help="use the manifest's last_run as --since")
    parser.add_argument("--no-binaries", action="store_true", help="skip image/attachment downloads")
    parser.add_argument("--tenant", default="common", help="Entra tenant (default: common)")
    return run(parser.parse_args())


if __name__ == "__main__":
    sys.exit(main())
