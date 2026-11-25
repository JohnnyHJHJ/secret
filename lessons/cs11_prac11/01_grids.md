---
title: Grids of Characters
summary: Read, loop over, pad, rotate and pattern-match a picture made of text, without crashing at the edges.
minutes: 40
---

# Grids of Characters

:::goal What you will be able to do
- Read a cell with `grid[r][c]` and loop over every cell.
- Look at cells outside the picture without crashing.
- Pad ragged rows, take columns, and rotate a picture.
- Find where a small pattern appears inside a bigger picture.
:::

A **grid** here is a tuple of strings. Each string is one **row**. Each character in a row is one **cell**: a space or a `#`.

The row number comes first, then the column number. Counting starts at 0.

:::try t-index
Run it. Then print the cell in the last row and last column.

```python starter
sky = ('#  ',
       ' # ',
       '  #')
print(sky[1][1])
print(len(sky), len(sky[0]))
```
:::

::::quiz q-rowcol
`grid = ('ab', 'cd', 'ef')`. What is `grid[2][0]`?

- [ ] `'c'`
- [x] `'e'`
- [ ] `'f'`
:::hint
`grid[2]` is a whole row. Pick the row first.
:::
:::hint
Row 2 is `'ef'`. Now take its character at position 0.
:::
:::explain
`grid[2]` is `'ef'`, and `[0]` is its first character. Row first, column second. Mixing them up is the most common grid bug.
:::
::::

::::predict p-count
What does this print?

```python
grid = ('# #', ' # ', '#  ')
total = 0
for row in grid:
    total += row.count('#')
print(total)
```
```text answer
4
```
:::hint
`row.count('#')` counts the `#` characters in one row.
:::
:::hint
Rows have 2, 1 and 1 hashes.
:::
:::explain
The loop adds the per-row counts: 2 + 1 + 1 = 4.
:::
::::

To visit every cell you need a loop inside a loop. The outer loop picks the row, the inner loop picks the column.

::::fill f-nested
```python
grid = ('# #', ' # ')
total = 0
n = [[len]](grid)
for r in range(n):
    for c in range(len(grid[r])):
        if grid[r][c] [[==]] '#':
            total += 1
print(total)
```
:::hint
How many rows are there? Which function counts items?
:::
:::hint
To test equality in an `if`, use two equal signs.
:::
:::explain
`len(grid)` is the number of rows and `len(grid[r])` is the length of row `r`. `==` compares, while `=` assigns.
:::
::::

`enumerate` gives you the position and the item together, so you do not need `range(len(...))`.

::::predict p-enumerate
What does this print?

```python
grid = ('# ', ' #')
for r, row in enumerate(grid):
    for c, ch in enumerate(row):
        if ch == '#':
            print(r, c)
```
```text answer
0 0
1 1
```
:::hint
`enumerate(grid)` gives `(0, '# ')` and then `(1, ' #')`.
:::
:::hint
Only cells where `ch == '#'` are printed.
:::
:::explain
The `#` characters sit at row 0 column 0 and row 1 column 1. `enumerate` hands you `r` and `row`, then `c` and `ch`.
:::
::::

:::warning Cells outside the picture
`grid[5][0]` on a 3-row grid raises `IndexError`. A **negative** index does not fail: `grid[-1]` silently gives the last row. When you look at the neighbours of a cell, check both ends.
:::

::::exercise ex-get kind=debug
`get(grid, r, c)` should return the cell, or a space `' '` if `(r, c)` is outside the grid. It works for big numbers but not for negative ones. Fix it.

```python starter
def get(grid, r, c):
    if r >= len(grid) or c >= len(grid[r]):
        return ' '
    return grid[r][c]
```
```python tests
g = ('#  ', '  #')
check(lambda: get(g, 0, 0), '#', "inside the grid")
check(lambda: get(g, 0, 5), ' ', "column too big")
check(lambda: get(g, 2, 0), ' ', "row too big")
check(lambda: get(g, -1, 2), ' ', "negative row must not wrap around")
check(lambda: get(g, 0, -1), ' ', "negative column must not wrap around")
```
```python solution
def get(grid, r, c):
    if r < 0 or r >= len(grid) or c < 0 or c >= len(grid[r]):
        return ' '
    return grid[r][c]
```
:::hint
Which values of `r` and `c` are still outside the grid after the existing check?
:::
:::hint
Add tests for `r < 0` and `c < 0` to the same `if`, joined with `or`.
:::
:::explain
Valid rows are `0 <= r < len(grid)`. Python accepts negative indexes, so you must reject them yourself.
:::
::::

