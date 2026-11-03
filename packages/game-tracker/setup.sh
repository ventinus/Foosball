#!/usr/bin/env bash
# Sets up a Raspberry Pi as a foosball table, then reboots into the tracker.
#
#   git clone https://github.com/ventinus/Foosball.git
#   Foosball/packages/game-tracker/setup.sh
#
# Without git installed, this does the clone itself:
#   bash <(curl -fsSL https://raw.githubusercontent.com/ventinus/Foosball/mainline/packages/game-tracker/setup.sh)
#
# Run it as the normal user (not with sudo); it asks for sudo when it needs it.
# It's safe to run again, e.g. after a failed step. See SETUP.md for what it does.
#
# Optional settings (environment variables):
#   SCOREBOARD_ORIENTATION, SCOREBOARD_MIRROR, SCOREBOARD_REVERSE,
#   SCOREBOARD_INTENSITY   initial values for tracker.env (see SETUP.md step 6)
#   AWS_EXPORTS=<path>     aws-exports.js to copy in, instead of pasting it
#   NO_REBOOT=1            don't reboot at the end
#   ALLOW_TRIXIE=1         run on Trixie anyway (see below)

set -euo pipefail

REPO_URL=https://github.com/ventinus/Foosball.git
NODE_MAJOR=22
NODE_MIN=22.12.0

step() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33mWarning: %s\033[0m\n' "$*" >&2; }
die() { printf '\033[1;31mError: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -ne 0 ] || die "run this as your normal user, not with sudo"
sudo -v || die "this needs sudo"

# Use Raspberry Pi OS (Legacy) Lite 32-bit, i.e. Bookworm. Comitup is reported to
# fail on Trixie (dnsmasq can't bind port 53; davesteele/comitup#269), which would
# leave the table unable to join Wi-Fi, and this setup is only written against
# Bookworm. See SETUP.md step 2.
. /etc/os-release
if [ "${VERSION_CODENAME:-}" = trixie ] && [ "${ALLOW_TRIXIE:-}" != 1 ]; then
  die "this is Trixie; flash Raspberry Pi OS (Legacy) Lite 32-bit (Bookworm) instead, see SETUP.md step 2. ALLOW_TRIXIE=1 skips this check."
fi
# Keep sudo from timing out during the long steps, so the rest runs unattended.
while kill -0 $$ 2>/dev/null; do sudo -n true 2>/dev/null; sleep 60; done &

# --- Find the package (or clone it when run through curl) ---------------------

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || true)
if [ -n "$SCRIPT_DIR" ] && grep -qs '"@ventinus/foosball-tracker"' "$SCRIPT_DIR/package.json"; then
  TRACKER_DIR=$SCRIPT_DIR
else
  step "Cloning $REPO_URL into ~/Foosball"
  command -v git >/dev/null || { sudo apt-get update && sudo apt-get install -y git; }
  [ -d "$HOME/Foosball/.git" ] || git clone "$REPO_URL" "$HOME/Foosball"
  TRACKER_DIR=$HOME/Foosball/packages/game-tracker
fi
cd "$TRACKER_DIR"

# --- Amplify config ----------------------------------------------------------------------

AWS_FILE=src/aws-exports.js
if [ -n "${AWS_EXPORTS:-}" ]; then
  cp "$AWS_EXPORTS" "$AWS_FILE"
fi
if [ ! -s "$AWS_FILE" ] && [ -r /dev/tty ]; then
  step "Amplify config"
  cat <<'EOF'
The tracker needs src/aws-exports.js, which isn't in git. On your computer,
copy the contents of packages/game-app/src/aws-exports.js (e.g. with
`pbcopy < packages/game-app/src/aws-exports.js`), paste them here, then
press Enter and Ctrl-D. Press Ctrl-D straight away to skip and add it later.
Everything after this runs without any input.
EOF
  cat </dev/tty >"$AWS_FILE.tmp" || true
  if grep -q aws_appsync_graphqlEndpoint "$AWS_FILE.tmp"; then
    mv "$AWS_FILE.tmp" "$AWS_FILE"
  else
    rm -f "$AWS_FILE.tmp"
  fi
fi
[ -s "$AWS_FILE" ] || warn "no $AWS_FILE yet; the tracker waits for it (see the message on the Pi's screen)"

# --- OS packages ---------------------------------------------------------------

step "Updating the OS and installing build tools (this takes a while)"
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get full-upgrade -y
# The GPIO packages compile during npm install.
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y git curl xz-utils build-essential python3

# --- Node.js -----------------------------------------------------------------------

node_ok() {
  command -v node >/dev/null &&
    node -e "const [a,b,c]=process.versions.node.split('.').map(Number),[x,y,z]='$NODE_MIN'.split('.').map(Number);process.exit(a>x||(a===x&&(b>y||(b===y&&c>=z)))?0:1)"
}

if node_ok; then
  step "Node $(node -v) is already installed"
else
  case "$(uname -m)" in
    # Official builds dropped ARMv6 (Pi Zero W); the unofficial builds still have it.
    armv6l) DIST=https://unofficial-builds.nodejs.org/download/release ARCH=armv6l ;;
    armv7l) DIST=https://nodejs.org/dist ARCH=armv7l ;;
    aarch64) DIST=https://nodejs.org/dist ARCH=arm64 ;;
    x86_64) DIST=https://nodejs.org/dist ARCH=x64 ;;
    *) die "no Node.js build for $(uname -m)" ;;
  esac
  # Newest v22.x that has a build for this CPU.
  NODE_VERSION=$(curl -fsSL "$DIST/index.json" | python3 -c "
import json, sys
for r in json.load(sys.stdin):
    if r['version'].startswith('v$NODE_MAJOR.') and 'linux-$ARCH' in r['files']:
        print(r['version']); break
")
  [ -n "$NODE_VERSION" ] || die "couldn't find a Node $NODE_MAJOR build for linux-$ARCH"
  step "Installing Node $NODE_VERSION ($ARCH)"
  FILE=node-$NODE_VERSION-linux-$ARCH.tar.xz
  TMP=$(mktemp -d)
  (
    cd "$TMP"
    curl -fsSLO "$DIST/$NODE_VERSION/$FILE"
    curl -fsSL "$DIST/$NODE_VERSION/SHASUMS256.txt" | grep " $FILE\$" | sha256sum -c -
    sudo tar -xJf "$FILE" -C /usr/local --strip-components=1 --no-same-owner
  )
  rm -rf "$TMP"
  hash -r
  node_ok || die "Node install failed"
fi

# --- Tracker dependencies ------------------------------------------------------------

step "Installing the tracker's npm packages (compiling takes a while on a Zero W)"
npm ci --omit=dev

# --- Settings and autostart ----------------------------------------------------------------

if [ ! -f tracker.env ]; then
  step "Writing tracker.env"
  cat >tracker.env <<EOF
# Settings for the tracker, read by start.sh each time it starts it.
# After editing, reboot (or press Ctrl-C on the table's keyboard to restart it).
# Check the scoreboard with: npm run scoreboard:test (see SETUP.md step 6).
SCOREBOARD_ORIENTATION=${SCOREBOARD_ORIENTATION:-90}
SCOREBOARD_MIRROR=${SCOREBOARD_MIRROR:-0}
SCOREBOARD_REVERSE=${SCOREBOARD_REVERSE:-0}
SCOREBOARD_INTENSITY=${SCOREBOARD_INTENSITY:-1}
EOF
fi

step "Starting the tracker on the console (tty1) at boot"
# The tracker reads the keyboard, so it runs on the console rather than as a service.
sudo raspi-config nonint do_boot_behaviour B2 # console autologin
PROFILE=$HOME/.bash_profile
touch "$PROFILE"
# ~/.bash_profile stops bash reading ~/.profile, so keep loading it.
grep -q '\.profile' "$PROFILE" || printf '[ -f ~/.profile ] && . ~/.profile\n' >>"$PROFILE"
# Replace any earlier version of this block.
sed -i '/^# >>> foosball tracker >>>$/,/^# <<< foosball tracker <<<$/d' "$PROFILE"
cat >>"$PROFILE" <<EOF
# >>> foosball tracker >>>
# Run the tracker on the console (SSH logins aren't on tty1, so they get a shell).
if [ "\$(tty)" = "/dev/tty1" ]; then
  "$TRACKER_DIR/start.sh"
fi
# <<< foosball tracker <<<
EOF

# --- Comitup (last: it can take over the Wi-Fi) --------------------------------------------

step "Installing Comitup (Wi-Fi setup hotspot)"
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y comitup
AP_NAME=$(hostname)
if grep -qE '^\s*ap_name:' /etc/comitup.conf 2>/dev/null; then
  sudo sed -i -E "s/^\s*ap_name:.*/ap_name: $AP_NAME/" /etc/comitup.conf
else
  echo "ap_name: $AP_NAME" | sudo tee -a /etc/comitup.conf >/dev/null
fi

# --- Done ------------------------------------------------------------------------------------

step "Setup finished"
cat <<EOF
After the reboot the tracker starts on the console by itself.
- Scoreboard looks wrong? Edit $TRACKER_DIR/tracker.env (SETUP.md step 6).
- Wi-Fi: if the Pi can't join a known network, join the "$AP_NAME" Wi-Fi from
  a phone to pick one.
- Updating later: cd ~/Foosball && git pull, then run this script again.
EOF

if [ "${NO_REBOOT:-}" = 1 ]; then
  echo "Reboot when ready: sudo reboot"
else
  echo
  echo "Rebooting in 10 seconds (Ctrl-C to cancel)..."
  sleep 10
  sudo reboot
fi
