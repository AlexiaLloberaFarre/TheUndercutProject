#!/usr/bin/env sh
# Regenerates index-autumn.html (the "Warm Autumn" edition) from index.html.
# Run this after editing index.html so both editions stay identical in content.
set -eu
cd "$(dirname "$0")"
sed -e 's/<html lang="en" data-edition="wine">/<html lang="en" data-edition="autumn">/' \
    -e 's#<title>Alexia Llobera — The Undercut Project</title>#<title>Alexia Llobera — The Undercut Project (Warm Autumn edition)</title>#' \
    index.html > index-autumn.html
echo "index-autumn.html regenerated"
