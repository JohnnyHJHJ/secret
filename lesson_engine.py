"""
Lesson engine: parses lesson files, runs learner code safely in a subprocess,
and validates lessons. No GUI code in here, so it can be tested on its own
(see validate_lessons.py).

Lesson file format (Markdown + ``:::`` blocks) is documented in
LESSON_AUTHORING_PROMPT.md.
"""
import os
import re
import sys
import json
import shlex
import shutil
import tempfile
import subprocess

import safeexec

CALLOUT_KINDS = {"note", "tip", "warning", "danger", "key", "goal", "recap", "example"}
CALLOUT_ALIASES = {"keypoint": "key", "keyidea": "key", "goals": "goal", "caution": "warning"}
HINT_NAMES = {"hint", "answer", "spoiler"}
INTERACTIVE = {"quiz", "predict", "fill", "exercise", "try"}
ROLE_WORDS = {"starter", "solution", "tests", "test", "stdin", "expect_output", "answer", "output"}

FENCE_RE = re.compile(r"^(\s*)(`{3,}|~{3,})\s*(.*?)\s*$")
DIRECT_RE = re.compile(r"^(:{3,})\s*([A-Za-z_][\w-]*)\s*(.*?)\s*$")
HEAD_RE = re.compile(r"^(#{1,6})\s+(.*?)\s*#*\s*$")
HR_RE = re.compile(r"^(-{3,}|\*{3,}|_{3,})\s*$")
LIST_RE = re.compile(r"^(\s*)([-*+]|\d+[.)])\s+(.*)$")
TABLE_SEP_RE = re.compile(r"^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$")
BLANK_RE = re.compile(r"\[\[(.*?)\]\]")


