"""
Judge core: problem-module loading, the grading harness and scoring.
This is the original judge logic from judge_tab.py with the GUI removed;
nothing about how problems are loaded or graded has changed.
"""
import os
import sys
import json
import zlib
import base64
import pickle
import shutil

# =========================================================================
#  Paths
# =========================================================================
BASE_DIR      = os.path.dirname(os.path.abspath(__file__))
MODULES_DIR   = os.path.join(BASE_DIR, "modules")
LEGACY_FILE   = os.path.join(BASE_DIR, "problems.json")
PROGRESS_FILE = os.path.join(BASE_DIR, "progress.json")
USER_CODE_DIR = os.path.join(BASE_DIR, "user_code")

# =========================================================================
#  Subprocess harness (unchanged)
# =========================================================================
HARNESS = r'''
import json, sys, traceback, pickle

def _norm(x):
    if isinstance(x, (frozenset, set)):
        return ("FS", tuple(sorted((_norm(i) for i in x), key=repr)))
    if isinstance(x, tuple):
        return ("T", tuple(_norm(i) for i in x))
    if isinstance(x, list):
        return ("L", tuple(_norm(i) for i in x))
    return x

def _short(x, n=300):
    s = repr(x)
    return s if len(s) <= n else s[:n] + "... (%d chars)" % len(s)

def _detail(a, e):
    if isinstance(a, (set, frozenset)) and isinstance(e, (set, frozenset)):
        miss = [x for x in e if x not in a]
        extra = [x for x in a if x not in e]
        return ("sizes: expected %d, got %d; missing %d, unexpected %d\n"
                "      e.g. missing:    %s\n      e.g. unexpected: %s"
                % (len(e), len(a), len(miss), len(extra),
                   _short(miss[:2], 200), _short(extra[:2], 200)))
    return None

def _check_exact(a, e):
    ok = _norm(a) == _norm(e)
    return ok, (None if ok else _detail(a, e))

def _check_multiset_differences(a, e):
    if not isinstance(a, tuple) or len(a) != 3:
        return False, "must return a tuple of 3 tuples"
    for x, y in zip(a, e):
        if not isinstance(x, tuple):
            return False, "each part must be a tuple"
        if sorted(x, key=repr) != sorted(y, key=repr):
            return False, None
    return True, None

def _parse_tree(s):
    s = s.replace(" ", ""); pos = 0
    def prim():
        nonlocal pos
        if pos >= len(s): raise ValueError
        if s[pos] == "(":
            pos += 1; t = ex()
            if pos >= len(s) or s[pos] != ")": raise ValueError
            pos += 1; return t
        if s[pos].isalpha(): pos += 1; return s[pos - 1]
        raise ValueError
    def ex():
        nonlocal pos
        l = prim()
        if pos < len(s) and s[pos] in "+*":
            op = s[pos]; pos += 1; r = prim()
            if pos < len(s) and s[pos] in "+*": raise ValueError
            return (op, l, r)
        return l
    t = ex()
    if pos != len(s): raise ValueError
    return t

def _tree_str(t):
    return t if isinstance(t, str) else "(%s%s%s)" % (_tree_str(t[1]), t[0], _tree_str(t[2]))

def _check_expr_trees(a, e):
    if not isinstance(a, (set, frozenset)) or not all(isinstance(x, str) for x in a):
        return False, "must return a frozenset of strs"
    if a == e:
        return True, None
    try:
        ta = [_parse_tree(x) for x in a]
    except ValueError:
        return False, "some string is not a valid fully-parenthesized expression"
    if len(set(ta)) != len(ta):
        return False, "the same expression appears written in different ways"
    te = set(_parse_tree(x) for x in e)
    if set(ta) == te:
        return True, None
    return False, _detail(frozenset(map(_tree_str, ta)), frozenset(map(_tree_str, te)))

_CHECKERS = {
    "exact": _check_exact,
    "multiset_differences": _check_multiset_differences,
    "expr_trees": _check_expr_trees,
}

with open(sys.argv[1], "rb") as _f:
    _data = pickle.load(_f)

_func = globals().get(_data["func"])
if _func is None or not callable(_func):
    _out = {"status": "MISSING",
            "message": "Function %r is not defined." % _data["func"]}
else:
    _checker = _CHECKERS.get(_data["checker"], _check_exact)
    _results = []
    for _t in _data["tests"]:
        try:
            _actual = _func(*_t["args"])
            _ok, _why = _checker(_actual, _t["expected"])
            _results.append({
                "name": _t["name"],
                "status": "AC" if _ok else "WA",
                "actual": _short(_actual),
                "expected": _short(_t["expected"]),
                "detail": _why,
            })
        except Exception:
            _results.append({
                "name": _t["name"],
                "status": "RE",
                "error": traceback.format_exc(),
            })
    _out = {"status": "DONE", "results": _results}

print("###RESULT###" + json.dumps(_out))
'''

# =========================================================================
#  JSON -> Python decoding & Module Loading (unchanged)
# =========================================================================
def _decode(x):
    if isinstance(x, dict):
        if len(x) == 1:
            if "$gz" in x:
                return _decode(json.loads(zlib.decompress(base64.b64decode(x["$gz"]))))
            if "$fs" in x:
                return frozenset(_decode(i) for i in x["$fs"])
            if "$list" in x:
                return [_decode(i) for i in x["$list"]]
        return {k: _decode(v) for k, v in x.items()}
    if isinstance(x, list):
        return tuple(_decode(i) for i in x)
    return x

