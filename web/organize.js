/* Organizing lessons and problems: your own folders, hiding, moving. Plus the Collection screen (a file manager). */

/* ---------- small UI helpers ---------- */
function popMenu(anchor, entries, point) {
  document.querySelectorAll(".menu").forEach((m) => m.remove());
  const m = h("div", { class: "menu", role: "menu" });
  for (const e of entries) {
    if (e.sep) m.append(h("hr"));
    else if (e.head) m.append(h("div", { class: "mh" }, e.label));
    else {
      const b = h("button", { role: "menuitem", disabled: e.disabled ? true : undefined, onclick: () => { close(); e.fn && e.fn(); } },
        h("span", { class: "mk" }, e.check ? "✓" : ""), h("span", { class: "ml" }, e.label), e.kbd ? h("kbd", {}, e.kbd) : null);
      if (e.depth) b.style.paddingLeft = 12 + e.depth * 16 + "px";
      m.append(b);
    }
  }
  document.body.append(m);
  const r = anchor.getBoundingClientRect(), x = point ? point.clientX : r.left, y = point ? point.clientY : r.bottom + 2;
  m.style.left = Math.max(8, Math.min(x, innerWidth - m.offsetWidth - 8)) + "px";
  m.style.top = Math.max(8, Math.min(y, innerHeight - m.offsetHeight - 8)) + "px";
  const close = () => { m.remove(); document.removeEventListener("pointerdown", away, true); document.removeEventListener("keydown", esc, true); };
  const away = (ev) => { if (!m.contains(ev.target)) close(); };
  const esc = (ev) => { if (ev.key === "Escape") close(); };
  setTimeout(() => { document.addEventListener("pointerdown", away, true); document.addEventListener("keydown", esc, true); });
}

function askText(title, value = "", okLabel = "Save") {
  return new Promise((res) => {
    const inp = h("input", { type: "text", value, class: "fx-input" });
    let box;
    const done = (v) => { box.close(v); };
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") done(inp.value.trim() || null); });
    box = Retro.win({ title, width: 400, icon: Retro.sprite("folder", 18), body: inp, onClose: (v) => res(v === undefined ? null : v),
      buttons: [{ label: okLabel, primary: true, fn: () => inp.value.trim() || null }, { label: "Cancel", fn: () => null }] });
    setTimeout(() => { inp.focus(); inp.select(); }, 30);
  });
}

/* ---------- the data model ---------- */
const Org = (() => {
  const data = (kind) => ((D.org ||= {})[kind] ||= { folders: [], assign: {}, hidden: [] });
  let orgPending = false;
  const persist = debounce(() => { orgPending = false; api("organize", { org: D.org }).catch(() => {}); }, 300);
  let seq = 0;
  const changed = () => { orgPending = true; persist(); App.refreshLists(); App.queueSync && App.queueSync(); };

  function items(kind) {
    const meta = (id) => { const m = (data(kind).itemMeta || {})[id] || {}; return { icon: m.icon || "", color: m.color || "", pinned: !!m.pinned }; };   // view-only icon overrides and pins
    if (kind === "lessons") return D.courses.flatMap((c) => c.lessons.map((l) => ({ id: l.id, title: l.title, auto: [c.title], ref: l, ...meta(l.id) })));
    return D.modules.flatMap((m) => m.problems.map((p) => {
      const g = m.groups.find((x) => x.id === p.group);
      const auto = !g || g.id === "_default" || g.title === m.title ? [m.title] : [m.title, g.title];
      return { id: p.iid, title: `${p.id}  ${p.title}`, auto, ref: p, ...meta(p.iid) };
    }));
  }
  const isHidden = (kind, id) => data(kind).hidden.includes(id);
  const count = (n) => n.items.length + n.children.reduce((a, c) => a + count(c), 0);

  function tree(kind, o = {}) {
    const d = data(kind), all = items(kind), ids = new Set(d.folders.map((f) => f.id));
    const ok = (it) => (o.hiddenOnly ? isHidden(kind, it.id) : !isHidden(kind, it.id)) && (!o.pred || o.pred(it));
    const am = d.autoMeta || {}, attach = {};            // am: view-only icon/color/parent overrides for built-in folders
    const mk = (f) => ({ id: f.id, name: f.name, icon: f.icon || "", color: f.color || "", pinned: !!f.pinned, auto: false, items: all.filter((it) => d.assign[it.id] === f.id && ok(it)), children: [...d.folders.filter((c) => c.parent === f.id).map(mk), ...(attach[f.id] || [])] });
    const autos = [];
    for (const it of all) {
      if (ids.has(d.assign[it.id]) || !ok(it)) continue;
      let level = autos, node = null, path = "auto";
      for (const nm of it.auto) {
        path += "/" + nm; node = level.find((x) => x.name === nm);
        if (!node) { const m = am[path] || {}; node = { id: path, name: nm, auto: true, icon: m.icon || "", color: m.color || "", items: [], children: [] }; level.push(node); }
        level = node.children;
      }
      node.items.push(it);
    }
    // built-in folders you nested under one of your own folders are lifted out of their place and attached there
    const detach = (list) => list.filter((n) => { n.children = detach(n.children); const p = (am[n.id] || {}).parent; if (p && ids.has(p)) { (attach[p] ||= []).push(n); return false; } return true; });
    const rootAutos = detach(autos);
    const roots = d.folders.filter((f) => !f.parent || !ids.has(f.parent)).map(mk);
    const prune = (list) => list.map((n) => ({ ...n, children: prune(n.children) })).filter((n) => o.keepEmpty || count(n) > 0);
    return prune([...roots, ...rootAutos]);
  }

  const hiddenItems = (kind) => items(kind).filter((it) => isHidden(kind, it.id));
  const isAutoId = (id) => typeof id === "string" && id.startsWith("auto");
  const cleanMeta = (m) => { for (const k of Object.keys(m)) if (m[k] === "" || m[k] == null || m[k] === false) delete m[k]; };
  function setAutoMeta(kind, id, patch) {
    const d = data(kind), m = ((d.autoMeta ||= {})[id] ||= {});
    Object.assign(m, patch); cleanMeta(m); if (!Object.keys(m).length) delete d.autoMeta[id]; changed();
  }
  function setItemMeta(kind, id, patch) {
    const d = data(kind), m = ((d.itemMeta ||= {})[id] ||= {});
    Object.assign(m, patch); cleanMeta(m); if (!Object.keys(m).length) delete d.itemMeta[id]; changed();
  }
  const BAD = new Set(["__proto__", "constructor", "prototype"]);
  const str = (v, n = 16) => (typeof v === "string" ? v.slice(0, n) : "");
  const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
  /* Layout files come from outside the app, so every field is checked and cleaned before it is used. */
  function cleanKind(x) {
    const out = { folders: [], assign: {}, hidden: [], autoMeta: {}, itemMeta: {} };
    if (!x || typeof x !== "object") return out;
    const byId = new Map();
    for (const f of Array.isArray(x.folders) ? x.folders : []) {
      if (!f || typeof f.id !== "string" || !f.id || f.id.length > 40 || BAD.has(f.id) || typeof f.name !== "string" || byId.has(f.id)) continue;
      const c = { id: f.id, name: f.name.slice(0, 120), parent: typeof f.parent === "string" ? f.parent : null };
      if (str(f.icon)) c.icon = str(f.icon);
      if (str(f.color)) c.color = str(f.color);
      if (f.pinned === true) c.pinned = true;
      byId.set(c.id, c); out.folders.push(c);
    }
    for (const f of out.folders) if (f.parent && !byId.has(f.parent)) f.parent = null;
    for (const f of out.folders) {                       // break loops so every folder can be reached from the top
      const seen = new Set([f.id]); let p = f.parent;
      while (p) { if (seen.has(p)) { f.parent = null; break; } seen.add(p); p = byId.get(p).parent; }
    }
    for (const [k, v] of Object.entries(obj(x.assign))) if (!BAD.has(k) && typeof v === "string" && byId.has(v)) out.assign[k] = v;
    out.hidden = [...new Set((Array.isArray(x.hidden) ? x.hidden : []).filter((s) => typeof s === "string" && s.length <= 200))];
    for (const [k, v0] of Object.entries(obj(x.autoMeta))) {
      if (BAD.has(k) || !k.startsWith("auto")) continue;
      const v = obj(v0), m = {};
      if (str(v.icon)) m.icon = str(v.icon);
      if (str(v.color)) m.color = str(v.color);
      if (typeof v.parent === "string" && byId.has(v.parent)) m.parent = v.parent;
      if (Object.keys(m).length) out.autoMeta[k] = m;
    }
    for (const [k, v0] of Object.entries(obj(x.itemMeta))) {
      if (BAD.has(k)) continue;
      const v = obj(v0), m = {};
      if (str(v.icon)) m.icon = str(v.icon);
      if (str(v.color)) m.color = str(v.color);
      if (v.pinned === true) m.pinned = true;
      if (Object.keys(m).length) out.itemMeta[k] = m;
    }
    return out;
  }
  function mergeKind(a, b) {                           // yours wins wherever both have an opinion
    const o = cleanKind(a), n = cleanKind(b), have = new Set(o.folders.map((f) => f.id));
    n.folders.forEach((f) => { if (!have.has(f.id)) o.folders.push(f); });
    for (const [k, v] of Object.entries(n.assign)) if (!(k in o.assign)) o.assign[k] = v;
    o.hidden = [...new Set([...o.hidden, ...n.hidden])];
    for (const key of ["autoMeta", "itemMeta"]) for (const [k, v] of Object.entries(n[key])) o[key][k] = { ...v, ...(o[key][k] || {}) };
    return cleanKind(o);
  }
  function summarizeLayout(raw) {
    let folders = 0, hidden = 0, meta = 0;
    for (const k of ["lessons", "problems"]) { const c = cleanKind(obj(raw)[k]); folders += c.folders.length; hidden += c.hidden.length; meta += Object.keys(c.autoMeta).length + Object.keys(c.itemMeta).length; }
    return { folders, hidden, meta };
  }
  const exportLayout = () => { const o = D.org || {}; return { app: "cs11-judge-layout", version: 1, exported: new Date().toISOString(), lessons: cleanKind(o.lessons), problems: cleanKind(o.problems) }; };
  function importLayout(raw, mode) {
    const org = (D.org ||= {});
    for (const k of ["lessons", "problems"]) org[k] = mode === "merge" ? mergeKind(org[k], obj(raw)[k]) : cleanKind(obj(raw)[k]);
    changed();
  }
  function restoreLayout(snap) { D.org = snap; changed(); }
  const userFolders = (kind) => {                      // flat list in tree order, with depth
    const d = data(kind), ids = new Set(d.folders.map((f) => f.id)), out = [];
    const walk = (parent, depth) => d.folders.filter((f) => (parent ? f.parent === parent : !f.parent || !ids.has(f.parent))).forEach((f) => { out.push({ ...f, depth }); walk(f.id, depth + 1); });
    walk(null, 0); return out;
  };
  const descendants = (kind, id) => { const d = data(kind), out = new Set([id]); let grew = true; while (grew) { grew = false; for (const f of d.folders) if (out.has(f.parent) && !out.has(f.id)) { out.add(f.id); grew = true; } } return out; };

  return {
    items, tree, count, hiddenItems, userFolders, isHidden,
    folderOf: (kind, id) => data(kind).assign[id] || null,
    createFolder(kind, name, parent = null) { const f = { id: "f" + Date.now().toString(36) + seq++, name, parent }; data(kind).folders.push(f); changed(); return f.id; },
    rename(kind, id, name) { const f = data(kind).folders.find((x) => x.id === id); if (f) { f.name = name; changed(); } },
    removeFolder(kind, id) {
      const d = data(kind), f = d.folders.find((x) => x.id === id); if (!f) return;
      d.folders.forEach((c) => { if (c.parent === id) c.parent = f.parent || null; });
      for (const m of Object.values(d.autoMeta || {})) if (m.parent === id) { if (f.parent) m.parent = f.parent; else delete m.parent; }
      d.folders = d.folders.filter((x) => x.id !== id);
      for (const k of Object.keys(d.assign)) if (d.assign[k] === id) delete d.assign[k];
      changed();
    },
    setItemMeta, exportLayout, importLayout, restoreLayout, summarizeLayout,
    moveFolder(kind, id, parent) { if (isAutoId(id)) return setAutoMeta(kind, id, { parent: parent || "" }); const f = data(kind).folders.find((x) => x.id === id); if (f && !descendants(kind, id).has(parent)) { f.parent = parent; changed(); } },
    setFolderMeta(kind, id, patch) { if (isAutoId(id)) return setAutoMeta(kind, id, patch); const f = data(kind).folders.find((x) => x.id === id); if (f) { Object.assign(f, patch); changed(); } },
    descendants,
    assign(kind, itemId, folderId) { const d = data(kind); if (folderId) d.assign[itemId] = folderId; else delete d.assign[itemId]; changed(); },
    setHidden(kind, ids, hide) {
      const d = data(kind), s = new Set(d.hidden);
      ids.forEach((i) => (hide ? s.add(i) : s.delete(i))); d.hidden = [...s]; changed();
    },
    flush() {
      if (!orgPending || !D.org) return;
      orgPending = false;
      beacon("organize", { org: D.org });          // called on pagehide
    },
  };
})();

