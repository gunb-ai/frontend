/* ─── Mode toggle + tabs ─────────────────────────── */
(function () {
  var html = document.documentElement;
  var btn = document.getElementById("mode-toggle");
  var label = document.getElementById("mode-label-text");

  // Initial mode: saved preference > system preference > the HTML default.
  // Done early so the page paints in the right mode (a tiny inline <head>
  // script could remove the brief flash; see TODO below).
  try {
    var saved = localStorage.getItem("daglang-mode");
    var systemLight = window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: light)").matches;
    var initial = saved || (systemLight ? "light" : "dark");
    html.setAttribute("data-mode", initial);
    if (label) label.textContent = initial.charAt(0).toUpperCase() + initial.slice(1);
  } catch (_) { /* localStorage may be blocked; fall back to HTML default */ }

  if (btn && label) {
    btn.addEventListener("click", function () {
      var next = (html.getAttribute("data-mode") || "dark") === "dark" ? "light" : "dark";
      html.setAttribute("data-mode", next);
      label.textContent = next.charAt(0).toUpperCase() + next.slice(1);
      try { localStorage.setItem("daglang-mode", next); } catch (_) {}
    });
  }

  var tabs = document.querySelectorAll('[role="tab"]');
  var panels = document.querySelectorAll('[role="tabpanel"]');
  if (!tabs.length) return;

  function selectTab(id) {
    tabs.forEach(function (tab) {
      var on = tab.getAttribute("data-tab") === id;
      tab.setAttribute("aria-selected", on ? "true" : "false");
      tab.setAttribute("tabindex", on ? "0" : "-1");
    });
    panels.forEach(function (panel) {
      panel.hidden = panel.id !== "panel-" + id;
    });
    if (location.hash !== "#" + id) {
      history.replaceState(null, "", "#" + id);
    }
  }

  tabs.forEach(function (tab) {
    // A11y: wire aria-controls + tabindex so the tab points at its panel
    // and screen readers know which one is active.
    var id = tab.getAttribute("data-tab");
    var panelId = "panel-" + id;
    if (document.getElementById(panelId)) {
      tab.setAttribute("aria-controls", panelId);
    }
    tab.setAttribute("tabindex", tab.getAttribute("aria-selected") === "true" ? "0" : "-1");

    tab.addEventListener("click", function () {
      selectTab(id);
      tab.focus();
    });
  });


  function activateFromHash() {
    var id = location.hash.replace(/^#/, "");
    if (id && document.getElementById("panel-" + id)) selectTab(id);
  }
  window.addEventListener("hashchange", activateFromHash);
  activateFromHash();
})();

/* ─── Universal tablist keyboard nav ──────────────────────────
 * Arrow-Left/Right (and Up/Down) cycles through tabs inside any
 * [role="tablist"]; Home/End jump to first/last. The selection action
 * is the tab's own click handler — whatever wired it (main tabs,
 * scenario pickers, handler pickers) does the right thing on click. */
(function () {
  document.querySelectorAll('[role="tablist"]').forEach(function (list) {
    var items = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
    items.forEach(function (item, idx) {
      item.addEventListener("keydown", function (e) {
        var next = null;
        switch (e.key) {
          case "ArrowRight": case "ArrowDown":
            next = items[(idx + 1) % items.length]; break;
          case "ArrowLeft":  case "ArrowUp":
            next = items[(idx - 1 + items.length) % items.length]; break;
          case "Home": next = items[0]; break;
          case "End":  next = items[items.length - 1]; break;
        }
        if (next) {
          e.preventDefault();
          next.focus();
          next.click();
        }
      });
    });
  });
})();

/* ─── Hero pipeline diagram: SVG lines over HTML boxes ──────────
 * Boxes/text are HTML so the browser handles baselines normally.
 * The overlay SVG draws the connecting wires after measuring each
 * node's center against the same container's coordinate frame —
 * no SVG baseline guessing, no aspect-ratio surprises. */
