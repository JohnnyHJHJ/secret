# Local Judge

A local Python judge and lesson reader, now called **Local Judge**. It is a local web app shown in an app-style Microsoft Edge / Chrome window
(no address bar, no tabs). Python only needs the standard library.

The first screen is a **Home** desktop: streak, last lessons/problems, sync status, and a link to the manual. Press **F1** for the manual at any time.

## Run it

Copy everything here into your Local Judge folder (replace `judge.py`, `README.md`, `runjudge.bat`).
Your `lessons/`, `modules/`, `user_code/`, `progress.json`, `lessons_state.json` and `config.json` keep working.
You can delete the old `common.py`, `judge_tab.py` and `lessons_tab.py`.

Run it with `runjudge.bat` (or `python judge.py`).

## Taskbar icon

1. Double-click `install.bat`. It puts a **Local Judge** shortcut (with the icon) on your Desktop and in the Start menu.
2. Open the Start menu, search `Local Judge`, right-click, **Pin to taskbar**.

## Streaks (Ctrl+6) and Big-O

* **Streaks** screen: flame counter, calendar, daily goal, level/XP and badges. A day counts when you Run, Check, run a lesson exercise or use Big-O.
  One day off is fine; **two days in a row without coding resets the streak**. You get **3 restores a month** (one restore covers up to 3 missed days, within 7 days of the slip).
  Data lives in `streaks.json` and is merged by Sync, so it follows you between computers.
* **Big-O** button in the Judge (Complexity tab): times your function on growing inputs and estimates O(1), O(log n), O(n), O(n log n), O(n²), O(n³) or O(2^n).
  It stretches the problem's largest test automatically. To control the inputs, define `def make_input(n): return (arg1, arg2)` in your code.
  It is a rough estimate, not a proof. Code using `lru_cache` is measured with the cache cleared.

## Screens (Ctrl+1 to Ctrl+7)

* **Home** (`Ctrl+1`): a Y2K-style desktop with the current streak, recent lessons and problems, sync status, and the manual. **START** opens a menu of every screen.
* **Lessons** (`Ctrl+2`): same lesson files and activities as before, with roomier text. Hints are black bars you click.
* **Judge** (`Ctrl+3`): same problems, hidden tests and best-score saving.
  **Run** (Ctrl+Enter) runs your code without checking and shows what it prints; there is an Input box for `input()`.
  **Check answer** (Ctrl+Shift+Enter) runs the hidden tests.
  **Stop** appears while something is running, so an accidental infinite loop (even one that prints in a loop) is
  ended immediately instead of freezing the app.
* **Collection** (`Ctrl+4`): folders, pins, hidden items and the file-manager view.
* **Library** (`Ctrl+5`): lessons and problems other students shared, grouped by folder (a lesson course or a problem module). **Add folder** adds everything in it; open a folder to add single files. New ones show a badge and a notification after a sync.
  Press **Add** to put one in your collection or **Not now** to skip it. Skipped items stay listed, so you can add them later.
* **Streaks** (`Ctrl+6`): streak calendar, daily goal, level/XP and badges.
* **Manual** (`Ctrl+7` or `F1`): the first-time guide. Search it, print it, or jump to a section.
* **Settings**: name, sync address, theme, text and editor size, layout import/export and AI prompts.

## The code editor

Syntax colors, line numbers, auto-closing `() [] {} "" ''` (typing the closing character just moves past it),
Backspace deletes an empty pair, selecting text and typing a bracket or quote wraps it, auto-indent after `:`,
Enter between brackets opens a block, Tab / Shift+Tab, Backspace removes 4 spaces of indent,
`Ctrl+/` comment, `Ctrl+D` duplicate line, `Alt+Up/Down` move line, `Ctrl+Shift+K` delete line, normal undo/redo.

**Predicting the next word (Sublime-style completion)**: while you type a word, a small popup lists Python
keywords, built-ins, common snippets (`print()`, `def `, `for `, …) and the words already used in the file,
best match first. The highlighted entry is inserted with **Tab** or **Enter**; **↑ / ↓** choose, **Esc** closes,
**Ctrl+Space** asks for the list by hand. The top match is also drawn as faint, dashed text after the cursor, so
Tab can accept it without reading the list.

## Online sync (Google Drive)

Google does not let an app write to a shared Drive folder without a login, so the folder owner sets up a small script once:

