/* A dependency-free Python code editor in the style of Sublime Text: a transparent <textarea> over a
   highlighted <pre>, with line numbers, indent guides, bracket matching and Sublime's shortcuts. */
(function () {
  const KW = new Set(("False None True and as assert async await break class continue def del elif else except finally " +
    "for from global if import in is lambda nonlocal not or pass raise return try while with yield").split(" "));
  const BI = new Set(("abs all any bin bool bytes callable chr dict dir divmod enumerate filter float format frozenset " +
    "getattr hasattr hash hex id input int isinstance issubclass iter len list map max min next object oct open ord " +
    "pow print range repr reversed round set setattr slice sorted str sum super tuple type vars zip " +
    "Exception ValueError TypeError KeyError IndexError ZeroDivisionError FileNotFoundError StopIteration " +
    "AssertionError RuntimeError NameError AttributeError OSError").split(" "));
  const TRI = "\"\"\"|'''";
  const TOK = new RegExp(
    "(#[^\\n]*)" +                                                                  // 1 comment
    "|([rRbBfFuU]{0,2}(?:\"\"\"[\\s\\S]*?(?:\"\"\"|$)|'''[\\s\\S]*?(?:'''|$)" +        // 2 string
    "|\"(?:\\\\.|[^\"\\\\\\n])*\"?|'(?:\\\\.|[^'\\\\\\n])*'?))" +
    "|(\\b\\d[\\d_]*(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b)" +                              // 3 number
    "|(@[A-Za-z_][\\w.]*)" +                                                        // 4 decorator
    "|([A-Za-z_]\\w*)" +                                                            // 5 name
    "|([=+\\-*/%<>!&|^~]+)" +                                                       // 6 operator
    "|([\\s\\S])", "g");                                                            // 7 anything else
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
  const esc = (s) => s.replace(/[&<>]/g, (c) => ESC[c]);

  function highlightPy(src) {
    let out = "", prev = "", last = "", m, atLine = true, col = 0, params = 0;
    TOK.lastIndex = 0;
    while ((m = TOK.exec(src))) {
      const t = m[0];
      if (m[7] !== undefined) {
        if (t === "\n") { out += "\n"; atLine = true; col = 0; continue; }
        if (t === " " && atLine) { out += col % 4 === 0 ? '<span class="ig"> </span>' : " "; col++; continue; }
        atLine = false;
        if (/\s/.test(t)) { out += t; continue; }
        if (t === "(" && prev === "defname") params = 1;
        else if (params && t === "(") params++;
        else if (params && t === ")") params--;
        out += esc(t); last = t; prev = ""; continue;
      }
      atLine = false;
      if (m[1]) out += `<i class="t-c">${esc(t)}</i>`;
      else if (m[2]) out += `<i class="t-s">${esc(t)}</i>`;
      else if (m[3]) out += `<i class="t-n">${esc(t)}</i>`;
      else if (m[4]) out += `<i class="t-d">${esc(t)}</i>`;
      else if (m[6]) { out += `<i class="t-op">${esc(t)}</i>`; last = t; }
      else {
        let cls = "", np = "";
        if (prev === "def") { cls = t.startsWith("__") ? "t-dunder" : "t-f"; np = "defname"; }
        else if (prev === "class") cls = "t-k2";
        else if (t === "def" || t === "class") { cls = "t-kd"; np = t; }
        else if (KW.has(t)) cls = "t-k";
        else if (t === "self" || t === "cls") cls = "t-self";
        else if (params && (last === "(" || last === "," || last === "*" || last === "**") && !BI.has(t)) cls = "t-param";
        else if (BI.has(t)) cls = "t-b";
        else if (/^\s*\(/.test(src.substr(TOK.lastIndex, 12))) cls = /^[A-Z]/.test(t) ? "t-b" : "t-call";
        out += cls ? `<i class="${cls}">${t}</i>` : t;
        prev = np; last = t; continue;
      }
      prev = "";
    }
    return out;
  }

  const OPEN = { "(": ")", "[": "]", "{": "}" };
  const CLOSE = new Set([")", "]", "}"]);
  const isWord = (c) => /[A-Za-z0-9_]/.test(c || "");

  /* Snippets offered by the completion popup: [text to insert, caret offset (null = end), one-line hint].
     They are Sublime's "snippet" completions in a small, dependency-free form. */
  const SNIPS = [
    ["def ", null, "define a function"], ["class ", null, "define a class"],
    ["if ", null, "condition"], ["elif ", null, "else if"], ["else:", null, "otherwise"],
    ["for ", null, "loop over something"], ["while ", null, "loop while true"],
    ["with ", null, "open a file safely"], ["try:", null, "handle errors"],
    ["except ", null, "catch an error"], ["return ", null, "give a value back"],
    ["import ", null, "import a module"], ["from ", null, "import from a module"],
    ["print()", 6, "print a value"], ["len()", 4, "length of a sequence"],
    ["range()", 6, "numbers in a range"], ["input()", 6, "read a line typed by the user"],
    ["int()", 4, "convert to int"], ["str()", 4, "convert to text"], ["float()", 6, "convert to float"],
    ["list()", 5, "make a list"], ["dict()", 5, "make a dictionary"], ["set()", 4, "make a set"],
    ["tuple()", 6, "make a tuple"], ["sorted()", 7, "return a sorted copy"],
    ["enumerate()", 10, "index and value together"], ["zip()", 4, "pair up sequences"],
    ["open()", 5, "open a file"], ["sum()", 4, "add up a sequence"], ["min()", 4, "smallest value"],
    ["max()", 4, "largest value"], ["abs()", 4, "absolute value"], ["isinstance()", 11, "check a type"],
    ["append()", 7, "add to the end of a list"], ["items()", 6, "pairs of a dictionary"],
    ["__init__", null, "initializer method"], ['if __name__ == "__main__":', null, "script entry point"],
  ];

  const KIND_LETTER = { kw: "K", bi: "B", snip: "S", word: "W" };

  function bracketPairs(v) {
    const map = new Map(), st = [], n = v.length;
    let i = 0;
    while (i < n) {
      const c = v[i];
      if (c === "#") { while (i < n && v[i] !== "\n") i++; continue; }
      if (c === '"' || c === "'") {
        if (v.substr(i, 3) === c + c + c) { const e = v.indexOf(c + c + c, i + 3); i = e < 0 ? n : e + 3; continue; }
        i++;
        while (i < n && v[i] !== c && v[i] !== "\n") { if (v[i] === "\\") i++; i++; }
        i++; continue;
      }
      if (OPEN[c]) st.push([c, i]);
      else if (CLOSE.has(c) && st.length && OPEN[st[st.length - 1][0]] === c) { const t = st.pop(); map.set(t[1], i); map.set(i, t[1]); }
      i++;
    }
    return map;
  }

  class CodeEditor {
    /* opts: value, onChange, onRun, onCheck, readOnly, minLines, maxLines, placeholder */
    constructor(opts = {}) {
      this.o = opts;
      this.el = document.createElement("div");
      this.el.className = "ed" + (opts.readOnly ? " ed-ro" : "");
      this.el.innerHTML =
        '<div class="ed-find" hidden>' +
        '<div class="ef-row"><input class="ef-q" type="text" placeholder="Find" aria-label="Find" spellcheck="false" autocomplete="off">' +
        '<span class="ef-n"></span><button type="button" class="ef-b ef-prev" title="Previous match (Shift+Enter)">\u2191</button><button type="button" class="ef-b ef-next" title="Next match (Enter)">\u2193</button>' +
        '<button type="button" class="ef-b ef-case" title="Match case">Aa</button><button type="button" class="ef-b ef-x" title="Close (Esc)">\u00d7</button></div>' +
        '<div class="ef-row ef-rrow"><input class="ef-r" type="text" placeholder="Replace with" aria-label="Replace with" spellcheck="false" autocomplete="off">' +
        '<button type="button" class="ef-b ef-one" title="Replace this match (Enter)">Replace</button><button type="button" class="ef-b ef-all" title="Replace every match">Replace all</button></div></div>' +
        '<div class="ed-body"><div class="ed-gutter" aria-hidden="true"></div>' +
        '<div class="ed-inner"><div class="ed-cur"></div><div class="ed-br"></div><div class="ed-br"></div><pre class="ed-hlp" aria-hidden="true"></pre><pre class="ed-pre" aria-hidden="true"></pre>' +
        '<div class="ed-ghost" aria-hidden="true"></div><div class="ed-comp" hidden role="listbox" aria-label="Suggestions"></div>' +
        '<span class="ed-measure" aria-hidden="true">0000000000</span>' +
        '<textarea class="ed-ta" rows="1" wrap="off" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off"></textarea></div></div>';
      this.body = this.el.querySelector(".ed-body");
      this.gut = this.el.querySelector(".ed-gutter");
      this.pre = this.el.querySelector(".ed-pre");
      this.ta = this.el.querySelector(".ed-ta");
      this.cur = this.el.querySelector(".ed-cur");
      this.br = this.el.querySelectorAll(".ed-br");
      this.ghostEl = this.el.querySelector(".ed-ghost");
      this.compEl = this.el.querySelector(".ed-comp");
      this.meas = this.el.querySelector(".ed-measure");
      this.comp = null;                 // open completion: {start, end, prefix, items, sel}
      this.words = new Map();           // words already in this file, for Sublime-style word completion
      this._wordSrc = null;
      this.suppress = false;
      this.curLn = -1;
      this.initFind();
      if (opts.readOnly) this.ta.readOnly = true;
      if (opts.placeholder) this.ta.placeholder = opts.placeholder;
      if (opts.maxLines || opts.minLines) {
        this.body.style.minHeight = `calc(var(--lh) * ${opts.minLines || 3} + 24px)`;
        if (opts.maxLines) this.body.style.maxHeight = `calc(var(--lh) * ${opts.maxLines} + 24px)`;
      }
      this.lines = 0;
      this.ta.value = opts.value || "";
      this.ta.addEventListener("input", () => { this.update(true); this.maybeComplete(false); });
      this.ta.addEventListener("keydown", (e) => this.onKey(e));
      this.ta.addEventListener("keyup", (e) => {
        if (/^(Arrow|Page|Home|End)/.test(e.key)) this.reveal();
        this.markLine();
        if (this.comp) { this.positionComp(); this.renderGhost(); }
      });
      this.ta.addEventListener("click", () => { this.markLine(); this.closeComp(); });
      this.ta.addEventListener("focus", () => this.markLine());
      this.ta.addEventListener("select", () => this.markLine());
      this.ta.addEventListener("blur", () => { this.markLine(); this.closeComp(); });
      this.body.addEventListener("scroll", () => { if (this.comp) this.positionComp(); });
      this.update(false);
    }

    getValue() { return this.ta.value; }
    setValue(v) { this.closeComp(); this.ta.value = v || ""; this.update(false); }
    focus() { this.ta.focus(); }

    update(user) {
      const v = this.ta.value;
      this.indexWords(v);
      this.pre.innerHTML = highlightPy(v) + "\n";
      const n = v.split("\n").length;
      if (n !== this.lines) {
        this.lines = n; this.curLn = -1;
        const f = document.createDocumentFragment();
        for (let i = 1; i <= n; i++) { const d = document.createElement("div"); d.className = "ln"; d.textContent = i; f.append(d); }
        this.gut.replaceChildren(f);
      }
      if (user && this.o.onChange) this.o.onChange(v);
      if (this.findOpen) this.refreshFind(false);
      this.markLine();
    }

    /* ---- find and replace: Ctrl+F (find) and Ctrl+H (find and replace). Matches are painted behind the text. ---- */
    initFind() {
      const q = (s) => this.el.querySelector(s);
      this.fb = q(".ed-find"); this.fq = q(".ef-q"); this.fr = q(".ef-r"); this.fn = q(".ef-n"); this.hl = q(".ed-hlp");
      this.matchCase = false; this.matches = []; this.mi = -1; this.findOpen = false;
      this.fq.addEventListener("input", () => this.refreshFind(true));
      this.fq.addEventListener("keydown", (e) => this.findKey(e, false));
      this.fr.addEventListener("keydown", (e) => this.findKey(e, true));
      q(".ef-next").addEventListener("click", () => this.stepFind(1));
      q(".ef-prev").addEventListener("click", () => this.stepFind(-1));
      q(".ef-x").addEventListener("click", () => this.closeFind());
      q(".ef-one").addEventListener("click", () => this.replaceOne());
      q(".ef-all").addEventListener("click", () => this.replaceAll());
      const cs = q(".ef-case");
      cs.addEventListener("click", () => { this.matchCase = !this.matchCase; cs.classList.toggle("on", this.matchCase); this.refreshFind(true); });
    }
    openFind(withReplace) {
      const [a, b] = this.sel(), v = this.ta.value, picked = a !== b && !v.slice(a, b).includes("\n") ? v.slice(a, b) : "";
      this.fb.hidden = false; this.fb.classList.toggle("rep", !!withReplace); this.findOpen = true;
      if (picked) this.fq.value = picked;
      this.refreshFind(true);
      (withReplace && this.fq.value ? this.fr : this.fq).focus();
      this.fq.select();
    }
    closeFind() {
      this.findOpen = false; this.fb.hidden = true; this.matches = []; this.mi = -1; this.hl.replaceChildren();
      this.ta.focus(); this.markLine();
    }
    refreshFind(jump) {
      if (!this.findOpen) return;
      const v = this.ta.value, qv = this.fq.value, hay = this.matchCase ? v : v.toLowerCase(), needle = this.matchCase ? qv : qv.toLowerCase();
      this.matches = [];
      if (needle) { let i = hay.indexOf(needle); while (i >= 0 && this.matches.length < 5000) { this.matches.push(i); i = hay.indexOf(needle, i + needle.length); } }
      if (jump) { const from = this.ta.selectionStart, k = this.matches.findIndex((m) => m >= from); this.mi = this.matches.length ? (k < 0 ? 0 : k) : -1; }
      else this.mi = Math.min(this.mi, this.matches.length - 1);
      this.paintFind(jump);
    }
    paintFind(reveal) {
      const v = this.ta.value, n = this.fq.value.length, f = document.createDocumentFragment();
      let pos = 0;
      this.matches.forEach((m, i) => {
        f.append(v.slice(pos, m));
        const mk = document.createElement("mark"); mk.textContent = v.slice(m, m + n); if (i === this.mi) mk.className = "cur";
        f.append(mk); pos = m + n;
      });
      f.append(v.slice(pos) + "\n");
      this.hl.replaceChildren(f);
      this.fn.textContent = !this.fq.value ? "" : this.matches.length ? `${this.mi + 1} of ${this.matches.length}` : "No results";
      this.fn.classList.toggle("none", !!this.fq.value && !this.matches.length);
      if (reveal && this.mi >= 0) this.showMatch();
    }
    showMatch() {                                    // select the match in the text (without taking focus) and scroll to it
      const m = this.matches[this.mi];
      if (m === undefined) return;
      this.setSel(m, m + this.fq.value.length);
      this.ta.scrollTop = 0; this.ta.scrollLeft = 0;
      this.reveal();
    }
    stepFind(dir) {
      if (!this.matches.length) return;
      this.mi = (this.mi + dir + this.matches.length) % this.matches.length;
      this.paintFind(true);
    }
    replaceOne() {
      if (this.mi < 0 || !this.matches.length) return this.stepFind(1);
      const m = this.matches[this.mi], n = this.fq.value.length, rep = this.fr.value;
      this.ta.focus(); this.replaceRange(m, m + n, rep, m + rep.length);
      this.update(true);
      const k = this.matches.findIndex((x) => x >= m + rep.length);
      this.mi = this.matches.length ? (k < 0 ? 0 : k) : -1;
      this.paintFind(true);
      this.fr.focus();
    }
    replaceAll() {
      if (!this.matches.length) return;
      const v = this.ta.value, n = this.fq.value.length, rep = this.fr.value, count = this.matches.length;
      let out = "", pos = 0;
      for (const m of this.matches) { out += v.slice(pos, m) + rep; pos = m + n; }
      out += v.slice(pos);
      this.ta.focus(); this.setSel(0, v.length); this.ins(out);
      this.update(true);
      this.fn.textContent = `Replaced ${count}`; this.fn.classList.remove("none");
      this.fr.focus();
    }
    findKey(e, inReplace) {
      const k = e.key, lk = k.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
      if (k === "Escape") { e.preventDefault(); e.stopPropagation(); return this.closeFind(); }
      if (ctrl && k === "Enter") { e.preventDefault(); (e.shiftKey ? this.o.onCheck : this.o.onRun)?.(); return; }
      if (k === "Enter") { e.preventDefault(); return inReplace && !e.shiftKey ? this.replaceOne() : this.stepFind(e.shiftKey ? -1 : 1); }
      if (k === "F3") { e.preventDefault(); return this.stepFind(e.shiftKey ? -1 : 1); }
      if (ctrl && !e.shiftKey && (lk === "h" || lk === "f")) { e.preventDefault(); e.stopPropagation(); this.openFind(lk === "h"); }
    }

    pos(i) {
      const v = this.ta.value;
      let line = 0, k = -1;
      while ((k = v.indexOf("\n", k + 1)) !== -1 && k < i) line++;
      return [line, i - (v.lastIndexOf("\n", i - 1) + 1)];
    }

    markLine() {
      if (this.o.readOnly) return;
      const focused = document.activeElement === this.ta;
      const prevEl = this.gut.children[this.curLn];
      if (prevEl) prevEl.classList.remove("cur");
      this.br.forEach((b) => (b.style.display = "none"));
      if (!focused) { this.cur.style.display = "none"; this.curLn = -1; return; }
      const a = this.ta.selectionStart, b = this.ta.selectionEnd, v = this.ta.value;
      const [ln] = this.pos(a);
      this.curLn = ln;
      this.gut.children[ln]?.classList.add("cur");
      this.cur.style.display = a === b ? "block" : "none";
      this.cur.style.top = `calc(var(--lh) * ${ln} + 12px)`;
      if (a === b) {                                                         // matching bracket
        let i = -1;
        if (v[a - 1] && (OPEN[v[a - 1]] || CLOSE.has(v[a - 1]))) i = a - 1;
        else if (v[a] && (OPEN[v[a]] || CLOSE.has(v[a]))) i = a;
        if (i >= 0) {
          const j = bracketPairs(v).get(i);
          if (j !== undefined) [i, j].forEach((x, k) => {
            const [l, c] = this.pos(x), el = this.br[k];
            el.style.display = "block"; el.style.top = `calc(var(--lh) * ${l} + 12px)`; el.style.left = `calc(16px + ${c}ch)`;
          });
        }
      }
    }

    // ---- editing primitives (execCommand keeps native undo/redo working)
    ins(text) { document.execCommand("insertText", false, text); }
    sel() { return [this.ta.selectionStart, this.ta.selectionEnd]; }
    setSel(a, b = a) { this.ta.setSelectionRange(a, b); }
    del(a, b) { this.setSel(a, b); document.execCommand("delete"); }
    lineBounds(pos) {
      const v = this.ta.value;
      return [v.lastIndexOf("\n", pos - 1) + 1, (i => (i < 0 ? v.length : i))(v.indexOf("\n", pos))];
    }
    selLines() {
      const [a, b] = this.sel(), v = this.ta.value;
      const start = this.lineBounds(a)[0];
      let endPos = b;
      if (b > a && v[b - 1] === "\n") endPos = b - 1;
      return [start, this.lineBounds(endPos)[1]];
    }
    replaceRange(a, b, text, selA, selB) {
      this.setSel(a, b); this.ins(text); this.setSel(selA, selB === undefined ? selA : selB);
    }
    reveal() {
      const lh = parseFloat(getComputedStyle(this.el).getPropertyValue("--lh")) || 22;
      const ln = this.pos(this.ta.selectionStart)[0];
      const y = ln * lh + 12, b = this.body;
      if (y < b.scrollTop + 4) b.scrollTop = Math.max(0, y - 4);
      else if (y + lh + 12 > b.scrollTop + b.clientHeight) b.scrollTop = y + lh + 16 - b.clientHeight;
    }

    indentLines(dir) {
      const [a, b] = this.sel(), [s, e] = this.selLines();
      const block = this.ta.value.slice(s, e).split("\n");
      let delta0 = 0, total = 0;
      const out = block.map((ln, i) => {
        let r, d;
        if (dir > 0) { r = "    " + ln; d = 4; }
        else { const n = Math.min(4, ln.length - ln.trimStart().length); r = ln.slice(n); d = -n; }
        if (i === 0) delta0 = d;
        total += d;
        return r;
      });
      this.replaceRange(s, e, out.join("\n"), Math.max(s, a + delta0), Math.max(s, b + total));
      this.update(true);
    }

    toggleComment() {
      const [a, b] = this.sel(), [s, e] = this.selLines();
      const block = this.ta.value.slice(s, e).split("\n");
      const all = block.filter((l) => l.trim()).every((l) => l.trimStart().startsWith("#"));
      let first = 0, total = 0;
      const out = block.map((ln, i) => {
        if (!ln.trim()) return ln;
        const ind = ln.length - ln.trimStart().length;
        const r = all ? ln.slice(0, ind) + ln.slice(ind).replace(/^# ?/, "") : ln.slice(0, ind) + "# " + ln.slice(ind);
        if (i === 0) first = r.length - ln.length;
        total += r.length - ln.length;
        return r;
      });
      this.replaceRange(s, e, out.join("\n"), Math.max(s, a + first), Math.max(s, b + total));
      this.update(true);
    }

    duplicate() {
      const [a, b] = this.sel();
      if (a !== b) { this.setSel(b); this.ins(this.ta.value.slice(a, b)); this.setSel(b, b + (b - a)); }
      else {
        const [s, e] = this.lineBounds(a), line = this.ta.value.slice(s, e);
        this.setSel(e); this.ins("\n" + line); this.setSel(a + line.length + 1);
      }
      this.update(true); this.reveal();
    }

    moveLines(dir) {
      const v = this.ta.value, [a, b] = this.sel(), [s, e] = this.selLines();
      if ((dir < 0 && s === 0) || (dir > 0 && e >= v.length)) return;
      const block = v.slice(s, e);
      if (dir < 0) {
        const [ps, pe] = this.lineBounds(s - 1), prev = v.slice(ps, pe);
        this.replaceRange(ps, e, block + "\n" + prev, a - (pe - ps + 1), b - (pe - ps + 1));
      } else {
        const [ns, ne] = this.lineBounds(e + 1), next = v.slice(ns, ne);
        this.replaceRange(s, ne, next + "\n" + block, a + next.length + 1, b + next.length + 1);
      }
      this.update(true); this.reveal();
    }

    deleteLine() {
      const [s, e] = this.selLines(), v = this.ta.value;
      this.del(s, Math.min(v.length, e + 1));
      this.update(true);
    }

    selectLine() {
      const [s, e] = this.selLines();
      this.setSel(s, Math.min(this.ta.value.length, e + 1)); this.markLine();
    }

    selectNext() {                                   // Sublime's Ctrl+D: word, then the next match
      const v = this.ta.value; let [a, b] = this.sel();
      if (a === b) {
        let s = a, e = a;
        while (s > 0 && isWord(v[s - 1])) s--;
        while (e < v.length && isWord(v[e])) e++;
        if (s !== e) this.setSel(s, e);
      } else {
        const text = v.slice(a, b);
        let i = v.indexOf(text, b);
        if (i < 0) i = v.indexOf(text);
        if (i >= 0) this.setSel(i, i + text.length);
      }
      this.reveal(); this.markLine();
    }

    /* ---- completion: Sublime-style word completion ----
       As you type a word (or press Ctrl+Space) a small popup lists keywords, built-ins,
       snippets and words that already appear in the file, best match first. The top
       match is also drawn as faint "ghost" text after the caret, so Tab can accept it
       without reading the list. Enter/Tab accepts, Up/Down picks, Esc closes. */
    indexWords(v) {
      if (v === this._wordSrc) return;
      this._wordSrc = v;
      const words = new Map();
      const re = /[A-Za-z_][A-Za-z0-9_]*/g;
      let m, n = 0;
      while ((m = re.exec(v)) && n < 5000) {
        const w = m[0];
        if (w.length > 1 && !KW.has(w) && !BI.has(w)) words.set(w, (words.get(w) || 0) + 1);
        n++;
      }
      this.words = words;
    }

    suggest(prefix) {
      const lower = prefix.toLowerCase(), found = new Map();
      const add = (label, insert, caret, kind, weight, hint) => {
        if (!label) return;
        if (prefix && !label.toLowerCase().startsWith(lower)) return;
        if (prefix && label === prefix && insert === label) return;   // nothing left to add
        const old = found.get(label);
        if (old && old.weight >= weight) return;
        found.set(label, { label, insert, caret: caret === undefined ? null : caret, kind, weight, hint });
      };
      for (const w of KW) add(w, w, null, "kw", 52, "keyword");
      for (const w of BI) add(w, w, null, "bi", 44, "built-in");
      for (const [text, caret, hint] of SNIPS) add(text.trimEnd().replace(/\(\)$/, ""), text, caret, "snip", 50, hint || "snippet");
      for (const [w, count] of this.words) add(w, w, null, "word", 30 + Math.min(30, count), `${count} use${count === 1 ? "" : "s"} in this file`);
      const items = [...found.values()];
      for (const it of items) it.match = !prefix ? 0 : it.label.startsWith(prefix) ? 3 : 1;
      items.sort((a, b) => b.match - a.match || b.weight - a.weight ||
        a.label.length - b.label.length || a.label.localeCompare(b.label));
      return items.slice(0, 9);
    }

    lineHeight() {
      const lh = parseFloat(getComputedStyle(this.pre).lineHeight);
      return lh > 0 ? lh : 22;
    }
    chWidth() {
      const w = this.meas.getBoundingClientRect().width / 10;
      return w > 0 ? w : 8;
    }
    caretPoint(pos) {
      const [line, col] = this.pos(pos);
      const lh = this.lineHeight();
      return { left: 16 + col * this.chWidth(), top: 12 + line * lh, lh };
    }

    maybeComplete(force) {
      if (this.o.readOnly || this.o.complete === false || this.suppress || this.findOpen) return this.closeComp();
      const [a, b] = this.sel();
      if (a !== b) return this.closeComp();
      const v = this.ta.value;
      let s = a;
      while (s > 0 && isWord(v[s - 1])) s--;
      const prefix = v.slice(s, a);
      if (!prefix && !force) return this.closeComp();
      if (prefix && !/^[A-Za-z_]/.test(prefix)) return this.closeComp();   // do not pop up inside numbers
      if (prefix.length < 2 && !force) return this.closeComp();
      const items = this.suggest(prefix);
      if (!items.length) return this.closeComp();
      this.comp = { start: s, end: a, prefix, items, sel: 0 };
      this.renderComp();
      this.renderGhost();
    }

    positionComp() {
      if (!this.comp) return;
      const box = this.compEl, p = this.caretPoint(this.comp.end);
      box.style.left = p.left + "px";
      box.style.top = (p.top + p.lh + 2) + "px";
      const er = this.el.getBoundingClientRect(), br = box.getBoundingClientRect();
      if (br.right > er.right - 4) box.style.left = Math.max(2, p.left - (br.right - er.right) - 6) + "px";
      if (br.bottom > er.bottom - 4) box.style.top = Math.max(2, p.top - br.height - 2) + "px";
    }

    renderComp() {
      if (!this.comp) return;
      const box = this.compEl;
      box.replaceChildren();
      this.comp.items.forEach((it, i) => {
        const row = document.createElement("div");
        row.className = "ed-comp-row" + (i === this.comp.sel ? " sel" : "");
        row.setAttribute("role", "option");
        row.setAttribute("aria-selected", i === this.comp.sel ? "true" : "false");
        const k = document.createElement("span"); k.className = "k"; k.textContent = KIND_LETTER[it.kind] || "W";
        const nm = document.createElement("span"); nm.className = "nm"; nm.textContent = it.label;
        const hint = document.createElement("span"); hint.className = "hint"; hint.textContent = it.hint || "";
        row.append(k, nm, hint);
        row.addEventListener("mousedown", (e) => { e.preventDefault(); e.stopPropagation(); this.acceptComp(i); });
        box.append(row);
      });
      const foot = document.createElement("div");
      foot.className = "ed-comp-foot";
      foot.textContent = "Tab / Enter insert  ·  ↑ ↓ choose  ·  Esc close";
      box.append(foot);
      box.hidden = false;
      this.positionComp();
      const row = box.children[this.comp.sel];
      if (row) {
        if (row.offsetTop < box.scrollTop) box.scrollTop = row.offsetTop;
        else if (row.offsetTop + row.offsetHeight > box.scrollTop + box.clientHeight)
          box.scrollTop = row.offsetTop + row.offsetHeight - box.clientHeight;
      }
    }

    renderGhost() {
      const g = this.ghostEl;
      if (!this.comp) { g.style.display = "none"; return; }
      const it = this.comp.items[this.comp.sel];
      const rest = it && /^[A-Za-z_][A-Za-z0-9_]*$/.test(it.insert) && it.insert.startsWith(this.comp.prefix)
        ? it.insert.slice(this.comp.prefix.length) : "";
      const [a, b] = this.sel();
      const v = this.ta.value;
      const nl = v.indexOf("\n", this.comp.end);
      const after = v.slice(this.comp.end, nl < 0 ? v.length : nl);
      if (!rest || a !== b || document.activeElement !== this.ta || after.trim()) { g.style.display = "none"; return; }
      const p = this.caretPoint(this.comp.end);
      g.textContent = rest;
      g.style.left = p.left + "px";
      g.style.top = p.top + "px";
      g.style.height = p.lh + "px";
      g.style.lineHeight = p.lh + "px";
      g.style.display = "block";
    }

    moveComp(dir) {
      if (!this.comp) return;
      const n = this.comp.items.length;
      this.comp.sel = (this.comp.sel + dir + n) % n;
      this.renderComp();
      this.renderGhost();
    }

    acceptComp(index) {
      const c = this.comp;
      if (!c) return;
      const it = c.items[index === undefined ? c.sel : index];
      if (!it) return;
      const start = c.start, end = c.end;
      this.closeComp();
      this.suppress = true;
      try {
        this.ta.focus();
        this.setSel(start, end);
        document.execCommand("insertText", false, it.insert);
        this.setSel(start + (it.caret === null || it.caret === undefined ? it.insert.length : it.caret));
      } finally {
        this.suppress = false;
      }
      this.update(true);
      this.markLine();
      this.reveal();
    }

    closeComp() {
      this.comp = null;
      if (this.compEl) { this.compEl.hidden = true; this.compEl.replaceChildren(); }
      if (this.ghostEl) this.ghostEl.style.display = "none";
    }

    onKey(e) {
      const ctrl = e.ctrlKey || e.metaKey, k = e.key, lk = k.toLowerCase();
      if (this.o.readOnly) return;
      if (this.comp) {                       // the suggestion popup is open
        if (k === "ArrowDown") { e.preventDefault(); return this.moveComp(1); }
        if (k === "ArrowUp") { e.preventDefault(); return this.moveComp(-1); }
        if (k === "Enter" || k === "Tab") { e.preventDefault(); return this.acceptComp(); }
        if (k === "Escape") { e.preventDefault(); e.stopPropagation(); return this.closeComp(); }
        if (/^(ArrowLeft|ArrowRight|Home|End|PageUp|PageDown)$/.test(k)) this.closeComp();
      }
      if (ctrl && k === " ") { e.preventDefault(); return this.maybeComplete(true); }
      if (ctrl && k === "Enter") { e.preventDefault(); (e.shiftKey ? this.o.onCheck : this.o.onRun)?.(); return; }
      if (ctrl && !e.shiftKey && !e.altKey && (lk === "h" || lk === "f")) { e.preventDefault(); return this.openFind(lk === "h"); }
      if (k === "F3" && this.findOpen) { e.preventDefault(); return this.stepFind(e.shiftKey ? -1 : 1); }
      if (k === "Escape" && this.findOpen) { e.preventDefault(); return this.closeFind(); }
      if (ctrl && k === "/") { e.preventDefault(); return this.toggleComment(); }
      if (ctrl && e.shiftKey && lk === "d") { e.preventDefault(); return this.duplicate(); }
      if (ctrl && !e.shiftKey && lk === "d") { e.preventDefault(); return this.selectNext(); }
      if (ctrl && lk === "l") { e.preventDefault(); return this.selectLine(); }
      if (ctrl && e.shiftKey && lk === "k") { e.preventDefault(); return this.deleteLine(); }
      if (ctrl && k === "]") { e.preventDefault(); return this.indentLines(1); }
      if (ctrl && k === "[") { e.preventDefault(); return this.indentLines(-1); }
      if ((e.altKey || (ctrl && e.shiftKey)) && (k === "ArrowUp" || k === "ArrowDown")) { e.preventDefault(); return this.moveLines(k === "ArrowUp" ? -1 : 1); }
      if (ctrl || e.altKey) return;

      const [a, b] = this.sel(), v = this.ta.value, before = v[a - 1], after = v[b];

      if (k === "Tab") {
        e.preventDefault();
        if (e.shiftKey || (a !== b && v.slice(a, b).includes("\n"))) return this.indentLines(e.shiftKey ? -1 : 1);
        const col = a - this.lineBounds(a)[0];
        this.ins(" ".repeat(4 - (col % 4)));
        return this.update(true);
      }

      if (k === "Enter") {
        e.preventDefault();
        const [ls] = this.lineBounds(a), line = v.slice(ls, a);
        let indent = line.match(/^[ \t]*/)[0];
        const code = line.replace(/\s+#.*$/, "").trimEnd();
        if (/:$/.test(code)) indent += "    ";
        else if (/^\s*(return|pass|break|continue|raise)\b/.test(line) && indent.length >= 4) indent = indent.slice(4);
        if (a === b && OPEN[before] && after === OPEN[before]) {
          const inner = indent + "    ";
          this.ins("\n" + inner + "\n" + indent);
          this.setSel(a + 1 + inner.length);
        } else this.ins("\n" + indent);
        this.update(true); this.reveal();
        return;
      }

      if (k === "Backspace" && a === b) {
        if (before && ((OPEN[before] && after === OPEN[before]) || ((before === '"' || before === "'") && after === before))) {
          e.preventDefault(); this.del(a - 1, a + 1); return this.update(true);
        }
        const [ls] = this.lineBounds(a), pre = v.slice(ls, a);
        if (pre.length && !pre.trim() && pre.length % 4 === 0 && !pre.includes("\t")) {
          e.preventDefault(); this.del(a - 4, a); return this.update(true);
        }
        return;
      }

      if (k.length !== 1) return;

      if (a !== b && (OPEN[k] || k === '"' || k === "'")) {
        e.preventDefault();
        const close = OPEN[k] || k, txt = v.slice(a, b);
        this.ins(k + txt + close);
        this.setSel(a + 1, a + 1 + txt.length);
        return this.update(true);
      }
      if (CLOSE.has(k) && after === k && a === b) { e.preventDefault(); return this.setSel(a + 1); }
      if (OPEN[k]) {
        if (a === b && (after === undefined || /[\s)\]}:,;.]/.test(after))) {
          e.preventDefault(); this.ins(k + OPEN[k]); this.setSel(a + 1); return this.update(true);
        }
        return;
      }
      if (k === '"' || k === "'") {
        if (a !== b) return;
        if (after === k) { e.preventDefault(); return this.setSel(a + 1); }
        const isPrefix = /(^|[^\w])[rRbBfFuU]{1,2}$/.test(v.slice(0, a));
        if (v.slice(a - 2, a) === k + k && v[a - 3] !== k) {
          e.preventDefault(); this.ins(k.repeat(4)); this.setSel(a + 1); return this.update(true);
        }
        if (isWord(before) && !isPrefix) return;
        if (after !== undefined && isWord(after)) return;
        e.preventDefault(); this.ins(k + k); this.setSel(a + 1); this.update(true);
      }
    }
  }

  window.CodeEditor = CodeEditor;
  window.highlightPy = highlightPy;
})();
