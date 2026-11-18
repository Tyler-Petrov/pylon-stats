#!/usr/bin/env sh
# Renders the app icons in static/ from the SVGs in src/lib/assets. Needs rsvg-convert (librsvg).
# favicon.svg is the rounded tile browsers show; icon-maskable.svg fills the square and keeps the pylon
# inside the safe zone, for launchers and iOS that cut their own shape.
set -e
cd "$(dirname "$0")/.."
a=src/lib/assets
rsvg-convert -w 192 -h 192 $a/favicon.svg -o static/icons/icon-192.png
rsvg-convert -w 512 -h 512 $a/favicon.svg -o static/icons/icon-512.png
rsvg-convert -w 512 -h 512 $a/icon-maskable.svg -o static/icons/maskable-512.png
rsvg-convert -w 180 -h 180 $a/icon-maskable.svg -o static/apple-touch-icon.png