/* remembers which folders you collapsed, across screens and restarts */
const Closed = (() => {
  const flush = debounce(() => saveCfg({ closed: D.cfg.closed }), 300);
  return {
    has: (k) => (D.cfg.closed || []).includes(k),
    set(k, open) { const s = new Set(D.cfg.closed || []); open ? s.delete(k) : s.add(k); D.cfg.closed = [...s]; flush(); },
  };
})();

/* ---------- side-list rendering shared by Lessons and Judge ---------- */
/* Icons and colors you chose in the Collection (emoji, pixel icons, colors) show up here too. */
const SIDE_SPRITE = { lessons: "book", problems: "terminal" };
const sideColor = (n) => (n && n.color ? " has-c fc-" + n.color : "");
function sideGlyph(it, scope) {                         // lessons and problems only get an icon when you gave them one (or a color)
  if (it.icon) return h("span", { class: "side-gl" }, Retro.folderGlyph(it, 18));
  if (it.color) return h("span", { class: "side-gl" }, Retro.sprite(SIDE_SPRITE[scope] || "book", 18, it.color));
  return null;
}
function renderSideTree(container, nodes, mkItem, scope, depth = 0) {
  for (const n of nodes) {
    const sum = h("summary", { class: sideColor(n).trim() }, Retro.folderGlyph(n, 18), h("span", { class: "side-nm" }, n.name), h("span", { class: "cnt" }, Org.count(n)));
    sum.style.setProperty("--d", depth);
    const key = `side:${scope}:${n.id}`;
    const d = h("details", { class: n.auto ? "auto" : "" }, sum);
    d.open = !Closed.has(key);
    d.addEventListener("toggle", () => Closed.set(key, d.open));
    renderSideTree(d, n.children, mkItem, scope, depth + 1);
    for (const it of n.items) { const el = mkItem(it); el.style.setProperty("--d", depth + 1); d.append(el); }
    container.append(d);
  }
}

/* ---------- the Collection screen: a desktop-style file manager ----------
   Left: a folder tree (Favorites, Lessons, Problems, Hidden).  Middle: the open folder as icons, a list or details.
   Right: a preview pane.  Click selects, double-click opens, right-click for everything else, drag to nest or move. */
