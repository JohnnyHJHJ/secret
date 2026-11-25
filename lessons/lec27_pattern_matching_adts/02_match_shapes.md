---
title: Matching the Shape of Data
summary: Use match with lists, tuples, constants and star patterns to check a shape and name its parts in one step.
minutes: 35
---

# Matching the Shape of Data

:::goal What you will be able to do
- Write patterns that look like lists and tuples.
- Use `*rest` to match "one or more items".
- Put constants such as `"quit"` inside a pattern.
- Write a recursive function with `match`.
:::

Patterns can look like the **shape** of the data. The pattern `[a, b]` means "a sequence with exactly two items, call them `a` and `b`". It checks the shape **and** names the parts at the same time.

| Pattern | Matches when... |
|---|---|
| `[]` | the sequence is empty |
| `[value]` | it has exactly 1 item (stored in `value`) |
| `[first, *rest]` | it has 1 or more items: the first goes in `first`, the others go in the list `rest` |

:::try t-seq
Run it. Then add `describe([1, 2, 3, 4, 5])` and `describe((7, 8))` at the bottom and predict the output first.

```python starter
def describe(seq):
    match seq:
        case []:
            print("empty")
        case [x]:
            print("one item:", x)
        case [x, y]:
            print("two items:", x, y)
        case [first, *rest]:
            print("first is", first, "and", len(rest), "more")

describe([])
describe([9])
describe([4, 5])
describe([1, 2, 3])
```
:::

Cases are checked in order. By the time Python reaches `[first, *rest]` in a function that already handled `[]` and `[value]`, it knows the list has at least 2 items.

::::predict p-foo
What does this print?

```python
def foo(seq):
    match seq:
        case []:
            return None
        case [value]:
            return value
        case [first, *rest]:
            return first + 2 * foo(rest)

print(foo([4]))
print(foo([1, 2, 3]))
print(foo([]))
```
```text answer
4
17
None
```
:::hint
Work from the end of the list: `foo([3])` is just `3`.
:::
:::hint
`foo([2, 3])` is `2 + 2 * foo([3])`.
:::
:::hint
`foo([2, 3])` is `8`, so `foo([1, 2, 3])` is `1 + 2 * 8`.
:::
:::explain
The recursion peels off `first` each time and stops at a list with one item (or none). `foo([1, 2, 3])` is `1 + 2 * (2 + 2 * 3)`, which is `17`.
:::
::::

::::quiz q-shape
Which pattern matches a list with **exactly three** items?

- [ ] `[a, *rest]`
- [ ] `[a, b]`
- [x] `[a, b, c]`
- [ ] `[a, b, *rest]`
:::hint
Count the names. `*rest` can absorb any number of items, so it is not "exactly".
:::
:::hint
You want three plain names and no star.
:::
:::explain
`[a, b, c]` has three slots and no star, so it needs exactly three items. `[a, b, *rest]` needs **at least** two.
:::
::::

## Constants inside patterns

A pattern can hold fixed values such as `"quit"` or `0`. These must match exactly. This is perfect for reading text commands.

:::try t-commands
Run it. Then change the command to `"go north"`, `"drop a b c"` and `"jump"`.

```python starter
command = "get sword"
match command.split():
    case ["quit"]:
        print("Goodbye!")
    case ["look"]:
        print("You look around.")
    case ["get", obj]:
        print("You pick up the", obj)
    case ["go", direction]:
        print("You walk", direction)
    case ["drop", *objects]:
        print("You drop", len(objects), "things")
```
:::

::::fill f-command
```python
def command(words):
    match words:
        case ["quit"]:
            return "bye"
        case ["go", [[direction]] ]:
            return "moving " + direction
        case ["drop", *[[items]] ]:
            return "dropping " + str(len(items))
        case [[_]]:
            return "unknown"
```
:::hint
The captured name is used in the line below the case.
:::
:::hint
`direction` goes after `"go"`; a star pattern needs a name such as `items`.
:::
:::hint
The catch-all is `_`.
:::
::::

::::exercise ex-describe kind=write
Write `describe(cmd)` using `match`. `cmd` is a list of words.

- `["hello"]` returns `"greeting"`.
- `["add", a, b]` returns the text `"adding a and b"` with the real values, for example `"adding 2 and 3"`.
- Anything else returns `"unknown"`.

```python starter
def describe(cmd):
    pass
```
```python tests
check(lambda: describe(["hello"]), "greeting", "hello")
check(lambda: describe(["add", 2, 3]), "adding 2 and 3", "add 2 3")
check(lambda: describe(["add", "x", "y"]), "adding x and y", "add with names")
check(lambda: describe(["add", 2]), "unknown", "add needs two numbers")
check(lambda: describe([]), "unknown", "empty list")
check(lambda: describe(["hello", "there"]), "unknown", "hello with extra word")
check(uses('Match'), True, "uses a match statement")
```
```python solution
def describe(cmd):
    match cmd:
        case ["hello"]:
            return "greeting"
        case ["add", a, b]:
            return f"adding {a} and {b}"
        case _:
            return "unknown"
```
:::hint
You need three cases: hello, add, and a catch-all.
:::
:::hint
The pattern for add has a constant and two captures: `["add", a, b]`.
:::
:::hint
Use an f-string: `f"adding {a} and {b}"`. End with `case _:`.
:::
:::explain
`["hello"]` fits only a one-item list equal to `"hello"`. `["add", a, b]` fits exactly three items and captures the last two. Everything else falls to `_`.
:::
::::

