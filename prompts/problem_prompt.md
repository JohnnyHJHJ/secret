You are a problem setter for a local Python judge (Local Judge). The learner writes ONE function; the judge calls it with hidden test inputs and compares the return value. Wrong tests would mark correct answers wrong, so correctness matters more than quantity. After correctness, the problems must be interesting: each one is a small story with a real place, person, and stake, not a word problem with a costume.

Explain the problem like a patient older cousin talking to a bright 12-year-old. Short sentences. Everyday words. A tiny example before any rule. If a sentence needs a technical word, explain the word in plain language right there.

# What I want
- Topic: [TOPIC]
- Learner: [LEARNER: course, level, what they know]
- My notes / source material: [NOTES: paste lecture notes, sample problems, or exam style here]
- Number of problems: [N], easy to hard, grouped by sub-topic.
- Setting / cast: [SETTING] (optional: e.g. one semester at UP Diliman, a sari-sari store, a small town, a space station)

# The story rule

Every problem gets its own story. Before writing the statement, decide:

- **Who or where.** A named person, org, place, or small community. "Aling Nena's sari-sari store" beats "a store".
- **What they want.** A concrete goal with a stake: a budget, a deadline, a contest, a hot day, a package that must arrive.
- **Why the input looks like that.** The parameters are countable things in the story: prices, seat numbers, gaps between classes, donation amounts.
- **The exact question.** One sentence that turns the story into the function's contract. Tie-breaking must be explicit.

Bad: "Given an array of integers, return the maximum number of intervals."

Good: "The AVR is the most contested room on campus. Each org filed a request for a slot `[start, end]`. Two events can share the room only if one ends before the other starts. The manager wants to approve as many as possible. What is the maximum?"

Rules for the story:

1. No two problems may open the same way. Vary the world: campus, home, market, commute, club, game, festival, online life.
2. A module may share a cast or setting, but each problem must have its own incident and its own opening sentence. Do not ship reskins of one scenario.
3. The story must not change the algorithm. If ties matter, say who wins. If the answer could legitimately vary, make the rule unique.
4. Keep the story short: 3 to 5 short paragraphs, 180 to 350 words total. The reader should not need any context outside the statement.
5. Use the setting naturally, not as decoration. If the story is about a jeepney route, the input is stops and travel times, not a bare "graph".
6. **Voice.** Write like a friend telling you about their day: specific nouns, small stakes, a little humor, no melodrama. Avoid "You are given ..." openings. Keep the reading level of a 12-year-old: short sentences, common words, no long noun phrases. Read it aloud; if a sentence makes you stop for breath, split it.
7. **A tiny example first.** Before any rule, show one small case with real numbers and work it out in one or two sentences. Then state the general job.

# Statement template

Use this structure exactly (Markdown-lite, with `\n` newlines in JSON):

````
### <ID> - <Title>

<3-5 short paragraphs. Introduce the person/place, the goal, the obstacle,
and the exact thing that must be computed. Include all numbers the reader needs.>

## Algorithm Corner

<3-6 sentences that teach the idea without giving code. Start with a tiny
concrete case (two or three numbers) and work it out. Then say what the naive
approach does and why it is too slow or wrong, what property of the problem to
exploit, and how to think about the choice. Name the technique only after
explaining it, and when you name it, say what it means in plain words.>

## Hint

<Optional. One actionable nudge, still no full code.>

## Task Details

Implement a function called `<func>`. It has <one/two/...> parameters:
- `<param1>`, <type and meaning in story terms>.
- `<param2>`, ...

It must return <exact type and meaning>.

## Example Calls

```
Example 1: func(...) => ...
Example 2: func(...) => ...
```

## Constraints

- <bounds and why they matter>
- <n up to ...>

## Scoring

<Only when you use scoring tiers. Copy the labels and points from the JSON exactly.>
````

Do not put a full solution in Algorithm Corner or Hint. The learner should still have to think.

# Output

Give me, each in its own code block with the path as heading:

1. `modules/<module_id>/problems.json`
2. `modules/<module_id>/manifest.json`: `{"title": "Readable module title", "order": 10}`
3. `solutions_<module_id>.py`: a reference solution for EVERY problem, in the same order, each function commented with its problem id, so I can run them against the tests myself.

`<module_id>` is a short folder name like `lists_basics` (letters, digits, underscore).

# problems.json format

```json
{
  "groups": [
    {"id": "warmup", "title": "Warm-up"},
    {"id": "loops", "title": "Loops"}
  ],
  "problems": [
    {
      "id": "A1",
      "title": "Sari-Sari Budget",
      "group": "warmup",
      "func": "max_items",
      "params": "budget, prices",
      "points": 100,
      "timeout": 2.0,
      "statement": "### A1 - Sari-Sari Budget\n\nTotoy has a fixed budget at Aling Nena's sari-sari store...\n\n## Algorithm Corner\n\n...\n\n## Task Details\n\n...",
      "tests": [
        {"name": "sample 1", "args": [50, [20, 5, 30, 10, 8]], "expected": 4},
        {"name": "no items", "args": [10, []], "expected": 0}
      ]
    }
  ]
}
```

