#!/bin/bash
# Every size's bodies - three men of different heights and a woman, each as big round the chest as the size is to fit - and the table of them.
# Run from this folder; writes its working files here (b-*.json a body, g-*.json its lines, k-*.json a size's yoke) and the table to the compiler.
set -e
repo=$(cd ../.. && pwd)
for row in "xs 76" "s 86" "m 96" "l 106" "xl 116" "2xl 126" "3xl 136" "4xl 146"; do
  set -- $row; size=$1; chest=$2
  (cd "$repo" && node scripts/bodies/yoke.mjs "$repo" $size scripts/bodies/k-$size.json | tail -1)
  for body in "man176 175.5 0" "man188 188 0" "man165 165 0" "woman172 172 1"; do
    set -- $body
    echo "== $size $1"
    ./body.sh $size-$1 $chest $2 $3 k-$size.json
  done
done
node tables.mjs "$repo/src/compiler/designs/wool-week/strips/bodies.json"
