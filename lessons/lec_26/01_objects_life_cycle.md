---
title: Objects and Their Life Cycle
summary: Explain what an object is, tell == from is, and describe how objects are created, used and cleaned up.
minutes: 30
---

# Objects and Their Life Cycle

:::goal What you will be able to do
- Explain what an **object** is (state, behavior, identity).
- Say why "everything in Python is an object".
- Tell apart **equal** (`==`) from **identical** (`is`).
- Describe the life cycle of an object and what **garbage collection** does.
:::

## Everything is an object

In Python, **every value is an object**: numbers, strings, lists, dicts, `True`, `None`, **functions**, and even **types** like `int` and `list`. There is a built-in type called `object`, and `isinstance(x, T)` asks "is `x` a value of type `T`?".

:::try t-everything
Run it. Then add a line that checks `isinstance(print, object)`.

```python starter
print(isinstance(5, object))
print(isinstance('hi', object))
print(isinstance([1, 2], object))
print(isinstance(len, object))
print(isinstance(int, object))
```
:::

::::quiz q-not-object
Which of these is **not** an object in Python?

- [ ] the function `len`
- [ ] the type `int`
- [ ] the value `None`
- [x] None of them: every one is an object
:::hint
Look at what you just ran: functions and types passed the test.
:::
:::hint
The word "everything" in "everything is an object" really means everything.
:::
:::explain
There are no special non-object things in Python. The same ideas (attributes, methods, identity) work for every value you use.
:::
::::

## State and behavior

An object is an entity with **state**, **behavior** and **identity**. **State** is what the object remembers, stored in its **attributes**. **Behavior** is what you can do with it, written as **methods**.

For a list, the state is "which items are in it, in what order". Its methods include `.append(...)`, `.pop()` and `.sort()`.

:::try t-state
Run it. Which line changes the list's state?

```python starter
scores = [80, 90]
scores.append(75)
print(scores)
scores.sort()
print(scores)
```
:::

::::fill f-state
```python
scores = [80, 90]
scores.[[append]](75)
print([[len]](scores))
```
:::hint
You want to add one item to the end of the list.
:::
:::hint
The second blank is a built-in that counts the items. It prints `3`.
:::
::::

## Identity: equal is not the same

Two objects can be **equal** (same contents) and still be **different objects**.

| Operator | Question it answers |
|---|---|
| `a == b` | Do they have the same **contents**? |
| `a is b` | Are they the **very same object**? |

Think of two phones of the same model: equal, but not the same phone.

::::predict p-equal
What does this print?

```python
a = [1, 2]
b = [1, 2]
c = a
print(a == b, a is b, a is c)
```
```text answer
True False True
```
:::hint
`[1, 2]` was typed twice, so two list objects were created.
:::
:::hint
`c = a` does not make a new list. It gives the same list a second name.
:::
:::explain
`a` and `b` have equal contents but are two separate objects. `c` is another name for the object `a` points to, so `a is c` is `True`.
:::
::::

::::exercise ex-equal-not-same kind=write
Write `equal_not_same(a, b)` that returns `True` only when `a` and `b` have equal contents **but are different objects**. Otherwise it returns `False`.

```python starter
def equal_not_same(a, b):
    pass
```
```python tests
x = [1, 2]
check(lambda: equal_not_same([1, 2], [1, 2]), True, "equal contents, different objects")
check(lambda: equal_not_same(x, x), False, "same object")
check(lambda: equal_not_same([1], [2]), False, "different contents")
check(lambda: equal_not_same([], []), True, "two empty lists")
```
```python solution
def equal_not_same(a, b):
    return a == b and a is not b
```
:::hint
You need two tests joined together: one about contents and one about identity.
:::
:::hint
Use `==` for contents and `is not` for "not the same object". Join them with `and`.
:::
:::explain
`a == b` compares contents and `a is not b` compares identity. Two empty lists are equal but are still separate objects, so the last check is `True`.
:::
::::

## Aliases: two names, one object

:::warning
`b = a` is **not** a copy. It gives the same object a second name, so changing it through `b` changes it through `a`.
:::

::::predict p-alias
What does this print?

```python
a = [1, 2]
b = a
b.append(3)
print(a)
```
```text answer
[1, 2, 3]
```
:::hint
How many list objects exist after `b = a`?
:::
:::hint
Only one. `append` changes that one list, whichever name you use.
:::
:::explain
There is a single list with two names. This is why identity matters: mutating a shared object shows through every name.
:::
::::

::::exercise ex-copy-add kind=debug
`copy_and_add(items, new)` should return a **new** list with `new` added at the end, and leave `items` unchanged. It has a bug: it changes the original list. Fix it.

