/* Retro toolkit: pixel sprites, desktop-style dialogs, title bars, segmented bars, LCD clock.
   Shared by the Collection file manager and the Streaks dashboard. Colors come from retro.css. */
const Retro = (() => {
  const rep = (c, n) => c.repeat(n);
  const mirror = (rows) => rows.map((r) => r + [...r].reverse().join(""));

  /* Sprite legend: o outline, b main color, l light, d dark, w white, k black, y yellow, g green, s/S greys */
  const SPR = {
    folder: { color: "lemon", rows: ["..oooooo........", ".ollllllo.......", ".o" + rep("l", 7) + rep("o", 7), ".o" + rep("l", 13) + "o",
      ...Array(8).fill(".ol" + rep("b", 11) + "do"), ".o" + rep("d", 13) + "o", "." + rep("o", 15)] },
    heart: { color: "pink", rows: mirror(["........", "..oooo..", ".ollllo.", "olwwlbbb", "olwlbbbb", "olllbbbb", ".olbbbbb", "..obbbbb", "...obbbb", "....obbd", ".....obd", "......oo"]) },
    star: { color: "lemon", rows: mirror([".......o", "......ol", "......ob", "oooooolb", "olllllbb", ".olllbbb", "..olbbbb", "..obbbbb", ".obbbboo", "obbbdo..", "obdoo...", "oooo...."]) },
    smile: { color: "lemon", rows: mirror(["....ooo", "..oolll", ".olllbb", ".obbkbb", "obbbkbb", "obbbbbb", "obkbbbb", "obbkbbb", "obbbkkk", ".obbbbb", ".oobbbb", "..ooddd", "....ooo"]) },
    cd: { color: "lilac", rows: mirror(["....ooo", "..oobbb", ".obbbbb", ".obwwbb", "obwbbbb", "obbbboo", "obbbo..", "obbbo..", "obbbboo", "obbbbbb", ".obbbbb", ".oobbbb", "..oobbb", "....ooo"]) },
    floppy: { color: "blue", rows: ["o".repeat(14), "obbssssssssbbo", "obbsssssoosbbo", "obbssssssssbbo", "obbssssssssbbo", "o" + rep("b", 12) + "o", "o" + "b" + rep("w", 10) + "bo",
      "obwkkkkkkkkwbo", "o" + "b" + rep("w", 10) + "bo", "obwkkkkkkwwwbo", "o" + "b" + rep("w", 10) + "bo", "o" + "b" + rep("w", 10) + "bo", "o" + rep("b", 12) + "o", "o".repeat(14)] },
    terminal: { color: "blue", rows: ["o".repeat(14), "o" + rep("b", 11) + "wo", "o" + rep("b", 12) + "o", "o" + rep("k", 12) + "o", "okgkkkkkkkkkko", "okkgkkkkkkkkko", "okgkkkgggkkkko",
      "o" + rep("k", 12) + "o", "o" + rep("k", 12) + "o", "o".repeat(14)] },
    book: { color: "pink", rows: ["o".repeat(12), "obbwwwwwwwwo", "obbwkkkkkkwo", "obbwwwwwwwwo", "obbwkkkkkwwo", "obbwwwwwwwwo", "obbwkkkkkkwo", "obbwwwwwwwwo", "obbwkkkkwwwo", "obbwwwwwwwwo", "o".repeat(12)] },
    lock: { color: "gray", rows: mirror(["...ooo", "..oSSS", "..oS..", "..oS..", "oooooo", "obbbbb", "obbbbk", "obbbbk", "obbbbb", "obbbbb", "oooooo"]) },
    bin: { color: "gray", rows: ["....oooo....", "o".repeat(12), ".o" + "sSsSsSsS" + "o.", ".o" + "sSsSsSsS" + "o.", ".o" + "sSsSsSsS" + "o.", ".o" + "sSsSsSsS" + "o.", ".o" + "sSsSsSsS" + "o.", "." + rep("o", 10) + "."] },
    flame: { color: "orange", rows: mirror(["......o", "......o", ".....ob", ".....ob", "....obb", "...obbb", "..obbby", "..obbyy", ".obbbyy", ".obbyyy", "obbbyyy", "obbyyyy", "obbyyyy", "obbbyyy", ".obbbyy", "..oobbb", "....ooo"]) },
  };
  const PRESETS = [["folder", "Folder"], ["heart", "Heart"], ["star", "Star"], ["smile", "Smiley"], ["floppy", "Floppy"], ["cd", "CD"], ["terminal", "Terminal"], ["book", "Notebook"]];
  const COLORS = [["lemon", "Lemon"], ["pink", "Pink"], ["orange", "Orange"], ["mint", "Mint"], ["blue", "Blue"], ["lilac", "Lilac"], ["red", "Cherry"], ["gray", "Slate"]];
  const EMOJI = ["📚", "💻", "🧠", "⭐", "💖", "🔥", "🎯", "🧩", "🎮", "🎵", "📝", "🔬", "🧪", "🚀", "🌈", "🍀", "🌸", "🐱", "🐶", "🦋", "🍓", "🍪", "☕", "🌙", "☀️", "⚡", "🔒", "🏆", "📌", "🎓", "🧸", "👾"];

  const NS = "http://www.w3.org/2000/svg";
  /* sprite(name, px, color) -> <svg>; the rows are centered inside a 16x16 grid */
  function sprite(name, px = 32, color) {
    const s = SPR[name] || SPR.folder, W = 16, H = 16, top = Math.floor((H - s.rows.length) / 2), out = [];
    s.rows.forEach((row, y) => {
      const left = Math.floor((W - row.length) / 2);
      for (let x = 0; x < row.length;) {
        const c = row[x]; let n = 1;
        while (x + n < row.length && row[x + n] === c) n++;
        if (c !== ".") out.push(`<rect x="${left + x}" y="${top + y}" width="${n}" height="1" class="p-${c}"/>`);
        x += n;
      }
    });
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 16 16"); svg.setAttribute("width", px); svg.setAttribute("height", px);
    svg.setAttribute("class", "px fc-" + (color || s.color)); svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = out.join("");
    return svg;
  }

  /* One glyph for a folder: preset sprite ("px:heart"), an emoji, or the default folder. */
  function folderGlyph(n, px = 32) {
    const ic = n.icon || "", color = n.color || (n.auto ? "gray" : undefined);
    if (ic.startsWith("px:") && SPR[ic.slice(3)]) return sprite(ic.slice(3), px, color);
    if (ic) return h("span", { class: "fx-emoji", style: { fontSize: Math.round(px * 0.78) + "px", width: px + "px", height: px + "px" }, "aria-hidden": "true" }, ic);
    return sprite("folder", px, color);
  }

  /* ---------- window pieces ---------- */
  const ctl = () => h("span", { class: "fx-ctl", "aria-hidden": "true" }, h("i", {}, "_"), h("i", {}, "▢"), h("i", {}, "×"));
  const titleBar = (text, o = {}) => h("div", { class: "fx-title " + (o.tone || "navy") }, o.icon || null, h("span", { class: "fx-title-text" }, text), o.extra || null, o.noCtl ? null : ctl());

  /* Desktop-style dialog. Buttons: [{label, primary, fn}]; fn may return false to stay open. Resolves via onClose. */
  function win({ title, body, buttons = [], width = 420, tone = "pink", icon, onClose }) {
    const prev = document.activeElement;
    const bg = h("div", { class: "modal-bg fx-modal-bg" });
    let closed = false;
    const close = (v) => {
      if (closed) return; closed = true;
      bg.remove(); document.removeEventListener("keydown", esc, true);
      if (prev && prev.focus) try { prev.focus(); } catch (e) { /* ignore */ }
      onClose && onClose(v);
    };
    const esc = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(undefined); } };
    const foot = h("div", { class: "fx-dlg-foot" }, buttons.map((b) => h("button", { class: "btn" + (b.primary ? " pri" : ""), onclick: () => { const r = b.fn ? b.fn() : undefined; if (r !== false) close(r); } }, b.label)));
    const dlg = h("div", { class: "fx-dlg", role: "dialog", "aria-label": title, style: { width: `min(${width}px, 94vw)` } },
      h("div", { class: "fx-title " + tone }, icon || null, h("span", { class: "fx-title-text" }, title), h("button", { class: "fx-x", "aria-label": "Close", onclick: () => close(undefined) }, "×")),
      h("div", { class: "fx-dlg-body" }, body), buttons.length ? foot : null);
    bg.addEventListener("pointerdown", (e) => { if (e.target === bg) close(undefined); });
    bg.append(dlg); document.body.append(bg);
    document.addEventListener("keydown", esc, true);
    return { close, el: dlg };
  }

  const confirmBox = (title, message, okLabel = "OK", danger = false) => new Promise((res) => {
    win({ title, tone: danger ? "red" : "pink", width: 400, icon: sprite(danger ? "bin" : "heart", 18),
      body: h("p", { class: "fx-msg" }, message), onClose: (v) => res(v === true),
      buttons: [{ label: okLabel, primary: true, fn: () => true }, { label: "Cancel", fn: () => "no" }] });
  });

  /* ---------- small widgets ---------- */
  /* Segmented bar like the "Loading…" window: n blocks, the first round(pct*n/100) are filled. */
  function segBar(pct, n = 20, cls = "") {
    const on = Math.round((Math.max(0, Math.min(100, pct)) * n) / 100);
    return h("div", { class: "fx-seg " + cls, role: "progressbar", "aria-valuenow": Math.round(pct), "aria-valuemin": 0, "aria-valuemax": 100 }, Array.from({ length: n }, (_, i) => h("i", { class: i < on ? "on" : "" })));
  }

  /* LCD date/time tile for the rail, like the DATE / TIME widget in the reference. */
  function clock() {
    const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const d = h("b", { class: "lcd-d" }), t = h("b", { class: "lcd-t" });
    const el = h("div", { class: "lcd", title: "Date and time", "aria-label": "Date and time" }, h("small", {}, "DATE / TIME"), d, t);
    const p2 = (n) => String(n).padStart(2, "0");
    const tick = () => {
      if (!el.isConnected && el.dataset.live) { clearInterval(iv); return; }
      const n = new Date(); el.dataset.live = "1";
      d.textContent = `${p2(n.getMonth() + 1)}.${p2(n.getDate())} ${DAYS[n.getDay()]}`;
      t.textContent = `${p2(n.getHours())}:${p2(n.getMinutes())}`;
    };
    const iv = setInterval(tick, 15000); tick();
    return el;
  }

  const store = {
    get(k, d) { try { const v = localStorage.getItem("cs11." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("cs11." + k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };

  return { sprite, folderGlyph, titleBar, win, confirmBox, segBar, clock, store, PRESETS, COLORS, EMOJI, SPR };
})();
