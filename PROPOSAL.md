# Site reboot — top-down wishlist

Status: **proposal**. No code in this PR. Goal: agree on shape before building.

Companion: PR #11 moves the previous iteration to `legacy/` for reference.

## Why we're rebooting

The previous iteration drifted away from the design reference in `legacy/moodboard.html`. Most of the moodboard's hard constraints got broken:

| Moodboard says | What we built |
|---|---|
| Materials, not signals. No saturation spikes. Moss is not "success green." | 4 tier-color badges acting as traffic lights (now / stabilizing / next / planned). |
| Quiet, not minimal. "Doesn't perform excitement it doesn't feel." | Animated edges, cursor-follow hero mark, SVG schematics, sliders, sweep keyframes. |
| Monospace-native. ASCII / panel vocabulary for diagrams. | SVG pipeline diagrams, Bode plots, schematic renders, capability DAGs. |
| "A compiler that works correctly doesn't need to announce that it worked." | 7 pages of announcements, tier ladders, roadmap mosaics, complexity playgrounds. |
| Don't sell. No "blazingly fast," no unqualified absolutes. | "Available now / Stabilizing / Building next / Planned" sales matrix. |

The drift wasn't from any single decision — it was the accumulation of features that each individually seemed reasonable but together produced a feature gallery.

## The new shape

**One page.** `index.html`. Maybe one external link out to architecture docs. That's it.

The moodboard's own `.proto-dark` block — the dark panel in the "Prototype" section — already shows the right register at the right scale. The new index is essentially that block expanded slightly with the install line and one error example, then nothing else.

### What the page must contain, in priority order

1. **What gunbc is, in one sentence.**
   The moodboard's existing line is fine: "A structural compiler for composable systems."

2. **The install line.**
   `git clone <repo> && cd gunbc && make install` — already prototyped in the moodboard. This is the primary call to action.

3. **One example of the voice.**
   A single `Invariant —` error block, exactly as shown in the moodboard. Errors are weather. That IS the demo of what the compiler feels like.

4. **One link out.**
   Architecture docs or GitHub. Not a nav with 7 destinations.

5. **The mark.**
   The Stoic Giant SVG, displayed once at moodboard scale.

That's the entire site for v1.

### What's explicitly out for v1

- No tabs, no playground, no roadmap page, no examples page, no showcases.
- No tier colors. No traffic-light badges.
- No SVG diagrams (pipeline, schematic, Bode, capability DAG). If we want to show the pipeline, it's `parse → resolve → typecheck → lower → emit` as inline mono text.
- No animation. No cursor-follow, no edge-draw, no sweep keyframes.
- No theme toggle for v1 — pick dark default (the moodboard's "product" mode) and ship.
- No GitHub Pages workflow tweaks. Mac mini auto-pull on main is the only deploy target that matters today.

These are not "nevers" — they're "not in v1." The moodboard explicitly leaves room for a holistic DAG diagram later, in the right register. We just don't start there.

### Style ground rules (all from the moodboard)

- **Palette:** warm-white / void / stone / moss / clay. Moss for one accent (link or install kbd). Clay only inside the error block. No tier-* tokens at all.
- **Typography:** Noto Sans for prose, JetBrains Mono for everything compiler-flavored (CLI, code, labels). Recursive optional, not load-bearing.
- **Layout:** single column, ~54rem max width, the moodboard's `.page` container as-is.
- **Voice:** state facts, name tradeoffs, don't sell. The moodboard's "Voice" section is the editorial brief — read it before writing any copy.

## Open questions to resolve before building

1. **Domain & wordmark.** The moodboard uses `gunb.ai` and "Gunbai." Legacy site used `daglang`. Which is the public brand for v1?
2. **One link or two?** GitHub repo is non-negotiable. Architecture docs link — useful or premature?
3. **Mode toggle deferred or kept?** Moodboard ships both modes; we'd just default dark. Cheap to keep. Skip for v1?
4. **Where does the install command actually point?** Repo is private / public? If private, replace with "Early access" + a contact line.
5. **Anything else load-bearing missing from the 5-item list above?** This is the moment to push back.

## What happens after we agree

A follow-up PR with `index.html` (and minimal CSS, inline or in a fresh `site.css` — no `legacy/` reuse). Probably <300 lines total. Manual review against the moodboard before merge.