# =========================================================================
#  Parsing
# =========================================================================
class Parser:
    def __init__(self):
        self.warnings = []
        self._auto = 0

    # ---- helpers --------------------------------------------------------
    def _attrs(self, argstr):
        try:
            toks = shlex.split(argstr)
        except ValueError:
            toks = argstr.split()
        plain, attrs = [], {}
        for t in toks:
            if "=" in t and re.match(r"^[A-Za-z_]\w*=", t):
                k, v = t.split("=", 1)
                attrs[k.lower()] = v
            else:
                plain.append(t)
        return plain, attrs

    def _auto_id(self, prefix):
        self._auto += 1
        return f"{prefix}{self._auto}"

    # ---- block parser ---------------------------------------------------
    def parse(self, lines):
        out, para = [], []
        i, n = 0, len(lines)

        def flush():
            if para:
                out.append({"t": "para", "text": " ".join(s.strip() for s in para)})
                para.clear()

        while i < n:
            line = lines[i]
            stripped = line.strip()

            if not stripped:
                flush(); i += 1; continue

            m = FENCE_RE.match(line)
            if m:
                flush()
                fence = m.group(2)
                info = m.group(3).split()
                body = []
                i += 1
                while i < n:
                    ls = lines[i].strip()
                    if ls.startswith(fence[0] * len(fence)) and set(ls) == {fence[0]}:
                        break
                    body.append(lines[i])
                    i += 1
                i += 1
                indent = len(m.group(1))
                if indent:
                    body = [b[indent:] if b[:indent].strip() == "" else b for b in body]
                roles = [t for t in info if t in ROLE_WORDS or t.startswith("file:") or t.startswith("expect_file:")]
                langs = [t for t in info if t not in roles]
                out.append({"t": "code", "lang": (langs[0] if langs else ""), "roles": roles,
                            "text": "\n".join(body)})
                continue

            m = DIRECT_RE.match(line)
            if m:
                flush()
                colons, name, argstr = m.group(1), m.group(2).lower(), m.group(3)
                inner = []
                i += 1
                depth_fence = None
                closed = False
                while i < n:
                    ls = lines[i].strip()
                    fm = FENCE_RE.match(lines[i])
                    if fm:
                        f = fm.group(2)
                        if depth_fence is None:
                            depth_fence = f
                        elif ls.startswith(depth_fence[0] * len(depth_fence)) and set(ls) == {depth_fence[0]}:
                            depth_fence = None
                    if depth_fence is None and ls == colons:
                        closed = True
                        break
                    inner.append(lines[i])
                    i += 1
                i += 1
                if not closed:
                    self.warnings.append(f"block ':::{name}' is never closed (expected a line with just {colons})")
                out.append(self.directive(name, argstr, inner))
                continue

            m = HEAD_RE.match(line)
            if m:
                flush()
                out.append({"t": "heading", "level": len(m.group(1)), "text": m.group(2)})
                i += 1; continue

            if HR_RE.match(stripped):
                flush(); out.append({"t": "hr"}); i += 1; continue

            if stripped.startswith("|") and i + 1 < n and TABLE_SEP_RE.match(lines[i + 1]):
                flush()
                rows = []
                header = self._cells(stripped)
                i += 2
                while i < n and lines[i].strip().startswith("|"):
                    rows.append(self._cells(lines[i].strip()))
                    i += 1
                out.append({"t": "table", "header": header, "rows": rows})
                continue

            m = LIST_RE.match(line)
            if m and not HR_RE.match(stripped):
                flush()
                items = []
                while i < n:
                    lm = LIST_RE.match(lines[i])
                    if lm:
                        ind = len(lm.group(1).replace("\t", "    "))
                        ordered = lm.group(2)[0].isdigit()
                        items.append({"level": ind // 2 if ind < 8 else 4, "ordered": ordered,
                                      "num": lm.group(2).rstrip(".)") if ordered else "",
                                      "text": lm.group(3).strip()})
                        i += 1
                    elif lines[i].strip() == "":
                        j = i
                        while j < n and lines[j].strip() == "":
                            j += 1
                        if j < n and LIST_RE.match(lines[j]) and not HR_RE.match(lines[j].strip()):
                            i = j
                        else:
                            break
                    elif lines[i].startswith((" ", "\t")) and items and not FENCE_RE.match(lines[i]):
                        items[-1]["text"] += " " + lines[i].strip()
                        i += 1
                    else:
                        break
                out.append({"t": "list", "items": items})
                continue

            if stripped.startswith(">"):
                flush()
                q = []
                while i < n and lines[i].strip().startswith(">"):
                    q.append(lines[i].strip()[1:].strip())
                    i += 1
                out.append({"t": "quote", "text": " ".join(q)})
                continue

            para.append(line)
            i += 1

        flush()
        return out

    @staticmethod
    def _cells(row):
        row = row.strip()
        if row.startswith("|"): row = row[1:]
        if row.endswith("|"): row = row[:-1]
        return [c.strip() for c in row.split("|")]

    # ---- directives -----------------------------------------------------
    def directive(self, name, argstr, inner):
        plain, attrs = self._attrs(argstr)
        name = CALLOUT_ALIASES.get(name, name)

        if name in CALLOUT_KINDS:
            return {"t": "callout", "kind": name, "title": " ".join(plain) or attrs.get("title", ""),
                    "blocks": self.parse(inner)}
        if name in HINT_NAMES:
            default = "Answer" if name == "answer" else "Hint"
            return {"t": "hint", "title": " ".join(plain) or attrs.get("title", "") or default,
                    "blocks": self.parse(inner)}
        if name == "explain":
            return {"t": "explain", "blocks": self.parse(inner)}
        if name in INTERACTIVE:
            return self.interactive(name, plain, attrs, inner)

        self.warnings.append(f"unknown block ':::{name}' (shown as a warning box)")
        return {"t": "callout", "kind": "warning", "title": f"Unknown block ':::{name}'",
                "blocks": self.parse(inner)}

    def interactive(self, name, plain, attrs, inner):
        blocks = self.parse(inner)
        hints = [b for b in blocks if b["t"] == "hint"]
        expl = next((b for b in blocks if b["t"] == "explain"), None)
        rest = [b for b in blocks if b["t"] not in ("hint", "explain")]
        node_id = plain[0] if plain else (attrs.get("id") or self._auto_id(name[:2]))
        base = {"id": node_id, "hints": hints, "explain": expl}

        roled = [b for b in rest if b["t"] == "code" and b["roles"]]
        prompt = [b for b in rest if not (b["t"] == "code" and b["roles"])]

        def role(r):
            return next((b["text"] for b in roled if r in b["roles"]), None)

        if name == "quiz":
            options = []
            question = []
            for b in prompt:
                if b["t"] == "list" and all(re.match(r"^\[( |x|X)\]\s*", it["text"]) for it in b["items"]) and not options:
                    for it in b["items"]:
                        mm = re.match(r"^\[( |x|X)\]\s*(.*)$", it["text"])
                        options.append((mm.group(2), mm.group(1) in "xX"))
                else:
                    question.append(b)
            if len(options) < 2:
                self.warnings.append(f"quiz '{node_id}' needs at least 2 options written as '- [ ] text' / '- [x] text'")
            if not any(c for _, c in options):
                self.warnings.append(f"quiz '{node_id}' has no correct option ('- [x] ...')")
            return dict(base, t="quiz", prompt=question, options=options)

        if name == "predict":
            code = next((b["text"] for b in prompt if b["t"] == "code" and b["lang"] in ("python", "py", "")), None)
            if code is None:
                self.warnings.append(f"predict '{node_id}' has no ```python code block to predict")
            ans = role("answer") or role("output")
            return dict(base, t="predict", prompt=prompt, code=code or "", answer=ans,
                        stdin=role("stdin"), files=self._files(roled))

        if name == "fill":
            code_block = next((b for b in prompt if b["t"] == "code" and "[[" in b["text"]), None)
            if code_block is None:
                self.warnings.append(f"fill '{node_id}' needs a code block containing [[blank]] markers")
                code_text = ""
            else:
                code_text = code_block["text"]
                prompt = [b for b in prompt if b is not code_block]
            lines = []
            for ln in code_text.split("\n"):
                parts, pos = [], 0
                for mm in BLANK_RE.finditer(ln):
                    if mm.start() > pos:
                        parts.append(("t", ln[pos:mm.start()]))
                    parts.append(("b", [a.strip() for a in mm.group(1).split("|") if a.strip() != ""] or [""]))
                    pos = mm.end()
                if pos < len(ln):
                    parts.append(("t", ln[pos:]))
                lines.append(parts)
            full = BLANK_RE.sub(lambda mm: (mm.group(1).split("|")[0]).strip(), code_text)
            return dict(base, t="fill", prompt=prompt, lines=lines, code=full)

        # exercise / try
        starter = role("starter")
        if starter is None:
            starter = ""
            self.warnings.append(f"{name} '{node_id}' has no ```python starter block")
        tests = role("tests") or role("test")
        expect_output = role("expect_output")
        files, expect_files = self._files(roled), {}
        for b in roled:
            for r in b["roles"]:
                if r.startswith("expect_file:"):
                    expect_files[r.split(":", 1)[1]] = b["text"]
        run_only = (name == "try") or (tests is None and expect_output is None and not expect_files)
        try:
            timeout = float(attrs.get("timeout", 5))
        except ValueError:
            timeout = 5.0
        return dict(base, t="exercise", prompt=prompt, starter=starter, solution=role("solution"),
                    tests=tests, stdin=role("stdin"), expect_output=expect_output, files=files,
                    expect_files=expect_files, run_only=run_only, timeout=timeout,
                    kind=attrs.get("kind", "try" if name == "try" else "write"),
                    title=attrs.get("title", ""))

    @staticmethod
    def _files(roled):
        files = {}
        for b in roled:
            for r in b["roles"]:
                if r.startswith("file:"):
                    files[r.split(":", 1)[1]] = b["text"] + ("\n" if b["text"] and not b["text"].endswith("\n") else "")
        return files