1. Go to https://script.google.com, **New project**, paste in `drive_sync.gs` (the folder is already filled in).
2. **Deploy, New deployment, Web app**. Execute as **Me**, access **Anyone**. Authorize it, then copy the address ending in `/exec`.
3. Give that address to everyone. Each student enters their **name** on first start and pastes the address (Settings, or the first screen).

Each sync (automatic at start, or the Sync button):

1. Merges your saved progress with `Progress/<your name>/` in the Drive folder (best score wins, finished activities are combined) and saves it back. Using the same name on a new computer restores your progress.
2. Saves your last and recent lessons/problems with the same bundle, so Home follows you between computers.
3. Shares any lesson or problem you have that the `Library/` folder does not have yet.
4. Lists library items you do not have, and notifies you when there are new ones.

Notes: the address is not secret-protected unless you set `SECRET` in the script (then enter the same secret in Settings).
Anyone with the address can read and add library items, so share it only with your class.

## Files

`judge.py` launcher, `server.py` local API, `streaks.py` / `tracking.py` streak logic, `bigo.py` complexity detector, `judge_core.py` your original grading code, `lesson_engine.py` unchanged,
`safeexec.py` the bounded, killable subprocess runner used for all learner code, `sync.py` Drive sync, `drive_sync.gs` the Google script, `web/` the interface, `icon.ico` / `icon.png`, `make_icon.py` redraws the icon.
`validate_lessons.py` works as before.

## Hiding the menu

Press **Ctrl+B** or the **Hide** button at the bottom of the left bar to hide the left bar and the lesson/problem list.
A small tab on the left edge brings them back. The choice is remembered.

## What is new in this version

* **Safer running**: an accidental infinite loop (even one that keeps printing) can no longer crash the app or make
  the page fail with "Failed to fetch". Output is capped, the whole process tree is killed at the deadline, checks
  are capped at 30 seconds, a **Stop** button ends a run at once, and losing the local server shows a clear banner
  with a Reload button instead of a bare network error. The server also stays alive across a window reload or a
  laptop sleep instead of shutting itself down.
* **Predictive typing**: Sublime-style word completion and inline next-word prediction in every code editor
  (see the code editor section above).
* **New name: Local Judge.** The window, shortcuts, rail and manual now use this name. Existing data files keep working.
* **Home desktop** (`Ctrl+1`): the dashboard windows (streak, recent lessons/problems, sync, manual) on a nostalgic wallpaper, with the left sidebar staying available.
* **Manual** (`Ctrl+7` or `F1`): a searchable first-time guide covering every screen, shortcuts, Drive sync, data files and adding content. It can be printed.
* **Notifications**: new lessons/problems in the Library, overdue sync reminders, and badges now appear at the top right with an action button.
* **Synced activity**: the last and recent lessons/problems travel with progress, answers, streaks and folder layout.
* **Streaks, calmer**: the dashboard now fits the streak and level in one banner, a roomy calendar, today's goal and restores beside it, and badges split into earned tiles plus a quiet "still locked" list. A new badge shows a top-right desktop notification; click it to open Streaks.
* **Sublime-style editor**: Mariana colors, italic `def`/`self`, indent guides, matching-bracket highlight, current-line highlight.
  Sublime shortcuts: `Ctrl+D` select word / next match, `Ctrl+Shift+D` duplicate line, `Ctrl+L` select line, `Ctrl+Shift+K` delete line,
  `Alt+Up/Down` or `Ctrl+Shift+Up/Down` move line.
* **List panel**: click the icon of the screen you are on (or press `Ctrl+B`) to hide or show the list; drag its right edge to resize (double-click resets).
  The Lessons / Judge / Collection / Library icons always stay.
* **Collection** screen (`Ctrl+4`): make your own folders (inside folders too), drag lessons or problems into them, **Move**, **Hide** and **Unhide**.
  Hidden items disappear from the side lists but stay in the Collection. Deleting a folder never deletes lessons.
  Saved in `organize.json`.
* **Settings > Ask another AI**: copy ready-made prompts for new lessons, new problems, and changing the colors (`prompts/` folder).
  The lesson prompt now asks for a step-by-step walkthrough (naive attempt, decision points, annotated code, faded practice), and the problem prompt asks for story-first problems with an Algorithm Corner and tiered scoring.
* **Colors** all live in `web/themes.css` (+ `web/themes.js`), so an AI can restyle the app by editing just those two files.
