"""
Local server for Local Judge. Standard library only.

It listens on 127.0.0.1 only, and every request must carry the random token that was
put into the page when it was served, so other websites in your browser cannot run code
through it.
"""
import os
import re
import sys
import json
import time
import pickle
import shutil
import tempfile
import threading
import subprocess
import mimetypes
import urllib.parse
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

import judge_core as JC
import lesson_engine as LE
import safeexec as SD
import sync as SYNC
import bigo as BIGO
import tracking as TRK

BASE_DIR = JC.BASE_DIR
WEB_DIR = os.path.join(BASE_DIR, "web")
LESSONS_DIR = os.path.join(BASE_DIR, "lessons")
CONFIG_FILE = os.path.join(BASE_DIR, "config.json")
STATE_FILE = os.path.join(BASE_DIR, "lessons_state.json")
ORG_FILE = os.path.join(BASE_DIR, "organize.json")
STREAK_FILE = os.path.join(BASE_DIR, "streaks.json")
PROMPT_DIR = os.path.join(BASE_DIR, "prompts")
CFG_KEYS = {"theme", "font_size", "name", "sync_url", "active_tab", "last_problem", "last_lesson",
            "seen", "declined", "secret", "last_sync", "sidebar", "editor_font", "nav_hidden", "side_hidden", "side_w", "closed", "page_w", "daily_goal", "recent_lessons", "recent_problems", "activity_updated", "last_open"}
LOCK = threading.RLock()
DIRTY = {"on": False}
TRACK = TRK.Tracker(STREAK_FILE, LOCK)


# ------------------------------------------------------------------ small json files
def _backup_bad(path):
    """Keep a copy of a file that no longer parses, instead of silently overwriting it."""
    try:
        bad = path + ".bad"
        if os.path.isfile(path) and not os.path.exists(bad):
            shutil.copy2(path, bad)
    except Exception:
        pass


def _load(path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return default
    except Exception:
        _backup_bad(path)
        return default


def _save(path, data):
    tmp = path + ".tmp"
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=1, sort_keys=True)
        os.replace(tmp, path)
    except Exception:
        pass


# Fields whose type matters when some other tool (or a hand edit) produced the file.
_CFG_STR = ("theme", "name", "sync_url", "secret", "active_tab", "last_problem", "last_lesson",
            "last_open", "last_sync")
_CFG_INT = ("page_w", "daily_goal", "activity_updated")
_CFG_NUM = ("font_size", "editor_font", "side_w")
_CFG_LIST = ("closed", "seen", "declined", "recent_lessons", "recent_problems")
_CFG_BOOL = ("nav_hidden", "side_hidden")


def _clean_cfg(raw):
    """config.json is user-editable. Bad shapes must not brick the whole app."""
    c = dict(raw) if isinstance(raw, dict) else {}
    for k in list(c):
        v = c[k]
        try:
            if k in _CFG_STR:
                c[k] = "" if v is None else (v if isinstance(v, str) else str(v))
            elif k in _CFG_INT:
                c[k] = int(v)
            elif k in _CFG_NUM:
                c[k] = float(v)
            elif k in _CFG_LIST:
                c[k] = [x for x in v if isinstance(x, str)] if isinstance(v, list) else []
            elif k in _CFG_BOOL:
                c[k] = bool(v)
        except (TypeError, ValueError):
            c.pop(k, None)
    return c


def load_lesson_state():
    raw = _load(STATE_FILE, {})
    if not isinstance(raw, dict):
        _backup_bad(STATE_FILE)
        raw = {}
    s = raw
    done = s.get("done") if isinstance(s.get("done"), dict) else {}
    cards = s.get("cards") if isinstance(s.get("cards"), dict) else {}
    s["done"] = {k: v for k, v in done.items() if isinstance(k, str) and isinstance(v, list)}
    s["cards"] = {k: {a: c for a, c in v.items() if isinstance(c, dict)}
                  for k, v in cards.items() if isinstance(k, str) and isinstance(v, dict)}
    return s


def load_org():
    o = _load(ORG_FILE, {})
    if not isinstance(o, dict):
        _backup_bad(ORG_FILE)
        return {}
    return o