def parse_lesson_text(text, lesson_id="", path=""):
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    meta = {}
    lines = text.split("\n")
    if lines and lines[0].strip() == "---":
        for j in range(1, len(lines)):
            if lines[j].strip() == "---":
                for ln in lines[1:j]:
                    if ":" in ln:
                        k, v = ln.split(":", 1)
                        meta[k.strip().lower()] = v.strip()
                lines = lines[j + 1:]
                break
    p = Parser()
    blocks = p.parse(lines)
    title = meta.get("title")
    if not title:
        h = next((b for b in blocks if b["t"] == "heading"), None)
        title = h["text"] if h else (os.path.splitext(os.path.basename(path))[0].replace("_", " ").title() or "Lesson")
    acts = []
    _collect(blocks, acts)
    ids = [a["id"] for a in acts]
    for d in sorted({i for i in ids if ids.count(i) > 1}):
        p.warnings.append(f"duplicate activity id '{d}' (ids must be unique within a lesson)")
    try:
        minutes = int(meta.get("minutes", meta.get("estimated_minutes", 0)) or 0)
    except ValueError:
        minutes = 0
    return {"id": lesson_id, "path": path, "title": title, "summary": meta.get("summary", ""),
            "minutes": minutes, "blocks": blocks, "activities": acts, "warnings": p.warnings}


