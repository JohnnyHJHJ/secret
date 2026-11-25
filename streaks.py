"""
Streaks, daily goal, XP, levels and badges for Local Judge. Standard library only.

Everything lives as plain data in streaks.json (next to the app) so sync.py can merge it between
computers. The streak itself is never stored: it is recomputed from the list of days you coded,
which makes it easy to merge and impossible to corrupt.

Rules
  * A day counts when you run or check code (or run a lesson exercise, or use the Big-O detector).
  * One day off is fine (a "rest day"). Two or more days in a row without coding resets the streak.
  * Restores: after a slip you can spend a restore to bring the streak back. You get
    RESTORES_PER_MONTH per calendar month. One restore can bridge up to RESTORE_MAX_GAP missed days,
    and only while the slip is no more than RESTORE_WINDOW days old.
"""
import os
import copy
import json
import math
import shutil
import datetime as dt
from collections import Counter

RESTORES_PER_MONTH = 3
MISS_LIMIT = 2            # this many missed days in a row resets the streak
RESTORE_MAX_GAP = 3
RESTORE_WINDOW = 7
DEFAULT_GOAL = 5

LEVEL_TITLES = ["Hatchling", "Sprout", "Bud", "Bloom", "Blossom", "Bouquet", "Garden", "Grove", "Orchard", "Wonderland"]
KIND_KEY = {"run": "runs", "check": "checks", "lesson": "lessons", "bigo": "bigo"}


# ----------------------------------------------------------------------------- data
def empty():
    return {"activity": {}, "restores": [], "solved_at": {}, "first_checks": {}, "bigo_runs": 0, "marks": {}, "badges": {}}


def normalize(d):
    out = empty()
    if isinstance(d, dict):
        for k in out:
            if k in d and isinstance(d[k], type(out[k])):
                out[k] = copy.deepcopy(d[k])
    act = {}
    for day, v in out["activity"].items():
        try:
            dt.date.fromisoformat(day)
        except (ValueError, TypeError):
            continue
        if isinstance(v, dict):
            v = dict(v)
            try:
                v["n"] = int(v.get("n", 0) or 0)
            except (TypeError, ValueError):
                v["n"] = 0
            act[day] = v
    out["activity"] = act
    out["restores"] = [r for r in out["restores"] if isinstance(r, dict) and isinstance(r.get("days"), list)]
    return out


def _backup(path):
    try:
        if os.path.isfile(path) and not os.path.exists(path + ".bad"):
            shutil.copy2(path, path + ".bad")
    except Exception:
        pass


def load(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            _backup(path)
            return empty()
        return normalize(data)
    except FileNotFoundError:
        return empty()
    except Exception:
        _backup(path)
        return empty()


def save(path, data):
    tmp = path + ".tmp"
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=1, sort_keys=True)
        os.replace(tmp, path)
    except Exception:
        pass


# ----------------------------------------------------------------------------- recording
def record(data, kind, now=None, goal=DEFAULT_GOAL, iid=None, earned=None, maximum=None):
    """Note one piece of coding. Returns {"first_of_day", "goal_hit"}."""
    now = now or dt.datetime.now()
    day = now.date().isoformat()
    a = data["activity"].setdefault(day, {"n": 0})
    first_of_day = a.get("n", 0) == 0
    a["n"] = a.get("n", 0) + 1
    key = KIND_KEY.get(kind, "runs")
    a[key] = a.get(key, 0) + 1
    hhmm = now.strftime("%H:%M")
    a.setdefault("first", hhmm)
    a["last"] = hhmm
    if now.hour < 5:
        data["marks"].setdefault("night", day)
    elif now.hour < 8:
        data["marks"].setdefault("early", day)
    if kind == "bigo":
        data["bigo_runs"] = data.get("bigo_runs", 0) + 1
    if kind == "check" and iid:
        data["first_checks"].setdefault(iid, [earned or 0, maximum or 0])
        if maximum and earned is not None and earned >= maximum:
            data["solved_at"].setdefault(iid, day)
    goal_hit = False
    if goal and a["n"] >= goal and not a.get("goal"):
        a["goal"] = True
        goal_hit = True
    return {"first_of_day": first_of_day, "goal_hit": goal_hit}


# ----------------------------------------------------------------------------- the streak
def _day(s):
    return dt.date.fromisoformat(s)


