/* App shell: navigation, Library, Settings, first-run welcome, sync */
const App = (() => {
  let view = "home", syncing = false;
  const VIEWS = ["home", "lessons", "judge", "collection", "library", "streaks", "manual", "settings"];
  const KEYVIEWS = ["home", "lessons", "judge", "collection", "library", "streaks", "manual"];
  const hasSide = (v) => v === "lessons" || v === "judge";
  const notifiedLib = new Set();

  function applyLook() {
    const c = D.cfg, root = document.documentElement;
    root.dataset.theme = THEMES.some((t) => t[0] === c.theme) ? c.theme : THEMES[0][0];
    root.style.setProperty("--prose-fs", (c.font_size || 17) + "px");
    root.style.setProperty("--ed-fs", (c.editor_font || 14) + "px");
    root.style.setProperty("--page-w", (c.page_w || 880) + "px");
    $("#app").style.setProperty("--side-w", Math.max(200, Math.min(640, c.side_w || 310)) + "px");
  }

  /* ---------------- rail ---------------- */
  function rail() {
    const r = clear($("#rail"));
    r.append(h("div", { class: "logo", "aria-label": "Local Judge home" }, icon("computer"), h("span", { class: "logo-heart", "aria-hidden": "true" }, icon("heart"))));
    const btn = (id, ic, label, extra) => h("button", { class: "rbtn", id: "r-" + id,
      title: label + (KEYVIEWS.includes(id) ? `  (Ctrl+${KEYVIEWS.indexOf(id) + 1})` : ""),
      onclick: () => (id === "sync" ? syncNow() : id === view && hasSide(id) ? toggleSide() : go(id)) }, icon(ic), label, extra);
    r.append(btn("home", "home", "Home"), btn("lessons", "book", "Lessons"), btn("judge", "term", "Judge"), btn("collection", "folder", "Collection"), btn("library", "inbox", "Library", h("span", { class: "badge", id: "libBadge" })),
      btn("streaks", "flame", "Streaks", h("span", { class: "badge fire", id: "streakBadge" })),
      h("span", { class: "grow" }),
      h("button", { class: "rbtn mini", id: "r-manual", title: "Manual  (F1)", onclick: () => go("manual") }, icon("help"), "Manual"),
      Retro.clock(), btn("sync", "sync", "Sync"), btn("settings", "gear", "Settings"));
    markRail();
  }
  function markRail() {
    for (const v of VIEWS) $("#r-" + v)?.classList.toggle("on", v === view);
    $("#r-sync")?.classList.toggle("spin", syncing);
    const n = D.lib.filter((i) => i.status === "new").length, b = $("#libBadge");
    if (b) { b.textContent = n; b.classList.toggle("show", n > 0); }
    const sb = $("#streakBadge"), cur = (D.streak && D.streak.current) || 0;
    if (sb) { sb.textContent = cur; sb.classList.toggle("show", cur > 0); }
  }

  /* ---------------- the list panel: hide, show, resize ---------------- */
  function toggleSide(force) {
    const hide = force === undefined ? !D.cfg.side_hidden : force;
    D.cfg.side_hidden = hide;
    $("#app").classList.toggle("side-hidden", hide);
    saveCfg({ side_hidden: hide });
  }
  function sideDrag() {
    const hnd = h("div", { id: "sideDrag", title: "Drag to resize" });
    $("#app").append(hnd);
    hnd.addEventListener("pointerdown", (e) => {
      e.preventDefault(); hnd.setPointerCapture(e.pointerId); hnd.classList.add("drag"); document.body.classList.add("dragging");
      const mv = (ev) => { const w = Math.max(200, Math.min(640, ev.clientX - 72)); D.cfg.side_w = w; $("#app").style.setProperty("--side-w", w + "px"); };
      const up = () => { hnd.removeEventListener("pointermove", mv); hnd.removeEventListener("pointerup", up); hnd.classList.remove("drag"); document.body.classList.remove("dragging"); saveCfg({ side_w: D.cfg.side_w }); };
      hnd.addEventListener("pointermove", mv); hnd.addEventListener("pointerup", up);
    });
    hnd.addEventListener("dblclick", () => { D.cfg.side_w = 310; applyLook(); saveCfg({ side_w: 310 }); });
  }

  function go(v) {
    view = v;
    for (const x of VIEWS) $("#v-" + x).classList.toggle("on", x === v);
    $("#app").classList.toggle("no-side", !hasSide(v));
    saveCfg({ active_tab: v });
    if (v === "home") Home.show();
    else if (v === "lessons") Lessons.show();
    else if (v === "judge") Judge.show();
    else if (v === "collection") Collection.show();
    else if (v === "library") Library.show();
    else if (v === "streaks") Streaks.show();
    else if (v === "manual") Manual.show();
    else Settings.show();
    markRail();
  }
  function refreshLists() {
    if (view === "home") Home.draw();
    else if (view === "lessons") Lessons.renderSide();
    else if (view === "judge") Judge.renderSide();
    else if (view === "collection") Collection.draw();
  }

  /* ---------------- sync ---------------- */
  const configured = () => !!(D.cfg.sync_url && D.cfg.name);
  /* Progress, lesson answers, streaks, folder layout and where-you-were go to Drive together.
     It runs when you press Sync, shortly after you change something, and when the app closes. */
  const queueSync = debounce(() => { if (configured() && !syncing) syncNow(true, true); }, 45000);

  function notifyLibrary(items) {
    const fresh = (items || []).filter((i) => i.status === "new" && !notifiedLib.has(i.key));
    if (!fresh.length) return 0;
    fresh.forEach((i) => notifiedLib.add(i.key));
    const lessons = fresh.filter((i) => i.kind === "lesson").length;
    const problems = fresh.filter((i) => i.kind === "problem").length;
    const label = [lessons ? `${lessons} lesson${lessons === 1 ? "" : "s"}` : "", problems ? `${problems} problem${problems === 1 ? "" : "s"}` : ""].filter(Boolean).join(" and ");
    if (typeof Notify === "undefined") { toast(`${label} new in the Library.`, "ok"); return fresh.length; }
    Notify.show({
      title: "NEW IN THE LIBRARY", tone: "navy", timeout: 11000, icon: Retro.sprite("floppy", 16),
      action: { label: "Open Library", fn: () => go("library") },
      body: h("div", { class: "nt-list" }, h("div", { class: "nt-row" },
        h("span", { class: "nt-ico sm", "aria-hidden": "true" }, Retro.sprite("folder", 30)),
        h("div", { class: "nt-text" }, h("b", {}, `${label} to review`),
          h("small", {}, fresh.slice(0, 3).map((i) => i.title).join("  ·  ") + (fresh.length > 3 ? `  ·  +${fresh.length - 3} more` : ""))))),
    });
    return fresh.length;
  }

  /* Remind once a day if sync is on but the last one is old. */
  function maybeSyncNag() {
    if (!configured() || !D.cfg.last_sync) return;
    const t = Date.parse(String(D.cfg.last_sync).replace(" ", "T"));
    if (!Number.isFinite(t) || Date.now() - t < 2 * 864e5) return;
    const day = new Date().toISOString().slice(0, 10);
    if (Retro.store.get("sync.nag") === day) return;
    Retro.store.set("sync.nag", day);
    const days = Math.max(2, Math.floor((Date.now() - t) / 864e5));
    if (typeof Notify === "undefined") return toast(`It has been ${days} days since your last sync.`, "err");
    Notify.show({
      title: "SYNC REMINDER", tone: "pink", timeout: 13000, icon: Retro.sprite("cd", 16),
      action: { label: "Sync now", fn: () => syncNow() },
      body: h("span", {}, `It has been ${days} days since your last sync. Progress on this computer is not in Drive yet.`),
    });
  }

  async function syncNow(silent, auto) {
    if (syncing) return;
    if (!D.cfg.name) return Welcome.show();
    if (!D.cfg.sync_url) { if (!silent) { toast("Add the sync address in Settings first.", "err"); go("settings"); } return; }
    syncing = true; markRail();
    try {
      const r = await api("sync/now", {}, { timeout: 300000 });
      D.progress = r.progress; D.state = r.state; D.lib = r.library; D.org = r.org || D.org;
      Object.assign(D.cfg, r.cfg || {}, { last_sync: r.last_sync });
      Retro.store.set("sync.nag", "");
      const fresh = r.new ? notifyLibrary(r.library) : 0;
      if (silent) refreshLists();                        // background syncs never rebuild the page you are working on
      else if (view === "lessons") Lessons.refresh(); else if (view === "judge") Judge.refresh(); else refreshLists();
      const pub = r.published.length ? ` Shared ${r.published.length} of yours.` : "";
      if (r.lib_error) { if (!auto) toast("Your progress, streaks and folder layout are saved to Drive. The shared library could not be updated: " + r.lib_error, "err"); }
      else if (!fresh && !silent) toast("Synced. Your progress, streaks and folder layout are saved to Drive." + pub, "ok");
      if (view === "settings" && !auto) Settings.show();
    } catch (e) { if (!silent) toast("Sync failed: " + e.message, "err"); else console.warn(e); }
    finally { syncing = false; markRail(); }
  }

  /* ---------------- init ---------------- */
  async function init() {
    const boot = await api("bootstrap");
    Object.assign(D, boot, { lib: [] });
    applyLook(); rail(); sideDrag();
    if (D.cfg.side_hidden) $("#app").classList.add("side-hidden");
    document.addEventListener("keydown", keys);
    document.addEventListener("keydown", (e) => { if (e.key === "F1") { e.preventDefault(); go("manual"); } });
    // Ctrl+S would open the browser's "Save page" dialog and Ctrl+H its history. Neither is wanted here, so they do nothing (Ctrl+H is find and replace inside a code editor).
    document.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "s" || e.key === "S" || e.key === "h" || e.key === "H")) e.preventDefault(); }, true);
    let pinging = false;
    const ping = async () => {
      if (pinging) return;                     // never stack pings if the server is slow
      pinging = true;
      try { await api("ping", undefined, { timeout: 8000 }); } catch (e) { } finally { pinging = false; }
    };
    setInterval(ping, 6000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) ping(); });
    addEventListener("pagehide", () => {
      try {                                       // debounced saves get a last chance, then the goodbye
        const p = (typeof Judge !== "undefined" && Judge.pendingSave) ? Judge.pendingSave() : null;
        if (p) beacon("judge/save", p);
        if (typeof Lessons !== "undefined" && Lessons.flushState) Lessons.flushState();
        if (typeof Org !== "undefined" && Org.flush) Org.flush();
      } catch (e) { /* the beacons are best-effort */ }
      navigator.sendBeacon("/api/bye?t=" + encodeURIComponent(TOK) + "&p=" + encodeURIComponent(PAGE), "");
    });
    // Home is the app's desk: a launch shows the streak, recent work and sync status first.
    go("home");
    if (!D.cfg.name) Welcome.show(); else if (D.cfg.sync_url) setTimeout(() => syncNow(true), 800);
    setTimeout(maybeSyncNag, 2500);
    if (D.errors.length) toast(`${D.errors.length} lesson or problem file(s) could not be loaded. See Settings.`, "err");
  }

  function keys(e) {
    if (e.defaultPrevented || !(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "b") { e.preventDefault(); if (hasSide(view)) toggleSide(); return; }
    const i = ["1", "2", "3", "4", "5", "6", "7"].indexOf(e.key);
    if (i >= 0) { e.preventDefault(); go(KEYVIEWS[i]); }
    else if (k === "l") { e.preventDefault(); reload(); }
    else if (k === "f") {
      const f = { lessons: Lessons.focusSearch, judge: Judge.focusSearch, collection: Collection.focusSearch }[view];
      if (f) { e.preventDefault(); f(); }
    }
  }

  async function reload(quiet) {
    try {
      const boot = await api("reload"); Object.assign(D, boot);
      if (view === "lessons") Lessons.refresh(); else if (view === "judge") Judge.refresh(); else refreshLists();
      if (!quiet) toast("Lessons and problems reloaded.", "ok");
    } catch (e) { toast(e.message, "err"); }
  }

  return { init, go, syncNow, queueSync, reload, markRail, applyLook, configured, toggleSide, refreshLists };
})();

