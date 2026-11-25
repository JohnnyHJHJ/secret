/* Home: the dashboard windows, floating on a nostalgic wallpaper.
   Reads existing app state (progress, streaks, config) - no new data files. */
const Home = (() => {
  const root = () => $("#v-home");
  const allLessons = () => (D.courses || []).flatMap((c) => (c.lessons || []).map((l) => Object.assign({}, l, { course: c })));
  const allProblems = () => (D.modules || []).flatMap((m) => (m.problems || []).map((p) => Object.assign({}, p, { moduleTitle: m.title })));
  const findLesson = (id) => allLessons().find((l) => l.id === id);
  const findProblem = (iid) => allProblems().find((p) => p.iid === iid);
  const lessonDone = (l) => (D.state.done[l.id] || []).filter((a) => (l.acts || []).includes(a)).length;
  const problemPoints = (p) => Math.max(0, Number(D.progress[p.iid] || 0));
  const solvedCount = () => allProblems().filter((p) => p.points > 0 && problemPoints(p) >= p.points).length;
  const syncOn = () => !!(D.cfg.sync_url && D.cfg.name);
  const greet = () => { const n = new Date().getHours(); return n < 12 ? "Good morning" : n < 18 ? "Good afternoon" : "Good evening"; };
  const short = (s, n = 34) => { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; };

  function parse(s) { if (!s) return null; const t = new Date(String(s).replace(" ", "T")).getTime(); return Number.isFinite(t) ? t : null; }
  function ago(s) {
    const t = parse(s); if (!t) return "never";
    const min = Math.round((Date.now() - t) / 60000);
    if (min < 1) return "just now";
    if (min < 60) return `${min} min ago`;
    const hrs = Math.round(min / 60);
    if (hrs < 24) return `${hrs} h ago`;
    return `${Math.round(hrs / 24)} d ago`;
  }
  function syncDot() {
    if (!syncOn()) return "";
    const t = parse(D.cfg.last_sync);
    if (!t) return "warn";
    return Date.now() - t > 48 * 3600 * 1000 ? "warn" : "ok";
  }

  function openLesson(id) { App.go("lessons"); if (id) Lessons.open(id); }
  function openProblem(iid) { App.go("judge"); if (iid) Judge.select(iid); }

  function recentLessons(n = 4) {
    const ids = [D.cfg.last_lesson, ...(D.cfg.recent_lessons || [])].filter(Boolean);
    const seen = new Set(), out = [];
    for (const id of ids) {
      if (seen.has(id)) continue; seen.add(id);
      const l = findLesson(id);
      if (l && !(typeof Org !== "undefined" && Org.isHidden("lessons", l.id))) out.push(l);
      if (out.length >= n) break;
    }
    return out;
  }
  function recentProblems(n = 4) {
    const ids = [D.cfg.last_problem, ...(D.cfg.recent_problems || [])].filter(Boolean);
    const seen = new Set(), out = [];
    for (const iid of ids) {
      if (seen.has(iid)) continue; seen.add(iid);
      const p = findProblem(iid);
      if (p) out.push(p);
      if (out.length >= n) break;
    }
    return out;
  }

  const win = (title, body, o = {}) => {
    const bar = Retro.titleBar(title, { icon: o.icon, tone: o.tone || "navy" });
    bar.classList.add("sm");
    return h("section", { class: "hm-win " + (o.cls || ""), "aria-label": title }, bar, h("div", { class: "hm-body" }, body));
  };

  function welcome() {
    const st = D.streak || {}, lastL = findLesson(D.cfg.last_lesson), lastP = findProblem(D.cfg.last_problem);
    const name = (D.cfg.name || "friend").trim();
    let line;
    if (st.current > 0) line = `Day ${st.current} of your streak. ${st.today_n || 0} of ${st.goal || 3} runs done today.`;
    else if (lastL || lastP) line = "Pick up where you left off, or start something new.";
    else line = "Lessons to read, problems to solve, streaks to keep. Everything runs on this computer.";
    const actions = h("div", { class: "hm-actions" });
    if (lastL) actions.append(h("button", { class: "btn pri", title: lastL.title, onclick: () => openLesson(lastL.id) }, Retro.sprite("book", 16), "Continue lesson"));
    else actions.append(h("button", { class: "btn pri", onclick: () => App.go("lessons") }, Retro.sprite("book", 16), "Browse lessons"));
    if (lastP) actions.append(h("button", { class: "btn", title: lastP.title, onclick: () => openProblem(lastP.iid) }, Retro.sprite("terminal", 16), "Resume problem"));
    else actions.append(h("button", { class: "btn", onclick: () => App.go("judge") }, Retro.sprite("terminal", 16), "Open Judge"));
    actions.append(h("button", { class: "btn", onclick: () => App.go("manual") }, Retro.sprite("book", 16), "Manual"));
    return win("WELCOME.EXE", h("div", { class: "hm-hero" },
      h("div", { class: "hm-art", "aria-hidden": "true" }, Retro.sprite("terminal", 78), h("span", { class: "hm-heart" }, Retro.sprite("heart", 22))),
      h("div", { class: "hm-hello" }, h("div", { class: "kicker" }, "LOCAL JUDGE · HOME"), h("h1", {}, `${greet()}, ${name}.`), h("p", {}, line), actions),
      h("div", { class: "hm-clock" }, Retro.clock())),
    { cls: "hm-welcome", tone: "pink", icon: Retro.sprite("heart", 16) });
  }

  function streak() {
    const st = D.streak || {};
    const cur = st.current || 0, best = st.best || 0, goal = st.goal || 3, today = st.today_n || 0;
    const pct = Math.min(100, Math.round(100 * today / goal)), hit = today >= goal;
    const level = st.level || 1, title = st.level_title || "Seed", xp = st.xp || 0;
    return win("STREAK.EXE", h("div", { class: "hm-streakbody" },
      h("div", { class: "hm-flame-row" }, Retro.sprite("flame", 62),
        h("div", { class: "hm-flame-text" }, h("b", {}, String(cur)), h("small", {}, "day streak"))),
      h("div", { class: "hm-goal" }, Retro.segBar(pct, 12, hit ? "ok" : ""),
        h("small", {}, h("span", {}, hit ? "Goal reached" : `${today} / ${goal} today`), h("span", {}, `best ${best}`))),
      h("div", { class: "hm-level" }, h("span", {}, "Level ", h("b", {}, String(level)), " ", h("i", {}, title)), h("span", {}, `${xp} XP`)),
      h("button", { class: "btn", onclick: () => App.go("streaks") }, Retro.sprite("star", 16), "Open Streaks")),
    { cls: "hm-streak", tone: "navy", icon: Retro.sprite("star", 16) });
  }

  function lessonRow(l) {
    const n = lessonDone(l), total = (l.acts || []).length;
    const pct = total ? Math.round(100 * n / total) : 0;
    return h("button", { class: "hm-row", title: l.title, onclick: () => openLesson(l.id) },
      Retro.sprite("book", 20),
      h("div", { class: "t" }, h("b", {}, l.title), h("small", {}, l.course ? l.course.title : "Lesson"), h("div", { class: "hm-prog" }, h("i", { style: { width: pct + "%" } }))),
      h("span", { class: "sc" }, total ? `${n}/${total}` : "read"));
  }
  function problemRow(p) {
    const earned = problemPoints(p);
    return h("button", { class: "hm-row", title: p.title, onclick: () => openProblem(p.iid) },
      Retro.sprite("terminal", 20),
      h("div", { class: "t" }, h("b", {}, p.title), h("small", {}, p.moduleTitle || "Problem")),
      h("span", { class: "sc" }, `${earned}/${p.points}`));
  }
  function recent() {
    const lessons = recentLessons(), problems = recentProblems();
    const col = (title, rows, empty, go) => h("div", { class: "hm-col" },
      h("h4", {}, h("span", {}, title), h("small", {}, String(rows.length))),
      rows.length ? rows : h("div", { class: "hm-empty" }, empty, h("div", { style: { marginTop: "8px" } }, h("button", { class: "btn sm", onclick: go }, "Open"))));
    return win("RECENT.EXE", h("div", { class: "hm-cols" },
      col("Lessons", lessons.map(lessonRow), "No lessons opened yet.", () => App.go("lessons")),
      col("Problems", problems.map(problemRow), "No problems opened yet.", () => App.go("judge"))),
    { cls: "hm-recent", tone: "navy", icon: Retro.sprite("floppy", 16) });
  }

  function syncCard() {
    const on = syncOn(), last = D.cfg.last_sync;
    const fresh = (D.lib || []).filter((i) => i.status === "new").length;
    const checked = (D.lib || []).length > 0;
    const cls = !on ? "" : syncDot();
    const label = !on ? "Sync is off" : last ? `Last synced ${ago(last)}` : "Not synced yet";
    const body = h("div", { class: "hm-syncbody" },
      h("div", { class: "hm-status" }, h("span", { class: "hm-dot " + cls }), h("b", {}, label)),
      h("div", { class: "hm-syncmeta" },
        on ? h("span", {}, fresh ? `${fresh} new in Library` : checked ? "Library checked" : "Not checked yet") : h("span", {}, "Progress stays on this computer"),
        on && last ? h("span", {}, last) : null),
      h("p", { class: "hm-empty" }, on ? (fresh ? "New lessons and problems are waiting in the Library." : "Scores, answers, streaks and your folder layout go to Drive.") : "Set up Drive sync to move progress between computers."),
      h("div", { class: "hm-actions" },
        h("button", { class: "btn " + (on ? "pri" : ""), onclick: () => (on ? App.syncNow() : App.go("settings")) }, Retro.sprite("floppy", 16), on ? "Sync now" : "Set up sync"),
        on ? h("button", { class: "btn", onclick: () => App.go("library") }, Retro.sprite("folder", 16), "Library") : null));
    return win("SYNC.EXE", body, { tone: "pink", icon: Retro.sprite("cd", 16) });
  }

  function readme() {
    return win("README.TXT", h("div", { class: "hm-readme" },
      h("p", {}, "First time? The manual explains every screen, the keyboard shortcuts, Drive sync, and how to add your own lessons and problems."),
      h("div", { class: "hm-actions" },
        h("button", { class: "btn pri", onclick: () => App.go("manual") }, Retro.sprite("book", 16), "Open manual"),
        h("button", { class: "btn", onclick: () => App.go("settings") }, Retro.sprite("star", 16), "Settings"))),
    { tone: "navy", icon: Retro.sprite("book", 16) });
  }

  function draw() {
    const el = clear(root());
    el.append(h("div", { class: "hm-home" }, h("div", { class: "hm-scroll" }, h("div", { class: "hm-grid" },
      welcome(), streak(), recent(), h("div", { class: "hm-side" }, syncCard(), readme())))));
  }

  return { show: draw, draw };
})();

