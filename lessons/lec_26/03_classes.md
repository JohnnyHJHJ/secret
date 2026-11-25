---
title: Classes and Custom Constructors
summary: Write classes with your own __init__, explain how they differ from dataclasses, and build Range and Grid as classes.
minutes: 40
---

# Classes and Custom Constructors

:::goal What you will be able to do
- Write a **class** with your own constructor (`__init__`).
- Explain how classes differ from dataclasses (printing and `==`).
- Build `Range` and `Grid` as classes.
- Explain **syntactic sugar**.
:::

## Why classes?

A dataclass just stores whatever you pass to the constructor. Sometimes what you pass in is not what you want to store. We need to **run our own code during construction**, and a **class** lets us do that.

- **Class**: the template (blueprint).
- **Instance** (or object): one thing made from the template.
- **Instantiation**: making an instance, such as `Greeter('Jed')`.

## The initializer

`__init__` is the **initializer**. Python **calls it automatically** whenever a new instance is created, and passes the arguments you gave to it (after `self`). A name with double underscores on both sides is called a **dunder**.

:::try t-greeter
Run it. Then change the name to your own.

```python starter
class Greeter:
    def __init__(self, name):
        self.name = name

    def greet(self):
        print('Hello,', self.name)

g = Greeter('Jed')
g.greet()
```
:::

For `Greeter('Jed')`: Python makes a new empty object, calls `__init__` with `self` as that object and `name = 'Jed'`, `self.name = name` stores the value as an **attribute**, and the finished object is returned.

::::quiz q-init
When does Python call `__init__`?

- [ ] Only when you write `obj.__init__()` yourself
- [x] Automatically, whenever a new instance is created
- [ ] When the object is garbage collected
:::hint
Think of the moment `Greeter('Jed')` runs.
:::
:::hint
Garbage collection is destruction. `__init__` belongs to construction.
:::
:::explain
`__init__` is the initializer for the construction phase of the life cycle. The arguments in `Greeter('Jed')` go straight to it.
:::
::::

::::predict p-greeter
What does this print?

```python
class Greeter:
    def __init__(self, name):
        self.name = name

    def greet(self):
        print('Hello,', self.name)

a = Greeter('Jed')
b = Greeter('Mia')
b.greet()
a.greet()
```
```text answer
Hello, Mia
Hello, Jed
```
:::hint
Each object keeps its own `name`.
:::
:::hint
`b.greet()` runs first.
:::
:::explain
`self.name` belongs to one object, so `a` and `b` do not interfere. The method uses whichever object it is called on.
:::
::::

:::key
`self.something = value` is how you create attributes. Without `self.`, you only make a local variable that vanishes when `__init__` ends.
:::

::::fill f-point
```python
class Point:
    def __[[init]]__(self, x, y):
        [[self]].x = x
        self.y = [[y]]
        super().__init__()
```
:::hint
The method name is the dunder the lesson just introduced.
:::
:::hint
The first parameter is named `self`, and the stored attribute starts with `self.`.
:::
::::

:::note About super().__init__()
It calls the setup of the "parent" class and is explained in a later course. For now, include it as the last line of `__init__`, as the lecture does.
:::

::::exercise ex-rectangle kind=write
Write a class `Rectangle` whose constructor takes `width` and `height`, and a method `area()` that returns the width times the height.

```python starter
class Rectangle:
    pass
```
```python tests
check(lambda: Rectangle(3, 4).area(), 12, "3 by 4")
check(lambda: Rectangle(5, 1).area(), 5, "5 by 1")
check(lambda: Rectangle(0, 9).area(), 0, "zero width")
check(lambda: Rectangle(2, 3).width, 2, "width is stored")
check(lambda: Rectangle(2, 3).height, 3, "height is stored")
check(uses('ClassDef', 'FunctionDef'), True, "defines a class with methods")
```
```python solution
class Rectangle:
    def __init__(self, width, height):
        self.width = width
        self.height = height
        super().__init__()

    def area(self):
        return self.width * self.height
```
:::hint
You need two methods: one named `__init__` and one named `area`.
:::
:::hint
Both methods start with `self`. `__init__` also takes `width` and `height`.
:::
:::hint
Store with `self.width = width`, and read with `self.width` in `area`.
:::
:::explain
`__init__` stores the state and `area` uses it through `self`. Forgetting `self.` when reading would give a `NameError`.
:::
::::

