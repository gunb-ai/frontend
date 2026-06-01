/* ════════════════════════════════════════════════════════════════════
   gunb.ai · story-deck renderer
   ────────────────────────────────────────────────────────────────────
   One progressive example, four accreting stages.

   The deck is a single example (examples/api.dag) viewed at four
   successive depths:

     01  affected-set         — edit ripples to a subset of nodes
     02  + complexity lens    — that subset can be read structurally
     03  + idempotent upsert  — its effects compose safely on retry
     04  + service generation — the whole thing emits to four targets

   The graph layer accretes from stage to stage. Earlier visuals are
   never removed; each stage adds a new visual claim on top of the
   previous diagram. This is the workpad's "deck" pattern in spec form.

   HTML owns text. SVG owns structure. Graph nodes are unlabeled
   shapes — color, position, and shape (rect vs cut-corner pentagon)
   carry meaning. Concept text and the code pane carry the words.

   No build step. Plain script tag, IIFE, vanilla DOM.
   ══════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  /* ── Roles → CSS class ──────────────────────────────────────── */
  const Roles = {
    stable:     "map-stable",
    focus:      "map-focus",
    derived:    "map-derived",
    transitive: "map-transitive",
    artifact:   "map-artifact",
    removed:    "map-removed",
    boundary:   "map-boundary",
    context:    "map-context",
    skipped:    "map-skipped"   // dimmed nodes — present in the model but not in the affected set
  };
  const roleClass = r => Roles[r] || Roles.context;

  /* ── Code spec helpers ─────────────────────────────────────── */
  const tx  = v => ({ kind: "text", value: v });
  const kw  = v => ({ kind: "kw",   value: v });
  const ty  = v => ({ kind: "ty",   value: v });
  const com = v => ({ kind: "com",  value: v });
  const lit = v => ({ kind: "lit",  value: v });
  const ref = (id, text, role) => ({ kind: "ref", id, text: text || id, role: role || null });
  const mark = (text, role) => ({ kind: "mark", text, role });
  const ln       = (n, parts) => ({ n, parts });
  const blank    = (n)        => ({ n, parts: [] });
  const diffRm   = (n, parts) => ({ n, parts, diff: "rm" });
  const diffAdd  = (n, parts) => ({ n, parts, diff: "add" });

  /* ── Graph spec helpers ────────────────────────────────────── */
  // Nodes use absolute SVG coords (no column grid). Deck graphs are
  // small (workpad-style 360×220 viewBox) and hand-positioned for
  // structural meaning, not auto-layout.
  const node = (id, x, y, w, h, role) =>
    ({ kind: "node", id, x, y, w: w || 48, h: h || 30, role: role || "context" });
  const artifactSlot = (id, x, y, w, h) =>
    ({ kind: "artifact", id, x, y, w: w || 48, h: h || 30, role: "artifact" });
  const edge = (from, to, role) =>
    ({ from, to, role: role || "context" });
  // Accreted layers, added per stage.
  const lasso = points => ({ kind: "lasso", points });
  const dot   = (x, y) => ({ kind: "dot", x, y });
  const projEdge = (fromX, fromY, toX, toY, role) =>
    ({ kind: "projEdge", fromX, fromY, toX, toY, role: role || "derived" });

  /* ── Escape ────────────────────────────────────────────────── */
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ════════════════════════════════════════════════════════════════
     VALIDATORS — fail-closed on any structural contradiction.
     Apply per-stage. The base graph is the canonical node set.
     ══════════════════════════════════════════════════════════════ */

  const LINE_NUM_RE = /\bL\d+\b/;

  function validateStage(stage, baseGraph) {
    const nodeIds = new Set(baseGraph.nodes.map(n => n.id));
    // code refs must point to nodes in the base graph (or be marks)
    for (const line of stage.code) {
      for (const p of line.parts) {
        if (p.kind === "ref" && !nodeIds.has(p.id)) {
          throw new Error(stage.id + ": code ref '" + p.id + "' has no graph node");
        }
      }
    }
    // edges in base graph must connect valid nodes
    for (const e of baseGraph.edges) {
      if (!nodeIds.has(e.from)) throw new Error("edge from '" + e.from + "' missing in base");
      if (!nodeIds.has(e.to))   throw new Error("edge to '"   + e.to   + "' missing in base");
    }
    // no L## semantics in receipt or concept
    if (LINE_NUM_RE.test(stage.receipt || "")) {
      throw new Error(stage.id + ": receipt uses line-number shorthand: '" + stage.receipt + "'");
    }
    if (LINE_NUM_RE.test(stage.concept || "")) {
      throw new Error(stage.id + ": concept uses line-number shorthand");
    }
  }

  function validateDeck(deck) {
    for (const stage of deck.stages) validateStage(stage, deck.baseGraph);
  }

  /* ════════════════════════════════════════════════════════════════
     CODE RENDERER
     ══════════════════════════════════════════════════════════════ */

  function partHtml(p, refRole) {
    if (p.kind === "text") return esc(p.value);
    if (p.kind === "kw")   return '<span class="ck-kw">'  + esc(p.value) + '</span>';
    if (p.kind === "ty")   return '<span class="ck-ty">'  + esc(p.value) + '</span>';
    if (p.kind === "lit")  return '<span class="ck-lit">' + esc(p.value) + '</span>';
    if (p.kind === "com")  return '<span class="ck-com">' + esc(p.value) + '</span>';
    if (p.kind === "mark") return '<span class="' + roleClass(p.role) + '">' + esc(p.text) + '</span>';
    if (p.kind === "ref") {
      const role = p.role || refRole(p.id);
      const cls  = role ? roleClass(role) : "";
      return '<span class="ck-ref ' + cls + '" data-id="' + esc(p.id) + '">' + esc(p.text) + '</span>';
    }
    return "";
  }
  function lineHtml(line, refRole) {
    const lnNo = line.n != null
      ? '<span class="ck-ln">' + String(line.n).padStart(2, "0") + '</span> '
      : '<span class="ck-ln">  </span> ';
    const parts = line.parts.map(p => partHtml(p, refRole)).join("");
    if (line.diff === "rm")  return '<div class="ck-line ck-diff-rm">'  + lnNo + '<span class="ck-diff-sign">-</span> ' + parts + '</div>';
    if (line.diff === "add") return '<div class="ck-line ck-diff-add">' + lnNo + '<span class="ck-diff-sign">+</span> ' + parts + '</div>';
    return '<div class="ck-line">' + lnNo + '  ' + (parts || '&nbsp;') + '</div>';
  }
  function renderCode(stage, baseGraph, codeFile) {
    const roleById = {};
    for (const n of baseGraph.nodes) roleById[n.id] = n.role;
    const refRole = id => roleById[id];
    const head = '<div class="card-code-head">'
               + '<span class="ck-dot">●</span> '
               + '<span class="ck-file">' + esc(codeFile) + '</span>'
               + '</div>';
    const body = '<div class="card-code-body">'
               + stage.code.map(l => lineHtml(l, refRole)).join("")
               + '</div>';
    return '<div class="card-code">' + head + body + '</div>';
  }

  /* ════════════════════════════════════════════════════════════════
     GRAPH RENDERER — base graph + accumulated layers from stages 0..N
     ══════════════════════════════════════════════════════════════ */

  function renderGraph(baseGraph, layers, name) {
    const viewBox = baseGraph.viewBox || "0 0 360 220";

    // 1. Edges (drawn first so node fills mask any crossings).
    const edgesSvg = baseGraph.edges.map(e => {
      const a = baseGraph.nodes.find(n => n.id === e.from);
      const b = baseGraph.nodes.find(n => n.id === e.to);
      if (!a || !b) return "";
      // Edge from right-edge of source to left-edge of target.
      const x1 = a.x + a.w;
      const y1 = a.y + a.h / 2;
      const x2 = b.x;
      const y2 = b.y + b.h / 2;
      const cls = roleClass(e.role || a.role);
      return '<line class="graph-edge ' + cls + '" x1="' + x1 + '" y1="' + y1
           + '" x2="' + x2 + '" y2="' + y2 + '" marker-end="url(#deck-arrow)" />';
    }).join("");

    // 2. Accreted layers (lassos, projection edges) BEFORE nodes so
    //    nodes mask any crossings.
    const layerEdgesSvg = layers.filter(l => l.kind === "projEdge").map(l => {
      const cls = roleClass(l.role);
      return '<line class="graph-edge ' + cls + '" x1="' + l.fromX + '" y1="' + l.fromY
           + '" x2="' + l.toX + '" y2="' + l.toY + '" marker-end="url(#deck-arrow)" />';
    }).join("");
    const lassosSvg = layers.filter(l => l.kind === "lasso").map(l =>
      '<polygon class="graph-lasso" points="' + l.points + '" />'
    ).join("");

    // 3. Base graph nodes (no text — HTML owns the labels).
    const nodesSvg = baseGraph.nodes.map(n => {
      const cls = roleClass(n.role);
      if (n.kind === "artifact") {
        const cut = 8;
        const d = "M " + n.x + " " + n.y
                + " H " + (n.x + n.w - cut)
                + " L " + (n.x + n.w) + " " + (n.y + cut)
                + " V " + (n.y + n.h)
                + " H " + n.x + " Z";
        return '<g class="graph-node ' + cls + '">'
             + '<path d="' + d + '" />'
             + '<line x1="' + (n.x + n.w - cut) + '" y1="' + n.y
             + '" x2="' + (n.x + n.w - cut) + '" y2="' + (n.y + cut) + '" />'
             + '<line x1="' + (n.x + n.w - cut) + '" y1="' + (n.y + cut)
             + '" x2="' + (n.x + n.w) + '" y2="' + (n.y + cut) + '" />'
             + '</g>';
      }
      return '<g class="graph-node ' + cls + '">'
           + '<rect x="' + n.x + '" y="' + n.y + '" width="' + n.w
           + '" height="' + n.h + '" rx="4" />'
           + '</g>';
    }).join("");

    // 4. Artifact-slot layers (only in stage 04).
    const slotsSvg = layers.filter(l => l.kind === "artifact").map(n => {
      const cut = 8;
      const d = "M " + n.x + " " + n.y
              + " H " + (n.x + n.w - cut)
              + " L " + (n.x + n.w) + " " + (n.y + cut)
              + " V " + (n.y + n.h)
              + " H " + n.x + " Z";
      return '<g class="graph-node map-artifact">'
           + '<path d="' + d + '" />'
           + '<line x1="' + (n.x + n.w - cut) + '" y1="' + n.y
           + '" x2="' + (n.x + n.w - cut) + '" y2="' + (n.y + cut) + '" />'
           + '<line x1="' + (n.x + n.w - cut) + '" y1="' + (n.y + cut)
           + '" x2="' + (n.x + n.w) + '" y2="' + (n.y + cut) + '" />'
           + '</g>';
    }).join("");

    // 5. Dot markers — drawn last, on top of nodes.
    const dotsSvg = layers.filter(l => l.kind === "dot").map(l =>
      '<circle class="graph-dot" cx="' + l.x + '" cy="' + l.y + '" r="3" />'
    ).join("");

    const defs = '<defs>'
               + '<marker id="deck-arrow" viewBox="0 0 10 10" refX="9" refY="5"'
               + ' markerWidth="6" markerHeight="6" orient="auto">'
               + '<path d="M0,0 L10,5 L0,10 Z" fill="context-stroke"/>'
               + '</marker></defs>';

    return '<div class="card-graph">'
         + '<svg viewBox="' + viewBox + '" preserveAspectRatio="xMidYMid meet"'
         + ' fill="none" stroke="currentColor" stroke-width="1.5"'
         + ' stroke-linecap="round" aria-label="' + esc(name || "") + '">'
         + defs + edgesSvg + layerEdgesSvg + lassosSvg + nodesSvg + slotsSvg + dotsSvg
         + '</svg></div>';
  }

  /* ════════════════════════════════════════════════════════════════
     RECEIPT + STACK + STAGE + DECK RENDERERS
     ══════════════════════════════════════════════════════════════ */

  function receiptHtml(line) {
    return line.replace(/\{(\w+):([^}]*)\}/g, function (_, role, t) {
      return '<span class="' + roleClass(role) + '">' + esc(t) + '</span>';
    });
  }
  function renderReceipt(stage) {
    if (!stage.receipt) return "";
    const lines = Array.isArray(stage.receipt) ? stage.receipt : [stage.receipt];
    return '<div class="card-receipt">'
         + lines.map(r => '<div class="card-receipt-line">' + receiptHtml(r) + '</div>').join("")
         + '</div>';
  }
  function renderStack(stage) {
    if (!stage.stack || !stage.stack.length) return "";
    return '<div class="deck-card-stack">'
         + '<span class="stack-label">stack</span>'
         + stage.stack.map(s => '<span class="stack-piece">' + esc(s) + '</span>').join("")
         + '</div>';
  }
  function renderConcept(stage) {
    if (!stage.concept) return "";
    return '<p class="deck-card-concept">' + receiptHtml(stage.concept) + '</p>';
  }

  function renderStage(stage, accumulatedLayers, baseGraph, codeFile) {
    return '<article class="deck-card" data-stage-id="' + esc(stage.id) + '">'
         + '<div class="deck-card-head">'
         + '<span class="deck-card-num">'  + esc(stage.num)  + '</span>'
         + '<span class="deck-card-name">' + esc(stage.name) + '</span>'
         + '</div>'
         + renderConcept(stage)
         + '<div class="deck-card-body">'
         + renderCode(stage, baseGraph, codeFile)
         + renderGraph(baseGraph, accumulatedLayers, stage.name)
         + '</div>'
         + renderReceipt(stage)
         + renderStack(stage)
         + '</article>';
  }

  function renderDeck(deck) {
    validateDeck(deck);
    const total = deck.stages.length;
    const ticks = deck.stages.map(() => '<span class="deck-tick"></span>').join("");

    // Accumulate layers stage by stage.
    let layers = [];
    const cards = deck.stages.map(stage => {
      layers = layers.concat(stage.addLayers || []);
      return renderStage(stage, layers.slice(), deck.baseGraph, deck.codeFile);
    }).join("");

    return '<section class="deck" tabindex="0" aria-label="' + esc(deck.name || "") + '">'
         + '<div class="deck-head">'
         + '<span class="deck-name">' + esc(deck.name || "") + '</span>'
         + '<div class="deck-ticks">' + ticks + '</div>'
         + '<span class="deck-pos">'
         + '<span class="deck-current">01</span> / '
         + '<span class="deck-total">' + String(total).padStart(2, "0") + '</span>'
         + '</span>'
         + '</div>'
         + '<div class="deck-stage"><div class="card-track">' + cards + '</div></div>'
         + '<div class="deck-nav">'
         + '<button class="deck-btn" type="button" data-dir="prev">← prev</button>'
         + '<span style="flex:1"></span>'
         + '<button class="deck-btn" type="button" data-dir="next">next →</button>'
         + '</div>'
         + '</section>';
  }

  /* ════════════════════════════════════════════════════════════════
     NAVIGATION — prev/next buttons, ← / → keys, ticks update.
     ══════════════════════════════════════════════════════════════ */

  function initDeck(deck) {
    const track = deck.querySelector(".card-track");
    const cards = deck.querySelectorAll(".deck-card");
    const ticks = deck.querySelectorAll(".deck-tick");
    const current = deck.querySelector(".deck-current");
    const prev = deck.querySelector('[data-dir="prev"]');
    const next = deck.querySelector('[data-dir="next"]');
    let idx = 0;
    function go(newIdx) {
      idx = Math.max(0, Math.min(cards.length - 1, newIdx));
      track.style.transform = "translateX(-" + (idx * 100) + "%)";
      ticks.forEach((t, i) => t.classList.toggle("active", i <= idx));
      if (current) current.textContent = String(idx + 1).padStart(2, "0");
      if (prev) prev.disabled = idx === 0;
      if (next) next.disabled = idx === cards.length - 1;
    }
    if (prev) prev.addEventListener("click", () => go(idx - 1));
    if (next) next.addEventListener("click", () => go(idx + 1));
    deck.addEventListener("keydown", e => {
      if (e.key === "ArrowLeft")  { go(idx - 1); e.preventDefault(); }
      if (e.key === "ArrowRight") { go(idx + 1); e.preventDefault(); }
    });
    go(0);
  }

  /* ════════════════════════════════════════════════════════════════
     API_SYSTEM — the one shared source the deck operates on.

     Base graph (workpad-style coords, 360×220 viewBox):

         api ─── op1 (focus) ── aff1 (derived)
            \                \─ aff2 (derived)
             \─ op2 (skipped) ─ skip1 (skipped)
                              \─ skip2 (skipped)

     Each stage adds layers (lasso, dots, artifact slots) on top.
     ══════════════════════════════════════════════════════════════ */

  const DECK = {
    name: "story · api.dag · one example, four stages",
    codeFile: "examples/api.dag",
    baseGraph: {
      viewBox: "0 0 360 220",
      nodes: [
        node("api",   20,  85,  48, 30, "stable"),
        node("op1",   110, 20,  48, 30, "focus"),    // /todos -> list_todos_v2 (edited)
        node("op2",   110, 150, 48, 30, "skipped"),  // unrelated route
        node("aff1",  200, 8,   48, 30, "derived"),  // list_handler
        node("aff2",  200, 42,  48, 30, "derived"),  // list_client
        node("skip1", 200, 138, 48, 30, "skipped"),
        node("skip2", 200, 172, 48, 30, "skipped")
      ],
      edges: [
        edge("api", "op1",   "stable"),
        edge("api", "op2",   "skipped"),
        edge("op1", "aff1",  "derived"),
        edge("op1", "aff2",  "derived"),
        edge("op2", "skip1", "skipped"),
        edge("op2", "skip2", "skipped")
      ]
    },
    stages: [
      /* ── 01 · affected-set ────────────────────────────────── */
      {
        id: "stage-01",
        num: "01",
        name: "Affected-set",
        concept: "A line edit resolves to a <strong>graph-node edit</strong>. The {focus:focus identifier} in the source is the edited node; the {derived:derived identifiers} are the dependent nodes the compiler will recheck. Everything else stays {context:skipped} with a receipt.",
        code: [
          ln(1, [kw("service"), tx(" "), ty("Api"), tx(" {")]),
          ln(2, [tx("  "), kw("route"), tx(" /todos -> "), ref("op1", "list_todos_v2", "focus")]),
          ln(3, [tx("}")]),
          blank(4),
          ln(5,  [com("-- compiler:")]),
          ln(6,  [com("changed node: "), mark("Api.route.todos", "focus")]),
          ln(7,  [com("affected:     "), mark("list_handler", "derived"),
                  com(", "), mark("list_client", "derived")]),
          ln(8,  [com("skipped:      27 nodes (with receipt)")])
        ],
        addLayers: [], // base alone
        receipt: "{focus:changed} 1 node · {derived:affected} 4 nodes · {context:skipped} 27 (with receipt)",
        stack: ["affected_set"]
      },

      /* ── 02 · complexity lens ─────────────────────────────── */
      {
        id: "stage-02",
        num: "02",
        name: "Complexity lens",
        concept: "A <code>lens</code> reads a named subgraph through one structural property — here, complexity. The {derived:expression} in the source names the scope; the {derived:dashed lasso} in the diagram traces that scope around the actual nodes. Same subgraph, two registers.",
        code: [
          ln(1, [kw("service"), tx(" "), ty("Api"), tx(" {")]),
          ln(2, [tx("  "), kw("route"), tx(" /todos -> "), ref("op1", "list_todos_v2", "focus")]),
          ln(3, [tx("}")]),
          blank(4),
          ln(5, [com("-- read the affected subset through a structural lens")]),
          diffAdd(6, [kw("let"), tx(" cost = lens(complexity) over "),
                      mark("Api.route.todos.affected", "derived")]),
          blank(7),
          ln(8,  [com("cost.class:  O(n)")]),
          ln(9,  [com("cost.bound:  O(n)")]),
          ln(10, [com("cost.held:   true")])
        ],
        addLayers: [
          // dashed moss lasso around op1 + aff1 + aff2 (the affected set)
          lasso("105,18 200,3 252,6 252,74 200,77 105,52")
        ],
        receipt: "{derived:lens} complexity · {derived:scope} Api.route.todos.affected · {derived:class} O(n) · {derived:held} yes",
        stack: ["affected_set", "complexity"]
      },

      /* ── 03 · idempotent upsert ───────────────────────────── */
      {
        id: "stage-03",
        num: "03",
        name: "Idempotent upsert",
        concept: "Effects declared <code>upsert</code> compose safely — three resources here, three {derived:moss dots} on the diagram (one per resource). Re-running the same upsert against the same desired state changes nothing, so retrying after partial failure doesn't duplicate infra.",
        code: [
          ln(1, [kw("service"), tx(" "), ty("Api"), tx(" {")]),
          ln(2, [tx("  "), kw("route"), tx(" /todos -> "), ref("op1", "list_todos_v2", "focus")]),
          ln(3, [tx("}")]),
          blank(4),
          ln(5, [kw("let"), tx(" cost = lens(complexity) over "),
                 mark("Api.route.todos.affected", "derived")]),
          blank(6),
          ln(7,  [com("-- effects required by the affected route")]),
          diffAdd(8,  [kw("effect"), tx(" "), mark("Api.route.todos.affected", "derived"), tx(" {")]),
          diffAdd(9,  [tx("  upsert "), ty("postgres"),     tx("     { version: "), lit("\"15\""), tx(" }")]),
          diffAdd(10, [tx("  upsert "), ty("redis"),        tx("        { version: "), lit("\"7\""),  tx(" }")]),
          diffAdd(11, [tx("  upsert "), ty("worker_pool"),  tx("  { size: "), lit("8"), tx(" }")]),
          diffAdd(12, [tx("}")]),
          blank(13),
          ln(14, [com("all upserts idempotent:  yes")]),
          ln(15, [com("duplicates_on_retry:     0")])
        ],
        addLayers: [
          // three moss dots — one for each upsert resource — placed on
          // the affected-set nodes (one per moss-stroked node).
          dot(156, 23),  // top-right corner of op1
          dot(246, 11),  // top-right corner of aff1
          dot(246, 45)   // top-right corner of aff2
        ],
        receipt: "{derived:effect} upsert × 3 · {derived:duplicates} 0 · {derived:retry} safe",
        stack: ["affected_set", "complexity", "idempotency"]
      },

      /* ── 04 · service generation ──────────────────────────── */
      {
        id: "stage-04",
        num: "04",
        name: "Service generation",
        concept: "Four <code>project</code> directives in the source, four {artifact:artifact slots} in the diagram — one each. The compiler re-emits <strong>only</strong> the files reachable from the affected subset; everything else stays unchanged with a receipt.",
        code: [
          ln(1, [kw("service"), tx(" "), ty("Api"), tx(" {")]),
          ln(2, [tx("  "), kw("route"), tx(" /todos -> "), ref("op1", "list_todos_v2", "focus")]),
          ln(3, [tx("}")]),
          blank(4),
          ln(5, [kw("let"), tx(" cost = lens(complexity) over "),
                 mark("Api.route.todos.affected", "derived")]),
          blank(6),
          ln(7,  [kw("effect"), tx(" "), mark("Api.route.todos.affected", "derived"), tx(" {")]),
          ln(8,  [tx("  upsert "), ty("postgres"), tx(", "), ty("redis"), tx(", "), ty("worker_pool")]),
          ln(9,  [tx("}")]),
          blank(10),
          ln(11, [com("-- omni-emit to multiple targets")]),
          diffAdd(12, [kw("project"), tx(" "), ty("Api"), tx(" -> "), lit("rust")]),
          diffAdd(13, [kw("project"), tx(" "), ty("Api"), tx(" -> "), lit("terraform")]),
          diffAdd(14, [kw("project"), tx(" "), ty("Api"), tx(" -> "), lit("k8s")]),
          diffAdd(15, [kw("project"), tx(" "), ty("Api"), tx(" -> "), lit("helm")]),
          blank(16),
          ln(17, [com("-- re-emit narrowed by affected_set:")]),
          ln(18, [com("  rust:      handlers/list_todos_v2.rs")]),
          ln(19, [com("  terraform: routes_api.tf")]),
          ln(20, [com("  k8s:       deployment.yaml")]),
          ln(21, [com("  helm:      values.yaml")])
        ],
        addLayers: [
          // four projection edges from api → 4 artifact slots
          projEdge(68, 97,  290, 23,  "derived"),
          projEdge(68, 99,  290, 65,  "derived"),
          projEdge(68, 103, 290, 145, "derived"),
          projEdge(68, 105, 290, 187, "derived"),
          // four artifact slots on the far right
          artifactSlot("rust",      290, 8,   48, 30),
          artifactSlot("terraform", 290, 50,  48, 30),
          artifactSlot("k8s",       290, 130, 48, 30),
          artifactSlot("helm",      290, 172, 48, 30)
        ],
        receipt: "{artifact:artifacts} rust · terraform · k8s · helm · {derived:re-emit} 4 files · {context:unchanged} 23 files",
        stack: ["affected_set", "complexity", "idempotency", "projection"]
      }
    ]
  };

  /* ════════════════════════════════════════════════════════════════
     BOOTSTRAP
     ══════════════════════════════════════════════════════════════ */

  function init() {
    const slot = document.querySelector('[data-deck="api.dag"]');
    if (!slot) return;
    slot.outerHTML = renderDeck(DECK);
    const deck = document.querySelector('.deck');
    if (deck) initDeck(deck);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
