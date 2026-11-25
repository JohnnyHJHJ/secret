---
title: Sorting and Grouping Records
summary: Sort by several keys, group items into a dict, and use dataclasses and enums to describe records.
minutes: 30
---

# Sorting and Grouping Records

:::goal What you will be able to do
- Sort with `key=` and with a tuple key.
- Describe a record with a `dataclass` and a category with an `Enum`.
- Group items into a dict without losing any.
:::

`sorted(items)` returns a new sorted list. The `key=` option is a function that turns each item into the value to sort by.

:::try t-sorted
Run it. Compare the three lines.

```python starter
words = ['pear', 'fig', 'apple', 'kiwi']
print(sorted(words))
print(sorted(words, key=len))
print(sorted(words, key=lambda w: (len(w), w)))
```
:::

A **tuple key** `(a, b)` sorts by `a` first. Only when `a` ties does it look at `b`.

::::predict p-key
What does this print?

```python
words = ['pear', 'fig', 'apple', 'kiwi']
print(sorted(words, key=lambda w: (len(w), w)))
```
```text answer
['fig', 'kiwi', 'pear', 'apple']
```
:::hint
First sort by length: 3, 4, 4, 5.
:::
:::hint
`'kiwi'` and `'pear'` both have length 4. The second part of the key breaks the tie alphabetically.
:::
:::explain
Lengths: fig 3, pear 4, kiwi 4, apple 5. The tie between `kiwi` and `pear` goes to the alphabetical order, so `kiwi` is first.
:::
::::

A **dataclass** is a short way to define a class that just holds named fields.

::::fill f-dataclass
```python
from dataclasses import dataclass

@[[dataclass]]
class Score:
    player: str
    points: int

s = Score('Ana', 30)
print(s.[[points]])
```
:::hint
The decorator that turns a class into a dataclass has the same name as the module's import.
:::
:::hint
Fields are read with a dot and the field's name. Which field holds the number?
:::
:::explain
`@dataclass` writes `__init__` for you from the annotated fields. You read a field with `s.points`.
:::
::::

::::quiz q-tuple-key
Movies have `.name` and `.year`. Which key sorts by year, and for equal years by name?

- [ ] `key=lambda m: m.year`
- [ ] `key=lambda m: m.name`
- [x] `key=lambda m: (m.year, m.name)`
:::hint
You want two things compared in order. What can hold two values?
:::
:::explain
Sorting by year alone leaves movies from the same year in their original order. The tuple `(m.year, m.name)` compares the name when years tie.
:::
::::

An **Enum** is a fixed set of named choices. Looping over the class gives each member once, in the order they were written.

::::predict p-enum
What does this print?

```python
from enum import Enum, auto

class Color(Enum):
    RED = auto()
    BLUE = auto()

for c in Color:
    print(c.name)
```
```text answer
RED
BLUE
```
:::hint
Looping over an Enum class visits its members in definition order.
:::
:::explain
`c.name` is the member's name as written in the class body.
:::
::::

To **group** items, keep a dict whose values are lists. `d.setdefault(key, [])` returns the list for `key`, creating an empty one the first time.

::::predict p-group
What does this print?

```python
groups = {}
for name, genre in [('a', 'x'), ('b', 'y'), ('c', 'x')]:
    groups.setdefault(genre, []).append(name)
print(groups)
```
```text answer
{'x': ['a', 'c'], 'y': ['b']}
```
:::hint
`setdefault` creates the list only if the key is new.
:::
:::hint
Keys appear in the order they were first added: `'x'` before `'y'`.
:::
:::explain
`'a'` creates the `'x'` list, `'b'` creates `'y'`, and `'c'` is appended to the existing `'x'` list.
:::
::::

:::warning A classic grouping bug
Writing `groups[key] = [item]` replaces the list every time, so only the last item survives.
:::

::::exercise ex-group-bug kind=debug
`group_by_length(words)` should return a dict from word length to the list of all words with that length, in input order. Some words go missing. Fix it.

```python starter
def group_by_length(words):
    groups = {}
    for w in words:
        groups[len(w)] = [w]
    return groups
```
```python tests
check(lambda: group_by_length(['a', 'b', 'cc']), {1: ['a', 'b'], 2: ['cc']}, "keeps both one-letter words")
check(lambda: group_by_length([]), {}, "empty input")
check(lambda: group_by_length(['aa', 'b', 'cc', 'dd']), {2: ['aa', 'cc', 'dd'], 1: ['b']}, "three words of length 2")
```
```python solution
def group_by_length(words):
    groups = {}
    for w in words:
        groups.setdefault(len(w), []).append(w)
    return groups
```
:::hint
Each assignment throws away the list that was already stored under that key.
:::
:::hint
Get the existing list first, creating an empty one when needed.
:::
:::hint
`groups.setdefault(len(w), []).append(w)`
:::
:::explain
`setdefault` returns the list that is already there, so `append` adds to it instead of replacing it.
:::
::::

Now put it together. Real data often needs every category to appear in the answer, even the empty ones.

::::exercise ex-classify kind=write
Write `classify(items, kinds)`. Each item is a tuple `(name, year, kind)`. Return a dict that has **every** kind in `kinds` as a key (in that order). Each value is the list of items of that kind, sorted by year and then by name.

```python starter
def classify(items, kinds):
    result = {}
    return result
```
```python tests
items = [('B', 2020, 'x'), ('A', 2020, 'x'), ('C', 1999, 'x'), ('D', 2001, 'y')]
kinds = ['x', 'y', 'z']
expected = {
    'x': [('C', 1999, 'x'), ('A', 2020, 'x'), ('B', 2020, 'x')],
    'y': [('D', 2001, 'y')],
    'z': [],
}
check(lambda: classify(items, kinds), expected, "sorted and grouped")
check(lambda: classify([], ['x']), {'x': []}, "no items still has the key")
check(lambda: list(classify(items, ['z', 'y', 'x']).keys()), ['z', 'y', 'x'], "keys follow the order of kinds")
check(lambda: classify([('M', 5, 'x')], ['x']), {'x': [('M', 5, 'x')]}, "one item")
```
```python solution
def classify(items, kinds):
    result = {}
    for kind in kinds:
        result[kind] = []
    for item in items:
        result[item[2]].append(item)
    for kind in kinds:
        result[kind].sort(key=lambda it: (it[1], it[0]))
    return result
```
:::hint
Start the dict with an empty list for every kind before looking at any item.
:::
:::hint
Then loop over the items and append each one to the list for its kind (`item[2]`).
:::
:::hint
Finally sort each list with `.sort(key=lambda it: (it[1], it[0]))`.
:::
:::explain
Creating all keys first guarantees that empty categories appear. Sorting each small list at the end is faster than sorting everything and then splitting.
:::
::::

:::recap
- `sorted(..., key=f)` sorts by `f(item)`; a tuple key breaks ties in order.
- `@dataclass` makes records; `Enum` names a fixed set of choices.
- `d.setdefault(k, []).append(x)` groups items.
- Create keys for empty groups up front when the answer needs them.
:::
