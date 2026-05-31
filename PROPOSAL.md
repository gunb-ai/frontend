# Site reboot — top-down wishlist

Status: **proposal**, with reviewer revisions applied. No code in this PR. Goal: agree on shape before building.

Companion: PR #11 moves the previous iteration to `legacy/` for reference.

## Governing principle

> The site should feel like **a technical artifact someone discovered, not a startup landing page trying to convert them.**

The moodboard's phrase is "quiet, not minimal" — substance and density are allowed, but the density should read like a compiler output or a field note, not marketing inventory. One page is the right scale for v1, but **one page is not no story**. The visitor still needs to leave with answers to:

```text
what is this?
why should I care?
what does it feel like?
how do I try it?
where do I go deeper?
```

## Why we're rebooting

The previous iteration drifted from the design reference in `legacy/moodboard.html`. Each addition was individually defensible; the accumulation was a feature gallery with compiler nouns. Concrete drifts:

| Moodboard says | What we built |
|---|---|
| Materials, not signals. No saturation spikes. Moss is not "success green." | 4 tier-color badges acting as traffic lights. |
| Quiet, not minimal. "Doesn't perform excitement it doesn't feel." | Animated edges, cursor-follow hero mark, sliders, sweep keyframes. |
| Monospace-native. ASCII / panel vocabulary for diagrams. | SVG pipeline diagrams, Bode plots, schematic renders, capability DAGs. |
| Don't sell. State facts. Name tradeoffs. | "Available now / Stabilizing / Building next / Planned" sales matrix. |
| One mark, one register. | 7 pages of announcements. |

The reboot returns to the moodboard's core: grounded, quiet, material, structural, not performative.

## Brand hierarchy

Decided up front so copy and links can be written:

```text
Umbrella / site:      gunb.ai
Language:             daglang
Compiler binary:      gunbc
Repo:                 gunb-ai/daglang
```

Header reads `gunb.ai`. Body refers to "gunbc" (the thing you run) and "daglang" (what it compiles) explicitly.

## V1 page — content & narrative

Single column, ~54rem max width, dark default (light mode deferred but palette must remain compatible). One page, five sections, in order. The narrative arc the page must carry:

```text
drift → graph → check → emit → fail closed
```

### 1. Mark + name

The Stoic Giant SVG (from `legacy/moodboard.html`) at moodboard scale. Wordmark `gunb.ai` beside it. Once on the page.

### 2. One-sentence identity

```text
A structural compiler for composable systems.
```

No "one graph, many targets." That language pulls toward omni-emission feature-talk and was a major source of drift.

### 3. Problem / proposal paragraph

The piece the original 5-item list was missing. Without it, the identity line is abstract.

```text
Software drifts when the same fact lives in too many places: code,
schemas, clients, tests, docs, workflows, and runtime boundaries.
gunbc models the program as a typed graph, checks the graph, and
emits from that structure.
```

Optional sharper variant for review:

```text
Programs are graphs before they are files. gunbc checks the graph,
then emits from it. Unsupported paths fail closed instead of
producing plausible output.
```

We'll pick one in the implementation PR.

### 4. Install / early access line

This is the page's primary call to action. **The command shown must work.** Tentative:

```text
git clone https://github.com/gunb-ai/daglang
cd daglang
cargo build --release
```

If the repo is not yet public, replace with `early access: github.com/gunb-ai/daglang` or `public release pending`. Resolved before implementation lands. No `make install` unless verified.

### 5. One compiler-feel example

A single `Invariant —` error block. This shows the compiler's character better than any feature demo. Clay is used **only** inside this block — it means "the ground cracked," not "alert."

Working draft (non-exhaustive match — concrete, universal, no domain expertise required):

```text
Invariant —
  match on Condition is not exhaustive

  missing:
    Rainy
    Snowy

  at:
    examples/weather.dag:14

  result:
    no artifact emitted
```

### Footer

Two quiet links. Plain text, mono.

```text
GitHub · Architecture
```

If Architecture isn't public-ready at implementation time, ship with GitHub alone.

## What's explicitly out for V1

Not "never" — "not now." These can return later in the right register.

```text
Tabs / multi-page nav
Roadmap / capability DAG / tier badges
Examples page, playground, sliders
Affected-set standalone page
Showcase pages (EE, backend, omni-emission)
Animated SVG diagrams (pipeline, schematic, Bode, fanout)
Cursor-follow hero mark, edge-draw, sweep keyframes
Theme toggle UI (default dark; light palette stays compatible)
Feature cards, status badges, "Available now / Coming soon" matrices
Hero pipeline visual
Agent-native editing section
```

## Style ground rules (hard, from the moodboard)

```text
Palette:
  void · stone · warm white · moss · clay
  moss = one accent (link or install kbd)
  clay = ONLY inside the error block
  no tier-* tokens at all

Typography:
  Noto Sans for prose
  JetBrains Mono for compiler-flavored surfaces
  Recursive optional, not load-bearing
  no display-sans hero gimmick

Layout:
  single column
  max width ~54rem
  panel vocabulary
  no card grid

Motion:
  none for V1

Diagrams:
  ASCII / mono / panel-like only
  no SVG visualizations for V1

Mark:
  one mark, used once on V1
  must survive 16px (moodboard constraint)
```

## V1 acceptance criteria

```text
[ ] Single file index.html, < 300 lines total (including inline CSS).
[ ] All five sections present in the order above.
[ ] Install command runs to completion against the actual repo.
[ ] No tier colors. No animation. No SVG diagrams. No tabs.
[ ] No reference to legacy/ from the production page (legacy/ is private context, not user-facing).
[ ] Dark default. Palette tokens defined such that a light mode is a future config change, not a rewrite.
[ ] Manual review against legacy/moodboard.html philosophy before merge.
```

## V1.1 — public support layer (after V1 ships)

```text
[ ] /support or SUPPORTED.md: exact install instructions
[ ] Exact supported subset
[ ] Exact target outputs
[ ] Mostly textual, same register
```

## V2 — earned content (only after V1 voice is stable)

Ideas from the previous iteration are good content for later. They were dragging V1 in the wrong direction. Re-render them in the moodboard register before showing them again.

```text
[ ] Architecture page in mono/panel style
[ ] Complexity example as compiler receipt, not playground
[ ] Affected-set example as text/ASCII graph, not animated SVG
[ ] Omni-emission as ASCII artifact topology
[ ] PSpice / Verilog as restrained "system targets" note
[ ] Light mode toggle
[ ] Favicon / icon asset set
```

## Resolved open questions

| Question | Resolution |
|---|---|
| Public brand? | `gunb.ai` umbrella, `daglang` language, `gunbc` compiler, `gunb-ai/daglang` repo. |
| One link or two? | Two: GitHub + Architecture. GitHub only if Architecture isn't public-ready. |
| Mode toggle in V1? | Deferred. Dark default. Palette stays light-compatible. |
| Install command target? | Must be a verified command against the actual repo state. Resolved at implementation time. |
| Missing from the 5-item list? | Yes — problem/proposal paragraph. Added above. |

## What happens after merge

A follow-up PR with `index.html` (and minimal CSS, inline or in a fresh `site.css` — no reuse from `legacy/`). Under 300 lines total. Manual review against `legacy/moodboard.html` before merge.
