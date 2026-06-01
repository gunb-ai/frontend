/* ════════════════════════════════════════════════════════════════════
   gunb.ai · story-deck renderer
   ────────────────────────────────────────────────────────────────────
   One Users system. Three isolated views. Same underlying source
   model; each card renders only the slice it argues from.

     01  projection closure       — one system, four target artifacts
     02  affected-set propagation — Timestamp edit ripples through
     03  complexity budget        — O(n) declared, O(n²) observed,
                                    suggested replacement shape

   Each card is independent visually (no accreting layers). Card 03
   absorbs the diagnostic — the suggested fix is just another row of
   its receipt, not a separate panel.

   HTML owns text. SVG owns structure (and small node labels for
   identifiability). Cards are validated for ref→graph correspondence,
   role consistency, no line-number semantics, and shared systemId.

   Navigation: prev/next buttons or ← / → keys.
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
    skipped:    "map-skipped"
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
  const node = (id, label, col, row, role) =>
    ({ kind: "node", id, label, col, row, role: role || "context" });
  const artifact = (id, label, col, row) =>
    ({ kind: "artifact", id, label, col, row, role: "artifact", generated: true });
  const edge = (from, to, label, role) =>
    ({ from, to, label: label || "", role: role || "derived" });

  /* ── Layout (column grid with demand-driven gaps) ──────────── */
  const COL_GAP_MIN   = 56;
  const Y_GAP         = 46;
  const BASE_X        = 18;
  const BASE_Y        = 22;
  const NODE_H        = 28;
  const PAD           = 18;
  const ELBOW_OFFSET  = 18;
  const LABEL_FONT_PX = 5;
  const LABEL_PAD     = 8;

  function labelWidth(label) { return Math.max(60, label.length * 7.2 + 22); }
  function edgeLabelWidth(label) { return label ? label.length * LABEL_FONT_PX + 4 : 0; }
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
      if (!(startCol in gapDemand) || need > gapDemand[startCol]) gapDemand[startCol] = need;
    }
    const cols = Object.keys(widest).map(Number).sort((a, b) => a - b);
    const x = {};
    let cx = BASE_X;
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      x[c] = cx;
      cx += widest[c] + Math.max(COL_GAP_MIN, gapDemand[c] || 0);
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
     VALIDATORS — fail-closed
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
      if (LINE_NUM_RE.test(n.label)) throw new Error(card.id + ": graph label '" + n.label + "' uses L## semantics");
    }
    for (const e of card.graph.edges) {
      if (e.label && LINE_NUM_RE.test(e.label)) throw new Error(card.id + ": edge label '" + e.label + "' uses L## semantics");
    }
  }
  function validateReceiptNoLineNumbers(card) {
    for (const row of card.receipt) {
      const txt = typeof row === "string" ? row : (row.value || "") + (row.code ? (Array.isArray(row.code) ? row.code.join(" ") : row.code) : "");
      if (LINE_NUM_RE.test(txt)) throw new Error(card.id + ": receipt uses L## shorthand");
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
    if (!cards.length) return;
    const base = cards[0].systemId;
    for (const c of cards) {
      if (c.systemId !== base && !c.standalone) {
        throw new Error(c.id + ": breaks continuity; expected systemId='" + base + "'");
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
     GRAPH RENDERERS — relation graph (cards 01, 02) and cost-area (03)
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

  // Cost-area: two panels bottom-aligned. Each cell is colored per-row:
  // the bottom `budgetRows` rows (counting up from the bottom) are
  // budget (moss/green); rows above are overage (clay/red). For the
  // declared panel, the whole panel is budget (1 row). For observed,
  // the bottom row is budget and the rest is overage — the visual
  // claim "observed extends UP past the budget ceiling."
  function renderCostArea(card) {
    const CELL = 11;
    const GAP  = 2;
    const PANEL_GAP = 56;
    const LABEL_H   = 26;   // room for label + sublabel below each panel
    const PAD       = 14;
    function gridDims(p) {
      return {
        w: p.cols * CELL + (p.cols - 1) * GAP,
        h: p.rows * CELL + (p.rows - 1) * GAP
      };
    }
    const panels = card.panels.map(p => Object.assign({}, p, gridDims(p)));
    const totalW = panels.reduce((s, p) => s + p.w, 0) + (panels.length - 1) * PANEL_GAP;
    const maxH   = Math.max.apply(null, panels.map(p => p.h));
    const W = totalW + PAD * 2;
    const H = maxH + LABEL_H + PAD * 2;

    const bottomY = PAD + maxH;   // shared bottom edge of all panel grids

    let cx = PAD;
    const panelsSvg = panels.map(p => {
      const px = cx;
      const py = bottomY - p.h;   // bottom-align
      cx += p.w + PANEL_GAP;

      let cells = "";
      const budgetRows = p.budgetRows || 0;
      for (let r = 0; r < p.rows; r++) {
        const fromBottom = p.rows - 1 - r;
        const cellRole = fromBottom < budgetRows ? "budget" : "overage";
        for (let c = 0; c < p.cols; c++) {
          const x = px + c * (CELL + GAP);
          const y = py + r * (CELL + GAP);
          cells += '<rect class="cost-cell-' + cellRole + '" x="' + x
                 + '" y="' + y + '" width="' + CELL + '" height="' + CELL + '" />';
        }
      }

      const labelX = px + p.w / 2;
      const labelY    = bottomY + 12;
      const sublabelY = bottomY + 22;
      return '<g class="cost-area">'
           + cells
           + '<text class="cost-area-label" x="' + labelX + '" y="' + labelY
           + '" text-anchor="middle">' + esc(p.label) + '</text>'
           + (p.sublabel
             ? '<text class="cost-area-sublabel" x="' + labelX + '" y="' + sublabelY
                + '" text-anchor="middle">' + esc(p.sublabel) + '</text>'
             : '')
           + '</g>';
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
     RECEIPT — structured array of {label, value} or {label, code}
     ══════════════════════════════════════════════════════════════ */

  function receiptValueHtml(text) {
    return String(text).replace(/\{(\w+):([^}]*)\}/g, function (_, role, t) {
      return '<span class="' + roleClass(role) + '">' + esc(t) + '</span>';
    });
  }
  function renderReceiptRow(row) {
    if (typeof row === "string") {
      // free-form line (fallback)
      return '<div class="card-receipt-row"><div class="rv">' + receiptValueHtml(row) + '</div></div>';
    }
    let html = '<div class="card-receipt-row">';
    html += '<div class="rk">' + esc(row.label) + '</div>';
    if (row.code) {
      const code = Array.isArray(row.code) ? row.code.join("\n") : row.code;
      html += '<pre class="card-receipt-code">' + esc(code) + '</pre>';
    } else {
      html += '<div class="rv">' + receiptValueHtml(row.value || "") + '</div>';
    }
    html += '</div>';
    return html;
  }
  function renderReceipt(card) {
    if (!card.receipt || !card.receipt.length) return "";
    return '<div class="card-receipt">'
         + card.receipt.map(renderReceiptRow).join("")
         + '</div>';
  }

  /* ════════════════════════════════════════════════════════════════
     CARD + DECK RENDERERS
     ══════════════════════════════════════════════════════════════ */

  function renderCard(card) {
    validateCard(card);
    return '<article class="deck-card" data-card-id="' + esc(card.id) + '">'
         + '<div class="deck-card-head">'
         + '<span class="deck-card-num">'  + esc(card.num)  + '</span>'
         + '<span class="deck-card-name">' + esc(card.name) + '</span>'
         + '</div>'
         + '<div class="deck-card-body">'
         + renderCode(card)
         + renderGraph(card)
         + '</div>'
         + renderReceipt(card)
         + '</article>';
  }

  function renderDeck(deck) {
    validateContinuity(deck.cards);
    const ticks = deck.cards.map(() => '<span class="deck-tick"></span>').join("");
    return '<section class="deck" tabindex="0" aria-label="' + esc(deck.name || "") + '">'
         + '<div class="deck-head">'
         + '<span class="deck-name">' + esc(deck.name || "") + '</span>'
         + '<div class="deck-ticks">' + ticks + '</div>'
         + '<span class="deck-pos">'
         + '<span class="deck-current">01</span> / '
         + '<span class="deck-total">' + String(deck.cards.length).padStart(2, "0") + '</span>'
         + '</span></div>'
         + '<div class="deck-stage"><div class="card-track">'
         + deck.cards.map(renderCard).join("")
         + '</div></div>'
         + '<div class="deck-nav">'
         + '<button class="deck-btn" type="button" data-dir="prev">← prev</button>'
         + '<span style="flex:1"></span>'
         + '<button class="deck-btn" type="button" data-dir="next">next →</button>'
         + '</div></section>';
  }

  /* ── Navigation ────────────────────────────────────────────── */
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
     USERS_SYSTEM — the shared source model. All cards derive from this.
     ══════════════════════════════════════════════════════════════ */

  const USERS_SYSTEM = {
    id: "users-system",
    // One service with three operations, each using a different
    // field of User. This is the "single tree" structure the
    // operator asked for: the three coloring categories (direct,
    // transitive, unrelated) are siblings under the same root.
    artifacts: {
      profile_rs: { label: "profile.rs", from: "UsersProfile" },
      email_rs:   { label: "email.rs",   from: "UsersEmail"   },
      token_rs:   { label: "token.rs",   from: "UsersToken"   }
    }
  };

  /* ── Shared base layout for cards 01 and 02.
        baseLayoutNodes/Edges describe User + containers + artifacts.
        Card 01 uses this directly. Card 02 calls withTimestamp() to
        prepend Timestamp + the Timestamp → User edge at a leftward
        column, leaving the User+downstream layout structurally
        identical between the two cards. */
  // Base graph for cards 01/02 — one User-rooted tree with three
  // branches. Each branch is a service operation using a different
  // field of User:
  //
  //   Users.profile  uses User.created_at (via format_joined)
  //   Users.email    uses User.email
  //   Users.token    uses User.id
  //
  // When Timestamp changes (card 02): profile branch is affected
  // (transitive), email and token branches are unrelated (grey).
  // Three coloring categories under one roof.
  function baseLayoutNodes(system) {
    return [
      node("User",         "User",          0, 1),
      node("UsersProfile", "Users.profile", 1, 0),
      node("UsersEmail",   "Users.email",   1, 1),
      node("UsersToken",   "Users.token",   1, 2),
      artifact("profile_rs", system.artifacts.profile_rs.label, 2, 0),
      artifact("email_rs",   system.artifacts.email_rs.label,   2, 1),
      artifact("token_rs",   system.artifacts.token_rs.label,   2, 2)
    ];
  }
  function baseLayoutEdges() {
    return [
      edge("User", "UsersProfile", "created_at"),
      edge("User", "UsersEmail",   "email"),
      edge("User", "UsersToken",   "id"),
      edge("UsersProfile", "profile_rs", ""),
      edge("UsersEmail",   "email_rs",   ""),
      edge("UsersToken",   "token_rs",   "")
    ];
  }
  // Card 02 prepends Timestamp by shifting the base layout one column
  // right and inserting Timestamp at col 0 with a single edge to User.
  // Session does NOT get a Timestamp edge — that's the structural point
  // of card 02: the affected set tracks the edit through created_at
  // but doesn't follow into the parallel Sessions domain.
  function withTimestamp(baseNodes, baseEdges) {
    const shiftedNodes = baseNodes.map(n =>
      Object.assign({}, n, { col: n.col + 1 })
    );
    return {
      nodes: [
        node("Timestamp", "Timestamp", 0, 1),
        ...shiftedNodes
      ],
      edges: [
        edge("Timestamp", "User", "created_at"),
        ...baseEdges
      ]
    };
  }
  function applyNodeRoles(nodes, roleMap) {
    return nodes.map(n => {
      if (n.kind === "artifact") return n;
      return Object.assign({}, n, { role: roleMap[n.id] || n.role || "context" });
    });
  }
  function applyEdgeRoles(edges, roleMap, defaultRole) {
    return edges.map(e => {
      const key = e.from + "→" + e.to;
      return Object.assign({}, e, { role: roleMap[key] || defaultRole || "derived" });
    });
  }

  /* ════════════════════════════════════════════════════════════════
     CARD 01 · projection closure
     ══════════════════════════════════════════════════════════════ */

  function projectionClosureCard(system) {
    return {
      id: "card-01",
      num: "01",
      name: "one description · three operations · three artifacts",
      systemId: system.id,
      codeFile: "examples/users.dag",
      code: [
        ln(1,  [kw("type"), tx(" "), ref("User", "User", "stable"),
                tx(" { id, email, name, created_at : "),
                mark("Timestamp", "stable"), tx(" }")]),
        blank(2),
        ln(3,  [kw("fn"), tx(" format_joined(t: "), mark("Timestamp", "stable"), tx(") -> String")]),
        blank(4),
        ln(5,  [kw("service"), tx(" Users {")]),
        ln(6,  [tx("  "), ref("UsersProfile", "profile", "derived"),
                tx("(id) -> Profile   "), com("-- created_at via format_joined")]),
        ln(7,  [tx("  "), ref("UsersEmail",   "email",   "derived"),
                tx("(id)   -> Email     "), com("-- u.email")]),
        ln(8,  [tx("  "), ref("UsersToken",   "token",   "derived"),
                tx("(id)   -> AuthToken "), com("-- hash(u.id)")]),
        ln(9,  [tx("}")]),
        blank(10),
        ln(11, [kw("project"), tx(" Users."), ref("UsersProfile", "profile", "derived"),
                tx(" -> "), ref("profile_rs")]),
        ln(12, [kw("project"), tx(" Users."), ref("UsersEmail",   "email",   "derived"),
                tx("   -> "), ref("email_rs")]),
        ln(13, [kw("project"), tx(" Users."), ref("UsersToken",   "token",   "derived"),
                tx("   -> "), ref("token_rs")])
      ],
      graph: {
        nodes: applyNodeRoles(baseLayoutNodes(system), {
          User:         "stable",
          UsersProfile: "derived",
          UsersEmail:   "derived",
          UsersToken:   "derived"
        }),
        edges: applyEdgeRoles(baseLayoutEdges(), {}, "derived")
      },
      receipt: [
        { label: "structure",    value: "{stable:one description} · {derived:three operations}" },
        { label: "emissions",    value: "{artifact:profile.rs} · {artifact:email.rs} · {artifact:token.rs}" },
        { label: "translations", value: "{derived:zero hand-written}" }
      ]
    };
  }

  /* ════════════════════════════════════════════════════════════════
     CARD 02 · affected-set propagation — same layout, different roles
     ══════════════════════════════════════════════════════════════ */

  function affectedSetCard(system) {
    return {
      id: "card-02",
      num: "02",
      name: "edit Timestamp · one branch re-derived, two unrelated",
      systemId: system.id,
      codeFile: "examples/users.dag",
      code: [
        diffRm(1,  [kw("type"), tx(" "), ref("Timestamp", "Timestamp", "focus"), tx(" = UnixMillis")]),
        diffAdd(1, [kw("type"), tx(" "), ref("Timestamp", "Timestamp", "focus"), tx(" = IsoDateTime")]),
        blank(2),
        ln(3,  [kw("type"), tx(" "), ref("User"),
                tx(" { id, email, name, created_at : "), ref("Timestamp"), tx(" }")]),
        blank(4),
        ln(5,  [kw("fn"), tx(" format_joined(t: "), ref("Timestamp"), tx(") -> String")]),
        blank(6),
        ln(7,  [kw("service"), tx(" Users {")]),
        ln(8,  [tx("  "), ref("UsersProfile", "profile", "transitive"),
                tx("(id) -> Profile   "), com("-- created_at via format_joined")]),
        ln(9,  [tx("  "), ref("UsersEmail",   "email",   "context"),
                tx("(id)   -> Email     "), com("-- u.email")]),
        ln(10, [tx("  "), ref("UsersToken",   "token",   "context"),
                tx("(id)   -> AuthToken "), com("-- hash(u.id)")]),
        ln(11, [tx("}")]),
        blank(12),
        ln(13, [kw("project"), tx(" Users."), ref("UsersProfile", "profile", "transitive"),
                tx(" -> "), ref("profile_rs")]),
        ln(14, [kw("project"), tx(" Users."), ref("UsersEmail",   "email",   "context"),
                tx("   -> "), ref("email_rs")]),
        ln(15, [kw("project"), tx(" Users."), ref("UsersToken",   "token",   "context"),
                tx("   -> "), ref("token_rs")])
      ],
      graph: (() => {
        const wt = withTimestamp(baseLayoutNodes(system), baseLayoutEdges());
        // Override email/token artifact roles to context (grey).
        // Default artifact role is artifact (warm-white); mutate so
        // the two unrelated artifacts read as grey.
        const nodes = applyNodeRoles(wt.nodes, {
          Timestamp:    "focus",
          User:         "derived",     // its created_at field changed
          UsersProfile: "transitive",  // uses User.created_at → format_joined
          UsersEmail:   "context",     // uses User.email — unaffected
          UsersToken:   "context"      // uses User.id — unaffected
        }).map(n => {
          if (n.id === "email_rs" || n.id === "token_rs") {
            return Object.assign({}, n, { role: "context" });
          }
          return n;
        });
        return {
          nodes,
          edges: applyEdgeRoles(wt.edges, {
            "Timestamp→User":            "focus",
            "User→UsersProfile":         "transitive",
            "User→UsersEmail":           "context",
            "User→UsersToken":           "context",
            "UsersProfile→profile_rs":   "transitive",
            "UsersEmail→email_rs":       "context",
            "UsersToken→token_rs":       "context"
          }, "derived")
        };
      })(),
      receipt: [
        { label: "changed",    value: "{focus:Timestamp representation}" },
        { label: "direct",     value: "{derived:User.created_at} · {derived:format_joined}" },
        { label: "transitive", value: "{transitive:Users.profile} · Profile.joined" },
        { label: "re-derived", value: "{artifact:profile.rs}" },
        { label: "unrelated",  value: "{context:Users.email · Users.token · email.rs · token.rs}" },
        { label: "hand-edits", value: "{derived:zero}" }
      ]
    };
  }

  /* ════════════════════════════════════════════════════════════════
     CARD 03 · complexity budget violation — diagnostic absorbed
     ══════════════════════════════════════════════════════════════ */

  function complexityViolationCard(system) {
    return {
      id: "card-03",
      num: "03",
      name: "complexity budget · O(n) declared, O(n²) observed",
      systemId: system.id,
      codeFile: "examples/users.dag",
      shape: "cost-area",
      code: [
        ln(1, [kw("fn"), tx(" "), ref("unique_users", "unique_users", "focus"),
               tx("(users: List<"), ref("User", "User", "context"), tx(">) {")]),
        ln(2, [tx("  users |> "), ref("filter_call", "filter", "derived"), tx("(fn(u) {")]),
        diffAdd(3, [tx("    "), ref("count_call", "count", "boundary"),
                    tx("(users, fn(v) { v.id == u.id }) == 1")]),
        ln(4, [tx("  })")]),
        ln(5, [tx("}")]),
        blank(6),
        ln(7, [kw("lens"), tx(" complexity("), ref("unique_users", "unique_users", "focus"),
               tx(") <= O(n)")]),
        ln(8, [com("-- complexity budget set to O(n)")])
      ],
      panels: [
        { id: "declared", label: "declared", sublabel: "O(n)",  cols: 6, rows: 1, budgetRows: 1 },
        { id: "observed", label: "observed", sublabel: "O(n²)", cols: 6, rows: 6, budgetRows: 1 }
      ],
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
        { label: "declared",          value: "{derived:unique_users ≤ O(n) budget}" },
        { label: "observed",          value: "{boundary:filter(users) × count(users) = O(n²)}" },
        { label: "reached through",   value: "{boundary:filter(users) → count(users)}" },
        { label: "suggested",         value: "{derived:index users by id once, filter buckets of size 1}" },
        { label: "replacement shape", code: [
          "let by_id = group_by(users, key: fn(u) { u.id })",
          "by_id |> values |> filter(fn(bucket) { length(bucket) == 1 })"
        ]},
        { label: "result",            value: "{boundary:no artifact emitted}" }
      ]
    };
  }

  /* ════════════════════════════════════════════════════════════════
     BOOTSTRAP
     ══════════════════════════════════════════════════════════════ */

  const DECK = {
    name: "users.dag · one system · three views",
    cards: [
      projectionClosureCard(USERS_SYSTEM),
      affectedSetCard(USERS_SYSTEM),
      complexityViolationCard(USERS_SYSTEM)
    ]
  };

  function init() {
    const slot = document.querySelector('[data-deck="api.dag"]')
              || document.querySelector('[data-deck="users.dag"]')
              || document.querySelector('[data-deck]');
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
