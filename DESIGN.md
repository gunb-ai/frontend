# Design rules

Governance for the gunb.ai site. Hard constraints. A PR that violates one of these either fixes itself or explicitly justifies the override in the PR body.

Companion: `legacy/moodboard.html` is the philosophical source. `PROPOSAL.md` is the V1 specification. This file is the standing rule set.

## Thesis

> **Quiet confidence through visible structure.**

Operationalized as:

> **Every visible element is either a fact, a relation, a boundary, or a receipt.**

Mapped to the compiler:

```text
fact      → type, node, declaration, claim
relation  → edge, dependency, projection, emission
boundary  → invariant, diagnostic, unsupported path, external target
receipt   → output, compile result, witness, install command, proof line
```

## The 10 rules

1. **Every visual element must be a fact, relation, boundary, or receipt.** If it doesn't map, it doesn't belong.

2. **Colors are materials, not status signals.** Moss is structural continuity. Clay is a boundary. Neither means "success" or "danger." No traffic-light palette. No `--success`, `--warning`, `--primary-blue`, `--tier-*` tokens.

3. **Mono is native; diagrams are mono/panel-friendly.** This is a compiler. Mono is the actual register. Diagrams default to ASCII / panels / restrained SVG that inherits the type system.

4. **No new color without deriving it from the material palette.** New tokens must be expressible as a function of `--hue-warm`, `--hue-moss`, `--hue-clay` and the shared saturation/lightness scale defined in `legacy/moodboard.html`. Ad hoc hex values are forbidden.

5. **HTML owns text. SVG owns structure.** No SVG `<text>` for labels that matter. SVG carries node/edge/boundary geometry; HTML overlays the words. SVG is allowed for the mark and the primitive vocabulary in this file; **illustrative or showcase SVG (pipeline diagrams, schematics, Bode plots, capability DAGs, feature-showcase art) is forbidden on V1 production pages.**

6. **No animation unless it clarifies a structural transition.** Decoration is not justification. Cursor-follow, edge-draw, sweep keyframes, parallax, and idle wiggles are out.

7. **One mark everywhere.** Favicon, nav, docs, CLI context, future app icon. Same shape. Must survive 16 / 24 / 48 / 120 px. If it only works at hero scale, derive a simpler core glyph and use that as the mark.

8. **Pages compress, not enumerate.** A page should carry an argument, not a feature inventory. If you need a feature list, you need a docs page, not a landing section.

9. **If a section needs a badge to explain maturity, move that detail to docs.** No "Available now / Coming soon / Stabilizing / Planned" UI on production pages. Maturity is text in support docs, not color in the design system.

10. **The site should feel discovered, not sold.** No "Get started" CTA clusters, no benefit cards, no "Built for teams" copy, no gradient blobs, no launch-microsite energy.

11. **No visible gradients.** Surfaces are flat material. Depth comes from inset joints (top highlight + bottom shadow), not from a smooth color transition. Two narrow exceptions: (a) tightly-stopped `linear-gradient` used as a *pattern* (e.g. masonry-course seam lines) where the result reads as solid lines, not a gradient; (b) the mark itself, where two solid fills sit adjacent (body + features) with no transition between them.

12. **Glow is a material, not a decoration.** A subtle moss or clay `box-shadow` (≤ 8px blur, low opacity) is allowed as a *lit* affordance — focused link, active receipt, held invariant. It must read as the surface emitting light, not as a halo or glow effect for its own sake. Never as a hover decoration on inert text. Never on more than one surface at a time per viewport.

13. **Every visual mark corresponds to source.** Any shape on a diagram must trace to one of: a visible code token, a graph node, a graph edge, a compiler receipt, or an emitted artifact. If a shape doesn't correspond to one of those, it's decoration — remove it. Color carries the correspondence: a clay identifier in source ↔ a clay-stroked node in the diagram; a moss expression in source ↔ a moss-stroked element in the diagram.

14. **No hand-drawn arrowheads.** Directed edges use a shared `<marker id="arrow" orient="auto">` definition. The marker uses `fill="context-stroke"` so the arrowhead inherits the line's stroke color (moss, clay, currentColor). Hand-placed `<polyline>` arrowheads break orientation on diagonal edges and drift out of color sync with their lines — they are forbidden.

## Materials (canonical palette)

From `legacy/moodboard.html`. Reasons over hexes — if a color drifts from its reason, re-derive the hex from the reason.

```text
Void        Near-black, slightly warm. Product surface. The compiler's habitat.
Stone       Warm grey. Primary text on dark. Patient, recessive.
Warm white  Off-white, warm cast. Light-mode surface.
Moss        Structural continuity, link, held relation. Not "success."
Clay        Boundary, diagnostic, invariant break. Not "danger."
```

## Type roles

```text
statement   short prose claim                   Noto Sans
specifier   small caps / letter-spaced label    JetBrains Mono
code        block of source / command           JetBrains Mono
receipt     aligned ledger / proof row          JetBrains Mono
diagnostic  compiler voice inside Invariant     JetBrains Mono
```

No display font. No "tech-startup hero" typography.

## Panel types

```text
Fact panel       Stable claim. Stone border, quiet background.
Command panel    What to run. Mono, inset, optional moss cursor.
Invariant panel  Compiler diagnostic. Clay edge — clay is used ONLY here.
Receipt panel    Output / proof. Aligned ledger, optional moss left rule.
```

These four cover almost every content type. If you reach for a fifth, justify it.

## SVG primitives

Small, restrained vocabulary. Used together; composable across diagrams.

```text
node         small rounded rect or circle
edge         straight or 45° line
port         tiny square or short tick
fold         bracket shape
lens         aperture / vertical slit over an edge
artifact     terminal slot (rectangular)
boundary     clay break / dashed wall
checkpoint   clipped-corner ledger row
```

Constraints on SVG:

```text
one stroke weight site-wide
no gradients
no animated draw (rule 6)
labels in HTML (rule 5)
SVG shows relation, not decoration
```

## Layout primitives

```text
--measure: 54rem            standard column
--measure-narrow: 38rem     for dense prose
--gap-section: 4rem
--gap-block: 1.25rem
--radius: 3px
--line-weight: 1px
```

## Fractal repetition

The same grammar repeats at every scale:

```text
fact block   → panel → section → page → site
```

A page is a composition of sections; a section is a composition of panels; a panel is a composition of facts / relations / boundaries / receipts. New scales must be expressible in the same vocabulary.

## Process — primitives before pages

Before any production page changes, the visual primitive it uses must exist in `primitives.html` (Phase 0 of `PROPOSAL.md`). `primitives.html` is the unit test for the design system. A primitive that doesn't survive there does not enter the site.

## Override protocol

Any PR that violates a rule above must:

1. Quote the rule it violates.
2. State the structural justification (not aesthetic preference).
3. Either propose a rule amendment, or scope the override (this page only, this primitive only).

No silent overrides. Silent drift is what brought us here.
