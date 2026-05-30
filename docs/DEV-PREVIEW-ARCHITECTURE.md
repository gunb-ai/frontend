# Dev preview architecture (target)

Two preview surfaces, different jobs:

```text
┌─────────────────────────────────────────────────────────────────┐
│  Spawned frontend / agent sessions (ephemeral)                  │
│  - tailscale in session image                                     │
│  - tailscale serve → repo root (or vite preview)                  │
│  - dashboard advertises magic DNS URL per session                 │
│  - use: review in-flight PR / branch before merge                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Mac mini (stable) — https://mac-mini.<tailnet>:8443/            │
│  - tailscale serve on :8443 → ~/frontend (static root)          │
│  - launchd auto-pull origin/main every N minutes                  │
│  - use: always-on mirror of what’s on main                        │
└─────────────────────────────────────────────────────────────────┘
```

## Mac mini — auto-pull on `main`

**Role:** Living staging mirror. Anything merged and pushed to `gunb-ai/frontend` `main` shows up here without manual pulls.

**Install (on the Mac mini):**

```bash
cd ~/frontend
./scripts/install-mac-mini-autopull.sh
```

Defaults: repo `~/frontend`, interval 5 minutes. Override with `FRONTEND_REPO=... PULL_INTERVAL_SEC=600`.

**Verify:**

```bash
tailscale serve status    # should point at ~/frontend (or your docroot)
tail -f /tmp/frontend-pull.log
```

**Serve root must match the git tree** Tailscale exposes. If Serve points elsewhere, either:

- `cd ~/frontend && tailscale serve --bg --https=8443 .` (see `tailscale serve --help` for your TS version), or
- set `DOCROOT` in `update-local-preview.sh` and point Serve at that directory.

## Spawned sessions — Tailscale + advertised dev link

**Role:** Preview the branch the agent is editing, not only `main`.

**Target behavior:**

1. Session image includes `tailscale` (and auth: pre-auth key or tagged node).
2. After checkout / file writes, run static serve or `tailscale serve` on the worktree.
3. Session metadata (dashboard / completion message) includes the HTTPS URL, e.g.  
   `https://<session-host>.<tailnet>:8443/` or a dedicated dev port.
4. Optional second port for **ctrl** UI if the session runs control plane locally.

**Suggested conventions:**

| Port | Service |
|------|---------|
| 8443 | Static site (`frontend` repo root) — same as Mac mini |
| 8444 | ctrl / internal tools (optional) |

**Minimal static serve in a session (illustrative):**

```bash
cd "$WORKTREE/frontend"   # or /tmp/frontend clone
tailscale serve --bg --https=8443 .
echo "Preview: https://$(tailscale status --json | jq -r .Self.DNSName):8443/"
```

Session lifecycle should tear down serve on exit where possible.

## GitHub Pages

`.github/workflows/pages.yml` remains the **public** deploy path once the repo is public. Mac mini + session previews are for **private / pre-release** viewing on the tailnet.

## Implementation checklist

- [ ] Mac mini: `install-mac-mini-autopull.sh` + confirm `tailscale serve status`
- [ ] Session image: install tailscale; document auth key handling
- [ ] Session hook: start serve after frontend checkout; print URL in agent output
- [ ] Dashboard: surface preview URL on spawned frontend sessions
- [ ] Optional: ctrl preview on second port
- [ ] Document tailnet hostname pattern for operators
