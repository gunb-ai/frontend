#!/usr/bin/env bash
# Install launchd job on macOS to auto-pull gunb-ai/frontend main.
# Run on the Mac mini as the user who owns ~/frontend.
#
#   cd ~/frontend && ./scripts/install-mac-mini-autopull.sh
#
# Env:
#   FRONTEND_REPO      default: parent of scripts/ (= repo root)
#   PULL_INTERVAL_SEC  default: 300 (5 minutes)
#   LABEL              default: ai.gunb.frontend-pull

set -euo pipefail

REPO="${FRONTEND_REPO:-$(cd "$(dirname "$0")/.." && pwd)}"
INTERVAL="${PULL_INTERVAL_SEC:-300}"
LABEL="${LABEL:-ai.gunb.frontend-pull}"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
UPDATE_SCRIPT="${REPO}/scripts/update-local-preview.sh"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "error: macOS only (launchd)" >&2
  exit 1
fi

if [[ ! -x "$UPDATE_SCRIPT" ]]; then
  echo "error: missing $UPDATE_SCRIPT" >&2
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${UPDATE_SCRIPT}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>REPO_DIR</key>
    <string>${REPO}</string>
    <key>BRANCH</key>
    <string>main</string>
  </dict>
  <key>StartInterval</key>
  <integer>${INTERVAL}</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/frontend-pull.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/frontend-pull.err</string>
</dict>
</plist>
EOF

# Reload if already loaded
launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl enable "gui/$(id -u)/${LABEL}"

echo "Installed ${PLIST}"
echo "  repo:     ${REPO}"
echo "  interval: ${INTERVAL}s"
echo "  logs:     /tmp/frontend-pull.log /tmp/frontend-pull.err"
echo ""
echo "Check: launchctl print gui/$(id -u)/${LABEL}"
echo "Once:  ${UPDATE_SCRIPT}"