## Common mistakes

:::warning
Writing `name = name` instead of `self.name = name` stores nothing. You get `AttributeError: 'Player' object has no attribute 'name'` later.
:::

::::exercise ex-player kind=debug
`Player('Ana').describe()` should return `'Ana'`, but it crashes with an `AttributeError`. Fix the class.

```python starter
class Player:
    def __init__(self, name):
        name = name
        super().__init__()

    def describe(self):
        return self.name
```
```python tests
check(lambda: Player('Ana').describe(), 'Ana', "Ana")
check(lambda: Player('Bo').describe(), 'Bo', "Bo")
check(lambda: Player('Ana').name, 'Ana', "name is an attribute")
```
```python solution
class Player:
    def __init__(self, name):
        self.name = name
        super().__init__()

    def describe(self):
        return self.name
```
:::hint
Look at the line that stores the name in `__init__`.
:::
:::hint
That line only changes a local variable. Where must the value be stored so other methods can see it?
:::
:::explain
`name = name` assigns the parameter to itself. Only `self.name = name` puts the value on the object.
:::
::::

:::warning
Forgetting `self.` when you read an attribute inside a method gives `NameError: name 'scores' is not defined`.
:::

::::exercise ex-team kind=debug
`Team([80, 90, 100]).total()` should return `270`, but it raises a `NameError`. Fix the method.

```python starter
class Team:
    def __init__(self, scores):
        self.scores = scores
        super().__init__()

    def total(self):
        return sum(scores)
```
```python tests
check(lambda: Team([80, 90, 100]).total(), 270, "three scores")
check(lambda: Team([]).total(), 0, "no scores")
check(lambda: Team([5]).total(), 5, "one score")
```
```python solution
class Team:
    def __init__(self, scores):
        self.scores = scores
        super().__init__()

    def total(self):
        return sum(self.scores)
```
:::hint
Inside `total`, where does `scores` actually live?
:::
:::hint
It is an attribute of the object, not a local variable.
:::
:::explain
An attribute must be reached through `self`. Without it, Python looks for a plain variable named `scores` and fails.
:::
::::

## Dataclass versus plain class

Classes are bare-bones, so by default printing is not friendly and `==` is **referential equality**: two objects are equal only if they are the same object. In a dataclass, `==` is **structural equality**: equal if all the fields are equal.

| | dataclass `Point` | plain class `Point` |
|---|---|---|
| `print(Point(3, 5))` | `Point(x=3, y=5)` | something like `<__main__.Point object at 0x7f...>` |
| `Point(3, 5) == Point(3, 5)` | `True` | `False` |

::::predict p-plain-eq
What does this print?

```python
class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        super().__init__()

p = Point(1, 2)
print(Point(1, 2) == Point(1, 2))
print(p == p)
```
```text answer
False
True
```
:::hint
Remember Lesson 1: a plain class compares identity by default.
:::
:::hint
How many objects does `Point(1, 2) == Point(1, 2)` create?
:::
:::explain
Two separate objects are not equal in a plain class. An object is always equal to itself.
:::
::::

::::quiz q-sugar
`x[i]` instead of `x.get(i)` is an example of what?

- [ ] A new kind of object
- [x] Syntactic sugar: nicer syntax that adds no new power
- [ ] A dunder method call that you must write yourself
:::hint
The name hints that it makes the language "sweeter to use".
:::
:::hint
`@dataclass` is another example from this lecture.
:::
:::explain
Syntactic sugar makes code nicer to write without adding new abilities. `@dataclass` saves you from writing `__init__`, printing and `==` by hand.
:::
::::

:::key
Use a dataclass whenever it fits. Use a plain class when you need custom construction or other custom behavior.
:::

## Range as a class

With a class, `__init__` can accept any number of arguments using `*args` and work out the rest. **`*args`** collects the positional arguments into a **tuple**: `Range(20)` gives `args == (20,)`, and `Range(3, 20, 2)` gives `args == (3, 20, 2)`.

A tiny helper does the work. **`[stop] = args`** *unpacks* a one-item sequence into the name `stop`.

:::try t-args
Run it. Try calling `show(1, 2, 3)` too.

```python starter
def show(*args):
    print(args, len(args))

show(20)
show(3, 20)

[stop] = (20,)
print(stop)
```
:::

