# Local preview host (e.g. Mac mini)

The public site files live in this repo root (`index.html`, `examples.html`, `site.css`, …).
There is **no build step** — only static HTML/CSS/JS.

## One-time update (enough to explore new frontend)

On the Mac mini (Tailscale machine), from a shell:

```bash
cd /path/to/frontend   # wherever :8443 points today
git fetch origin
git checkout main
git pull --ff-only origin main
```

Or use the helper:

```bash
./scripts/update-local-preview.sh
```

Then reload `https://mac-mini.tailecbe08.ts.net:8443/` (hard refresh if cached).

Latest merged site work is on **`main`** (PR #4).

## Do you need auto-pull?

| Approach | When to use |
|----------|-------------|
| **Manual `git pull`** | Previewing after merges; simplest. |
| **Cron / launchd** (e.g. every 5–15 min) | Mac mini should track `main` without thinking. |
| **GitHub webhook → pull** | Update within seconds of push; needs a small listener on the Mac. |
| **GitHub Pages** (workflow in `.github/workflows/pages.yml`) | Production path once the repo is public and Pages is enabled; Mac mini optional. |

For exploring the new frontend, **manual pull once is enough**. Add auto-pull only if you want the Mac mini preview to stay in sync with every push.

### Example: launchd pull every 10 minutes

Adjust `REPO_DIR` to your clone path.

```xml
<!-- ~/Library/LaunchAgents/ai.gunb.frontend-pull.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>ai.gunb.frontend-pull</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-lc</string>
    <string>cd /path/to/frontend &amp;&amp; git pull --ff-only origin main</string>
  </array>
  <key>StartInterval</key><integer>600</integer>
  <key>StandardOutPath</key><string>/tmp/frontend-pull.log</string>
  <key>StandardErrorPath</key><string>/tmp/frontend-pull.err</string>
</dict>
</plist>
```

Load: `launchctl load ~/Library/LaunchAgents/ai.gunb.frontend-pull.plist`

## If the server uses a separate docroot

Some setups clone to `~/src/frontend` but Caddy/nginx serves `~/www/gunb`:

```bash
REPO_DIR=~/src/frontend DOCROOT=~/www/gunb ./scripts/update-local-preview.sh
```

## Finding the current checkout on the Mac mini

```bash
# What is listening on 8443?
sudo lsof -i :8443

# Caddy: check Caddyfile for root path
grep -r root /opt/homebrew/etc/Caddyfile ~/.config/caddy 2>/dev/null

# nginx
grep -r root /opt/homebrew/etc/nginx 2>/dev/null
```

The `root` / `file_server` path should be the git repo root (or the `DOCROOT` you rsync into).
