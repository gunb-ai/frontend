# Release Blockers — Operator-Side Validation Tracking

**Owner:** `zesty-dove-792` (Release PM) on behalf of operator `briansrls`
**Created:** 2026-05-13
**Status:** ACTIVE — soft-launch publication blocked until each `BLOCKING` item has a resolved disposition
**Imperative (P0):** Every public-surface claim must clear `grep-anchor + test-consumer + CI-receipt + surface-match + audience-bullshit-detector` before publication. Departing from the 2026 standard of "we solved the world on an HTML page."

---

## Why this file exists

Running list of validated gaps between the current `gunb-ai/frontend#2` roadmap draft (and any future public surface) and tree-anchored reality. Each entry is one of:

- A **claim** in the draft that fails P0 and cannot ship as-framed
- A **tree-state question** requiring gunbc-side coordination (PM `deep-wolf-155`)
- An **engineering ask** that would strengthen a claim's verifiability if dispatched

When every `BLOCKING` item has a resolved disposition, soft-launch publication unblocks subject to operator go/no-go.

## Routing legend

- `[OP]` — operator (`briansrls`) decides framing disposition (cut / hedge / move-to-R4)
- `[PM]` — discuss with gunbc PM `deep-wolf-155` (tree state, timing, engineering work)
- `[BOTH]` — operator decides framing; gunbc-side work could change disposition

---

## Open items

### B1 [OP] — Frontend client emission claims (TS / iOS / Android / Swift)

**Source:** `roadmap.md` lines 9, 11, 53, 54, 102
**Drafted as:**
- "emits the system across every layer that needs it: backend handlers, frontend types and forms, database schema, API contracts, client SDKs, documentation, tests"
- "Drift between your TypeScript client and your Rust backend... iOS Swift client all walk the same typed graph"
- "TypeScript client SDK / iOS / Android client / rendered admin form / Generated tests"
- "skeletal for TypeScript, Swift, and Verilog"

**Tree state:** Zero substrate at HEAD. R3 emit trio is Rust + Python + Go ONLY per PM msg_7d5c41f0. TypeScript exists only as future-candidate in `docs/phase1-lane3-consolidation-build-plan.md:143-153`. iOS/Android have no substrate.

**P0 verdict:** Past-tense claims for unbuilt capability. **BLOCKING.**

**Unblock options:** Cut these mentions entirely (most conservative) or move to "Where we're headed" with explicit R4+ tag.

**Operator edit blocks ready:** EB1, EB2, EB3, EB6

---

### B2 [OP] — LLVM Verifier.cpp tautology

**Source:** `roadmap.md` line 76

**Drafted as:** "We modeled LLVM's IR, ORCv2 JIT runtime, and DWARF debug info as typed bidirectional substrates in `.dag`. We reimplemented Mem2Reg with the invariants... **Every check in LLVM's `Verifier.cpp` becomes a tautology when the IR is typed this way**"

**Tree state:** R4 future work per `docs/r4-c-compiler-and-llvm-in-dag-program-plan.md` (DRAFT 2026-05-12, "execution promotion plan"). Only a "W4 emit spike" exists. Zero `.dag` files reference mem2reg/verifier/orcv2/dwarf. The 5 named invariants (SSA-form, dominance, type-soundness, observable-behavior, PHI-well-formedness) appear nowhere as declared types.

**P0 verdict:** Aspirational presented as past-tense; "we modeled / reimplemented" reads as banked. **BLOCKING.**

**Unblock options:** Cut paragraph (EB8A — recommended) / hedge in place (EB8B) / move to R4 section (EB8C).

**OV ref:** `wise-ibex-458` msg_0901c352 (OV-1)

---

### B3 [OP] — XLS → Verilog same-substrate

**Source:** `roadmap.md` line 76 (same paragraph as B2)

**Drafted as:** "The same substrate primitives, pointed at XLS IR, emit Verilog. *One substrate, software and hardware targets, no drift between backends.*"

**Tree state:** Zero `.dag` files reference `xls` or `verilog`. `docs/thesis/what-else-falls-out.md:140-170` explicitly says "Shape A is the target architecture, not the current reality." R4 plan lock A2 references XLS/Verilog as future bidirectional target.

**P0 verdict:** Not a current capability. **BLOCKING.**

**Unblock options:** Cut sentence entirely (recommended) or move to "Where we're headed" R4 framing.

**OV ref:** `wise-ibex-458` msg_0901c352 (OV-2)

---

### B4 [BOTH] — Termination / totality compile-rejection

**Source:** `roadmap.md` line 68

**Drafted as:** "Every loop is bounded in its iteration count... A workflow that doesn't terminate doesn't *time out* — it doesn't *compile*. Gunbai refuses to emit code whose recursion can't be proven to descend on a strict sub-value... Gunbai gets totality for free from the language design."