def _collect(blocks, acts):
    for b in blocks:
        if b["t"] in ("quiz", "predict", "fill", "exercise"):
            acts.append(b)
        elif b["t"] in ("callout", "hint"):
            _collect(b["blocks"], acts)


def discover_courses(lessons_dir):
    """Return (courses, errors). A course is a sub-folder of lessons/ holding .md files."""
    courses, errors = [], []
    if not os.path.isdir(lessons_dir):
        return courses, errors

    def load_folder(cid, folder, default_title):
        meta = {}
        cj = os.path.join(folder, "course.json")
        if os.path.isfile(cj):
            try:
                with open(cj, "r", encoding="utf-8") as f:
                    meta = json.load(f)
            except Exception as e:
                errors.append((cid, f"course.json: {e}"))
        lessons = []
        for fn in sorted(os.listdir(folder)):
            if not fn.lower().endswith(".md") or fn.startswith(("_", ".")) or fn.lower() == "readme.md":
                continue
            fp = os.path.join(folder, fn)
            try:
                with open(fp, "r", encoding="utf-8") as f:
                    lessons.append(parse_lesson_text(f.read(), f"{cid}/{os.path.splitext(fn)[0]}", fp))
            except Exception as e:
                import traceback
                errors.append((f"{cid}/{fn}", traceback.format_exc()))
        if lessons:
            courses.append({"id": cid, "title": meta.get("title") or default_title,
                            "order": meta.get("order", 1000), "description": meta.get("description", ""),
                            "path": folder, "lessons": lessons})

    for name in sorted(os.listdir(lessons_dir)):
        folder = os.path.join(lessons_dir, name)
        if os.path.isdir(folder) and not name.startswith((".", "_")):
            load_folder(name, folder, name.replace("_", " ").title())
    loose = [f for f in os.listdir(lessons_dir) if f.lower().endswith(".md") and not f.startswith(("_", "."))
             and f.lower() != "readme.md"]
    if loose:
        load_folder("general", lessons_dir, "General")
    courses.sort(key=lambda c: (c["order"], c["id"]))
    return courses, errors


