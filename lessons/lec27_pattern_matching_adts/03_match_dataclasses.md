---
title: Matching Dataclasses and Expressive Power
summary: Match dataclass objects and lists of them, and explain why match is worth having even though if/elif could do the job.
minutes: 30
---

# Matching Dataclasses and Expressive Power

:::goal What you will be able to do
- Write patterns such as `Point(0, y)` that check a type and capture fields.
- Nest patterns inside list patterns.
- Explain what **expressive power** means.
:::

A **dataclass** is a quick way to make a type that bundles named values. `match` understands dataclasses, and it matches the fields **by position**: first `x`, then `y`.

:::try t-point
Run it. Then change the point to `Point(10, 20)` and look at the output.

```python starter
from dataclasses import dataclass

@dataclass
class Point:
    x: int
    y: int

p = Point(3, 4)
print(p.x, p.y)
print(p)
```
:::

| Pattern | Meaning |
|---|---|
| `Point(0, 0)` | a `Point` whose `x` is 0 and `y` is 0 |
| `Point(0, y)` | a `Point` with `x == 0`; capture its `y` |
| `Point()` | any `Point` at all (only the type is checked) |
| `_` | anything, including things that are not a `Point` |

::::predict p-point
What does this print?

```python
from dataclasses import dataclass

@dataclass
class Point:
    x: int
    y: int

def where_is(point):
    match point:
        case Point(0, 0):
            print("Origin")
        case Point(0, y):
            print(f"on the y-axis at y={y}")
        case Point(x, 0):
            print(f"on the x-axis at x={x}")
        case Point():
            print("Somewhere else")
        case _:
            print("Not a point")

where_is(Point(0, 5))
where_is(Point(3, 0))
where_is(Point(2, 2))
where_is((1, 2))
```
```text answer
on the y-axis at y=5
on the x-axis at x=3
Somewhere else
Not a point
```
:::hint
`Point(0, y)` needs `x` to be 0.
:::
:::hint
A plain tuple `(1, 2)` is not a `Point`, even though it has two numbers.
:::
:::explain
Each `Point(...)` pattern first checks that the value is a `Point`. The tuple fails that check every time, so it reaches `_`. `Point()` with nothing inside catches every other `Point`.
:::
::::

::::fill f-point
```python
from dataclasses import dataclass

@dataclass
class Point:
    x: int
    y: int

def label(p):
    [[match]] p:
        [[case]] Point(0, 0):
            return "origin"
        case [[Point]](x, 0):
            return "on the x-axis"
        case _:
            return "elsewhere"
```
:::hint
The first blank is the keyword that starts the statement.
:::
:::hint
A class pattern starts with the name of the class.
:::
:::hint
The last blank is `Point`.
:::
::::

::::quiz q-point-types
Which statements are true? Select all that apply.

- [x] `case Point():` matches any `Point`, whatever its `x` and `y`.
- [ ] `case Point(0, y):` also matches the tuple `(0, 5)`.
- [x] `case _:` matches values that are not a `Point` at all.
- [ ] `case Point(x, y):` only matches when `x` and `y` are different.
:::hint
Think about what each pattern checks: the type, the values, or both.
:::
:::hint
Captures like `x` and `y` match any value.
:::
:::explain
A class pattern first checks the type. A tuple is not a `Point`, so `Point(0, y)` rejects it. Captures never compare values, so `Point(x, y)` accepts equal or different fields.
:::
::::

::::exercise ex-area kind=write
Two dataclasses are ready for you. Write `area(shape)` using `match`:

- `Circle(r)` returns `3 * r * r` (we use 3 for pi to keep numbers whole).
- `Rect(w, h)` returns `w * h`.
- Anything else raises `ValueError`.

