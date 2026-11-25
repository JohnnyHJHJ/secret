/* Shared helpers */
const TOK = document.querySelector('meta[name="tok"]').content;
/* Every page load gets its own id. It travels with each request (and with the goodbye
   beacon) so a reload cannot shut the server down for the page that replaced it. */
const PAGE = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "p" + Date.now() + Math.random().toString(36).slice(2);
const D = { cfg: {}, modules: [], courses: [], progress: {}, state: { done: {}, cards: {} }, errors: [], lib: [] };

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}
const $ = (s, r = document) => r.querySelector(s);
const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const norm = (s) => String(s ?? "").replace(/\r\n/g, "\n").split("\n").map((l) => l.replace(/\s+$/, "")).join("\n").replace(/\n+$/, "");

/* The local server can go away (the window stayed open across a sleep, the process was
   closed, ...). Instead of a bare "Failed to fetch" toast forever, every request has a
   deadline, gives a sentence a human can act on, and a banner offers a reload. */
function serverLost() {
  document.body.classList.add("srv-lost");
  if ($("#srvLost")) return;
  const bar = h("div", { id: "srvLost", role: "alert" },
    h("div", { class: "srv-lost-t" }, "Lost contact with Local Judge's local server"),
    h("div", { class: "srv-lost-b" }, "Your work is still on disk. Reload the page; if that does not help, close this window and open Local Judge again."),
    h("div", { class: "srv-lost-a" },
      h("button", { class: "btn pri", onclick: () => location.reload() }, "Reload page")));
  document.body.append(bar);
}
function serverFound() {
  document.body.classList.remove("srv-lost");
  const bar = $("#srvLost");
  if (bar) bar.remove();
}
function netMessage(e, timeout) {
  if (e && e.name === "AbortError") return `The app took longer than ${Math.round(timeout / 1000)} seconds to answer. Press Stop, or try again.`;
  return "Lost contact with the app's local server. Close this window and open Local Judge again.";
}

/* Save data while the page is closing. fetch() may be cancelled on unload, but
   sendBeacon is delivered, so a debounced save is not lost when you close the window.
   keep=1 tells the server not to cancel a pending goodbye. */
function beacon(path, body) {
  try {
    const url = "/api/" + path + "?t=" + encodeURIComponent(TOK) + "&keep=1";
    navigator.sendBeacon(url, new Blob([JSON.stringify(body)], { type: "application/json" }));
  } catch (e) { /* nothing else can be done while the window is closing */ }
}

async function api(path, body, opts) {
  const timeout = (opts && opts.timeout) || 30000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch("/api/" + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { "X-Token": TOK, "X-Page": PAGE, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    serverLost();
    throw new Error(netMessage(e, timeout));
  }
  try {
    let j;
    try { j = await res.json(); }
    catch (e) {
      throw new Error(res.ok ? "The app server did not answer properly. Close this window and open the app again."
        : `The app server answered with an error (${res.status}). See Settings for the files that could not be loaded.`);
    }
    serverFound();
    if (!res.ok) throw new Error((j && j._error) || `The app server answered with an error (${res.status}).`);
    if (j && j._error) throw new Error(j._error);
    if (j && j.streak && typeof Streaks !== "undefined") Streaks.note(j.streak);
    if (j && j.streak && path !== "sync/now" && typeof App !== "undefined" && App.queueSync) App.queueSync();
    return j;
  } finally {
    clearTimeout(timer);
  }
}

function toast(msg, kind = "", action) {
  const t = h("div", { class: "toast " + kind }, h("span", {}, msg));
  if (action) t.append(h("button", { class: "btn", onclick: () => { action.fn(); t.remove(); } }, action.label));
  $("#toasts").append(t);
  setTimeout(() => t.remove(), action ? 9000 : 4500);
}

/* Top-right notice stack: small desktop windows that slide in, like a system tray alert.
   Used for badges (see Streaks) and anything else worth interrupting for. */
const Notify = (() => {
  const box = () => {
    let b = $("#notices");
    if (!b) { b = h("div", { id: "notices", "aria-live": "polite" }); document.body.append(b); }
    return b;
  };
  function show(o = {}) {
    const tone = o.tone || "pink";
    let gone = false, timer;
    const bar = h("div", { class: "fx-title sm " + tone },
      o.icon || null, h("span", { class: "fx-title-text" }, o.title || "Notice"),
      h("button", { class: "fx-x", "aria-label": "Dismiss", onclick: (e) => { e.stopPropagation(); close(); } }, "×"));
    const body = h("div", { class: "nt-body" }, o.body || h("span", {}, o.text || ""));
    const card = h("div", { class: "nt " + tone, role: "status" }, bar, body);
    const close = () => {
      if (gone) return; gone = true; clearTimeout(timer);
      card.classList.add("out"); setTimeout(() => card.remove(), 220);
    };
    if (o.action) body.append(h("div", { class: "nt-actions" },
      h("button", { class: "btn sm pri", onclick: (e) => { e.stopPropagation(); close(); o.action.fn(); } }, o.action.label)));
    if (o.onClick) {
      card.classList.add("click");
      card.addEventListener("click", () => { o.onClick(); close(); });
    }
    const arm = (ms) => { timer = setTimeout(close, ms); };
    card.addEventListener("pointerenter", () => clearTimeout(timer));
    card.addEventListener("pointerleave", () => arm(o.timeout || 7000));
    box().append(card);
    arm(o.timeout || 7000);
    return { close, el: card };
  }
  function badges(list) {
    const many = list.length > 1;
    return show({
      title: many ? `${list.length} BADGES UNLOCKED` : "BADGE UNLOCKED", tone: "pink", timeout: 8500,
      icon: Retro.sprite("star", 16),
      onClick: () => { if (typeof App !== "undefined") App.go("streaks"); },
      body: h("div", { class: "nt-list" }, list.map((b) => h("div", { class: "nt-row" },
        h("span", { class: "nt-ico" + (many ? " sm" : ""), "aria-hidden": "true" }, b.icon || "★"),
        h("div", { class: "nt-text" }, h("b", {}, b.title || "Badge"), h("small", {}, b.desc || "")),
        many ? null : Retro.sprite("heart", 18)))),
    });
  }
  const badge = (b) => badges([b]);
  return { show, badge, badges };
})();

const ICON = {
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
  term: '<path d="M4 17l6-6-6-6"/><path d="M12 19h8"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
  sync: '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M3 21v-5h5M21 3v5h-5"/>',
  gear: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  play: '<path d="M6 4l14 8-14 8z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  flame: '<path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.5 1 2.5 2 3 .5-3-.5-6 1-9.5z"/>',
  heart: '<path d="M12 20.5S3.5 15.1 3.5 8.8A4.3 4.3 0 0 1 11 5.9L12 7l1-1.1a4.3 4.3 0 0 1 7.5 2.9c0 6.3-8.5 11.7-8.5 11.7z"/>',
  computer: '<rect x="4" y="4" width="16" height="12" rx="1.5"/><path d="M9 20h6M12 16v4M7 8h.01M10 8h4"/><path d="M17 11l1.5 1.5L17 14"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/>',
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.6 2.6 0 0 1 5 1.1c0 1.6-2.5 1.9-2.5 3.4"/><path d="M12 17h.01"/>',
};
const icon = (n) => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.innerHTML = ICON[n]; return s; };

