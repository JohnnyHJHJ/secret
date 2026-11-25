---
title: Enums: a Fixed Set of Choices
summary: Create your own type with Enum and auto(); use .name, .value, lookup by name or value, and loop over members.
minutes: 30
---

# Enums

:::goal What you will be able to do
- Explain what an **enum** is and why we need one.
- Create one with `Enum` and `auto()`.
- Use `.name`, `.value`, `Dir[name]`, `Dir(value)` and loop over all members.
- Use enums as dictionary keys and in type hints.
:::

## 1. The problem

You are making a game with four directions: north, south, east, west, each with a movement `(dx, dy)`. How should we write "north" in code?

**Attempt 1: strings.**

```python
dir_vec = {'north': (0, +1), 'south': (0, -1), 'east': (+1, 0), 'west': (-1, 0)}
```

::::quiz q-strings
What is the main problem with strings?

- [ ] They are too slow
- [x] A typo like `'nroth'` is only caught when that line runs, and any string (even `'banana'`) is accepted
- [ ] Dictionaries cannot have string keys
- [ ] Strings cannot hold directions

:::explain
`dir_vec['nroth']` is a `KeyError` at runtime, and only if that line actually executes.
:::
::::

**Attempt 2: global int constants.** `NORTH = 1`, `SOUTH = 2`, `EAST = 3`, `WEST = 4`. Typos are now a `NameError`, but they are just ints: `EAST == 3` is `True` and `EAST + SOUTH` is `5`. Meaningless, but allowed.

## 2. The solution: Enum

We want a **new type** `Dir` with **exactly four values** that is **not** secretly equal to numbers or strings.

```python
from enum import Enum

class Dir(Enum):
    NORTH = 1
    SOUTH = 2
    EAST = 3
    WEST = 4
```

:::note Do not worry about `class` yet
It is taught in CS 12. Just copy the pattern: (1) `from enum import Enum` (2) `class YourTypeName(Enum):` (3) indented lines of `NAME = something`. Type name in `CamelCase`, members in `ALL_CAPS`.
:::

::::exercise ex-season kind=write
Write an enum `Season` with members `SPRING`, `SUMMER`, `AUTUMN`, `WINTER`. Use the values 1, 2, 3, 4.

```python starter
from enum import Enum

# your enum here
```
```python tests
check(lambda: [s.name for s in Season], ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'], "four members, in order")
check(lambda: Season.SUMMER.value, 2, "SUMMER.value == 2")
check(lambda: Season.WINTER == 4, False, "Season.WINTER == 4 is False")
```
```python solution
from enum import Enum

class Season(Enum):
    SPRING = 1
    SUMMER = 2
    AUTUMN = 3
    WINTER = 4
```
:::hint
Start with `class Season(Enum):` then four indented lines.
:::
:::hint
`SPRING = 1` on the first, and so on.
:::
:::explain
`Season.WINTER == 4` is `False`: enum members are **not** their values. That is the whole point.
:::
::::

Using it:

```python
dir_vec = {Dir.NORTH: (0, +1), Dir.SOUTH: (0, -1), Dir.EAST: (+1, 0), Dir.WEST: (-1, 0)}
print(dir_vec[Dir.EAST])     # (1, 0)
```

- There are exactly four `Dir` values.
- `Dir.EAST == 3` is **`False`**.
- `Dir.NROTH` raises an `AttributeError` immediately.
- `Dir` is a real type, so it works in **type hints**: `def move(position: tuple[int, int], direction: Dir) -> tuple[int, int]:`

## 3. Name and value

Every member has `.name` (its name as a string) and `.value` (what you assigned). Think of `Dir.EAST` as a labeled box: label `'EAST'`, contents `3`.

::::predict p-nv
What does this print?

```python
from enum import Enum

class Dir(Enum):
    NORTH = 1
    SOUTH = 2
    EAST = 3
    WEST = 4

d = Dir.EAST
print(d.name)
print(d.value)
print(d == 3)
print(d.value == 3)
```
```text answer
EAST
3
False
True
```
:::hint
The last two lines are the key: the **member** is not equal to `3`, but its **value** is.
:::
::::

## 4. Looking members up

| You have | You want | Write | Example |
|---|---|---|---|
| a **name** (string) | the member | `Dir[name]` (square brackets) | `Dir['EAST']` → `Dir.EAST` |
| a **value** | the member | `Dir(value)` (parentheses) | `Dir(3)` → `Dir.EAST` |

Memory trick: **brackets = by name, parentheses = by value.** Missing ones fail: `Dir['UP']` is a `KeyError`, `Dir(99)` is a `ValueError`.

::::fill f-lookup
Complete each line so that every `print` shows `Dir.EAST`-style lookups working. (`Dir.EAST` has value 3.)