Real inputs are messy. Editors strip trailing spaces, so rows can have **different lengths** (a **ragged** grid). The cure is to **pad** every row to the same width. `'ab'.ljust(5)` gives `'ab   '`.

::::quiz q-ragged
Some inputs have shorter rows because trailing spaces were removed. Why loop with `len(grid[r])` (or pad first) instead of trusting one fixed width?

- [ ] `len(grid[r])` is faster
- [x] A short row would make `grid[r][c]` run past its end and raise `IndexError`
- [ ] Python cannot index a string with a number
:::hint
Imagine row 1 is only two characters long and you ask for column 4.
:::
:::hint
Which error does Python raise for an index past the end of a string?
:::
:::explain
`grid[r][c]` fails with `IndexError` if row `r` is shorter than `c + 1`. Padding the rows once, up front, makes every later step simpler.
:::
::::

::::exercise ex-pad kind=write
Write `pad(grid)` that returns a tuple of rows, all padded with spaces on the right to the length of the longest row.

```python starter
def pad(grid):
    return grid
```
```python tests
check(lambda: pad(('#', ' ##', '')), ('#  ', ' ##', '   '), "different lengths")
check(lambda: pad(('ab', 'cd')), ('ab', 'cd'), "already equal")
check(lambda: pad(()), (), "empty grid")
check(lambda: pad(('x',)), ('x',), "one row")
```
```python solution
def pad(grid):
    width = max((len(row) for row in grid), default=0)
    return tuple(row.ljust(width) for row in grid)
```
:::hint
First find the width: the biggest `len(row)` over all rows.
:::
:::hint
`max` fails on an empty sequence unless you give `default=0`.
:::
:::hint
Build each new row with `row.ljust(width)`, then wrap the results in `tuple(...)`.
:::
:::explain
`ljust` adds spaces on the right. The `default=0` handles the empty grid. Always think about the empty input.
:::
::::

Many tasks only care about **where the `#` are**. A **set of coordinates** is easier to work with than a grid of text, because you can ask `(r, c) in cells` in one step.

::::exercise ex-cells kind=write
Write `hash_cells(grid)` that returns the **set** of `(row, column)` pairs where the grid has a `#`.

```python starter
def hash_cells(grid):
    result = set()
    return result
```
```python tests
check(lambda: hash_cells(('# ', ' #')), {(0, 0), (1, 1)}, "diagonal")
check(lambda: hash_cells(('   ',)), set(), "no hashes")
check(lambda: hash_cells(('#', '#', '#')), {(0, 0), (1, 0), (2, 0)}, "one column")
check(lambda: hash_cells(('  #', '#')), {(0, 2), (1, 0)}, "ragged rows")
```
```python solution
def hash_cells(grid):
    result = set()
    for r, row in enumerate(grid):
        for c, ch in enumerate(row):
            if ch == '#':
                result.add((r, c))
    return result
```
:::hint
Use the same double loop as in the `enumerate` example.
:::
:::hint
A set grows with `.add(...)`. The thing to add is the pair `(r, c)`.
:::
:::explain
Looping over each row's own characters makes ragged rows safe. A set also ignores duplicates and answers "is this cell marked?" quickly.
:::
::::

::::exercise ex-bbox kind=write
Write `bounding_box(grid)` that returns `(top, left, bottom, right)`: the smallest and largest row and column numbers that contain a `#`. The grid has at least one `#`.

