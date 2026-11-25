---
title: The Stack ADT
summary: Describe a Stack by its behavior alone and write several different implementations that behave the same.
minutes: 40
---

# The Stack ADT

:::goal What you will be able to do
- Explain what an **abstract data type** (ADT) is.
- Use `push`, `pop` and `is_empty` on a stack.
- Write a Stack with a list, and with a sentinel.
- Make a Stack that accepts starting values.
:::

An **abstract data type (ADT)** is a type described only by how it **behaves**, with no mention of how it is built. Our first one is the **Stack**, like a pile of plates: you add to the top and take from the top.

- `Stack()` makes an empty stack.
- `.push(x)` puts `x` on top.
- `.pop()` removes and returns the top item. It raises `ValueError` if the stack is empty.
- `.is_empty()` says whether the stack is empty.

A stack is **LIFO**: **L**ast **I**n, **F**irst **O**ut.

::::quiz q-lifo
You push `'a'`, then `'b'`, then `'c'` onto an empty stack, then pop once. What comes back?

- [ ] `'a'`
- [ ] `'b'`
- [x] `'c'`
- [ ] An error
:::hint
The last plate you put on is the first one you take off.
:::
:::hint
Which item was pushed last?
:::
:::explain
LIFO means the most recent push is the first pop. After the pop, `'b'` is on top.
:::
::::

Here is one way to build it: a private list, with the top of the stack at the **end** of the list.

:::try t-stack
Run it. Then push a few more things and pop them to see the order.

```python starter
class Stack:
    def __init__(self):
        self._values = []

    def push(self, val):
        self._values.append(val)

    def pop(self):
        if self._values:
            return self._values.pop()
        raise ValueError

    def is_empty(self):
        return not self._values

s = Stack()
s.push("abc")
s.push("def")
print(s.is_empty())
print(s.pop())
print(s.pop())
print(s.is_empty())
```
:::

::::predict p-stack-use
What does this print?

```python
class Stack:
    def __init__(self):
        self._values = []

    def push(self, val):
        self._values.append(val)

    def pop(self):
        if self._values:
            return self._values.pop()
        raise ValueError

    def is_empty(self):
        return not self._values

s = Stack()
s.push(1)
s.push(2)
s.push(3)
s.pop()
s.push(4)
print(s.pop(), s.pop(), s.pop())
```
```text answer
4 2 1
```
:::hint
Track the stack after every line. Write the top on the right.
:::
:::hint
After the three pushes: 1, 2, 3. The pop removes 3.
:::
:::explain
The stack goes `1 2 3`, then `1 2`, then `1 2 4`. The three pops return `4`, `2`, `1`.
:::
::::

::::fill f-stack-pop
```python
class Stack:
    def __init__(self):
        self._values = []

    def push(self, val):
        self._values.[[append]](val)

    def pop(self):
        if self._values:
            return self._values.[[pop]]()
        raise [[ValueError]]

    def is_empty(self):
        return not self._values
```
:::hint
The top of the stack is the end of the list.
:::
:::hint
Adding to the end is `append`; removing from the end is `pop`.
:::
:::hint
The error for popping an empty stack is `ValueError`.
:::
::::

::::exercise ex-stack kind=write
Write the `Stack` class from scratch, using a private list. `pop()` on an empty stack must raise `ValueError`.

```python starter
class Stack:
    def __init__(self):
        pass

    def push(self, val):
        pass

    def pop(self):
        pass

    def is_empty(self):
        pass
```
```python tests
def order():
    s = Stack()
    s.push('abc')
    s.push('def')
    return [s.pop(), s.pop()]

def after_pops():
    s = Stack()
    s.push(1)
    s.pop()
    return s.is_empty()

def independent():
    a = Stack()
    b = Stack()
    a.push('x')
    return b.is_empty()

check(lambda: Stack().is_empty(), True, "a new stack is empty")
check(order, ['def', 'abc'], "last in, first out")
check(after_pops, True, "empty again after popping everything")
check(independent, True, "two stacks are independent")
check_raises(lambda: Stack().pop(), ValueError, "pop on empty raises ValueError")
```
```python solution
class Stack:
    def __init__(self):
        self._values = []

    def push(self, val):
        self._values.append(val)

    def pop(self):
        if self._values:
            return self._values.pop()
        raise ValueError

    def is_empty(self):
        return not self._values
```
:::hint
Keep the items in a list stored in `self._values`, created in `__init__`.
:::
:::hint
`push` appends. `pop` removes from the end, but only if the list is not empty.
:::
:::hint
An empty list is falsy: `if self._values:` is true when there are items. Otherwise `raise ValueError`.
:::
:::explain
Creating the list inside `__init__` gives each stack its own list. If you made the list outside the method, all stacks would share it.
:::
::::

## Many implementations, one behavior

A different internal design can give exactly the same behavior. Here is an idea: put a **sentinel** at the bottom of the list. A sentinel is a special marker value that is not equal to anything else. `object()` makes a brand-new, unique object. The stack is empty exactly when the top item **is** the marker.

:::try t-sentinel
`is` asks "is this the very same object?". Run it and read the results.

```python starter
a = object()
b = object()
print(a is b)
print(a is a)
print(None is None)
```
:::

::::exercise ex-sentinel kind=complete
Finish this Stack, which keeps a sentinel at the bottom of the list. Fill in `peek` (look at the top without removing it), `push`, `pop` and `is_empty`. `pop` on an empty stack must raise `ValueError`.

