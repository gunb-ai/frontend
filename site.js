(function () {
  var html = document.documentElement;
  var btn = document.getElementById("mode-toggle");
  var label = document.getElementById("mode-label-text");
  if (!btn || !label) return;

  btn.addEventListener("click", function () {
    var next = (html.getAttribute("data-mode") || "dark") === "dark" ? "light" : "dark";
    html.setAttribute("data-mode", next);
    label.textContent = next.charAt(0).toUpperCase() + next.slice(1);
  });

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

  var hash = location.hash.replace(/^#/, "");
  if (hash && document.getElementById("panel-" + hash)) {
    selectTab(hash);
  }
})();

/* Hero mark mildly follows the cursor when you go idle, then snaps back on activity. */
(function () {
  var features = document.querySelector(".hero-logo .features");
  if (!features) return;
  var svg = features.closest("svg");

  var FACE_CENTER = { x: 60, y: 52 };  // midpoint between eyes, near mouth
  var MAX_OFFSET = 3;                  // SVG units; "mildly" follow
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
    // force reflow so the transition-less reset commits before re-enabling
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
    if (document.hidden) {
      snapBack();
      if (idleTimer) clearTimeout(idleTimer);
    } else {
      armIdle();
    }
  });

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (!visible) {
        snapBack();
        if (idleTimer) clearTimeout(idleTimer);
      } else {
        armIdle();
      }
    }, { threshold: 0.2 });
    io.observe(svg);
  }

  armIdle();
})();