(function () {
  var pipeline = document.getElementById("hero-pipeline");
  var svg = document.getElementById("hero-pipeline-lines");
  if (!pipeline || !svg) return;

  var ART_ORDER = ["rust", "go", "python", "ts", "openapi", "verilog", "pspice"];
  var ART_TIER  = {
    rust: "now", go: "stable", python: "stable",
    ts: "next", openapi: "next",
    verilog: "vision", pspice: "vision",
  };
  var TIER_COLOR = {
    now:    "var(--tier-now)",
    stable: "var(--tier-stable)",
    next:   "var(--tier-next)",
    vision: "var(--tier-vision)",
  };

  function rectOf(sel, root) {
    var el = typeof sel === "string" ? pipeline.querySelector(sel) : sel;
    if (!el) return null;
    var b = el.getBoundingClientRect();
    return {
      el: el,
      left:   b.left   - root.left,
      right:  b.right  - root.left,
      top:    b.top    - root.top,
      bottom: b.bottom - root.top,
      cx:     b.left   - root.left + b.width / 2,
      cy:     b.top    - root.top  + b.height / 2,
    };
  }

  function draw() {
    var rootBox = pipeline.getBoundingClientRect();
    var W = rootBox.width, H = rootBox.height;
    if (!W || !H) return;

    var source = rectOf("#hp-source", rootBox);
    var compiler = rectOf("#hp-compiler", rootBox);
    var artifacts = ART_ORDER.map(function (n) {
      return rectOf('[data-art="' + n + '"]', rootBox);
    });
    if (!source || !compiler || artifacts.some(function (a) { return !a; })) return;

    var artRight = Math.max.apply(null, artifacts.map(function (a) { return a.right; }));
    var trunkX = (compiler.right + artifacts[0].left) / 2;
    // Trunk extends to include the snapped source/compiler y so the
    // horizontal join always lands ON the trunk.
    var trunkTop = Math.min(artifacts[0].cy, compiler.cy, (source.cy + compiler.cy) / 2);
    var trunkBot = Math.max(artifacts[artifacts.length - 1].cy, compiler.cy, (source.cy + compiler.cy) / 2);
    var busX = Math.min(artRight + 18, W - 6);

    var parts = [];

    // Arrowhead markers
    parts.push(
      '<defs>' +
      '<marker id="hp-arr-now"    viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,1 L7,4 L0,7 z" fill="' + TIER_COLOR.now    + '"/></marker>' +
      '<marker id="hp-arr-stable" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,1 L7,4 L0,7 z" fill="' + TIER_COLOR.stable + '"/></marker>' +
      '<marker id="hp-arr-next"   viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,1 L7,4 L0,7 z" fill="' + TIER_COLOR.next   + '"/></marker>' +
      '<marker id="hp-arr-vision" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,1 L7,4 L0,7 z" fill="' + TIER_COLOR.vision + '"/></marker>' +
      '</defs>'
    );

    // source → compiler arrow. Snap both endpoints to a shared y (the
    // average of source.cy and compiler.cy) so the line draws horizontal
    // even if cap-text wrapping or font metrics put the two boxes at
    // slightly different vertical positions.
    var srcLineY = Math.round((source.cy + compiler.cy) / 2);
    parts.push(line(source.right, srcLineY, compiler.left, srcLineY,
      TIER_COLOR.now, "url(#hp-arr-now)"));

    // compiler → trunk midpoint (horizontal join from the same snapped y)
    parts.push(line(compiler.right, srcLineY, trunkX, srcLineY,
      TIER_COLOR.now));

    // Vertical trunk spanning the artifact stack
    parts.push(line(trunkX, trunkTop, trunkX, trunkBot, TIER_COLOR.now));

    // One branch per artifact, with tier-colored arrowhead
    artifacts.forEach(function (a, i) {
      var tier = ART_TIER[ART_ORDER[i]];
      parts.push(line(trunkX, a.cy, a.left, a.cy,
        TIER_COLOR[tier], "url(#hp-arr-" + tier + ")"));
    });

    // ── Runtime bus 1: Web (Rust + TS + OpenAPI) ──
    var webIdx = [0, 3, 4]; // rust, ts, openapi
    var webTiles = webIdx.map(function (i) { return artifacts[i]; });
    var webTop = webTiles[0].cy, webBot = webTiles[webTiles.length - 1].cy;
    webTiles.forEach(function (t) {
      parts.push(line(t.right, t.cy, busX, t.cy, TIER_COLOR.now, null, 1.3));
    });
    parts.push(line(busX, webTop, busX, webBot, TIER_COLOR.now, null, 1.3));
    var webMidY = (webTop + webBot) / 2;
    parts.push(line(busX, webMidY, busX + 10, webMidY, TIER_COLOR.now, null, 1.3));
    positionBusLabel("#hp-bus-web", busX + 14, webMidY, rootBox);

    // ── Runtime bus 2: HW (Verilog + PSpice) ──
    var hwIdx = [5, 6];
    var hwTiles = hwIdx.map(function (i) { return artifacts[i]; });
    var hwTop = hwTiles[0].cy, hwBot = hwTiles[1].cy;
    hwTiles.forEach(function (t) {
      parts.push(line(t.right, t.cy, busX, t.cy, TIER_COLOR.vision, null, 1.3));
    });
    parts.push(line(busX, hwTop, busX, hwBot, TIER_COLOR.vision, null, 1.3));
    var hwMidY = (hwTop + hwBot) / 2;
    parts.push(line(busX, hwMidY, busX + 10, hwMidY, TIER_COLOR.vision, null, 1.3));
    positionBusLabel("#hp-bus-hw", busX + 14, hwMidY, rootBox);

    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.innerHTML = parts.join("");
  }

  function line(x1, y1, x2, y2, color, markerEnd, width) {
    return '<line x1="' + x1.toFixed(1) +
      '" y1="' + y1.toFixed(1) +
      '" x2="' + x2.toFixed(1) +
      '" y2="' + y2.toFixed(1) +
      '" stroke="' + color +
      '" stroke-width="' + (width || 1.3) +
      '" stroke-linecap="round"' +
      (markerEnd ? ' marker-end="' + markerEnd + '"' : '') +
      ' />';
  }

  function positionBusLabel(sel, x, y, rootBox) {
    var label = pipeline.querySelector(sel);
    if (!label) return;
    // Position the label so its vertical center sits on y.
    label.style.left = Math.round(x) + "px";
    label.style.top  = Math.round(y - label.offsetHeight / 2) + "px";
    label.style.visibility = "visible";
  }

  // rAF-debounced redraw
  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; draw(); });
  }

  window.addEventListener("resize", schedule);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(schedule);
  }
  if ("ResizeObserver" in window) {
    new ResizeObserver(schedule).observe(pipeline);
  }
  draw();
  // One extra pass after layout settles, for the case where fonts.ready
  // resolved before the listener was attached.
  requestAnimationFrame(draw);
})();