/* ================================ Manual ================================ */
const Manual = (() => {
  const root = () => $("#v-manual");
  const p = (text) => h("p", {}, text);
  const list = (items) => h("ul", {}, items.map((x) => h("li", {}, x)));
  const keys = (rows) => h("div", { class: "mn-keys" }, rows.flatMap(([k, d]) => [h("div", {}, h("kbd", {}, k)), h("div", {}, h("span", {}, d))]));

  let query = "";

  function section(id, title, ...body) {
    return h("section", { class: "mn-sec", id: "mn-" + id }, h("h2", {}, title), body);
  }

  const SECTIONS = [
    section("start", "Start here",
      p("Local Judge is a small offline study tool for Python. Lessons are readable walkthroughs; problems are checked against hidden tests. Everything runs on your computer. The only optional online part is Drive sync."),
      h("div", { class: "mn-callout" }, h("b", {}, "The five-minute version"), list([
        "Type your name in the Welcome window and press Get started.",
        "Open Lessons and read the first lesson, doing each activity as it appears.",
        "Open Judge, pick a problem, write the function, then press Check answer.",
        "Use Home to see your streak, recent work and sync status.",
      ])),
      p("Nothing is installed. Python only needs the standard library, and the app opens in its own Edge/Chrome window."),
      p("A small window may appear at the top right: a badge unlocked, new Library items after a sync, or a reminder if you have not synced in a couple of days. Hover to keep it open; each one has an action button."),
      h("div", { class: "mn-nav" }, h("button", { class: "btn", onclick: () => App.go("lessons") }, "Open Lessons"), h("button", { class: "btn", onclick: () => App.go("judge") }, "Open Judge"))),

    section("screens", "The screens",
      p("The left bar is always there. Press Ctrl+1 to Ctrl+7 in this order: Home, Lessons, Judge, Collection, Library, Streaks, Manual."),
      list([
        [h("b", {}, "Home "), "— dashboard windows on a nostalgic wallpaper: streak, recent lessons and problems, sync status and the manual."],
        [h("b", {}, "Lessons "), "— read a lesson and complete its quizzes, predictions, fills and code exercises. Progress is saved as you go."],
        [h("b", {}, "Judge "), "— solve programming problems. Run tries your code; Check answer runs the hidden tests and records your best score."],
        [h("b", {}, "Collection "), "— your folders and files. Drag lessons/problems into folders, pin, hide, rename; the layout is yours."],
        [h("b", {}, "Library "), "— lessons and problems shared through the group's Drive folder. Nothing is installed until you press Add."],
        [h("b", {}, "Streaks "), "— current streak, calendar, daily goal, level/XP and badges."],
        [h("b", {}, "Manual "), "— this page. Also opens with F1."],
        [h("b", {}, "Settings "), "— name, sync address/secret, theme, text sizes, layout import/export and AI prompts."],
      ])),

    section("lessons", "Lessons and activities",
      p("Each lesson is a sequence of short explanations and small activities. Hints reveal one at a time; solutions appear only after you ask for them."),
      list([
        [h("b", {}, "Quiz"), " — choose one or several answers, then check."],
        [h("b", {}, "Predict"), " — read the code and commit to the exact output before running it."],
        [h("b", {}, "Fill"), " — complete the blanks; the code must be valid when filled."],
        [h("b", {}, "Exercise"), " — write code and press Check. The tests are hidden, so the hints matter."],
        [h("b", {}, "Try it"), " — edit and run freely; nothing is graded."],
      ]),
      p("Progress is remembered per lesson and per activity. Reset lesson in the lesson header clears that lesson's answers and code so you can practise again.")),

    section("judge", "Writing and checking code",
      p("Choose a problem on the left. The statement has the story, the task, examples and constraints. Write your function in the editor, then:"),
      list([
        [h("b", {}, "Run (Ctrl+Enter)"), " runs your code and shows what it prints. It does not check the hidden tests."],
        [h("b", {}, "Check answer (Ctrl+Shift+Enter)"), " runs the hidden tests and records your best score for that problem."],
        [h("b", {}, "Stop"), " appears while a program is running, so an accidental infinite loop never makes you wait."],
        [h("b", {}, "Big-O"), " times your function on growing inputs and estimates its complexity. This is a rough measurement, not a proof."],
      ]),
      p("Your score is the best one you have reached, so a failed re-check never lowers it. Your written code is saved on this computer in the user_code folder; it is not uploaded by sync." )),

    section("editor", "Editor and keyboard",
      p("The editor has syntax colors, line numbers, bracket matching, auto-closing brackets and quotes, and auto-indent after a colon."),
      p("As you type a word, a small popup predicts the rest from Python keywords, built-ins, snippets and the words already in the file. The highlighted entry is inserted with Tab or Enter; faint text after the cursor is the same prediction in place. Ctrl+Space opens the list by hand, ↑ ↓ choose and Esc closes it."),
      keys([
        ["Ctrl+Enter", "Run without checking"], ["Ctrl+Shift+Enter", "Check against hidden tests"],
        ["Ctrl+1 … Ctrl+7", "Home, Lessons, Judge, Collection, Library, Streaks, Manual"],
        ["F1", "Open this manual"], ["Ctrl+B", "Hide or show the list panel"],
        ["Ctrl+Space", "Predict the rest of the word"], ["Tab / Enter", "Accept the highlighted prediction"],
        ["Ctrl+F", "Find in code (or search the list)"], ["Ctrl+H", "Find and replace in code"],
        ["Ctrl+/", "Comment or uncomment"], ["Ctrl+D", "Select word, then next match"],
        ["Ctrl+Shift+D", "Duplicate line"], ["Ctrl+L", "Select line"],
        ["Ctrl+Shift+K", "Delete line"], ["Alt+Up / Down", "Move line up or down"],
        ["Ctrl+[  /  Ctrl+]", "Unindent / indent"], ["Tab / Shift+Tab", "Indent / unindent selection"],
        ["Ctrl+S", "Does nothing (no browser Save dialog)"],
      ])),

    section("sync", "Drive sync",
      p("Sync is optional. It merges your work with a small JSON file in a shared Google Drive folder, so progress follows you to another computer with the same name."),
      h("h3", {}, "Set it up once (folder owner)"),
      list([
        "Open script.google.com, create a project and paste drive_sync.gs.",
        "Deploy → New deployment → Web app. Execute as Me, access Anyone. Authorize and copy the /exec address.",
        "Decide on a secret in the script (SECRET), then give the address and secret to the group privately.",
      ]),
      h("h3", {}, "Each person"),
      list([
        "Settings → Sync address, paste the /exec address; enter the same secret if one was set.",
        "Use the same name on every computer to get the same progress back.",
        "Press Sync now, or let the app sync automatically at start and shortly after changes.",
      ]),
      h("h3", {}, "What syncs"),
      list([
        "Problem scores, lesson answers and cards, streaks/XP, and your Collection layout.",
        "Your last and recent lessons/problems (so Home follows you between computers).",
        "Lessons and problems you have that the shared Library does not: they are published for the group to add.",
      ]),
      h("h3", {}, "What does not sync"),
      list([
        "Your written code in user_code, theme, font sizes and other local settings.",
        "The install itself, the browser profile, and anything before the first sync.",
      ]),
      p("If sync fails, the app keeps working locally. Check that the address ends in /exec, access is Anyone, the secret matches, and the internet is up.")),

    section("files", "Your files and backups",
      p("Everything is plain JSON next to the app:"),
      list([
        [h("b", {}, "config.json"), " — your name, sync address, theme, sizes, recent activity."],
        [h("b", {}, "progress.json"), " — best score per problem."],
        [h("b", {}, "lessons_state.json"), " — finished activities, answers and saved code cards."],
        [h("b", {}, "streaks.json"), " — days coded, restores, badges."],
        [h("b", {}, "organize.json"), " — Collection folders, hidden items and pins."],
        [h("b", {}, "user_code/"), " — the code you wrote in the Judge."],
      ]),
      p("To back up, copy those files (or sync). Settings → Your layout also exports/imports the Collection layout as one small file. The .app_profile folder is only the browser window's profile; it can be deleted while the app is closed.")),

    section("content", "Adding lessons and problems",
      list([
        "Drop .md lesson files into lessons/<course>/ and problem modules into modules/<module_id>/.",
        "Press Ctrl+L (or Settings → Reload lessons and problems).",
        "Or copy a prompt from Settings → Ask another AI, paste it into any AI, and save what it writes.",
        "Share through the Library: sync publishes your local lessons/modules so others can Add them.",
      ]),
      p("Lessons with activities are checked by python validate_lessons.py. Problems show up if their manifest.json and problems.json load without errors; Settings lists any file that failed.")),

    section("trouble", "If something goes wrong",
      list([
        [h("b", {}, "“Lost contact with the local server”"), " — press Reload on the banner; if that fails, close the window and open the app again. The local server exits with the window."],
        [h("b", {}, "The window does not open"), " — install Microsoft Edge or Google Chrome, or open the printed 127.0.0.1 address in a browser."],
        [h("b", {}, "A lesson or problem is missing"), " — Ctrl+L; check Settings for file errors; check that Collection is not hiding it."],
        [h("b", {}, "Sync says wrong secret"), " — the SECRET in drive_sync.gs and Settings → Sync secret must match exactly."],
        [h("b", {}, "Sync did not bring an item"), " — the Library only offers it; press Add in Library. Already-added files are not overwritten."],
        [h("b", {}, "The app feels slow"), " — close other browser windows; the judge timeout is per test, and a slow solution can hit the limit."],
      ])),

    section("privacy", "Privacy and sharing",
      p("The judge server listens only on 127.0.0.1 and every request needs a random token from the page, so other websites cannot call it. Do not expose that port to the internet."),
      p("Sync stores one progress.json per name in the Drive folder. The address is a capability: anyone who has it can read and add to that folder, so share it only with your group, set SECRET, and never paste it into a public repo or chat."),
      p("A shared lesson or problem file is content, not code you run automatically. Still, only add files from people you trust.")),

    section("about", "About Local Judge",
      p("Local Judge is a local, standard-library Python app: judge.py launches the window, server.py serves the API, web/ is the interface, and your lessons and problems are plain files. It began as a CS 11 study tool."),
      p("Keyboard: F1 opens this manual, Ctrl+1..7 move between screens, Ctrl+B hides the list, Ctrl+L reloads lessons and problems.")),
  ];

  function draw() {
    const el = clear(root());
    const win = h("div", { class: "fx-win mn-win" }, Retro.titleBar("Manual – Local Judge", { icon: Retro.sprite("book", 18), tone: "pink" }));
    const search = h("input", { class: "mn-search", type: "search", placeholder: "Search the manual", value: query, "aria-label": "Search the manual" });
    const toc = h("div", { class: "mn-toc" }, h("div", { class: "mn-toc-title" }, "Contents"));
    const main = h("div", { class: "mn-main" }, SECTIONS, h("div", { class: "mn-empty", id: "mnEmpty" }, "Nothing matches that search."));
    const showSec = (id) => {
      query = search.value.toLowerCase().trim();
      let shown = 0;
      for (const s of SECTIONS) {
        const match = !query || s.textContent.toLowerCase().includes(query);
        s.style.display = match ? "" : "none";
        const b = toc.querySelector(`[data-sec="${s.id}"]`);
        if (b) b.style.display = match ? "" : "none";
        if (match) shown++;
      }
      $("#mnEmpty").style.display = shown ? "none" : "block";
    };
    search.addEventListener("input", showSec);
    for (const s of SECTIONS) {
      const b = h("button", { "data-sec": s.id, onclick: () => { s.scrollIntoView({ block: "start" }); toc.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); } }, s.querySelector("h2").textContent);
      toc.append(b);
    }
    const bar = h("div", { class: "mn-bar" }, search, h("button", { class: "btn", onclick: () => window.print() }, "Print"), h("span", { class: "grow" }),
      h("button", { class: "btn", onclick: () => App.go("home") }, "Back to Home"),
      h("button", { class: "btn", onclick: () => App.go("settings") }, "Settings"));
    win.append(bar, h("div", { class: "mn-body" }, toc, main));
    el.append(h("div", { class: "fx-desk" }, win));
    showSec();
  }

  return { show: draw, draw };
})();