# =========================================================================
#  Running learner code
# =========================================================================
RUNNER = r'''
import sys, json, io, os, ast, math, traceback, contextlib

_cfg = json.load(open(sys.argv[1], encoding="utf-8"))
_USER_SRC = _cfg["code"]
_UN = "<your code>"
_res = {"status": "ok", "stdout": "", "error": None, "checks": [], "files": {}}
_real_stdout = sys.stdout

class _CappedOut:
    """stdout that keeps only a few MB, so a printing loop cannot eat all memory."""
    LIMIT = 2000000
    def __init__(self):
        self.parts, self.n, self.cut = [], 0, False
    def write(self, s):
        if not isinstance(s, str):
            s = str(s)
        if self.n < self.LIMIT:
            take = s[:self.LIMIT - self.n]
            self.parts.append(take)
            self.n += len(take)
            if len(take) < len(s):
                self.cut = True
        elif s:
            self.cut = True
        return len(s)
    def flush(self):
        pass
    def getvalue(self):
        text = "".join(self.parts)
        if self.cut:
            text += "\n... (output cut after %d KB) ..." % (self.LIMIT // 1000)
        return text

_buf = _CappedOut()

def _fmt_exc(etype, e, tb):
    if issubclass(etype, SyntaxError) and getattr(e, "filename", None) == _UN:
        out = "SyntaxError on line %s: %s" % (e.lineno, e.msg)
        if e.text:
            out += "\n    " + e.text.strip()
        return out
    src_lines = _USER_SRC.splitlines()
    frames = []
    for fr in traceback.extract_tb(tb):
        if fr.filename == _UN:
            t = src_lines[fr.lineno - 1].strip() if 0 < fr.lineno <= len(src_lines) else ""
            frames.append("  line %d, in %s\n    %s" % (fr.lineno, fr.name, t))
    head = etype.__name__ + (": " + str(e) if str(e) else "")
    if issubclass(etype, EOFError):
        head += "  (your program called input() but no input was given)"
    return ("Error in your code:\n" + "\n".join(frames) + "\n" + head) if frames else head

def _short(x, n=240):
    r = repr(x)
    return r if len(r) <= n else r[:n] + "... (%d chars)" % len(r)

def _norm_text(s):
    lines = [ln.rstrip() for ln in str(s).replace("\r\n", "\n").split("\n")]
    while lines and lines[-1] == "":
        lines.pop()
    return "\n".join(lines)

def _eq(a, b):
    if isinstance(a, (int, float)) and isinstance(b, (int, float)) and not isinstance(a, bool) and not isinstance(b, bool):
        if isinstance(a, float) or isinstance(b, float):
            return math.isclose(a, b, rel_tol=1e-9, abs_tol=1e-9)
    return a == b

def _rec(name, ok, got=None, expected=None, error=None, text=False):
    d = {"name": name, "ok": bool(ok), "error": error}
    if got is not None or expected is not None:
        d["got"] = got if text else _short(got)
        d["expected"] = expected if text else _short(expected)
    _res["checks"].append(d)
    return bool(ok)

def _nm(name):
    return name or "check %d" % (len(_res["checks"]) + 1)

def check(actual, expected=True, name=None):
    name = _nm(name)
    try:
        got = actual() if callable(actual) else actual
    except BaseException as e:
        return _rec(name, False, error=_fmt_exc(type(e), e, e.__traceback__))
    return _rec(name, _eq(got, expected), got, expected)

def check_output(fn, expected, name=None):
    name = _nm(name)
    b = io.StringIO()
    try:
        with contextlib.redirect_stdout(b):
            fn()
    except BaseException as e:
        return _rec(name, False, error=_fmt_exc(type(e), e, e.__traceback__))
    got = _norm_text(b.getvalue())
    exp = _norm_text(expected)
    return _rec(name, got == exp, got, exp, text=True)

def check_raises(fn, exc, name=None):
    name = _nm(name)
    try:
        fn()
    except exc:
        return _rec(name, True)
    except BaseException as e:
        return _rec(name, False, got=type(e).__name__, expected=getattr(exc, "__name__", str(exc)), text=True)
    return _rec(name, False, got="no error", expected=getattr(exc, "__name__", str(exc)), text=True)

def read_file(path):
    try:
        with open(path, encoding="utf-8") as f:
            return f.read()
    except Exception:
        return None

def check_file(path, expected, name=None):
    name = _nm(name or ("file " + str(path)))
    got = read_file(path)
    if got is None:
        return _rec(name, False, got="(file does not exist)", expected=_norm_text(expected), text=True)
    return _rec(name, _norm_text(got) == _norm_text(expected), _norm_text(got), _norm_text(expected), text=True)

def feed(text):
    sys.stdin = io.StringIO(text)

try:
    _TREE = ast.parse(_USER_SRC)
except Exception:
    _TREE = None
SOURCE = _USER_SRC

def uses(*names):
    """True if the learner's code contains every AST node type given, e.g. uses('With', 'For')."""
    if _TREE is None: return False
    present = {type(n).__name__ for n in ast.walk(_TREE)}
    return all(n in present for n in names)

def calls(*names):
    """True if the learner's code calls every function / method name given, e.g. calls('open', 'readline')."""
    if _TREE is None: return False
    found = set()
    for n in ast.walk(_TREE):
        if isinstance(n, ast.Call):
            f = n.func
            if isinstance(f, ast.Name): found.add(f.id)
            elif isinstance(f, ast.Attribute): found.add(f.attr)
    return all(n in found for n in names)

def approx(a, b, tol=1e-6):
    return abs(a - b) <= tol

def _write_result():
    _res["stdout"] = _USER_OUT
    try:
        for fn in sorted(os.listdir(".")):
            if os.path.isfile(fn):
                try:
                    with open(fn, encoding="utf-8") as f:
                        data = f.read(4001)
                    _res["files"][fn] = data if len(data) <= 4000 else data[:4000] + "\n... (truncated)"
                except Exception:
                    _res["files"][fn] = "(binary or unreadable)"
    except Exception:
        pass
    with open(_cfg["result_path"], "w", encoding="utf-8") as f:
        json.dump(_res, f)

sys.stdin = io.StringIO(_cfg.get("stdin") or "")
ns = {"__name__": "__main__"}
_USER_OUT = ""

sys.stdout = _buf
try:
    exec(compile(_USER_SRC, _UN, "exec"), ns)
except SystemExit:
    pass
except BaseException as e:
    _res["status"] = "error"
    _res["error"] = _fmt_exc(type(e), e, e.__traceback__)
finally:
    sys.stdout = _real_stdout
_USER_OUT = _buf.getvalue()

if _res["status"] == "ok":
    ns.update(check=check, check_output=check_output, check_raises=check_raises, check_file=check_file,
              read_file=read_file, feed=feed, uses=uses, calls=calls, approx=approx, SOURCE=SOURCE)
    sys.stdout = io.StringIO()
    try:
        if _cfg.get("tests"):
            try:
                exec(compile(_cfg["tests"], "<tests>", "exec"), ns)
            except BaseException as e:
                _rec("tests could not finish", False, error=_fmt_exc(type(e), e, e.__traceback__))
        if _cfg.get("expect_output") is not None:
            got, exp = _norm_text(_USER_OUT), _norm_text(_cfg["expect_output"])
            _rec("program output", got == exp, got, exp, text=True)
        for fname, exp in (_cfg.get("expect_files") or {}).items():
            check_file(fname, exp, "file " + fname)
    finally:
        sys.stdout = _real_stdout

_write_result()
'''


