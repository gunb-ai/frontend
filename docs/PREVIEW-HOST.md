# Local preview host (e.g. Mac mini)

Target two-tier setup (session dev links + Mac mini mirror): see **[DEV-PREVIEW-ARCHITECTURE.md](./DEV-PREVIEW-ARCHITECTURE.md)**.

The public site files live in this repo root (`index.html`, `examples.html`, `site.css`, …).
There is **no build step** — only static HTML/CSS/JS.

On many tailnets, **port 8443 is Tailscale Serve** (`tailscale serve`), not Caddy/nginx:

```bash
tailscale serve status
```

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

For the **Mac mini mirror of `main`**, use auto-pull:

```bash
cd ~/frontend
./scripts/install-mac-mini-autopull.sh
```

Defaults: pull every 5 minutes via `update-local-preview.sh`. Logs: `/tmp/frontend-pull.log`.

## If the server uses a separate docroot

Some setups clone to `~/src/frontend` but Caddy/nginx serves `~/www/gunb`:

```bash
REPO_DIR=~/src/frontend DOCROOT=~/www/gunb ./scripts/update-local-preview.sh
```

## Finding what Serve exposes

```bash
sudo lsof -i :8443          # usually tailscaled
tailscale serve status      # path + HTTPS URL
```