def _read_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def _build_problem(module_id, data):
    q = dict(data)
    q["module"] = module_id
    q["tests"] = [
        {"name": t.get("name", "test"), "args": _decode(t["args"]), "expected": _decode(t["expected"]), "tags": list(t.get("tags", []))}
        for t in data["tests"]
    ]
    sc = q.get("scoring") or {}
    if sc.get("tiers"):
        tp = [t["points"] for t in sc["tiers"]]
        q["points"] = max(tp) if sc.get("mode") == "best" else sum(tp)
    return q

def _build_module(module_id, path, raw, manifest):
    title = (manifest.get("title") or module_id.replace("_", " ").title()).strip()
    order = manifest.get("order", 1000)

    groups_by_id = {}
    groups_ordered = []
    for g in raw.get("groups", []):
        gid = g["id"]
        if gid in groups_by_id: continue
        groups_by_id[gid] = {"id": gid, "title": g.get("title", gid), "module": module_id}
        groups_ordered.append(gid)

    problems = []
    needs_other = False
    for pdata in raw.get("problems", []):
        p = _build_problem(module_id, pdata)
        gid = p.get("group")
        if gid is None:
            gid = groups_ordered[0] if groups_ordered else "_default"
            p["group"] = gid
        elif gid not in groups_by_id:
            p["group"] = "other"
            needs_other = True
        problems.append(p)

    if needs_other and "other" not in groups_by_id:
        groups_by_id["other"] = {"id": "other", "title": "Other", "module": module_id}
        groups_ordered.append("other")

    if not groups_ordered:
        groups_by_id["_default"] = {"id": "_default", "title": title, "module": module_id}
        groups_ordered.append("_default")
        for p in problems:
            p["group"] = "_default"

    groups = [groups_by_id[g] for g in groups_ordered]
    for g in groups:
        g["problems"] = [p for p in problems if p["group"] == g["id"]]

    return {"id": module_id, "title": title, "order": order, "path": path, "groups": groups, "problems": problems}

def discover_modules():
    modules = []
    errors = []

    if os.path.isdir(MODULES_DIR):
        for name in sorted(os.listdir(MODULES_DIR)):
            mdir = os.path.join(MODULES_DIR, name)
            if not os.path.isdir(mdir) or name.startswith(".") or name.startswith("_"): continue
            pjson = os.path.join(mdir, "problems.json")
            if not os.path.isfile(pjson): continue
            try:
                raw = _read_json(pjson)
                manifest = {}
                mf = os.path.join(mdir, "manifest.json")
                if os.path.isfile(mf):
                    try: manifest = _read_json(mf)
                    except Exception as e: errors.append((name, f"manifest.json: {e}"))
                modules.append(_build_module(name, mdir, raw, manifest))
            except Exception:
                import traceback
                errors.append((name, traceback.format_exc()))

    if os.path.isfile(LEGACY_FILE):
        try:
            raw = _read_json(LEGACY_FILE)
            modules.append(_build_module("_legacy", LEGACY_FILE, raw, {"title": "Legacy (problems.json)", "order": 9999}))
        except Exception:
            import traceback
            errors.append(("_legacy", traceback.format_exc()))

    modules.sort(key=lambda m: (m["order"], m["id"]))
    return modules, errors

def compute_score(p, results):
    tests = p["tests"]
    ok = [r["status"] == "AC" for r in results]
    sc = p.get("scoring") or {}
    tiers = sc.get("tiers")
    if not tiers:
        mx = p.get("points", 0)
        return (round(mx * sum(ok) / len(ok)) if ok else 0), mx, []
    if not ok:                      # a problem with no tests must not divide by zero
        tp = [t["points"] for t in tiers]
        return 0, (max(tp) if sc.get("mode") == "best" else sum(tp)), []
    rows = []
    for t in tiers:
        idx = [i for i, x in enumerate(tests) if t["tag"] in x["tags"]]
        passed = sum(ok[i] for i in idx)
        full = bool(idx) and passed == len(idx)
        got, partial = (t["points"] if full else 0), False
        pt = t.get("partial")
        if not full and pt:
            pi = [i for i in idx if pt["tag"] in tests[i]["tags"]]
            if pi and all(ok[i] for i in pi):
                got, partial = pt["points"], True
        rows.append({"points": t["points"], "label": t.get("label", t["tag"]), "n": len(idx), "passed": passed, "full": full, "partial": partial, "got": got})
    gots = [r["got"] for r in rows]
    if sc.get("mode") == "best":
        return max(gots), max(t["points"] for t in tiers), rows
    return sum(gots), sum(t["points"] for t in tiers), rows



# =========================================================================
#  Progress persistence
# =========================================================================
def load_progress():
    """Return {problem_iid: best_earned_points}."""
    try:
        with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
            raw = json.load(f)
        scores = raw.get("scores", {})
        return {str(k): v for k, v in scores.items() if isinstance(v, (int, float))}
    except FileNotFoundError:
        return {}
    except Exception:
        try:                      # keep the damaged file for inspection before any save replaces it
            if os.path.isfile(PROGRESS_FILE) and not os.path.exists(PROGRESS_FILE + ".bad"):
                shutil.copy2(PROGRESS_FILE, PROGRESS_FILE + ".bad")
        except Exception:
            pass
        return {}


def save_progress(progress):
    tmp = PROGRESS_FILE + ".tmp"
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump({"scores": progress}, f, indent=2, sort_keys=True)
        os.replace(tmp, PROGRESS_FILE)
    except Exception:
        pass


