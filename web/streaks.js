/* Streaks screen: a calm desktop of small windows.
   The numbers come from streaks.py through the server; this file only draws them. */
const Streaks = (() => {
  let S = null, month = null, loading = false, loadSeq = 0;
  const root = () => $("#v-streaks");
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const stamp = (iso) => String(iso || "").replace(/-/g, ".");
  const seenBadges = new Set();

  /* Badges that arrive together share one top-right notice, so the corner never fills up. */
  function announce(list) {
    const fresh = (list || []).filter((b) => b && b.id && !seenBadges.has(b.id));
    if (!fresh.length) return;
    fresh.forEach((b) => seenBadges.add(b.id));
    if (typeof Notify !== "undefined") Notify.badges(fresh);
    else fresh.forEach((b) => toast(`${b.icon || "★"}  Badge unlocked: ${b.title}`, "ok"));
  }

  /* Called for every server reply that carries a streak summary (running, checking, syncing...). */
  function note(s) {
    if (!s || typeof s !== "object") return;
    try {
      D.streak = Object.assign(D.streak || {}, { current: s.current, best: s.best, status: s.status, today_n: s.today_n, goal: s.goal,
        level: s.level, level_title: s.level_title, xp: s.xp, restores_left: s.restores_left });
      if (typeof App !== "undefined") App.markRail();
      if (s.first_of_day && s.current > 0) toast(s.current === 1 ? "Streak started. Come back tomorrow to make it 2." : `Day ${s.current} of your streak. Keep it going!`, "ok");
      if (s.goal_hit) toast(`Daily goal reached: ${s.today_n} runs today.`, "ok");
      announce(s.new_badges);
      if ((s.new_badges || []).length || s.first_of_day) S = null;       // refetch next time the screen opens
    } catch (e) { console.warn(e); }
  }

  async function load() {
    const seq = ++loadSeq;
    loading = true;
    try {
      const r = await api("streaks/state", { month });
      if (seq !== loadSeq) return;                 // a newer month was clicked; keep that answer
      S = r;
      month = S.calendar.month;
    } catch (e) {
      if (seq === loadSeq) toast(e.message, "err");
    }
    if (seq !== loadSeq) return;
    loading = false;
    draw();
    if (S) announce(S.new_badges);
  }
  function show() { draw(); load(); }

  const shift = (m, d) => { const [y, mo] = m.split("-").map(Number); const t = new Date(y, mo - 1 + d, 1); return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0"); };
  async function go(d) { month = shift(S.calendar.month, d); await load(); }

  async function setGoal(v) {
    try { S = await api("streaks/goal", { goal: +v, month }); D.cfg.daily_goal = +v; toast(`Daily goal set to ${v} runs.`, "ok"); }
    catch (e) { toast(e.message, "err"); }
    draw(); if (typeof App !== "undefined") App.markRail();
  }
  async function restore() {
    try {
      const r = await api("streaks/restore", { month });
      S = r; D.streak = Object.assign(D.streak || {}, { current: r.current, best: r.best, status: r.status, restores_left: r.restores_left });
      announce(r.new_badges);
      toast(r.restored ? `Streak restored. You are back at ${r.current} days.` : r.why, r.restored ? "ok" : "err");
    } catch (e) { toast(e.message, "err"); }
    draw(); if (typeof App !== "undefined") App.markRail();
  }

  /* ---------------- pieces ---------------- */
  /* A small window with a title strip. tone: pink | navy | red */
  const panel = (title, body, o = {}) => h("section", { class: "sd-panel " + (o.cls || ""), "aria-label": title },
    h("div", { class: "fx-title sm " + (o.tone || "pink") }, o.icon || null, h("span", { class: "fx-title-text" }, title), o.extra || null), h("div", { class: "sd-body" }, body));

  function headline(s) {
    switch (s.status) {
      case "new": return ["Start your streak", "Run or check some code today and the fire is lit."];
      case "done": return ["You coded today", "Your streak is safe until tomorrow."];
      case "safe": return ["Code today to keep it going", `Run or check anything to make it day ${s.current + 1}.`];
      case "risk": return ["Yesterday was a rest day", "One day off is fine. Code today or the streak resets tonight."];
      default: return ["Your streak ended", s.offer && s.offer.can ? "You can bring it back with a restore." : "Code today to start a new one."];
    }
  }
  const stat = (label, value) => h("div", { class: "sd-stat" }, h("b", {}, String(value)), h("small", {}, label));

  function hero(s) {
    const [t, sub] = headline(s);
    const lvlPct = Math.min(100, Math.round((100 * s.level_into) / s.level_span));
    return panel("STREAK.EXE", h("div", { class: "sd-hero " + s.status },
      h("div", { class: "sd-medal", "aria-hidden": "true" }, Retro.sprite("flame", 66)),
      h("div", { class: "sd-num" }, h("b", {}, String(s.current)), h("span", {}, "day streak")),
      h("div", { class: "sd-lead" }, h("h2", {}, t), h("p", {}, sub),
        h("div", { class: "sd-stats" }, stat("Best streak", s.best), stat("Days coded", s.total_days), stat("Solved", s.solved))),
      h("div", { class: "sd-lvlbox", title: `${s.xp} XP` },
        h("div", { class: "sd-lvl-top" }, h("b", {}, `Level ${s.level}`), h("span", {}, s.level_title)),
        Retro.segBar(lvlPct, 12),
        h("small", { class: "sd-lvlnote" }, `${s.xp} XP · ${s.level_next_at - s.xp} to ${s.level_next_title}`))),
    { tone: "pink", cls: "sd-hero-p", icon: Retro.sprite("heart", 16) });
  }

  function daily(s) {
    const pct = Math.min(100, Math.round((100 * s.today_n) / s.goal)), hit = s.today_n >= s.goal;
    const sel = h("select", { class: "fx-select", "aria-label": "Daily goal", onchange: (e) => setGoal(e.target.value) }, [3, 5, 8, 10, 15, 25].concat(s.goal).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b)
      .map((v) => h("option", { value: v, selected: v === s.goal }, `${v} a day`)));
    return panel("Today's goal", h("div", { class: "sd-daily" },
      h("div", { class: "sd-big" }, h("b", {}, String(Math.min(s.today_n, 999))), h("span", {}, ` / ${s.goal}`), h("small", {}, hit ? "Goal reached. Anything else today is a bonus." : "runs, checks or exercises")),
      Retro.segBar(pct, 14, hit ? "ok" : ""),
      h("div", { class: "sd-row" }, h("small", {}, `${pct}% done`), h("label", {}, "Daily goal ", sel)),
      hit ? h("p", { class: "sd-tiny sd-hooray" }, Retro.sprite("heart", 14), "Sweet. Come back tomorrow to keep it going.") : null),
    { tone: "navy", icon: Retro.sprite("star", 16) });
  }

  function restores(s) {
    const hearts = h("div", { class: "sd-hearts", title: `${s.restores_left} of ${s.restores_max} restores left this month`, role: "img", "aria-label": `${s.restores_left} of ${s.restores_max} restores left` },
      Array.from({ length: s.restores_max }, (_, i) => h("span", { class: i < s.restores_left ? "on" : "off" }, Retro.sprite("heart", 24))));
    const o = s.offer, kids = [hearts, h("p", { class: "sd-small" }, `${s.restores_left} of ${s.restores_max} left this month · refill on the 1st`)];
    if (o) {
      kids.push(h("p", { class: "sd-small" }, `You missed ${plural(o.length, "day")} in a row and lost a ${plural(o.lost, "day")} streak. Restoring it takes you to ${plural(o.after, "day")}.`));
      kids.push(h("button", { class: "btn pri", disabled: !o.can, onclick: restore }, "Restore my streak (uses 1)"));
      if (!o.can) kids.push(h("p", { class: "sd-tiny" }, o.why === "too_long" ? `One restore covers up to ${s.limits.max_gap} missed days, and this slip was longer.` : "You are out of restores this month."));
    } else kids.push(h("p", { class: "sd-tiny" }, "Nothing to restore right now."));
    return panel("Streak restores", h("div", { class: "sd-restore" }, kids), { tone: "pink", cls: "sd-restore-p", icon: Retro.sprite("heart", 16) });
  }

  function calendar(s) {
    const c = s.calendar, cells = [];
    DOW.forEach((d) => cells.push(h("div", { class: "sd-dow" }, d)));
    for (let i = 0; i < c.start; i++) cells.push(h("div", { class: "sd-cell blank" }));
    for (const d of c.days) {
      const bits = [d.n ? plural(d.n, "run") : "", d.solved ? plural(d.solved, "solve") : "", d.goal ? "goal met" : ""].filter(Boolean).join(", ");
      const now = d.d === s.today;
      cells.push(h("div", { class: "sd-cell " + d.s + (now ? " now" : ""), title: d.d + (bits ? ": " + bits : "") },
        h("span", { class: "n" }, String(+d.d.slice(8))),
        h("span", { class: "marks" }, d.goal ? h("i", { class: "star", title: "Daily goal met" }, "★") : null,
          d.solved ? h("i", { class: "slv", title: `${plural(d.solved, "problem")} solved` }, "●".repeat(Math.min(d.solved, 3))) : null),
        d.n ? h("span", { class: "cnt", title: plural(d.n, "run") }, String(d.n)) : null,
        now ? h("span", { class: "stamp", "aria-hidden": "true" }, Retro.sprite("heart", 30)) : null));
    }
    const legend = [["active", "Coded"], ["rest", "Rest day"], ["miss", "Missed"], ["restored", "Restored"]];
    const isCurrentMonth = c.month === s.today.slice(0, 7);
    const nav = h("span", { class: "sd-calnav" },
      h("button", { class: "fx-x", "aria-label": "Previous month", onclick: () => go(-1) }, "‹"),
      !isCurrentMonth ? h("button", { class: "fx-x wide", onclick: () => { month = s.today.slice(0, 7); load(); } }, "Today") : null,
      h("button", { class: "fx-x", "aria-label": "Next month", onclick: () => go(1) }, "›"));
    return panel(`Calendar – ${c.label}`, h("div", { class: "sd-calwrap" }, h("div", { class: "sd-cal" }, cells),
      h("div", { class: "sd-legend" }, legend.map(([k, l]) => h("span", {}, h("i", { class: "sw " + k }), l)), h("span", {}, h("i", { class: "star" }, "★"), "Goal met"), h("span", {}, h("i", { class: "slv" }, "●"), "Problem solved"))),
    { tone: "navy", cls: "sd-cal-p", extra: nav });
  }

  function badges(s) {
    const earned = s.badges.filter((b) => b.earned), locked = s.badges.filter((b) => !b.earned);
    const pct = Math.round((100 * earned.length) / Math.max(1, s.badges.length));
    return panel(`Badges – ${earned.length} of ${s.badges.length} earned`, h("div", { class: "sd-badges" },
      h("div", { class: "sd-bprogress" }, Retro.segBar(pct, Math.max(8, s.badges.length)), h("small", {}, `${pct}% unlocked`)),
      earned.length ? h("div", { class: "sd-bgrid" }, earned.map((b) => h("div", { class: "sd-btile", title: b.desc },
        h("span", { class: "ic", "aria-hidden": "true" }, b.icon),
        h("div", { class: "sd-btile-txt" }, h("b", {}, b.title), h("small", {}, `Unlocked ${stamp(b.on)}`))))) :
        h("p", { class: "sd-empty" }, Retro.sprite("star", 26), "No badges yet. Run some code to light the first one."),
      locked.length ? h("div", { class: "sd-blocked" },
        h("div", { class: "sd-sub" }, h("span", {}, "Still locked"), h("small", {}, `${locked.length} to find`)),
        h("div", { class: "sd-bchips" }, locked.map((b) => h("span", { class: "sd-bchip", title: b.desc }, Retro.sprite("lock", 16), b.title)))) : null),
    { tone: "pink", cls: "sd-badges-p", icon: Retro.sprite("star", 16) });
  }

  function rules(s) {
    return h("details", { class: "sd-rules" }, h("summary", {}, "How streaks, XP and badges work"),
      h("ul", {}, h("li", {}, "A day counts when you run code, check an answer, finish a lesson exercise or use Big-O."),
        h("li", {}, "One day off is fine. Two days in a row without coding resets the streak to zero."),
        h("li", {}, `You get ${s.restores_max} restores a month. One restore covers up to ${s.limits.max_gap} missed days, within ${s.limits.window} days of the slip.`),
        h("li", {}, "XP comes from problem points, finished lesson activities, each day you code, and your best streak."),
        h("li", {}, "Your streak is worked out from the days you coded, so it follows you to other computers when you sync.")));
  }

  function draw() {
    const el = clear(root());
    const win = h("div", { class: "fx-win sd-win" }, Retro.titleBar("Streaks – Dashboard", { icon: Retro.sprite("flame", 18), tone: "pink" }));
    if (!S) {
      win.append(h("div", { class: "sd-scroll" }, h("div", { class: "sd-load" }, h("b", {}, loading ? "Loading your streak…" : "Nothing to show yet."), loading ? Retro.segBar(40, 18) : null)));
      el.append(h("div", { class: "fx-desk" }, win)); return;
    }
    win.append(h("div", { class: "sd-scroll" }, h("div", { class: "sd-grid" },
      hero(S), calendar(S), h("div", { class: "sd-side" }, daily(S), restores(S)), badges(S), rules(S))),
      h("div", { class: "fx-status" }, h("span", { class: "fx-sp" }, `${plural(S.today_n, "run")} today`),
        h("span", { class: "fx-sp grow" }, `${plural(S.total_days, "day")} coded · best ${S.best}`),
        h("span", { class: "fx-sp" }, `${S.restores_left}/${S.restores_max} restores left`),
        h("span", { class: "fx-sp heart" }, Retro.sprite("heart", 14), "LOCAL JUDGE")));
    el.append(h("div", { class: "fx-desk" }, win));
  }

  return { show, note };
})();