::::exercise ex-range-args kind=write
Write `_range_args(*args)` that returns a 3-tuple `(start, stop, step)`:

- one argument is `stop`, so it returns `(0, stop, 1)`
- two arguments are `start, stop`, so it returns `(start, stop, 1)`
- three arguments are `start, stop, step`
- any other number of arguments raises `ValueError`

```python starter
def _range_args(*args):
    pass
```
```python tests
check(lambda: _range_args(20), (0, 20, 1), "one argument")
check(lambda: _range_args(3, 20), (3, 20, 1), "two arguments")
check(lambda: _range_args(3, 20, 2), (3, 20, 2), "three arguments")
check_raises(lambda: _range_args(), ValueError, "no arguments")
check_raises(lambda: _range_args(1, 2, 3, 4), ValueError, "four arguments")
```
```python solution
def _range_args(*args):
    if len(args) == 1:
        [stop] = args
        return (0, stop, 1)
    elif len(args) == 2:
        [start, stop] = args
        return (start, stop, 1)
    elif len(args) == 3:
        [start, stop, step] = args
        return (start, stop, step)
    else:
        raise ValueError("invalid arguments to Range constructor")
```
:::hint
Look at `len(args)` to decide which case you are in.
:::
:::hint
Use `if`, `elif` and `else`. Unpack with `[stop] = args` or just index into `args`.
:::
:::hint
The `else` branch is the one that does `raise ValueError(...)`.
:::
:::explain
The number of arguments decides the meaning of each one. The point of the whole lesson: the arguments passed (`20`) are not the attributes stored (`0, 20, 1`).
:::
::::

::::exercise ex-range-class kind=complete
The helper `_range_args` and the methods `get` and `iter` are written for you. Write the `__init__` of `Range` so that `Range(20)`, `Range(3, 20)` and `Range(3, 20, 2)` all work. Store the attributes `start`, `stop` and `step`.

```python starter
def _range_args(*args):
    if len(args) == 1:
        [stop] = args
        return (0, stop, 1)
    elif len(args) == 2:
        [start, stop] = args
        return (start, stop, 1)
    elif len(args) == 3:
        [start, stop, step] = args
        return (start, stop, step)
    else:
        raise ValueError("invalid arguments to Range constructor")


class Range:
    # write __init__ here

    def get(self, idx):
        i = self.start + self.step * idx
        if self.start <= i < self.stop:
            return i
        raise IndexError

    def iter(self):
        i = self.start
        while i < self.stop:
            yield i
            i += self.step
```
```python tests
check(lambda: list(Range(5).iter()), [0, 1, 2, 3, 4], "Range(5)")
check(lambda: list(Range(2, 6).iter()), [2, 3, 4, 5], "Range(2, 6)")
check(lambda: list(Range(1, 10, 4).iter()), [1, 5, 9], "Range(1, 10, 4)")
check(lambda: Range(20).stop, 20, "Range(20) stores stop = 20")
check(lambda: Range(20).start, 0, "Range(20) stores start = 0")
check(lambda: Range(3, 10, 2).get(2), 7, "get works")
check_raises(lambda: Range(), ValueError, "no arguments is an error")
```
```python solution
def _range_args(*args):
    if len(args) == 1:
        [stop] = args
        return (0, stop, 1)
    elif len(args) == 2:
        [start, stop] = args
        return (start, stop, 1)
    elif len(args) == 3:
        [start, stop, step] = args
        return (start, stop, step)
    else:
        raise ValueError("invalid arguments to Range constructor")


class Range:
    def __init__(self, *args):
        (self.start, self.stop, self.step) = _range_args(*args)
        super().__init__()

    def get(self, idx):
        i = self.start + self.step * idx
        if self.start <= i < self.stop:
            return i
        raise IndexError

    def iter(self):
        i = self.start
        while i < self.stop:
            yield i
            i += self.step
```
:::hint
`__init__` needs to accept any number of arguments.
:::
:::hint
Call the helper with `_range_args(*args)`. It returns a 3-tuple.
:::
:::hint
Unpack the tuple into three attributes: `(self.start, self.stop, self.step) = ...`.
:::
:::explain
`*args` collects what was passed, the helper fills in defaults, and the unpacking stores three attributes at once. This is exactly what a dataclass constructor could not do.
:::
::::

