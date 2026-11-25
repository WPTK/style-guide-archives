(function () {
  "use strict";
  var body = document.querySelector("#list tbody");
  var q = document.getElementById("q");
  var sortSel = document.getElementById("s");
  var count = document.getElementById("count");
  var none = document.getElementById("none");
  var table = document.getElementById("list");
  if (!body || !q) return;

  var rows = Array.prototype.slice.call(body.rows);
  var total = rows.length;
  var buttons = Array.prototype.slice.call(document.querySelectorAll(".cats button"));
  var state = { q: "", c: "", s: "n" };

  function norm(s) {
    return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }
  var text = new Map();
  var title = new Map();
  rows.forEach(function (r) {
    text.set(r, norm(r.textContent));
    title.set(r, norm(r.cells[0].textContent));
  });

  function filter() {
    var words = norm(state.q).split(/\s+/).filter(Boolean);
    var shown = 0;
    rows.forEach(function (r) {
      var h = text.get(r);
      var ok = (!state.c || r.dataset.c === state.c) &&
        words.every(function (w) { return h.indexOf(w) !== -1; });
      r.hidden = !ok;
      if (ok) shown++;
    });
    var all = total.toLocaleString("en-US");
    count.textContent = shown === total ? all + " guides" : shown.toLocaleString("en-US") + " of " + all + " guides";
    none.hidden = shown !== 0;
    table.hidden = shown === 0;
    buttons.forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.c === state.c)); });
  }

  function order() {
    var key = {
      n: function (r) { return +r.dataset.n; },
      o: function (r) { return +r.dataset.ys || 9999; },
      w: function (r) { return -(+r.dataset.ys || 0); }
    }[state.s];
    var sorted = rows.slice().sort(function (a, b) {
      if (state.s === "t") {
        var d = title.get(a).localeCompare(title.get(b));
        return d || a.dataset.n - b.dataset.n;
      }
      return key(a) - key(b) || a.dataset.n - b.dataset.n;
    });
    var frag = document.createDocumentFragment();
    sorted.forEach(function (r) { frag.appendChild(r); });
    body.appendChild(frag);
  }

  function save() {
    var p = new URLSearchParams();
    if (state.q) p.set("q", state.q);
    if (state.c) p.set("c", state.c);
    if (state.s !== "n") p.set("s", state.s);
    var s = p.toString();
    try { history.replaceState(null, "", location.pathname + (s ? "?" + s : "")); } catch (e) { /* ignore */ }
  }

  var p0 = new URLSearchParams(location.search);
  state.q = p0.get("q") || "";
  state.c = p0.get("c") || "";
  state.s = ["n", "t", "o", "w"].indexOf(p0.get("s")) > -1 ? p0.get("s") : "n";
  q.value = state.q;
  sortSel.value = state.s;
  if (state.s !== "n") order();
  filter();

  var timer;
  q.addEventListener("input", function () {
    state.q = q.value;
    clearTimeout(timer);
    timer = setTimeout(function () { filter(); save(); }, 100);
  });
  sortSel.addEventListener("change", function () { state.s = sortSel.value; order(); save(); });
  buttons.forEach(function (b) {
    b.addEventListener("click", function () { state.c = b.dataset.c; filter(); save(); });
  });
  document.getElementById("clear").addEventListener("click", function () {
    state.q = "";
    state.c = "";
    q.value = "";
    filter(); save(); q.focus();
  });
})();
