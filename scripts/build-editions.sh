#!/usr/bin/env bash
# Regenerate the alternative editions from index.html (same page, different palette).
set -euo pipefail
cd "$(dirname "$0")/.."
build() { # $1 theme id, $2 title suffix, $3 output
  sed -e "s|<html lang=\"en\">|<html lang=\"en\" data-theme=\"$1\">|" \
      -e "s|<title>Alexia Llobera — The Undercut Project</title>|<title>Alexia Llobera — The Undercut Project ($2)</title>|" \
      index.html > "$3"
  echo "$3 rebuilt"
}
build autumn "Warm Autumn" index-autumn.html
build motion "Motion" index-motion.html
