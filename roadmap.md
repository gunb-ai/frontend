# Gunbai — Roadmap (Soft Launch Draft, 2026-06-01)

> Working document accompanying the public-facing site. Audience: friends, professionals, curious technical readers from forums and Reddit. **This is a soft launch — the project is mid-construction, and feedback is the whole point.** Pre-1.0; rough edges expected.

---

## What is Gunbai?

Gunbai is a **structural compiler for composable systems**. You describe your domain — its types, its workflows, its services — once, in a small typed language called `.dag`. The compiler reads that description and **emits the system across every layer that needs it**: backend handlers, frontend types and forms, database schema, API contracts, client SDKs, documentation, tests.

The point isn't to generate more code. It's that **every layer derives from the same source**, so layers can't disagree. Drift between your TypeScript client and your Rust backend isn't *checked* — it's *structurally impossible*. Your OpenAPI spec, your Postgres schema, and your iOS Swift client all walk the same typed graph. They cannot fall out of sync because there is nothing for them to fall out of sync *with*.

In a normal codebase, a single concept (say, "an Order") lives in eight or ten places that have to be kept in agreement by hand: the type definition, the database schema, the migration, the serializer, the API contract, the client SDK, the form, the tests, the docs. Get any one wrong → bug. Add a field → eight edits. Integration cost is **N × M** — N concepts times M layers, each pair maintained manually.

In `.dag`, you declare the concept once. The compiler emits the M layers. Integration cost becomes **N + M**.

---

## The mistake we're trying to fix

Modern software's hardest bugs aren't algorithmic — they're integration. Two layers of your stack disagree about what a field means, or what a status can be, or whether a function is idempotent, or what happens on retry. The bug isn't in any one file; it's in the *agreement* between files that was never enforced.

The conventional answer is more testing. The structural answer is: stop letting layers disagree in the first place. If your backend's `OrderStatus` enum and your frontend's status dropdown are both derived from one declaration, there's no possibility of a typo on one side that the other side doesn't know about. If your migration is generated from your schema, and your schema is generated from your type, an "ALTER TABLE drops column" mistake stops being a class of bug — because the type *is* the schema.

Existing tools touch slices of this — tRPC for TS↔TS, Hasura for Postgres↔GraphQL, OpenAPI for REST. They work, and we owe each of them credit for proving the model. But each is scoped to *one* language pair or *one* protocol. Gunbai's substrate hosts the type, the workflow, the language spec, and the transport spec in the same Node tree, and any combination of targets is a walk over that tree. **One source. Many surfaces. Drift impossible.**

---

## A concrete example

Here is what an `.dag` program looks like in practice:

```dag
type Order {
  customer: String
  amount: Float
  status: OrderStatus
}

type OrderStatus = Pending | Approved | Declined | Refunded

service OrderService {
  fn create_order(req: CreateOrderRequest) -> Order
    via rest::post("/orders")
  fn get_order(id: String) -> Order
    via rest::get("/orders/{id}")
}
```

From this declaration, the compiler can mechanically produce:

- The **Rust handler** with typed request and response, and the routing wiring.
- The **TypeScript client SDK** with the same types, autocompleted in your IDE.
- The **iOS / Android client** type definitions (same types, native idioms).
- The **Postgres migration** and schema declaration.
- The **OpenAPI document** with the right shapes.
- The **rendered admin form** (because `OrderStatus` has four variants — what else would the dropdown look like?).
- **Generated tests** that verify the declared behavior matches actual behavior.

Every output reads the same source. If you add a `Refunded` status, every emitted surface gets it. If you remove a field, every emitted surface loses it. **You did not write any of the wiring.** The wiring is the compiler's job.

---

## The deeper claims (for the compiler-literate)

The N+M story is the visible win. Under it sits a small handful of structural commitments that make the substrate target-agnostic by construction.

**Termination as a guarantee, not a hope.** `.dag` is a *total bounded language* — every loop is bounded in its iteration count by something the compiler can see. A workflow that doesn't terminate doesn't *time out* — it doesn't *compile*. Existing workflow engines (Airflow, Temporal, LangGraph) run your code and hope it stops. Gunbai refuses to emit code whose recursion can't be proven to descend on a strict sub-value. Closest peer: Idris/Agda totality checking — but those require you to write proofs. Gunbai gets totality for free from the language design.

**Effects inferred from algebra, not declared.** Most effect systems require you to *annotate* effects (Effect-TS, ZIO, Koka). Gunbai *derives* effect shape from the operation's algebraic structure: `PUT` is a lattice meet → idempotent; `POST /logs` is a monoid append → not idempotent. Idempotency isn't a flag you set; it's a property the compiler reads off the algebra. **No other workflow runtime infers idempotency.**

**Auto-parallelism from dependency structure.** Every other DAG runtime lets you *describe* parallel branches via syntax. Gunbai reads the dependency graph; parallelism is the default; sequencing is what needs justification. The compiler notices an accidentally-serial program.

**Compile-time cost bounds.** Because iteration is bounded and dependencies are visible, the complexity lens computes `O(work)` and `O(span)` from structure. Code whose declared cost contradicts its actual cost doesn't compile. For LLM-authored programs in particular, this means the inference bill is bounded by structure, not by the model's whim.