def run_code(code, *, tests=None, stdin=None, files=None, expect_output=None,
             expect_files=None, timeout=5.0):
    """Run `code` in a fresh Python process inside a throw-away folder.

    Returns {status: ok|error|timeout|stopped|crash, stdout, error, checks, files, passed}.
    `passed` means: ran without error AND every check passed (and there was
    at least one check if tests/expectations were supplied).
    """
    tmp = tempfile.mkdtemp(prefix="cs11_lesson_")
    work = os.path.join(tmp, "work")
    run = os.path.join(tmp, "run")
    os.makedirs(work)
    os.makedirs(run)
    try:
        for name, content in (files or {}).items():
            fp = os.path.join(work, name)
            os.makedirs(os.path.dirname(fp), exist_ok=True)
            with open(fp, "w", encoding="utf-8", newline="\n") as f:
                f.write(content)
        result_path = os.path.join(run, "result.json")
        cfg = {"code": code, "tests": tests, "stdin": stdin, "expect_output": expect_output,
               "expect_files": expect_files or {}, "result_path": result_path}
        with open(os.path.join(run, "cfg.json"), "w", encoding="utf-8") as f:
            json.dump(cfg, f)
        with open(os.path.join(run, "runner.py"), "w", encoding="utf-8") as f:
            f.write(RUNNER)
        env = dict(os.environ, PYTHONUTF8="1", PYTHONIOENCODING="utf-8")
        r = safeexec.run([sys.executable, os.path.join(run, "runner.py"), os.path.join(run, "cfg.json")],
                         cwd=work, timeout=timeout, env=env, max_output=512 * 1024)
        if r.stopped:
            return {"status": "stopped", "stdout": "", "error": "You stopped this run.",
                    "checks": [], "files": {}, "passed": False}
        if r.timed_out:
            return {"status": "timeout", "stdout": "", "error": f"Your code ran for more than {timeout:g} seconds. "
                    "Is there an infinite loop, or is it waiting for input()?", "checks": [], "files": {}, "passed": False}
        if not os.path.isfile(result_path):
            return {"status": "crash", "stdout": r.stdout, "error": (r.stderr or "The runner crashed.").strip(),
                    "checks": [], "files": {}, "passed": False}
        with open(result_path, "r", encoding="utf-8") as f:
            res = json.load(f)
        want_checks = bool(tests) or expect_output is not None or bool(expect_files)
        checks_ok = all(c["ok"] for c in res["checks"]) and (bool(res["checks"]) or not want_checks)
        res["passed"] = res["status"] == "ok" and checks_ok
        return res
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def norm_text(s):
    lines = [ln.rstrip() for ln in str(s).replace("\r\n", "\n").split("\n")]
    while lines and lines[-1] == "":
        lines.pop()
    return "\n".join(lines)


