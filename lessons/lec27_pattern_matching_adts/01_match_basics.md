---
title: Your First match Statement
summary: Choose what to do with match and case, using or-patterns, capture patterns and the wildcard.
minutes: 25
---

# Your First match Statement

:::goal What you will be able to do
- Replace a long `if`/`elif` chain with `match` and `case`.
- Combine several values in one case with `|`.
- Explain why the order of cases matters.
- Tell a **capture pattern** from a constant, and use the wildcard `_`.
:::

Programs often need to "do something different depending on what a value looks like". With an enum you could write an `if`/`elif` chain, but it gets long and noisy. Python has a cleaner tool: the **match statement**, also called **structural pattern matching**.

```python
match value:
    case pattern_one:
        ...
    case pattern_two:
        ...
```

1. `match value:` says "look at this value".
2. Each `case` holds a **pattern**. Python checks the patterns from top to bottom.
3. The **first pattern that fits** runs its indented block. The other cases are skipped.

:::try t-match-dir
Press **Run**. Then change `d = Dir.EAST` to `Dir.NORTH` and run again. Then try `Dir.WEST`.

```python starter
from enum import Enum

class Dir(Enum):
    NORTH = 1
    EAST = 2
    SOUTH = 3
    WEST = 4

d = Dir.EAST
match d:
    case Dir.NORTH:
        print("going up")
    case Dir.EAST:
        print("going right")
    case _:
        print("some other way")
```
:::

:::key First match wins
Python runs only the first case that fits. After that block finishes, the whole `match` is over.
:::

A single case can accept several values. The `|` symbol inside a pattern means **or**: `Dir.SOUTH | Dir.EAST` fits either one.

::::predict p-first-wins
What does this print?

```python
from enum import Enum

class Dir(Enum):
    NORTH = 1
    EAST = 2
    SOUTH = 3
    WEST = 4

d = Dir.EAST
match d:
    case Dir.SOUTH | Dir.EAST:
        print("first")
    case Dir.EAST:
        print("second")
```
```text answer
first
```
:::hint
`Dir.EAST` fits the first case, because of the `|`.
:::
:::hint
Once a case runs, Python skips every case below it.
:::
:::explain
`Dir.SOUTH | Dir.EAST` already accepts `Dir.EAST`, so the second case can never run for that value. This is why **order matters**: put specific cases before general ones.
:::
::::

::::exercise ex-turn-right kind=write
The enum `Dir` is already written for you. Write `turn_right(d)` using `match`. Turning right from `NORTH` gives `EAST`, from `EAST` gives `SOUTH`, from `SOUTH` gives `WEST`, and from `WEST` gives `NORTH`.

```python starter
from enum import Enum

class Dir(Enum):
    NORTH = 1
    EAST = 2
    SOUTH = 3
    WEST = 4

def turn_right(d):
    pass
```
```python tests
check(lambda: turn_right(Dir.NORTH), Dir.EAST, "NORTH -> EAST")
check(lambda: turn_right(Dir.EAST), Dir.SOUTH, "EAST -> SOUTH")
check(lambda: turn_right(Dir.SOUTH), Dir.WEST, "SOUTH -> WEST")
check(lambda: turn_right(Dir.WEST), Dir.NORTH, "WEST -> NORTH")
check(uses('Match'), True, "uses a match statement")
```
```python solution
from enum import Enum

class Dir(Enum):
    NORTH = 1
    EAST = 2
    SOUTH = 3
    WEST = 4

def turn_right(d):
    match d:
        case Dir.NORTH:
            return Dir.EAST
        case Dir.EAST:
            return Dir.SOUTH
        case Dir.SOUTH:
            return Dir.WEST
        case Dir.WEST:
            return Dir.NORTH
```
:::hint
Start with `match d:` and write one `case` for each direction.
:::
:::hint
Each case looks like `case Dir.NORTH:` and then an indented `return`.
:::
:::hint
The first case is `case Dir.NORTH:` followed by `return Dir.EAST`. Repeat for the other three.
:::
:::explain
Each `case Dir.X:` compares `d` with one specific value, and the matching block returns the next direction. The dot in `Dir.NORTH` matters: it tells Python to compare with that value (more on this soon).
:::
::::

::::fill f-vowel
```python
def kind(letter):
    [[match]] letter:
        [[case]] "a" | "e" | "i" | "o" | "u":
            return "vowel"
        case [[_]]:
            return "consonant"
```
:::hint
The statement starts with the keyword that names it, and each branch starts with another keyword.
:::
:::hint
The last case is the catch-all wildcard: a single underscore.
:::
:::hint
Fill in `match`, `case` and `_`.
:::
::::

::::exercise ex-weekend kind=write
Write `day_type(day)` using `match`. It returns `"weekend"` for `"Sat"` or `"Sun"`, and `"weekday"` for anything else. Use a single case with `|` for the weekend.