## Grid as a class

Now the `Grid` from the previous lesson. Two traps are worth meeting first.

:::warning
`[[x] * c] * r` makes `r` references to the **same** row list. Changing one cell changes that column in every row. A list comprehension builds a fresh list per row.
:::

::::predict p-rows
What does this print?

```python
rows = ['ab', 'cd']
print([list(row) for row in rows])
```
```text answer
[['a', 'b'], ['c', 'd']]
```
:::hint
`list('ab')` turns a string into a list of characters.
:::
:::hint
The comprehension does that once for each row.
:::
:::explain
This turns each row string into a mutable list of characters. It works for any iterable of iterables.
:::
::::

::::exercise ex-make-grid kind=debug
`make_grid(r, c, x)` should return a list of `r` rows, each with `c` copies of `x`, where every row is a **separate** list. It has the aliasing bug. Fix it.

```python starter
def make_grid(r, c, x):
    return [[x] * c] * r
```
```python tests
def _after_change():
    g = make_grid(2, 2, '.')
    g[0][0] = 'X'
    return g

check(lambda: make_grid(2, 3, 'a'), [['a', 'a', 'a'], ['a', 'a', 'a']], "shape and fill")
check(_after_change, [['X', '.'], ['.', '.']], "changing one cell changes only that cell")
check(lambda: make_grid(0, 3, 'a'), [], "zero rows")
```
```python solution
def make_grid(r, c, x):
    return [[x] * c for _ in range(r)]
```
:::hint
The current code repeats the very same row `r` times.
:::
:::hint
You need to build a new row each time around. A comprehension can do that.
:::
:::hint
`[ ... for _ in range(r)]`, with a fresh `[x] * c` inside.
:::
:::explain
`* r` copies the reference, not the list. Building the row inside the comprehension runs `[x] * c` once per row, so each row is its own object.
:::
::::

::::exercise ex-grid-init kind=challenge
Write a class `Grid`.

- `Grid(rows)` takes any iterable of iterables, like `['31415', '92653']`, and stores each row as a list in `self.cells`.
- `Grid(r, c, x)` makes `r` rows with `c` copies of `x`.
- Any other number of arguments raises `ValueError`.
- `get(row, col)` returns a cell, and `set(row, col, value)` changes one.

```python starter
class Grid:
    def __init__(self, *args):
        # build self.cells here
        pass

    def get(self, row, col):
        pass

    def set(self, row, col, value):
        pass
```
```python tests
def _set_on_text_grid():
    g = Grid(['31415', '92653', '58979'])
    g.set(0, 4, '6')
    return g.get(0, 4)

def _rows_independent():
    g = Grid(2, 2, '.')
    g.set(0, 0, 'X')
    return g.get(1, 0)

check(lambda: Grid(['31415', '92653', '58979']).get(1, 4), '3', "get(1, 4)")
check(_set_on_text_grid, '6', "set works on a grid built from strings")
check(lambda: Grid(4, 3, 'X').get(3, 2), 'X', "Grid(4, 3, 'X')")
check(_rows_independent, '.', "rows are separate lists")
check(lambda: Grid([[1, 2], [3, 4]]).get(1, 0), 3, "any iterable of iterables")
check_raises(lambda: Grid(1, 2), ValueError, "two arguments is an error")
```
```python solution
class Grid:
    def __init__(self, *args):
        if len(args) == 1:
            [rows] = args
            self.cells = [list(row) for row in rows]
        elif len(args) == 3:
            [r, c, x] = args
            self.cells = [[x] * c for _ in range(r)]
        else:
            raise ValueError("invalid arguments to Grid constructor")
        super().__init__()

    def get(self, row, col):
        return self.cells[row][col]

    def set(self, row, col, value):
        self.cells[row][col] = value
```
:::hint
Use `len(args)` to tell the two construction styles apart.
:::
:::hint
For one argument, turn every row into a list. For three, build fresh rows with a comprehension.
:::
:::hint
`get` and `set` index the row first, then the column: `self.cells[row][col]`.
:::
:::explain
The constructor transforms its inputs: strings become mutable lists, and `(r, c, x)` becomes a list of separate rows. `get` and `set` then work on `self.cells`.
:::
::::