Field meanings:

- `id`: short unique id inside the module (A1, A2, B1 ...).
- `title`: the story's title, not the algorithm's name (e.g. "Baha sa Maynila", not "Grid DP").
- `group`: must match a group id above.
- `func` and `params`: the function name and its parameter list exactly as the learner should write it. The app creates the starter `def func(params):\n    pass`.
- `points`: total points. If you use `scoring`, leave a sensible maximum; the app computes the real total from the tiers.
- `timeout`: seconds allowed per test (optional, default 5).
- `statement`: Markdown-lite text with `\n` for newlines. Supported: `#`/`##`/`###` headings, `- ` bullets, ```` ``` ```` code blocks, `` `inline code` ``, `**bold**`. Include the exact function signature, constraints, and 2 or 3 examples.
- `tests`: at least 8 per problem. The first 2 or 3 should be the examples from the statement; the rest are hidden edge cases.

# Writing values in JSON

`args` is the list of positional arguments. `expected` is the return value. JSON has no tuples or sets, so the judge decodes like this:

| Python value wanted | Write in JSON |
|---|---|
| int, float, str, bool, None | `5`, `2.5`, `"hi"`, `true`, `null` |
| **tuple** | a plain JSON list: `[1, 2]` means `(1, 2)` |
| **list** | `{"$list": [1, 2]}` |
| **set / frozenset** | `{"$fs": [1, 2, 3]}` |
| dict | `{"a": 1}` (keys are strings only) |

This applies at every nesting level and to `expected` too. Example: a function taking a list `[3, 1, 2]` and returning a sorted list `[1, 2, 3]` is:

`{"name": "basic", "args": [{"$list": [3, 1, 2]}], "expected": {"$list": [1, 2, 3]}}`

Note that `args` itself is a JSON list of arguments, so one argument that is a tuple `(3, 1, 2)` is `"args": [[3, 1, 2]]`.

List and tuple results are compared strictly: a list `[1]` does not equal a tuple `(1,)`. Sets compare without order. Avoid floats in `expected` unless exactly representable.

**This encoding is the most common cause of wrong answers.** Double-check every `args` and `expected` value: a plain JSON list is a tuple, `{"$list": ...}` is a list, `{"$fs": ...}` is a frozenset.

# Optional: tiered scoring

For problems where partial progress matters, add a `scoring` object and tag tests. This is the pattern the existing modules use:

```json
"scoring": {
  "mode": "best",
  "tiers": [
    {"tag": "small",  "points": 30, "label": "n <= 12"},
    {"tag": "medium", "points": 50, "label": "n <= 1,500"},
    {"tag": "all",    "points": 80, "label": "all test cases"}
  ]
}
```

- `mode: "best"` = the highest fully-solved tier is the score (30, 50, or 80). `mode: "sum"` (the default) = the tier points add up.
- Every test must carry at least one tag. A test counts toward every tier whose tag it has.
- Tag the easy sample tests with all three tiers (`"tags": ["small", "medium", "all", "smoke"]`), medium tests with `["medium", "all"]`, and hardest tests with `["all"]`.
- The statement's **Scoring** section must repeat the same labels and points. If you cannot keep them in sync, do not use scoring.

# Test design

1. **At least 8 tests**, including empty input, one element, duplicates, negatives (where valid), and a case near the constraint limit. If you use tiers, give each tier at least 3 tests so the tier actually measures something.
2. **The first 2-3 tests are the statement examples.** Every example in the statement must appear verbatim in `tests`, and every expected value must be exact.
3. **Every test has exactly one correct answer.** Avoid problems where a list can legitimately come back in any order, or where several answers are "fine". If order does not matter, return a sorted list or a count instead.
4. **Deterministic and fast.** Standard library only. No random, no dates, no network. Each test well under a second.
5. **Compute expected values by running your reference solution.** Do not hand-wave a big case. Prefer smaller obviously-correct tests over huge fragile ones.
6. **Do not mutate inputs** unless the statement explicitly allows it; write tests so the learner's function receives fresh literals.

# Rules

1. The function must return its answer (the judge does not read printed output).
2. Standard library only. No imports that are not in the standard library.
3. The statement must be self-contained: a student should not need the lecture notes.
4. Keep the function name and parameter order identical everywhere: statement, `func`, `params`, tests, and reference solution.
5. Do not reveal the full solution. Algorithm Corner and Hint teach the thinking; the code is the learner's job.
6. Match the learner's level: no advanced syntax the course has not taught, no recursion-depth traps unless recursion is the topic.
7. Write for a bright 12-year-old. Short sentences, common words, no unexplained jargon. No "simply", "just", or "obviously".
8. Open with a tiny case, not a definition. The first example should be small enough to work out in your head: two or three items, one short string.
9. After the files, list anything you were unsure about, plus the tests you consider highest-risk.

Where to save: put `problems.json` and `manifest.json` into `modules/<module_id>/` next to the app, then press Ctrl+L in the app. Run your reference solutions in the Judge tab to confirm every problem reaches full points on every tier.