/* ---- inline markdown: `code`, **bold**, *italic*, ||spoiler|| ---- */
const INLINE_RE = /\|\|(.+?)\|\||`([^`]+)`|\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|(?<![\w*])\*(?![\s*])([^*]+?)\*(?![\w*])/g;
function inline(text, parent) {
  let pos = 0, m;
  INLINE_RE.lastIndex = 0;
  const found = [];
  while ((m = INLINE_RE.exec(text))) found.push(m);
  for (const m of found) {
    if (m.index > pos) parent.append(text.slice(pos, m.index));
    if (m[1] !== undefined) {
      const sp = h("span", { class: "sp", title: "Click to reveal", onclick: () => sp.classList.toggle("show") });
      inline(m[1], sp); parent.append(sp);
    } else if (m[2] !== undefined) parent.append(h("code", { class: "ic", text: m[2] }));
    else if (m[3] !== undefined) { const s = h("strong"), e = h("em"); inline(m[3], e); s.append(e); parent.append(s); }
    else if (m[4] !== undefined) { const s = h("strong"); inline(m[4], s); parent.append(s); }
    else { const e = h("em"); inline(m[5], e); parent.append(e); }
    pos = m.index + m[0].length;
  }
  if (pos < text.length) parent.append(text.slice(pos));
  return parent;
}

function codeBlock(text, lang) {
  const pre = h("pre", { class: "code" });
  if (!lang || /^(python|py|python3)$/i.test(lang)) pre.innerHTML = highlightPy(text);
  else pre.textContent = text;
  return pre;
}

/* ---- draggable splitter ---- */
function dragger(handle, onMove) {
  handle.addEventListener("pointerdown", (e) => {
    e.preventDefault(); handle.setPointerCapture(e.pointerId);
    const mv = (ev) => onMove(ev), up = () => { handle.removeEventListener("pointermove", mv); handle.removeEventListener("pointerup", up); };
    handle.addEventListener("pointermove", mv); handle.addEventListener("pointerup", up);
  });
}

let statePending = false;          // a lesson-state save is waiting for its debounce
const saveLessonStateNow = () => {
  statePending = false;
  return api("lessons_state", { state: D.state })
    .then(() => { if (typeof App !== "undefined" && App.queueSync) App.queueSync(); })
    .catch(() => {});
};
const _saveLessonState = debounce(saveLessonStateNow, 500);
const saveLessonState = () => { statePending = true; _saveLessonState(); };
/* Called from pagehide: if the debounce has not fired yet, send the data as a beacon. */
const flushLessonState = () => {
  if (!statePending) return;
  statePending = false;
  beacon("lessons_state", { state: D.state });
};
const saveCfg = (patch) => { Object.assign(D.cfg, patch); return api("config", patch).catch(() => {}); };
