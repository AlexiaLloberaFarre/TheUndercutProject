#!/usr/bin/env bash
# Regenerate index-autumn.html from index.html (same page, Warm Autumn palette).
set -euo pipefail
cd "$(dirname "$0")/.."
sed -e 's|<html lang="en">|<html lang="en" data-theme="autumn">|' \
    -e 's|<title>Alexia Llobera — The Undercut Project</title>|<title>Alexia Llobera — The Undercut Project (Warm Autumn)</title>|' \
    -e 's|<a href="index-autumn.html" data-theme-link>Try the Warm Autumn edition</a>|<a href="index.html" data-theme-link>Back to the Wine edition</a>|' \
    index.html > index-autumn.html
echo "index-autumn.html rebuilt"
