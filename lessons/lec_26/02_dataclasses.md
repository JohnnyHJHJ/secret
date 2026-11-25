---
title: Implementing New Types with Dataclasses
summary: Write dataclasses, give them methods, build a Range type, and spot when a dataclass is not enough.
minutes: 35
---

# Implementing New Types with Dataclasses

:::goal What you will be able to do
- Say why we make our own **types**.
- Write a simple **dataclass** and use it.
- Build a custom `Range` type with a dataclass.
- Recognize when a dataclass is **not enough**.
:::

## Why make new types?

Python gives you `int`, `str`, `list`, `dict` and `range`. Sometimes you want something it does not give you, like a `Point`, an `InventoryItem` or a `Grid`. You can **define your own type** that bundles data together with the operations on it.

A **dataclass** is the quickest way to define a type that is "a fixed collection of named values" (also called a **record**).

:::try t-point
Run it. Then change `p.x` to `99` and run again.

```python starter
from dataclasses import dataclass

@dataclass
class Point:
    x: int
    y: int

p = Point(3, 5)
print(p.x)
print(p.y)
print(p)
```
:::

The pieces: `@dataclass` is a **decorator** placed above the class that adds helpful features. `class Point:` defines a new type (type names use `CamelCase`). `x: int` and `y: int` are the **fields**: a name, a colon, and a type hint.

A dataclass gives you three things for free: a **constructor** that stores what you pass in, a readable `print`, and **equality by contents**.

::::predict p-point
What does this print?

```python
from dataclasses import dataclass

@dataclass
class Point:
    x: int
    y: int

p = Point(3, 5)
p.x = 10
print(p)
print(p == Point(10, 5))
```
```text answer
Point(x=10, y=5)
True
```
:::hint
You can change attributes after construction, so `p.x` is now `10`.
:::
:::hint
A dataclass prints as `Name(field=value, ...)` and compares by fields.
:::
:::explain
Assigning `p.x = 10` changed the state. The free `print` shows every field, and the free `==` compares the fields, so `Point(10, 5)` is equal.
:::
::::

::::fill f-student
```python
from dataclasses import [[dataclass]]

@[[dataclass]]
class Student:
    name: [[str]]
    year: [[int]]
    gwa: float = [[0.0]]
```
:::hint
The same word is imported and then used as the decorator.
:::
:::hint
`name` holds text and `year` holds a whole number. The default for `gwa` is a float.
:::
::::

::::exercise ex-student kind=write
Write a dataclass `Student` with fields `name` (str), `year` (int), and `gwa` (float, default `0.0`).

```python starter
from dataclasses import dataclass

# write your dataclass here
```
```python tests
check(lambda: Student('Ana', 2).name, 'Ana', "name is stored")
check(lambda: Student('Ana', 2).year, 2, "year is stored")
check(lambda: Student('Ana', 2).gwa, 0.0, "gwa defaults to 0.0")
check(lambda: Student('Bo', 1, 1.5).gwa, 1.5, "gwa can be given")
check(lambda: Student('Bo', 1, gwa=1.25).gwa, 1.25, "gwa can be given by keyword")
check(lambda: Student('Cy', 3) == Student('Cy', 3), True, "equal by contents")
check(uses('ClassDef'), True, "defines a class")
```
```python solution
from dataclasses import dataclass

@dataclass
class Student:
    name: str
    year: int
    gwa: float = 0.0
```
:::hint
Start with `@dataclass` on the line above `class Student:`.
:::
:::hint
Each field is `name: type`. A default is added with `= value`.
:::
:::hint
Three fields, in this order: `name`, `year`, `gwa`.
:::
:::explain
The decorator writes the constructor, `print` and `==` for you. Because `gwa` has a default, `Student('Ana', 2)` works with two arguments.
:::
::::

## Default values: the order rule

:::key
Fields **with** defaults must come **after** fields **without** defaults.
:::

:::warning
Breaking the rule gives: `TypeError: non-default argument 'quantity' follows default argument`
:::

::::quiz q-order
Which dataclass body is valid?

- [ ] `step: int = 1` then `stop: int`
- [x] `stop: int` then `step: int = 1`
- [ ] `step: int = 1` then `stop: int = 10` then `start`
:::hint
Which kind of field must be at the end?
:::
:::hint
Read each option top to bottom. Once a default appears, nothing without a default may follow.
:::
:::explain
A call like `Range(3, 20)` fills fields from left to right, so fields that might be skipped have to be last.
:::
::::

::::exercise ex-item-defaults kind=debug
This dataclass crashes when it is defined. Fix it so that `Item('pen')` has price `0.0` and quantity `0`, and `Item('pen', 12.5, 3)` has price `12.5` and quantity `3`.

