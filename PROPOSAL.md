# Site reboot — top-down wishlist

Status: **proposal**, revised three times. This PR is prose-only (`PROPOSAL.md` + `DESIGN.md`). An internal design workpad (`workpad.html` on PR #13) is in flight in parallel — it is not the public site and is never linked from production.

Companion: PR #11 moves the previous iteration to `legacy/` for reference.

## Governing principle

> The site should feel like **a technical artifact someone discovered, not a startup landing page trying to convert them.**

## Design-system thesis

> **Quiet confidence through visible structure.**

Operationalized as a single rule that decides whether any element belongs:

> **Every visible element is either a fact, a relation, a boundary, or a receipt.**

Mapped to the compiler:

```text
fact      → type, node, declaration, claim
relation  → edge, dependency, projection, emission
boundary  → invariant, diagnostic, unsupported path, external target
receipt   → output, compile result, witness, install command, proof line
```

If a design element is none of those, it does not belong. This is what stops the slide back into feature cards, status badges, and animated heroes.

## Why this matters more than the page itself

The previous iteration didn't fail because of one bad page — it failed because each addition was individually defensible against ad-hoc taste, and the accumulation became a feature gallery. The fix is not a smaller page; the fix is a design language with **fractal coherence**, so each scale enforces the next.

```text
small fact block   becomes a panel
panel              becomes a section
section            becomes a page
page               becomes a site
```

Same grammar at every level. That is how a one-page site can carry depth without enumeration, and how later pages can be added without drifting.

## Phase 0 — design system (this lands before any v1 page)

Two artifacts ship before `index.html`.

### `DESIGN.md` — 10 governance rules

Added in this PR. Hard constraints that future PRs must satisfy or explicitly override. See the file.

### `primitives.html` — component proof

A single internal page (not linked from production) that exhibits every primitive used anywhere on the site. If a primitive doesn't survive on this page, it does not enter the site. Contents:

```text
1. Materials
   void · stone · warm white · moss · clay (as swatches with material reason)

2. Type roles
   statement · specifier · code · receipt · diagnostic

3. Panel types
   Fact panel       — stable claim
   Command panel    — what to run
   Invariant panel  — diagnostic / compiler voice (clay only here)
   Receipt panel    — output / proof / aligned ledger

4. SVG primitives
   node · edge · port · fold · lens · artifact · boundary · checkpoint
   (one stroke weight, no gradients, no animated draw, labels in HTML)

5. Composed examples (showing fractal grammar)
   micro:   single Invariant block
   section: Problem / Proposal / Receipt triptych
   page:    manual translation → structural description → derived artifacts → refuses to guess
```

## Phase 1 — V1 page

One page. One argument. Built from the primitives.

### The argument the page must carry

```text
modern systems are full of hand-written translations
daglang describes the system once as structure
gunbc checks that description and derives the mechanical pieces
when the description is incomplete, the compiler refuses to guess
```

Public language. Compiler people still see the formal idea underneath (a structure-preserving projection from modeled facts into target artifacts). The site should make that feel obvious without naming the math.

The design language should make this feel true before the reader fully understands it.

### Brand hierarchy (locked)

```text
Umbrella / site: gunb.ai
Language:        daglang
Compiler binary: gunbc
Repo:            gunb-ai/daglang
```

Header reads `gunb.ai`. First body paragraph names both `gunbc` (the compiler) and `daglang` (the language). **Do not use `daglang` as the site brand unless the page is specifically language docs** — it's the language, not the umbrella.

### Page sections, in order

1. **Mark + wordmark.** Stoic Giant from `legacy/moodboard.html`. Used once. Must pass the 16 / 24 / 48 / 120 px test before shipping — if it only works at hero scale, derive a simpler core glyph for favicon use.

2. **One-sentence identity.**
   ```text
   A structural compiler for composable systems.
   ```
   Not "one graph, many targets" — that phrasing pulled the old site toward omni-emission and was a major drift vector.

3. **Problem / proposal paragraph.** A Fact panel.

   Two-line identity precedes the paragraph:
   ```text
   A structural compiler for composable systems.
   Describe the system once. Let the compiler derive the rest.
   ```

   Then:
   ```text
   Modern systems are full of hand-written translations:
   backend types to client types, models to schemas, services to docs,
   code to tests, source to build rules.

   daglang describes the system once.
   gunbc checks that description and derives the mechanical pieces.

   When the description is incomplete, the compiler refuses to guess.
   ```

   The "hand-written translations" framing is public-friendly while still containing the formal thesis (structure-preserving projection). It avoids "drift" — true but a symptom, not the root.

4. **Install / early access — Command panel.** **Must be a verified command against the real repo.**
   ```text
   git clone https://github.com/gunb-ai/daglang
   cd daglang
   cargo build --release
   ```
   If the repo isn't public yet: replace with `early access: github.com/gunb-ai/daglang` or `public release pending`. No `make install` unless verified.

5. **One compiler-feel example — Invariant panel.** Clay used *only* here. Working draft:
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

6. **Footer — two quiet links.**
   ```text
   GitHub · Architecture
   ```
   GitHub-only if Architecture isn't public-ready at implementation time.

## What's explicitly out of V1

Not "never" — "not before the visual language has discipline."

```text
Tabs, multi-page nav, theme toggle UI
Tier color tokens, status badges, "Available now / Stabilizing / …" matrices
Roadmap UI, capability DAGs, complexity playgrounds
Affected-set / showcase / examples pages
Illustrative or showcase SVG diagrams (pipelines, schematics, Bode plots, fanouts)
Animated SVG of any kind (edge-draw, sweep keyframes, cursor-follow hero mark)
Feature cards, CTA clusters, "Get started" buttons
Bento grids, gradient blobs, glow effects
SaaS / dashboard / launch-microsite energy
```

**SVG nuance.** The blanket "no SVG" was too strict. The real rule:

```text
Allowed:    the mark; small relation/node/edge glyphs from the primitive
            vocabulary in DESIGN.md; primitive exploration in the internal
            workpad.

Disallowed: illustrative pipeline diagrams, schematic renders, Bode plots,
            capability DAGs, animated edge-draw, feature-showcase SVGs.
```

## V1 acceptance criteria

```text
[ ] index.html + minimal CSS, < 300 lines total
[ ] All six sections present, in order
[ ] All sections use primitives that exist on primitives.html
[ ] Install command runs against the real repo end to end
[ ] Mark passes 16 / 24 / 48 / 120 px legibility test
[ ] No tier colors, no animation, no illustrative SVG diagrams, no tabs
[ ] No production link to legacy/ or workpad.html (both are private reference)
[ ] Palette stays light-compatible even though dark is the V1 default
[ ] Workpad (PR #13) demonstrates at least one light-mode swatch / proof — so dark default never becomes "designed into a dark-only corner"
[ ] DESIGN.md rules pass manual review before merge
```

## Phase 2 — support / architecture

```text
[ ] /support or SUPPORTED.md — install, supported subset, target outputs
[ ] Architecture page, same primitives, no new SVG vocabulary
[ ] One small ASCII / mono graph diagram allowed
[ ] No interactive demos yet
```

## Phase 3 — richer demos (only if they obey the language)

Ideas from the legacy site are reserved as good content for later. They must be re-rendered in the moodboard register before showing again — compiler receipts, not playgrounds; ASCII / panel diagrams, not animated SVGs.

```text
[ ] Complexity lens as compiler receipt
[ ] Affected-set as text/ASCII graph
[ ] Omni-emission as ASCII artifact topology
[ ] PSpice / Verilog as restrained "system targets" technical notes
[ ] Light mode toggle (palette already compatible)
```

## Resolved decisions

| Question | Resolution |
|---|---|
| Public brand? | `gunb.ai` umbrella, `daglang` language, `gunbc` compiler, `gunb-ai/daglang` repo. |
| One link or two? | Two: GitHub + Architecture. GitHub-only if Architecture isn't public-ready. |
| Mode toggle in V1? | Deferred. Dark default. Palette stays light-compatible. |
| Install command target? | Verified command against real repo state. Resolved at implementation. |
| Five-item list missing anything? | Yes — problem/proposal paragraph; added as §3. |
| Build the page first or the primitives first? | Primitives first (`DESIGN.md` + workpad on PR #13). V1 page composes them. |
| Public framing? | "Hand-written translations" over "drift." Drift is a symptom; manual translation is the cause. |
| All-SVG ban? | No — too strict. Mark and primitive glyphs allowed. Illustrative/showcase SVGs disallowed. |
| Workpad status? | Internal design primitives sheet (PR #13). Not the public site. Never linked from production. |

## Recommended framing

The design goal shifts from:

> "One page, five items."

to:

> **"One page, one argument, built from reusable visual primitives — same grammar at every scale."**

## What lands in which PR

| PR | Contents |
|---|---|
| #11 | Move current site to `legacy/`, placeholder root. |
| #12 (this) | `PROPOSAL.md` + `DESIGN.md`. No site code. |
| next | `primitives.html` — proof of the visual vocabulary. No production links to it. |
| after | `index.html` (V1) composed from those primitives. Manual review against `DESIGN.md` and `legacy/moodboard.html`. |