**Tree state:**
- Carriers exist: `DescentEvidence = Strict | NonIncreasing | DescentUnknown` lattice in `src/v3/std/termination.dag:13-72`
- Producer is fail-closed at executor: `LoopBoundDescentResidual` per `docs/briefs/r3-pr-e5-loopbound-descent-stop-packet.md`
- NO fixture/test exercises non-terminating ⇒ compile-rejection in `src/v3/compiler/tests/integration/`

**P0 verdict:** "Doesn't compile" is wrong today — it's executor-residual, not compile-rejected. **BLOCKING.**

**Unblock options:**
- `[OP]` Hedge per `wise-ibex-458` OV-3 wording: substrate ✓, producer in flight (R3 E5)
- `[OP]` Move claim entirely to "Where we're headed"
- `[PM]` Confirm: when does descent-execution producer land? Affects framing horizon.

**OV ref:** `wise-ibex-458` msg_61bb473b (OV-3)

---

### B5 [BOTH] — Effect inference from algebra

**Source:** `roadmap.md` line 70

**Drafted as:** "Gunbai *derives* effect shape from the operation's algebraic structure: `PUT` is a lattice meet → idempotent; `POST /logs` is a monoid append → not idempotent. Idempotency isn't a flag you set; it's a property the compiler reads off the algebra."