const Collection = (() => {
  const HID = "__hidden";
  const KIND = {
    lessons: { label: "Lessons", one: "lesson", many: "lessons", sprite: "book" },
    problems: { label: "Problems", one: "problem", many: "problems", sprite: "terminal" },
  };
  const KINDS = ["lessons", "problems"];
  const lastView = Retro.store.get("fx.last", {});
  let kind = KINDS.includes(lastView.k) ? lastView.k : "lessons", folderId = typeof lastView.id === "string" ? lastView.id : null, query = "";
  let viewMode = Retro.store.get("fx.view", "icons"), sortBy = Retro.store.get("fx.sort", "name"), sortDir = Retro.store.get("fx.dir", 1);
  let pane = Retro.store.get("fx.pane", true);
  let sel = new Set(), anchor = null, lead = null, renaming = null, drag = null;
  let hist = [{ k: kind, id: folderId }], hi = 0, S = null;
  const openSet = new Set(Retro.store.get("fx.open", ["root:lessons", "root:problems"]));
  let trees = {}, locs = {}, hroots = {}, order = [], cur = null;

  const root = () => $("#v-collection");
  const isAuto = (id) => typeof id === "string" && id.startsWith("auto");
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const nat = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
  const persistOpen = () => Retro.store.set("fx.open", [...openSet]);
  const itemGlyph = (it, px) => (it.icon ? Retro.folderGlyph(it, px) : Retro.sprite(KIND[kind].sprite, px, it.color || undefined));
  const inHid = () => typeof folderId === "string" && folderId.startsWith(HID);

  /* Hidden keeps your folder structure: the same tree, but built only from hidden items. Ids are prefixed so they never clash with the main tree. */
  function hiddenRoot(k) {
    const mapH = (n) => ({ ...n, id: HID + "/" + n.id, auto: true, hidden: true, pinned: false, color: n.color || (n.auto ? "" : "lemon"), children: n.children.map(mapH) });
    return { id: HID, name: "Hidden", hidden: true, auto: true, items: [], children: Org.tree(k, { hiddenOnly: true }).map(mapH) };
  }

  /* Zoom for the three panes (sidebar, files, preview). CSS zoom on the pane's content; saved between runs. */
  const STEPS = [0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5];
  const Z = { tree: 1, files: 1, pane: 1, ...Retro.store.get("fx.zoom", {}) };
  function stepZoom(key, dir) {
    if (dir === 0) { Z[key] = 1; return; }
    const i = STEPS.reduce((b, s, j) => (Math.abs(s - Z[key]) < Math.abs(STEPS[b] - Z[key]) ? j : b), 0);
    Z[key] = STEPS[Math.max(0, Math.min(STEPS.length - 1, i + dir))];
  }
  const zoom = (key, dir) => { stepZoom(key, dir); Retro.store.set("fx.zoom", Z); render(); };
  const zoomAll = (dir) => { ["tree", "files", "pane"].forEach((k) => stepZoom(k, dir)); Retro.store.set("fx.zoom", Z); render(); };
  const zctl = (label, key) => h("span", { class: "fx-zg", title: `Zoom ${label.toLowerCase()} (Ctrl + mouse wheel over it)` }, h("small", {}, label),
    h("button", { class: "fx-zb", "aria-label": `Zoom out ${label}`, onclick: () => zoom(key, -1) }, "−"),
    h("button", { class: "fx-zv", title: "Reset to 100%", "aria-label": `${label} zoom, reset`, onclick: () => zoom(key, 0) }, Math.round(Z[key] * 100) + "%"),
    h("button", { class: "fx-zb", "aria-label": `Zoom in ${label}`, onclick: () => zoom(key, 1) }, "+"));

  /* ----- tree helpers ----- */
  const walk = (nodes, fn) => nodes.forEach((n) => { fn(n); walk(n.children, fn); });
  const locate = (nodes, id) => { for (const n of nodes) { if (n.id === id) return n; const f = locate(n.children, id); if (f) return f; } return null; };
  const trail = (nodes, id, t = []) => { for (const n of nodes) { const next = [...t, n]; if (n.id === id) return next; const f = trail(n.children, id, next); if (f.length) return f; } return []; };
  const allItems = (n) => [...n.items, ...n.children.flatMap(allItems)];
  const allIds = (n) => allItems(n).map((i) => i.id);
  const indexLocs = (nodes, path, out) => nodes.forEach((n) => { const p = [...path, n.name]; n.items.forEach((it) => { out[it.id] = p.join(" › "); }); indexLocs(n.children, p, out); });

  function gather() {
    for (const k of KINDS) { trees[k] = Org.tree(k, { keepEmpty: true }); locs[k] = {}; indexLocs(trees[k], [KIND[k].label], locs[k]); hroots[k] = hiddenRoot(k); indexLocs(hroots[k].children, ["Hidden"], locs[k]); }
    cur = resolveCur();
    order = buildOrder();
    const keys = new Set(order.map((e) => e.key));
    sel = new Set([...sel].filter((k) => keys.has(k)));
    if (anchor && !keys.has(anchor)) anchor = null;
  }
  function resolveCur() {
    const nodes = trees[kind];
    if (inHid()) { const r = hroots[kind], n = folderId === HID ? r : locate(r.children, folderId); if (n) return n; folderId = null; }
    if (folderId) { const n = locate(nodes, folderId); if (n) return n; folderId = null; }
    return { id: null, name: KIND[kind].label, children: nodes, items: [], root: true };
  }

  /* ----- progress ----- */
  function prog(it) {
    if (kind === "lessons") {
      const l = it.ref, done = new Set(D.state.done[l.id] || []), n = l.acts.length, got = l.acts.filter((a) => done.has(a)).length;
      return n ? { ratio: got / n, text: `${got}/${n} done`, long: `${got} of ${n} activities done`, full: got === n } : { ratio: null, text: "Reading", long: "Reading only", full: false };
    }
    const p = it.ref, b = D.progress[p.iid];
    if (b === undefined) return { ratio: 0, text: "New", long: `${p.points} pts, not tried`, full: false };
    return { ratio: p.points ? b / p.points : 0, text: `${b}/${p.points}`, long: `${b} of ${p.points} pts`, full: p.points > 0 && b >= p.points };
  }
  function agg(node) {
    const tracked = allItems(node).map(prog).filter((p) => p.ratio !== null);
    return { total: tracked.length, full: tracked.filter((p) => p.full).length, ratio: tracked.length ? tracked.reduce((a, p) => a + p.ratio, 0) / tracked.length : 0 };
  }

  /* ----- what is listed ----- */
  function buildOrder() {
    const q = query.trim().toLowerCase();
    let folders, items;
    if (q) {
      folders = []; walk(trees[kind], (n) => { if (n.name.toLowerCase().includes(q)) folders.push(n); });
      items = Org.items(kind).filter((it) => !Org.isHidden(kind, it.id) && it.title.toLowerCase().includes(q));
    } else { folders = cur.children.slice(); items = cur.items.slice(); }
    folders.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || nat(a.name, b.name) * (sortBy === "name" ? sortDir : 1));
    items.sort((a, b) => (sortBy === "progress" ? ((prog(b).ratio ?? -1) - (prog(a).ratio ?? -1)) * sortDir : nat(a.title, b.title) * sortDir));
    return [...folders.map((n) => ({ key: "f:" + n.id, type: "f", node: n })), ...items.map((it) => ({ key: "i:" + it.id, type: "i", it }))];
  }
  const selEntries = () => order.filter((e) => sel.has(e.key));
  const entryName = (e) => (e.type === "f" ? e.node.name : e.it.title);
  const open = (it) => { if (kind === "lessons") { App.go("lessons"); Lessons.open(it.id); } else { App.go("judge"); Judge.select(it.id); } };

  /* ----- navigation ----- */
  function expandPath() {
    openSet.add("root:" + kind);
    if (inHid()) trail([hroots[kind]], folderId).forEach((n) => openSet.add(`${kind}:${n.id}`));
    else if (folderId) trail(trees[kind], folderId).slice(0, -1).forEach((n) => openSet.add(`${kind}:${n.id}`));
    persistOpen();
  }
  function nav(k, id, noHist) {
    if (!noHist) { hist = hist.slice(0, hi + 1); hist.push({ k, id }); hi = hist.length - 1; }
    kind = k; folderId = id; query = ""; if (S) S.search.value = "";
    Retro.store.set("fx.last", { k, id });
    sel = new Set(); anchor = null; lead = null; renaming = null;
    gather(); expandPath(); render();
  }
  const goHist = (d) => { const n = hi + d; if (n < 0 || n >= hist.length) return; hi = n; nav(hist[n].k, hist[n].id, true); };
  const parentId = () => { if (!folderId || folderId === HID) return null; const t = trail(inHid() ? [hroots[kind]] : trees[kind], folderId); return t.length > 1 ? t[t.length - 2].id : null; };
  const goUp = () => { if (folderId) nav(kind, parentId()); };
  const toggleOpen = (key) => { openSet.has(key) ? openSet.delete(key) : openSet.add(key); persistOpen(); renderTree(); };

  /* ----- actions ----- */
  const unique = (base, names) => { if (!names.includes(base)) return base; let i = 2; while (names.includes(`${base} (${i})`)) i++; return `${base} (${i})`; };
  function newFolder(parentOverride) {
    let parent = parentOverride !== undefined ? parentOverride : (folderId && !inHid() && !isAuto(folderId) ? folderId : null);
    if (parentOverride === undefined && (inHid() || isAuto(folderId))) { nav(kind, null); toast("Folders can only be created in your own space, so this one is at the top level.", ""); }
    const sibs = parent ? (locate(trees[kind], parent)?.children || []) : trees[kind];
    const name = unique("New folder", sibs.map((s) => s.name));
    const id = Org.createFolder(kind, name, parent);
    if (parent) { openSet.add(`${kind}:${parent}`); persistOpen(); }
    if ((parent || null) !== (folderId || null)) { folderId = parent; hist = hist.slice(0, hi + 1); hist.push({ k: kind, id: parent }); hi = hist.length - 1; }
    query = ""; S.search.value = "";
    gather(); sel = new Set(["f:" + id]); anchor = lead = "f:" + id; renaming = "f:" + id; render();
  }
  function startRename(e) { if (e.type !== "f" || e.node.auto) return; sel = new Set([e.key]); anchor = lead = e.key; renaming = e.key; render(); }
  function renameInput(node) {
    const inp = h("input", { class: "fx-rename", type: "text", value: node.name, "aria-label": "Folder name" });
    let done = false;
    const commit = (v) => { if (done) return; done = true; renaming = null; v = v.trim(); if (v && v !== node.name) Org.rename(kind, node.id, v); else render(); };
    inp.addEventListener("keydown", (ev) => { ev.stopPropagation(); if (ev.key === "Enter") commit(inp.value); else if (ev.key === "Escape") commit(node.name); });
    inp.addEventListener("blur", () => commit(inp.value));
    for (const t of ["click", "dblclick", "pointerdown", "dragstart"]) inp.addEventListener(t, (ev) => ev.stopPropagation());
    setTimeout(() => { inp.focus(); inp.select(); }, 0);
    return inp;
  }
  function hideEntries(es) {
    const ids = es.flatMap((e) => (e.type === "i" ? [e.it.id] : allIds(e.node)));
    if (!ids.length) return toast("There is nothing in there to hide.", "");
    const k = kind; Org.setHidden(k, ids, true);
    toast(`Hid ${plural(ids.length, KIND[k].one, KIND[k].many)}. Find ${ids.length === 1 ? "it" : "them"} in Hidden.`, "ok", { label: "Undo", fn: () => Org.setHidden(k, ids, false) });
  }
  function restoreEntries(es) { Org.setHidden(kind, es.flatMap((e) => (e.type === "i" ? [e.it.id] : allIds(e.node))), false); }
  async function deleteFolders(es) {
    const fs = es.filter((e) => e.type === "f" && !e.node.auto);
    if (!fs.length) return;
    const msg = fs.length === 1 ? `Delete the folder “${fs[0].node.name}”? What is inside goes back to where it was; nothing is deleted from your lessons or problems.` : `Delete ${fs.length} folders? What is inside goes back to where it was; nothing is deleted.`;
    if (!(await Retro.confirmBox("Delete folder", msg, "Delete", true))) return;
    const gone = new Set(fs.map((e) => e.node.id)), wasHere = folderId && trail(trees[kind], folderId).some((n) => gone.has(n.id));
    if (wasHere) { folderId = null; }
    fs.forEach((e) => Org.removeFolder(kind, e.node.id));
  }
  const togglePin = (n) => Org.setFolderMeta(kind, n.id, { pinned: !n.pinned });

  /* Pick a destination folder ("Browse for folder"). Resolves to a folder id, null (top level) or undefined (cancelled). */
  function pickFolder(title, exclude = new Set()) {
    return new Promise((res) => {
      let chosen = null, box;
      const list = h("div", { class: "fx-pick-list", role: "listbox" });
      const paint = () => {
        clear(list);
        const row = (label, id, depth, glyph, dis) => {
          const r = h("div", { class: "fx-pick-row" + (chosen === id ? " on" : "") + (dis ? " dis" : ""), role: "option", "aria-selected": String(chosen === id) }, glyph, h("span", {}, label));
          r.style.setProperty("--d", depth);
          if (!dis) { r.addEventListener("click", () => { chosen = id; paint(); }); r.addEventListener("dblclick", () => box.close(id)); }
          list.append(r);
        };
        row(KIND[kind].label + " (top level)", null, 0, Retro.sprite(KIND[kind].sprite, 18));
        Org.userFolders(kind).forEach((f) => row(f.name, f.id, f.depth + 1, Retro.folderGlyph(f, 18), exclude.has(f.id)));
      };
      paint();
      box = Retro.win({ title, width: 380, icon: Retro.sprite("folder", 18), onClose: (v) => res(v),
        body: h("div", {}, h("p", { class: "fx-msg" }, "Choose where to put it. The top level returns lessons and problems to their original place."), list),
        buttons: [{ label: "Move here", primary: true, fn: () => chosen }, { label: "Cancel", fn: () => undefined }] });
    });
  }
  async function moveTo(es) {
    const movable = es;
    if (!movable.length) return;
    const exclude = new Set(); movable.filter((e) => e.type === "f").forEach((e) => Org.descendants(kind, e.node.id).forEach((i) => exclude.add(i)));
    const dest = await pickFolder(movable.length === 1 ? `Move “${entryName(movable[0])}” to…` : `Move ${movable.length} items to…`, exclude);
    if (dest === undefined) return;
    moveEntries(kind, movable.map((e) => e.key), dest);
  }
  const folderName = (k, id) => (id ? locate(trees[k], id)?.name || "folder" : KIND[k].label);
  function moveEntries(k, keys, id) {
    const items = keys.filter((x) => x.startsWith("i:")).map((x) => x.slice(2)), fols = keys.filter((x) => x.startsWith("f:")).map((x) => x.slice(2));
    const prev = items.map((i) => [i, Org.folderOf(k, i)]);
    fols.forEach((f) => Org.moveFolder(k, f, id)); items.forEach((i) => Org.assign(k, i, id));
    if (id) { openSet.add(`${k}:${id}`); persistOpen(); }
    const n = items.length + fols.length;
    toast(`Moved ${n === 1 ? "1 item" : n + " items"} to “${folderName(k, id)}”.`, "ok", items.length ? { label: "Undo", fn: () => prev.forEach(([i, f]) => Org.assign(k, i, f)) } : undefined);
  }

  /* Change Icon dialog: preset pixel icons, emoji, and a color. */
  function changeIcon(n, isItem) {
    let icon = n.icon || "", color = n.color || "";
    const glyphOf = (ic, c, px) => (isItem && !ic ? Retro.sprite(KIND[kind].sprite, px, c || undefined) : Retro.folderGlyph({ icon: ic, color: c }, px));
    const save = (p) => (isItem ? Org.setItemMeta(kind, n.id, p) : Org.setFolderMeta(kind, n.id, p));
    const prev = h("div", { class: "fx-prev" }), presets = h("div", { class: "fx-icongrid" }), emoji = h("div", { class: "fx-icongrid emoji" }), sw = h("div", { class: "fx-swatches" });
    const custom = h("input", { class: "fx-input", type: "text", placeholder: "Type or paste an emoji", "aria-label": "Custom emoji" });
    custom.addEventListener("input", () => { const v = [...custom.value.trim()].slice(0, 2).join(""); if (v) { icon = v; paint(true); } });
    const paint = (keepInput) => {
      clear(prev).append(glyphOf(icon, color, 64), h("b", {}, n.name || n.title));
      clear(presets).append(h("div", { class: "fx-gl" }, "Icons"));
      [["", isItem ? KIND[kind].one[0].toUpperCase() + KIND[kind].one.slice(1) : "Folder"], ...Retro.PRESETS.slice(1).map(([k, l]) => ["px:" + k, l])].forEach(([v, l]) => presets.append(h("button", { class: "fx-pick" + (icon === v ? " on" : ""), title: l, "aria-label": l, "aria-pressed": String(icon === v), onclick: () => { icon = v; paint(); } }, glyphOf(v, color, 32))));
      clear(emoji).append(h("div", { class: "fx-gl" }, "Stickers"));
      Retro.EMOJI.forEach((em) => emoji.append(h("button", { class: "fx-pick" + (icon === em ? " on" : ""), title: em, "aria-label": em, "aria-pressed": String(icon === em), onclick: () => { icon = em; paint(); } }, h("span", { class: "fx-emoji", style: { fontSize: "22px" } }, em))));
      clear(sw).append(h("div", { class: "fx-gl" }, "Color"), h("div", { class: "fx-swrow" }, Retro.COLORS.map(([k, l]) => h("button", { class: "fx-sw fc-" + k + (color === k ? " on" : ""), title: l, "aria-label": l, "aria-pressed": String(color === k), onclick: () => { color = color === k ? "" : k; paint(); } }))));
      if (!keepInput) custom.value = "";
    };
    paint();
    Retro.win({ title: "Change icon", width: 460, icon: Retro.sprite("heart", 18),
      body: h("div", { class: "fx-iconpick" }, prev, h("div", { class: "fx-iconopts" }, presets, emoji, h("div", { class: "fx-row2" }, custom), sw)),
      buttons: [{ label: "OK", primary: true, fn: () => { save({ icon, color }); } }, { label: "Reset to default", fn: () => { save({ icon: "", color: "" }); } }, { label: "Cancel", fn: () => undefined }] });
  }

  /* ----- menus ----- */
  const setView = (v) => { viewMode = v; Retro.store.set("fx.view", v); render(); };
  const setSort = (f) => { sortBy = f; sortDir = 1; Retro.store.set("fx.sort", f); Retro.store.set("fx.dir", 1); gather(); render(); };
  const togglePane = () => { pane = !pane; Retro.store.set("fx.pane", pane); render(); };
  const viewEntries = () => [{ head: true, label: "View" },
    ...[["icons", "Large icons"], ["list", "List"], ["details", "Details"]].map(([v, l]) => ({ label: l, check: viewMode === v, fn: () => setView(v) })),
    { label: "Preview pane", check: pane, fn: togglePane }, { sep: true }, { head: true, label: "Arrange by" },
    { label: "Name", check: sortBy === "name", fn: () => setSort("name") }, { label: "Progress", check: sortBy === "progress", fn: () => setSort("progress") },
    { sep: true }, { head: true, label: "Zoom" }, { label: "Zoom in", kbd: "Ctrl +", fn: () => zoomAll(1) }, { label: "Zoom out", kbd: "Ctrl −", fn: () => zoomAll(-1) }, { label: "Reset zoom", kbd: "Ctrl 0", fn: () => zoomAll(0) }];

  function entryMenu(es) {
    const one = es.length === 1 ? es[0] : null, m = [];
    if (cur.hidden) return [...(one && one.type === "f" ? [{ label: "Open", kbd: "Enter", fn: () => openEntry(one) }, { sep: true }] : []), { label: es.length > 1 ? `Restore ${es.length} items` : "Restore", fn: () => restoreEntries(es) }, { sep: true }, { label: "Restore all", fn: () => Org.setHidden(kind, allIds(cur), false) }];
    const userF = es.filter((e) => e.type === "f" && !e.node.auto), movable = es;
    if (one) m.push({ label: "Open", kbd: "Enter", fn: () => openEntry(one) }, { sep: true });
    if (one && one.type === "i") m.push({ label: "Change icon…", fn: () => changeIcon(one.it, true) }, ...(kind === "lessons" ? [{ label: one.it.pinned ? "Unpin from Lessons list" : "Pin to Lessons list", fn: () => Org.setItemMeta("lessons", one.it.id, { pinned: !one.it.pinned }) }] : []), { sep: true });
    if (one && one.type === "f" && one.node.auto) m.push({ label: "Change icon…", fn: () => changeIcon(one.node) }, { sep: true });
    if (one && one.type === "f" && !one.node.auto) m.push(
      { label: "Rename", kbd: "F2", fn: () => startRename(one) }, { label: "Change icon…", fn: () => changeIcon(one.node) },
      { label: one.node.pinned ? "Remove from Favorites" : "Add to Favorites", fn: () => togglePin(one.node) }, { label: "New subfolder", fn: () => newFolder(one.node.id) }, { sep: true });
    m.push({ label: movable.length > 1 ? `Move ${movable.length} items to…` : "Move to…", disabled: !movable.length, fn: () => moveTo(es) });
    const placed = es.filter((e) => e.type === "i" && Org.folderOf(kind, e.it.id));
    if (placed.length) m.push({ label: "Back to original place", fn: () => { const keys = placed.map((e) => e.key); moveEntries(kind, keys, null); } });
    m.push({ sep: true }, { label: es.some((e) => e.type === "f") ? "Hide contents" : es.length > 1 ? `Hide ${es.length} items` : "Hide", fn: () => hideEntries(es) });
    if (userF.length) m.push({ label: userF.length > 1 ? `Delete ${userF.length} folders` : "Delete folder", kbd: "Del", fn: () => deleteFolders(es) });
    return m;
  }
  const blankMenu = () => [{ label: "New folder", kbd: "Ctrl+Shift+N", fn: () => newFolder() }, { sep: true }, ...viewEntries(), { sep: true },
    { label: "Select all", kbd: "Ctrl+A", fn: selectAll }, { label: "Refresh", fn: () => { gather(); render(); } }];
  const openEntry = (e) => { if (e.type === "f") nav(kind, e.node.id); else open(e.it); };
  function selectAll() { sel = new Set(order.map((e) => e.key)); paintSel(); }

  const shortcuts = () => Retro.win({ title: "Keyboard shortcuts", width: 420, icon: Retro.sprite("terminal", 18), buttons: [{ label: "OK", primary: true }],
    body: h("div", { class: "fx-keys" }, [["Enter", "Open"], ["F2", "Rename a folder"], ["Delete", "Hide items / delete folders"], ["Backspace", "Go up one folder"], ["Alt + ← / →", "Back / forward"],
      ["Ctrl + Shift + N", "New folder"], ["Ctrl + A", "Select all"], ["Ctrl / Shift + click", "Select several"], ["Arrow keys", "Move the selection"], ["Ctrl + F", "Search"], ["Right-click", "Menu for anything"], ["Ctrl + mouse wheel", "Zoom the pane under the pointer"], ["Ctrl + + / − / 0", "Zoom the files in / out / reset"], ["Drag", "Drop on a folder to nest or move"]]
      .map(([k, d]) => h("div", {}, h("kbd", {}, k), h("span", {}, d)))) });

  function menubar() {
    const mb = (label, fn) => h("button", { class: "fx-mb", onclick: (ev) => popMenu(ev.currentTarget, fn()) }, label);
    return h("div", { class: "fx-menubar", role: "menubar" },
      mb("File", () => { const es = selEntries(); return [{ label: "New folder", kbd: "Ctrl+Shift+N", fn: () => newFolder() }, { sep: true }, ...(es.length ? entryMenu(es) : [{ label: "Select something to see more", disabled: true }]), { sep: true }, { label: "Go to Lessons", fn: () => nav("lessons", null) }, { label: "Go to Problems", fn: () => nav("problems", null) }, { sep: true }, { label: "Export layout…", fn: () => Layout.exportFile() }, { label: "Import layout…", fn: () => Layout.importFile() }]; }),
      mb("Edit", () => [{ label: "Select all", kbd: "Ctrl+A", fn: selectAll }, { label: "Invert selection", fn: () => { sel = new Set(order.filter((e) => !sel.has(e.key)).map((e) => e.key)); paintSel(); } }, { label: "Clear selection", fn: () => { sel = new Set(); paintSel(); } }]),
      mb("View", () => [...viewEntries(), { sep: true }, { label: "Refresh", fn: () => { gather(); render(); } }]),
      mb("Help", () => [{ label: "Keyboard shortcuts", fn: shortcuts }, { label: "Tip: drag onto a folder to nest", disabled: true }]));
  }

  /* ----- drag and drop ----- */
  const clearDrops = () => document.querySelectorAll(".fx-win .drop").forEach((x) => x.classList.remove("drop"));
  function canDrop(k, id, bin) {
    if (!drag || drag.kind !== k) return false;
    if (bin) return drag.keys.every((x) => x.startsWith("i:"));
    for (const x of drag.keys) if (x.startsWith("f:") && Org.descendants(k, x.slice(2)).has(id)) return false;
    return true;
  }
  function addDrop(el, k, id, bin) {
    el.addEventListener("dragover", (ev) => { if (!canDrop(k, id, bin)) return; ev.preventDefault(); ev.dataTransfer.dropEffect = "move"; el.classList.add("drop"); });
    el.addEventListener("dragleave", () => el.classList.remove("drop"));
    el.addEventListener("drop", (ev) => {
      ev.preventDefault(); ev.stopPropagation(); el.classList.remove("drop");
      if (!canDrop(k, id, bin)) return;
      const d = drag; drag = null;
      if (bin) { const ids = d.keys.map((x) => x.slice(2)); Org.setHidden(k, ids, true); toast(`Hid ${plural(ids.length, KIND[k].one, KIND[k].many)}.`, "ok", { label: "Undo", fn: () => Org.setHidden(k, ids, false) }); }
      else moveEntries(k, d.keys, id);
    });
  }

  /* ----- selection ----- */
  function select(e, ev) {
    const keys = order.map((x) => x.key);
    if (ev.shiftKey && anchor && keys.includes(anchor)) { const a = keys.indexOf(anchor), b = keys.indexOf(e.key); sel = new Set(keys.slice(Math.min(a, b), Math.max(a, b) + 1)); }
    else if (ev.ctrlKey || ev.metaKey) { sel.has(e.key) ? sel.delete(e.key) : sel.add(e.key); anchor = e.key; }
    else { sel = new Set([e.key]); anchor = e.key; }
    lead = e.key; paintSel();
  }
  function paintSel() {
    S.content.querySelectorAll(".fx-item").forEach((el) => { const on = sel.has(el.dataset.key); el.classList.toggle("sel", on); el.setAttribute("aria-selected", String(on)); });
    renderActions(); renderDetails(); renderStatus();
  }

  /* ----- rendering: entries ----- */
  function glyph(e, px) {
    if (e.type === "f") {
      const g = Retro.folderGlyph(e.node, px), w = h("span", { class: "fx-ic" }, g);
      if (e.node.pinned) w.append(h("span", { class: "fx-pin", title: "In Favorites" }, Retro.sprite("heart", Math.max(10, Math.round(px / 3)))));
      return w;
    }
    const w = h("span", { class: "fx-ic" }, itemGlyph(e.it, px));
    if (e.it.pinned) w.append(h("span", { class: "fx-pin", title: "Pinned to the Lessons list" }, Retro.sprite("star", Math.max(10, Math.round(px / 3)))));
    if (prog(e.it).full) w.append(h("span", { class: "fx-done", title: "Complete" }, "✓"));
    return w;
  }
  function entryEl(e) {
    const isF = e.type === "f", n = e.node, key = e.key, p = isF ? null : prog(e.it);
    const nm = entryName(e), cnt = isF ? Org.count(n) : 0;
    const sub = isF ? plural(cnt, KIND[kind].one, KIND[kind].many) : p.text;
    const nameEl = renaming === key && isF ? renameInput(n) : h("span", { class: "fx-name", title: nm }, nm);
    const base = { role: "option", "aria-selected": String(sel.has(key)), tabindex: "-1", "data-key": key, draggable: renaming === key || cur.hidden ? undefined : "true" };
    let el;
    if (viewMode === "details") {
      const a = isF ? agg(n) : null, ratio = isF ? (a.total ? a.ratio : null) : p.ratio;
      el = h("div", { ...base, class: "fx-item fx-row" }, h("span", { class: "c-name" }, glyph(e, 20), nameEl),
        h("span", { class: "c-type" }, isF ? (n.auto ? "System folder" : "Folder") : KIND[kind].one),
        h("span", { class: "c-prog" }, ratio === null ? h("small", {}, isF ? "" : "Reading only") : [Retro.segBar(ratio * 100, 8, "mini"), h("small", {}, isF ? `${a.full}/${a.total}` : p.text)]),
        h("span", { class: "c-info" }, query && !isF ? locs[kind][e.it.id] || "" : isF ? sub : kind === "lessons" ? (e.it.ref.minutes ? e.it.ref.minutes + " min" : "") : `${e.it.ref.points} pts`));
    } else if (viewMode === "list") {
      el = h("div", { ...base, class: "fx-item fx-lrow" }, glyph(e, 20), nameEl);
    } else {
      el = h("div", { ...base, class: "fx-item fx-tile" }, glyph(e, 48), nameEl, h("small", {}, sub));
    }
    el.classList.toggle("sel", sel.has(key));
    el.title = isF ? `${nm}\n${sub}` : `${nm}\n${p.long}${query ? "\n" + (locs[kind][e.it.id] || "") : ""}`;
    el.addEventListener("click", (ev) => { ev.stopPropagation(); if (renaming) return; select(e, ev); S.content.focus({ preventScroll: true }); });
    el.addEventListener("dblclick", (ev) => { ev.preventDefault(); if (!renaming) openEntry(e); });
    el.addEventListener("contextmenu", (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      if (!sel.has(key)) { sel = new Set([key]); anchor = lead = key; paintSel(); }
      popMenu(el, entryMenu(selEntries()), ev);
    });
    el.addEventListener("dragstart", (ev) => {
      if (!sel.has(key)) { sel = new Set([key]); anchor = lead = key; paintSel(); }
      drag = { kind, keys: [...sel] };
      ev.dataTransfer.setData("text/plain", drag.keys.join(",")); ev.dataTransfer.effectAllowed = "move";
    });
    el.addEventListener("dragend", () => { drag = null; clearDrops(); });
    if (isF && !n.auto) addDrop(el, kind, n.id);
    return el;
  }

  function headerRow() {
    const col = (label, field, cls) => h("button", { class: "fx-hc " + cls, onclick: field ? () => { if (sortBy === field) sortDir = -sortDir; else { sortBy = field; sortDir = 1; } Retro.store.set("fx.sort", sortBy); Retro.store.set("fx.dir", sortDir); gather(); render(); } : undefined, disabled: field ? undefined : true },
      label, field && sortBy === field ? h("i", {}, sortDir === 1 ? "▲" : "▼") : null);
    return h("div", { class: "fx-row fx-head" }, col("Name", "name", "c-name"), col("Type", null, "c-type"), col("Progress", "progress", "c-prog"), col(query ? "Location" : "Info", null, "c-info"));
  }

  function renderContent() {
    const top = S.content.scrollTop; clear(S.content);
    const folders = order.filter((e) => e.type === "f"), items = order.filter((e) => e.type === "i");
    const wrap = h("div", { class: "fx-list v-" + viewMode, role: "listbox", "aria-multiselectable": "true", "aria-label": cur.name });
    wrap.style.zoom = Z.files;
    if (!order.length) {
      wrap.append(h("div", { class: "fx-empty" }, Retro.sprite(cur.hidden ? "bin" : "folder", 64),
        h("b", {}, query ? "No matches." : cur.hidden ? "Nothing is hidden." : "This folder is empty."),
        h("span", {}, query ? "Try a different search." : cur.hidden ? "Hidden lessons and problems wait here until you restore them." : "Drag lessons or problems in, or right-click and choose New folder.")));
    } else if (viewMode === "details") {
      wrap.append(headerRow(), ...order.map(entryEl));
    } else {
      const sect = (label, list) => list.length ? [h("div", { class: "fx-sect" }, label, h("small", {}, list.length)), h("div", { class: "fx-grid" }, list.map(entryEl))] : [];
      wrap.append(...sect("Folders", folders), ...sect(KIND[kind].label, items));
    }
    S.content.append(wrap); S.content.scrollTop = top;
  }

  /* ----- rendering: tree ----- */
  function treeNode(k, n, depth, o = {}) {
    const key = o.root ? "root:" + k : o.bin ? `${k}:${HID}` : `${k}:${n.id}`, kids = n.children, exp = openSet.has(key);
    const targetId = o.root ? null : n.id, on = kind === k && folderId === targetId && !query;
    const row = h("div", { class: "fx-tr" + (on ? " on" : "") + (o.fav ? " fav" : ""), role: "treeitem", "aria-expanded": kids.length ? String(exp) : undefined, "aria-selected": String(on), tabindex: "-1", title: n.auto ? "Automatic folder, built from your lessons and problems" : n.name },
      kids.length ? h("button", { class: "fx-tg", tabindex: "-1", "aria-label": exp ? "Collapse" : "Expand", onclick: (ev) => { ev.stopPropagation(); toggleOpen(key); } }, exp ? "−" : "+") : h("span", { class: "fx-tg none" }),
      o.bin ? Retro.sprite("bin", 18) : Retro.folderGlyph(o.root ? { icon: "px:" + KIND[k].sprite } : n, 18),
      h("span", { class: "fx-tn-name" }, n.name), h("span", { class: "fx-tn-cnt" }, Org.count(n)));
    row.style.setProperty("--d", depth);
    row.addEventListener("click", () => nav(k, o.bin ? HID : targetId));
    row.addEventListener("contextmenu", (ev) => {
      ev.preventDefault();
      if (o.root || o.bin) return popMenu(row, [{ label: "Open", fn: () => nav(k, o.bin ? HID : null) }, ...(o.root ? [{ label: "New folder", fn: () => { nav(k, null); newFolder(null); } }] : [])], ev);
      nav(k, n.id); popMenu(row, entryMenu([{ key: "f:" + n.id, type: "f", node: n }]), ev);
    });
    if (o.bin) addDrop(row, k, HID, true); else if (!n.auto) addDrop(row, k, targetId);
    const w = h("div", { class: "fx-tw" }, row);
    if (exp) kids.forEach((c) => w.append(treeNode(k, c, depth + 1)));
    return w;
  }
  function renderTree() {
    const top = S.tree.scrollTop, t = clear(S.treeIn), favs = [];
    S.treeIn.style.zoom = Z.tree;
    for (const k of KINDS) walk(trees[k], (n) => { if (!n.auto && n.pinned) favs.push([k, n]); });
    if (favs.length) t.append(h("div", { class: "fx-tgroup" }, "Favorites"), ...favs.map(([k, n]) => treeNode(k, { ...n, children: [] }, 0, { fav: true })));
    t.append(h("div", { class: "fx-tgroup" }, "My collection"));
    for (const k of KINDS) {
      const rootN = { id: null, name: KIND[k].label, children: trees[k], items: [], auto: false };
      const w = treeNode(k, rootN, 0, { root: true });
      const hr = hroots[k];
      if (hr.children.length && openSet.has("root:" + k)) w.append(treeNode(k, hr, 1, { bin: true }));
      t.append(w);
    }
    S.tree.scrollTop = top;
  }

  /* ----- rendering: toolbars, details, status ----- */
  const pathText = () => { const t = inHid() ? trail([hroots[kind]], folderId).map((n) => n.name) : folderId ? trail(trees[kind], folderId).map((n) => n.name) : []; return ["C:", KIND[kind].label, ...t].join("\\"); };
  function renderNav() {
    clear(S.navL).append(
      h("button", { class: "btn fx-nb", title: "Back (Alt+←)", "aria-label": "Back", disabled: hi > 0 ? undefined : true, onclick: () => goHist(-1) }, "◀"),
      h("button", { class: "btn fx-nb", title: "Forward (Alt+→)", "aria-label": "Forward", disabled: hi < hist.length - 1 ? undefined : true, onclick: () => goHist(1) }, "▶"),
      h("button", { class: "btn fx-nb", title: "Up one folder (Backspace)", "aria-label": "Up", disabled: folderId ? undefined : true, onclick: goUp }, "▲"));
    const a = clear(S.addr);
    const seg = (label, id, glyphEl, droppable) => {
      const b = h("button", { class: "fx-crumb", onclick: () => nav(kind, id) }, glyphEl || null, label);
      if (droppable) addDrop(b, kind, id);
      return b;
    };
    if (query) { a.append(h("span", { class: "fx-crumb static" }, Retro.sprite("heart", 16), `Search results for “${query}”`)); }
    else {
      a.append(seg(KIND[kind].label, null, Retro.sprite(KIND[kind].sprite, 16), true));
      if (inHid()) trail([hroots[kind]], folderId).forEach((n) => { const g = n.id === HID ? Retro.sprite("bin", 16) : Retro.folderGlyph(n, 16); a.append(h("span", { class: "fx-sep" }, "›"), n.id === folderId ? h("span", { class: "fx-crumb static" }, g, n.name) : seg(n.name, n.id, g, false)); });
      else if (folderId) trail(trees[kind], folderId).forEach((n) => a.append(h("span", { class: "fx-sep" }, "›"), seg(n.name, n.id, Retro.folderGlyph(n, 16), !n.auto)));
    }
    const vb = clear(S.views);
    [["icons", "Large icons", "▦"], ["list", "List", "☰"], ["details", "Details", "▤"]].forEach(([v, l, g]) => vb.append(h("button", { class: "btn fx-nb" + (viewMode === v ? " on" : ""), title: l, "aria-label": l, "aria-pressed": String(viewMode === v), onclick: () => setView(v) }, g)));
  }
  const contBtn = () => {
    const t = Resume.target();
    return h("button", { class: "btn pri fx-ab fx-cont", disabled: t ? undefined : true, title: t ? `Continue where you left off: ${t.title}` : "Open a lesson or problem first, then this brings you back to it.", onclick: () => Resume.go(t) },
      "▶ Continue", t ? h("span", { class: "fx-cont-t" }, t.title) : null);
  };

  /* Pane widths: drag the thin handles between the panes. Saved between runs; double-click a handle to reset it. */
  function placeHandles() {
    if (!S || !S.rsT) return;
    const bw = S.body.offsetWidth, tw = S.tree.offsetWidth, dw = S.detail.offsetWidth, stacked = tw >= bw - 4;
    S.rsT.style.display = stacked ? "none" : "";
    if (!stacked) S.rsT.style.left = tw - 4 + "px";
    S.rsD.style.display = stacked || !pane || !dw ? "none" : "";
    if (!stacked && dw) S.rsD.style.left = bw - dw - 4 + "px";
  }
  const saveWidths = () => Retro.store.set("fx.w", { tree: parseInt(S.body.style.getPropertyValue("--tw")) || 0, detail: parseInt(S.body.style.getPropertyValue("--dw")) || 0 });
  function dragHandle(hnd, which) {
    hnd.addEventListener("pointerdown", (e) => {
      e.preventDefault(); hnd.setPointerCapture(e.pointerId); hnd.classList.add("drag"); document.body.classList.add("dragging");
      const r = S.body.getBoundingClientRect();
      const mv = (ev) => {
        if (which === "tree") S.body.style.setProperty("--tw", Math.max(150, Math.min(520, r.width - (pane ? S.detail.offsetWidth : 0) - 220, ev.clientX - r.left)) + "px");
        else S.body.style.setProperty("--dw", Math.max(180, Math.min(560, r.width - S.tree.offsetWidth - 220, r.right - ev.clientX)) + "px");
        placeHandles();
      };
      const up = () => { hnd.removeEventListener("pointermove", mv); hnd.removeEventListener("pointerup", up); hnd.classList.remove("drag"); document.body.classList.remove("dragging"); saveWidths(); };
      hnd.addEventListener("pointermove", mv); hnd.addEventListener("pointerup", up);
    });
    hnd.addEventListener("dblclick", () => { S.body.style.removeProperty(which === "tree" ? "--tw" : "--dw"); saveWidths(); placeHandles(); });
  }

  function renderActions() {
    const es = selEntries(), one = es.length === 1 ? es[0] : null, hid = cur.hidden;
    const userF = es.filter((e) => e.type === "f" && !e.node.auto), movable = es;
    const b = (label, fn, dis, title) => h("button", { class: "btn fx-ab", disabled: dis ? true : undefined, title, onclick: fn }, label);
    clear(S.act).append(
      contBtn(), hid ? null : b("New folder", () => newFolder(), false, "Create a folder here (Ctrl+Shift+N)"),
      b("Open", () => one && openEntry(one), !one || (hid && one.type === "i"), "Enter"),
      b("Rename", () => one && startRename(one), !(one && one.type === "f" && !one.node.auto), "F2"),
      b("Change icon…", () => one && (one.type === "f" ? changeIcon(one.node) : changeIcon(one.it, true)), !one || hid),
      b("Move to…", () => moveTo(es), !movable.length || hid),
      hid ? b("Restore", () => restoreEntries(es), !es.length) : b("Hide", () => hideEntries(es), !es.length, "Hide from your lists. Nothing is deleted."),
      hid ? null : b("Delete folder", () => deleteFolders(es), !userF.length, "Delete"));
  }
  function renderDetails() {
    const d = clear(S.detailIn), es = selEntries(), one = es.length === 1 ? es[0] : null;
    S.detailIn.style.zoom = Z.pane; S.detailIn.style.minHeight = 100 / Z.pane + "%";
    S.body.classList.toggle("nopane", !pane);
    if (!pane) return;
    const head = (g, title, sub) => h("div", { class: "fx-dhead" }, g, h("b", {}, title), sub ? h("small", {}, sub) : null);
    const btn = (label, fn, pri) => h("button", { class: "btn" + (pri ? " pri" : ""), onclick: fn }, label);
    if (one && one.type === "i") {
      const it = one.it, p = prog(it), l = it.ref;
      d.append(head(itemGlyph(it, 64), it.title, KIND[kind].one === "lesson" ? "Lesson" : "Problem"),
        p.ratio === null ? h("p", { class: "fx-dp" }, "Reading only. No activities to track.") : h("div", { class: "fx-dprog" }, Retro.segBar(p.ratio * 100, 14), h("small", {}, p.long)),
        kind === "lessons" ? h("p", { class: "fx-dp" }, [l.minutes ? l.minutes + " minutes. " : "", l.summary || ""].join("")) : h("p", { class: "fx-dp" }, `${l.points} points across ${plural(l.n_tests, "test", "tests")}.`),
        h("p", { class: "fx-dloc" }, "In ", locs[kind][it.id] || (cur.hidden ? "Hidden" : KIND[kind].label)),
        h("div", { class: "fx-dbtns" }, cur.hidden ? btn("Restore", () => restoreEntries(es), true) : btn("Open", () => open(it), true), cur.hidden ? null : btn("Change icon…", () => changeIcon(it, true)), kind === "lessons" && !cur.hidden ? btn(it.pinned ? "Unpin" : "Pin to list", () => Org.setItemMeta("lessons", it.id, { pinned: !it.pinned })) : null, cur.hidden ? null : btn("Move to…", () => moveTo(es)), cur.hidden ? null : btn("Hide", () => hideEntries(es))));
    } else if (one) {
      const n = one.node, a = agg(n), nf = n.children.length;
      d.append(head(Retro.folderGlyph(n, 64), n.name, cur.hidden ? "Hidden folder" : n.auto ? "System folder" : "Folder"),
        h("p", { class: "fx-dp" }, [nf ? plural(nf, "folder", "folders") : "", plural(n.items.length, KIND[kind].one, KIND[kind].many)].filter(Boolean).join(" · ") + (nf ? `, ${Org.count(n)} in total` : "") + "."),
        a.total ? h("div", { class: "fx-dprog" }, Retro.segBar(a.ratio * 100, 14), h("small", {}, `${a.full} of ${a.total} complete`)) : null,
        cur.hidden ? h("p", { class: "fx-dp" }, "Hidden. Restore it to bring what is inside back into your lists.") : n.auto ? h("p", { class: "fx-dp" }, "Built automatically from your lessons and problems. You can change its icon or nest it inside one of your own folders.") : h("p", { class: "fx-dp" }, "Right-click to rename, change the icon or nest it in another folder."),
        h("div", { class: "fx-dbtns" }, btn("Open", () => openEntry(one), true), cur.hidden ? btn("Restore", () => restoreEntries(es)) : btn("Change icon…", () => changeIcon(n)), n.auto ? null : btn("Rename", () => startRename(one))));
    } else if (es.length) {
      d.append(head(Retro.sprite("heart", 64), `${es.length} items selected`), h("p", { class: "fx-dp" }, "Drag them onto a folder, or use the buttons."),
        h("div", { class: "fx-dbtns" }, cur.hidden ? btn("Restore", () => restoreEntries(es), true) : btn("Move to…", () => moveTo(es), true), cur.hidden ? null : btn("Hide", () => hideEntries(es))));
    } else {
      const a = agg(cur.root ? { items: [], children: trees[kind] } : cur), nf = cur.children.length;
      d.append(head(cur.root ? Retro.sprite(KIND[kind].sprite, 64) : cur.id === HID ? Retro.sprite("bin", 64) : Retro.folderGlyph(cur, 64), cur.name, cur.root ? "My " + KIND[kind].label.toLowerCase() : cur.hidden ? "Hidden items" : "Folder"),
        h("p", { class: "fx-dp" }, [nf ? plural(nf, "folder", "folders") : "", plural(cur.items.length, KIND[kind].one, KIND[kind].many)].filter(Boolean).join(" · ") + "."),
        a.total ? h("div", { class: "fx-dprog" }, Retro.segBar(a.ratio * 100, 14), h("small", {}, `${a.full} of ${a.total} complete`)) : null,
        h("div", { class: "fx-tip" }, h("b", {}, "Tip"), h("span", {}, "Double-click opens. Right-click anything for more. Drag items onto a folder to nest them.")));
    }
  }
  function renderStatus() {
    const items = query ? order.filter((e) => e.type === "i").map((e) => e.it) : cur.root ? allItems({ items: [], children: trees[kind] }) : allItems(cur);
    const tracked = items.map(prog).filter((p) => p.ratio !== null), full = tracked.filter((p) => p.full).length;
    clear(S.status).append(
      h("span", { class: "fx-sp" }, plural(order.length, "object", "objects") + (sel.size ? `  ·  ${sel.size} selected` : "")),
      h("span", { class: "fx-sp grow" }, tracked.length ? [Retro.segBar(tracked.length ? (full / tracked.length) * 100 : 0, 12, "mini"), h("small", {}, `${full} of ${tracked.length} complete`)] : null),
      h("span", { class: "fx-sp zooms" }, zctl("Side", "tree"), zctl("Files", "files"), zctl("Preview", "pane")),
      h("span", { class: "fx-sp heart" }, Retro.sprite("heart", 14), "LOCAL JUDGE"));
  }
  function render() {
    if (!S) return;
    clear(S.titleHold).append(Retro.titleBar(`Collection – ${pathText()}`, { icon: Retro.sprite("heart", 18), tone: "navy" }));
    renderNav(); renderActions(); renderTree(); renderContent(); renderDetails(); renderStatus(); placeHandles();
  }

  /* ----- keyboard ----- */
  function key(ev) {
    if (renaming) return;
    const k = ev.key, ctrl = ev.ctrlKey || ev.metaKey;
    const es = selEntries(), one = es.length === 1 ? es[0] : null;
    if (ctrl && (k === "=" || k === "+")) { ev.preventDefault(); zoom("files", 1); }
    else if (ctrl && (k === "-" || k === "_")) { ev.preventDefault(); zoom("files", -1); }
    else if (ctrl && k === "0") { ev.preventDefault(); zoom("files", 0); }
    else if (k === "Enter" && one) { ev.preventDefault(); openEntry(one); }
    else if (k === "F2" && one) { ev.preventDefault(); startRename(one); }
    else if (k === "Delete" && es.length) { ev.preventDefault(); if (cur.hidden) restoreEntries(es); else if (es.every((e) => e.type === "i")) hideEntries(es); else deleteFolders(es); }
    else if (k === "Backspace" || (ev.altKey && k === "ArrowLeft")) { ev.preventDefault(); ev.altKey ? goHist(-1) : goUp(); }
    else if (ev.altKey && k === "ArrowRight") { ev.preventDefault(); goHist(1); }
    else if (ctrl && k.toLowerCase() === "a") { ev.preventDefault(); selectAll(); }
    else if (ctrl && ev.shiftKey && k.toLowerCase() === "n") { ev.preventDefault(); newFolder(); }
    else if (k === "Escape") { if (sel.size) { sel = new Set(); paintSel(); } else if (query) { S.search.value = ""; query = ""; gather(); render(); } }
    else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(k) && order.length) {
      ev.preventDefault();
      const keys = order.map((e) => e.key); let i = keys.indexOf(lead);
      let cols = 1;
      if (i >= 0) { const el = S.content.querySelector(`[data-key="${CSS.escape(lead)}"]`); if (el) { const sibs = [...el.parentElement.children].filter((c) => c.classList.contains("fx-item")); cols = Math.max(1, sibs.filter((c) => c.offsetTop === sibs[0].offsetTop).length); } }
      if (i < 0) i = 0;
      else if (k === "ArrowRight") i++; else if (k === "ArrowLeft") i--; else if (k === "ArrowDown") i += viewMode === "details" ? 1 : cols; else if (k === "ArrowUp") i -= viewMode === "details" ? 1 : cols;
      else if (k === "Home") i = 0; else i = keys.length - 1;
      i = Math.max(0, Math.min(keys.length - 1, i));
      lead = keys[i];
      if (ev.shiftKey && anchor && keys.includes(anchor)) { const a = keys.indexOf(anchor); sel = new Set(keys.slice(Math.min(a, i), Math.max(a, i) + 1)); }
      else { sel = new Set([lead]); anchor = lead; }
      paintSel();
      S.content.querySelector(`[data-key="${CSS.escape(lead)}"]`)?.scrollIntoView({ block: "nearest" });
    }
  }

  /* ----- build the window once ----- */
  function build() {
    const el = clear(root());
    const search = h("input", { class: "search fx-search", type: "search", id: "collSearch", placeholder: "Search…", "aria-label": "Search lessons and problems",
      oninput: (e) => { query = e.target.value; sel = new Set(); gather(); render(); } });
    const treeIn = h("div", { class: "fx-zoomin" }), detailIn = h("div", { class: "fx-zoomin dt" });
    S = { search, treeIn, detailIn, titleHold: h("div"), menubar: menubar(), navL: h("div", { class: "fx-navl" }), addr: h("div", { class: "fx-addr", "aria-label": "Location" }), views: h("div", { class: "fx-views" }),
      act: h("div", { class: "fx-actbar", role: "toolbar" }), tree: h("nav", { class: "fx-tree", role: "tree", "aria-label": "Folders" }, treeIn),
      content: h("div", { class: "fx-content", tabindex: "0", "aria-label": "Folder contents" }), detail: h("aside", { class: "fx-detail", "aria-label": "Preview" }, detailIn), status: h("div", { class: "fx-status" }) };
    S.rsT = h("div", { class: "fx-rs", role: "separator", "aria-orientation": "vertical", title: "Drag to resize, double-click to reset" });
    S.rsD = h("div", { class: "fx-rs", role: "separator", "aria-orientation": "vertical", title: "Drag to resize, double-click to reset" });
    S.body = h("div", { class: "fx-body" }, S.tree, S.content, S.detail, S.rsT, S.rsD);
    const sw = Retro.store.get("fx.w", {});
    if (sw.tree) S.body.style.setProperty("--tw", sw.tree + "px");
    if (sw.detail) S.body.style.setProperty("--dw", sw.detail + "px");
    dragHandle(S.rsT, "tree"); dragHandle(S.rsD, "detail");
    if (window.ResizeObserver) new ResizeObserver(() => placeHandles()).observe(S.body);
    S.content.addEventListener("keydown", key);
    for (const [el, zk] of [[S.tree, "tree"], [S.content, "files"], [S.detail, "pane"]]) el.addEventListener("wheel", (ev) => { if (!ev.ctrlKey) return; ev.preventDefault(); zoom(zk, ev.deltaY < 0 ? 1 : -1); }, { passive: false });
    S.content.addEventListener("click", () => { if (sel.size) { sel = new Set(); paintSel(); } });
    S.content.addEventListener("contextmenu", (ev) => { ev.preventDefault(); if (!cur.hidden) popMenu(S.content, blankMenu(), ev); });
    S.win = h("div", { class: "fx-win" }, S.titleHold, S.menubar, h("div", { class: "fx-nav" }, S.navL, S.addr, search, S.views), S.act, S.body, S.status);
    el.append(h("div", { class: "fx-desk" }, S.win));
  }
  function show() { if (!S || !S.win.isConnected) build(); gather(); expandPath(); render(); }
  function draw() { if (!S || !S.win.isConnected) return show(); gather(); render(); }

  return { show, draw, focusSearch() { const s = $("#collSearch"); s && (s.focus(), s.select()); } };
})();