# ------------------------------------------------------------------ the app's data model
class Model:
    def __init__(self):
        raw = _load(CONFIG_FILE, {})
        if not isinstance(raw, dict):
            _backup_bad(CONFIG_FILE)
        self.cfg = _clean_cfg(raw)
        self.modules, self.courses = [], []
        self.problems, self.acts, self.errors = {}, {}, []
        self.reload()

    def reload(self):
        mods, errs = JC.discover_modules()
        courses, lerrs = LE.discover_courses(LESSONS_DIR)
        self.errors = [f"{n}: {e}" for n, e in errs + lerrs]
        self.modules, self.courses = mods, courses
        self.problems, self.acts = {}, {}
        for m in mods:
            for p in m["problems"]:
                p["_iid"] = f"prb:{m['id']}/{p['id']}"
                self.problems[p["_iid"]] = p
        for c in courses:
            for l in c["lessons"]:
                for a in l["activities"]:
                    self.acts[(l["id"], a["id"])] = a

    def set_cfg(self, patch):
        with LOCK:
            for k, v in patch.items():
                if k in CFG_KEYS:
                    self.cfg[k] = v
            _save(CONFIG_FILE, self.cfg)


M = Model()


def streak_ctx():
    s = load_lesson_state()
    return {"scores": JC.load_progress(), "done_count": sum(len(v) for v in s["done"].values()),
            "points": {iid: p.get("points", 0) for iid, p in M.problems.items()}}


def track(kind, iid=None, earned=None, maximum=None):
    try:
        return TRACK.record(kind, M.cfg, streak_ctx(), iid=iid, earned=earned, maximum=maximum)
    except Exception:
        return None          # streaks must never break running code


def public_problem(p):
    sc = p.get("scoring") or {}
    return {"iid": p["_iid"], "id": p["id"], "title": p.get("title", p["id"]), "group": p["group"],
            "func": p["func"], "params": p.get("params", ""), "statement": p.get("statement", ""),
            "points": p.get("points", 0), "n_tests": len(p["tests"]),
            "tiers": [{"label": t.get("label", t["tag"]), "points": t["points"]} for t in sc.get("tiers", [])]}


_SECRET_KEYS = ("tests", "solution", "expect_output", "expect_files", "stdin", "files")


def public_block(b):
    b = dict(b)
    if b.get("t") == "exercise":
        b["has_solution"] = bool((b.get("solution") or "").strip())      # the text itself is only sent when the learner asks (lesson/solution)
        b["files"] = sorted((b.get("files") or {}).keys())
        for k in _SECRET_KEYS[:-1]:
            b.pop(k, None)
        b["has_tests"] = not b["run_only"]
    if b.get("t") == "predict":
        b["files"] = sorted((b.get("files") or {}).keys())
        b.pop("stdin", None)
        shown, prompt = False, []           # the code is drawn by the activity itself, so do not repeat it in the text
        for x in b.get("prompt", []):
            if not shown and x.get("t") == "code" and x.get("text") == b.get("code"):
                shown = True
                continue
            prompt.append(x)
        b["prompt"] = prompt
    for k in ("blocks",):
        if k in b:
            b[k] = [public_block(x) for x in b[k]]
    for k in ("hints", "prompt"):
        if k in b:
            b[k] = [public_block(x) for x in b[k]]
    if b.get("explain"):
        b["explain"] = public_block(b["explain"])
    return b


def bootstrap():
    return {
        "cfg": M.cfg,
        "modules": [{"id": m["id"], "title": m["title"],
                     "groups": [{"id": g["id"], "title": g["title"]} for g in m["groups"]],
                     "problems": [public_problem(p) for p in m["problems"]]} for m in M.modules],
        "courses": [{"id": c["id"], "title": c["title"], "description": c["description"],
                     "lessons": [{"id": l["id"], "title": l["title"], "summary": l["summary"], "minutes": l["minutes"],
                                  "acts": [a["id"] for a in l["activities"]],
                                  "blocks": [public_block(b) for b in l["blocks"]]} for l in c["lessons"]]}
                    for c in M.courses],
        "progress": JC.load_progress(),
        "state": load_lesson_state(),
        "org": load_org(),
        "errors": M.errors,
        "streak": TRACK.state(M.cfg, streak_ctx(), with_calendar=False),
    }


# ------------------------------------------------------------------ running code
def _env():
    return dict(os.environ, PYTHONUTF8="1", PYTHONIOENCODING="utf-8")