/* ─── Hero mark idle cursor-follow ──────────────── */
(function () {
  var features = document.querySelector(".hero-logo .features");
  if (!features) return;
  var svg = features.closest("svg");

  var FACE_CENTER = { x: 60, y: 52 };
  var MAX_OFFSET = 3;
  var IDLE_MS = 2000;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var lastSvgPt = { x: 60, y: 60 };
  var idleTimer = null;
  var staring = false;
  var visible = true;

  function pageToSvg(cx, cy) {
    var r = svg.getBoundingClientRect();
    if (!r.width || !r.height) return lastSvgPt;
    return {
      x: ((cx - r.left) / r.width) * 120,
      y: ((cy - r.top) / r.height) * 120
    };
  }
  function aimAtCursor() {
    var dx = lastSvgPt.x - FACE_CENTER.x;
    var dy = lastSvgPt.y - FACE_CENTER.y;
    var len = Math.hypot(dx, dy) || 1;
    var k = Math.min(MAX_OFFSET, len) / len;
    features.style.setProperty("--ftx", (dx * k).toFixed(2) + "px");
    features.style.setProperty("--fty", (dy * k).toFixed(2) + "px");
  }
  function startStaring() {
    if (reduced || staring || !visible) return;
    staring = true;
    aimAtCursor();
  }
  function snapBack() {
    if (!staring) return;
    staring = false;
    features.classList.add("is-snap");
    features.style.setProperty("--ftx", "0px");
    features.style.setProperty("--fty", "0px");
    void features.getBoundingClientRect();
    features.classList.remove("is-snap");
  }
  function armIdle() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(startStaring, IDLE_MS);
  }
  function onActivity(e) {
    if (e && e.clientX != null && e.clientY != null) {
      lastSvgPt = pageToSvg(e.clientX, e.clientY);
    }
    snapBack();
    armIdle();
  }
  window.addEventListener("mousemove", onActivity, { passive: true });
  window.addEventListener("keydown", onActivity, { passive: true });
  window.addEventListener("touchstart", onActivity, { passive: true });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { snapBack(); if (idleTimer) clearTimeout(idleTimer); }
    else { armIdle(); }
  });
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (!visible) { snapBack(); if (idleTimer) clearTimeout(idleTimer); }
      else { armIdle(); }
    }, { threshold: 0.2 });
    io.observe(svg);
  }
  armIdle();
})();