def walk(data, today):
    """Walk every day from the first coding day to today and work out the streak."""
    active = {d for d, v in data["activity"].items() if v.get("n", 0) > 0}
    restored = set()
    for r in data["restores"]:
        restored.update(r.get("days", []))
    res = {"status": {}, "gaps": [], "streak": 0, "best": 0, "run": 0, "active": active, "last_active": ""}
    if not active:
        res["status"][today.isoformat()] = "today"
        return res
    status, gaps = res["status"], res["gaps"]
    first = min(_day(d) for d in active)
    first = min(first, today)
    streak = best = lost_at_run = 0
    run = []

    def close_run(ongoing=False):
        nonlocal run
        if not run:
            return
        if len(run) >= MISS_LIMIT:
            for k in run:
                status[k] = "miss"
            gap = {"days": list(run), "lost": lost_at_run}
            if ongoing:
                gap["ongoing"] = True
            gaps.append(gap)
        else:
            for k in run:
                status[k] = "rest"
        run = []

    one = dt.timedelta(days=1)
    cur, yesterday = first, today - one
    while cur <= yesterday:
        k = cur.isoformat()
        if k in active:
            close_run()
            streak += 1
            status[k] = "active"
        elif k in restored:
            close_run()
            status[k] = "restored"
        else:
            if not run:
                lost_at_run = streak
            run.append(k)
            if len(run) == MISS_LIMIT:
                streak = 0
        best = max(best, streak)
        cur += one

    tk = today.isoformat()
    if tk in active:
        close_run()
        streak += 1
        best = max(best, streak)
        status[tk] = "active"
        run_len = 0
    else:
        status[tk] = "today"
        run_len = len(run)
        close_run(ongoing=True)
    res.update(streak=streak if run_len < MISS_LIMIT else 0, best=best, run=run_len, last_active=max(active))
    return res


def restores_left(data, today):
    ym = today.strftime("%Y-%m")
    used = sum(1 for r in data["restores"] if str(r.get("on", ""))[:7] == ym)
    return max(0, RESTORES_PER_MONTH - used)


def restore_offer(data, w, today):
    """The most recent slip, if it is still recent enough to talk about restoring it."""
    if not w["gaps"]:
        return None
    g = w["gaps"][-1]
    end = _day(g["days"][-1])
    if g["lost"] < 1 or (today - end).days > RESTORE_WINDOW:
        return None
    after = g["lost"] + sum(1 for d in w["active"] if _day(d) > end)
    left = restores_left(data, today)
    why = "too_long" if len(g["days"]) > RESTORE_MAX_GAP else "no_restores" if left < 1 else ""
    return {"days": g["days"], "lost": g["lost"], "after": after, "length": len(g["days"]), "can": not why, "why": why}


def apply_restore(data, today):
    """Spend one restore on the most recent slip. Returns (ok, reason)."""
    offer = restore_offer(data, walk(data, today), today)
    if not offer:
        return False, "There is nothing to restore."
    if not offer["can"]:
        return False, ("That slip is too long for one restore." if offer["why"] == "too_long"
                       else "No restores left this month.")
    data["restores"].append({"on": today.isoformat(), "days": offer["days"], "lost": offer["lost"]})
    return True, ""