/* ================= Library ================= */
const Library = (() => {
  const root = () => $("#v-library");
  let tab = Retro.store.get("lib.tab", "lesson");
  if (tab !== "lesson" && tab !== "problem") tab = "lesson";
  async function show() {
    draw(true);
    if (!App.configured()) return;
    try {
      const r = await api("library", undefined, { timeout: 90000 });
      D.lib = r.library; draw();
      const fresh = D.lib.filter((i) => i.status === "new").map((i) => i.key);
      if (fresh.length) { await api("library/seen", { keys: fresh }); D.cfg.seen = [...(D.cfg.seen || []), ...fresh]; D.lib.forEach((i) => { if (i.status === "new") i.status = "available"; }); }
      App.markRail();
    } catch (e) { draw(false, e.message); }
  }
  const noun = (kind, n) => (kind === "lesson" ? "lesson" : "problem") + (n === 1 ? "" : "s");
  const addable = (i) => i.status !== "installed";

  function folders() {
    const m = new Map();
    for (const i of D.lib) {
      const id = i.key.split("/")[0], fk = i.kind + "|" + id;
      if (!m.has(fk)) m.set(fk, { kind: i.kind, id, title: (i.kind === "lesson" ? i.course_title : i.module_title) || i.group || id, items: [] });
      m.get(fk).items.push(i);
    }
    return [...m.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title));
  }

  async function addKeys(keys, label) {
    try {
      const r = await api("library/add", { keys }, { timeout: 180000 });
      Object.assign(D, { modules: r.modules, courses: r.courses, progress: r.progress, errors: r.errors, lib: r.library });
      toast(r.added.length ? `Added ${label} to your collection.` : "You already have that.", "ok");
    } catch (e) { toast(e.message, "err"); }
    draw(); App.markRail();
  }
  async function skipKeys(keys) {
    await api("library/skip", { keys });
    D.lib.forEach((x) => { if (keys.includes(x.key)) x.status = "skipped"; });
    D.cfg.declined = [...(D.cfg.declined || []), ...keys]; draw(); App.markRail();
  }

  function fileRow(i) {
    const btns = h("div", { class: "btns" });
    if (i.status === "installed") btns.append(h("span", { class: "chip ok" }, "Added"));
    else btns.append(h("button", { class: "btn sm pri", onclick: (e) => { e.currentTarget.disabled = true; addKeys([i.key], `“${i.title}”`); } }, i.status === "skipped" ? "Add anyway" : "Add"));
    return h("div", { class: "frow" }, h("div", {}, h("div", {}, i.title), h("div", { class: "mt" }, [i.author && "shared by " + i.author, i.summary].filter(Boolean).join("  ·  "))), btns);
  }

  function folderCard(f) {
    const todo = f.items.filter(addable), fresh = f.items.filter((i) => i.status === "new" || i.status === "available");
    const allSkipped = todo.length && todo.every((i) => i.status === "skipped");
    const authors = [...new Set(f.items.map((i) => i.author).filter(Boolean))];
    const meta = [f.kind === "lesson" ? "Lesson folder" : "Problem folder", `${f.items.length} ${noun(f.kind, f.items.length)}`,
      todo.length && todo.length < f.items.length ? `${f.items.length - todo.length} already yours` : "", authors.length ? "shared by " + authors.slice(0, 3).join(", ") : ""].filter(Boolean).join("  ·  ");
    const btns = h("div", { class: "btns" });
    const stop = (fn) => (e) => { e.preventDefault(); e.stopPropagation(); fn(e); };
    if (!todo.length) btns.append(h("span", { class: "chip ok" }, "In your collection"));
    else {
      btns.append(h("button", { class: "btn pri", onclick: stop((e) => { e.currentTarget.disabled = true; addKeys(todo.map((i) => i.key), `the “${f.title}” folder`); }) },
        (allSkipped ? "Add anyway" : "Add folder") + (todo.length > 1 ? ` (${todo.length})` : "")));
      if (!allSkipped) btns.append(h("button", { class: "btn", onclick: stop(() => skipKeys(fresh.map((i) => i.key))) }, "Not now"));
    }
    const d = h("details", { class: "folder" + (fresh.length ? " new" : "") },
      h("summary", {}, h("span", { class: "chev" }), h("div", {}, h("div", { class: "tt" }, f.title), h("div", { class: "mt" }, meta)), btns),
      h("div", { class: "files" }, f.items.map(fileRow)));
    return d;
  }

  function draw(loading, err) {
    const el = clear(root());
    const inn = h("div", { class: "in" });
    inn.append(h("div", { class: "row" }, h("div", { style: { flex: 1 } }, h("h1", {}, "Library"),
      h("p", { class: "lead2" }, "Folders of lessons and problems that other students have shared. Nothing is added until you choose it, and you can come back here any time.")),
      h("button", { class: "btn", onclick: () => App.syncNow() }, icon("sync"), "Sync now")));
    if (!App.configured()) {
      inn.append(h("div", { class: "callout", style: { marginTop: "28px", font: "15px/1.6 var(--ui)" } }, h("div", { class: "ct" }, "Sync is not set up"),
        h("p", { style: { margin: "0 0 14px" } }, "Enter your name and the sync address to see what has been shared and to save your progress online."),
        h("button", { class: "btn pri", onclick: () => App.go("settings") }, "Open Settings")));
      el.append(h("div", { class: "sheet" }, inn)); return;
    }
    if (err) inn.append(h("div", { class: "errbox" }, err));
    if (loading && !D.lib.length) inn.append(h("p", { class: "lead2", style: { marginTop: "28px" } }, "Checking the shared library…"));
    const toAdd = (k) => D.lib.filter((i) => i.kind === k && i.status !== "installed");
    if (D.lib.length) {                                  // lessons and problems are kept apart: pick one, and everything below is about it
      const tabs = h("div", { class: "seg lib-tabs", role: "tablist" }, [["lesson", "Lessons"], ["problem", "Problems"]].map(([k, label]) => {
        const n = toAdd(k).length;
        return h("button", { class: tab === k ? "on" : "", role: "tab", "aria-selected": String(tab === k), onclick: () => { tab = k; Retro.store.set("lib.tab", k); draw(); } }, label, n ? `  \u00b7  ${n} to add` : "");
      }));
      const todo = toAdd(tab).filter((i) => i.status !== "skipped");
      inn.append(h("div", { class: "row lib-bar" }, tabs, h("span", { style: { flex: 1 } }),
        todo.length > 1 ? h("button", { class: "btn", onclick: (e) => { e.currentTarget.disabled = true; addKeys(todo.map((i) => i.key), `all ${todo.length} ${noun(tab, 2)}`); } }, `Add all ${noun(tab, 2)} (${todo.length})`) : null));
    }
    const fs = folders().filter((f) => f.kind === tab);
    const group = (title, list) => { if (list.length) inn.append(h("h2", {}, title, h("span", { class: "chip" }, list.length)), h("div", { class: "lib" }, list.map(folderCard))); };
    const open = (f) => f.items.some((i) => i.status === "new" || i.status === "available");
    const skipped = (f) => !open(f) && f.items.some((i) => i.status === "skipped");
    group("Available to add", fs.filter(open));
    group("Skipped", fs.filter(skipped));
    group("In your collection", fs.filter((f) => !open(f) && !skipped(f)));
    if (!loading && D.lib.length && !fs.length) inn.append(h("p", { class: "lead2", style: { marginTop: "28px" } }, `Nobody has shared any ${tab === "lesson" ? "lessons" : "problems"} yet.`));
    if (!loading && !D.lib.length && !err) inn.append(h("p", { class: "lead2", style: { marginTop: "28px" } }, "The shared library is empty. Anything you add to your lessons or problems folders is shared the next time you sync."));
    el.append(h("div", { class: "sheet" }, inn));
  }
  return { show };
})();

