#!/bin/bash
# Migrate existing data and videos to R2 (REMOTE)
BUCKET="arwuchivo-storage"

echo "=== Uploading data files ==="
for f in data/index.json data/leyenda.json; do
  echo "  $f"
  npx wrangler r2 object put "$BUCKET/$f" --file="$f" --content-type="application/json" --remote
done

for f in data/days/*.json; do
  echo "  $f"
  npx wrangler r2 object put "$BUCKET/$f" --file="$f" --content-type="application/json" --remote
done

echo "=== Uploading video files ==="
find videos -type f \( -name "*.mp4" -o -name "*.webm" -o -name "*.mov" \) | while read f; do
  type="video/mp4"
  [[ "$f" == *.webm ]] && type="video/webm"
  [[ "$f" == *.mov ]] && type="video/quicktime"
  echo "  $f ($type)"
  npx wrangler r2 object put "$BUCKET/$f" --file="$f" --content-type="$type" --remote
done

echo "=== Done ==="
