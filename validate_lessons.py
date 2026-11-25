"""
Check lesson files before you study them.

    python validate_lessons.py                 # every lesson in lessons/
    python validate_lessons.py lessons/my_course
    python validate_lessons.py path/to/one_lesson.md

For every lesson this:
  * parses it and reports format problems,
  * RUNS every exercise's solution against its tests (the solution must pass),
  * checks that every starter does NOT already pass,
  * checks that every 'predict' answer matches what the code really prints.

Exit code is 0 when everything is fine. Paste any errors back to the AI that
wrote the lesson and ask it to fix them.
"""
import os
import sys

import lesson_engine as LE

BASE = os.path.dirname(os.path.abspath(__file__))


def collect(paths):
    files = []
    for p in paths:
        if os.path.isdir(p):
            for root, dirs, fs in os.walk(p):
                dirs[:] = [d for d in dirs if not d.startswith((".", "_"))]
                for f in sorted(fs):
                    if f.lower().endswith(".md") and not f.startswith("_") and f.lower() != "readme.md":
                        files.append(os.path.join(root, f))
        elif os.path.isfile(p):
            files.append(p)
        else:
            print(f"?? not found: {p}")
    return files


def main(argv):
    try:                       # redirected output on Windows is cp1252 by default; the tick marks are not
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    paths = argv or [os.path.join(BASE, "lessons")]
    files = collect(paths)
    if not files:
        print("No lesson files found.")
        return 1
    bad = 0
    for fp in files:
        rel = os.path.relpath(fp, BASE)
        try:
            with open(fp, "r", encoding="utf-8") as f:
                lesson = LE.parse_lesson_text(f.read(), rel, fp)
        except Exception as e:
            print(f"✗ {rel}\n    cannot read: {e}")
            bad += 1
            continue
        errors, notes = LE.validate_lesson(lesson)
        n = len(lesson["activities"])
        if errors:
            bad += 1
            print(f"✗ {rel}  ({n} activities)")
            for e in errors:
                print("    ERROR:", e)
        else:
            print(f"✓ {rel}  ({n} activities)")
        for note in notes:
            print("    note:", note)
    print()
    print("All lessons OK." if not bad else f"{bad} lesson file(s) have errors.")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
