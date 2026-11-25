/* Lessons tab */
const Lessons = (() => {
  let cur = null, query = "";
  const view = () => $("#v-lessons");
  const rawLessons = () => D.courses.flatMap((c) => c.lessons.map((l) => ({ ...l, course: c })));
  const allLessons = () => rawLessons().filter((l) => !Org.isHidden("lessons", l.id));
  const doneSet = (lid) => new Set(D.state.done[lid] || []);
  const card = (lid, aid) => ((D.state.cards[lid] ||= {})[aid] ||= {});
  const counts = (l) => { const d = doneSet(l.id); return [l.acts.filter((a) => d.has(a)).length, l.acts.length]; };
  const KIND = { note: "Note", tip: "Tip", warning: "Watch out", danger: "Danger", key: "Key idea", goal: "Goals", recap: "Recap", example: "Example" };

  /* ---------------- sidebar ---------------- */
  const contButton = () => {
    const t = Resume.lessonTarget();
    return t ? h("button", { class: "btn pri cont-btn", title: `Continue where you left off: ${t.title}`, onclick: () => Resume.go(t) }, "▶ Continue", h("span", { class: "ct" }, t.title)) : null;
  };
  function renderSide() {
    const side = clear($("#side"));
    const all = allLessons();
    const tot = all.reduce((a, l) => a + l.acts.length, 0), dn = all.reduce((a, l) => a + counts(l)[0], 0);
    const search = h("input", { class: "search", type: "search", placeholder: "Search lessons", value: query, id: "lessonSearch",
      oninput: (e) => { query = e.target.value.toLowerCase(); fillTree(); } });
    side.append(h("div", { class: "side-head" }, h("h3", { class: "side-title" }, "Lessons"),
      h("div", { class: "side-sub" }, `${dn} of ${tot} activities done`),
      h("div", { class: "bar" }, h("i", { style: { width: (tot ? (100 * dn / tot) : 0) + "%" } })), contButton(), search));
    const tree = h("div", { class: "tree", id: "lessonTree" });
    side.append(tree);
    fillTree();
  }
  function fillTree() {
    const tree = clear($("#lessonTree"));
    const pred = query ? (it) => (it.title + " " + it.ref.summary + " " + it.auto.join(" ")).toLowerCase().includes(query) : null;
    const nodes = Org.tree("lessons", { pred });
    if (!nodes.length) { tree.append(h("div", { class: "side-sub", style: { padding: "16px" } }, query ? "No lessons match." : "No lessons to show. Add some from the Library, or unhide them in the Collection.")); return; }
    const mkItem0 = (it) => {
      const l = it.ref, [a, b] = counts(l), full = b && a === b;
      return h("button", { class: "item" + sideColor(it) + (cur && cur.id === l.id ? " on" : ""), "data-id": l.id, onclick: () => open_(l.id) },
        h("span", { class: "dot " + (full ? "full" : a ? "part" : "") }), sideGlyph(it, "lessons"), h("span", { class: "tt" }, l.title), h("span", { class: "sc" + (full ? " full" : "") }, b ? `${a}/${b}` : ""));
    };
    const mkItem = (it) => {
      const el = mkItem0(it);
      el.addEventListener("contextmenu", (ev) => { ev.preventDefault(); popMenu(el, [{ label: it.pinned ? "Unpin from top" : "Pin to top", fn: () => Org.setItemMeta("lessons", it.id, { pinned: !it.pinned }) }], ev); });
      return el;
    };
    if (!query) {                                        // pinned and recently opened lessons sit above the folders
      const everything = Org.items("lessons").filter((it) => !Org.isHidden("lessons", it.id));
      const pinned = everything.filter((it) => it.pinned);
      const recent = (D.cfg.recent_lessons || []).map((id) => everything.find((it) => it.id === id)).filter((it) => it && !it.pinned).slice(0, 4);
      const sec = (title, list) => { if (!list.length) return; tree.append(h("div", { class: "side-grp" }, title)); list.forEach((it) => { const el = mkItem(it); el.style.setProperty("--d", 0); tree.append(el); }); };
      sec("Pinned", pinned); sec("Recent", recent);
      if (pinned.length || recent.length) tree.append(h("div", { class: "side-sep" }));
    }
    renderSideTree(tree, nodes, mkItem, "lessons");
  }

  /* ---------------- page ---------------- */
  function open_(id, top = true, opts = {}) {
    const l = rawLessons().find((x) => x.id === id) || allLessons()[0];
    const root = clear(view());
    if (!l) {
      root.append(h("div", { class: "empty" }, h("h3", {}, "No lessons yet"), h("p", {}, "Open the Library to add lessons that others have shared, or put lesson files in the lessons folder."),
        h("button", { class: "btn pri", onclick: () => App.go("library") }, "Open the Library")));
      return;
    }
    cur = l;
    saveCfg({ last_lesson: l.id, last_open: "lessons", recent_lessons: [l.id, ...(D.cfg.recent_lessons || []).filter((x) => x !== l.id)].slice(0, 8), activity_updated: Date.now() });
    if (typeof App !== "undefined" && App.queueSync) App.queueSync();
    $("#side") && renderSide();
    const [a, b] = counts(l);
    const page = h("div", { class: "page" });
    const body = h("div", { class: "prose" });
    const meta = h("div", { class: "metaline" });
    page.append(h("div", { class: "crumb" }, l.course.title), h("h1", {}, l.title));
    if (l.summary) page.append(h("p", { class: "lead" }, l.summary));
    if (l.minutes) meta.append(h("span", { class: "chip" }, `${l.minutes} min`));
    meta.append(h("span", { class: "chip" + (b && a === b ? " ok" : ""), id: "lessonChip" }, b ? `${a} of ${b} activities done` : "Reading only"),
      h("span", { class: "grow", style: { flex: 1 } }),
      h("button", { class: "btn quiet", onclick: reset }, icon("reset"), "Reset lesson"));
    page.append(meta, body);
    const ctx = { lid: l.id };
    const blocks = l.blocks.slice();
    if (blocks[0] && blocks[0].t === "heading" && blocks[0].text.trim().toLowerCase() === l.title.trim().toLowerCase()) blocks.shift();
    renderBlocks(blocks, body, ctx);
    const list = allLessons(), i = list.findIndex((x) => x.id === l.id);
    page.append(h("div", { class: "lesson-nav" },
      i > 0 ? h("button", { class: "btn", onclick: () => open_(list[i - 1].id) }, "Previous: " + list[i - 1].title) : h("span"),
      i < list.length - 1 ? h("button", { class: "btn pri", onclick: () => open_(list[i + 1].id) }, "Next: " + list[i + 1].title) : h("span")));
    const sc = h("div", { id: "lessonScroll" }, page);
    root.append(sc);
    if (top) sc.scrollTop = 0;
    if (opts.resume) {                                   // pick up at the first activity you have not finished
      const dn = doneSet(l.id), nxt = l.acts.find((x) => !dn.has(x)), el = nxt && dn.size ? document.getElementById("act-" + nxt) : null;
      if (el) requestAnimationFrame(() => el.scrollIntoView({ block: "center" }));
    }
  }

  function refreshProgress() {
    if (!cur) return;
    const [a, b] = counts(cur), chip = $("#lessonChip");
    if (chip) { chip.textContent = b ? `${a} of ${b} activities done` : "Reading only"; chip.className = "chip" + (b && a === b ? " ok" : ""); }
    renderSide();
  }
  function markDone(lid, aid) {
    const l = (D.state.done[lid] ||= []);
    if (!l.includes(aid)) l.push(aid);
    saveLessonState(); refreshProgress();
  }
  function reset() {
    if (!cur || !confirm(`Reset "${cur.title}"? Your answers and progress in this lesson will be cleared.`)) return;
    delete D.state.done[cur.id]; delete D.state.cards[cur.id];
    saveLessonState(); open_(cur.id, false);
  }

  /* ---------------- blocks ---------------- */
  function renderBlocks(blocks, parent, ctx) {
    for (const b of blocks) {
      const fn = R[b.t];
      if (fn) fn(b, parent, ctx);
    }
  }
  const R = {
    heading: (b, p) => p.append(inline(b.text, h("h" + Math.min(4, Math.max(2, b.level === 1 ? 2 : b.level))))),
    para: (b, p) => p.append(inline(b.text, h("p"))),
    hr: (b, p) => p.append(h("hr")),
    quote: (b, p) => p.append(inline(b.text, h("blockquote"))),
    code: (b, p) => p.append(codeBlock(b.text, b.lang)),
    list(b, p) {
      const stack = [];
      for (const it of b.items) {
        while (stack.length && stack[stack.length - 1].level > it.level) stack.pop();
        if (!stack.length || stack[stack.length - 1].level < it.level) {
          const el = h(it.ordered ? "ol" : "ul");
          if (it.ordered && it.num && it.num !== "1" && !stack.length) el.setAttribute("start", it.num);
          if (stack.length) (stack[stack.length - 1].li || stack[stack.length - 1].el).append(el); else p.append(el);
          stack.push({ level: it.level, el, li: null });
        }
        const top = stack[stack.length - 1], li = inline(it.text, h("li"));
        top.el.append(li); top.li = li;
      }
    },
    table(b, p) {
      const t = h("table", {}, h("thead", {}, h("tr", {}, b.header.map((c) => inline(c, h("th"))))));
      const tb = h("tbody"); for (const r of b.rows) tb.append(h("tr", {}, r.map((c) => inline(c, h("td")))));
      t.append(tb); p.append(h("div", { style: { overflowX: "auto" } }, t));
    },
    callout(b, p, ctx) {
      const c = h("div", { class: "callout " + b.kind }, h("div", { class: "ct" }, b.title || KIND[b.kind] || "Note"));
      renderBlocks(b.blocks, c, ctx); p.append(c);
    },
    hint(b, p, ctx) { p.append(hintBar(b, 0, false, () => {})); },
    explain(b, p, ctx) { p.append(whyBox(b, ctx)); },
    quiz: (b, p, ctx) => p.append(Activity.quiz(b, ctx)),
    predict: (b, p, ctx) => p.append(Activity.predict(b, ctx)),
    fill: (b, p, ctx) => p.append(Activity.fill(b, ctx)),
    exercise: (b, p, ctx) => p.append(Activity.exercise(b, ctx)),
  };

  /* A click-to-reveal box: a label row that is always visible, and the content underneath once opened. Used for hints and the solution. */
  function reveal(label, note, shown, onToggle, tone) {
    const body = h("div", { class: "rv-b" }), sub = h("span", { class: "rv-s" });
    const head = h("button", { type: "button", class: "rv-h" }, h("span", { class: "rv-l" }, label), note ? h("span", { class: "rv-n" }, note) : null, sub);
    const el = h("div", { class: "rv" + (tone ? " " + tone : "") + (shown ? " show" : "") }, head, body);
    const paint = () => { const on = el.classList.contains("show"); head.setAttribute("aria-expanded", String(on)); sub.textContent = on ? "hide" : "click to reveal"; };
    head.addEventListener("click", () => { el.classList.toggle("show"); paint(); onToggle(el.classList.contains("show")); });
    paint();
    return { el, body };
  }
  function hintBar(hb, n, shown, onToggle) {          // n = 0 for a hint written in the lesson text (it keeps its own title, e.g. "Answer")
    const r = reveal(n ? `Hint ${n}` : hb.title || "Hint", "", shown, onToggle);
    renderBlocks(hb.blocks, r.body, {});
    return r.el;
  }
  /* The solution of an exercise (or the completed code of a fill-in-the-blanks). The text is only fetched when it is opened. */
  function solutionBar(b, ctx, stt, onShow) {
    let state = "idle";
    const r = reveal("Solution", "try on your own first!", !!stt().sol, (on) => { stt().sol = on; saveLessonState(); if (on) load(); onShow(); }, "sol");
    async function load() {
      if (state !== "idle") return;
      state = "loading"; clear(r.body).append(h("div", { class: "status" }, "Loading…"));
      try {
        const code = b.t === "fill" ? b.code : (await api("lesson/solution", { lid: ctx.lid, aid: b.id })).solution;
        clear(r.body).append(codeBlock(code || "(no solution provided)", "python")); state = "ready";
      } catch (e) { clear(r.body).append(h("div", { class: "status err" }, e.message)); state = "idle"; }
    }
    if (stt().sol) load();
    return r.el;
  }
  function whyBox(b, ctx) {
    const w = h("div", { class: "why" }, h("div", { class: "wt" }, "Why"));
    renderBlocks(b.blocks, w, ctx); return w;
  }

  /* ---------------- activities ---------------- */
  const Activity = {};
  function frame(b, ctx, label) {
    const done = () => doneSet(ctx.lid).has(b.id);
    const st = h("span", { class: "st" });
    const el = h("div", { class: "act" + (done() ? " done" : ""), id: "act-" + b.id });
    const body = h("div", { class: "act-b" });
    const pr = h("div", { class: "act-p" }); renderBlocks(b.prompt || [], pr, ctx);
    if (pr.childNodes.length) body.append(pr);
    el.append(h("div", { class: "act-h" }, h("span", {}, label), st), body);
    const whyHolder = h("div");
    const F = { el, body, done, why() {
      clear(whyHolder);
      if (b.explain && (done() || card(ctx.lid, b.id).sol)) whyHolder.append(whyBox(b.explain, ctx));      // the explanation shows once it is done, or when you open the solution
    }, finish() {
      if (!done()) markDone(ctx.lid, b.id);
      el.classList.add("done"); st.replaceChildren(h("span", { class: "chip ok" }, "Done")); F.why();
    } };
    if (done()) { st.append(h("span", { class: "chip ok" }, "Done")); }
    // help: the hints, plus the solution when the activity has one
    const hasSol = (b.t === "exercise" && b.has_solution) || (b.t === "fill" && !!b.code);
    if ((b.hints && b.hints.length) || hasSol) {
      const hb = h("div", { class: "hb" });
      const stt = () => card(ctx.lid, b.id);
      (b.hints || []).forEach((hh, i) => hb.append(hintBar(hh, i + 1, (stt().hints || []).includes(i), (on) => {
        const c = stt(); const s = new Set(c.hints || []); on ? s.add(i) : s.delete(i); c.hints = [...s]; saveLessonState();
      })));
      if (hasSol) hb.append(solutionBar(b, ctx, stt, () => F.why()));
      hb.style.display = stt().help ? "grid" : "none";
      const tg = h("button", { class: "btn quiet", onclick: () => {
        const c = stt(); c.help = !c.help; hb.style.display = c.help ? "grid" : "none"; tg.firstChild.nodeValue = c.help ? "Hide help" : "Need help?"; saveLessonState();
      } }, stt().help ? "Hide help" : "Need help?");
      F.help = h("div", { class: "help" }, tg, hb);
    }
    F.mount = () => { if (F.help) body.append(F.help); body.append(whyHolder); F.why(); return el; };
    return F;
  }
  const norm1 = (s) => String(s).trim().replace(/\s+/g, " ");

  Activity.quiz = (b, ctx) => {
    const F = frame(b, ctx, "Quick check");
    const multi = b.options.filter((o) => o[1]).length > 1;
    const stt = () => card(ctx.lid, b.id);
    let sel = new Set(stt().sel || []);
    const wrap = h("div", { class: "opts" }), msg = h("span", { class: "status" });
    const paint = (reveal) => {
      [...wrap.children].forEach((el, i) => {
        const correct = b.options[i][1];
        el.className = "opt" + (multi ? " multi" : "") + (F.done() ? " lock" : "");
        if (F.done() && correct) el.classList.add("good");
        else if (sel.has(i)) el.classList.add(reveal ? (correct ? "good" : "bad") : "sel");
        el.firstChild.textContent = el.classList.contains("good") ? "✓" : el.classList.contains("bad") ? "✕" : "";
      });
    };
    b.options.forEach((o, i) => wrap.append(h("button", { class: "opt", onclick: () => {
      if (F.done()) return;
      if (!multi) {
        sel = new Set([i]);
        if (o[1]) { stt().sel = [...sel]; msg.textContent = "Correct."; msg.className = "status ok"; F.finish(); paint(true); }
        else { msg.textContent = "Not quite. Try another option."; msg.className = "status err"; paint(true); sel = new Set(); setTimeout(() => paint(false), 700); }
      } else { sel.has(i) ? sel.delete(i) : sel.add(i); stt().sel = [...sel]; saveLessonState(); msg.textContent = ""; paint(false); }
    } }, h("span", { class: "mk" }), h("span", {}, inline(o[0], h("span"))))));
    F.body.append(wrap);
    if (multi) {
      F.body.append(h("div", { class: "actions" }, h("button", { class: "btn pri", onclick: () => {
        if (F.done()) return;
        const ok = b.options.every((o, i) => o[1] === sel.has(i));
        if (ok) { msg.textContent = "Correct."; msg.className = "status ok"; F.finish(); paint(true); }
        else { msg.textContent = "Not quite. This one has more than one right answer."; msg.className = "status err"; paint(true); setTimeout(() => paint(false), 900); }
      } }, "Check"), msg, h("span", { class: "status" }, F.done() ? "" : "Select all that apply.")));
    } else F.body.append(h("div", { class: "actions" }, msg));
    paint(false);
    return F.mount();
  };

  Activity.predict = (b, ctx) => {
    const F = frame(b, ctx, "Predict the output");
    const stt = () => card(ctx.lid, b.id);
    F.body.append(codeBlock(b.code, "python"));
    const ta = h("textarea", { class: "ans", placeholder: "Type exactly what this program prints", spellcheck: false, value: stt().ans || "",
      oninput: (e) => { stt().ans = e.target.value; ta.className = "ans"; saveLessonState(); } });
    ta.value = stt().ans || "";
    const msg = h("span", { class: "status" }), outHolder = h("div");
    const actual = async () => { const r = await api("lesson/predict", { lid: ctx.lid, aid: b.id }); return r; };
    const check = async () => {
      let want = b.answer;
      if (want === null || want === undefined) want = (await actual()).stdout;
      if (norm(ta.value) === norm(want)) { ta.className = "ans good"; msg.textContent = "That's exactly right."; msg.className = "status ok"; F.finish(); }
      else { ta.className = "ans bad"; msg.textContent = "Not the same as the real output. Check spaces, quotes and blank lines."; msg.className = "status err"; }
    };
    const reveal = async () => {
      msg.textContent = "Running…"; msg.className = "status";
      const r = await actual();
      msg.textContent = ""; clear(outHolder).append(h("div", { class: "out" }, h("div", { class: "oh" }, "Real output"), h("pre", {}, r.stdout || "(nothing printed)"), r.error ? h("pre", { class: "e" }, r.error) : null));
    };
    F.body.append(ta, h("div", { class: "actions" }, h("button", { class: "btn pri", onclick: check }, "Check"), h("button", { class: "btn", onclick: reveal }, "Show the real output"), msg), outHolder);
    return F.mount();
  };

  Activity.fill = (b, ctx) => {
    const F = frame(b, ctx, "Fill in the blanks");
    const stt = () => card(ctx.lid, b.id);
    const inputs = [], saved = stt().fill || [];
    const box = h("div", { class: "fillbox" });
    let n = 0;
    b.lines.forEach((parts, li) => {
      const line = h("div");
      if (!parts.length) line.append(h("br"));
      for (const [kind, val] of parts) {
        if (kind === "t") line.append(h("span", { html: highlightPy(val) }));
        else {
          const idx = n++, inp = h("input", { type: "text", size: Math.max(4, (val[0] || "").length + 2), spellcheck: false, autocomplete: "off",
            oninput: () => { inp.className = ""; const a = inputs.map((i) => i.el.value); stt().fill = a; saveLessonState(); } });
          inp.value = saved[idx] || ""; inputs.push({ el: inp, ok: val }); line.append(inp);
        }
      }
      box.append(line);
    });
    const msg = h("span", { class: "status" });
    const check = () => {
      let good = 0;
      for (const i of inputs) { const ok = i.ok.some((a) => norm1(a) === norm1(i.el.value)); i.el.className = ok ? "good" : "bad"; good += ok; }
      if (good === inputs.length) { msg.textContent = "All blanks correct."; msg.className = "status ok"; F.finish(); }
      else { msg.textContent = `${good} of ${inputs.length} blanks correct.`; msg.className = "status err"; }
    };
    if (F.done()) inputs.forEach((i) => { i.el.value = i.el.value || i.ok[0]; i.el.className = "good"; });
    F.body.append(box, h("div", { class: "actions" }, h("button", { class: "btn pri", onclick: check }, "Check"), msg));
    return F.mount();
  };

  Activity.exercise = (b, ctx) => {
    const tryIt = !b.has_tests;
    const F = frame(b, ctx, tryIt ? "Try it" : "Write code");
    const stt = () => card(ctx.lid, b.id);
    const save = debounce(saveLessonState, 400);
    const ed = new CodeEditor({ value: stt().code ?? b.starter, minLines: 5, maxLines: 24,
      onChange: (v) => { stt().code = v; save(); }, onRun: () => go("run"), onCheck: () => go(tryIt ? "run" : "check") });
    const msg = h("span", { class: "status" }), res = h("div");
    const runBtn = h("button", { class: "btn" + (tryIt ? " pri" : ""), onclick: () => go("run") }, icon("play"), "Run", h("kbd", {}, "Ctrl+Enter"));
    const chkBtn = tryIt ? null : h("button", { class: "btn pri", onclick: () => go("check") }, icon("check"), "Check", h("kbd", {}, "Ctrl+Shift+Enter"));
    const rst = h("button", { class: "btn quiet", onclick: () => { ed.setValue(b.starter); stt().code = b.starter; saveLessonState(); } }, icon("reset"), "Reset");
    if (b.files && b.files.length) F.body.append(h("div", { class: "hintline" }, "Files available to your code: ", b.files.join(", ")));
    F.body.append(ed.el, h("div", { class: "actions" }, runBtn, chkBtn, rst, msg), res);
    let busy = false;
    async function go(mode) {
      if (busy) return; busy = true; msg.textContent = mode === "check" ? "Checking…" : "Running…"; msg.className = "status";
      try {
        const r = await api("lesson/run", { lid: ctx.lid, aid: b.id, code: ed.getValue(), mode });
        show(r, mode);
      } catch (e) { msg.textContent = e.message; msg.className = "status err"; } finally { busy = false; }
    }
    function show(r, mode) {
      const o = h("div", { class: "out" });
      const hasOut = (r.stdout || "").length > 0;
      o.append(h("div", { class: "oh" }, "Output"), h("pre", { class: hasOut ? "" : "m" }, hasOut ? r.stdout : "(nothing printed)"));
      if (r.error) o.append(h("pre", { class: "e" }, r.error));
      if (r.files && Object.keys(r.files).length && (b.files.length || Object.keys(r.files).length))
        for (const [n, c] of Object.entries(r.files)) o.append(h("div", { class: "oh" }, "File: " + n), h("pre", {}, c));
      if (mode === "check" && r.checks && r.checks.length) {
        const ck = h("div", { class: "checks" });
        for (const c of r.checks) {
          ck.append(h("div", { class: "c " + (c.ok ? "y" : "n") }, h("b", {}, c.ok ? "✓" : "✕"), h("div", {}, c.name,
            !c.ok ? h("div", { class: "d" }, c.error ? c.error : `expected: ${c.expected}\ngot:      ${c.got}`) : null)));
        }
        o.append(h("div", { class: "oh" }, "Checks"), ck);
      }
      clear(res).append(o);
      if (mode === "check") {
        if (r.passed) { msg.textContent = "All checks passed."; msg.className = "status ok"; F.finish(); }
        else { msg.textContent = r.status === "ok" ? "Some checks failed." : "Your code stopped with an error."; msg.className = "status err"; }
      } else if (r.status === "ok") {
        msg.textContent = "Ran without errors."; msg.className = "status ok";
        if (tryIt) F.finish();
      } else { msg.textContent = "Your code stopped with an error."; msg.className = "status err"; }
    }
    return F.mount();
  };

  return {
    renderSide, open: open_, refresh() { renderSide(); open_(cur ? cur.id : D.cfg.last_lesson, false); },
    show() { if (!cur) open_(D.cfg.last_lesson); else renderSide(); }, focusSearch() { const s = $("#lessonSearch"); s && s.focus(); },
    flushState: () => flushLessonState(),   // called on pagehide, before the goodbye
  };
})();
