# Lesson authoring brief (internal, not a lesson)

Read `prompts/lesson_prompt.md` first. It is the full contract. This file adds
the format reminders and the validator details for this batch.

## Who is reading

A bright 12-year-old who has written a few short Python programs. Explain like a
patient older cousin at the kitchen table. Short sentences, common words, one
idea per paragraph. Define every technical word the first time it appears.

## How each lesson must start

The first screen is **not** a definition and **not** the name of a technique. It
is a two- or three-sentence story plus the smallest runnable example:

- one item, two items, three numbers, a 2×2 grid, a four-letter word;
- the code prints something the learner can see;
- then change one thing and show what happens;
- then the first attempt and what breaks;
- only then name the idea.

Bad: "Duck typing means the type of an object is less important than its methods."

Good: "Ben has the scores `[7, 9, 4]`. `scores[0]` gives 7. Then his friend hands
him `[]`. What does `scores[0]` do now?"

## Ladder for every lesson

tiny case -> one change -> predict -> first attempt -> what breaks -> better
attempt -> name the idea -> slightly bigger case -> edge case -> fill/exercise ->
recap. Do not skip the middle. Do not jump to a 100-element input.

## Size

- 3 to 6 lesson files per course. This batch uses 4 (3 for Lecture 21).
- 1,000–1,700 words of prose per lesson (code excluded).
- `minutes: 10` to `minutes: 20`.
- At least 6 activities: 1 quiz, 1 predict, 2 exercises, plus a fill or try.
- Every exercise: 2–3 hints (nudge -> stronger -> answer) and one `explain`.
- Every lesson: 3 decision points, a warning/danger box, a recap table or
  checklist, 2–3 hidden self-check answers (`||like this||`), and a next sentence.

## Voice rules

- No "simply", "just", "obviously".
- No unexplained jargon. Do not use these words until the example has shown the
  idea and you have explained it plainly: abstraction, invariant, decomposition,
  asymptotic, data structure, represent, generic, polymorphic, trade-off,
  memoization, duck typing.
- Name people and small concrete things. One running example per lesson.
- Problems start with a tiny story and one job. Show an example call before
  constraints. Hints use the same plain voice.

## Format (exact)

Front matter:

```
---
title: Lesson title
summary: One sentence saying what the learner will be able to do.
minutes: 15
---
```

Do not repeat the title as an `#` heading. Start with `:::goal`.

Callouts use 3 colons. Activities use 4 colons so they can contain 3-colon
`hint` / `explain` blocks. Close with the same number of colons.

```
::::exercise e1
Write `double(x)` that returns twice `x`.

```python starter
def double(x):
    return x
```

```python solution
def double(x):
    return 2 * x
```

```python tests
check(lambda: double(2), 4, "double(2)")
check(lambda: double(-3), -6, "negative")
check(lambda: double(0), 0, "zero")
```

:::hint
Multiply `x` by 2. Notice what the starter returns instead.
:::

:::explain
`return x` hands back the input unchanged, so `double(2)` gives 2.
`return 2 * x` gives 4.
:::
::::
```

Activity ids are unique inside the lesson: `q1`, `q2`, `p1`, `f1`, `e1`, `e2`,
`t1`. A quiz needs at least 3 options and a correct `[x]`. A predict needs a
`python` block and a `text answer` block with exactly the printed output. A fill
needs `[[answer]]` markers; with the first choice in every blank the code must
compile.

Never put a line containing only `:::` inside a code block. Unknown block names
and unclosed blocks are errors. Leave a blank line before and after lists,
tables, fences and callouts.

## Validate

```
$env:PYTHONUTF8='1'
python -X utf8 validate_lessons.py lessons/<your_folder>
```

It runs every `predict` (output must match), every `solution` (must pass), every
`starter` (must fail), and compiles every `fill`. The output must end with
`All lessons OK.` and no `ERROR:` lines. Fix everything yourself before you
report.

## Accuracy

Standard library only. No `random`, no dates or times, no wall-clock timing in
tests. Every code block must run. If a slide has a bug, teach a corrected version
and note the deviation in your report.
