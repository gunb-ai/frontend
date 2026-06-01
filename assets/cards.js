/* ════════════════════════════════════════════════════════════════════
   gunb.ai · card renderer
   ────────────────────────────────────────────────────────────────────
   Card spec → code DOM + graph SVG, generated from one model.

   - Code refs MUST map to graph nodes/artifacts (validated at render).
   - Artifact widths computed from label length (no overflow).
   - SVG viewBox computed from node bounds (no clipping).
   - Edges use elbow routing + auto-orient arrowhead.
   - Nodes render after edges so labels stay legible.
   - No build step. Plain script tag, IIFE, vanilla DOM.
   ══════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  /* ── Role → CSS class ───────────────────────────────────────── */
  const Roles = {
    root:     "map-root",
    affected: "map-affected",
    changed:  "map-changed",
    artifact: "map-artifact",
    blocked:  "map-blocked",
    context:  "map-context"
  };
  const roleClass = r => Roles[r] || Roles.context;

  /* ── Code spec helpers ─────────────────────────────────────── */
  const text = v => ({ kind: "text", value: v });
  const kw   = v => ({ kind: "kw",   value: v });
  const ty   = v => ({ kind: "ty",   value: v });
  const com  = v => ({ kind: "com",  value: v });
  const ref  = (id, txt, role) => ({ kind: "ref", id, text: txt || id, role: role || null });
  const line     = (n, parts)  => ({ n, parts });
  const blank    = (n)         => ({ n, parts: [] });
  const diffRm   = (n, parts)  => ({ n, parts, diff: "rm" });
  const diffAdd  = (n, parts)  => ({ n, parts, diff: "add" });

  /* ── Graph spec helpers ────────────────────────────────────── */
  const node     = (id, label, col, row, role) =>
    ({ kind: "node", id, label, col, row, role: role || "context" });
  const artifact = (id, label, col, row, role) =>
    ({ kind: "artifact", id, label, col, row, role: role || "artifact" });
  const edge     = (from, to, label, role, lane) =>
    ({ from, to, label: label || "", role: role || "affected", lane: lane || 0 });

  /* ── Layout ────────────────────────────────────────────────── */
  const COL_GAP = 56;   // min gap between adjacent columns
  const Y_GAP   = 46;
  const BASE_X  = 18;
  const BASE_Y  = 22;
  const NODE_H  = 28;
  const PAD     = 18;

  function labelWidth(label) {
    return Math.max(60, label.length * 7.2 + 22);
  }
  // Column starts are derived from each column's widest node, so a column
  // packed with long labels does not crowd the next column and force the
  // elbow router into back-steps.
  function columnXs(nodes) {
    const widest = {};
    for (const n of nodes) {
      const w = labelWidth(n.label);
      if (!(n.col in widest) || w > widest[n.col]) widest[n.col] = w;
    }
    const cols = Object.keys(widest).map(Number).sort((a, b) => a - b);
    const x = {};
    let cx = BASE_X;
    for (const c of cols) { x[c] = cx; cx += widest[c] + COL_GAP; }
    return x;
  }
  function layoutNodes(nodes) {
    const x = columnXs(nodes);
    return nodes.map(n => Object.assign({}, n, {
      x: x[n.col],
      y: BASE_Y + n.row * Y_GAP,
      w: labelWidth(n.label),
      h: NODE_H
    }));
  }
  function graphBounds(nodes) {
    const maxX = Math.max.apply(null, nodes.map(n => n.x + n.w));
    const maxY = Math.max.apply(null, nodes.map(n => n.y + n.h));
    return { width: maxX + PAD, height: maxY + PAD };
  }
  function edgeGeom(a, b, lane) {
    const sx = a.x + a.w;
    const sy = a.y + a.h / 2;
    const tx = b.x;
    const ty = b.y + b.h / 2;
    const sameRow = Math.abs(sy - ty) < 1 && (lane || 0) === 0;
    // Elbow midpoint clamped so the final H tx segment always travels
    // toward the target (arrowhead orientation depends on this).
    const baseMid = sx + Math.max(18, (tx - sx) * 0.45);
    const mid = Math.min(baseMid + (lane || 0) * 12, tx - 8);
    return { sx, sy, tx, ty, mid, sameRow };
  }
  function edgePath(a, b, lane) {
    const g = edgeGeom(a, b, lane);
    if (g.sameRow) return "M " + g.sx + " " + g.sy + " L " + g.tx + " " + g.ty;
    return "M " + g.sx + " " + g.sy + " H " + g.mid + " V " + g.ty + " H " + g.tx;
  }

  /* ── Escape ────────────────────────────────────────────────── */
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ── Validation ────────────────────────────────────────────── */
  function validate(card) {
    const ids = new Set(card.graph.nodes.map(n => n.id));
    for (const ln of card.code) {
      for (const p of ln.parts) {
        if (p.kind === "ref" && !ids.has(p.id)) {
          throw new Error(card.id + ": code ref '" + p.id + "' has no graph node");
        }
      }
    }
    for (const e of card.graph.edges) {
      if (!ids.has(e.from)) throw new Error(card.id + ": edge source '" + e.from + "' missing");
      if (!ids.has(e.to))   throw new Error(card.id + ": edge target '" + e.to   + "' missing");
    }
  }

  /* ── Code renderer ─────────────────────────────────────────── */
  function partHtml(p, refRole) {
    if (p.kind === "text") return esc(p.value);
    if (p.kind === "kw")   return '<span class="ck-kw">'  + esc(p.value) + '</span>';
    if (p.kind === "ty")   return '<span class="ck-ty">'  + esc(p.value) + '</span>';
    if (p.kind === "com")  return '<span class="ck-com">' + esc(p.value) + '</span>';
    if (p.kind === "ref") {
      const role = p.role || refRole(p.id);
      const cls  = role ? roleClass(role) : "";
      return '<span class="ck-ref ' + cls + '" data-id="' + esc(p.id) + '">' + esc(p.text) + '</span>';
    }
    return "";
  }
  function lineHtml(ln, refRole) {
    const lnNo = ln.n != null
      ? '<span class="ck-ln">' + String(ln.n).padStart(2, "0") + '</span> '
      : '<span class="ck-ln">  </span> ';
    const parts = ln.parts.map(p => partHtml(p, refRole)).join("");
    if (ln.diff === "rm") {
      return '<div class="ck-line ck-diff-rm">' + lnNo + '<span class="ck-diff-sign">-</span> ' + parts + '</div>';
    }
    if (ln.diff === "add") {
      return '<div class="ck-line ck-diff-add">' + lnNo + '<span class="ck-diff-sign">+</span> ' + parts + '</div>';
    }
    return '<div class="ck-line">' + lnNo + '  ' + (parts || '&nbsp;') + '</div>';
  }
  function renderCode(card) {
    // Derive each ref's role from its graph node (so code color tracks graph color)
    const roleById = {};
    for (const n of card.graph.nodes) roleById[n.id] = n.role;
    const refRole = id => roleById[id];

    const head = '<div class="card-code-head">'
               + '<span class="ck-dot">●</span> '
               + '<span class="ck-file">' + esc(card.codeFile || (card.id + ".dag")) + '</span>'
               + '</div>';
    const body = '<div class="card-code-body">'
               + card.code.map(ln => lineHtml(ln, refRole)).join("")
               + '</div>';
    return '<div class="card-code">' + head + body + '</div>';
  }

  /* ── Graph renderer ────────────────────────────────────────── */
  function renderGraph(card) {
    const nodes = layoutNodes(card.graph.nodes);
    const byId  = {};
    for (const n of nodes) byId[n.id] = n;
    const bounds = graphBounds(nodes);

    // 1. Edges (rendered first so node fills cover any crossings)
    const edgesSvg = card.graph.edges.map(e => {
      const a = byId[e.from];
      const b = byId[e.to];
      const cls = roleClass(e.role);
      return '<path class="graph-edge ' + cls + '" d="' + edgePath(a, b, e.lane)
           + '" marker-end="url(#card-arrow)" />';
    }).join("");

    // 2. Edge labels — sit on the horizontal segment that approaches the
    // target, so the label visually attaches to its destination row
    // rather than floating beside the vertical bus.
    const edgeLabels = card.graph.edges.filter(e => e.label).map(e => {
      const a = byId[e.from];
      const b = byId[e.to];
      const g = edgeGeom(a, b, e.lane);
      const lx = g.sameRow ? (g.sx + g.tx) / 2 : (g.mid + g.tx) / 2;
      const ly = (g.sameRow ? g.sy : g.ty) - 4;
      const cls = roleClass(e.role);
      return '<text class="graph-edge-label ' + cls + '" x="' + lx
           + '" y="' + ly + '" text-anchor="middle">' + esc(e.label) + '</text>';
    }).join("");

    // 3. Nodes (cover edges with their fills/text)
    const nodesSvg = nodes.map(n => {
      const cls = roleClass(n.role);
      if (n.kind === "artifact") {
        // Cut-corner artifact path: pentagon with the top-right corner sliced.
        const cut = 8;
        const d = "M " + n.x + " " + n.y
                + " H " + (n.x + n.w - cut)
                + " L " + (n.x + n.w) + " " + (n.y + cut)
                + " V " + (n.y + n.h)
                + " H " + n.x + " Z";
        return '<g class="graph-node ' + cls + '">'
             + '<path d="' + d + '" />'
             + '<text x="' + (n.x + n.w / 2) + '" y="' + (n.y + n.h / 2 + 4)
             + '" text-anchor="middle">' + esc(n.label) + '</text>'
             + '</g>';
      }
      return '<g class="graph-node ' + cls + '">'
           + '<rect x="' + n.x + '" y="' + n.y + '" width="' + n.w
           + '" height="' + n.h + '" rx="4" />'
           + '<text x="' + (n.x + n.w / 2) + '" y="' + (n.y + n.h / 2 + 4)
           + '" text-anchor="middle">' + esc(n.label) + '</text>'
           + '</g>';
    }).join("");

    const defs = '<defs>'
               + '<marker id="card-arrow" viewBox="0 0 10 10" refX="9" refY="5"'
               + ' markerWidth="6" markerHeight="6" orient="auto">'
               + '<path d="M0,0 L10,5 L0,10 Z" fill="context-stroke"/>'
               + '</marker>'
               + '</defs>';

    return '<div class="card-graph">'
         + '<svg viewBox="0 0 ' + bounds.width + ' ' + bounds.height
         + '" preserveAspectRatio="xMidYMid meet" aria-label="' + esc(card.name || "") + '">'
         + defs + edgesSvg + edgeLabels + nodesSvg
         + '</svg>'
         + '</div>';
  }

  /* ── Receipt renderer ──────────────────────────────────────── */
  function receiptHtml(line) {
    // Allow inline role tokens: {role:text}
    return line.replace(/\{(\w+):([^}]*)\}/g, function (_, role, txt) {
      return '<span class="' + roleClass(role) + '">' + esc(txt) + '</span>';
    });
  }
  function renderReceipt(card) {
    return '<div class="card-receipt">'
         + card.receipt.map(r => '<div class="card-receipt-line">' + receiptHtml(r) + '</div>').join("")
         + '</div>';
  }

  /* ── Card renderer ─────────────────────────────────────────── */
  function renderCard(spec) {
    validate(spec);
    return '<article class="card" data-card-id="' + esc(spec.id) + '">'
         + '<header class="card-head">'
         + '<span class="card-num">'  + esc(spec.num)  + '</span>'
         + '<span class="card-name">' + esc(spec.name) + '</span>'
         + '</header>'
         + '<div class="card-body">'
         + renderCode(spec)
         + renderGraph(spec)
         + '</div>'
         + renderReceipt(spec)
         + '</article>';
  }

  /* ════════════════════════════════════════════════════════════════
     Card specs — three causal proofs against one Users domain.
     STRUCTURE → CHANGE → CONSTRAINT.
     ══════════════════════════════════════════════════════════════ */

  /* ── 01 · STRUCTURE: one description, four target artifacts ── */
  const card01 = {
    id: "card-01",
    num: "01",
    name: "one description · four target artifacts",
    codeFile: "examples/users.dag",
    code: [
      line(1,  [kw("type"), text(" "), ty("Timestamp"), text(" = "), ty("IsoDateTime")]),
      line(2,  [kw("type"), text(" "), ty("UserId"), text("    = String")]),
      blank(3),
      line(4,  [kw("type"), text(" "), ref("User", "User", "root"), text(" {")]),
      line(5,  [text("  id         : "), ty("UserId")]),
      line(6,  [text("  name       : String")]),
      line(7,  [text("  created_at : "), ty("Timestamp")]),
      line(8,  [text("}")]),
      blank(9),
      line(10, [kw("service"), text(" Users    { list : () -> List<"), ref("User"), text("> }")]),
      line(11, [kw("table"),   text("   users    { schema_for "), ref("User"), text(" }")]),
      line(12, [kw("view"),    text("    UserCard { renders "), ref("User"), text(" }")]),
      blank(13),
      line(14, [kw("project"), text(" Users      -> "), ref("rust"),       text("       "), com("-- backend")]),
      line(15, [kw("project"), text(" users      -> "), ref("sql"),        text("        "), com("-- db schema")]),
      line(16, [kw("project"), text(" Users.list -> "), ref("openapi"),    text("    "), com("-- public API")]),
      line(17, [kw("project"), text(" UserCard   -> "), ref("typescript"), text(" "), com("-- frontend")])
    ],
    graph: {
      nodes: [
        node("User",            "User",          0, 1.5, "root"),
        artifact("rust",       ".rs",            1, 0),
        artifact("sql",        ".sql",           1, 1),
        artifact("openapi",    ".openapi.yaml",  1, 2),
        artifact("typescript", ".ts",            1, 3)
      ],
      edges: [
        edge("User", "rust",       "service",     "affected"),
        edge("User", "sql",        "table",       "affected"),
        edge("User", "openapi",    "operation",   "affected"),
        edge("User", "typescript", "view",        "affected")
      ]
    },
    receipt: [
      "one structural {root:description} · {affected:four target artifacts} · hand-written translations: {affected:zero}"
    ]
  };

  /* ── 02 · CHANGE: edit ripples across artifacts ─────────────── */
  const card02 = {
    id: "card-02",
    num: "02",
    name: "edit once · ripples across artifacts",
    codeFile: "examples/users.dag",
    code: [
      diffRm(1,  [kw("type"), text(" "), ref("Timestamp", "Timestamp", "changed"), text(" = UnixMillis")]),
      diffAdd(1, [kw("type"), text(" "), ref("Timestamp", "Timestamp", "changed"), text(" = IsoDateTime")]),
      blank(2),
      line(3,  [kw("type"), text(" "), ref("User"), text(" {")]),
      line(4,  [text("  id         : UserId")]),
      line(5,  [text("  name       : String")]),
      line(6,  [text("  created_at : "), ref("Timestamp")]),
      line(7,  [text("}")]),
      blank(8),
      line(9,  [kw("service"), text(" Users    { list : () -> List<"), ref("User"), text("> }")]),
      line(10, [kw("table"),   text("   users    { schema_for "), ref("User"), text(" }")]),
      line(11, [kw("view"),    text("    UserCard { renders "), ref("User"), text(" }")]),
      blank(12),
      line(13, [kw("project"), text(" Users      -> "), ref("rust")]),
      line(14, [kw("project"), text(" users      -> "), ref("sql")]),
      line(15, [kw("project"), text(" Users.list -> "), ref("openapi")]),
      line(16, [kw("project"), text(" UserCard   -> "), ref("typescript")])
    ],
    graph: {
      nodes: [
        node("Timestamp",       "Timestamp",     0, 1.5, "changed"),
        node("User",            "User",          1, 1.5, "affected"),
        artifact("rust",       ".rs",            2, 0),
        artifact("sql",        ".sql",           2, 1),
        artifact("openapi",    ".openapi.yaml",  2, 2),
        artifact("typescript", ".ts",            2, 3)
      ],
      edges: [
        edge("Timestamp", "User",       "L01 → L06", "changed"),
        edge("User",      "rust",       "L13",       "affected"),
        edge("User",      "sql",        "L14",       "affected"),
        edge("User",      "openapi",    "L15",       "affected"),
        edge("User",      "typescript", "L16",       "affected")
      ]
    },
    receipt: [
      "changed: {changed:L01 Timestamp} · direct: {affected:L06 User.created_at}",
      "transitive: {affected:L09 Users.list} · {affected:L10 users} · {affected:L11 UserCard}",
      "re-derived: {affected:L13 rust} · {affected:L14 sql} · {affected:L15 openapi} · {affected:L16 typescript}",
      "hand-edits: {affected:zero}"
    ]
  };

  /* ── 03 · CONSTRAINT: complexity bound · observed vs declared ── */
  const card03 = {
    id: "card-03",
    num: "03",
    name: "complexity bound · observed vs declared",
    codeFile: "examples/users.dag",
    code: [
      line(1,  [kw("fn"), text(" "), ref("uu", "unique_users"), text("(users: List<User>) -> List<User> {")]),
      line(2,  [text("  users |> "), ref("filt", "filter"), text("(fn(u) {")]),
      line(3,  [text("    "), ref("cnt", "count"), text("(users, fn(v) { v.id == u.id }) == 1")]),
      line(4,  [text("  })")]),
      line(5,  [text("}")]),
      blank(6),
      line(7,  [kw("lens"), text(" complexity("), ref("uu", "unique_users"), text(") <= O(n)")])
    ],
    graph: {
      nodes: [
        node("uu",   "unique_users", 0, 0, "affected"),
        node("filt", "filter(users)", 1, 1, "affected"),
        node("cnt",  "count(users)",  2, 2, "changed")
      ],
      edges: [
        edge("uu",   "filt", "× n",  "affected"),
        edge("filt", "cnt",  "× n",  "changed")
      ]
    },
    receipt: [
      "declared: {affected:unique_users <= O(n)}",
      "observed: filter × count = {changed:n × n = O(n²)}",
      "result: no artifact emitted"
    ]
  };

  const CARDS = [card01, card02, card03];

  /* ── Bootstrap ─────────────────────────────────────────────── */
  function init() {
    for (const spec of CARDS) {
      const slot = document.querySelector('[data-card="' + spec.id + '"]');
      if (slot) slot.outerHTML = renderCard(spec);
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