**The proof point.** We modeled LLVM's IR, ORCv2 JIT runtime, and DWARF debug info as typed bidirectional substrates in `.dag`. We reimplemented Mem2Reg with the invariants (SSA-form preservation, dominance, type-soundness, observable-behavior, PHI-well-formedness) declared as types. **Every check in LLVM's `Verifier.cpp` becomes a tautology when the IR is typed this way** — bug classes that have caused thousands of LLVM miscompilations over the years are structurally impossible. The same substrate primitives, pointed at XLS IR, emit Verilog. *One substrate, software and hardware targets, no drift between backends.* That's the categorical move.

---

## Where we are today

Gunbai is **mid-construction**. We're in the home stretch of an internal milestone called **R3 — thesis structural completion** — the point at which every load-bearing claim above is not just made but *verified by the compiler against the compiler*. R3 has about 100 named gates. As of mid-May 2026:

- Roughly **a third are closed** — passing in CI, no regression possible.
- Roughly **40% are in flight** — the implementation has landed, the tests verifying the claim are in review or in progress.
- The remainder are **declared but unstarted**.

Three critical-path clusters carry most of the remaining work:

- **Tests-As-Data** — the gate that says *every test the compiler depends on is itself a `.dag` declaration*. When this closes, the compiler is verifying itself against `.dag` tests, not against hand-written Rust. ~80 hand-written tests collapse into one structural gate.
- **Lens behavioral parity** — the four "lenses" (parallelism, effects, complexity, ownership) all reach feature parity with their v2 predecessors, on the v3 substrate. The compiler has internal proofs that the new lenses say the same things the old lenses said, on every program where they overlap.
- **Workflow-as-Data** — the substrate hosts its own workflow grammar. Build, CI, and deployment workflows become `.dag` programs the compiler can apply its own lenses to.

We expect R3 close in the next 8–12 weeks under normal conditions. **None of this work blocks anyone reading this from playing with `.dag` today** — the language is usable now, and rough edges are flagged in the docs as you encounter them.

---

## Where we're headed (R4 and beyond)

After R3 closes, the substrate is stable enough to take in new directions. The shortlist:

**Target saturation.** Today's emit targets are production-grade for Rust, demonstrably working for Python and Go, and skeletal for TypeScript, Swift, and Verilog. Bringing every target to production grade is mechanical (most of the work is target idioms, not substrate work) and turns "drift impossibility" from a claim into a guarantee across more of the stack.

**LLM-native orchestration.** The `.dag` substrate naturally hosts LLM workflows: bounded iteration eliminates runaway agent loops, effect inference catches accidental side-effects on retry, and the dependency graph compiles to a directly-executable orchestration program. We're working toward a model where **LLM-authored code is gated by the compiler before emission** — code that fails its structurally-generated tests *can't ship*, not "fails CI" but "can't be produced." For agentic workflows specifically, this collapses the test/debug/retry cycle from runtime feedback to compile-time enforcement.

**Language-as-query-surface.** A direction we're starting to scope: an LLM working on a `.dag` codebase asks the language *semantic* questions instead of reading files. "What calls `foo`?" "What types does this implement?" "What does the complexity lens say about this function?" "What does this type look like in the TypeScript emit?" — returned as small structured answers. Because `.dag` is closed and total, every such answer is total too; the compiler is a far better context provider than file-grep ever was.

**Ecosystem.** Importers from existing schemas (OpenAPI, Prisma, GraphQL → `.dag`), IDE integration, language-server work, packaging, registry. A lot of "boring infra" that turns the language from a private tool into something a team can adopt.

**Self-hosting depth.** Gunbai's compiler is in Rust today, but the compiler's own logic lives in `.dag` source that emits to that Rust. The goal is **pure bootstrap** — every load-bearing compiler decision lives in `.dag`, with the Rust output as a mechanical translation. The path to this is enumerated; the remaining floor is small.

---

## What we'd love feedback on

This is a soft launch. We're showing the project to people we trust before it's ready for a wider audience. Specific things we'd love your reaction to:

- **Does the omni-emission story land in 60 seconds?** Or did you have to read it twice? If twice, where did it stall?
- **Is the `.dag` syntax readable on first look?** Or does it feel like another DSL you don't want to learn?
- **What domain do you immediately want to try `.dag` on?** Honest answer — what's the first problem in your own work where you thought "wait, I'd use this"?
- **What's the rebuttal?** The strongest version of "this won't work for me because…" — we'd rather hear it now than at full launch.
- **What's the comparison we're missing?** If there's a project we should know about and don't, please tell us.

---

## Try it / read more

- **Play with `.dag`** — *(TBD: Codespaces playground link + repo URL)*. Click, wait ~30s for the dev environment to spin up, and you're in a real VS Code with a working compiler and example programs.
- **Read in browser** — *(TBD: vscode.dev link)* if you just want to look at the code without running anything.
- **Source code** — *(TBD: gunbc repo URL when public)*.
- **Thesis** — the load-bearing claims in long form: `THESIS.md` in the repo, plus `docs/thesis/` for the extended argumentation.
- **Roadmap detail** — `ROADMAP.md` in the repo has the live operational plan, including the R3 gate ledger.

Reach the team: *(TBD: contact channels — email / Discord / GitHub Discussions)*.

---

*Gunbai is built by a small team. We are not VC-backed and have no service to sell you. We're trying to build the language we wish existed. If any of this resonates, we'd love to hear from you.*
