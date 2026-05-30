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