/* ================= Settings ================= */
const Settings = (() => {
  function field(label, hint, input) { return h("div", { class: "field" }, h("label", {}, label), input, hint && h("small", {}, hint)); }
  let prompts = null;
  async function getPrompt(key) { if (!prompts) prompts = await api("prompts"); return prompts[key] || ""; }
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); }
    catch (e) { const ta = h("textarea", { style: { position: "fixed", opacity: 0 } }); ta.value = t; document.body.append(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
  }
  function promptRow(key, label, desc) {
    const box = h("textarea", { class: "promptbox", readonly: true, style: { display: "none" } });
    const copy = h("button", { class: "btn pri", onclick: async () => { await copyText(await getPrompt(key)); toast(`${label} prompt copied. Paste it into your AI chat.`, "ok"); } }, "Copy prompt");
    const view = h("button", { class: "btn", onclick: async () => { const on = box.style.display === "none"; if (on) box.value = await getPrompt(key); box.style.display = on ? "block" : "none"; view.textContent = on ? "Hide" : "Preview"; } }, "Preview");
    return h("div", { class: "field" }, h("label", {}, label), h("small", {}, desc), h("div", { class: "row", style: { marginTop: "6px" } }, copy, view), box);
  }
  function show() {
    const el = clear($("#v-settings")), c = D.cfg, inn = h("div", { class: "in" });
    const name = h("input", { type: "text", value: c.name || "", placeholder: "For example: Maria Santos", onchange: (e) => saveCfg({ name: e.target.value.trim() }) });
    const url = h("input", { type: "text", value: c.sync_url || "", placeholder: "https://script.google.com/macros/s/…/exec", onchange: (e) => saveCfg({ sync_url: e.target.value.trim() }) });
    const sec = h("input", { type: "password", value: c.secret || "", placeholder: "Only if the folder owner set one", onchange: (e) => saveCfg({ secret: e.target.value.trim() }) });
    const seg = h("div", { class: "seg" }, THEMES.map(([t, label]) => h("button", { class: (c.theme || THEMES[0][0]) === t ? "on" : "", onclick: () => { saveCfg({ theme: t }); App.applyLook(); show(); } }, label)));
    const prose = h("input", { type: "range", min: 15, max: 24, step: 1, value: c.font_size || 17, oninput: (e) => { D.cfg.font_size = +e.target.value; App.applyLook(); }, onchange: (e) => saveCfg({ font_size: +e.target.value }) });
    const pw = h("input", { type: "range", min: 560, max: 1600, step: 20, value: c.page_w || 880, oninput: (e) => { D.cfg.page_w = +e.target.value; App.applyLook(); pwl.textContent = e.target.value + " px"; }, onchange: (e) => saveCfg({ page_w: +e.target.value }) });
    const pwl = h("span", { class: "status", style: { marginLeft: "12px" } }, (c.page_w || 880) + " px");
    const edf = h("input", { type: "range", min: 12, max: 22, step: 0.5, value: c.editor_font || 14, oninput: (e) => { D.cfg.editor_font = +e.target.value; App.applyLook(); }, onchange: (e) => saveCfg({ editor_font: +e.target.value }) });
    inn.append(h("h1", {}, "Settings"), h("h2", {}, "You and sync"),
      field("Your name", "Your progress is saved to Drive in a folder with this name. Use the same name on every computer to get your progress back.", name),
      field("Sync address", "The address of the sync script, from whoever owns the Drive folder.", url),
      field("Sync secret (optional)", null, sec),
      h("div", { class: "row", style: { marginBottom: "8px" } }, h("button", { class: "btn pri", onclick: async () => { await saveCfg({ name: name.value.trim(), sync_url: url.value.trim(), secret: sec.value.trim() }); App.syncNow(); } }, icon("sync"), "Save and sync now"),
        h("span", { class: "status" }, c.last_sync ? "Last synced " + c.last_sync : "Not synced yet")),
      h("p", { class: "lead2" }, "Sync saves your scores, finished lesson activities and answers, streaks, and your folder layout (folders, hidden items, pins, icons) to Drive. It runs when you press Sync, a little while after you change something, and when you close the app."),
      h("h2", {}, "Look"), field("Theme", null, seg), field("Lesson text size", null, prose),
      field("Lesson page width", "Wider means smaller side margins in lessons. Drag until it feels right.", h("div", { class: "row" }, pw, pwl)), field("Code editor size", null, edf),
      h("h2", {}, "Your files"),
      h("p", { class: "lead2" }, "Lessons live in the lessons folder and problems in the modules folder next to the app. If you add files there by hand, reload so the app notices them."),
      h("button", { class: "btn", onclick: () => App.reload() }, icon("reset"), "Reload lessons and problems  (Ctrl+L)"),
      h("h2", {}, "Your layout"),
      h("p", { class: "lead2" }, "Your folders, hidden items, pins and custom icons live in one small file. Export it to back it up or move it to another computer, and import it there. This works without syncing."),
      h("div", { class: "row" }, h("button", { class: "btn", onclick: () => Layout.exportFile() }, "Export layout…"), h("button", { class: "btn", onclick: () => Layout.importFile() }, "Import layout…")),
      h("h2", {}, "Ask another AI for more"),
      h("p", { class: "lead2" }, "Copy one of these prompts, paste it into any AI chat, fill in the [BRACKETS], and save the files it gives you. The lesson and problem prompts match this app's formats exactly."),
      promptRow("lesson", "Lessons", "Writes a detailed, step-by-step walkthrough with predictions, quizzes, fill-in-the-blanks and tested code exercises."),
      promptRow("problem", "Problems", "Writes story-driven Judge problems with hidden tests, tiered scoring and reference solutions you can run."),
      promptRow("theme", "Colors and look", "Changes the colors or adds a theme. Only web/themes.css and web/themes.js are edited."),
      h("h2", {}, "Help"),
      h("p", { class: "lead2" }, "The manual is a first-time guide to every screen, the shortcuts, Drive sync, your data files, and how to add lessons and problems."),
      h("button", { class: "btn pri", onclick: () => App.go("manual") }, icon("help"), "Open the manual  (F1)"),
      h("h2", {}, "Keyboard"),
      h("div", { class: "lead2", style: { lineHeight: 2.1 } },
        [["Ctrl+Enter", "run your code without checking"], ["Ctrl+Shift+Enter", "check your answer"], ["Ctrl+/", "comment or uncomment"], ["Ctrl+D", "select the word, then the next match"],
         ["Ctrl+Space", "predict the rest of the word"], ["Tab / Enter", "accept the highlighted prediction"],
         ["Ctrl+Shift+D", "duplicate the line"], ["Ctrl+L", "select the line"], ["Ctrl+Shift+K", "delete the line"], ["Alt+Up / Down", "move the line (also Ctrl+Shift+Up / Down)"],
         ["Ctrl+[  /  Ctrl+]", "unindent / indent"], ["Ctrl+1 … Ctrl+7", "Home, Lessons, Judge, Collection, Library, Streaks, Manual"], ["F1", "open the manual"],
         ["Ctrl+B", "hide or show the list panel"], ["Ctrl+F", "find in code (or search the list)"], ["Ctrl+H", "find and replace in code"], ["F3 / Shift+F3", "next / previous match"]]
          .map(([k, d]) => h("div", {}, h("kbd", {}, k), "  " + d))));
    if (D.errors.length) inn.append(h("h2", {}, "Files that could not be loaded"), h("div", { class: "errbox" }, D.errors.join("\n\n")));
    el.append(h("div", { class: "sheet" }, inn));
  }
  return { show };
})();