```python starter
def bounding_box(grid):
    rows = []
    cols = []
    # loop over every cell and remember where the '#' are
    return None
```
```python tests
g1 = ('     ',
      '  #  ',
      '  ## ',
      '     ')
check(lambda: bounding_box(g1), (1, 2, 2, 3), "small shape")
check(lambda: bounding_box(('#',)), (0, 0, 0, 0), "single cell")
check(lambda: bounding_box(('# ', ' #')), (0, 0, 1, 1), "two corners")
check(lambda: bounding_box(('   ', '  #', '#  ')), (1, 0, 2, 2), "spread out")
check(uses('For'), True, "uses a for loop")
```
```python solution
def bounding_box(grid):
    rows = []
    cols = []
    for r in range(len(grid)):
        for c in range(len(grid[r])):
            if grid[r][c] == '#':
                rows.append(r)
                cols.append(c)
    return (min(rows), min(cols), max(rows), max(cols))
```
:::hint
Visit every cell with two loops, like in the fill exercise. Whenever the cell is `'#'`, save its row and column.
:::
:::hint
After the loops, `min(rows)` is the top and `max(rows)` is the bottom. Do the same for columns.
:::
:::hint
Return the four numbers in the order `(top, left, bottom, right)`.
:::
:::explain
The box is defined by the extreme rows and columns of the marked cells. Collecting them in two lists keeps the code simple.
:::
::::

Now two tricks for turning pictures. `zip(*rows)` regroups the characters **by column**. Reversing the rows first turns the picture a quarter turn.

::::predict p-rotate
What does this print?

```python
rows = ('ab', 'cd', 'ef')
for line in zip(*rows[::-1]):
    print(''.join(line))
```
```text answer
eca
fdb
```
:::hint
`rows[::-1]` is the rows in reverse order: `('ef', 'cd', 'ab')`.
:::
:::hint
`zip(*...)` takes the first character of every row, then the second character of every row.
:::
:::explain
After reversing, the first characters are `e`, `c`, `a` and the second characters are `f`, `d`, `b`. Joined, they are the two lines you see. This is a clockwise quarter turn of the picture.
:::
::::

::::exercise ex-rotate kind=write
Write `rotate_cw(rows)` that turns a rectangular picture a quarter turn clockwise and returns a tuple of strings. For `('ab', 'cd', 'ef')` it returns `('eca', 'fdb')`.

```python starter
def rotate_cw(rows):
    return tuple(rows)
```
```python tests
check(lambda: rotate_cw(('ab', 'cd', 'ef')), ('eca', 'fdb'), "3 rows by 2 columns")
check(lambda: rotate_cw(('#.',)), ('#', '.'), "one row")
check(lambda: rotate_cw(('x',)), ('x',), "one cell")
twice = lambda g: rotate_cw(rotate_cw(g))
check(lambda: twice(('ab', 'cd', 'ef')), ('fe', 'dc', 'ba'), "two turns flip the picture")
check(lambda: rotate_cw(rotate_cw(twice(('ab', 'cd', 'ef')))), ('ab', 'cd', 'ef'), "four turns give the original")
```
```python solution
def rotate_cw(rows):
    return tuple(''.join(line) for line in zip(*rows[::-1]))
```
:::hint
You just predicted the exact steps: reverse the rows, then regroup by column.
:::
:::hint
`zip(*rows[::-1])` gives tuples of characters. Turn each tuple back into a string with `''.join(...)`.
:::
:::hint
Wrap the whole thing in `tuple(...)` so the result is a tuple of strings.
:::
:::explain
Slicing `[::-1]` reverses a tuple of rows. `zip(*x)` transposes. Together they rotate. Later you will rotate shapes to recognise them from any direction.
:::
::::

Next: does a small **pattern** appear at position `(r, c)`? Compare cell by cell and stop at the first difference.

::::exercise ex-match kind=complete
Finish `matches_at(grid, r, c, pattern)`. It returns `True` if every cell of `pattern` (a tuple of strings) equals the grid cell at the matching position, where the pattern's top-left sits at `(r, c)`. Use `get` so edges are safe.