def run_plain(code, stdin="", timeout=10.0, rid=""):
    """Just run the program (no checking) and capture what it prints.

    safeexec keeps at most about 200 KB of output in memory and kills the whole
    process tree at the deadline, so `while True: print(...)` cannot take the server
    down with it.
    """
    tmp = tempfile.mkdtemp(prefix="cs11_run_")
    try:
        path = os.path.join(tmp, "main.py")
        with open(path, "w", encoding="utf-8") as f:
            f.write(code)
        r = SD.run([sys.executable, "-u", path], cwd=tmp, input_text=stdin or "",
                   timeout=timeout, env=_env(), key=rid)
        err = r.stderr.replace(path, "main.py")
        return {"stdout": r.stdout, "stderr": err, "code": r.returncode, "timeout": r.timed_out,
                "stopped": r.stopped, "truncated": r.truncated, "secs": round(r.secs, 2)}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def user_code_path(p):
    os.makedirs(JC.USER_CODE_DIR, exist_ok=True)
    return os.path.join(JC.USER_CODE_DIR, f"{p['module']}__{p['id']}.py".replace("/", "_").replace("\\", "_"))


def save_user_code(p, code):
    """Write the learner's file atomically: the debounced save and a Check cannot
    leave a half-written file behind if they overlap."""
    path = user_code_path(p)
    tmp = path + ".tmp"
    try:
        with LOCK:
            with open(tmp, "w", encoding="utf-8") as f:
                f.write(code)
            os.replace(tmp, path)
        return True
    except OSError:
        return False


def judge_check(p, code, rid=""):
    tmp = tempfile.mkdtemp(prefix="cs11_judge_")
    try:
        testfile, runner = os.path.join(tmp, "tests.pkl"), os.path.join(tmp, "runner.py")
        with open(testfile, "wb") as f:
            pickle.dump({"func": p["func"], "checker": p.get("checker", "exact"), "tests": p["tests"]}, f)
        with open(runner, "w", encoding="utf-8") as f:
            f.write(code + "\n\n" + JC.HARNESS)
        # A learner's bug should never make the window wait for minutes. The old
        # formula could reach 300 s, which felt like "the app is broken" and let a
        # printing loop write gigabytes. Cap the whole check at 30 s.
        try:
            per = float(p.get("timeout") or 5.0)
        except (TypeError, ValueError):
            per = 5.0
        n_tests = max(1, len(p["tests"]))
        timeout = min(30.0, max(8.0, per * 2.0 + 0.25 * n_tests))
        r = SD.run([sys.executable, runner, testfile], cwd=tmp, timeout=timeout, env=_env(),
                   max_output=256 * 1024, tail_bytes=256 * 1024, key=rid)
        if r.stopped:
            return {"status": "STOPPED", "message": "You stopped this check."}
        if r.timed_out:
            return {"status": "TIMEOUT", "message":
                    f"Time limit exceeded ({timeout:g} s). Is there an infinite loop, "
                    "or is the solution waiting for input()?"}
        if r.returncode != 0:
            return {"status": "CRASH", "message":
                    (r.stderr or f"Process exited with code {r.returncode}").replace(runner, "your code")}
        text = r.stdout
        # The marker is the last thing the harness prints, so look for the last one:
        # output is capped (head + tail) and the printed output may be huge.
        i = text.rfind("###RESULT###")
        data = None
        if i >= 0:
            tail_line = text[i + len("###RESULT###"):].split("\n", 1)[0]
            try:
                data = json.loads(tail_line)
            except Exception:
                data = None
        if data is None:
            return {"status": "CRASH", "message": "No result marker.\n\nstdout:\n" + text + "\nstderr:\n" + r.stderr}
        data["stdout"] = "\n".join(l for l in text.splitlines() if not l.startswith("###RESULT###"))
        data["stderr"] = r.stderr
        data["truncated"] = r.truncated
        return data
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# ------------------------------------------------------------------ sync glue
def bundle():
    s = load_lesson_state()
    act = {k: M.cfg[k] for k in ("last_lesson", "last_problem", "last_open", "recent_lessons", "recent_problems")
           if M.cfg.get(k) is not None}
    act["updated"] = int(M.cfg.get("activity_updated") or 0)
    return {"scores": JC.load_progress(), "done": s["done"], "cards": s["cards"],
            "streaks": __import__("streaks").load(STREAK_FILE),
            "organize": load_org(),
            "activity": act}


