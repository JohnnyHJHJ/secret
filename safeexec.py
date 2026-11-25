"""
Run learner code in a throw-away subprocess with a hard time limit and a hard cap on
how much output is kept in memory.

Why this module exists
----------------------
A learner's accidental infinite loop (especially one that keeps printing) used to be
able to fill the judge server's memory: Python's subprocess.run() captures every byte
the child writes, so ten seconds of printing could mean hundreds of megabytes held in
the server process, and a Check with a long per-problem timeout could mean gigabytes.
The server then slowed down, stopped answering, and the page said "Failed to fetch".

Here every child is:
  * killed at the deadline, together with anything it started (taskkill /T on
    Windows, a process group on POSIX), so a hung program cannot keep the server busy;
  * drained through pipes that keep only the first `max_output` characters and the
    last few kilobytes (the tail is where a "###RESULT###" marker lives), while the
    rest is read and thrown away. Memory stays bounded no matter how much is printed.

The register of active processes also lets the interface stop a run on demand
(see kill_all() and the /api/judge/stop endpoint).
"""
import os
import sys
import time
import signal
import threading
import subprocess
from collections import deque

MAX_OUTPUT = 128 * 1024          # characters kept from the start of stdout / stderr
_READ_CHUNK = 8192
_TAIL_CHUNKS = 8                 # 8 x 8 KB kept from the end, so the result marker survives
_WIN = os.name == "nt"

_LOCK = threading.Lock()
_ACTIVE = set()          # {(key, Popen)}
_STOPPED = set()         # pids that Stop asked to end
_STOPPED_KEYS = deque(maxlen=40)   # run ids Stop pressed before the run had even started


class Result:
    """What a finished (or killed) child left behind. All bytes are already capped."""

    __slots__ = ("stdout", "stderr", "returncode", "timed_out", "stopped", "truncated",
                 "bytes_out", "bytes_err", "secs")

    def __init__(self):
        self.stdout = ""
        self.stderr = ""
        self.returncode = None
        self.timed_out = False
        self.stopped = False
        self.truncated = False
        self.bytes_out = 0
        self.bytes_err = 0
        self.secs = 0.0

    def as_dict(self):
        return {"stdout": self.stdout, "stderr": self.stderr, "returncode": self.returncode,
                "timed_out": self.timed_out, "stopped": self.stopped,
                "truncated": self.truncated, "secs": round(self.secs, 2)}