```python starter
def get(grid, r, c):
    if r < 0 or r >= len(grid) or c < 0 or c >= len(grid[r]):
        return ' '
    return grid[r][c]

def matches_at(grid, r, c, pattern):
    for dr in range(len(pattern)):
        for dc in range(len(pattern[dr])):
            pass  # compare one cell here
    return False
```
```python tests
P = ('# #', ' # ')
g = ('  # #', '   # ', '     ')
check(lambda: matches_at(g, 0, 2, P), True, "pattern is there")
check(lambda: matches_at(g, 0, 1, P), False, "shifted by one column")
check(lambda: matches_at(g, 1, 2, P), False, "wrong row")
check(lambda: matches_at(g, 0, 4, P), False, "pattern runs off the edge")
check(lambda: matches_at(('#',), 0, 0, ('#',)), True, "1x1 pattern")
```
```python solution
def get(grid, r, c):
    if r < 0 or r >= len(grid) or c < 0 or c >= len(grid[r]):
        return ' '
    return grid[r][c]

def matches_at(grid, r, c, pattern):
    for dr in range(len(pattern)):
        for dc in range(len(pattern[dr])):
            if get(grid, r + dr, c + dc) != pattern[dr][dc]:
                return False
    return True
```
:::hint
The grid cell that lines up with `pattern[dr][dc]` is at row `r + dr`, column `c + dc`.
:::
:::hint
If those two characters differ, you can answer `False` right away.
:::
:::hint
Only after both loops finish without a difference may you return `True`.
:::
:::explain
Returning early on the first mismatch is enough. Spaces count too, because a space in the pattern must be a space in the grid. Using `get` means a pattern hanging off the edge compares against spaces and fails safely.
:::
::::

::::exercise ex-find-all kind=challenge
Write `find_all(grid, pattern)` that returns a list of every `(r, c)` where `pattern` matches, scanning row by row from the top and left to right inside a row. Matches may overlap. `matches_at` is already written for you.

```python starter
def get(grid, r, c):
    if r < 0 or r >= len(grid) or c < 0 or c >= len(grid[r]):
        return ' '
    return grid[r][c]

def matches_at(grid, r, c, pattern):
    for dr in range(len(pattern)):
        for dc in range(len(pattern[dr])):
            if get(grid, r + dr, c + dc) != pattern[dr][dc]:
                return False
    return True

def find_all(grid, pattern):
    return []
```
```python tests
dot = ('#',)
check(lambda: find_all(('#.#', '..#'), dot), [(0, 0), (0, 2), (1, 2)], "single cells")
duo = ('##',)
check(lambda: find_all(('###', '.##'), duo), [(0, 0), (0, 1), (1, 1)], "overlapping matches are all reported")
check(lambda: find_all(('ab', 'cd'), ('x',)), [], "no match")
check(lambda: find_all(('#.', '#.', '#.'), ('#', '#')), [(0, 0), (1, 0)], "vertical pattern")
check(uses('For'), True, "uses loops")
```
```python solution
def get(grid, r, c):
    if r < 0 or r >= len(grid) or c < 0 or c >= len(grid[r]):
        return ' '
    return grid[r][c]

def matches_at(grid, r, c, pattern):
    for dr in range(len(pattern)):
        for dc in range(len(pattern[dr])):
            if get(grid, r + dr, c + dc) != pattern[dr][dc]:
                return False
    return True

def find_all(grid, pattern):
    found = []
    for r in range(len(grid)):
        for c in range(len(grid[r])):
            if matches_at(grid, r, c, pattern):
                found.append((r, c))
    return found
```
:::hint
Try every cell as a possible top-left corner.
:::
:::hint
At each corner ask `matches_at(grid, r, c, pattern)` and remember the corner when it says `True`.
:::
:::explain
Scanning rows outside and columns inside gives row-by-row order for free. Because every corner is tried, overlapping matches are found too.
:::
::::

:::recap
- `grid[r][c]`: row first, then column, both starting at 0.
- Loop with `enumerate`, or `range(len(grid[r]))`, so ragged rows are safe.
- Negative indexes wrap around, so guard them yourself.
- `ljust` pads, `zip(*rows)` regroups by column, and reverse-then-`zip` rotates.
- Compare a pattern cell by cell and return `False` on the first mismatch.
:::