def apply_bundle(b):
    JC.save_progress(b["scores"])
    s = load_lesson_state()
    s["done"], s["cards"] = b["done"], b["cards"]
    _save(STATE_FILE, s)
    if b.get("streaks") is not None:
        __import__("streaks").save(STREAK_FILE, b["streaks"])
    if isinstance(b.get("organize"), dict):
        _save(ORG_FILE, b["organize"])
    act = b.get("activity") or {}
    if act:
        patch = {k: act[k] for k in ("last_lesson", "last_problem", "last_open", "recent_lessons", "recent_problems")
                 if k in act}
        if act.get("updated") is not None:
            patch["activity_updated"] = act.get("updated")
        M.set_cfg(patch)


def do_sync():
    SYNC.SECRET = M.cfg.get("secret", "")
    with LOCK:
        snapshot = bundle()
    merged, rep = SYNC.sync_now(M.cfg, snapshot)          # network, so the lock is not held
    with LOCK:
        # merge again with whatever changed on this computer while we were talking to Drive, so nothing typed or run meanwhile is lost
        apply_bundle(SYNC.merge_progress(bundle(), merged))
    M.set_cfg({"last_sync": time.strftime("%Y-%m-%d %H:%M")})
    DIRTY["on"] = False          # only a successful sync makes the data clean; a failed one retries on close
    items = SYNC.library_view(rep["items"], M.cfg)
    new = [i for i in items if i["status"] == "new"]
    return {"published": rep["published"], "library": items, "new": len(new), "lib_error": rep.get("lib_error", ""),
            "progress": JC.load_progress(), "state": load_lesson_state(), "last_sync": M.cfg["last_sync"],
            "org": load_org(), "cfg": M.cfg,
            "streak": TRACK.state(M.cfg, streak_ctx(), with_calendar=False)}


def library_only():
    SYNC.SECRET = M.cfg.get("secret", "")
    url = M.cfg.get("sync_url", "").strip()
    if not url:
        raise RuntimeError("Add the sync address in Settings first.")
    items = SYNC.call(url, {"action": "list_library"})["items"]
    return SYNC.library_view(items, M.cfg)


def add_items(keys):
    SYNC.SECRET = M.cfg.get("secret", "")
    listed = {i["key"]: i for i in library_only()}
    added, skipped = [], []
    for k in keys:
        it = listed.get(k)
        if not it:
            skipped.append(k)
            continue
        env = SYNC.fetch_item(M.cfg, k, it["kind"])
        (added if SYNC.install_item(env) else skipped).append(it["title"])
    M.reload()
    declined = [d for d in M.cfg.get("declined", []) if d not in keys]
    M.set_cfg({"declined": declined})
    return added, skipped


