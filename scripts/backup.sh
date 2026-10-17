#!/usr/bin/env bash
# Save a timestamped copy of the live site into Backup/<date>_<time>_<label>/
# Usage: scripts/backup.sh "short label"
set -euo pipefail
cd "$(dirname "$0")/.."

label="${1:-change}"
label="$(printf '%s' "$label" | tr -cs 'A-Za-z0-9' '-' | sed 's/^-//; s/-$//' | cut -c1-40)"
stamp="$(TZ=Europe/Madrid date +%Y-%m-%d_%H%M)"
dest="Backup/${stamp}_${label}"

# Everything the site needs to run: page, styles, scripts, images, data, editor, docs.
items=(index.html index-autumn.html index-motion.html README.md assets data admin V2 V3)

tmp="$(mktemp -d)"
for i in "${items[@]}"; do [ -e "$i" ] && cp -R "$i" "$tmp/"; done

# Skip if nothing changed since the most recent snapshot.
latest="$(ls -d Backup/20* 2>/dev/null | sort | tail -n 1 || true)"
if [ -n "$latest" ] && diff -rq -x MANIFEST.txt "$latest" "$tmp" >/dev/null 2>&1; then
  echo "No site changes since $latest; no new backup."
  rm -rf "$tmp"; exit 0
fi

mkdir -p "$dest"
cp -R "$tmp"/. "$dest"/
rm -rf "$tmp"
{
  echo "Snapshot:  $stamp (Europe/Madrid)"
  echo "Label:     $label"
  echo "Based on:  $(git rev-parse --short HEAD 2>/dev/null || echo n/a) ($(git log -1 --pretty=%s 2>/dev/null || echo n/a))"
  echo
  echo "To restore: copy the contents of this folder over the repository root and commit."
} > "$dest/MANIFEST.txt"
echo "Backup saved to $dest"
