(function () {
  "use strict";
  var body = document.querySelector("#list tbody");
  var q = document.getElementById("q");
  var sortSel = document.getElementById("s");
  var count = document.getElementById("count");
  var none = document.getElementById("none");
  var table = document.getElementById("list");
  var browse = document.getElementById("browse");
  var panel = document.getElementById("panel");
  var activeBox = document.getElementById("active");
  var metaEl = document.getElementById("facet-meta");
  var pagerTop = document.getElementById("pager-top");
  var pagerBottom = document.getElementById("pager-bottom");
  var heading = document.getElementById("guides-h");
  if (!body || !q) return;

  // The page ships the first PER rows so it stays small and works without JavaScript. The whole list comes from
  // guides.json; only the current page of it is ever drawn.
  var PER = +table.getAttribute("data-per") || 100;
  var VIEWER = table.getAttribute("data-viewer") || "";
  fetch(table.getAttribute("data-src"))
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(start)
    .catch(function () {
      var p = document.createElement("p");
      p.className = "plain";
      p.textContent = "The rest of the list did not load. Reload the page to try again.";
      table.insertAdjacentElement("afterend", p);
    });

  function start(guides) {
  var meta = metaEl ? JSON.parse(metaEl.textContent) : {};
  var kindLabel = {};
  (meta.categories || []).forEach(function (c) { kindLabel[c.slug] = c.label; });

  var NR = "Not recorded";
  var ERAS = ["Before 1900", "1900 to 1949", "1950s", "1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s", "Undated"];
  var SIZES = ["Under 1 MB", "1 to 10 MB", "10 to 50 MB", "50 MB and over"];
  var LENGTHS = ["Under 20 pages", "20 to 49 pages", "50 to 99 pages", "100 to 249 pages", "250 pages and over"];
  var FORMATS = { pdf: "PDF", epub: "EPUB", djvu: "DjVu" };
  var FIND_FROM = 20; // panels with more values than this get a Find box

  // Buttons appear in this order: what it is, where and when, then the rest.
  var DEFS = [
    { k: "c", name: "Kind" }, { k: "d", name: "Document type" }, { k: "i", name: "Industry" },
    { k: "l", name: "Language" }, { k: "f", name: "Format" },
    { k: "g", name: "Region" }, { k: "k", name: "Country" }, { k: "e", name: "Era" },
    { k: "x", name: "Organisation" }, { k: "b", name: "Size" }, { k: "p", name: "Length" }
  ];

  function era(ys) {
    if (!ys) return "Undated";
    if (ys < 1900) return "Before 1900";
    if (ys < 1950) return "1900 to 1949";
    return Math.floor(ys / 10) * 10 + "s";
  }
  function size(b) {
    return !(b > 0) ? NR : b < 1e6 ? SIZES[0] : b < 1e7 ? SIZES[1] : b < 5e7 ? SIZES[2] : SIZES[3];
  }
  function length(p) {
    return !(p > 0) ? NR : p < 20 ? LENGTHS[0] : p < 50 ? LENGTHS[1] : p < 100 ? LENGTHS[2] : p < 250 ? LENGTHS[3] : LENGTHS[4];
  }
  function norm(s) {
    return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  // Sort key for Title and Organization: case, accents and punctuation ignored, numbers in natural order (the collator),
  // Latin-script text first, then Greek, Cyrillic, CJK and the rest, each group alphabetical. No leading article is
  // dropped. make_list_data.py has the same rule (sort_key) and stores guides.json in this order.
  var FOLD = { "ø": "o", "ł": "l", "đ": "d", "ð": "d", "ı": "i", "æ": "ae", "œ": "oe", "ß": "ss", "þ": "th", "ς": "σ" };
  var SCRIPTS = [/\p{Script=Greek}/u, /\p{Script=Cyrillic}/u, /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Bopomofo}]/u];
  function key(s) {
    var t = String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/[øłđðıæœßþς]/g, function (c) { return FOLD[c]; })
      .replace(/['’]/g, "").replace(/[^\p{L}\p{N}\p{M}]+/gu, " ").trim();
    var r = 0, m = t ? t.match(/\p{L}/u) : null; // the script of the first letter; digits alone count as Latin
    if (!t) r = 9;
    else if (m && !/\p{Script=Latin}/u.test(m[0])) {
      r = 4;
      for (var i = 0; i < SCRIPTS.length; i++) if (SCRIPTS[i].test(m[0])) { r = i + 1; break; }
    }
    return { r: r, s: t };
  }

  var total = guides.length;
  var recs = guides.map(function (g, n) {
    var one = function (a) { return g[a] || NR; };
    var many = function (a) {
      var s = g[a];
      if (!s || !s.length) return [NR];
      return (Array.isArray(s) ? s : [s]).filter(function (v, i, a) { return a.indexOf(v) === i; });
    };
    var ys = +g.ys || 0;
    var ext = String(g.u).split(".").pop().toLowerCase();
    var v = {
      c: [one("c")], d: [one("d")], i: [one("i")], l: many("l"), f: [FORMATS[ext] || NR],
      g: [one("g")], k: many("k"), e: [era(ys)], x: [one("x")],
      b: [size(+g.b)], p: [length(+g.p)]
    };
    return { g: g, v: v, n: n, ys: ys, ext: ext, text: norm([g.t, g.o, g.y, g.s].join(" ")), kt: key(g.t), ko: key(g.o), bytes: +g.b > 0 ? +g.b : 0, fail: 0 };
  });
  var ord = recs; // recs in the current sort order
  var matched = []; // the guides that pass every filter, in that order
  var coll = new Intl.Collator("en", { sensitivity: "base", numeric: true });

  function label(k, v) { return k === "c" && kindLabel[v] ? kindLabel[v] : v; }

  // Facet inventory. A facet is offered only when the data gives it at least two real values.
  function tally(k) {
    var m = new Map();
    recs.forEach(function (x) { x.v[k].forEach(function (v) { m.set(v, (m.get(v) || 0) + 1); }); });
    return m;
  }
  function inOrder(m, list) {
    var out = (list || []).filter(function (v) { return m.has(v); });
    m.forEach(function (n, v) { if (v !== NR && out.indexOf(v) < 0) out.push(v); });
    return out;
  }
  function byCount(m) {
    return Array.from(m.keys()).filter(function (v) { return v !== NR; }).sort(function (a, b) {
      return m.get(b) - m.get(a) || label("c", a).localeCompare(label("c", b));
    });
  }

  var facets = [];
  DEFS.forEach(function (d) {
    var m = tally(d.k), vals;
    var real = m.size - (m.has(NR) ? 1 : 0);
    if (real < 2) return;
    if (d.k === "c" || d.k === "l" || d.k === "f") vals = byCount(m);
    else if (d.k === "g") vals = inOrder(m, meta.regions);
    else if (d.k === "d") vals = inOrder(m, meta.documents);
    else if (d.k === "i") vals = inOrder(m, meta.industries);
    else if (d.k === "e") vals = inOrder(m, ERAS);
    else if (d.k === "x") vals = inOrder(m, ["Active", "Defunct"]);
    else if (d.k === "b") vals = inOrder(m, SIZES);
    else if (d.k === "p") vals = inOrder(m, LENGTHS);
    else vals = Array.from(m.keys()).filter(function (v) { return v !== NR; }).sort(function (a, b) { return a.localeCompare(b); });
    if (m.has(NR)) vals.push(NR);
    facets.push({ k: d.k, name: d.name, bit: 1 << facets.length, vals: vals, sel: new Set(), btn: null });
  });
  var byKey = {};
  facets.forEach(function (f) { byKey[f.k] = f; });
  var YEAR = 1 << facets.length;
  var SEARCH = YEAR << 1;

  // The Country panel is grouped under region headings when Region data exists.
  var groups = null;
  if (byKey.k && byKey.g) {
    var of = {};
    recs.forEach(function (x) { if (x.v.g[0] !== NR) x.v.k.forEach(function (c) { if (c !== NR && !of[c]) of[c] = x.v.g[0]; }); });
    groups = byKey.g.vals.filter(function (g) { return g !== NR; }).map(function (g) {
      return { head: g, vals: byKey.k.vals.filter(function (c) { return of[c] === g; }) };
    }).filter(function (g) { return g.vals.length; });
    var rest = byKey.k.vals.filter(function (c) { return !of[c]; });
    if (rest.length) groups.push({ head: "", vals: rest });
  }

  var yearMin = 0, yearMax = 0;
  recs.forEach(function (x) { if (x.ys) { yearMin = yearMin ? Math.min(yearMin, x.ys) : x.ys; yearMax = Math.max(yearMax, x.ys); } });

  var state = { q: "", s: "n", d: 1, yf: null, yt: null, page: 1 }; // s: n, t, y or b; d: 1 ascending, -1 descending
  var open = null;
  var cells = {}; // value -> { btn, n, li } for the open panel
  var yfIn = null, ytIn = null, findIn = null;

  // ---- filtering -------------------------------------------------------------------------
  function run() {
    var words = norm(state.q).split(/\s+/).filter(Boolean);
    matched = [];
    for (var i = 0; i < ord.length; i++) {
      var x = ord[i], fail = 0;
      for (var j = 0; j < facets.length; j++) {
        var f = facets[j];
        if (f.sel.size) {
          var vs = x.v[f.k], hit = false;
          for (var t = 0; t < vs.length; t++) if (f.sel.has(vs[t])) { hit = true; break; }
          if (!hit) fail |= f.bit;
        }
      }
      if ((state.yf !== null || state.yt !== null) &&
          (!x.ys || (state.yf !== null && x.ys < state.yf) || (state.yt !== null && x.ys > state.yt))) fail |= YEAR;
      for (var w = 0; w < words.length; w++) {
        if (x.text.indexOf(words[w]) === -1) { fail |= SEARCH; break; }
      }
      x.fail = fail;
      if (fail === 0) matched.push(x);
    }
    return matched.length;
  }

  function anyFilter() {
    return state.yf !== null || state.yt !== null || facets.some(function (f) { return f.sel.size; });
  }

  // A value's count is the number of guides that have it and pass every other filter, the year range and the search.
  function paintCounts() {
    if (open === null) return;
    var f = facets[open], n = {}, k = f.k, skip = ~f.bit;
    for (var i = 0; i < recs.length; i++) {
      var x = recs[i];
      if ((x.fail & skip) === 0) {
        var vs = x.v[k];
        for (var j = 0; j < vs.length; j++) n[vs[j]] = (n[vs[j]] || 0) + 1;
      }
    }
    f.vals.forEach(function (v) {
      var c = cells[v], m = n[v] || 0, on = f.sel.has(v);
      c.n.textContent = m.toLocaleString("en-US");
      c.btn.setAttribute("aria-pressed", String(on));
      c.btn.classList.toggle("dim", m === 0 && !on);
    });
  }

  function yearText() {
    if (state.yf !== null && state.yt !== null) return state.yf + " to " + state.yt;
    return state.yf !== null ? "From " + state.yf : "Up to " + state.yt;
  }

  function paintActive() {
    var items = [];
    facets.forEach(function (f) {
      f.vals.forEach(function (v) { if (f.sel.has(v)) items.push([f.k, v, label(f.k, v)]); });
      if (f.k === "e" && (state.yf !== null || state.yt !== null)) items.push(["y", "", yearText()]);
    });
    if (!byKey.e && (state.yf !== null || state.yt !== null)) items.push(["y", "", yearText()]);
    activeBox.textContent = "";
    activeBox.hidden = items.length === 0;
    if (!items.length) return;
    var frag = document.createDocumentFragment();
    items.forEach(function (it) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.dataset.f = it[0];
      b.dataset.v = it[1];
      b.appendChild(document.createTextNode(it[2] + " "));
      var x = document.createElement("span");
      x.setAttribute("aria-hidden", "true");
      x.textContent = "×";
      b.appendChild(x);
      var sr = document.createElement("span");
      sr.className = "sr";
      sr.textContent = ", remove filter";
      b.appendChild(sr);
      frag.appendChild(b);
    });
    var all = document.createElement("button");
    all.type = "button";
    all.className = "chip all";
    all.id = "clear-all";
    all.textContent = "Clear all";
    frag.appendChild(all);
    activeBox.appendChild(frag);
  }

  // ---- rows and pages ---------------------------------------------------------------------
  var fmt = function (n) { return n.toLocaleString("en-US"); };
  var note = document.createElement("span"); // "Page 3 of 12", read out by the status region
  note.className = "sr";
  var countText = document.createTextNode("");
  count.textContent = "";
  count.appendChild(countText);
  count.appendChild(note);

  function rowFor(x) {
    var g = x.g, tr = document.createElement("tr");
    tr.dataset.n = x.n;
    tr.dataset.ys = x.ys;
    var cell = function (cls, text) { var td = document.createElement("td"); td.className = cls; td.textContent = text; tr.appendChild(td); return td; };
    var a = document.createElement("a");
    a.target = "_blank";
    a.rel = "noopener";
    a.href = x.ext === "pdf" ? VIEWER + "?file=" + encodeURIComponent(g.u) : g.u;
    a.textContent = g.t;
    cell("t", "").appendChild(a);
    cell("o", g.o);
    cell("y", g.y);
    cell("s", g.s);
    return tr;
  }
  function paintRows() {
    var from = (state.page - 1) * PER;
    var frag = document.createDocumentFragment();
    matched.slice(from, from + PER).forEach(function (x) { frag.appendChild(rowFor(x)); });
    body.textContent = "";
    body.appendChild(frag);
  }

  // Page numbers to show: first, last, the current page and two either side (one on a phone); a gap of one page is shown, not dotted.
  var narrowQ = window.matchMedia("(max-width:720px)");
  function pageList(pages) {
    var out = [], last = 0;
    for (var p = 1; p <= pages; p++) {
      if (p === 1 || p === pages || Math.abs(p - state.page) <= (narrowQ.matches ? 1 : 2)) {
        if (p - last === 2) out.push(last + 1);
        else if (p - last > 2) out.push(0);
        out.push(p);
        last = p;
      }
    }
    return out;
  }
  function item(ul, node) { var li = document.createElement("li"); li.appendChild(node); ul.appendChild(li); return li; }
  function pageLink(p, text, hidden) {
    var a = document.createElement("a");
    a.href = location.pathname + (query(p) ? "?" + query(p) : "");
    a.dataset.p = p;
    if (hidden) a.appendChild(document.createTextNode(text));
    else {
      var sr = document.createElement("span");
      sr.className = "sr";
      sr.textContent = "Page ";
      a.appendChild(sr);
      a.appendChild(document.createTextNode(text));
    }
    return a;
  }
  function paintPager(box, which, shown, pages) {
    box.textContent = "";
    box.hidden = pages < 2;
    if (pages < 2) return;
    var nav = document.createElement("nav");
    nav.className = "pager";
    nav.setAttribute("aria-label", "Pagination, " + which);
    var from = (state.page - 1) * PER + 1, to = Math.min(shown, state.page * PER);
    var p = document.createElement("p");
    p.textContent = "Showing " + fmt(from) + " to " + fmt(to) + " of " + fmt(shown) + " guides";
    nav.appendChild(p);
    var ul = document.createElement("ul");
    var edge = function (n, text, cls) {
      var node;
      if (n < 1 || n > pages) { node = document.createElement("span"); node.textContent = text; node.setAttribute("aria-hidden", "true"); }
      else node = pageLink(n, text, true);
      if (n < 1 || n > pages) node.className = "dis";
      item(ul, node).className = cls;
    };
    edge(state.page - 1, "Previous", "prev");
    pageList(pages).forEach(function (n) {
      var li;
      if (n === 0) {
        var gap = document.createElement("span");
        gap.textContent = "…";
        gap.setAttribute("aria-hidden", "true");
        li = item(ul, gap);
        li.className = "gap";
      } else if (n === state.page) {
        var cur = document.createElement("span");
        cur.setAttribute("aria-current", "page");
        var sr = document.createElement("span");
        sr.className = "sr";
        sr.textContent = "Page ";
        cur.appendChild(sr);
        cur.appendChild(document.createTextNode(n));
        li = item(ul, cur);
      } else {
        li = item(ul, pageLink(n, String(n), false));
      }
    });
    edge(state.page + 1, "Next", "next");
    nav.appendChild(ul);
    box.appendChild(nav);
  }

  // Returns true when the requested page was past the last one and was moved back to it.
  function update(keepPage) {
    var shown = run();
    var pages = Math.max(1, Math.ceil(shown / PER)), clamped = false;
    if (!keepPage) state.page = 1;
    else if (state.page > pages) { state.page = pages; clamped = true; }
    var all = fmt(total);
    countText.nodeValue = shown === total ? all + " guides" : fmt(shown) + " of " + all + " guides";
    note.textContent = "";
    none.hidden = shown !== 0;
    table.hidden = shown === 0;
    document.getElementById("clear").textContent = anyFilter() ? "Clear all" : "Clear search";
    paintRows();
    paintPager(pagerTop, "top", shown, pages);
    paintPager(pagerBottom, "bottom", shown, pages);
    lastPages = pages;
    paintCounts();
    paintActive();
    paintSort();
    return clamped;
  }
  var lastPages = 1;

  // A page change from the pager: new address, back to the top of the table, focus on its heading, one announcement.
  function goPage(n) {
    state.page = n;
    update(true);
    save(true);
    note.textContent = "Page " + state.page + " of " + lastPages;
    pagerTop.scrollIntoView();
    heading.focus({ preventScroll: true });
  }
  narrowQ.addEventListener("change", function () { paintPager(pagerTop, "top", matched.length, lastPages); paintPager(pagerBottom, "bottom", matched.length, lastPages); });
  function onPager(e) {
    var a = e.target.closest("a[data-p]");
    if (!a || e.button || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    goPage(+a.dataset.p);
  }
  pagerTop.addEventListener("click", onPager);
  pagerBottom.addEventListener("click", onPager);

  // ---- panel -----------------------------------------------------------------------------
  function valueButton(f, v) {
    var li = document.createElement("li");
    var b = document.createElement("button");
    b.type = "button";
    b.dataset.v = v;
    b.setAttribute("aria-pressed", "false");
    b.appendChild(document.createTextNode(label(f.k, v) + " "));
    var n = document.createElement("span");
    n.className = "n";
    b.appendChild(n);
    li.appendChild(b);
    cells[v] = { btn: b, n: n, li: li, text: norm(label(f.k, v)) };
    return li;
  }
  function list(f, vals) {
    var ul = document.createElement("ul");
    vals.forEach(function (v) { ul.appendChild(valueButton(f, v)); });
    return ul;
  }

  function field(text, input) {
    var l = document.createElement("label");
    l.className = "field";
    var s = document.createElement("span");
    s.textContent = text;
    l.appendChild(s);
    l.appendChild(input);
    return l;
  }
  function numberInput(ph) {
    var i = document.createElement("input");
    i.type = "number";
    i.inputMode = "numeric";
    i.min = "0";
    i.max = "9999";
    i.placeholder = ph ? String(ph) : "";
    return i;
  }
  function syncYears() {
    if (yfIn) yfIn.value = state.yf === null ? "" : state.yf;
    if (ytIn) ytIn.value = state.yt === null ? "" : state.yt;
  }

  function narrow() {
    var w = norm(findIn.value).trim();
    var f = facets[open];
    f.vals.forEach(function (v) {
      var c = cells[v], ok = !w || c.text.indexOf(w) !== -1;
      c.li.hidden = !ok;
    });
    panel.querySelectorAll("ul").forEach(function (ul) {
      var seen = ul.querySelector("li:not([hidden])");
      ul.hidden = !seen;
      if (ul.previousElementSibling && ul.previousElementSibling.tagName === "H2") ul.previousElementSibling.hidden = !seen;
    });
  }

  function setOpen(i) {
    open = i;
    cells = {};
    yfIn = ytIn = findIn = null;
    panel.textContent = "";
    facets.forEach(function (f, j) { f.btn.setAttribute("aria-expanded", String(j === i)); });
    if (i === null) { panel.hidden = true; return; }
    var f = facets[i];
    panel.setAttribute("aria-label", f.name);
    var frag = document.createDocumentFragment();
    if (f.k === "e") {
      yfIn = numberInput(yearMin);
      ytIn = numberInput(yearMax);
      var yr = document.createElement("div");
      yr.className = "years";
      yr.appendChild(field("From year", yfIn));
      yr.appendChild(field("To year", ytIn));
      frag.appendChild(yr);
      syncYears();
    }
    if (f.vals.length > FIND_FROM) {
      findIn = document.createElement("input");
      findIn.type = "search";
      findIn.autocomplete = "off";
      findIn.spellcheck = false;
      var fl = field("Find", findIn);
      fl.classList.add("find");
      frag.appendChild(fl);
    }
    if (f.k === "k" && groups) {
      groups.forEach(function (g) {
        if (g.head) {
          var h = document.createElement("h2");
          h.textContent = g.head;
          frag.appendChild(h);
        }
        frag.appendChild(list(f, g.vals));
      });
    } else {
      frag.appendChild(list(f, f.vals));
    }
    panel.appendChild(frag);
    panel.hidden = false;
    paintCounts();
  }

  facets.forEach(function (f, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = f.name;
    b.setAttribute("aria-expanded", "false");
    b.setAttribute("aria-controls", "panel");
    b.addEventListener("click", function () { setOpen(open === i ? null : i); });
    f.btn = b;
  });
  if (facets.length) {
    var lab = document.createElement("span");
    lab.className = "lbl";
    lab.textContent = "Browse by";
    browse.appendChild(lab);
    // Two lines by sense: what the guide is, then where and when it is and the rest.
    var lines = [document.createElement("div"), document.createElement("div")];
    facets.forEach(function (f) { lines["cdilf".indexOf(f.k) > -1 ? 0 : 1].appendChild(f.btn); });
    lines.forEach(function (l) { if (l.children.length) { l.className = "line"; browse.appendChild(l); } });
  } else {
    browse.hidden = true;
  }

  panel.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-v]");
    if (!b || open === null) return;
    var f = facets[open], v = b.dataset.v;
    if (f.sel.has(v)) f.sel.delete(v); else f.sel.add(v);
    update(); save(true);
  });
  panel.addEventListener("input", function (e) {
    if (e.target === findIn) { narrow(); return; }
    if (e.target === yfIn || e.target === ytIn) {
      clearTimeout(yTimer);
      yTimer = setTimeout(function () {
        state.yf = yearOf(yfIn.value);
        state.yt = yearOf(ytIn.value);
        update(); save(false);
      }, 200);
    }
  });
  function closeOnEsc(e) {
    if (e.key === "Escape" && open !== null) { var b = facets[open].btn; setOpen(null); b.focus(); }
  }
  panel.addEventListener("keydown", closeOnEsc);
  browse.addEventListener("keydown", closeOnEsc);
  var yTimer;
  function yearOf(s) {
    return /^\d{1,4}$/.test(String(s).trim()) ? +s : null;
  }

  activeBox.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    var chips = Array.prototype.slice.call(activeBox.querySelectorAll(".chip:not(.all)"));
    if (b.id === "clear-all") {
      clearFilters();
      update(); save(true);
      if (facets.length) facets[0].btn.focus();
      return;
    }
    var at = chips.indexOf(b);
    if (b.dataset.f === "y") { state.yf = state.yt = null; syncYears(); }
    else byKey[b.dataset.f].sel.delete(b.dataset.v);
    update(); save(true);
    var left = activeBox.querySelectorAll(".chip:not(.all)");
    var next = left[Math.min(at, left.length - 1)];
    (next || (facets[0] && facets[0].btn) || q).focus();
  });

  function clearFilters() {
    facets.forEach(function (f) { f.sel.clear(); });
    state.yf = state.yt = null;
    syncYears();
  }

  // ---- sort ------------------------------------------------------------------------------
  // Ties fall back to Title, then Organization, then archive order, in both directions; undated years and
  // unrecorded sizes go last whichever way the column runs.
  var SORTS = { n: "Organization", t: "Title", y: "Year", b: "Size" };
  var SLUG = { n: "organization", t: "title", y: "year", b: "size" };
  var LEGACY = { n: ["n", 1], t: ["t", 1], o: ["y", 1], w: ["y", -1] }; // the old ?s= values
  var tc = function (a, b) { return a.r - b.r || coll.compare(a.s, b.s); };
  function order() {
    var s = state.s, d = state.d;
    ord = recs.slice().sort(function (a, b) {
      var c;
      if (s === "n" || s === "t") {
        var x = s === "n" ? a.ko : a.kt, y = s === "n" ? b.ko : b.kt;
        if ((x.r === 9) !== (y.r === 9)) return x.r === 9 ? 1 : -1; // nothing to sort on goes last either way
        c = d * tc(x, y);
      } else {
        var u = s === "y" ? a.ys : a.bytes, v = s === "y" ? b.ys : b.bytes;
        if (!u !== !v) return u ? -1 : 1; // undated or unrecorded goes last either way
        c = u && v ? d * (u - v) : 0;
      }
      return c || tc(a.kt, b.kt) || tc(a.ko, b.ko) || a.n - b.n;
    });
  }
  var heads = {}, dirBtn = document.createElement("button");
  dirBtn.type = "button";
  dirBtn.id = "dir";
  sortSel.closest("label").insertAdjacentElement("afterend", dirBtn);
  Array.prototype.forEach.call(table.tHead.rows[0].cells, function (th, i) {
    var k = "tnyb"[i];
    if (!k) return;
    var b = document.createElement("button");
    b.type = "button";
    b.dataset.k = k;
    b.appendChild(document.createTextNode(th.textContent));
    var mark = document.createElement("span");
    mark.setAttribute("aria-hidden", "true");
    mark.className = "ar";
    b.appendChild(mark);
    th.textContent = "";
    th.appendChild(b);
    heads[k] = { th: th, mark: mark };
  });
  function sortText() { return SORTS[state.s] + ", " + (state.d > 0 ? "ascending" : "descending"); }
  function paintSort() {
    sortSel.value = state.s;
    dirBtn.textContent = state.d > 0 ? "Ascending " : "Descending ";
    var ar = document.createElement("span");
    ar.className = "ar";
    ar.textContent = state.d > 0 ? "↑" : "↓";
    dirBtn.appendChild(ar);
    dirBtn.setAttribute("aria-label", "Sort direction: " + (state.d > 0 ? "ascending" : "descending") + ". Switch.");
    Object.keys(heads).forEach(function (k) {
      var on = k === state.s;
      heads[k].th.setAttribute("aria-sort", on ? (state.d > 0 ? "ascending" : "descending") : "none");
      heads[k].mark.textContent = on ? (state.d > 0 ? " ↑" : " ↓") : "";
    });
  }
  // A change of sort: new order, back to page 1, address replaced, one announcement.
  function setSort(key, dir) {
    state.s = key; state.d = dir;
    order(); update(); save(false);
    note.textContent = "Sorted by " + sortText();
  }

  // ---- URL state -------------------------------------------------------------------------
  // ?q=rail&g=Europe&k=Poland,Czechia&e=1970s&yf=1960&yt=1980&s=t   Values are percent-encoded one by one, so a
  // comma inside a value never splits it.
  function query(page) {
    var p = [];
    if (page === undefined) page = state.page;
    if (state.q) p.push("q=" + encodeURIComponent(state.q));
    facets.forEach(function (f) {
      if (f.sel.size) p.push(f.k + "=" + f.vals.filter(function (v) { return f.sel.has(v); }).map(encodeURIComponent).join(","));
    });
    if (state.yf !== null) p.push("yf=" + state.yf);
    if (state.yt !== null) p.push("yt=" + state.yt);
    if (state.s !== "n") p.push("sort=" + SLUG[state.s]);
    if (state.d < 0) p.push("dir=desc");
    if (page > 1) p.push("page=" + page);
    return p.join("&");
  }
  // Filters push a history entry so Back undoes them; typing and sorting replace the current one.
  function save(push) {
    var s = query();
    if (s === location.search.replace(/^\?/, "")) return;
    try { history[push ? "pushState" : "replaceState"](null, "", location.pathname + (s ? "?" + s : "")); } catch (e) { /* ignore */ }
  }
  function dec(s) {
    try { return decodeURIComponent(s.replace(/\+/g, " ")); } catch (e) { return null; }
  }
  // Reads the address into state. Anything unknown or malformed is skipped; returns true when something was.
  function read() {
    var bad = false, seen = {};
    state.q = ""; state.s = "n"; state.d = 1; state.yf = state.yt = null; state.page = 1;
    facets.forEach(function (f) { f.sel.clear(); });
    location.search.replace(/^\?/, "").split("&").forEach(function (part) {
      if (!part) return;
      var at = part.indexOf("=");
      var key = dec(at < 0 ? part : part.slice(0, at)), raw = at < 0 ? "" : part.slice(at + 1);
      if (key === null || seen[key]) { bad = true; return; }
      seen[key] = true;
      if (key === "q") {
        var t = dec(raw);
        if (t === null) bad = true; else state.q = t;
      } else if (key === "s") {
        if (LEGACY[raw]) { state.s = LEGACY[raw][0]; state.d = LEGACY[raw][1]; } else bad = true;
      } else if (key === "sort") {
        var sk = Object.keys(SLUG).filter(function (k) { return SLUG[k] === raw; })[0];
        if (sk) { state.s = sk; } else bad = true;
      } else if (key === "dir") {
        if (raw === "asc" || raw === "desc") { state.d = raw === "desc" ? -1 : 1; } else bad = true;
      } else if (key === "page") {
        if (/^[1-9]\d{0,6}$/.test(raw)) state.page = +raw; else bad = true;
      } else if (key === "yf" || key === "yt") {
        if (/^\d{1,4}$/.test(raw)) state[key] = +raw; else bad = true;
      } else if (DEFS.some(function (d) { return d.k === key; })) {
        var f = byKey[key];
        if (!f) { bad = true; return; }
        raw.split(",").forEach(function (piece) {
          var v = dec(piece);
          if (v !== null && f.vals.indexOf(v) > -1) f.sel.add(v); else bad = true;
        });
      }
    });
    q.value = state.q;
    sortSel.value = state.s;
    syncYears();
    return bad;
  }

  var dirty = read();
  order();
  if (update(true) || dirty) save(false);

  window.addEventListener("popstate", function () { read(); order(); update(true); });

  var timer;
  q.addEventListener("input", function () {
    state.q = q.value;
    clearTimeout(timer);
    timer = setTimeout(function () { update(); save(false); }, 100);
  });
  sortSel.addEventListener("change", function () { setSort(sortSel.value, state.d); });
  dirBtn.addEventListener("click", function () { setSort(state.s, -state.d); });
  table.tHead.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-k]");
    if (!b) return;
    setSort(b.dataset.k, b.dataset.k === state.s ? -state.d : 1);
    b.focus();
  });
  document.getElementById("clear").addEventListener("click", function () {
    state.q = "";
    q.value = "";
    clearFilters();
    update(); save(true); q.focus();
  });
  } // start
})();