# ------------------------------------------------------------------ HTTP
class Handler(BaseHTTPRequestHandler):
    server_version = "LocalJudge"
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    # --- helpers
    def _send(self, code, body, ctype="application/json; charset=utf-8", extra=None):
        if isinstance(body, (dict, list)):
            body = json.dumps(body).encode("utf-8")
        elif isinstance(body, str):
            body = body.encode("utf-8")
        try:
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            for k, v in (extra or {}).items():
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass          # the window went away mid-request

    def _host_ok(self):
        host = (self.headers.get("Host") or "").lower()
        return host in (f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}")

    def _token_ok(self, query):
        tok = self.headers.get("X-Token") or (query.get("t") or [""])[0]
        return tok == self.server.token

    # --- routing
    def do_GET(self):
        self._route("GET")

    def do_POST(self):
        self._route("POST")

    def _route(self, method):
        u = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(u.query)
        if not self._host_ok():
            return self._send(403, {"error": "bad host"})
        self.server.last_ping = time.time()
        # A page identifies itself so a "goodbye" from a page that is being reloaded
        # cannot shut down the server for the page that replaced it.
        page = (self.headers.get("X-Page") or (query.get("p") or [""])[0] or "").strip()
        keep = (query.get("keep") or [""])[0] == "1"
        if u.path == "/api/bye":
            page = (query.get("p") or [""])[0].strip()
        elif page:
            self.server.page_id = page
            if not keep:
                self.server.bye_at = None       # a live page has claimed the server
        elif not keep:
            self.server.bye_at = None
        if u.path.startswith("/api/"):
            if not self._token_ok(query):
                return self._send(403, {"error": "bad token"})
            body = {}
            if method == "POST":
                n = int(self.headers.get("Content-Length") or 0)
                try:
                    body = json.loads(self.rfile.read(n).decode("utf-8") or "{}") if n else {}
                except ValueError:
                    return self._send(400, {"error": "bad json"})
                if not isinstance(body, dict):
                    return self._send(400, {"error": "bad json"})
            try:
                return self._send(200, self.api(u.path[5:], query, body, page))
            except RuntimeError as e:
                return self._send(200, {"_error": str(e)})
            except Exception as e:
                import traceback
                traceback.print_exc()
                return self._send(500, {"_error": f"{type(e).__name__}: {e}"})
        return self._static(u.path)

    def _static(self, path):
        if path in ("", "/"):
            path = "/index.html"
        web = os.path.abspath(WEB_DIR)
        fp = os.path.normpath(os.path.join(web, path.lstrip("/")))
        try:
            inside = os.path.commonpath([os.path.abspath(fp), web]) == web
        except ValueError:                      # different drives on Windows
            inside = False
        if not inside or not os.path.isfile(fp):
            fp2 = os.path.join(BASE_DIR, os.path.basename(path)) if path in ("/icon.png", "/icon.ico") else None
            if not fp2 or not os.path.isfile(fp2):
                return self._send(404, "not found", "text/plain")
            fp = fp2
        with open(fp, "rb") as f:
            data = f.read()
        ctype = mimetypes.guess_type(fp)[0] or "application/octet-stream"
        if fp.endswith("index.html"):
            data = data.replace(b"__TOKEN__", self.server.token.encode())
        if ctype.startswith("text/") or ctype in ("application/javascript",):
            ctype += "; charset=utf-8"
        self._send(200, data, ctype)

    # --- API
    def api(self, name, q, b, page=""):
        if name not in ("ping", "bye", "bootstrap", "reload", "sync/now"):
            DIRTY["on"] = True                      # something may have changed, so the app syncs once more when it closes
        if name == "ping":
            return {"ok": True}
        if name == "bye":
            # Honour it only when it comes from the page that is currently using the
            # server, so the goodbye of a page being reloaded cannot stop the new one.
            if not page or not self.server.page_id or page == self.server.page_id:
                self.server.bye_at = time.time()
            return {"ok": True}
        if name == "bootstrap":
            return bootstrap()
        if name == "reload":
            M.reload()
            return bootstrap()
        if name == "config":
            if isinstance(b, dict):
                M.set_cfg(_clean_cfg(b))
            return {"ok": True}
        if name == "organize":
            with LOCK:
                org = b["org"] if isinstance(b.get("org"), dict) else {}
                org["updated"] = time.time()
                _save(ORG_FILE, org)
            return {"ok": True, "org": org}
        if name == "prompts":
            out = {}
            for key, fn in (("lesson", "lesson_prompt.md"), ("problem", "problem_prompt.md"), ("theme", "theme_prompt.md")):
                try:
                    with open(os.path.join(PROMPT_DIR, fn), "r", encoding="utf-8") as f:
                        out[key] = f.read()
                except OSError:
                    out[key] = f"(missing prompts/{fn})"
            return out
        if name == "lessons_state":
            with LOCK:
                if isinstance(b.get("state"), dict):
                    _save(STATE_FILE, b["state"])
            return {"ok": True}

        # ---- judge
        if name == "judge/stop":
            rid = str(b.get("rid") or "")
            return {"ok": True, "killed": SD.kill_key(rid) if rid else SD.kill_all()}
        if name == "judge/code":
            p = M.problems.get((q.get("iid") or [""])[0])
            if not p:
                return {"code": ""}
            fp = user_code_path(p)
            if os.path.isfile(fp):
                try:
                    with open(fp, "r", encoding="utf-8") as f:
                        return {"code": f.read(), "saved": True}
                except OSError:
                    pass
            return {"code": f"def {p['func']}({p.get('params', '')}):\n    pass\n", "saved": False}
        if name == "judge/save":
            p = M.problems.get(b.get("iid"))
            if p:
                save_user_code(p, b.get("code", ""))
            return {"ok": True}
        if name == "judge/run":
            r = run_plain(b.get("code", ""), b.get("stdin", ""), 10.0, str(b.get("rid") or ""))
            if not r.get("stopped"):
                r["streak"] = track("run")
            return r
        if name == "judge/check":
            p = M.problems.get(b.get("iid"))
            if not p:
                raise RuntimeError("Unknown problem. Try reloading.")
            save_user_code(p, b.get("code", ""))
            data = judge_check(p, b.get("code", ""), str(b.get("rid") or ""))
            if data.get("status") == "DONE":
                earned, mx, rows = JC.compute_score(p, data["results"])
                with LOCK:
                    prog = JC.load_progress()
                    best = max(earned, prog.get(p["_iid"], 0))
                    prog[p["_iid"]] = best
                    JC.save_progress(prog)
                data.update({"earned": earned, "max": mx, "rows": rows, "best": best, "progress": prog})
                data["streak"] = track("check", p["_iid"], earned, mx)
            elif data.get("status") != "STOPPED":
                data["streak"] = track("check")
            return data
        if name == "bigo/run":
            p = M.problems.get(b.get("iid"))
            if not p:
                raise RuntimeError("Unknown problem. Try reloading.")
            rep = BIGO.measure(b.get("code", ""), p["func"], p["tests"], rid=str(b.get("rid") or ""))
            rep["streak"] = track("bigo") if rep.get("ok") else None
            return rep

        # ---- streaks
        if name == "streaks/state":
            return TRACK.state(M.cfg, streak_ctx(), month=b.get("month"))
        if name == "streaks/restore":
            ok, why = TRACK.restore()
            out = TRACK.state(M.cfg, streak_ctx(), month=b.get("month"))
            out.update({"restored": ok, "why": why})
            return out
        if name == "streaks/goal":
            M.set_cfg({"daily_goal": max(1, min(50, int(b.get("goal") or 5)))})
            return TRACK.state(M.cfg, streak_ctx(), month=b.get("month"))

        # ---- lessons
        if name == "lesson/run":
            a = M.acts.get((b.get("lid"), b.get("aid")))
            if not a or a.get("t") != "exercise":
                raise RuntimeError("Unknown activity. Try reloading lessons.")
            kw = dict(stdin=a["stdin"], files=a["files"], timeout=a["timeout"])
            if b.get("mode") == "check" and not a["run_only"]:
                kw.update(tests=a["tests"], expect_output=a["expect_output"], expect_files=a["expect_files"])
            r = LE.run_code(b.get("code", ""), **kw)
            if isinstance(r, dict) and r.get("status") != "stopped":
                r["streak"] = track("lesson")
            return r
        if name == "lesson/predict":
            a = M.acts.get((b.get("lid"), b.get("aid")))
            if not a or a.get("t") != "predict":
                raise RuntimeError("Unknown activity. Try reloading lessons.")
            r = LE.run_code(a.get("code") or "", stdin=a.get("stdin"), files=a.get("files"))
            return {"stdout": r.get("stdout", ""), "error": r.get("error")}
        if name == "lesson/solution":
            a = M.acts.get((b.get("lid"), b.get("aid")))
            if not a or a.get("t") != "exercise" or not (a.get("solution") or "").strip():
                raise RuntimeError("This activity has no solution to show.")
            return {"solution": a["solution"].rstrip("\n")}

        # ---- sync + library
        if name == "sync/setup":
            patch = {}
            for k in ("name", "sync_url", "secret"):
                if k in b:
                    patch[k] = str(b[k]).strip()
            M.set_cfg(patch)
            return {"ok": True}
        if name == "sync/now":
            return do_sync()
        if name == "library":
            return {"library": library_only()}
        if name == "library/seen":
            keys = set(M.cfg.get("seen", [])) | set(b.get("keys", []))
            M.set_cfg({"seen": sorted(keys)})
            return {"ok": True}
        if name == "library/skip":
            keys = set(M.cfg.get("declined", [])) | set(b.get("keys", []))
            M.set_cfg({"declined": sorted(keys)})
            return {"ok": True}
        if name == "library/add":
            added, skipped = add_items(b.get("keys", []))
            out = bootstrap()
            out.update({"added": added, "skipped": skipped, "library": library_only()})
            return out
        raise RuntimeError(f"unknown api: {name}")


class Server(ThreadingHTTPServer):
    daemon_threads = True

    def handle_error(self, request, client_address):
        # A window that closes mid-request is normal, not an error worth a traceback.
        exc = sys.exc_info()[1]
        if isinstance(exc, (ConnectionResetError, ConnectionAbortedError, BrokenPipeError)):
            return
        super().handle_error(request, client_address)

    def __init__(self, port, token):
        super().__init__(("127.0.0.1", port), Handler)
        self.token = token
        self.last_ping = time.time()
        self.bye_at = None
        self.page_id = ""
        self.started = time.time()