# ----------------------------------------------------------------------------- XP and levels
def level_info(xp):
    lvl = math.isqrt(max(0, xp) // 40) + 1
    cur_need, next_need = 40 * (lvl - 1) ** 2, 40 * lvl ** 2
    return {"level": lvl, "title": LEVEL_TITLES[min(lvl - 1, len(LEVEL_TITLES) - 1)],
            "into": xp - cur_need, "span": next_need - cur_need, "next_at": next_need,
            "next_title": LEVEL_TITLES[min(lvl, len(LEVEL_TITLES) - 1)]}


# ----------------------------------------------------------------------------- badges
BADGES = [
    ("first_spark", "🌱", "First Spark", "Run your first piece of code.", lambda c: c["actions"] >= 1),
    ("first_solve", "⭐", "First Solve", "Fully solve a problem.", lambda c: c["solved"] >= 1),
    ("first_try", "🎯", "First Try!", "Get full marks the very first time you press Check.", lambda c: c["first_try"]),
    ("solve_5", "🎀", "Five Down", "Solve 5 problems.", lambda c: c["solved"] >= 5),
    ("solve_10", "🌸", "Ten Down", "Solve 10 problems.", lambda c: c["solved"] >= 10),
    ("solve_25", "💐", "Bouquet of 25", "Solve 25 problems.", lambda c: c["solved"] >= 25),
    ("streak_3", "🔥", "Warming Up", "Reach a 3-day streak.", lambda c: c["best"] >= 3),
    ("streak_7", "🕯️", "One Whole Week", "Reach a 7-day streak.", lambda c: c["best"] >= 7),
    ("streak_14", "🌟", "Fortnight Fire", "Reach a 14-day streak.", lambda c: c["best"] >= 14),
    ("streak_30", "🌙", "Month of Magic", "Reach a 30-day streak.", lambda c: c["best"] >= 30),
    ("streak_100", "👑", "Hundred Days", "Reach a 100-day streak.", lambda c: c["best"] >= 100),
    ("second_chance", "💖", "Second Chance", "Use a streak restore.", lambda c: c["restores_used"] >= 1),
    ("goal_getter", "🏆", "Goal Getter", "Reach your daily goal on 5 different days.", lambda c: c["goal_days"] >= 5),
    ("early_bird", "🐦", "Early Bird", "Code between 5 and 8 in the morning.", lambda c: "early" in c["marks"]),
    ("night_owl", "🦉", "Night Owl", "Code between midnight and 5 in the morning.", lambda c: "night" in c["marks"]),
    ("bigo_1", "🔍", "Big-O Detective", "Measure the time complexity of a solution.", lambda c: c["bigo_runs"] >= 1),
    ("bigo_5", "🧪", "Complexity Sleuth", "Use the Big-O detector 5 times.", lambda c: c["bigo_runs"] >= 5),
    ("lessons_10", "📚", "Bookworm", "Finish 10 lesson activities.", lambda c: c["lessons"] >= 10),
]


def _ctx(data, w, scores, done_count, solved_ids):
    first_try = any(m and e >= m for e, m in (v for v in data["first_checks"].values() if len(v) == 2))
    return {
        "actions": sum(v.get("n", 0) for v in data["activity"].values()),
        "solved": len(solved_ids), "best": w["best"], "first_try": first_try,
        "restores_used": len(data["restores"]), "bigo_runs": data.get("bigo_runs", 0),
        "goal_days": sum(1 for v in data["activity"].values() if v.get("goal")),
        "marks": data["marks"], "lessons": done_count,
    }


def _award(data, ctx, today):
    new = []
    for bid, icon, title, desc, test in BADGES:
        if bid not in data["badges"] and test(ctx):
            data["badges"][bid] = today.isoformat()
            new.append({"id": bid, "icon": icon, "title": title, "desc": desc})
    return new


# ----------------------------------------------------------------------------- the big state object
def _calendar(data, w, today, month, goal):
    try:
        y, m = (int(x) for x in month.split("-"))
        first = dt.date(y, m, 1)
    except (ValueError, AttributeError):
        first = today.replace(day=1)
    nxt = dt.date(first.year + (first.month == 12), first.month % 12 + 1, 1)
    solved_by_day = Counter(data["solved_at"].values())
    days, d = [], first
    while d < nxt:
        k = d.isoformat()
        s = "future" if d > today else w["status"].get(k, "none")
        a = data["activity"].get(k, {})
        days.append({"d": k, "s": s, "n": a.get("n", 0), "goal": bool(a.get("goal")), "solved": solved_by_day.get(k, 0)})
        d += dt.timedelta(days=1)
    return {"month": first.strftime("%Y-%m"), "label": first.strftime("%B %Y"),
            "start": (first.weekday() + 1) % 7, "days": days}


def state(data, today, scores, done_count, problem_points, goal=DEFAULT_GOAL, month=None, with_calendar=True):
    """Everything the Streaks tab shows. May add newly earned badges to `data` (see "new_badges")."""
    w = walk(data, today)
    solved_ids = {iid for iid, pts in problem_points.items() if pts and scores.get(iid, 0) >= pts}
    ctx = _ctx(data, w, scores, done_count, solved_ids)
    new_badges = _award(data, ctx, today)
    total_days = len(w["active"])
    xp = int(sum(v for v in scores.values() if isinstance(v, (int, float)))) + 8 * done_count + 10 * total_days \
        + 5 * w["best"] + 5 * ctx["goal_days"]
    tk = today.isoformat()
    today_n = data["activity"].get(tk, {}).get("n", 0)
    status = "new" if not w["active"] else "done" if today_n else "broken" if w["run"] >= MISS_LIMIT \
        else "risk" if w["run"] == 1 else "safe"
    one = dt.timedelta(days=1)
    week = []
    for i in range(6, -1, -1):
        d = today - i * one
        k = d.isoformat()
        week.append({"d": k, "s": w["status"].get(k, "none"), "n": data["activity"].get(k, {}).get("n", 0)})
    wk_keys = {x["d"] for x in week}
    out = {
        "today": tk, "current": w["streak"], "best": w["best"], "status": status, "run": w["run"],
        "last_active": w["last_active"], "total_days": total_days,
        "today_n": today_n, "goal": goal, "goal_days": ctx["goal_days"],
        "restores_left": restores_left(data, today), "restores_max": RESTORES_PER_MONTH,
        "offer": restore_offer(data, w, today),
        "xp": xp, "solved": len(solved_ids), "lessons": done_count,
        "week": week,
        "week_actions": sum(x["n"] for x in week),
        "week_solved": sum(1 for d in data["solved_at"].values() if d in wk_keys),
        "week_days": sum(1 for x in week if x["s"] == "active"),
        "solved_at": data["solved_at"],
        "badges": [{"id": b[0], "icon": b[1], "title": b[2], "desc": b[3], "earned": b[0] in data["badges"],
                    "on": data["badges"].get(b[0], "")} for b in BADGES],
        "new_badges": new_badges,
        "changed": bool(new_badges),
        "first_day": min(w["active"]) if w["active"] else tk,
        "limits": {"miss": MISS_LIMIT, "max_gap": RESTORE_MAX_GAP, "window": RESTORE_WINDOW},
    }
    out.update({"level": 0})
    li = level_info(xp)
    out.update(level=li["level"], level_title=li["title"], level_into=li["into"], level_span=li["span"],
               level_next_at=li["next_at"], level_next_title=li["next_title"])
    if with_calendar:
        out["calendar"] = _calendar(data, w, today, month or today.strftime("%Y-%m"), goal)
    return out


def profile(name, data, today, scores, done_count, problem_points):
    """The small summary friends see."""
    s = state(data, today, scores, done_count, problem_points, with_calendar=False)
    return {"name": name, "current": s["current"], "best": s["best"], "status": s["status"],
            "last_active": s["last_active"], "restores_left": s["restores_left"], "xp": s["xp"],
            "level": s["level"], "title": s["level_title"], "week": [x["s"] for x in s["week"]],
            "solved": s["solved"], "days": s["total_days"], "updated": dt.datetime.now().isoformat(timespec="minutes")}


# ----------------------------------------------------------------------------- merging two computers
def merge(a, b):
    """Union of two streak files. Idempotent, so syncing the same data twice changes nothing."""
    a, b = normalize(a), normalize(b)
    act = a["activity"]
    for day, v in b["activity"].items():
        if day not in act:
            act[day] = v
            continue
        m = act[day]
        for k in ("n", "runs", "checks", "lessons", "bigo"):
            if k in m or k in v:
                m[k] = max(m.get(k, 0), v.get(k, 0))
        firsts = [x for x in (m.get("first"), v.get("first")) if x]
        lasts = [x for x in (m.get("last"), v.get("last")) if x]
        if firsts:
            m["first"] = min(firsts)
        if lasts:
            m["last"] = max(lasts)
        if m.get("goal") or v.get("goal"):
            m["goal"] = True
    seen = {tuple(sorted(r["days"])): r for r in a["restores"]}
    for r in b["restores"]:
        key = tuple(sorted(r["days"]))
        if key not in seen or str(r.get("on", "")) < str(seen[key].get("on", "")):
            seen[key] = r
    a["restores"] = sorted(seen.values(), key=lambda r: (str(r.get("on", "")), r["days"]))
    for field in ("solved_at", "marks", "badges"):
        for k, v in b[field].items():
            if k not in a[field] or str(v) < str(a[field][k]):
                a[field][k] = v
    for k, v in b["first_checks"].items():
        a["first_checks"].setdefault(k, v)
    a["bigo_runs"] = max(a.get("bigo_runs", 0), b.get("bigo_runs", 0))
    return a
