"""
Big-O detector for Local Judge. Standard library only.

It runs your function on inputs of growing size, times each run, then fits the timings to
O(1), O(log n), O(n), O(n log n), O(n^2), O(n^3) and O(2^n) and reports the best match.
It is a rough estimate from measurements, not a proof.

Inputs come from either
  * a function you define in your code:   def make_input(n): return (arg1, arg2, ...)
  * or automatically: the largest test of the problem is stretched to size n
    (lists get longer, strings get longer, an int-only argument becomes n).
"""
import os
import sys
import json
import math
import pickle
import shutil
import tempfile
import subprocess

import safeexec

HARNESS = r'''
import sys, os, time, json, copy, math, random, pickle, threading, io

DATA = pickle.load(open(sys.argv[1], "rb"))
OUT = sys.stdout
BUDGET, MAXN = DATA["budget"], DATA["maxn"]

class _Null:
    """Prints from the learner code are irrelevant here; never collect them in memory."""
    def write(self, s):
        return len(s)
    def flush(self):
        pass

_DEVNULL = _Null()

def emit(o):
    OUT.write(json.dumps(o) + "\n"); OUT.flush()

def count(x):
    if isinstance(x, (list, tuple, set, frozenset)):
        return 1 + sum(count(i) for i in x)
    if isinstance(x, dict):
        return 1 + sum(count(i) for i in x.values())
    if isinstance(x, str):
        return 1 + len(x)
    return 1

def is_int(x):
    return isinstance(x, int) and not isinstance(x, bool)

def scale_seq(items, n, rng, kind):
    """Build a sequence of length n that looks like `items`."""
    if not items:
        out = [rng.randint(0, 2 * n) for _ in range(n)]
    elif all(is_int(i) for i in items):
        distinct = len(set(items)) == len(items)
        asc = list(items) == sorted(items)
        desc = list(items) == sorted(items, reverse=True)
        if distinct:
            out = rng.sample(range(10 * n + 10), n)
        else:
            out = [rng.randint(0, max(9, n // 2)) for _ in range(n)]
        if asc and len(items) > 1:
            out.sort()
        elif desc and len(items) > 1:
            out.sort(reverse=True)
    elif all(isinstance(i, float) or is_int(i) for i in items):
        out = [rng.random() * n for _ in range(n)]
        if list(items) == sorted(items) and len(items) > 1:
            out.sort()
    elif all(isinstance(i, str) for i in items):
        out = [rng.choice(items) for _ in range(n)]
    elif all(isinstance(i, (list, tuple)) for i in items):
        square = all(len(i) == len(items) for i in items)
        out = []
        for _ in range(n):
            tpl = rng.choice(items)
            if square:
                row = scale_seq(list(tpl), n, rng, type(tpl))
            else:
                row = [rng.randint(0, n - 1) if is_int(v) else v for v in tpl]
                row = type(tpl)(row)
            out.append(row)
        return kind(out) if kind in (list, tuple) else out
    else:
        out = [rng.choice(items) for _ in range(n)]
    return kind(out) if kind in (list, tuple, set, frozenset) else out

def scale_arg(x, n, rng):
    if isinstance(x, str):
        alpha = sorted(set(x)) or ["a"]
        return "".join(rng.choice(alpha) for _ in range(n))
    if isinstance(x, (list, tuple)):
        return scale_seq(list(x), n, rng, type(x))
    if isinstance(x, (set, frozenset)):
        items = list(x)
        if items and all(is_int(i) for i in items):
            return type(x)(rng.sample(range(10 * n + 10), n))
        return type(x)(scale_seq(items, n, rng, list))
    if isinstance(x, dict):
        vals = list(x.values()) or [0]
        keys = list(x.keys())
        if keys and all(isinstance(k, str) for k in keys):
            return {"k%d" % i: rng.choice(vals) for i in range(n)}
        return {i: rng.choice(vals) for i in range(n)}
    return x

def scalable(a):
    return isinstance(a, (str, list, tuple, set, frozenset, dict))

def make_inputs(template, n, rng):
    args = list(template)
    if any(scalable(a) for a in args):
        return tuple(scale_arg(a, n, rng) if scalable(a) else a for a in args)
    for i, a in enumerate(args):
        if is_int(a):
            args[i] = n
            return tuple(args)
    return None

def describe(template):
    args = list(template)
    sc = [i + 1 for i, a in enumerate(args) if scalable(a)]
    if sc:
        return "n = length of argument %s" % (", ".join(map(str, sc)))
    for i, a in enumerate(args):
        if is_int(a):
            return "n = the value of argument %d" % (i + 1)
    return ""

def pick_template(tests):
    best, bs = None, -1
    for t in tests:
        s = count(t["args"])
        if s > bs:
            best, bs = t["args"], s
    return best

def time_call(f, args):
    has_clear = hasattr(f, "cache_clear")
    def fresh():
        if has_clear:
            f.cache_clear()
        return copy.deepcopy(args)
    a = fresh()
    t0 = time.perf_counter(); f(*a); first = time.perf_counter() - t0
    best = first
    if has_clear:
        for _ in range(2):
            a = fresh()
            t0 = time.perf_counter(); f(*a); best = min(best, time.perf_counter() - t0)
        return best
    if first < 0.002:
        k = int(min(2000, max(3, 0.01 / max(first, 1e-7))))
        k = max(2, min(k, 2000000 // max(1, count(args))))
        for _ in range(3):
            batch = [copy.deepcopy(args) for _ in range(k)]
            t0 = time.perf_counter()
            for a in batch:
                f(*a)
            best = min(best, (time.perf_counter() - t0) / k)
    elif first < 0.1:
        for _ in range(2):
            a = fresh()
            t0 = time.perf_counter(); f(*a); best = min(best, time.perf_counter() - t0)
    return best

def main():
    ns = {"__name__": "bigo_user"}
    real_out = sys.stdout
    sys.stdout = _DEVNULL
    try:
        exec(compile(DATA["code"], "your code", "exec"), ns)
    except BaseException:
        import traceback
        sys.stdout = real_out
        emit({"error": "Your code crashed when loaded:\n" + traceback.format_exc()}); return
    f = ns.get(DATA["func"])
    if not callable(f):
        sys.stdout = real_out
        emit({"error": "Function %r is not defined." % DATA["func"]}); return
    maker = ns.get("make_input")
    template = pick_template(DATA["tests"]) if DATA["tests"] else None
    desc = "n = what your make_input(n) uses" if callable(maker) else (describe(template) if template is not None else "")
    sys.stdout = real_out
    emit({"desc": desc, "custom": callable(maker)})
    sys.stdout = _DEVNULL
    rng = random.Random(12345)
    t_start = time.perf_counter()
    n = 2
    while n <= MAXN:
        try:
            if callable(maker):
                args = maker(n)
                if not isinstance(args, tuple):
                    args = (args,)
            else:
                args = make_inputs(template, n, rng)
                if args is None:
                    sys.stdout = real_out
                    emit({"error": "Could not stretch this problem's input automatically. "
                                   "Define make_input(n) in your code that returns the argument tuple."}); return
            # A nested (n x n) input grows much faster than n. Stop before it eats the
            # machine, so a grid problem without make_input(n) fails cleanly instead.
            if count(args) > DATA["max_cells"]:
                sys.stdout = real_out
                emit({"stop": "the input grows past %d values at n=%d; define make_input(n) with a smaller shape"
                              % (DATA["max_cells"], n)}); return
            t = time_call(f, args)
        except RecursionError:
            sys.stdout = real_out; emit({"stop": "recursion limit at n=%d" % n}); return
        except BaseException as e:
            sys.stdout = real_out
            emit({"stop": "%s at n=%d: %s" % (type(e).__name__, n, str(e)[:120])}); return
        sys.stdout = real_out
        emit({"n": n, "t": t})
        sys.stdout = _DEVNULL
        if t > DATA["slow"] or time.perf_counter() - t_start > BUDGET:
            break
        n = max(n + 1, int(n * 1.6))
    sys.stdout = real_out

try:
    threading.stack_size(256 * 1024 * 1024)
except Exception:
    pass
sys.setrecursionlimit(20000)
th = threading.Thread(target=main)
th.start(); th.join()
'''