/* ---------- "Continue where I left off": the lesson or problem you were last in ---------- */
const Resume = (() => {
  const lessonList = () => D.courses.flatMap((c) => c.lessons).filter((l) => !Org.isHidden("lessons", l.id));
  const counts = (l) => { const d = new Set(D.state.done[l.id] || []); return [l.acts.filter((a) => d.has(a)).length, l.acts.length]; };
  function lessonTarget() {
    const list = lessonList();
    if (!list.length) return null;
    let i = list.findIndex((l) => l.id === D.cfg.last_lesson);
    if (i < 0) { i = list.findIndex((l) => { const [a, b] = counts(l); return a > 0 && a < b; }); if (i < 0) i = 0; }
    let l = list[i], [a, b] = counts(l);
    if (b && a === b) {                                  // that one is finished, so move on to the next with something left to do
      const next = [...list.slice(i + 1), ...list.slice(0, i)].find((x) => { const [p, q] = counts(x); return q && p < q; });
      if (next) { l = next; [a, b] = counts(l); }
    }
    return { kind: "lessons", id: l.id, title: l.title, done: a, total: b };
  }
  function problemTarget() {
    const p = D.modules.flatMap((m) => m.problems).find((x) => x.iid === D.cfg.last_problem && !Org.isHidden("problems", x.iid));
    return p ? { kind: "problems", id: p.iid, title: `${p.id}  ${p.title}` } : null;
  }
  const target = () => { const L = lessonTarget(), P = problemTarget(); return D.cfg.last_open === "judge" ? P || L : L || P; };
  function go(t = target()) {
    if (!t) return toast("Nothing to continue yet. Open a lesson or problem first.", "");
    if (t.kind === "lessons") { App.go("lessons"); Lessons.open(t.id, true, { resume: true }); }
    else { App.go("judge"); Judge.select(t.id); }
  }
  return { target, lessonTarget, go };
})();