```python starter
from dataclasses import dataclass

@dataclass
class Circle:
    radius: int

@dataclass
class Rect:
    width: int
    height: int

def area(shape):
    pass
```
```python tests
check(lambda: area(Circle(2)), 12, "circle of radius 2")
check(lambda: area(Rect(3, 4)), 12, "3 by 4 rectangle")
check(lambda: area(Rect(0, 5)), 0, "zero width")
check(lambda: area(Circle(0)), 0, "radius 0")
check_raises(lambda: area("square"), ValueError, "a string is not a shape")
check(uses('Match'), True, "uses a match statement")
```
```python solution
from dataclasses import dataclass

@dataclass
class Circle:
    radius: int

@dataclass
class Rect:
    width: int
    height: int

def area(shape):
    match shape:
        case Circle(r):
            return 3 * r * r
        case Rect(w, h):
            return w * h
        case _:
            raise ValueError("not a shape")
```
:::hint
Use one case per class and a catch-all that raises.
:::
:::hint
`Circle(r)` captures the radius. `Rect(w, h)` captures width then height.
:::
:::hint
End with `case _:` and `raise ValueError("not a shape")`.
:::
:::explain
The class pattern checks the type and names the fields in one line. The order of the names follows the order of the fields in the dataclass.
:::
::::

## Lists of dataclasses

Patterns **nest**. `[Point(0, 0)]` means "a list with exactly one item, and that item is a `Point` at the origin".

::::exercise ex-points kind=write
Write `summary(points)` for a list of `Point` objects, using `match`:

- `[]` returns `"No points"`.
- one point at the origin returns `"The origin"`.
- any other single point returns `"Single point 3, 4"` (with the real `x`, `y`).
- exactly two points that both have `x == 0` returns `"Two on the Y axis at 1, 5"` (with the real `y` values).
- anything else returns `"Something else"`.

```python starter
from dataclasses import dataclass

@dataclass
class Point:
    x: int
    y: int

def summary(points):
    pass
```
```python tests
check(lambda: summary([]), "No points", "empty list")
check(lambda: summary([Point(0, 0)]), "The origin", "one point at the origin")
check(lambda: summary([Point(3, 4)]), "Single point 3, 4", "one other point")
check(lambda: summary([Point(0, 1), Point(0, 5)]), "Two on the Y axis at 1, 5", "two on the Y axis")
check(lambda: summary([Point(1, 1), Point(2, 2)]), "Something else", "two other points")
check(lambda: summary([Point(0, 1), Point(0, 2), Point(0, 3)]), "Something else", "three points")
check(uses('Match'), True, "uses a match statement")
```
```python solution
from dataclasses import dataclass

@dataclass
class Point:
    x: int
    y: int

def summary(points):
    match points:
        case []:
            return "No points"
        case [Point(0, 0)]:
            return "The origin"
        case [Point(x, y)]:
            return f"Single point {x}, {y}"
        case [Point(0, y1), Point(0, y2)]:
            return f"Two on the Y axis at {y1}, {y2}"
        case _:
            return "Something else"
```
:::hint
Each case is a list pattern with `Point` patterns inside it.
:::
:::hint
The origin case must come before the general single-point case.
:::
:::hint
For two points use two different names: `[Point(0, y1), Point(0, y2)]`.
:::
:::explain
`[Point(0, 0)]` is more specific than `[Point(x, y)]`, so it goes first. The two captures need different names (`y1`, `y2`), otherwise they would mean the same variable.
:::
::::

## Why have match at all?

You might say: "I can do all of this with `if`/`elif` and destructuring." That is true, but the code would be **uglier** and harder to read. Code that is hard to read is called **opaque**.

The idea is bigger than `match`. `for` can be built from `while`, and `while` from `for`, yet each reads better for some jobs. A language that expresses ideas more clearly has more **expressive power**: the breadth of ideas that can be represented and communicated in it.

::::quiz q-expressive
"Anything `match` does can also be written with `if`/`elif`, so `match` is useless." What is the best reply?

- [ ] True, because a feature that can be rebuilt from others adds nothing.
- [x] False, because readability, debugging and maintenance matter, not just what is possible.
- [ ] False, because `match` runs much faster than `if`.
- [ ] True, but only for beginners.
:::hint
Think about reading and changing code later, not only running it.
:::
:::hint
The same argument is used for `for` versus `while`.
:::
:::explain
Programmers care about elegance and conciseness because they affect communication, debugging, maintainability and extensibility. Being *possible* is not the same as being *clear*.
:::
::::

:::recap
- `Point(0, y)` checks the type, matches the first field to `0` and captures the second.
- `Point()` accepts any `Point`; `_` accepts anything.
- Patterns nest: `[Point(0, 0)]` is a list holding one origin point.
- **Expressive power** is how well a language lets you express ideas clearly; it is why `match` exists.
:::
