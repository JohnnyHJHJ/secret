"""
Online sync through a Google Apps Script web app (see drive_sync.gs).

What a sync does, in order:
  1. pulls your saved progress from  <shared folder>/Progress/<your name>/  and merges it with
     what is on this computer (best score wins, finished activities are combined),
  2. pushes the merged progress back to your folder,
  3. publishes lessons / problems you have locally that the shared library does not have yet,
  4. lists library items you do not have, so the app can offer them to you.

Nothing from the library is installed until you press Add on it.
"""
import os
import re
import json
import urllib.error
import urllib.request

import judge_core as JC
import lesson_engine as LE

BASE_DIR = JC.BASE_DIR
LESSONS_DIR = os.path.join(BASE_DIR, "lessons")
MODULES_DIR = JC.MODULES_DIR
SAFE = re.compile(r"[^A-Za-z0-9_.\-]")
SECRET = ""


def call(url, payload, timeout=90):
    if SECRET:
        payload = dict(payload, secret=SECRET)
    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"),
                                 headers={"Content-Type": "text/plain;charset=utf-8"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:      # Apps Script answers via a redirect; urllib follows it
            text = r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"The sync address answered with an error ({e.code}). Check that the script is deployed "
                           "as a web app with access set to Anyone.")
    except (urllib.error.URLError, OSError):
        raise RuntimeError("Could not reach Google Drive. Check your internet connection and the sync address.")
    try:
        out = json.loads(text)
    except ValueError:
        raise RuntimeError("The sync address did not answer correctly. In Apps Script choose Deploy, "
                           "then Web app, with access set to Anyone, and paste the /exec address.")
    if not out.get("ok"):
        raise RuntimeError(out.get("error") or "Sync failed.")
    return out


# --------------------------------------------------------------------- local inventory
def _safe(s):
    return SAFE.sub("_", s) or "x"


def local_lessons(with_content=False):
    courses, _ = LE.discover_courses(LESSONS_DIR)
    items = {}
    for c in courses:
        for l in c["lessons"]:
            it = {"kind": "lesson", "key": l["id"], "title": l["title"], "summary": l["summary"],
                  "group": c["title"], "course_title": c["title"]}
            if with_content:
                with open(l["path"], "r", encoding="utf-8") as f:
                    it["content"] = f.read()
            items[l["id"]] = it
    return items


def local_problems(with_content=False):
    items = {}
    if not os.path.isdir(MODULES_DIR):
        return items
    for name in sorted(os.listdir(MODULES_DIR)):
        mdir = os.path.join(MODULES_DIR, name)
        pj = os.path.join(mdir, "problems.json")
        if name.startswith((".", "_")) or not os.path.isfile(pj):
            continue
        try:
            raw = JC._read_json(pj)
            manifest = {}
            mf = os.path.join(mdir, "manifest.json")
            if os.path.isfile(mf):
                manifest = JC._read_json(mf)
        except Exception:
            continue
        mtitle = manifest.get("title") or name.replace("_", " ").title()
        groups = {g["id"]: g.get("title", g["id"]) for g in raw.get("groups", [])}
        for p in raw.get("problems", []):
            gid = p.get("group")
            key = f"{name}/{p['id']}"
            it = {"kind": "problem", "key": key, "title": p.get("title", p["id"]), "group": mtitle,
                  "summary": f"{p.get('points', '')} pts" if p.get("points") else "", "module_title": mtitle}
            if with_content:
                it["content"] = json.dumps({"problem": p, "group": {"id": gid, "title": groups.get(gid, gid)} if gid else None})
            items[key] = it
    return items


def local_keys():
    return set(local_lessons()) | set(local_problems())


# --------------------------------------------------------------------- install a library item
def _write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    os.replace(tmp, path)


def install_item(env):
    """Write one downloaded library item into lessons/ or modules/. Never overwrites."""
    if env["kind"] == "lesson":
        course, stem = (env["key"].split("/", 1) + ["lesson"])[:2]
        folder = os.path.join(LESSONS_DIR, _safe(course))
        target = os.path.join(folder, _safe(stem) + ".md")
        if os.path.exists(target):
            return False
        _write(target, env["content"])
        cj = os.path.join(folder, "course.json")
        if not os.path.exists(cj) and env.get("course_title"):
            _write(cj, json.dumps({"title": env["course_title"], "order": 1000}, indent=2))
        return True
    mid, _pid = (env["key"].split("/", 1) + ["p"])[:2]
    mdir = os.path.join(MODULES_DIR, _safe(mid))
    pj = os.path.join(mdir, "problems.json")
    data = JC._read_json(pj) if os.path.isfile(pj) else {"groups": [], "problems": []}
    body = json.loads(env["content"])
    prob, grp = body["problem"], body.get("group")
    if any(p["id"] == prob["id"] for p in data.setdefault("problems", [])):
        return False
    if grp and not any(g["id"] == grp["id"] for g in data.setdefault("groups", [])):
        data["groups"].append(grp)
    data["problems"].append(prob)
    _write(pj, json.dumps(data, indent=1))
    mf = os.path.join(mdir, "manifest.json")
    if not os.path.exists(mf):
        _write(mf, json.dumps({"title": env.get("module_title") or mid.replace("_", " ").title(), "order": 1000}, indent=2))
    return True


