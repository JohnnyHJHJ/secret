---
title: Types, Classes, and Hiding Details
summary: Explain the difference between a type and a class, and use encapsulation and the leading underscore to hide internal details.
minutes: 25
---

# Types, Classes, and Hiding Details

:::goal What you will be able to do
- Define a **type** and a **class** and say how they differ.
- Explain **abstraction** and **encapsulation** in your own words.
- Use a leading underscore for private attributes.
- Write a class whose internals are hidden behind public methods.
:::

## A type is a set of values

You have used the word "type" for a long time. Here is the definition: a **type** is a **set of values**. That is all. The set can be infinite (all the integers), and it can be odd: a type with only `3`, `"pie"` and `227`, or all the `int`s together with all the `str`s.

:::try t-hints
Type hints describe these sets, but Python does not enforce them when the code runs (separate tools can check them). Run it, then look at the last line.

```python starter
from typing import Literal

x: Literal[3, "pie", 227] = "pie"
y: int | str = 3
print(x, y)
x = 5
print(x)
```
:::

::::quiz q-type-def
Which one is the best definition of a **type**?

- [ ] A template that says how to build an object.
- [x] A set of values.
- [ ] A function that creates values.
- [ ] A kind of variable.
:::hint
The definition is only a few words long and talks about a collection.
:::
:::hint
The other options describe classes or other ideas.
:::
:::explain
A type is just a set of values, with almost no restriction. `int | str` is a perfectly good type: every int plus every str.
:::
::::

## A class is a template

A **class** is a **template** that says how to **create** an object (the constructor), what **state** it keeps (attributes) and what it can do (methods). In Python, creating a class also creates a type: the set of **all its instances**.

::::quiz q-class-vs-type
Which statements are true? Select all that apply.

- [x] A class is a template for making objects.
- [x] In Python, defining a class also gives you a type: the set of its instances.
- [ ] Every type is a class with a constructor.
- [ ] A type must list its methods and attributes.
:::hint
`Literal[3, "pie", 227]` is a type. Does it have a constructor or methods?
:::
:::hint
Two statements describe classes. The wrong ones claim every type is a class.
:::
:::explain
Types are only sets of values, so they have no constructor and need no methods. Classes are templates, and each class gives rise to a type.
:::
::::

## Abstraction and encapsulation

Look at this line:

```python
small_grid = big_grid.subgrid((1, 2), (3, 5))
```

You know **what** `subgrid` does. You do not know **how**, and you do not know which attributes a `Grid` holds inside. It does not matter. This is **abstraction** (details hidden behind a name) and **encapsulation** (like a medicine **capsule**: you trust it works without seeing inside). Together they are part of **object-oriented programming** (OOP).

A car is the same: you use the wheel and pedals, and a mechanic can swap the engine without changing how you drive.

:::key The leading underscore
A name that starts with `_` (like `self._coins`) is **private by convention**: it says "other code is not meant to touch this". Python does not stop you; it is a polite request. Use the public methods instead.
:::

:::try t-piggy
Run it, then read both outputs. The last line works, but it breaks the "please don't" rule.

```python starter
class PiggyBank:
    def __init__(self):
        self._coins = []

    def add(self, coin):
        self._coins.append(coin)

    def count(self):
        return len(self._coins)

bank = PiggyBank()
bank.add(5)
bank.add(10)
print(bank.count())
print(bank._coins)
```
:::

::::predict p-counter
What does this print?

```python
class Counter:
    def __init__(self):
        self._count = 0

    def click(self):
        self._count += 1

    def value(self):
        return self._count

c = Counter()
c.click()
c.click()
print(c.value())
print(c._count)
```
```text answer
2
2
```
:::hint
Each `click()` adds 1 to `_count`.
:::
:::hint
Python lets you read `c._count`, even though you are not supposed to.
:::
:::explain
The underscore is only a convention, so `c._count` still works. Code that relies on it will break if the class changes its insides later. Prefer `c.value()`.
:::
::::

::::fill f-lamp
```python
class Lamp:
    def __init__(self):
        self.[[_on]] = False

    def toggle(self):
        self._on = [[not]] self._on

    def is_on(self):
        return self.[[_on]]
```
:::hint
Private attributes start with an underscore.
:::
:::hint
To flip a True/False value, use the keyword that negates it.
:::
:::hint
All three attribute blanks use the same name: `_on`.
:::
::::

::::exercise ex-wallet kind=write
Write a class `Wallet` that hides a list of amounts in a private attribute.

- `Wallet()` starts empty.
- `add(amount)` stores an amount.
- `total()` returns the sum of all amounts (0 when empty).

```python starter
class Wallet:
    def __init__(self):
        pass

    def add(self, amount):
        pass

    def total(self):
        pass
```
```python tests
def two_adds():
    w = Wallet()
    w.add(5)
    w.add(10)
    return w.total()

def independent():
    a = Wallet()
    b = Wallet()
    a.add(7)
    return b.total()

check(lambda: Wallet().total(), 0, "a new wallet totals 0")
check(two_adds, 15, "5 + 10 = 15")
check(independent, 0, "two wallets do not share money")
check(uses('ClassDef'), True, "defines a class")
```
```python solution
class Wallet:
    def __init__(self):
        self._amounts = []

    def add(self, amount):
        self._amounts.append(amount)

    def total(self):
        return sum(self._amounts)
```
:::hint
Create the list in `__init__`, so every wallet gets its own list.
:::
:::hint
Store it as `self._amounts = []` and use `append` in `add`.
:::
:::hint
`total` can be `return sum(self._amounts)`.
:::
:::explain
Users only call `add` and `total`. You could later change the inside (for example, keep a running total instead of a list) and nobody's code would break. That is the benefit of encapsulation.
:::
::::

::::quiz q-encapsulation
Why does encapsulation help?

- [ ] It makes Python refuse access to names that start with `_`.
- [x] Code that only uses public methods keeps working even if the internals change.
- [ ] It makes every method run faster.
- [ ] It removes the need to write methods.
:::hint
Think about swapping the engine of a car.
:::
:::hint
Python does not block `_names`. It only asks you not to use them.
:::
:::explain
Users depend on **what** the object does, not **how**. That freedom to change the insides is the main payoff.
:::
::::

:::recap
- A **type** is a set of values. A **class** is a template; defining one also creates a type (its instances).
- **Abstraction** hides details behind operations; **encapsulation** hides internal state.
- `_name` means "private, do not touch" (a convention, not a lock).
- Use the public methods, so the internals can change safely.
:::
