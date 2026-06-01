/* ════════════════════════════════════════════════════════════════════
   gunb.ai · card renderer
   ────────────────────────────────────────────────────────────────────
   One shared system → many derived card views.

   The page demonstrates the compiler's own discipline:
   single source of truth, multiple views, no hidden authority.

   USERS_SYSTEM is the canonical facts / relations / artifacts table.
   Card builders read from it and render code + graph + receipt that
   never contradict each other. Validators throw on:

     - dangling code refs
     - role mismatch between a code ref and its graph node
     - active graph nodes that have no code anchor
     - line-number shorthand (L##) in graphs or receipts
     - cards from different system ids without standalone: true

   No build step. Plain script tag, IIFE, vanilla DOM.
   ══════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  /* ── Role → CSS class ───────────────────────────────────────
     One color per structural meaning. See DESIGN.md materials. */
  const Roles = {
    stable:     "map-stable",      // ordinary structure (warm-white)
    focus:      "map-focus",       // human edit site / subject (brass)
    derived:    "map-derived",     // 1-2 hops downstream (moss)
    transitive: "map-transitive",  // multi-hop downstream (moss-dim)
    artifact:   "map-artifact",    // terminal generated slot (warm-white)
    removed:    "map-removed",     // diff removal (clay)
    boundary:   "map-boundary",    // violation / no artifact (clay)
    context:    "map-context"      // ambient (stone)
  };
  const roleClass = r => Roles[r] || Roles.context;

  /* ── Code spec helpers ─────────────────────────────────────── */
  const tx  = v => ({ kind: "text", value: v });
  const kw  = v => ({ kind: "kw",   value: v });
  const ty  = v => ({ kind: "ty",   value: v });
  const com = v => ({ kind: "com",  value: v });
  const ref = (id, text, role) => ({ kind: "ref", id, text: text || id, role: role || null });
  // Inline colored span without a graph anchor — for marking a piece
  // of code semantically (e.g. a violated bound) where the text is not
  // itself a named entity in the system.
  const mark = (text, role) => ({ kind: "mark", text, role });
  const ln       = (n, parts) => ({ n, parts });
  const blank    = (n)        => ({ n, parts: [] });
  const diffRm   = (n, parts) => ({ n, parts, diff: "rm" });
  const diffAdd  = (n, parts) => ({ n, parts, diff: "add" });

  /* ── Graph spec helpers ────────────────────────────────────── */
  const node = (id, label, col, row, role) =>
    ({ kind: "node", id, label, col, row, role: role || "context" });
  const artifact = (id, label, col, row) =>
    ({ kind: "artifact", id, label, col, row, role: "artifact", generated: true });
  const edge = (from, to, label, role) =>
    ({ from, to, label: label || "", role: role || "derived" });

  /* ── Layout ────────────────────────────────────────────────── */
  const COL_GAP_MIN   = 56;
  const Y_GAP         = 46;
  const BASE_X        = 18;
  const BASE_Y        = 22;
  const NODE_H        = 28;
  const PAD           = 18;
  const ELBOW_OFFSET  = 18;
  const LABEL_FONT_PX = 5;     // ~ 7px mono char width
  const LABEL_PAD     = 8;

  function labelWidth(label) {
    return Math.max(60, label.length * 7.2 + 22);
  }
  function edgeLabelWidth(label) {
    return label ? label.length * LABEL_FONT_PX + 4 : 0;
  }
  function columnXs(nodes, edges) {
    const widest = {};
    for (const n of nodes) {
      const w = labelWidth(n.label);
      if (!(n.col in widest) || w > widest[n.col]) widest[n.col] = w;
    }
    const byId = {};
    for (const n of nodes) byId[n.id] = n;
    const gapDemand = {};
    for (const e of edges) {
      if (!e.label) continue;
      const a = byId[e.from];
      const b = byId[e.to];
      if (!a || !b || a.col === b.col) continue;
      const startCol = Math.min(a.col, b.col);
      const need = ELBOW_OFFSET + edgeLabelWidth(e.label) + LABEL_PAD * 2;
      if (!(startCol in gapDemand) || need > gapDemand[startCol]) {
        gapDemand[startCol] = need;
      }
    }
    const cols = Object.keys(widest).map(Number).sort((a, b) => a - b);
    const x = {};
    let cx = BASE_X;
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      x[c] = cx;
      const gap = Math.max(COL_GAP_MIN, gapDemand[c] || 0);
      cx += widest[c] + gap;
    }
    return x;
  }
  function layoutNodes(nodes, edges) {
    const x = columnXs(nodes, edges);
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
  function edgeGeom(a, b) {
    const sx = a.x + a.w;
    const sy = a.y + a.h / 2;
    const tx = b.x;
    const ty = b.y + b.h / 2;
    const sameRow = Math.abs(sy - ty) < 1;
    const baseMid = sx + ELBOW_OFFSET;
    const mid = Math.min(baseMid, tx - 8);
    return { sx, sy, tx, ty, mid, sameRow };
  }
  function edgePath(a, b) {
    const g = edgeGeom(a, b);
    if (g.sameRow) return "M " + g.sx + " " + g.sy + " L " + g.tx + " " + g.ty;
    return "M " + g.sx + " " + g.sy + " H " + g.mid + " V " + g.ty + " H " + g.tx;
  }

  /* ── Escape ────────────────────────────────────────────────── */
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ════════════════════════════════════════════════════════════════
     VALIDATORS — fail-closed on any structural contradiction.
     ══════════════════════════════════════════════════════════════ */

  const LINE_NUM_RE = /\bL\d+\b/;

  function validateRefsAnchored(card) {
    const ids = new Set(card.graph.nodes.map(n => n.id));
    for (const line of card.code) {
      for (const p of line.parts) {
        if (p.kind === "ref" && !ids.has(p.id)) {
          throw new Error(card.id + ": code ref '" + p.id + "' has no graph node");
        }
      }
    }
    for (const e of card.graph.edges) {
      if (!ids.has(e.from)) throw new Error(card.id + ": edge from '" + e.from + "' missing");
      if (!ids.has(e.to))   throw new Error(card.id + ": edge to '"   + e.to   + "' missing");
    }
  }

  function validateRoleConsistency(card) {
    const byId = {};
    for (const n of card.graph.nodes) byId[n.id] = n;
    for (const line of card.code) {
      for (const p of line.parts) {
        if (p.kind !== "ref" || !p.role) continue;
        const g = byId[p.id];
        if (g && g.role && p.role !== g.role) {
          throw new Error(card.id + ": role mismatch for '" + p.id +
                          "': code=" + p.role + ", graph=" + g.role);
        }
      }
    }
  }

  function validateNoUnanchoredActiveNodes(card) {
    const codeRefs = new Set();
    for (const line of card.code) {
      for (const p of line.parts) if (p.kind === "ref") codeRefs.add(p.id);
    }
    for (const n of card.graph.nodes) {
      if (n.generated || n.role === "context") continue;
      if (!codeRefs.has(n.id)) {
        throw new Error(card.id + ": active graph node '" + n.id + "' has no code anchor");
      }
    }
  }

  function validateNoLineNumbersInGraph(card) {
    for (const n of card.graph.nodes) {
      if (LINE_NUM_RE.test(n.label)) {
        throw new Error(card.id + ": graph label '" + n.label + "' uses line-number semantics");
      }
    }
    for (const e of card.graph.edges) {
      if (e.label && LINE_NUM_RE.test(e.label)) {
        throw new Error(card.id + ": edge label '" + e.label + "' uses line-number semantics");
      }
    }
  }

  function validateReceiptNoLineNumbers(card) {
    for (const r of card.receipt) {
      if (LINE_NUM_RE.test(r)) {
        throw new Error(card.id + ": receipt uses line-number shorthand: '" + r + "'");
      }
    }
  }

  function validateCard(card) {
    validateRefsAnchored(card);
    validateRoleConsistency(card);
    validateNoUnanchoredActiveNodes(card);
    validateNoLineNumbersInGraph(card);
    validateReceiptNoLineNumbers(card);
  }

  function validateContinuity(cards) {
    if (cards.length === 0) return;
    const base = cards[0].systemId;
    for (const c of cards) {
      if (c.systemId !== base && !c.standalone) {
        throw new Error(c.id + ": breaks continuity; expected systemId='" + base +
                        "', got '" + c.systemId + "'");
      }
    }
  }

  /* ════════════════════════════════════════════════════════════════
     CODE RENDERER
     ══════════════════════════════════════════════════════════════ */

  function partHtml(p, refRole) {
    if (p.kind === "text") return esc(p.value);
    if (p.kind === "kw")   return '<span class="ck-kw">'  + esc(p.value) + '</span>';
    if (p.kind === "ty")   return '<span class="ck-ty">'  + esc(p.value) + '</span>';
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
  function renderCode(card) {
    const roleById = {};
    for (const n of card.graph.nodes) roleById[n.id] = n.role;
    const refRole = id => roleById[id];
    const head = '<div class="card-code-head">'
               + '<span class="ck-dot">●</span> '
               + '<span class="ck-file">' + esc(card.codeFile || (card.id + ".dag")) + '</span>'
               + '</div>';
    const body = '<div class="card-code-body">'
               + card.code.map(l => lineHtml(l, refRole)).join("")
               + '</div>';
    return '<div class="card-code">' + head + body + '</div>';
  }

  /* ════════════════════════════════════════════════════════════════
     GRAPH RENDERERS
     ══════════════════════════════════════════════════════════════ */

  function renderRelationGraph(card) {
    const nodes = layoutNodes(card.graph.nodes, card.graph.edges);
    const byId  = {};
    for (const n of nodes) byId[n.id] = n;
    const bounds = graphBounds(nodes);

    const edgesSvg = card.graph.edges.map(e => {
      const a = byId[e.from];
      const b = byId[e.to];
      const cls = roleClass(e.role);
      return '<path class="graph-edge ' + cls + '" d="' + edgePath(a, b)
           + '" marker-end="url(#card-arrow)" />';
    }).join("");

    const edgeLabels = card.graph.edges.filter(e => e.label).map(e => {
      const a = byId[e.from];
      const b = byId[e.to];
      const g = edgeGeom(a, b);
      const lx = g.sameRow ? (g.sx + g.tx) / 2 : (g.mid + g.tx) / 2;
      const ly = (g.sameRow ? g.sy : g.ty) - 4;
      const cls = roleClass(e.role);
      return '<text class="graph-edge-label ' + cls + '" x="' + lx
           + '" y="' + ly + '" text-anchor="middle">' + esc(e.label) + '</text>';
    }).join("");

    const nodesSvg = nodes.map(n => {
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
             + '<text x="' + (n.x + n.w / 2) + '" y="' + (n.y + n.h / 2 + 4)
             + '" text-anchor="middle">' + esc(n.label) + '</text></g>';
      }
      return '<g class="graph-node ' + cls + '">'
           + '<rect x="' + n.x + '" y="' + n.y + '" width="' + n.w
           + '" height="' + n.h + '" rx="4" />'
           + '<text x="' + (n.x + n.w / 2) + '" y="' + (n.y + n.h / 2 + 4)
           + '" text-anchor="middle">' + esc(n.label) + '</text></g>';
    }).join("");

    const defs = '<defs>'
               + '<marker id="card-arrow" viewBox="0 0 10 10" refX="9" refY="5"'
               + ' markerWidth="6" markerHeight="6" orient="auto">'
               + '<path d="M0,0 L10,5 L0,10 Z" fill="context-stroke"/>'
               + '</marker></defs>';

    return '<div class="card-graph">'
         + '<svg viewBox="0 0 ' + bounds.width + ' ' + bounds.height
         + '" preserveAspectRatio="xMidYMid meet" aria-label="' + esc(card.name || "") + '">'
         + defs + edgesSvg + edgeLabels + nodesSvg
         + '</svg></div>';
  }

  /* Cost-area: two grids contrasted side-by-side. The aspect ratio of
     the rendered grids IS the cost argument — a 1×n strip vs an n×n
     square is more legible than any curve or annotation. */
  function renderCostArea(card) {
    const CELL = 9;
    const GAP  = 2;
    const PANEL_GAP = 36;
    const LABEL_H   = 18;
    function gridDims(p) {
      return {
        w: p.cols * CELL + (p.cols - 1) * GAP,
        h: p.rows * CELL + (p.rows - 1) * GAP
      };
    }
    const panels = card.panels.map(p => Object.assign({}, p, gridDims(p)));
    // Layout: each panel left-to-right; vertically center on the tallest.
    const totalW = panels.reduce((s, p) => s + p.w, 0) + (panels.length - 1) * PANEL_GAP;
    const maxH   = Math.max.apply(null, panels.map(p => p.h));
    const W = totalW + PAD * 2;
    const H = LABEL_H + maxH + PAD * 2;

    let cx = PAD;
    const panelsSvg = panels.map(p => {
      const px = cx;
      const py = PAD + LABEL_H + (maxH - p.h) / 2;
      cx += p.w + PANEL_GAP;
      let cells = "";
      for (let r = 0; r < p.rows; r++) {
        for (let c = 0; c < p.cols; c++) {
          const x = px + c * (CELL + GAP);
          const y = py + r * (CELL + GAP);
          cells += '<rect x="' + x + '" y="' + y + '" width="' + CELL + '" height="' + CELL + '" />';
        }
      }
      const labelX = px + p.w / 2;
      const labelY = PAD + LABEL_H - 6;
      const cls = roleClass(p.role);
      return '<g class="cost-area ' + cls + '">'
           + cells
           + '<text class="cost-area-label" x="' + labelX + '" y="' + labelY
           + '" text-anchor="middle">' + esc(p.label) + '</text></g>';
    }).join("");

    return '<div class="card-graph">'
         + '<svg viewBox="0 0 ' + W + ' ' + H
         + '" preserveAspectRatio="xMidYMid meet" aria-label="' + esc(card.name || "") + '">'
         + panelsSvg
         + '</svg></div>';
  }

  function renderGraph(card) {
    if (card.shape === "cost-area") return renderCostArea(card);
    return renderRelationGraph(card);
  }

  /* ════════════════════════════════════════════════════════════════
     RECEIPT RENDERER
     ══════════════════════════════════════════════════════════════ */

  function receiptHtml(line) {
    return line.replace(/\{(\w+):([^}]*)\}/g, function (_, role, t) {
      return '<span class="' + roleClass(role) + '">' + esc(t) + '</span>';
    });
  }
  function renderReceipt(card) {
    return '<div class="card-receipt">'
         + card.receipt.map(r => '<div class="card-receipt-line">' + receiptHtml(r) + '</div>').join("")
         + '</div>';
  }

  /* ════════════════════════════════════════════════════════════════
     CARD RENDERER
     ══════════════════════════════════════════════════════════════ */

  function renderCard(spec) {
    validateCard(spec);
    return '<article class="card" data-card-id="' + esc(spec.id) + '" data-system="' + esc(spec.systemId || "") + '">'
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
     USERS_SYSTEM — the shared source model.
     Every card is a view of this. Continuity is verifiable by
     systemId equality; semantic continuity comes from cards reading
     the same facts/relations/artifacts.
     ══════════════════════════════════════════════════════════════ */

  const USERS_SYSTEM = {
    id: "users-system",
    facts: {
      Timestamp:     { kind: "type-alias" },
      UserId:        { kind: "type-alias" },
      User:          { kind: "record" },
      UserView:      { kind: "record" },
      format_joined: { kind: "fn" },
      public_user:   { kind: "fn" },
      unique_users:  { kind: "fn" },
      Users:         { kind: "service",   label: "service Users" },
      UsersList:     { kind: "operation", label: "Users.list" },
      users:         { kind: "table",     label: "table users" },
      UserCard:      { kind: "view",      label: "view UserCard" }
    },
    artifacts: {
      rust:       { label: ".rs",           from: "Users" },
      sql:        { label: ".sql",          from: "users" },
      openapi:    { label: ".openapi.yaml", from: "UsersList" },
      typescript: { label: ".ts",           from: "UserCard" }
    }
  };

  /* ════════════════════════════════════════════════════════════════
     CARD 01 · projection closure — one system, four target artifacts
     ══════════════════════════════════════════════════════════════ */

  function projectionClosureCard(system) {
    return {
      id: "card-01",
      num: "01",
      name: "one system · four target artifacts",
      systemId: system.id,
      codeFile: "examples/users.dag",
      code: [
        ln(1,  [kw("type"), tx(" "), ref("User", "User", "stable"), tx(" {")]),
        ln(2,  [tx("  id         : UserId")]),
        ln(3,  [tx("  name       : String")]),
        ln(4,  [tx("  created_at : Timestamp")]),
        ln(5,  [tx("}")]),
        blank(6),
        ln(7,  [kw("type"), tx(" "), ref("UserView", "UserView", "derived"), tx(" { … }")]),
        ln(8,  [kw("fn"),   tx(" "), ref("public_user"), tx("(u: "), ref("User"), tx(") -> "), ref("UserView"), tx(" { … }")]),
        blank(9),
        ln(10, [kw("service"), tx(" "), ref("Users", "Users", "derived"), tx(" { list : () -> List<"), ref("UserView"), tx("> }")]),
        ln(11, [kw("table"),   tx("   "), ref("users", "users", "derived"), tx(" { schema_for "), ref("User"), tx(" }")]),
        ln(12, [kw("view"),    tx("    "), ref("UserCard", "UserCard", "derived"), tx(" { renders "), ref("UserView"), tx(" }")]),
        blank(13),
        ln(14, [kw("project"), tx(" "), ref("Users"),                   tx("      -> "), ref("rust"),       tx("      "), com("-- backend")]),
        ln(15, [kw("project"), tx(" "), ref("users"),                   tx("      -> "), ref("sql"),        tx("       "), com("-- database")]),
        ln(16, [kw("project"), tx(" "), ref("UsersList", "Users.list"), tx(" -> "), ref("openapi"),    tx("   "), com("-- public API")]),
        ln(17, [kw("project"), tx(" "), ref("UserCard"),                tx("   -> "), ref("typescript"), tx(" "), com("-- frontend")])
      ],
      graph: {
        nodes: [
          node("User",        "User",          0, 1.5, "stable"),
          node("public_user", "public_user",   1, 0.5, "derived"),
          node("users",       "table users",   1, 2.5, "derived"),
          node("UserView",    "UserView",      2, 0.5, "derived"),
          node("Users",       "service Users", 3, 0,   "derived"),
          node("UsersList",   "Users.list",    3, 1,   "derived"),
          node("UserCard",    "view UserCard", 3, 2,   "derived"),
          artifact("rust",       ".rs",           4, 0),
          artifact("openapi",    ".openapi.yaml", 4, 1),
          artifact("typescript", ".ts",           4, 2),
          artifact("sql",        ".sql",          2, 2.5)
        ],
        edges: [
          edge("User",        "public_user",  "param"),
          edge("User",        "users",        "schema_for"),
          edge("public_user", "UserView",     "returns"),
          edge("UserView",    "Users",        "list →"),
          edge("UserView",    "UsersList",    "returns"),
          edge("UserView",    "UserCard",     "renders"),
          edge("Users",       "rust",         ""),
          edge("UsersList",   "openapi",      ""),
          edge("UserCard",    "typescript",   ""),
          edge("users",       "sql",          "")
        ]
      },
      receipt: [
        "one structural {stable:description} · {derived:four target artifacts} · hand-written translations: {derived:zero}"
      ]
    };
  }

  /* ════════════════════════════════════════════════════════════════
     CARD 02 · affected set — edit Timestamp; named transitive chain
     ══════════════════════════════════════════════════════════════ */

  function affectedSetCard(system) {
    return {
      id: "card-02",
      num: "02",
      name: "edit once · transitive chain to four artifacts",
      systemId: system.id,
      codeFile: "examples/users.dag",
      code: [
        diffRm(1,  [kw("type"), tx(" "), ref("Timestamp", "Timestamp", "focus"), tx(" = UnixMillis")]),
        diffAdd(1, [kw("type"), tx(" "), ref("Timestamp", "Timestamp", "focus"), tx(" = IsoDateTime")]),
        blank(2),
        ln(3,  [kw("type"), tx(" "), ref("User"), tx(" { created_at : "), ref("Timestamp"), tx(" }")]),
        blank(4),
        ln(5,  [kw("fn"), tx(" format_joined(t: "), ref("Timestamp"), tx(") -> String")]),
        ln(6,  [kw("fn"), tx(" "), ref("public_user"),   tx("(u: "), ref("User"), tx(") -> UserView {")]),
        ln(7,  [tx("  joined: format_joined(u.created_at)")]),
        ln(8,  [tx("}")]),
        blank(9),
        ln(10, [kw("service"), tx(" "), ref("Users"),    tx(" { list : List<UserView> }")]),
        ln(11, [kw("table"),   tx("   "), ref("users"),  tx(" { schema_for "), ref("User"), tx(" }")]),
        ln(12, [kw("view"),    tx("    "), ref("UserCard"), tx(" { renders UserView }")]),
        blank(13),
        ln(14, [kw("project"), tx(" "), ref("Users"),                   tx("      -> "), ref("rust")]),
        ln(15, [kw("project"), tx(" "), ref("users"),                   tx("      -> "), ref("sql")]),
        ln(16, [kw("project"), tx(" "), ref("UsersList", "Users.list"), tx(" -> "), ref("openapi")]),
        ln(17, [kw("project"), tx(" "), ref("UserCard"),                tx("   -> "), ref("typescript")])
      ],
      graph: {
        nodes: [
          node("Timestamp",   "Timestamp",     0, 1.5, "focus"),
          node("User",        "User",          1, 1.5, "derived"),
          node("public_user", "public_user",   2, 1,   "derived"),
          node("users",       "table users",   2, 2.5, "derived"),
          node("Users",       "service Users", 3, 0,   "derived"),
          node("UsersList",   "Users.list",    3, 1,   "derived"),
          node("UserCard",    "view UserCard", 3, 2,   "derived"),
          artifact("sql",        ".sql",          3, 3),
          artifact("rust",       ".rs",           4, 0),
          artifact("openapi",    ".openapi.yaml", 4, 1),
          artifact("typescript", ".ts",           4, 2)
        ],
        edges: [
          edge("Timestamp",   "User",        "created_at",      "focus"),
          edge("User",        "public_user", "param"),
          edge("User",        "users",       "schema_for"),
          edge("public_user", "Users",       "via UserView"),
          edge("public_user", "UsersList",   "via UserView"),
          edge("public_user", "UserCard",    "via UserView"),
          edge("users",       "sql",         ""),
          edge("Users",       "rust",        ""),
          edge("UsersList",   "openapi",     ""),
          edge("UserCard",    "typescript",  "")
        ]
      },
      receipt: [
        "changed: {focus:Timestamp representation}",
        "direct: {derived:User.created_at}",
        "transitive: {derived:public_user} · {derived:Users.list} · {derived:table users} · {derived:UserCard}",
        "re-derived: {derived:Rust response} · {derived:SQL column} · {derived:OpenAPI schema} · {derived:TypeScript props}",
        "hand-edits: {derived:zero}"
      ]
    };
  }

  /* ════════════════════════════════════════════════════════════════
     CARD 03 · complexity violation — cost area, declared vs observed
     ══════════════════════════════════════════════════════════════ */

  function complexityViolationCard(system) {
    return {
      id: "card-03",
      num: "03",
      name: "complexity bound · O(n) declared, O(n²) observed",
      systemId: system.id,
      codeFile: "examples/users.dag",
      shape: "cost-area",
      code: [
        ln(1, [kw("fn"), tx(" "), ref("unique_users", "unique_users", "focus"),
               tx("(users: List<"), ref("User", "User", "context"), tx(">) -> List<"),
               ref("User", "User", "context"), tx("> {")]),
        ln(2, [tx("  users |> "), ref("filter_call", "filter", "derived"), tx("(fn(u) {")]),
        ln(3, [tx("    "), ref("count_call", "count", "boundary"),
               tx("(users, fn(v) { v.id == u.id }) == 1")]),
        ln(4, [tx("  })")]),
        ln(5, [tx("}")]),
        blank(6),
        ln(7, [kw("lens"), tx(" complexity("), ref("unique_users", "unique_users", "focus"),
               tx(") <= O(n)")])
      ],
      panels: [
        { id: "declared", label: "declared: O(n)",  cols: 6, rows: 1, role: "derived" },
        { id: "observed", label: "observed: O(n²)", cols: 6, rows: 6, role: "boundary" }
      ],
      // graph is present for validator anchoring of code refs;
      // the cost-area renderer doesn't draw it.
      graph: {
        nodes: [
          node("unique_users", "unique_users", 0, 0, "focus"),
          node("filter_call",  "filter",       0, 0, "derived"),
          node("count_call",   "count",        0, 0, "boundary"),
          node("User",         "User",         0, 0, "context")
        ],
        edges: []
      },
      receipt: [
        "declared: {derived:unique_users ≤ O(n)}",
        "observed: {boundary:filter(users) × count(users) = O(n²)}",
        "result: {boundary:no artifact emitted}"
      ]
    };
  }

  /* ════════════════════════════════════════════════════════════════
     BOOTSTRAP
     ══════════════════════════════════════════════════════════════ */

  const CARDS = [
    projectionClosureCard(USERS_SYSTEM),
    affectedSetCard(USERS_SYSTEM),
    complexityViolationCard(USERS_SYSTEM)
  ];
  validateContinuity(CARDS);

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