# =========================================================================
#  Validation (quality gate for AI-written lessons)
# =========================================================================
def validate_lesson(lesson):
    """Return (errors, notes). Errors must be fixed; notes are suggestions."""
    errors = [f"parse: {w}" for w in lesson["warnings"]]
    notes = []
    acts = lesson["activities"]
    if not acts:
        errors.append("lesson has no interactive activities (add quiz / predict / fill / exercise blocks)")
    elif len(acts) < 4:
        notes.append(f"only {len(acts)} activities; aim for 4 or more per lesson")
    if not lesson["summary"]:
        notes.append("no 'summary:' in the front matter")

    for a in acts:
        tag = f"{a['t']} '{a['id']}'"
        if a["t"] == "exercise":
            if a["solution"] is None:
                if a["run_only"]:
                    notes.append(f"{tag}: run-only block without a solution (fine for 'try it' blocks)")
                else:
                    errors.append(f"{tag}: no ```python solution block")
                continue
            kw = dict(tests=a["tests"], stdin=a["stdin"], files=a["files"], expect_output=a["expect_output"],
                      expect_files=a["expect_files"], timeout=a["timeout"])
            r = run_code(a["solution"], **kw)
            if not r["passed"]:
                errors.append(f"{tag}: the SOLUTION does not pass: " + _why(r))
            if not a["run_only"]:
                if a["kind"] != "debug" and a["starter"].strip():
                    s = run_code(a["starter"], **kw)
                    if s["passed"]:
                        errors.append(f"{tag}: the STARTER already passes the tests (the learner would get credit for doing nothing)")
                n_checks = len(r.get("checks", []))
                if n_checks == 0 and not a["expect_output"] and not a["expect_files"]:
                    errors.append(f"{tag}: tests block contains no check(...) calls")
            else:
                notes.append(f"{tag}: has no tests, so it is run-only (fine for 'try it' blocks)")
            if not a["hints"]:
                notes.append(f"{tag}: no :::hint blocks")
        elif a["t"] == "predict":
            r = run_code(a["code"], stdin=a["stdin"], files=a["files"])
            if r["status"] != "ok":
                errors.append(f"{tag}: the code does not run: {r['error']}")
            elif a["answer"] is not None and norm_text(r["stdout"]) != norm_text(a["answer"]):
                errors.append(f"{tag}: the ```text answer block does not match the real output.\n"
                              f"      real output:\n{_indent(norm_text(r['stdout']))}\n      your answer:\n{_indent(norm_text(a['answer']))}")
            elif a["answer"] is None and not r["stdout"].strip():
                errors.append(f"{tag}: the code prints nothing, so there is nothing to predict")
        elif a["t"] == "fill":
            if not a["lines"]:
                continue
            try:
                compile(a["code"], "<fill>", "exec")
            except SyntaxError as e:
                errors.append(f"{tag}: with the first answer in every blank the code is not valid Python ({e.msg}, line {e.lineno})")
            if not any(p[0] == "b" for ln in a["lines"] for p in ln):
                errors.append(f"{tag}: no [[blank]] markers found")
        elif a["t"] == "quiz":
            pass  # structure already checked by the parser
    return errors, notes


def _why(r):
    if r["status"] != "ok":
        return f"{r['status']}: {r['error']}"
    bad = [c for c in r["checks"] if not c["ok"]]
    if not r["checks"]:
        return "no checks were executed"
    c = bad[0]
    return f"check '{c['name']}' failed. " + (c["error"] or f"got {c.get('got')} expected {c.get('expected')}")


def _indent(s, n=8):
    return "\n".join(" " * n + ln for ln in s.split("\n"))