/* ================= First-run welcome ================= */
const Welcome = (() => {
  function show() {
    if ($(".modal-bg")) return;
    const name = h("input", { type: "text", placeholder: "Your name", autofocus: true, style: { width: "100%", padding: "12px 14px", background: "var(--panel2)", border: "1px solid var(--line2)", borderRadius: "8px", marginBottom: "12px", fontSize: "16px" } });
    const url = h("input", { type: "text", placeholder: "Sync address (optional, you can add it later)", value: D.cfg.sync_url || "", style: { width: "100%", padding: "12px 14px", background: "var(--panel2)", border: "1px solid var(--line2)", borderRadius: "8px", marginBottom: "12px" } });
    const go = async () => {
      if (!name.value.trim()) { name.focus(); return; }
      await api("sync/setup", { name: name.value, sync_url: url.value });
      D.cfg.name = name.value.trim(); D.cfg.sync_url = url.value.trim();
      bg.remove(); App.go("home"); App.syncNow(true);
    };
    name.addEventListener("keydown", (e) => e.key === "Enter" && go());
    const bg = h("div", { class: "modal-bg" }, h("div", { class: "modal" }, h("h2", {}, "Welcome to Local Judge."),
      h("p", {}, "Your name labels your saved progress, so it can follow you to other computers. With a sync address, new lessons and problems from others show up in the Library."),
      h("p", {}, "New here? The Home screen has a manual that walks through every screen, the shortcuts and Drive sync. You can also press F1 at any time."),
      name, url, h("div", { class: "foot" }, h("button", { class: "btn pri", onclick: go }, "Get started"))));
    document.body.append(bg); setTimeout(() => name.focus(), 50);
  }
  return { show };
})();

App.init().catch((e) => { document.body.prepend(h("div", { class: "errbox", style: { margin: "20px" } }, "Could not start: " + e.message)); });
