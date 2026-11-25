/* Judge tab */
const Judge = (() => {
  let cur = null, ed = null, query = "", built = false, busy = false, runKey = "";
  let save = null;          // pending code save, tied to the problem the code was typed in
  let epoch = 0;            // bumped whenever the shown problem changes, so old replies are dropped
  const newKey = () => "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const view = () => $("#v-judge");
  const rawAll = () => D.modules.flatMap((m) => m.problems.map((p) => ({ ...p, module: m })));
  const all = () => rawAll().filter((p) => !Org.isHidden("problems", p.iid));
  const best = (p) => D.progress[p.iid];
  const isFull = (p) => best(p) !== undefined && p.points > 0 && best(p) >= p.points;
  const scoreText = (p) => (best(p) === undefined ? `${p.points} pts` : `${best(p)}/${p.points}`);

  /* ---------------- sidebar ---------------- */
  function renderSide() {
    const side = clear($("#side")), ps = all(), solved = ps.filter(isFull).length;
    side.append(h("div", { class: "side-head" }, h("h3", { class: "side-title" }, "Problems"),
      h("div", { class: "side-sub", id: "solvedTxt" }, `${solved} of ${ps.length} solved`),
      h("div", { class: "bar" }, h("i", { id: "solvedBar", style: { width: (ps.length ? 100 * solved / ps.length : 0) + "%" } })),
      h("input", { class: "search", type: "search", id: "probSearch", placeholder: "Search problems", value: query, oninput: (e) => { query = e.target.value.toLowerCase(); fillTree(); } })));
    side.append(h("div", { class: "tree", id: "probTree" }));
    fillTree();
  }
  function fillTree() {
    const tree = clear($("#probTree"));
    const pred = query ? (it) => it.title.toLowerCase().includes(query) : null;
    const nodes = Org.tree("problems", { pred });
    if (!nodes.length) { tree.append(h("div", { class: "side-sub", style: { padding: "16px" } }, query ? "No problems match." : "No problems to show. Add some from the Library, or unhide them in the Collection.")); return; }
    renderSideTree(tree, nodes, (it) => {
      const p = it.ref;
      return h("button", { class: "item" + sideColor(it) + (cur && cur.iid === p.iid ? " on" : ""), "data-iid": p.iid, onclick: () => select(p.iid) },
        h("span", { class: "dot " + (isFull(p) ? "full" : best(p) ? "part" : "") }), sideGlyph(it, "problems"),
        h("span", { class: "tt" }, h("span", { class: "pid" }, p.id), p.title),
        h("span", { class: "sc" + (isFull(p) ? " full" : "") }, scoreText(p)));
    }, "problems");
  }

  /* ---------------- main layout ---------------- */
  function build() {
    const root = clear(view());
    built = true;
    const title = h("h2", { id: "jTitle" }), sub = h("span", { class: "sub", id: "jSub" }), chip = h("span", { class: "chip", id: "jChip" });
    const runB = h("button", { class: "btn", id: "jRun", onclick: run }, icon("play"), "Run", h("kbd", {}, "Ctrl+Enter"));
    const chkB = h("button", { class: "btn pri", id: "jCheck", onclick: check }, icon("check"), "Check answer", h("kbd", {}, "Ctrl+Shift+Enter"));
    const rstB = h("button", { class: "btn quiet", onclick: resetCode }, icon("reset"), "Reset");
    const bigB = h("button", { class: "btn", id: "jBigO", title: "Estimate the time complexity by timing your code on growing inputs", onclick: measure }, icon("chart"), "Big-O");
    const stopB = h("button", { class: "btn stop", id: "jStop", hidden: true, title: "Stop the program that is running", onclick: stopRun }, icon("stop"), "Stop");
    root.append(h("div", { class: "topbar" }, h("div", {}, title, sub), chip, h("span", { style: { flex: 1 } }), rstB, bigB, stopB, runB, chkB));

    const stmt = h("div", { class: "stmt" }, h("div", { class: "prose", id: "jStmt" }));
    const vs = h("button", { class: "vsplit", "aria-label": "Resize" });
    save = (() => {
      let timer = null, pending = null;
      const send = () => {
        const job = pending;
        pending = null;
        clearTimeout(timer);
        timer = null;
        if (job) api("judge/save", job).catch(() => {});
      };
      return {
        schedule(iid, code) {
          if (!iid) return;
          pending = { iid, code };
          clearTimeout(timer);
          timer = setTimeout(send, 500);
        },
        flush: send,
        cancel() { pending = null; clearTimeout(timer); timer = null; },
        pending: () => pending,
      };
    })();
    ed = new CodeEditor({ onChange: (v) => save.schedule(cur && cur.iid, v), onRun: run, onCheck: check, placeholder: "Write your solution here" });
    const edWrap = h("div", { class: "ed-wrap" }, ed.el);
    const hs = h("button", { class: "hsplit", "aria-label": "Resize" });
    const stdin = h("textarea", { id: "jStdin", placeholder: "Text typed here is given to input() when you press Run", spellcheck: false });
    const runPane = h("div", { class: "pane runpane on", id: "paneRun" },
      h("div", { class: "stdin" }, h("label", {}, "Input"), stdin),
      h("div", { class: "stdout", id: "jOut" }, h("span", { class: "m" }, "Press Run to try your code without checking it. Tip: add a line like print(" + "your_function(...)) at the bottom to see what it returns.")));
    const resPane = h("div", { class: "pane", id: "paneRes" }, h("div", { class: "res", id: "jRes" }, h("span", { class: "status" }, "Press Check answer to test your solution against the hidden tests.")));
    const cxPane = h("div", { class: "pane", id: "paneCx" }, h("div", { class: "res", id: "jCx" }, h("span", { class: "status" }, "Press Big-O to time your code on growing inputs and estimate its time complexity.")));
    const tRun = h("button", { class: "tab on", onclick: () => tab("Run") }, "Output"), tRes = h("button", { class: "tab", onclick: () => tab("Res") }, "Test results"), tCx = h("button", { class: "tab", onclick: () => tab("Cx") }, "Complexity");
    const con = h("div", { class: "console" }, h("div", { class: "tabs" }, tRun, tRes, tCx, h("span", { class: "grow" }), h("span", { class: "status", id: "jStatus" })), runPane, resPane, cxPane);
    const work = h("div", { class: "work" }, edWrap, hs, con);
    const split = h("div", { class: "split" }, stmt, vs, work);
    root.append(split);
    dragger(vs, (e) => { const r = split.getBoundingClientRect(); const pct = Math.min(75, Math.max(22, ((e.clientX - r.left) / r.width) * 100)); split.style.setProperty("--stmt-w", pct + "%"); });
    dragger(hs, (e) => { const r = work.getBoundingClientRect(); const px = Math.min(r.height - 200, Math.max(120, r.bottom - e.clientY)); con.style.flex = `0 0 ${px}px`; });
    window.tab = (n) => { tRun.className = "tab" + (n === "Run" ? " on" : ""); tRes.className = "tab" + (n === "Res" ? " on" : ""); tCx.className = "tab" + (n === "Cx" ? " on" : ""); runPane.classList.toggle("on", n === "Run"); resPane.classList.toggle("on", n === "Res"); cxPane.classList.toggle("on", n === "Cx"); };
  }

  /* ---------------- statement ---------------- */
  function renderStatement(text, parent) {
    const lines = text.split("\n");
    let i = 0, para = [];
    const flush = () => { if (para.length) { const p = h("p"); para.forEach((l, k) => { if (k) p.append(h("br")); inline(l, p); }); parent.append(p); para = []; } };
    while (i < lines.length) {
      const ln = lines[i];
      if (ln.trim().startsWith("```")) {
        flush(); const lang = ln.trim().slice(3).trim(), buf = []; i++;
        while (i < lines.length && !lines[i].trim().startsWith("```")) buf.push(lines[i++]);
        i++; parent.append(codeBlock(buf.join("\n"), lang)); continue;
      }
      let m;
      if ((m = ln.match(/^(#{1,3})\s+(.*)$/))) { flush(); parent.append(inline(m[2], h(m[1].length === 2 ? "h2" : "h3"))); i++; continue; }
      if (/^\s*[-*]\s+/.test(ln)) {
        flush(); const ul = h("ul");
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { ul.append(inline(lines[i].replace(/^\s*[-*]\s+/, ""), h("li"))); i++; }
        parent.append(ul); continue;
      }
      if (!ln.trim()) { flush(); i++; continue; }
      para.push(ln); i++;
    }
    flush();
  }

  /* ---------------- select / code ---------------- */
  async function select(iid) {
    const p = rawAll().find((x) => x.iid === iid) || all()[0];
    if (!built) build();
    if (save) save.flush();              // save the edit to the problem it belongs to, not to the next one
    if (!p) {
      clear($("#jStmt")).append(h("div", { class: "empty" }, h("h3", {}, "No problems yet"), h("p", {}, "Open the Library to add problems that others have shared."),
        h("button", { class: "btn pri", onclick: () => App.go("library") }, "Open the Library")));
      return;
    }
    epoch++;
    cur = p;
    const recent = [p.iid, ...(D.cfg.recent_problems || []).filter((x) => x !== p.iid)].slice(0, 8);
    saveCfg({ last_problem: p.iid, last_open: "judge", recent_problems: recent, activity_updated: Date.now() });
    if (typeof App !== "undefined" && App.queueSync) App.queueSync();
    document.querySelectorAll("#probTree .item").forEach((e) => e.classList.toggle("on", e.dataset.iid === p.iid));
    $("#jTitle").textContent = `${p.id}  ${p.title}`;
    $("#jSub").textContent = `${p.module.title}  ·  ${p.n_tests} tests`;
    updateChip();
    const st = clear($("#jStmt"));
    if (p.tiers.length) st.append(h("div", { class: "tiers" }, p.tiers.map((t) => h("div", {}, h("span", {}, t.label), h("b", {}, t.points + " pts")))));
    renderStatement(p.statement || "(no statement provided)", st);
    $(".stmt").scrollTop = 0;
    try { const r = await api("judge/code?iid=" + encodeURIComponent(p.iid)); if (cur === p) ed.setValue(r.code); } catch (e) { toast(e.message, "err"); }
    clear($("#jOut")).append(h("span", { class: "m" }, "Press Run to try your code without checking it."));
    clear($("#jRes")).append(h("span", { class: "status" }, "Press Check answer to test your solution against the hidden tests."));
    clear($("#jCx")).append(h("span", { class: "status" }, "Press Big-O to time your code on growing inputs and estimate its time complexity."));
    if (!busy) $("#jStatus").textContent = "";
  }
  function updateChip() {
    const c = $("#jChip"); if (!c || !cur) return;
    const b = best(cur);
    c.className = "chip" + (isFull(cur) ? " ok" : b ? " warn" : "");
    c.textContent = b === undefined ? `${cur.points} pts, not tried` : isFull(cur) ? `Solved  ${b}/${cur.points}` : `Best ${b}/${cur.points}`;
  }
  function resetCode() {
    if (!cur || !confirm("Replace your code with the empty starter? This cannot be undone.")) return;
    if (save) save.cancel();            // a pending save of the old text must not undo the reset
    ed.setValue(`def ${cur.func}(${cur.params}):\n    pass\n`);
    api("judge/save", { iid: cur.iid, code: ed.getValue() });
  }

  /* ---------------- run / check ---------------- */
  function setBusy(on, what) {
    busy = on;
    $("#jRun").disabled = on; $("#jCheck").disabled = on; $("#jBigO").disabled = on;
    const st = $("#jStop"); if (st) st.hidden = !on;
    const s = $("#jStatus"); s.textContent = on ? what : ""; s.className = "status";
  }
  async function stopRun() {
    const s = $("#jStatus"); if (s) { s.textContent = "Stopping…"; s.className = "status"; }
    try { await api("judge/stop", { rid: runKey }, { timeout: 8000 }); }
    catch (e) { toast(e.message, "err"); }
  }
  function note(r, out) {
    if (r.truncated) out.append(h("span", { class: "m" }, "Output was very long, so only the first and the last part are shown."));
  }
  async function run() {
    if (!cur || busy) return;
    tab("Run"); setBusy(true, "Running…");
    runKey = newKey();
    const mine = epoch;
    try {
      const r = await api("judge/run", { code: ed.getValue(), stdin: $("#jStdin").value, rid: runKey }, { timeout: 30000 });
      if (mine !== epoch) return;        // the problem changed while this was running: do not paint stale output
      const out = clear($("#jOut"));
      if (r.stdout) out.append(r.stdout);
      if (r.stderr) out.append(h("span", { class: "e" }, r.stderr));
      note(r, out);
      if (r.stopped) out.append(h("span", { class: "m" }, "Stopped. The program was ended before it finished."));
      else if (r.timeout) out.append(h("span", { class: "e" }, "Stopped after 10 seconds. Is there an infinite loop, or is input() waiting for text in the Input box? Use Stop for a run that is taking too long."));
      else if (!r.stdout && !r.stderr) out.append(h("span", { class: "m" }, "Ran without errors but printed nothing. Add print(...) to see values."));
      else out.append(h("span", { class: "m" }, `Finished in ${r.secs}s${r.code ? `, exit code ${r.code}` : ""}`));
    } catch (e) { toast(e.message, "err"); } finally { setBusy(false); }
  }
  async function check() {
    if (!cur || busy) return;
    tab("Res"); setBusy(true, "Running tests…");
    runKey = newKey();
    const mine = epoch;
    try {
      const r = await api("judge/check", { iid: cur.iid, code: ed.getValue(), rid: runKey }, { timeout: 60000 });
      if (r.progress) { D.progress = r.progress; refreshScores(); }
      if (mine !== epoch) return;        // keep the correct scores, but do not show old results under a new problem
      showResults(r);
    } catch (e) { toast(e.message, "err"); } finally { setBusy(false); }
  }
  function refreshScores() {
    updateChip();
    const ps = all(), solved = ps.filter(isFull).length;
    const t = $("#solvedTxt"); if (t) { t.textContent = `${solved} of ${ps.length} solved`; $("#solvedBar").style.width = (ps.length ? 100 * solved / ps.length : 0) + "%"; }
    if ($("#probTree")) fillTree();
  }
  function showResults(r) {
    const box = clear($("#jRes")), p = cur;
    const fail = (title, msg, cls = "err") => box.append(h("div", { class: "big" }, h("h3", {}, title)), h("div", { class: "out" }, h("pre", { class: "e" }, msg)));
    if (r.status === "MISSING") return fail("Function not found", r.message);
    if (r.status === "STOPPED") return fail("Stopped", "You stopped this check. Run it again when you are ready.");
    if (r.status === "TIMEOUT") return fail("Time limit exceeded", r.message);
    if (r.status === "CRASH") return fail("Error in your code", r.message);
    const ac = r.results.filter((x) => x.status === "AC").length, total = r.results.length;
    box.append(h("div", { class: "big" }, h("h3", {}, `${ac} of ${total} tests passed`),
      h("span", { class: "chip " + (r.earned >= r.max ? "ok" : ac ? "warn" : "err") }, `${r.earned}/${r.max} points this run`),
      r.best > r.earned ? h("span", { class: "chip" }, `Best so far ${r.best}/${r.max} (kept)`) : null,
      r.earned >= r.max && r.max ? h("span", { class: "chip ok" }, "Solved") : null));
    for (const t of r.rows) box.append(h("div", { class: "tr" }, h("span", { class: "dot " + (t.full ? "full" : t.partial ? "part" : "") }),
      h("span", {}, `${t.got}/${t.points}  ${t.label}`), h("span", { class: "sc" }, `${t.passed}/${t.n} tests` + (t.partial ? ", partial credit for smoke tests" : ""))));
    for (const t of r.results) {
      const c = h("div", { class: "tc " + t.status }, h("div", { class: "th" }, h("span", { class: "tag" }, t.status), h("span", {}, t.name)));
      if (t.status === "WA") c.append(h("pre", {}, `expected: ${t.expected}\ngot:      ${t.actual}` + (t.detail ? "\n" + t.detail : "")));
      if (t.status === "RE") c.append(h("pre", {}, (t.error || "").replace(/File ".*?runner\.py"/g, 'File "your code"')));
      box.append(c);
    }
    if (r.stdout && r.stdout.trim()) box.append(h("div", { class: "out", style: { marginTop: "16px" } }, h("div", { class: "oh" }, "Printed by your code"), h("pre", {}, r.stdout)));
  }

  /* ---------------- Big-O detector ---------------- */
  const fmtT = (t) => (t < 1e-3 ? (t * 1e6).toFixed(t < 1e-5 ? 2 : 1) + " µs" : t < 1 ? (t * 1e3).toFixed(2) + " ms" : t.toFixed(2) + " s");
  const sv = (tag, attrs, text) => { const e = document.createElementNS("http://www.w3.org/2000/svg", tag); for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v); if (text !== undefined) e.textContent = text; return e; };
  function cxChart(points, curve) {
    const W = 580, H = 260, L = 70, R = 16, T = 14, B = 38;
    const lx = (v) => Math.log10(v), ly = (v) => Math.log10(Math.max(v, 1e-9));
    const xs = points.map((p) => lx(p[0])), ys = points.concat(curve).map((p) => ly(p[1]));
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.floor(Math.min(...ys)), y1 = Math.max(Math.ceil(Math.max(...ys)), y0 + 1);
    const X = (v) => L + ((lx(v) - x0) / (x1 - x0 || 1)) * (W - L - R), Y = (v) => H - B - ((ly(v) - y0) / (y1 - y0 || 1)) * (H - B - T);
    const s = sv("svg", { viewBox: `0 0 ${W} ${H}`, class: "cx-chart", role: "img", "aria-label": "Time against input size, both on log scales" });
    for (let k = y0; k <= y1; k++) {
      const y = H - B - ((k - y0) / (y1 - y0)) * (H - B - T);
      s.append(sv("line", { x1: L, x2: W - R, y1: y, y2: y, class: "cx-grid" }), sv("text", { x: L - 8, y: y + 4, "text-anchor": "end", class: "cx-tick" }, fmtT(10 ** k)));
    }
    const first = points[0][0], last = points[points.length - 1][0];
    const xt = [first, last]; for (let k = Math.ceil(x0); k <= Math.floor(x1); k++) { const v = 10 ** k; if (v > first * 1.6 && v < last / 1.6) xt.push(v); }
    for (const v of xt) s.append(sv("line", { x1: X(v), x2: X(v), y1: T, y2: H - B, class: "cx-grid" }), sv("text", { x: X(v), y: H - B + 18, "text-anchor": "middle", class: "cx-tick" }, String(v)));
    s.append(sv("text", { x: (L + W - R) / 2, y: H - 4, "text-anchor": "middle", class: "cx-tick" }, "input size n (log scale)"));
    s.append(sv("polyline", { points: curve.map((p) => X(p[0]) + "," + Y(p[1])).join(" "), class: "cx-fit" }));
    for (const p of points) s.append(sv("circle", { cx: X(p[0]), cy: Y(p[1]), r: 4, class: "cx-dot" }));
    return s;
  }
  function drawBigO(r) {
    const box = clear($("#jCx"));
    if (!r.ok) {
      box.append(h("div", { class: "big" }, h("h3", {}, "Could not estimate")), h("div", { class: "out" }, h("pre", { class: "e" }, r.reason || "Something went wrong.")));
      if (r.points && r.points.length) box.append(h("p", { class: "cx-note" }, `Only ${r.points.length} measurements were possible.`));
      return;
    }
    const cls = { high: "ok", medium: "warn", low: "err" }[r.confidence];
    box.append(h("div", { class: "big" }, h("h3", {}, "Looks like " + r.label), h("span", { class: "chip " + cls }, r.confidence + " confidence")));
    box.append(h("p", { class: "cx-plain" }, r.plain));
    if (r.double) box.append(h("p", { class: "cx-plain" }, `When the input size doubles, the time grows about ×${r.double.toFixed(1)}.`));
    if (r.base) box.append(h("p", { class: "cx-plain" }, `Each extra +1 in n multiplies the time by about ${r.base.toFixed(2)}.`));
    box.append(cxChart(r.points, r.curve.length ? r.curve : r.points));
    box.append(h("p", { class: "cx-note" }, "Dots are measured times; the line is the best-fitting curve."));
    const alts = r.fits.filter((f) => f.score !== null).slice(0, 4);
    box.append(h("div", { class: "cx-fits" }, h("b", {}, "Best fits (lower is closer):"), alts.map((f) => h("span", { class: "chip" + (f.label === r.label ? " ok" : "") }, `${f.label}  ${f.score}`))));
    const notes = [r.desc ? "Input size: " + r.desc + "." : "", r.custom ? "" : "The largest test was stretched to build bigger inputs. Define make_input(n) in your code to choose your own.",
      r.stop ? "Stopped at: " + r.stop + "." : "", "This is a measured estimate, not a proof. Timing noise and the shape of the input can fool it."].filter(Boolean);
    box.append(h("p", { class: "cx-note" }, notes.join("  ")));
    box.append(h("details", { class: "cx-raw" }, h("summary", {}, `${r.points.length} measurements`),
      h("div", { class: "cx-table" }, r.points.map((p) => h("div", {}, h("span", {}, "n = " + p[0]), h("span", {}, fmtT(p[1])))))));
  }
  async function measure() {
    if (!cur || busy) return;
    tab("Cx"); setBusy(true, "Measuring…");
    clear($("#jCx")).append(h("span", { class: "status" }, "Running your code on bigger and bigger inputs. This can take up to about 15 seconds."));
    runKey = newKey();
    const mine = epoch;
    try {
      const r = await api("bigo/run", { iid: cur.iid, code: ed.getValue(), rid: runKey }, { timeout: 40000 });
      if (mine === epoch) drawBigO(r);
    } catch (e) { toast(e.message, "err"); } finally { setBusy(false); }
  }

  return {
    renderSide, select, measure,
    refresh() { if (save) save.flush(); built = false; renderSide(); select(cur ? cur.iid : D.cfg.last_problem); },
    show() { renderSide(); if (!built || !cur) select(D.cfg.last_problem); },
    focusSearch() { const s = $("#probSearch"); s && s.focus(); }, run, check,
    editor: () => ed,
    pendingSave: () => (save && save.pending()) || null,
  };
})();