```python starter
def copy_and_add(items, new):
    result = items
    result.append(new)
    return result
```
```python tests
def _original_after():
    original = [1, 2]
    copy_and_add(original, 3)
    return original

def _is_new_object():
    original = [1, 2]
    return copy_and_add(original, 3) is not original

check(lambda: copy_and_add([1, 2], 3), [1, 2, 3], "new item added at the end")
check(_original_after, [1, 2], "original list is unchanged")
check(_is_new_object, True, "result is a different object")
check(lambda: copy_and_add([], 7), [7], "empty list")
```
```python solution
def copy_and_add(items, new):
    result = list(items)
    result.append(new)
    return result
```
:::hint
Look at the first line: `result = items`. What does it really do?
:::
:::hint
You need a real copy of the list, not a second name for it.
:::
:::hint
`list(items)` builds a new list with the same items.
:::
:::explain
`result = items` made an alias, so `append` changed the caller's list. `list(items)` creates a separate object, so the original stays untouched.
:::
::::

## The life cycle of an object

An object lives in three phases:

1. **Construction**: the object is created.
2. **Use**: you read it, change it, call its methods.
3. **Destruction**: the object is removed and its memory freed.

:::try t-life
Run it. Mark each line as construction or use.

```python starter
def f():
    x = list('abc')
    x.pop()
    x.append(5)
    print(x)

f()
```
:::

::::quiz q-phase
In which phase of the life cycle is the line `x.append(5)`?

- [ ] Construction
- [x] Use
- [ ] Destruction
:::hint
Was a new object created, or an existing one changed?
:::
:::hint
Calling a method on an object that already exists is part of using it.
:::
:::explain
The list already existed, and `append` changed it. That is use.
:::
::::

## Destruction and garbage collection

You never write a "destroy" line. Python does it for you, some time **after the object can no longer be reached**. This automatic cleanup is **garbage collection** (GC).

- GC happens at some **unspecified point in the future**.
- There is **no set time**. It is only guaranteed to happen eventually.
- An object about to be destroyed is notified, so it can run cleanup code, such as closing a file.

:::key
You cannot rely on garbage collection for timing. Things that must be cleaned up right away, like files, use a `with` block.
:::

::::quiz q-gc
When exactly is an unused object destroyed?

- [ ] The instant its last name goes away, always
- [ ] When you call `destroy()` on it
- [x] At some unspecified time after it becomes unreachable
- [ ] Only when the program ends
:::hint
Think of leaving trash by the door: a truck will come, but you do not know when.
:::
:::hint
Python has no `destroy()` for you to call.
:::
:::explain
Destruction is automatic and happens when the garbage collector runs, which is not at a time you control.
:::
::::

::::quiz q-with
(Review of Lecture 25.) Why do we write `with open(...) as file:` instead of waiting for garbage collection to close the file?

- [ ] Because garbage collection never closes files
- [x] Because GC timing is unpredictable, but `with` closes the file as soon as the block ends
- [ ] Because `with` makes the file load faster
:::hint
Which of the two has a guaranteed time for closing?
:::
:::hint
Read the key box above: files must be closed right away.
:::
:::explain
GC will eventually clean up, but you cannot say when. `with` closes the file exactly when the block ends.
:::
::::

## Putting it together

::::exercise ex-describe-pair kind=write
Write `describe_pair(a, b)` that returns one of three strings:

- `'same object'` if `a is b`
- `'equal but different'` if the contents are equal but they are not the same object
- `'different'` otherwise

```python starter
def describe_pair(a, b):
    pass
```
```python tests
x = [1, 2]
check(lambda: describe_pair(x, x), 'same object', "same object")
check(lambda: describe_pair([1, 2], [1, 2]), 'equal but different', "equal but different")
check(lambda: describe_pair([1], [2]), 'different', "different contents")
check(lambda: describe_pair(3, 4), 'different', "two different numbers")
```
```python solution
def describe_pair(a, b):
    if a is b:
        return 'same object'
    elif a == b:
        return 'equal but different'
    else:
        return 'different'
```
:::hint
Check identity first. If two names are the same object, they are also equal.
:::
:::hint
Use `if a is b`, then `elif a == b`, then `else`.
:::
:::explain
The order matters: a same-object pair would also pass `==`, so `is` must come first. Without that, you could never report `'same object'`.
:::
::::

:::recap
- Everything in Python is an object, including functions and types.
- An object has state (attributes), behavior (methods) and identity.
- `==` asks about contents; `is` asks about identity. `b = a` is not a copy.
- Life cycle: construction, use, destruction. Garbage collection frees unused objects at an unspecified time, so use `with` for things that must close at once.
:::