class _Sink:
    """Read one pipe to the end but remember only its head and its tail."""

    def __init__(self, cap, tail_bytes=None):
        self.cap = max(4096, int(cap or MAX_OUTPUT))
        tail = int(tail_bytes or (_TAIL_CHUNKS * _READ_CHUNK))
        self.tail = deque(maxlen=max(1, tail // _READ_CHUNK))
        self.head = []
        self.head_len = 0
        self.total = 0

    def pump(self, pipe):
        try:
            while True:
                chunk = pipe.read(_READ_CHUNK)
                if not chunk:
                    break
                self.total += len(chunk)
                if self.head_len < self.cap:
                    take = chunk[:self.cap - self.head_len]
                    self.head.append(take)
                    self.head_len += len(take)
                self.tail.append(chunk)
        except Exception:
            pass
        finally:
            try:
                pipe.close()
            except Exception:
                pass

    def text(self):
        head = "".join(self.head)
        if self.total <= self.head_len:
            return head, False
        tail = "".join(self.tail)
        # the last chunks can overlap the head when the output only just overflowed
        skip = max(0, self.head_len - (self.total - len(tail)))
        tail = tail[skip:]
        note = ("\n... (output cut: %d KB in total, showing the first and the last part) ...\n"
                % max(1, self.total // 1024))
        return head + note + tail, True


def _feed(proc, text):
    try:
        if text:
            proc.stdin.write(text)
        proc.stdin.close()
    except Exception:
        pass


def kill_tree(proc):
    """Kill a child and everything it started. Safe to call more than once."""
    if proc is None:
        return
    try:
        if proc.poll() is not None:
            return
    except Exception:
        return
    try:
        if _WIN:
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                           creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                           timeout=8)
        else:
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
    except Exception:
        pass
    try:
        proc.kill()
    except Exception:
        pass
    try:
        proc.wait(timeout=5)
    except Exception:
        pass


def _popen(cmd, cwd, env):
    kw = dict(cwd=cwd, env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
              stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace")
    if _WIN:
        kw["creationflags"] = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
    else:
        kw["start_new_session"] = True
    return subprocess.Popen(list(cmd), **kw)


def run(cmd, *, cwd=None, input_text="", timeout=10.0, env=None, max_output=MAX_OUTPUT,
        tail_bytes=None, key=""):
    """Run `cmd` for at most `timeout` seconds and return a Result.

    `key` is an optional id chosen by the interface; Stop can name it (see kill_key).
    Never raises for a child that crashes, hangs or floods its output: those are all
    reported through the Result instead.
    """
    key = str(key or "")
    t0 = time.time()
    res = Result()
    proc = None
    try:
        proc = _popen(cmd, cwd, env)
    except Exception as e:
        res.stderr = "Could not start Python: %s" % e
        res.returncode = -1
        res.secs = time.time() - t0
        return res

    out_sink, err_sink = _Sink(max_output, tail_bytes), _Sink(max_output, tail_bytes)
    readers = [threading.Thread(target=out_sink.pump, args=(proc.stdout,), daemon=True),
               threading.Thread(target=err_sink.pump, args=(proc.stderr,), daemon=True)]
    for t in readers:
        t.start()
    threading.Thread(target=_feed, args=(proc, input_text), daemon=True).start()

    with _LOCK:
        _ACTIVE.add((key, proc))
        # Stop may arrive while this request is still on its way to the server. In that
        # case its run id is remembered, so the run is stopped the moment it starts.
        early_stop = bool(key) and key in _STOPPED_KEYS
        if early_stop:
            try:
                _STOPPED_KEYS.remove(key)
            except ValueError:
                pass
    if early_stop:
        with _LOCK:
            _STOPPED.add(proc.pid)
        kill_tree(proc)
    try:
        try:
            proc.wait(timeout=max(0.1, float(timeout)))
        except subprocess.TimeoutExpired:
            res.timed_out = True
            kill_tree(proc)
        except Exception as e:
            res.stderr = "The runner could not be watched: %s" % e
            kill_tree(proc)
    finally:
        with _LOCK:
            _ACTIVE.discard((key, proc))
            if proc.pid in _STOPPED:
                res.stopped = True
                _STOPPED.discard(proc.pid)

    for t in readers:
        t.join(3.0)
    for pipe in (proc.stdout, proc.stderr):
        try:
            if pipe:
                pipe.close()
        except Exception:
            pass

    res.returncode = proc.returncode
    res.stdout, res.truncated = out_sink.text()
    res.stderr, err_cut = err_sink.text()
    res.truncated = res.truncated or err_cut
    res.bytes_out, res.bytes_err = out_sink.total, err_sink.total
    res.secs = time.time() - t0
    if res.stopped:
        res.timed_out = False
    return res


def kill_all():
    """Kill every child this server is currently running. Returns how many were asked."""
    with _LOCK:
        procs = [p for _k, p in _ACTIVE]
    for p in procs:
        with _LOCK:
            _STOPPED.add(p.pid)
        kill_tree(p)
    return len(procs)


def kill_key(key):
    """Stop the run with this id, even if its request has not reached the server yet.

    Returns how many running children were killed (0 is fine: the run id is remembered
    and the run is stopped as soon as it starts).
    """
    key = str(key or "")
    if not key:
        return kill_all()
    with _LOCK:
        _STOPPED_KEYS.append(key)
        procs = [p for k, p in _ACTIVE if k == key]
    for p in procs:
        with _LOCK:
            _STOPPED.add(p.pid)
        kill_tree(p)
    return len(procs)


def active_count():
    with _LOCK:
        return len(_ACTIVE)
