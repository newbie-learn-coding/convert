#!/bin/bash
# Generate PWA icons from the apple-touch-icon.png
# This script requires ImageMagick or sips (macOS)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SOURCE_ICON="$PROJECT_ROOT/public/apple-touch-icon.png"
OUTPUT_DIR="$PROJECT_ROOT/public/icons"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Icon sizes required for PWA
SIZES=(
  "72"
  "96"
  "128"
  "144"
  "152"
  "192"
  "384"
  "512"
)

echo "Generating PWA icons..."

# Check if convert (ImageMagick) is available
if command -v convert &> /dev/null; then
  for size in "${SIZES[@]}"; do
    echo "Generating ${size}x${size} icon..."
    convert "$SOURCE_ICON" -resize "${size}x${size}" "$OUTPUT_DIR/icon-${size}x${size}.png"
  done
  echo "Icons generated using ImageMagick"
elif command -v sips &> /dev/null; then
  # macOS fallback using sips
  for size in "${SIZES[@]}"; do
    echo "Generating ${size}x${size} icon..."
    cp "$SOURCE_ICON" "$OUTPUT_DIR/icon-${size}x${size}.png"
    sips -z "$size" "$size" "$OUTPUT_DIR/icon-${size}x${size}.png" --out "$OUTPUT_DIR/icon-${size}x${size}.png" > /dev/null
  done
  echo "Icons generated using sips (macOS)"
else
  echo "Warning: Neither ImageMagick nor sips found."
  echo "Using source icon for all sizes (not ideal but functional)."
  for size in "${SIZES[@]}"; do
    echo "Copying icon for ${size}x${size}..."
    cp "$SOURCE_ICON" "$OUTPUT_DIR/icon-${size}x${size}.png"
  done
fi

# Create a favicon.png from the source (192x192)
if [ -f "$OUTPUT_DIR/icon-192x192.png" ]; then
  cp "$OUTPUT_DIR/icon-192x192.png" "$PROJECT_ROOT/public/favicon.png"
  echo "Created favicon.png"
fi

echo "PWA icons generated in $OUTPUT_DIR"