**Tree state:**
- `derive_effect_shape(method, path)` in `src/v3/std/effects.dag:23-31,656-680` IS live — but reads HTTP method + path, NOT algebraic structure (`GET → ReadEffect`, `PUT + path-key → UpsertEffect`, `POST → CreateEffect`)
- Migration to algebra-inhabitance (`IdempotentRead<R>` / `Mutating<R>` / `Append<R>`) is F-β.2 (gate #82), NOT landed
- `src/v3/lenses/effect_enumeration.dag:1-50` is "STRUCTURALLY TERMINAL; BEHAVIORALLY PARTIAL"

**P0 verdict:** Derivation-from-non-annotation is true; derivation-from-*algebraic-structure* is aspirational. The specific PUT/POST examples don't match the actual derivation mechanism. **BLOCKING as currently framed.**

**Unblock options:**
- `[OP]` Hedge per `wise-ibex-458` OV-4 wording: transport-method derivation ✓ today; algebra-inhabitance in flight as F-β.2
- `[PM]` Confirm: when does F-β.2 atomic-migration (gate #82) land? Affects whether the algebra framing is achievable pre-June-1.

**OV ref:** `wise-ibex-458` msg_61bb473b (OV-4)

---

### B6 [BOTH] — Auto-parallelism "notices accidentally-serial"

**Source:** `roadmap.md` line 72

**Drafted as:** "Gunbai reads the dependency graph; parallelism is the default; sequencing is what needs justification. The compiler notices an accidentally-serial program."

**Tree state:**
- `src/v3/lenses/parallelism.dag:1-20` is "STRUCTURALLY TERMINAL; BEHAVIORALLY PARTIAL"
- Today's lens flags unsafe parallel composition via `ParallelismUnsupportedKind` — the INVERSE of the claim
- Auto-parallelism witness producer is research-only pre-authoring per `docs/briefs/r3-v-auto-parallelism-memoization-witness-shapes.md`
- Behavioral landing for "notices serial" is F-γ.1 (cascade-gated on F-α + T-LAS Slice B)

**P0 verdict:** Specific "notices accidentally-serial" diagnostic is aspirational. **BLOCKING.**

**Unblock options:**
- `[OP]` Hedge per `wise-ibex-458` OV-5 wording: DAG-execution inherently parallel ✓; serial-flag diagnostic in flight (R3 Gap 4 F-γ.1)
- `[PM]` Confirm: F-γ.1 cascade timing relative to June 1 checkpoint

**OV ref:** `wise-ibex-458` msg_61bb473b (OV-5)

---

### B7 [PM] — Engineering ask: side-by-side omni-emit snapshots

**Source:** Demo polish — operator's stated pillar #2; PM `deep-wolf-155` msg_7d5c41f0 explicitly flagged as cheapest soft-launch win

**Tree state:** No `.expected.{rs,yaml,py}`, no `.golden*`, no `*snapshot*` for emitted outputs. `m1_5_omni_shape_b_openapi_test` asserts in-memory only. No `examples/` directory at gunbc repo root.

**Why it matters:** Side-by-side input → output is the visceral omni-emission demo. Without it, the public surface either link-dumps integration test source (low signal) or makes the claim without an artifact (P0 violation).

**Unblock path:** Worker brief drafted (WS2.1 in this session) — `examples/todo_service/out.{rs,py,go,yaml,sql,md}` + `scripts/regen-demo-snapshots.sh` + byte-identical ratchet test. Effort: S–M, 1 worker, 1-2 days.

**Status:** Brief awaiting operator forward to PM `deep-wolf-155` for dispatch.

---

### B8 [PM] — Engineering ask: `CostBounded` wrong-bound public demo fixture

**Source:** Demo polish — operator's stated pillar #1 (complexity); PM `deep-wolf-155` msg_7d5c41f0 confirmed diagnostic exists in `src/v3/compiler/tests/integration.rs` but is not a public-facing artifact

**Tree state:** `test_runner.rs:2555` dispatches `CostBounded` evaluation. Wrong-bound test exists buried in `integration.rs` — produces diagnostic `"cost X did not satisfy bound Y"`. No public-facing `.dag` fixture surfaces this visceral demo.

**Why it matters:** Complexity lens is one of operator's two pillars to "push hard on quality." A ~50-line `.dag` fixture that demonstrates "compiler caught my wrong cost bound" is the strongest single SWE-visceral demo for the complexity story.

**Unblock path:** Worker brief drafted (WS2.2 in this session) — fixture with passing + failing CostBounded claims, integration test consumer, short README. Effort: M, 1 worker, ~2 days.

**Status:** Brief awaiting operator forward to PM `deep-wolf-155` for dispatch.

---

### B9 [PM] — Cross-target stdout-parity certification corpus (Gap 2 timing)

**Source:** Roadmap framing — "Rust + Python + Go emission" strength

**Tree state:** Per PM `deep-wolf-155` msg_7d5c41f0: single-program Rust↔Go behavioral parity exists (`emit_go_and_rust_programs_are_behaviorally_equivalent_when_go_is_available` test in `src/v3/compiler/tests/boundary/m1_3_emit_go_test.rs`). Full-corpus stdout-parity is R3 Gap 2 (worker `crisp-bat-148` under Verification Mgr `still-moth-538`) — NOT yet on main.

**Why it matters:** If Gap 2 closes by June 1, public framing strengthens from "single-program parity" to "behavioral parity verified across N programs." If not, conservative single-program framing applies (already in EB6 draft).

**Question for PM:** Status of Gap 2 close ETA? Visible by June 1 checkpoint?

---

### B10 [PM] — `ClassLinearithmic` classifier completeness (Gap 11)

**Source:** Adjacent finding from this thread; surfaced by operator-side audit of `complexity_merge_sort_is_nlogn` comparing to `Int = 3` (M1(2.8))

**Tree state:** Per PM `deep-wolf-155` msg_7d5c41f0: classifier `classify_symbolic_cost` may never produce `ClassLinearithmic` (Gap 11 audit, just authored in PR #3037). The lattice has `ClassLinearithmic` as an enumerated tier but only `enforced_lens_application.rs:960-962` string-deserialization appears to produce it.

**Why it matters:** Operator wants complexity lens to show structured asymptotic-class output (`O(n log n)`-style) — the visceral pillar demo. Today's gate compares to `Int = 3` per M1(2.8) gap. Without Gap 11 close + M1(2.8) resolution, the lens can't structurally surface "O(n log n)" as a banked output.

**Question for PM:** Status of Gap 11 close + M1(2.8) `Lookup<Int>` in `data` bodies? ETA? Either landing would strengthen the complexity pillar; both landing would close it.

---

### B11 [BOTH] — Cross-cutting framing: "carriers landed / producers in flight"

**Source:** Pattern surfaced by `wise-ibex-458` across OV-3, OV-4, OV-5

**The pattern:** Multiple "deeper claims" in the draft past-tense the producer side without saying so. The tree shows substrate/carrier-tier landed + producer/checker-tier as active XL work (R3 Gap 4 cluster F). Three load-bearing claims (termination, effects, parallelism) all share this shape.

**Why it matters:** The deeper-claims section as structured isn't salvageable in "where we are today" framing without the soft-launch trap. The cross-cutting fix is structural, not per-line.

**Unblock options:**
- `[OP]` EB9A — Strip deeper-claims section, move all claims to "Where we're headed" with R-milestone tags (most conservative)
- `[OP]` EB9B — Keep section with 2 verified bullets only (cost + cross-pattern note)
- `[OP]` EB9C — Keep section with worker-hedged wording, retitle as "Structural commitments — design landed, checkers in flight"
- `[PM]` *(optional)* Confirm whether explicit public-facing naming of this cross-pattern is acceptable per gunbc-side authorities (it would surface R3 Gap 4 cluster F as the active load-bearing work)

**PM recommendation:** EB9A — maximally conservative, fits operator's "not the 2026 'we solved the world' page" framing.

---

## Resolved items

*(none yet)*

---

## Process notes

- New entries: append below the last open item with the next `B<N>` ID
- Resolved entries: move to "Resolved items" with one-line disposition (e.g., "B2 resolved 2026-05-15: cut per EB8A, operator approved")
- Each entry should cite: source line in `roadmap.md`, tree-anchored evidence, P0 verdict, unblock options
- This file is operator-side coordination — it never publishes; it lives until soft-launch ratification

When every `BLOCKING` item has a disposition note and is moved to Resolved, soft-launch publication unblocks subject to operator go/no-go (WS3.2 in release-PM tasks).

---

*Created: 2026-05-13. Last updated: 2026-05-13. Owner: `zesty-dove-792` (Release PM).*