# ---------------------------------------------------------------------------- fitting
MODELS = [
    ("1", "O(1)", lambda n: 1.0),
    ("logn", "O(log n)", lambda n: math.log2(n + 1)),
    ("n", "O(n)", lambda n: float(n)),
    ("nlogn", "O(n log n)", lambda n: n * math.log2(n + 1)),
    ("n2", "O(n²)", lambda n: float(n) ** 2),
    ("n3", "O(n³)", lambda n: float(n) ** 3),
]

PLAIN = {
    "O(1)": "Constant time: the work does not grow with the input.",
    "O(log n)": "Logarithmic: doubling the input adds only a tiny, fixed amount of work (like binary search).",
    "O(n)": "Linear: doubling the input about doubles the time (one pass over the data).",
    "O(n log n)": "Linearithmic: a bit worse than linear (like merge sort or sorted()).",
    "O(n²)": "Quadratic: doubling the input about quadruples the time (usually a loop inside a loop).",
    "O(n³)": "Cubic: doubling the input makes it about 8 times slower (three nested loops).",
    "O(2^n)": "Exponential: every extra unit of input multiplies the time (e.g. naive recursion that branches twice).",
}


def _fit(points, f):
    """Weighted (relative error) fit of t = a*f(n) + b with a>0, b>=0. Returns (score, a, b)."""
    u = [f(n) / t for n, t in points]
    v = [1.0 / t for n, t in points]
    suu = sum(x * x for x in u); suv = sum(x * y for x, y in zip(u, v)); svv = sum(y * y for y in v)
    su, sv = sum(u), sum(v)
    det = suu * svv - suv * suv
    a = b = None
    if det > 1e-300:
        a = (su * svv - suv * sv) / det
        b = (suu * sv - suv * su) / det
    if a is None or a <= 0 or b < 0:
        a, b = (su / suu if suu else 0.0), 0.0
    if a <= 0:
        return float("inf"), 0.0, 0.0
    err = [((a * f(n) + b) / t - 1.0) ** 2 for n, t in points]
    return math.sqrt(sum(err) / len(err)), a, b


