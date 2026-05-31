/* ─── Mode toggle + tabs ─────────────────────────── */
(function () {
  var html = document.documentElement;
  var btn = document.getElementById("mode-toggle");
  var label = document.getElementById("mode-label-text");
  if (btn && label) {
    btn.addEventListener("click", function () {
      var next = (html.getAttribute("data-mode") || "dark") === "dark" ? "light" : "dark";
      html.setAttribute("data-mode", next);
      label.textContent = next.charAt(0).toUpperCase() + next.slice(1);
    });
  }

  var tabs = document.querySelectorAll('[role="tab"]');
  var panels = document.querySelectorAll('[role="tabpanel"]');
  if (!tabs.length) return;

  function selectTab(id) {
    tabs.forEach(function (tab) {
      var on = tab.getAttribute("data-tab") === id;
      tab.setAttribute("aria-selected", on ? "true" : "false");
    });
    panels.forEach(function (panel) {
      panel.hidden = panel.id !== "panel-" + id;
    });
    if (location.hash !== "#" + id) {
      history.replaceState(null, "", "#" + id);
    }
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      selectTab(tab.getAttribute("data-tab"));
    });
  });

  function activateFromHash() {
    var id = location.hash.replace(/^#/, "");
    if (id && document.getElementById("panel-" + id)) selectTab(id);
  }
  window.addEventListener("hashchange", activateFromHash);
  activateFromHash();
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

/* ─── Complexity playground ─────────────────────── */
(function () {
  var plot = document.getElementById("pg-plot");
  if (!plot) return;

  var X0 = 40, X1 = 310, Y0 = 195, Y1 = 30;
  var SAMPLES = 60;
  var CLASSES = ["O1", "On", "OnlogN", "On2"];

  function bound(kind, n) {
    switch (kind) {
      case "O1":     return 0.06;
      case "On":     return n / 200;
      case "OnlogN": return (n * Math.log2(Math.max(n, 2))) / (200 * Math.log2(200));
      case "On2":    return (n * n) / (200 * 200);
    }
  }
  function pathFor(kind) {
    var pts = [];
    for (var i = 0; i <= SAMPLES; i++) {
      var n = (i / SAMPLES) * 200;
      var v = bound(kind, n);
      var x = X0 + (n / 200) * (X1 - X0);
      var y = Y0 + v * (Y1 - Y0);
      pts.push((i === 0 ? "M" : "L") + x.toFixed(2) + "," + y.toFixed(2));
    }
    return pts.join(" ");
  }
  function drawCurves() {
    CLASSES.forEach(function (k) {
      var el = document.getElementById("curve-" + k);
      if (el) el.setAttribute("d", pathFor(k));
    });
  }
  drawCurves();

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
    document.querySelectorAll(".curve").forEach(function (c) { c.classList.remove("is-active"); });
    document.querySelectorAll(".curve-dot").forEach(function (d) { d.classList.remove("is-active"); });
    var curve = document.getElementById("curve-" + current);
    var dot = document.getElementById("dot-" + current);
    if (curve) curve.classList.add("is-active");
    if (dot) dot.classList.add("is-active");

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
    var n = parseFloat(slider.value);
    if (nLabel) nLabel.textContent = "n = " + n;
    CLASSES.forEach(function (k) {
      var dot = document.getElementById("dot-" + k);
      if (!dot) return;
      var v = bound(k, n);
      var x = X0 + (n / 200) * (X1 - X0);
      var y = Y0 + v * (Y1 - Y0);
      dot.setAttribute("cx", x.toFixed(2));
      dot.setAttribute("cy", y.toFixed(2));
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

  if ("ResizeObserver" in window) {
    new ResizeObserver(function () { drawCurves(); placeDot(); }).observe(plot);
  }

  updateActive();
  placeDot();
})();
