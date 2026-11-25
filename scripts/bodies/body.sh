#!/bin/bash
# body.sh <name> <chest cm> <stature cm> <gender, 0 a man to 1 a woman> <yoke.json>: one body, its upright axis through the middle of its neck's ring, and the lines down it.
set -e
name=$1
python3 anny_body.py b-$name.json $2 $3 $4 5 0 2>&1 | grep -E "fitted|widened"
off=$(node lines.mjs $5 b-$name.json g-$name.json | grep "ring's middle" | awk '{print $5}')
python3 anny_body.py b-$name.json $2 $3 $4 5 $off 2>&1 | grep -E "widened" || true
node lines.mjs $5 b-$name.json g-$name.json | grep -E "ring's middle|falls"