def _fit_const(points):
    v = [1.0 / t for _, t in points]
    c = sum(v) / sum(y * y for y in v)
    return math.sqrt(sum((c / t - 1.0) ** 2 for _, t in points) / len(points)), c, 0.0


def _fit_exp(points):
    xs = [n for n, _ in points]; ys = [math.log(t) for _, t in points]
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    sxx = sum((x - mx) ** 2 for x in xs)
    if sxx == 0:
        return float("inf"), 0.0, 0.0
    beta = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sxx
    alpha = my - beta * mx
    if beta <= 0:
        return float("inf"), 0.0, beta
    err = [(math.exp(alpha + beta * n) / t - 1.0) ** 2 for n, t in points]
    return math.sqrt(sum(err) / len(err)), math.exp(alpha), beta


def analyze(points):
    """points: [(n, seconds)]. Returns a dict describing the best guess."""
    pts = sorted((n, t) for n, t in points if t > 0)
    floor = [(n, t) for n, t in pts if t >= 4e-6]
    use = floor if len(floor) >= 4 else pts
    if len(use) < 4:
        return {"ok": False, "reason": "Not enough measurements to estimate."}
    n_span = use[-1][0] / use[0][0]
    t_span = use[-1][1] / use[0][1]
    fits = []
    s, _, _ = _fit_const(use)
    fits.append({"id": "1", "label": "O(1)", "score": s})
    for mid, label, f in MODELS[1:]:
        s, a, b = _fit(use, f)
        fits.append({"id": mid, "label": label, "score": s})
    s, a, beta = _fit_exp(use)
    exp_ok = beta > 0.2 and use[-1][0] <= 80
    fits.append({"id": "2n", "label": "O(2^n)", "score": s if exp_ok else float("inf"), "base": math.exp(beta) if beta > 0 else 0})
    ranked = sorted(fits, key=lambda x: x["score"])
    best = ranked[0]
    order = [f["id"] for f in fits]
    # prefer the simplest model that is nearly as good as the best
    pick = best
    for f in sorted(fits, key=lambda x: order.index(x["id"])):
        if f["score"] <= best["score"] * 1.3 + 0.04:
            pick = f
            break
    tiny = use[-1][1] < 2e-5
    if (t_span < 2.0 and n_span >= 20) or tiny:
        pick = next(f for f in fits if f["id"] == "1")
    others = [f for f in ranked if f is not pick and f["score"] < float("inf")]
    gap = (others[0]["score"] - pick["score"]) if others else 1.0
    conf = "high" if (len(use) >= 7 and gap > 0.15) else "medium" if len(use) >= 5 and gap > 0.04 else "low"
    if pick["score"] > 0.3 and not tiny:
        conf = "low"
    if tiny:
        conf = "medium"
    # doubling behaviour from the last few points
    tail = use[-4:]
    slope = None
    if tail[-1][0] > tail[0][0] and tail[0][1] > 0:
        slope = math.log(tail[-1][1] / tail[0][1]) / math.log(tail[-1][0] / tail[0][0])
    out = {"ok": True, "id": pick["id"], "label": pick["label"],
           "plain": ("Too fast to measure any growth, so it is constant or logarithmic (like binary search)." if tiny else PLAIN.get(pick["label"], "")),
           "confidence": conf,
           "fits": [{"label": f["label"], "score": None if f["score"] == float("inf") else round(f["score"], 3)} for f in ranked],
           "double": (2 ** slope) if slope is not None and pick["id"] not in ("1", "2n") else None,
           "base": pick.get("base") if pick["id"] == "2n" else None}
    # curve for the chart
    if pick["id"] == "1":
        _, a, b = _fit_const(use)
        out["curve"] = [[n, a] for n, _ in use]
    elif pick["id"] == "2n":
        _, a, beta = _fit_exp(use)
        out["curve"] = [[n, a * math.exp(beta * n)] for n, _ in use]
    else:
        f = next(m[2] for m in MODELS if m[0] == pick["id"])
        _, a, b = _fit(use, f)
        out["curve"] = [[n, a * f(n) + b] for n, _ in use]
    return out