```python
d = Dir.EAST
print(d.[[name]])             # 'EAST'
print(d.[[value]])            # 3
print(Dir[ [['EAST'|"EAST"]] ])    # lookup by NAME  -> square brackets
print(Dir( [[3]] ))           # lookup by VALUE -> parentheses
```

:::hint
`.name` is the label, `.value` is the contents of the box. Square brackets take the name **as a string** (with quotes). Parentheses take the value.
:::
::::

::::exercise ex-from-text kind=write
Using the `Dir` enum below, write `parse_dir(text)` that takes text like `' east '` or `'North'` and returns the matching member. (Strip spaces, make it uppercase, then look it up **by name**.)

```python starter
from enum import Enum

class Dir(Enum):
    NORTH = 1
    SOUTH = 2
    EAST = 3
    WEST = 4

def parse_dir(text):
    pass
```
```python tests
check(lambda: parse_dir(' east '), Dir.EAST, "' east '")
check(lambda: parse_dir('North'), Dir.NORTH, "'North'")
check_raises(lambda: parse_dir('up'), KeyError, "'up' is a KeyError")
```
```python solution
from enum import Enum

class Dir(Enum):
    NORTH = 1
    SOUTH = 2
    EAST = 3
    WEST = 4

def parse_dir(text):
    return Dir[text.strip().upper()]
```
:::hint
Square brackets look up by name: `Dir[...]`. Clean the text first with `.strip().upper()`.
:::
::::

## 5. Looping over all members

`Dir` is **iterable**, in the order the members were defined:

```python
for d in Dir:
    print(f"- {d.name}")
```

::::exercise ex-loop kind=write
Using your `Season` enum from earlier (copied below), write `season_names()` that returns a **list** of every season name in **lowercase**, in order.

```python starter
from enum import Enum

class Season(Enum):
    SPRING = 1
    SUMMER = 2
    AUTUMN = 3
    WINTER = 4

def season_names():
    pass
```
```python tests
check(season_names, ['spring', 'summer', 'autumn', 'winter'], "all four, lowercase")
```
```python solution
from enum import Enum

class Season(Enum):
    SPRING = 1
    SUMMER = 2
    AUTUMN = 3
    WINTER = 4

def season_names():
    return [s.name.lower() for s in Season]
```
:::hint
`for s in Season:` gives each member; `s.name` is a string, so `.lower()` works.
:::
::::

## 6. auto(): when you do not care about the values

If you only need every member to be **distinct**, use `auto()`; Python assigns 1, 2, 3, ... for you.

```python
from enum import Enum, auto

class Dir(Enum):
    NORTH = auto()
    SOUTH = auto()
    EAST = auto()
    WEST = auto()
```

::::exercise ex-auto kind=write
Write a `Difficulty` enum with `EASY`, `NORMAL`, `HARD` using `auto()`. Then write `num_enemies(difficulty)` returning `3` for easy, `6` for normal, `10` for hard.

```python starter
from enum import Enum, auto

# Difficulty enum

def num_enemies(difficulty):
    pass
```
```python tests
check(lambda: [d.name for d in Difficulty], ['EASY', 'NORMAL', 'HARD'], "members in order")
check(lambda: num_enemies(Difficulty.EASY), 3, "easy")
check(lambda: num_enemies(Difficulty.NORMAL), 6, "normal")
check(lambda: num_enemies(Difficulty.HARD), 10, "hard")
check(calls('auto'), True, "uses auto()")
```
```python solution
from enum import Enum, auto

class Difficulty(Enum):
    EASY = auto()
    NORMAL = auto()
    HARD = auto()

def num_enemies(difficulty):
    if difficulty == Difficulty.EASY:
        return 3
    elif difficulty == Difficulty.NORMAL:
        return 6
    else:
        return 10
```
:::hint
Compare with `==` against a **member**, like `difficulty == Difficulty.EASY`, not against a number.
:::
::::

**Rule of thumb:** if a variable can only be one of a small, fixed list of options, make it an enum.

::::quiz q-compare
Given `class Dir(Enum)` with `EAST = auto()` (so its value is 3), which of these is `True`?

- [ ] `Dir.EAST == 3`
- [x] `Dir.EAST.value == 3`
- [ ] `Dir.EAST == 'EAST'`
- [x] `Dir.EAST.name == 'EAST'`

:::explain
The member itself is never equal to a plain number or string. Use `.value` / `.name` when you want those.
:::
::::

:::recap
| Approach | Typo-safe? | Only valid choices? | Confused with ints/strs? |
|---|---|---|---|
| Strings | no | no | n/a |
| Global int constants | yes | no | yes (`EAST == 3`) |
| `Enum` | yes | yes | no |

- `class Name(Enum):` with `ALL_CAPS = auto()` members.
- `.name`, `.value`, `Dir['EAST']` (by name), `Dir(3)` (by value), `for d in Dir`.
:::
