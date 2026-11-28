#!/bin/bash
# Switches the app's AI on with a Google Gemini API key (label reader, tagging, suggestions).
# Run as root:  bash /opt/aina/deploy/set-ai.sh
# The key is typed here, checked with Google, and stored only in /opt/aina/.env.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo "Run deploy/install.sh first."; exit 1; }
BASE=https://generativelanguage.googleapis.com/v1beta/openai

read -rsp "Gemini API key (not shown): " KEY; echo
[ -n "$KEY" ] || { echo "No key typed."; exit 1; }

echo "Asking Google which models this key can use..."
MODELS=$(curl -fsS -H "Authorization: Bearer $KEY" "$BASE/models" | grep -o '"id": *"[^"]*"' | sed 's/.*"\([^"]*\)"$/\1/; s#^models/##') || {
  echo "Google refused the key. Check that you copied all of it."; exit 1; }
# The newest plain "Flash" model: quick, cheap, reads photos.
MODEL=$(printf '%s\n' "$MODELS" | grep -E '^gemini-[0-9.]+-flash$' | sort -V | tail -1 || true)
if [ -z "$MODEL" ]; then
  echo "No plain Flash model found. Models offered:"; printf '%s\n' "$MODELS" | grep -i flash || true
  read -rp "Type the model to use: " MODEL
fi
# The newest Flash picture model ("Nano Banana") for catalogue photos.
IMAGE_MODEL=$(printf '%s\n' "$MODELS" | grep -E '^gemini-[0-9.]+-flash-image' | sort -V | tail -1 || true)
echo "Using $MODEL${IMAGE_MODEL:+ and $IMAGE_MODEL for pictures}. Testing it..."
CODE=$(curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d "{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"Say OK\"}],\"max_tokens\":5}" "$BASE/chat/completions")
if [ "$CODE" != "200" ]; then
  echo "The test call failed (code $CODE). If it is 429 or mentions billing, turn on billing for the project first."; exit 1
fi

KEYS='AI_INTERNAL_ENABLED|AI_BASE_URL|AI_API_KEY|AI_VISION_MODEL|AI_TEXT_MODEL|AI_IMAGE_MODEL'
umask 077
grep -vE "^($KEYS)=" .env > .env.new || true
cat >> .env.new <<ENV
# AI through Google Gemini (written by deploy/set-ai.sh)
AI_INTERNAL_ENABLED=true
AI_BASE_URL=$BASE
AI_API_KEY=$KEY
AI_VISION_MODEL=$MODEL
AI_TEXT_MODEL=$MODEL
AI_IMAGE_MODEL=$IMAGE_MODEL
ENV
mv .env.new .env
bash deploy/install.sh
echo
echo "AI IS ON ($MODEL)"
