"""
Local Judge: Python practice & lessons

    python judge.py              open the app
    python judge.py --install    create Desktop + Start menu shortcuts (Windows) you can pin to the taskbar

The interface runs in an app-style window of Microsoft Edge or Google Chrome (no address bar,
no tabs), served by a small local server. Closing the window stops the server.
Nothing needs to be installed besides Python.
"""
import os
import sys
import time
import socket
import secrets
import shutil
import threading
import subprocess
import webbrowser

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)
ICON = os.path.join(BASE_DIR, "icon.ico")
PROFILE = os.path.join(BASE_DIR, ".app_profile")      # keeps the app window's size/position separate from your browser


def find_browser():
    cands = []
    if sys.platform == "win32":
        for env in ("ProgramFiles(x86)", "ProgramFiles", "LocalAppData"):
            root = os.environ.get(env)
            if root:
                cands += [os.path.join(root, "Microsoft", "Edge", "Application", "msedge.exe"),
                          os.path.join(root, "Google", "Chrome", "Application", "chrome.exe"),
                          os.path.join(root, "BraveSoftware", "Brave-Browser", "Application", "brave.exe")]
    elif sys.platform == "darwin":
        for n in ("Microsoft Edge", "Google Chrome", "Brave Browser", "Chromium"):
            cands.append(f"/Applications/{n}.app/Contents/MacOS/{n}")
    for n in ("microsoft-edge", "google-chrome", "chromium", "chromium-browser", "brave-browser"):
        w = shutil.which(n)
        if w:
            cands.append(w)
    return next((c for c in cands if os.path.isfile(c)), None)


PREFERRED_PORT = 47613     # a fixed port keeps the window's taskbar identity (and icon) the same on every launch


def free_port():
    for want in (PREFERRED_PORT, 0):      # fall back to any free port if the fixed one is busy (e.g. the app is already open)
        s = socket.socket()
        try:
            s.bind(("127.0.0.1", want))
            return s.getsockname()[1]
        except OSError:
            continue
        finally:
            s.close()


def open_window(url):
    """Open the app window. Returns the browser process (or None when we fall back to webbrowser)."""
    exe = find_browser()
    if not exe:
        webbrowser.open(url)
        return None
    os.makedirs(PROFILE, exist_ok=True)
    return subprocess.Popen([exe, f"--app={url}", f"--user-data-dir={PROFILE}", "--window-size=1360,880",
                             "--no-first-run", "--no-default-browser-check", "--disable-features=Translate,msEdgeShopping"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def main():
    import server
    port = free_port()
    srv = server.Server(port, secrets.token_urlsafe(24))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    browser = open_window(f"http://127.0.0.1:{port}/")
    # Stay alive while the window is open, even across a laptop sleep: the page pings
    # every 6 s, and shutting down because a ping was late used to leave the window
    # showing "Failed to fetch" with no way to run code again.
    idle_limit = 24 * 3600
    quiet_limit = 3600 if browser is None else 12   # browser process gone and no ping for a while
    while True:
        time.sleep(0.5)
        now = time.time()
        quiet = now - srv.last_ping
        # Closing the window sends /api/bye. Give a reload a moment: the new page
        # pings right away and cancels the goodbye, so refreshing never kills the app.
        if srv.bye_at and now - srv.bye_at > 12 and quiet > 8:
            break
        if browser is not None and browser.poll() is not None and quiet > quiet_limit:
            break
        if quiet > idle_limit:
            break
    try:                                                  # never leave a runaway program behind
        server.SD.kill_all()
    except Exception:
        pass
    try:                                                  # last sync on the way out, so streaks and layout changes are not left behind
        if server.DIRTY["on"] and server.M.cfg.get("sync_url") and server.M.cfg.get("name"):
            server.do_sync()
    except Exception:
        pass
    srv.shutdown()


# ----------------------------------------------------------------------------- shortcuts
def install_shortcuts():
    if sys.platform != "win32":
        print("Shortcut creation is only built in for Windows. On other systems run: python judge.py")
        return 1
    exe = sys.executable
    pyw = os.path.join(os.path.dirname(exe), "pythonw.exe")
    target = pyw if os.path.isfile(pyw) else exe
    script = os.path.join(BASE_DIR, "judge.py")
    ps = r'''
$ws = New-Object -ComObject WScript.Shell
$dirs = @([Environment]::GetFolderPath('Desktop'), (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'))
foreach ($d in $dirs) {
  $s = $ws.CreateShortcut((Join-Path $d 'Local Judge.lnk'))
  $s.TargetPath = '%s'
  $s.Arguments = '"%s"'
  $s.WorkingDirectory = '%s'
  $s.IconLocation = '%s,0'
  $s.Description = 'Local Judge - Python practice and lessons'
  $s.Save()
  Write-Host ('Created ' + (Join-Path $d 'Local Judge.lnk'))
}
''' % (target, script, BASE_DIR, ICON)
    r = subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps])
    if r.returncode == 0:
        print("\nTo pin: open the Start menu, search 'Local Judge', right-click it, choose 'Pin to taskbar'.")
    return r.returncode


if __name__ == "__main__":
    if "--install" in sys.argv:
        sys.exit(install_shortcuts())
    main()
