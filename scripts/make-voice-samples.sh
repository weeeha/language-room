#!/usr/bin/env bash
# Renders the voice-check lines with every free option that runs here without an install.
# Output goes to media/voices/<engine>/<nn>.aiff, which git ignores.
set -u
cd "$(dirname "$0")/.."

LINES=eval/voices/lines-pt-PT.json
OUT=media/voices
RATE_WPM=${RATE_WPM:-150}   # say -r takes words per minute; the app rate 0.85 is about 0.85 x 175

mkdir -p "$OUT"

echo "pt_PT system voices (browser speech synthesis uses the same list on this Mac):"
say -v '?' | grep pt_PT
echo
echo "pt_BR voices found (Brazilian, not for use, not rendered):"
say -v '?' | grep pt_BR | awk '{print "  " $1}'
echo

TEXTS=()
while IFS= read -r line; do TEXTS+=("$line"); done < <(python3 -c '
import json,sys
for l in json.load(open(sys.argv[1]))["lines"]: print(l)
' "$LINES")

render_say() {
  local voice="$1" dir
  dir="$OUT/say-$(echo "$voice" | tr 'A-Z ' 'a-z-')-pt_PT"
  mkdir -p "$dir"
  local i=0
  for t in "${TEXTS[@]}"; do
    i=$((i + 1))
    printf -v nn '%02d' "$i"
    say -v "$voice" -r "$RATE_WPM" -o "$dir/$nn.aiff" "$t" </dev/null && echo "wrote $dir/$nn.aiff"
  done
}

say -v '?' | grep pt_PT | awk '{print $1}' | while read -r v; do render_say "$v"; done

echo
if python3 -c "import kokoro_onnx" 2>/dev/null; then
  echo "kokoro_onnx is importable, but this script does not drive it yet"
else
  echo "kokoro: not generated: Python package kokoro_onnx is not installed (model files are in ~/models/kokoro)"
fi
if curl -m 3 -s -o /dev/null http://127.0.0.1:8890/; then
  echo "qwen3-tts: server answers on 8890, but this script does not drive it yet"
else
  echo "qwen3-tts: not generated: no server answers on 127.0.0.1:8890"
fi
