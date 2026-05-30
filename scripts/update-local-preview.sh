#!/usr/bin/env bash
# Run on the Mac mini (or any machine) that serves the static site.
# Pulls latest gunb-ai/frontend and leaves files ready for your web server docroot.
#
# Usage:
#   ./scripts/update-local-preview.sh
#   REPO_DIR=~/src/frontend BRANCH=main ./scripts/update-local-preview.sh
#
# If your server points at a copy (not the git tree), set DOCROOT and we rsync after pull:
#   REPO_DIR=~/src/frontend DOCROOT=/var/www/gunb-preview ./scripts/update-local-preview.sh

set -euo pipefail

REPO_DIR="${REPO_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
BRANCH="${BRANCH:-main}"
REMOTE="${REMOTE:-origin}"
DOCROOT="${DOCROOT:-}"

cd "$REPO_DIR"

if [[ ! -d .git ]]; then
  echo "error: $REPO_DIR is not a git checkout; clone first:" >&2
  echo "  git clone https://github.com/gunb-ai/frontend.git $REPO_DIR" >&2
  exit 1
fi

echo "==> fetch $REMOTE"
git fetch "$REMOTE"

echo "==> checkout $BRANCH"
git checkout "$BRANCH"
git pull --ff-only "$REMOTE" "$BRANCH"

echo "==> at $(git rev-parse --short HEAD): $(git log -1 --format=%s)"

if [[ -n "$DOCROOT" ]]; then
  echo "==> rsync to $DOCROOT"
  mkdir -p "$DOCROOT"
  rsync -a --delete \
    --exclude '.git' \
    --exclude '.github' \
    --exclude 'moodboard.html' \
    ./ "$DOCROOT/"
fi

echo "done. Serve the repo root (or DOCROOT) as static files."