# --------------------------------------------------------------------- progress merge
def merge_progress(local, remote):
    """local/remote = {scores, done, cards}. Best score wins; done lists are unioned."""
    scores = dict(local.get("scores", {}))
    for k, v in (remote.get("scores") or {}).items():
        if isinstance(v, (int, float)) and v > scores.get(k, -1):
            scores[k] = v
    done = {k: list(v) for k, v in (local.get("done") or {}).items()}
    for k, v in (remote.get("done") or {}).items():
        have = done.setdefault(k, [])
        have.extend(x for x in v if x not in have)
    cards = {k: dict(v) for k, v in (local.get("cards") or {}).items()}
    for lid, rc in (remote.get("cards") or {}).items():
        mine = cards.setdefault(lid, {})
        for aid, st in rc.items():
            mine.setdefault(aid, st)
    out = {"scores": scores, "done": done, "cards": cards}
    if local.get("streaks") is not None or remote.get("streaks") is not None:
        import streaks
        out["streaks"] = streaks.merge(local.get("streaks") or {}, remote.get("streaks") or {})
    # Folder placement is a personal workspace preference. It moves as a whole so
    # a folder and its children cannot be split by a partial cross-device merge.
    mine, theirs = local.get("organize") or {}, remote.get("organize") or {}
    out["organize"] = theirs if theirs.get("updated", 0) > mine.get("updated", 0) else mine
    # "Where you were" (last and recent lessons/problems) travels as one small block.
    # The newest activity wins as a whole, so a device with a stale list cannot drop entries.
    mine, theirs = local.get("activity") or {}, remote.get("activity") or {}
    if mine or theirs:
        out["activity"] = theirs if int(theirs.get("updated") or 0) > int(mine.get("updated") or 0) else mine
    return out


# --------------------------------------------------------------------- the sync itself
def clean_item(it):
    """A library entry coming back from Drive can be malformed (hand-edited file,
    older app version, interrupted upload). Normalise it or drop it, so one bad file
    cannot break the whole sync."""
    if not isinstance(it, dict):
        return None
    key, kind = it.get("key"), it.get("kind")
    if not isinstance(key, str) or not key or kind not in ("lesson", "problem"):
        return None
    out = dict(it)
    out["key"], out["kind"] = key, kind
    out["title"] = it.get("title") if isinstance(it.get("title"), str) and it.get("title") else key
    for f in ("summary", "group", "author", "updated", "course_title", "module_title"):
        if not isinstance(out.get(f), str):
            out[f] = ""
    return out


def library_view(remote_items, cfg):
    have = local_keys()
    seen, declined = set(cfg.get("seen", [])), set(cfg.get("declined", []))
    out = []
    for raw in remote_items or []:
        it = clean_item(raw)
        if not it:
            continue
        k = it["key"]
        status = "installed" if k in have else "skipped" if k in declined else "new" if k not in seen else "available"
        out.append(dict(it, status=status))
    out.sort(key=lambda x: ({"new": 0, "available": 1, "skipped": 2, "installed": 3}[x["status"]], x["kind"], x["title"].lower()))
    return out


def sync_now(cfg, local_bundle):
    """Returns (merged_bundle, report). Raises RuntimeError with a readable message on failure."""
    url, name = cfg.get("sync_url", "").strip(), cfg.get("name", "").strip()
    if not url:
        raise RuntimeError("Add the sync address in Settings first.")
    if not name:
        raise RuntimeError("Enter your name first.")
    remote = call(url, {"action": "pull_progress", "user": name}).get("data") or {}
    merged = merge_progress(local_bundle, remote)
    call(url, {"action": "push_progress", "user": name, "data": merged})     # progress, lesson answers, streaks and folder layout travel together

    # The shared library is a separate step. If it fails, the progress above is already saved, so report it instead of failing the whole sync.
    listed, published, lib_error = [], [], ""
    try:
        raw = call(url, {"action": "list_library"}).get("items") or []
        listed = [it for it in (clean_item(x) for x in raw) if it]
        remote_keys = {i["key"] for i in listed}
        for items in (local_lessons(True), local_problems(True)):
            for key, it in items.items():
                if key not in remote_keys:
                    call(url, {"action": "publish_item", "author": name, "item": it})
                    published.append(it["title"])
                    listed.append({k: v for k, v in it.items() if k != "content"} | {"author": name})
    except RuntimeError as e:
        lib_error = str(e)
    return merged, {"published": published, "items": listed, "lib_error": lib_error}


def fetch_item(cfg, key, kind):
    return call(cfg["sync_url"], {"action": "get_item", "key": key, "kind": kind})["item"]
