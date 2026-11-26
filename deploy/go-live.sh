#!/bin/bash
# Puts the app on its public address with Google sign-in. Run once as root:
#   bash /opt/aina/deploy/go-live.sh
# It asks for the Google client, the two allowed addresses and, to keep what was added in the
# test phase, the email used for the test login. Nothing typed here is shown or stored elsewhere.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo "Run deploy/install.sh first."; exit 1; }

DOMAIN=mywardrobe.fit
read -rp "Google Client ID: " CLIENT_ID
read -rsp "Google Client secret (not shown): " CLIENT_SECRET; echo
read -rp "Allowed Google addresses, separated by a comma (no spaces): " ALLOWED
read -rp "Email you used for the TEST login (Enter to skip): " TEST_EMAIL
OWNER=""
if [ -n "$TEST_EMAIL" ]; then
  read -rp "Which Google address should own the test clothes? " OWNER
fi

KEYS='DOMAIN|NEXTAUTH_URL|APP_URL|DEBUG|DEV_MODE|OIDC_ISSUER_URL|OIDC_CLIENT_ID|OIDC_CLIENT_SECRET|OIDC_ALLOWED_EMAILS|TRUSTED_PROXY_COUNT'
umask 077
grep -vE "^($KEYS)=" .env > .env.new || true
cat >> .env.new <<ENV
# Public address with Google sign-in (written by deploy/go-live.sh)
DOMAIN=$DOMAIN
NEXTAUTH_URL=https://$DOMAIN
APP_URL=https://$DOMAIN
DEBUG=false
DEV_MODE=false
OIDC_ISSUER_URL=https://accounts.google.com
OIDC_CLIENT_ID=$CLIENT_ID
OIDC_CLIENT_SECRET=$CLIENT_SECRET
OIDC_ALLOWED_EMAILS=$ALLOWED
# Caddy and nginx each add one hop in front of the app.
TRUSTED_PROXY_COUNT=2
ENV
mv .env.new .env

if [ -n "$TEST_EMAIL" ] && [ -n "$OWNER" ]; then
  echo "Handing the test account's clothes to $OWNER..."
  echo "UPDATE users SET email = :'owner', email_verified = true WHERE email = :'test';" |
    docker exec -i wardrobe_postgres psql -U wardrobe -d wardrobe -v test="$TEST_EMAIL" -v owner="$OWNER"
fi

bash deploy/install.sh
echo
echo "Open https://$DOMAIN and sign in with Google."