::::predict p-strings
What does this print?

```python
def f(x):
    match x:
        case []:
            return "empty"
        case [a]:
            return f"one: {a}"
        case [a, *rest]:
            return f"many, first={a}"
        case _:
            return "other"

print(f([5]))
print(f([]))
print(f([1, 2, 3]))
print(f("hi"))
print(f((7,)))
```
```text answer
one: 5
empty
many, first=1
other
one: 7
```
:::hint
A tuple counts as a sequence, just like a list.
:::
:::hint
A plain string is the exception: `match` does **not** treat a `str` as a sequence.
:::
:::explain
`"hi"` does not fit any sequence pattern, so it reaches `_`. The tuple `(7,)` has one item, so it fits `[a]`.
:::
::::

::::exercise ex-debug-order2 kind=debug
`classify(seq)` should return `None` for an empty list, `("one", value)` for a one-item list, and `("many", first)` for longer lists. The one-item case is wrong. Fix it.

```python starter
def classify(seq):
    match seq:
        case []:
            return None
        case [first, *rest]:
            return ("many", first)
        case [value]:
            return ("one", value)
```
```python tests
check(lambda: classify([]), None, "empty list")
check(lambda: classify([7]), ("one", 7), "one item")
check(lambda: classify([1, 2, 3]), ("many", 1), "three items")
check(lambda: classify([4, 5]), ("many", 4), "two items")
```
```python solution
def classify(seq):
    match seq:
        case []:
            return None
        case [value]:
            return ("one", value)
        case [first, *rest]:
            return ("many", first)
```
:::hint
`[first, *rest]` fits any list with one or more items.
:::
:::hint
So `[7]` already matches it, and `case [value]` is never reached.
:::
:::hint
Swap the order: the specific case first, the general case after it.
:::
:::explain
Specific patterns go first, general ones last. Here `[value]` is more specific than `[first, *rest]`, so it must come first.
:::
::::

## Tuples

Tuple patterns work the same way. Mix constants and captures to sort points into groups.

::::exercise ex-where kind=write
Write `where(point)` for an `(x, y)` tuple, using `match`:

- `(0, 0)` returns `"origin"`.
- `(0, y)` returns `"y-axis at 7"` (with the real `y`).
- `(x, 0)` returns `"x-axis at 4"` (with the real `x`).
- any other pair returns `"elsewhere"`.
- anything that is not a pair raises `ValueError`.

```python starter
def where(point):
    pass
```
```python tests
check(lambda: where((0, 0)), "origin", "(0, 0)")
check(lambda: where((0, 7)), "y-axis at 7", "(0, 7)")
check(lambda: where((4, 0)), "x-axis at 4", "(4, 0)")
check(lambda: where((3, 5)), "elsewhere", "(3, 5)")
check(lambda: where((-2, 0)), "x-axis at -2", "(-2, 0)")
check_raises(lambda: where(5), ValueError, "5 is not a pair")
check_raises(lambda: where((1, 2, 3)), ValueError, "three items is not a pair")
check(uses('Match'), True, "uses a match statement")
```
```python solution
def where(point):
    match point:
        case (0, 0):
            return "origin"
        case (0, y):
            return f"y-axis at {y}"
        case (x, 0):
            return f"x-axis at {x}"
        case (x, y):
            return "elsewhere"
        case _:
            raise ValueError("not a point")
```
:::hint
Check `(0, 0)` first, because `(0, y)` would also fit it.
:::
:::hint
The patterns are `(0, 0)`, `(0, y)`, `(x, 0)` and `(x, y)`, in that order. A final `_` handles non-pairs.
:::
:::hint
Use `raise ValueError("not a point")` in the `_` case.
:::
:::explain
The order goes from most specific to most general. `(x, y)` fits any pair, so it must come after the axis cases. A number or a 3-tuple fits none of the pair patterns and reaches `_`.
:::
::::

::::exercise ex-count kind=complete
Finish `count_items(seq)`, which counts items **recursively**. An empty sequence has 0 items. Otherwise it is 1 plus the count of the rest. Add the missing case using `_` for the first item (you do not need its value).

```python starter
def count_items(seq):
    match seq:
        case []:
            return 0
        # add the other case here
```
```python tests
check(lambda: count_items([]), 0, "empty")
check(lambda: count_items([5]), 1, "one item")
check(lambda: count_items([1, 2, 3, 4]), 4, "four items")
check(lambda: count_items((9, 9)), 2, "a tuple works too")
check(uses('Match'), True, "uses a match statement")
```
```python solution
def count_items(seq):
    match seq:
        case []:
            return 0
        case [_, *rest]:
            return 1 + count_items(rest)
```
:::hint
The second case must fit any non-empty sequence.
:::
:::hint
Use `[_, *rest]`: ignore the first item, capture the others.
:::
:::hint
Return `1 + count_items(rest)`.
:::
:::explain
`_` inside a pattern means "something is here, but I don't need it". The recursion shrinks `rest` each time until it reaches `[]`.
:::
::::

:::recap
- `[a, b]` means exactly two items; `[first, *rest]` means one or more.
- Constants like `"get"` inside a pattern must match exactly.
- Tuples are matched like lists, but a plain `str` is not treated as a sequence.
- Put specific cases first and general cases (and `_`) last.
- A pattern **checks the shape and names the parts** in one step.
:::
