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

  // Plot frame (matches viewBox in HTML: 320 x 220)
  var X0 = 40, X1 = 310, Y0 = 195, Y1 = 30;
  var SAMPLES = 60;

  // Bound shapes (aesthetic, normalized so each fits in the frame at n=200)
  // We rescale to plot area at draw time
  function bound(kind, n) {
    switch (kind) {
      case "O1":     return 0.06;
      case "On":     return n / 200;
      case "OnlogN": return (n * Math.log2(Math.max(n, 2))) / (200 * Math.log2(200));
      case "On2":    return (n * n) / (200 * 200);
      case "OQ":     return Math.min(1, 0.45 + 0.55 * Math.sin(n * 0.13) * Math.sin(n * 0.07));
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

  ["O1", "On", "OnlogN", "On2", "OQ"].forEach(function (k) {
    var el = document.getElementById("curve-" + k);
    if (el) el.setAttribute("d", pathFor(k));
  });

  var slider = document.getElementById("pg-n");
  var nLabel = document.getElementById("pg-n-value");
  var pills = document.querySelectorAll(".pg-fn");
  var current = "O1";

  function updateActive() {
    document.querySelectorAll(".curve").forEach(function (c) { c.classList.remove("is-active"); });
    document.querySelectorAll(".curve-dot").forEach(function (d) { d.classList.remove("is-active"); });
    var curve = document.getElementById("curve-" + current);
    var dot = document.getElementById("dot-" + current);
    if (curve) curve.classList.add("is-active");
    if (dot) dot.classList.add("is-active");
  }

  function placeDot() {
    var n = parseFloat(slider.value);
    if (nLabel) nLabel.textContent = "n = " + n;
    ["O1", "On", "OnlogN", "On2", "OQ"].forEach(function (k) {
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
  if (slider) {
    slider.addEventListener("input", placeDot);
  }

  // Redraw on resize so curve geometry tracks the SVG's actual rendered size.
  if ("ResizeObserver" in window) {
    new ResizeObserver(function () {
      ["O1", "On", "OnlogN", "On2", "OQ"].forEach(function (k) {
        var el = document.getElementById("curve-" + k);
        if (el) el.setAttribute("d", pathFor(k));
      });
      placeDot();
    }).observe(plot);
  }

  updateActive();
  placeDot();
})();