/* ---------- Export / import your layout (organize.json) without syncing ---------- */
const Layout = (() => {
  function exportFile() {
    const name = `cs11-layout-${new Date().toISOString().slice(0, 10)}.json`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(Org.exportLayout(), null, 1)], { type: "application/json" }));
    a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast(`Layout exported as ${name}. Look in your Downloads folder.`, "ok");
  }
  function importFile() {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = ".json,application/json";
    inp.addEventListener("change", async () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      if (f.size > 2e6) return toast("That file is too big to be a layout file.", "err");
      let raw;
      try { raw = JSON.parse(await f.text()); } catch (e) { return toast("That file is not valid JSON, so it cannot be a layout file.", "err"); }
      if (!raw || typeof raw !== "object" || Array.isArray(raw) || !(raw.app === "cs11-judge-layout" || raw.lessons || raw.problems)) return toast("That does not look like a Local Judge layout file.", "err");
      const s = Org.summarizeLayout(raw);
      if (!s.folders && !s.hidden && !s.meta) return toast("That layout file is empty, so there is nothing to import.", "err");
      const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
      const choice = await new Promise((res) => Retro.win({ title: "Import layout", width: 460, icon: Retro.sprite("folder", 18), onClose: (v) => res(v),
        body: h("div", {}, h("p", { class: "fx-msg" }, `This file has ${plural(s.folders, "folder", "folders")}, ${plural(s.hidden, "hidden item", "hidden items")} and ${plural(s.meta, "custom icon or pin", "custom icons and pins")}.`),
          h("p", { class: "fx-msg" }, "Replace mine swaps your current layout for this one. Merge adds what is missing and keeps yours wherever both have something. Your lessons and problems are never touched.")),
        buttons: [{ label: "Replace mine", primary: true, fn: () => "replace" }, { label: "Merge in", fn: () => "merge" }, { label: "Cancel", fn: () => undefined }] }));
      if (!choice) return;
      const before = JSON.parse(JSON.stringify(D.org || {}));
      Org.importLayout(raw, choice);
      toast(choice === "merge" ? "Layout merged into yours." : "Layout imported.", "ok", { label: "Undo", fn: () => Org.restoreLayout(before) });
    });
    inp.click();
  }
  return { exportFile, importFile };
})();