/* ─── Complexity playground (growth ladder) ──────────
 * Replaces the old curve plot with a fixed-ordered ladder of bars.
 * Bar widths are static (set in CSS) so the relative ordering is
 * unambiguous at every n; only the per-class op counts update with
 * the slider. Pills still drive which class is highlighted. */
(function () {
  var plot = document.getElementById("pg-plot");
  if (!plot) return;

  var CLASSES = ["O1", "On", "OnlogN", "On2"];

  // Raw op counts per class at given n. Pretty integer rounding.
  function opsAt(kind, n) {
    switch (kind) {
      case "O1":     return 1;
      case "On":     return Math.round(n);
      case "OnlogN": return Math.round(n * Math.log2(Math.max(n, 2)));
      case "On2":    return Math.round(n * n);
    }
    return 0;
  }
  function fmt(n) {
    // Group by thousands for readability at large n
    return n.toLocaleString();
  }

  var slider = document.getElementById("pg-n");
  var nLabel = document.getElementById("pg-n-value");
  var pills = document.querySelectorAll(".pg-fn");
  var sourceName = document.getElementById("pg-source-name");
  var sourceTag = document.getElementById("pg-source-tag");
  var sourceCode = document.getElementById("pg-source-code");
  var sourceWhy = document.getElementById("pg-source-why");
  var shapeSvg = document.getElementById("pg-shape-svg");
  var shapeName = document.getElementById("pg-shape-name");
  var shapeTag = document.getElementById("pg-shape-tag");
  var current = "O1";

  // Per-function metadata — sources are taken verbatim from the repo where possible.
  var FNS = {
    O1: {
      title: "to_fahrenheit · weather.dag",
      tag:   "Available now · measured",
      code:  'fn to_fahrenheit(temp: Temperature) -> Float {\n  temp.celsius * 1.8 + 32.0\n}',
      why:   '<strong>Why O(1):</strong> body is one arithmetic expression — no recursion, no iteration, ' +
             'no dispatch on input size. The cost-lens algebra folds across the body and finds a constant ' +
             'tree, so the bound is constant by construction.',
      shapeTag: "shape: constant body",
    },
    On: {
      title: "freezing_locations · weather.dag",
      tag:   "Available now · measured",
      code:  'fn freezing_locations(forecasts: List<Forecast>) -> List<String> {\n' +
             '  forecasts\n' +
             '    |> filter(f => is_freezing(temp: f.low))\n' +
             '    |> map(f => f.location)\n' +
             '}',
      why:   '<strong>Why O(n):</strong> two pipeline stages over the same <code>List&lt;Forecast&gt;</code>. ' +
             '<code>filter</code> and <code>map</code> are <em>iterate-body</em> shapes (<code>O(n · body)</code>); ' +
             '<code>is_freezing</code> and the projection body are both O(1). Linear in <code>n</code>.',
      shapeTag: "shape: iterate-body × O(1)",
    },
    OnlogN: {
      title: "ranked_forecasts · using std sort_by",
      tag:   "Available now · primitive contract",
      code:  'fn ranked_forecasts(forecasts: List<Forecast>) -> List<Forecast> {\n' +
             '  forecasts\n' +
             '    |> sort_by(f => to_fahrenheit(temp: f.high))\n' +
             '}',
      why:   '<strong>Why O(n log n):</strong> <code>sort_by</code> is a <em>ShapeSortBody</em> primitive — ' +
             'work contract declared as <code>n · (key_work + log n)</code> in ' +
             '<code>dsl/std/primitives.dag:367</code>. The key <code>to_fahrenheit</code> is O(1), so the ' +
             'composed cost is <code>n · log n</code>.',
      shapeTag: "shape: ShapeSortBody",
    },
    On2: {
      title: "bag_eq · src/v4/std/algebra.dag:724",
      tag:   "Available now · real source",
      code:  'fn bag_eq<T>(xs: FreeMonoid<T>, ys: FreeMonoid<T>,\n' +
             '             eq: fn(T, T) -> Bool) -> Bool {\n' +
             '  if length(xs: xs) != length(xs: ys) {\n' +
             '    false\n' +
             '  } else {\n' +
             '    for_all(xs: xs, predicate: fn(item) {\n' +
             '      count_equal(xs: xs, item: item, eq: eq)\n' +
             '        == count_equal(xs: ys, item: item, eq: eq)\n' +
             '    })\n' +
             '  }\n' +
             '}',
      why:   '<strong>Why O(n²):</strong> the outer <code>for_all</code> walks <code>xs</code> once (n steps). ' +
             'For each step, <code>count_equal</code> walks the whole list again to tally occurrences. The ' +
             'comment in the source declares it: <em>"O(n^2) in the length of xs"</em>. Two nested iterations ' +
             'over the same n.',
      shapeTag: "shape: iterate × iterate",
    },
  };

  // Structural-graph SVGs per class. Drawn so you can see the cost shape at a glance.
  function shapeSVG(kind) {
    if (kind === "O1") {
      return '' +
        '<text class="label" x="20" y="20">cost graph</text>' +
        '<circle class="node c-O1" cx="160" cy="110" r="22"/>' +
        '<text class="accent-label c-O1" x="160" y="114" text-anchor="middle">1</text>' +
        '<text class="label" x="160" y="170" text-anchor="middle">single bounded step</text>';
    }
    if (kind === "On") {
      // n nodes in a row → "scan over a collection"
      var bits = ['<text class="label" x="20" y="20">cost graph</text>'];
      var count = 9;
      for (var i = 0; i < count; i++) {
        var cx = 50 + i * 28;
        bits.push('<circle class="node c-On" cx="' + cx + '" cy="110" r="9"/>');
        if (i < count - 1) {
          bits.push('<line class="edge c-On" x1="' + (cx + 9) + '" y1="110" x2="' + (cx + 28 - 9) + '" y2="110"/>');
        }
      }
      bits.push('<text class="accent-label c-On" x="160" y="80" text-anchor="middle">iterate · n steps</text>');
      bits.push('<text class="label" x="160" y="170" text-anchor="middle">map / filter / fold over List&lt;T&gt;</text>');
      return bits.join("");
    }
    if (kind === "OnlogN") {
      // Balanced binary tree (divide-and-conquer)
      var nodes = [
        // root
        { x: 160, y: 50, r: 9 },
        // depth 1
        { x: 100, y: 95, r: 8 }, { x: 220, y: 95, r: 8 },
        // depth 2
        { x: 70, y: 135, r: 7 }, { x: 130, y: 135, r: 7 },
        { x: 190, y: 135, r: 7 }, { x: 250, y: 135, r: 7 },
        // depth 3 (leaves)
        { x: 55, y: 175, r: 6 }, { x: 85, y: 175, r: 6 },
        { x: 115, y: 175, r: 6 }, { x: 145, y: 175, r: 6 },
        { x: 175, y: 175, r: 6 }, { x: 205, y: 175, r: 6 },
        { x: 235, y: 175, r: 6 }, { x: 265, y: 175, r: 6 },
      ];
      var edges = [
        [0,1],[0,2],
        [1,3],[1,4],[2,5],[2,6],
        [3,7],[3,8],[4,9],[4,10],[5,11],[5,12],[6,13],[6,14],
      ];
      var out = ['<text class="label" x="20" y="20">cost graph</text>'];
      edges.forEach(function (e) {
        var a = nodes[e[0]], b = nodes[e[1]];
        out.push('<line class="edge c-OnlogN" x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '"/>');
      });
      nodes.forEach(function (n) {
        out.push('<circle class="node c-OnlogN" cx="' + n.x + '" cy="' + n.y + '" r="' + n.r + '"/>');
      });
      out.push('<text class="accent-label c-OnlogN" x="305" y="100" text-anchor="end">log n levels</text>');
      out.push('<text class="accent-label c-OnlogN" x="305" y="180" text-anchor="end">n leaves</text>');
      out.push('<text class="label" x="160" y="208" text-anchor="middle">sort_by · divide-and-conquer</text>');
      return out.join("");
    }
    if (kind === "On2") {
      // n × n grid — nested iteration
      var gOut = ['<text class="label" x="20" y="20">cost graph</text>'];
      var GX = 110, GY = 38, STEP = 18, N = 8;
      for (var r = 0; r < N; r++) {
        for (var c = 0; c < N; c++) {
          var cx2 = GX + c * STEP;
          var cy2 = GY + r * STEP;
          var emph = (c === r) ? ' style="fill:var(--tier-vision);opacity:0.85"' : "";
          gOut.push('<circle class="node c-On2" cx="' + cx2 + '" cy="' + cy2 + '" r="3"' + emph + '/>');
        }
      }
      // bracket labels
      gOut.push('<path class="edge c-On2" d="M' + (GX - 14) + ',' + (GY - 6) + ' L' + (GX - 8) + ',' + (GY - 6) + ' L' + (GX - 8) + ',' + (GY + (N - 1) * STEP + 6) + ' L' + (GX - 14) + ',' + (GY + (N - 1) * STEP + 6) + '"/>');
      gOut.push('<text class="accent-label c-On2" x="' + (GX - 20) + '" y="' + (GY + ((N - 1) * STEP) / 2 + 3) + '" text-anchor="end">n</text>');
      gOut.push('<path class="edge c-On2" d="M' + (GX - 6) + ',' + (GY + (N - 1) * STEP + 14) + ' L' + (GX - 6) + ',' + (GY + (N - 1) * STEP + 8) + ' L' + (GX + (N - 1) * STEP + 6) + ',' + (GY + (N - 1) * STEP + 8) + ' L' + (GX + (N - 1) * STEP + 6) + ',' + (GY + (N - 1) * STEP + 14) + '"/>');
      gOut.push('<text class="accent-label c-On2" x="' + (GX + ((N - 1) * STEP) / 2) + '" y="' + (GY + (N - 1) * STEP + 28) + '" text-anchor="middle">n</text>');
      gOut.push('<text class="label" x="160" y="210" text-anchor="middle">for each item, scan the whole list</text>');
      return gOut.join("");
    }
    return "";
  }

  function updateActive() {
    // Toggle is-active on the matching ladder row.
    document.querySelectorAll(".cx-row").forEach(function (r) {
      r.classList.toggle("is-active", r.getAttribute("data-class") === current);
    });

    var meta = FNS[current];
    if (meta) {
      if (sourceName) sourceName.textContent = meta.title;
      if (sourceTag)  sourceTag.textContent  = meta.tag;
      if (sourceCode) sourceCode.textContent = meta.code;
      if (sourceWhy) {
        sourceWhy.className = "pg-source-why c-" + current;
        sourceWhy.innerHTML = meta.why;
      }
      if (shapeSvg) shapeSvg.innerHTML = shapeSVG(current);
      if (shapeTag) shapeTag.textContent = meta.shapeTag;
    }
  }

  function placeDot() {
    // Update per-class op counts in the ladder + the slider label.
    var n = parseFloat(slider.value);
    if (nLabel) nLabel.textContent = "n = " + n;
    CLASSES.forEach(function (k) {
      var el = document.getElementById("cx-val-" + k);
      if (el) el.textContent = fmt(opsAt(k, n));
    });
  }

  pills.forEach(function (p) {
    p.addEventListener("click", function () {
      pills.forEach(function (q) { q.setAttribute("aria-selected", "false"); });
      p.setAttribute("aria-selected", "true");
      current = p.getAttribute("data-class");
      updateActive();
    });
  });
  if (slider) slider.addEventListener("input", placeDot);

  // No more SVG redraw needed — bars are static CSS. Slider input is the
  // only thing that updates the displayed numbers.

  updateActive();
  placeDot();
})();