```python starter
from dataclasses import dataclass

@dataclass
class Item:
    name: str
    price: float = 0.0
    quantity: int
```
```python tests
check(lambda: Item('pen').price, 0.0, "price defaults to 0.0")
check(lambda: Item('pen').quantity, 0, "quantity defaults to 0")
check(lambda: Item('pen', 12.5, 3).price, 12.5, "price given positionally")
check(lambda: Item('pen', 12.5, 3).quantity, 3, "quantity given positionally")
check(lambda: Item('pen', quantity=30).quantity, 30, "quantity by keyword")
```
```python solution
from dataclasses import dataclass

@dataclass
class Item:
    name: str
    price: float = 0.0
    quantity: int = 0
```
:::hint
Read the error message: a field without a default comes after one with a default.
:::
:::hint
The tests need `quantity` to have a default value too.
:::
:::explain
Once a field has a default, every field after it needs one as well. Giving `quantity` a default of `0` fixes the order problem and matches the behavior we wanted.
:::
::::

## Building Range with a dataclass

Goal: a `Range` that behaves like the built-in `range`, with only two operations: indexing and iteration. We use methods `.get(i)` and `.iter()` instead of `r[i]` and `for v in r`.

A **method** is a function defined inside the class. Its first parameter is **`self`**: the object the method is called on.

:::try t-range
Run it. In `r.get(2)`, Python passes `r` as `self` and `2` as `idx`.

```python starter
from dataclasses import dataclass

@dataclass
class Range:
    start: int
    stop: int
    step: int = 1

    def get(self, idx):
        i = self.start + self.step * idx
        if self.start <= i < self.stop:
            return i
        raise IndexError

r = Range(3, 10, 2)
print(r.get(0))
print(r.get(2))
print(r)
```
:::

`get` computes `i = start + step * idx`. If `i` is in `start <= i < stop` it returns `i`. Otherwise it raises `IndexError`, the same error lists raise for a bad index.

::::predict p-get
What does this print?

```python
from dataclasses import dataclass

@dataclass
class Range:
    start: int
    stop: int
    step: int = 1

    def get(self, idx):
        i = self.start + self.step * idx
        if self.start <= i < self.stop:
            return i
        raise IndexError

r = Range(2, 12, 3)
print(r.get(0), r.get(3))
try:
    r.get(4)
except IndexError:
    print("out of range")
```
```text answer
2 11
out of range
```
:::hint
For `get(3)`: `i = 2 + 3 * 3`.
:::
:::hint
`get(4)` gives `i = 14`. Is `14 < 12`?
:::
:::explain
`get(0)` is `2` and `get(3)` is `11` (and `2 <= 11 < 12`). `get(4)` would be `14`, which is not below `12`, so `IndexError` is raised and the `except` prints the message.
:::
::::

::::exercise ex-range-get kind=complete
Finish the method `get(self, idx)`. It returns `start + step * idx` when that value is at least `start` and below `stop`. Otherwise it raises `IndexError`.

```python starter
from dataclasses import dataclass

@dataclass
class Range:
    start: int
    stop: int
    step: int = 1

    def get(self, idx):
        pass
```
```python tests
check(lambda: Range(3, 10, 2).get(0), 3, "get(0)")
check(lambda: Range(3, 10, 2).get(2), 7, "get(2)")
check(lambda: Range(2, 12, 3).get(3), 11, "last valid index")
check(lambda: Range(0, 5).get(4), 4, "default step of 1")
check_raises(lambda: Range(3, 10, 2).get(4), IndexError, "get(4) is out of range")
check_raises(lambda: Range(0, 0).get(0), IndexError, "empty range has no items")
```
```python solution
from dataclasses import dataclass

@dataclass
class Range:
    start: int
    stop: int
    step: int = 1

    def get(self, idx):
        i = self.start + self.step * idx
        if self.start <= i < self.stop:
            return i
        raise IndexError
```
:::hint
First compute the value that index `idx` would have.
:::
:::hint
Use `self.start`, `self.step` and `self.stop`. Do not forget `self.`.
:::
:::hint
`i = self.start + self.step * idx`, then an `if` with `self.start <= i < self.stop`.
:::
:::explain
Through `self`, the method reads the object's attributes. The chained comparison checks both ends at once, and `raise IndexError` signals a bad index.
:::
::::

## Iteration with a generator

`iter` uses `yield`, so it is a **generator**: it hands out values one at a time.

1. Start `i` at `start`.
2. While `i < stop`: hand out `i`, then add `step`.

Trace of `Range(0, 5, 2).iter()`:

| i | `i < 5`? | yields |
|---|---|---|
| 0 | yes | 0 |
| 2 | yes | 2 |
| 4 | yes | 4 |
| 6 | no | (stop) |

::::predict p-iter
What does this print?

```python
from dataclasses import dataclass

@dataclass
class Range:
    start: int
    stop: int
    step: int = 1

    def iter(self):
        i = self.start
        while i < self.stop:
            yield i
            i += self.step

print(list(Range(2, 12, 3).iter()))
```
```text answer
[2, 5, 8, 11]
```
:::hint
Start at 2 and keep adding 3 while the value is below 12.
:::
:::hint
Is 11 below 12? What comes after 11?
:::
:::explain
The values are 2, 5, 8, 11. The next one would be 14, which is not below 12, so the generator stops.
:::
::::

::::exercise ex-range-iter kind=write
Write the generator method `iter(self)` that yields `start`, `start + step`, and so on, while the value is below `stop`.