# ---------------------------------------------------------------------------- running
def measure(code, func, tests, budget=8.0, maxn=262144, slow=0.4, rid="", max_cells=2000000):
    """Run `code` in a subprocess on growing inputs. Returns the full report dict."""
    tmp = tempfile.mkdtemp(prefix="cs11_bigo_")
    try:
        data = os.path.join(tmp, "d.pkl"); runner = os.path.join(tmp, "r.py")
        with open(data, "wb") as f:
            pickle.dump({"code": code, "func": func, "tests": tests, "budget": budget, "maxn": maxn,
                         "slow": slow, "max_cells": max_cells}, f)
        with open(runner, "w", encoding="utf-8") as f:
            f.write(HARNESS)
        env = dict(os.environ, PYTHONUTF8="1", PYTHONIOENCODING="utf-8")
        r = safeexec.run([sys.executable, runner, data], cwd=tmp, timeout=budget + 12, env=env,
                         max_output=256 * 1024, key=rid)
        out, err = r.stdout, r.stderr
        if r.stopped:
            return {"points": [], "desc": "", "custom": False, "stop": "", "ok": False,
                    "reason": "You stopped the measurement."}
        if r.timed_out:
            out = ""          # measurements half-way through are not worth pretending to fit
            err = "Measuring took longer than %g seconds." % (budget + 12)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    points, desc, custom, stop, error = [], "", False, "", ""
    for line in out.splitlines():
        try:
            o = json.loads(line)
        except ValueError:
            continue
        if "n" in o:
            points.append((o["n"], o["t"]))
        elif "desc" in o:
            desc, custom = o["desc"], o["custom"]
        elif "stop" in o:
            stop = o["stop"]
        elif "error" in o:
            error = o["error"]
    rep = {"points": [[n, t] for n, t in points], "desc": desc, "custom": custom, "stop": stop}
    if error:
        rep.update(ok=False, reason=error)
        return rep
    if not points:
        rep.update(ok=False, reason=(err.strip().splitlines() or ["The measurement produced nothing."])[-1])
        return rep
    rep.update(analyze(points))
    if not rep.get("ok") and stop:
        rep["reason"] = "Stopped early (" + stop + "). Try make_input(n) with smaller sizes."
    return rep