```python starter
class Stack:
    def __init__(self):
        self._bottom = object()
        self._values = [self._bottom]

    def peek(self):
        pass

    def push(self, val):
        pass

    def pop(self):
        pass

    def is_empty(self):
        pass
```
```python tests
def peek_top():
    s = Stack()
    s.push('a')
    s.push('b')
    return s.peek()

def pop_order():
    s = Stack()
    s.push(1)
    s.push(2)
    return [s.pop(), s.pop()]

def none_value():
    s = Stack()
    s.push(None)
    return s.is_empty()

check(lambda: Stack().is_empty(), True, "a new stack is empty")
check(peek_top, 'b', "peek shows the top")
check(pop_order, [2, 1], "last in, first out")
check(none_value, False, "pushing None still makes it non-empty")
check_raises(lambda: Stack().pop(), ValueError, "pop on empty raises ValueError")
```
```python solution
class Stack:
    def __init__(self):
        self._bottom = object()
        self._values = [self._bottom]

    def peek(self):
        return self._values[-1]

    def push(self, val):
        self._values.append(val)

    def pop(self):
        if self.is_empty():
            raise ValueError
        return self._values.pop()

    def is_empty(self):
        return self.peek() is self._bottom
```
:::hint
The top of the stack is the last item: `self._values[-1]`.
:::
:::hint
The stack is empty when the top item `is` the sentinel `self._bottom`.
:::
:::hint
`pop` should check `self.is_empty()` first, so the sentinel is never removed.
:::
:::explain
Because `object()` is unique, no value a user pushes can ever be mistaken for it, not even `None`. That is why the sentinel is safer than a normal value as a marker.
:::
::::

::::quiz q-adt
Which statements are true? Select all that apply.

- [x] An ADT is described by its behavior, not by how it is built.
- [x] Two different Stack classes can behave identically while being built differently.
- [ ] The built-in `list` and the Stack ADT are the same thing.
- [ ] Every implementation of an ADT must run equally fast.
:::hint
A list can be used to implement a Stack, but a list has more operations than a Stack.
:::
:::hint
Implementations may differ in **efficiency**, even if they behave the same.
:::
:::explain
The ADT is the *description*, and a class is one *implementation* of it. A list can implement a Stack (with `append` and `pop`), but it is not itself the Stack ADT.
:::
::::

## A stack that starts with values

Sometimes you want to build a stack that already holds items, like `Stack([1, 2, 3])`. The last item given ends up on top. `Stack()` must still give an empty stack.

::::exercise ex-stack-iterable kind=complete
Change the constructor so it accepts an optional iterable of starting values. Use a default argument so `Stack()` still works.

```python starter
class Stack:
    def __init__(self):
        self._values = []

    def push(self, val):
        self._values.append(val)

    def pop(self):
        if self._values:
            return self._values.pop()
        raise ValueError

    def is_empty(self):
        return not self._values
```
```python tests
def three():
    s = Stack([1, 2, 3])
    return [s.pop(), s.pop()]

def from_tuple():
    s = Stack((7, 8))
    return s.pop()

def from_string():
    s = Stack("ab")
    return s.pop()

check(lambda: Stack().is_empty(), True, "Stack() is still empty")
check(three, [3, 2], "the last item given is on top")
check(from_tuple, 8, "a tuple works")
check(from_string, 'b', "a string works too")
```
```python solution
class Stack:
    def __init__(self, values=()):
        self._values = list(values)

    def push(self, val):
        self._values.append(val)

    def pop(self):
        if self._values:
            return self._values.pop()
        raise ValueError

    def is_empty(self):
        return not self._values
```
:::hint
Add a second parameter with a default value so it can be left out.
:::
:::hint
The default can be an empty tuple: `values=()`.
:::
:::hint
`list(values)` copies the items of any iterable, in order.
:::
:::explain
`values=()` makes the argument optional. `list(values)` accepts lists, tuples, strings and more, and puts the items in order so the last one ends up on top.
:::
::::

::::exercise ex-debug-alias kind=debug
This stack accepts starting values, but it has a bug: pushing onto a stack changes the **original** list, and `Stack()` crashes when you push. Fix the constructor.

```python starter
class Stack:
    def __init__(self, values=()):
        self._values = values

    def push(self, val):
        self._values.append(val)

    def pop(self):
        if self._values:
            return self._values.pop()
        raise ValueError

    def is_empty(self):
        return not self._values
```
```python tests
def original_unchanged():
    original = [1, 2]
    s = Stack(original)
    s.push(3)
    return original

def push_on_default():
    s = Stack()
    s.push('x')
    return s.pop()

check(original_unchanged, [1, 2], "the caller's list is not changed")
check(push_on_default, 'x', "push works on Stack()")
check(lambda: Stack([1, 2]).pop(), 2, "pop returns the last item")
```
```python solution
class Stack:
    def __init__(self, values=()):
        self._values = list(values)

    def push(self, val):
        self._values.append(val)

    def pop(self):
        if self._values:
            return self._values.pop()
        raise ValueError

    def is_empty(self):
        return not self._values
```
:::hint
`self._values = values` makes `self._values` point at the **same** object that the caller gave.
:::
:::hint
A tuple has no `append`, which is why `Stack()` crashes.
:::
:::hint
Make a fresh list: `list(values)`.
:::
:::explain
`list(values)` builds a new list, so the stack owns its own data. Encapsulation only works if outside code cannot change your insides by accident.
:::
::::

:::recap
- An **ADT** is defined by behavior: `push`, `pop`, `is_empty` describe a Stack, and **LIFO** is its order.
- Many implementations can behave the same (a list, a sentinel, and more).
- A **sentinel** is a unique marker such as `object()`, checked with `is`.
- `values=()` plus `list(values)` lets a constructor accept any iterable.
:::