```python starter
from dataclasses import dataclass

@dataclass
class Range:
    start: int
    stop: int
    step: int = 1

    def iter(self):
        pass
```
```python tests
check(lambda: list(Range(3, 10, 2).iter()), [3, 5, 7, 9], "3 to 10 by 2")
check(lambda: list(Range(0, 5, 2).iter()), [0, 2, 4], "0 to 5 by 2")
check(lambda: list(Range(1, 4).iter()), [1, 2, 3], "default step")
check(lambda: list(Range(5, 5).iter()), [], "empty range")
```
```python solution
from dataclasses import dataclass

@dataclass
class Range:
    start: int
    stop: int
    step: int = 1

    def iter(self):
        i = self.start
        while i < self.stop:
            yield i
            i += self.step
```
:::hint
You need a variable that starts at `self.start` and grows.
:::
:::hint
Use a `while` loop that runs while the variable is below `self.stop`.
:::
:::hint
Inside the loop: `yield i`, then `i += self.step`.
:::
:::explain
`yield` hands out a value and pauses. Forgetting `i += self.step` would give an endless loop. The empty case works for free because the loop never runs.
:::
::::

## The awkward part

The built-in `range` allows `range(20)`, `range(3, 20)` and `range(3, 20, 2)`. Our dataclass handles the last two, but `Range(20)` would put `20` into `start` and leave `stop` missing.

:::warning
`Range(20)` with the dataclass gives: `TypeError: Range.__init__() missing 1 required positional argument: 'stop'`
:::

::::quiz q-range20
What does `Range(20)` do with the dataclass version?

- [ ] It creates `Range(0, 20, 1)`
- [ ] It creates `Range(20, 0, 1)`
- [x] It raises a `TypeError` because `stop` is missing
:::hint
The constructor just stores what you pass, from left to right.
:::
:::hint
The first value goes into the first field, `start`.
:::
:::explain
Arguments are matched to fields in order. `20` lands in `start` and `stop` has no default, so Python complains.
:::
::::

## When a dataclass is not enough

Imagine a `Grid` built from any iterable of iterables, like `Grid(['31415', '92653', '58979'])`, and also from `Grid(4, 3, 'X')` (4 rows, 3 columns, all `'X'`). We want to store a list of lists of characters, because strings cannot be changed in place (`'31415'[4] = '6'` is an error).

:::key
What we **pass in** to the constructor is not what we want to **store**. A dataclass constructor only stores what you give it.
:::

::::quiz q-not-enough
Select **all** the reasons a dataclass is a poor fit for `Grid`.

- [x] Rows given as strings must be turned into mutable lists
- [x] `Grid(4, 3, 'X')` needs a different way to build the rows
- [ ] A dataclass cannot have methods
- [ ] A dataclass cannot be printed
:::hint
Dataclasses can have methods, and they print nicely.
:::
:::hint
Look for the situations where the stored data differs from the arguments.
:::
:::explain
The real issue is that we must run our own code during construction. That is what a class is for, and it is the next lesson.
:::
::::

## Putting it together

::::exercise ex-score kind=complete
A `Score` stores a student's `name`, `points`, and `total` (default `100`). Add the method `percent(self)` that returns `points / total * 100`.

```python starter
from dataclasses import dataclass

@dataclass
class Score:
    name: str
    points: int
    total: int = 100

    # add percent here
```
```python tests
check(lambda: Score('Ana', 45, 50).percent(), 90.0, "45 out of 50")
check(lambda: Score('Bo', 50).percent(), 50.0, "default total of 100")
check(lambda: Score('Cy', 0).percent(), 0.0, "zero points")
check(lambda: Score('Di', 7, 7) == Score('Di', 7, 7), True, "equal by contents")
```
```python solution
from dataclasses import dataclass

@dataclass
class Score:
    name: str
    points: int
    total: int = 100

    def percent(self):
        return self.points / self.total * 100
```
:::hint
A method is a function inside the class, and its first parameter is `self`.
:::
:::hint
Read the fields through `self.points` and `self.total`.
:::
:::explain
Methods live next to the fields and use `self` to reach them. A dataclass can have both free features and your own methods.
:::
::::

::::predict p-mixed
(Review of Lesson 1.) What does this print?

```python
from dataclasses import dataclass

@dataclass
class Point:
    x: int
    y: int

p = Point(3, 5)
q = Point(3, 5)
r = p
print(p == q, p is q, p is r)
```
```text answer
True False True
```
:::hint
`==` on a dataclass compares fields. `is` still asks about identity.
:::
:::hint
`Point(3, 5)` was called twice, so two objects exist. `r = p` is an alias.
:::
:::explain
Equal fields make `p == q` true, but they are two separate objects, so `p is q` is false. `r` is another name for `p`.
:::
::::

:::recap
- A dataclass bundles named values: `@dataclass`, then `name: type` fields.
- It gives you a constructor, a readable `print`, and `==` by contents.
- Fields with defaults go after fields without defaults.
- Methods take `self` first and use it to read attributes.
- When what you pass in is not what you want to store, you need a class with your own constructor.
:::