::::exercise ex-grid-sub kind=complete
The constructor, `get` and `set` are written for you. Add `subgrid(top_left, bottom_right)`, which returns the rows from `r1` up to (not including) `r2` and columns `c1` up to (not including) `c2` as a list of lists. Also add `rows()` and `cols()`, which return the number of rows and columns (assume at least one row).

```python starter
class Grid:
    def __init__(self, *args):
        if len(args) == 1:
            [rows] = args
            self.cells = [list(row) for row in rows]
        elif len(args) == 3:
            [r, c, x] = args
            self.cells = [[x] * c for _ in range(r)]
        else:
            raise ValueError("invalid arguments to Grid constructor")
        super().__init__()

    def get(self, row, col):
        return self.cells[row][col]

    def set(self, row, col, value):
        self.cells[row][col] = value

    # add subgrid, rows and cols here
```
```python tests
g = Grid(['31415', '92653', '58979'])
check(lambda: [*map(''.join, g.subgrid((1, 1), (3, 4)))], ['265', '897'], "subgrid((1, 1), (3, 4))")
check(lambda: [*map(''.join, g.subgrid((0, 0), (1, 2)))], ['31'], "one row, two columns")
check(lambda: g.subgrid((0, 0), (0, 0)), [], "empty subgrid")
check(lambda: g.rows(), 3, "rows()")
check(lambda: g.cols(), 5, "cols()")
check(lambda: Grid(4, 3, 'X').cols(), 3, "cols() of Grid(4, 3, 'X')")
```
```python solution
class Grid:
    def __init__(self, *args):
        if len(args) == 1:
            [rows] = args
            self.cells = [list(row) for row in rows]
        elif len(args) == 3:
            [r, c, x] = args
            self.cells = [[x] * c for _ in range(r)]
        else:
            raise ValueError("invalid arguments to Grid constructor")
        super().__init__()

    def get(self, row, col):
        return self.cells[row][col]

    def set(self, row, col, value):
        self.cells[row][col] = value

    def subgrid(self, top_left, bottom_right):
        (r1, c1) = top_left
        (r2, c2) = bottom_right
        return [row[c1:c2] for row in self.cells[r1:r2]]

    def rows(self):
        return len(self.cells)

    def cols(self):
        return len(self.cells[0])
```
:::hint
Slices stop **before** the end value: `[r1:r2]` picks rows `r1` up to `r2 - 1`.
:::
:::hint
First slice the rows with `self.cells[r1:r2]`, then slice each row with `row[c1:c2]`.
:::
:::hint
For `rows` and `cols`, `len` of `self.cells` and of its first row do the job.
:::
:::explain
Unpacking the two corner tuples gives four clear names. The comprehension cuts the columns out of each selected row. `cols()` uses the first row because every row has the same length.
:::
::::

## Putting it together

::::quiz q-choose
Select **all** the situations where a plain class is the better choice than a dataclass.

- [x] The constructor must turn its inputs into a different form before storing them
- [x] You want `Grid(['abc'])` and `Grid(4, 3, 'X')` to both work
- [ ] The type is just a fixed bundle of values, like a `Point`
- [ ] You want `==` to compare fields with no extra code
:::hint
Dataclasses are for records. Which options describe a record, and which describe custom construction?
:::
:::hint
The last two options are things a dataclass already gives you.
:::
:::explain
When the constructor must transform what it is given, you need `__init__`. For a plain bundle of values with free printing and equality, use a dataclass.
:::
::::

::::quiz q-review
(Review of Lesson 1.) Two plain `Point(3, 5)` objects are compared with `==` and with `is`. What do you get?

- [ ] `True` and `True`
- [x] `False` and `False`
- [ ] `True` and `False`
:::hint
Which equality does a plain class use by default?
:::
:::hint
Both `==` and `is` end up asking "same object?" here.
:::
:::explain
A plain class compares identity for `==`, and the two objects are separate, so both are `False`. A dataclass would give `True` and `False`.
:::
::::

:::recap
- `__init__` is the initializer. Python calls it when an instance is created, and `self.x = x` stores state.
- A plain class prints as an address and compares by identity. A dataclass prints its fields and compares by fields.
- `*args` collects arguments in a tuple, which lets one constructor accept several call styles.
- Build grids with `[[x] * c for _ in range(r)]`, never `[[x] * c] * r`.
- Use dataclasses whenever appropriate, and plain classes when you need custom construction.
:::