```python starter
def day_type(day):
    pass
```
```python tests
check(lambda: day_type("Sat"), "weekend", "Sat")
check(lambda: day_type("Sun"), "weekend", "Sun")
check(lambda: day_type("Mon"), "weekday", "Mon")
check(lambda: day_type("Fri"), "weekday", "Fri")
check(lambda: day_type(""), "weekday", "empty string is a weekday")
check(uses('Match'), True, "uses a match statement")
```
```python solution
def day_type(day):
    match day:
        case "Sat" | "Sun":
            return "weekend"
        case _:
            return "weekday"
```
:::hint
You need two cases: one for the weekend days and one catch-all.
:::
:::hint
Write the strings in one pattern: `case "Sat" | "Sun":`.
:::
:::hint
The catch-all is `case _:`. Put it last.
:::
:::explain
`"Sat" | "Sun"` accepts either string. The final `case _:` catches everything else, so `"Mon"`, `"Fri"` and even `""` become `"weekday"`.
:::
::::

Because the first match wins, a **general** case placed above a **specific** one hides it.

::::exercise ex-debug-order kind=debug
This function should return `"zero"` for `0`, `"small"` for `1` or `2`, and `"big"` for everything else. But `size_label(0)` returns the wrong answer. Fix it.

```python starter
def size_label(n):
    match n:
        case 0 | 1 | 2:
            return "small"
        case 0:
            return "zero"
        case _:
            return "big"
```
```python tests
check(lambda: size_label(0), "zero", "0 is zero")
check(lambda: size_label(1), "small", "1 is small")
check(lambda: size_label(2), "small", "2 is small")
check(lambda: size_label(7), "big", "7 is big")
check(lambda: size_label(-3), "big", "-3 is big")
```
```python solution
def size_label(n):
    match n:
        case 0:
            return "zero"
        case 1 | 2:
            return "small"
        case _:
            return "big"
```
:::hint
Which case does `0` reach first?
:::
:::hint
`case 0 | 1 | 2:` already accepts `0`, so `case 0:` below it never runs.
:::
:::hint
Put `case 0:` first, then change the next pattern so it only covers the values that are left.
:::
:::explain
The first match wins, so the specific case (`0`) has to come before the general one. Whenever a case never seems to run, look above it for a broader pattern.
:::
::::

## Capture patterns

A bare name in a pattern, like `n`, is a **capture pattern**. It matches **anything** and **assigns** the value to that name, so you can use it inside the block.

:::try t-capture
Run it. Then add a call `show(3.5)` at the bottom.

```python starter
def show(x):
    match x:
        case 0:
            print("zero")
        case n:
            print("got", n)

show(0)
show(42)
show("hi")
```
:::

::::predict p-capture
What does this print?

```python
def show(x):
    match x:
        case 1:
            print("one")
        case other:
            print("something else:", other)

show(1)
show(5)
show("a")
```
```text answer
one
something else: 5
something else: a
```
:::hint
Only the number `1` fits `case 1`.
:::
:::hint
The name `other` captures whatever value was left.
:::
:::explain
`case other:` matches any value and stores it in `other`. That is why `5` and `"a"` both reach it, and why `other` holds the value inside the block.
:::
::::

::::quiz q-bare-name
`Color.RED` is an enum value, but `RED` is just a bare name. What does `case RED:` do?

- [ ] Compares the value with a variable named `RED`.
- [x] Matches any value and assigns it to the name `RED`.
- [ ] Raises a `NameError` because `RED` is not defined.
- [ ] Only matches the string `"RED"`.
:::hint
A bare name is a capture pattern.
:::
:::hint
Capture patterns never compare anything. They always fit.
:::
:::explain
Only a **dotted** name such as `Color.RED` (or a literal such as `"RED"`) compares with a value. A bare name always matches and binds. If more cases follow it, Python even refuses to run the code.
:::
::::

:::warning The error you may see
If a capture pattern or `_` is not the last case, Python stops with:

`SyntaxError: name capture 'RED' makes remaining patterns unreachable`

It means: "this case matches everything, so the cases below it can never run."
:::

::::quiz q-wildcard
What does `case _:` do, and where does it usually go?

- [ ] It matches only the value `None`, and goes first.
- [x] It matches anything without naming it, and goes last as a default.
- [ ] It ends the `match` statement early.
- [ ] It matches nothing and is only a comment.
:::hint
`_` means "match anything, I don't care what it is".
:::
:::hint
If it were first, nothing below it could ever run.
:::
:::explain
`_` is the **wildcard**. It works like `else` in an `if` chain: it catches whatever the earlier cases did not.
:::
::::

:::recap
- `match value:` with `case` patterns; the **first** matching case runs.
- `A | B` means "A or B" inside one pattern.
- A **dotted** name (`Dir.NORTH`) or a literal compares with the value.
- A **bare name** is a capture pattern: it matches anything and binds it.
- `_` is the wildcard; put it last as the default.
:::
