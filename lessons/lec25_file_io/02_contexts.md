---
title: Contexts: the with statement
summary: Why with open(...) exists, what it guarantees, and how it behaves on return and errors.
minutes: 20
---

# Contexts (the `with` statement)

:::goal What you will be able to do
- Explain **why** `with open(...)` exists (and why plain `open` + `close` is risky).
- Say what a **context** is and what `with` guarantees.
- Recognize other resources that need the same treatment.
:::

## 1. Why files must be closed

Your computer's **Operating System (OS)** manages the file system and gives each program its own memory. If your program touches a file, it must **ask the OS** to open it, and later to close it. `open(...)` asks the OS to open; `.close()` asks it to close. Forget to close and the file may get corrupted, or the OS may struggle with too many open files.

The "obvious" code:

```python
file = open('hello.txt')
line = file.readline()
file.close()
```

## 2. The problem: errors skip your close()

::::predict p-skip
`bad.txt` has the single line `hello`. Run it in your head: does `file.close()` ever run? The code catches the error so it can print what happened. What gets printed?

```python
try:
    file = open('bad.txt')
    value = int(file.readline())
    file.close()
    print('closed normally')
except ValueError:
    print('ValueError, and closed?', file.closed)
```
```text file:bad.txt
hello
```
```text answer
ValueError, and closed? False
```
:::hint
`int('hello')` raises `ValueError` **before** the `close()` line. What does `file.closed` say about a file that was never closed?
:::
:::explain
The error jumped straight past `file.close()`, so the file is still open (`file.closed` is `False`). We need: "no matter HOW we leave this code, close the file." That is `with`.
:::
::::

## 3. The with statement

```python
with open('hello.txt') as file:
    line = file.readline()      # file is OPEN here

# file is already CLOSED here
```

:::key The big idea
A `with` statement **opens a resource**, lets you use it in an indented block (the **context**), and when you leave the block it is **cleaned up**, **no matter how you exit**.
:::

::::quiz q-exits
In which ways can you leave a `with` block and the file is **still** closed? Pick all that apply.

- [x] Normal exit (the block just ends)
- [x] A `return` inside the block
- [x] An exception raised inside the block
- [ ] None. You must still call `.close()` yourself
:::hint
`with` guarantees cleanup. How many of the exits does it cover?
:::
:::explain
All three. And the exception is **not** swallowed: the file is closed first, then the error keeps travelling upward as normal.
:::
::::

::::exercise ex-closed kind=write
Prove it. Write `is_closed_after(filename)` that opens the file in a `with` block, and **returns** whether the file is closed **after** the block. (Use the `closed` attribute of the file object.) The answer should be `True`.

```python starter
def is_closed_after(filename):
    pass
```
```text file:hello.txt
Hello World!
```
```python tests
check(lambda: is_closed_after('hello.txt'), True, "closed after the with block")
check(uses('With'), True, "uses with")
```
```python solution
def is_closed_after(filename):
    with open(filename) as file:
        pass
    return file.closed
```
:::hint
The `return` must be **unindented**, after the `with` block, so the block has already ended.
:::
:::hint
Inside the block write `pass`. After it: `return file.closed`.
:::
:::explain
Using the **file object** after the block is fine for checking `.closed`, but reading from it (`file.read()`) would raise `ValueError: I/O operation on closed file`.
:::
::::

::::exercise ex-return-in-with kind=write
Write `starts_with_x(filename)` that returns `True` if the first line of the file starts with `'X'`, else `False`. Return from **inside** the `with` block, which is perfectly safe.

```python starter
def starts_with_x(filename):
    pass
```
```text file:yes.txt
Xylophone
second
```
```text file:no.txt
apple
```
```python tests
check(lambda: starts_with_x('yes.txt'), True, "yes.txt")
check(lambda: starts_with_x('no.txt'), False, "no.txt")
```
```python solution
def starts_with_x(filename):
    with open(filename) as file:
        return file.readline().startswith('X')
```
:::hint
`str.startswith('X')` already returns a `bool`.
:::
::::

## 4. Common mistakes

Mistake 1: **using the file after the block**.

::::predict p-closed-file
What does this print? (The error is caught so the program finishes.)

```python
with open('hello.txt') as file:
    pass
try:
    print(file.read())
except ValueError as e:
    print('ValueError:', e)
```
```text file:hello.txt
Hello World!
```
```text answer
ValueError: I/O operation on closed file.
```
:::hint
The block ended, so the file is closed. Python's exact message ends with a period.
:::
:::explain
Fix: read inside the block, store it in a variable, use the variable outside.
:::
::::

::::exercise ex-fix-closed kind=debug
This function crashes with `ValueError: I/O operation on closed file`. Fix it so it returns the whole text of the file. Keep the `with`.

```python starter
def read_all(filename):
    with open(filename) as file:
        pass
    return file.read()
```
```text file:hello.txt
Hello World!
```
```python tests
check(lambda: read_all('hello.txt').strip(), 'Hello World!', "returns the text")
check(uses('With'), True, "still uses with")
```
```python solution
def read_all(filename):
    with open(filename) as file:
        data = file.read()
    return data
```
:::hint
Move the `read()` **into** the block and save it in a variable.
:::
::::

Mistakes 2 and 3: forgetting that **indentation = inside the block** (do heavy work *after* reading, outside), and forgetting the **colon `:`** after the `with ... as ...` line.

## 5. What counts as a resource?

`with` sets up and tears down external **resources**: a file, a connection to a website, a connection to another computer, a database connection, a database transaction. Common theme: each must be "closed" when you are done. Most already come with modules that do the work; **all you do is use `with`.**

::::quiz q-resources
Which is **not** a typical resource you would use `with` for?

- [ ] A database connection
- [ ] A connection to a website
- [x] A plain `int` variable like `x = 5`
- [ ] A file
::::

## 6. Bonus: making your own context

You will not need this until later, but recognize the pattern:

```python
from contextlib import contextmanager

@contextmanager
def my_resource():
    try:
        print('setup')
        yield 'the resource'
    finally:
        print('teardown')

with my_resource() as r:
    print('using', r)
```

::::predict p-ctx
What is printed, in order? (Code before `yield` = setup, the value after `yield` goes to the `as` variable, `finally` = teardown and **always** runs.)

```python
from contextlib import contextmanager

@contextmanager
def my_resource():
    try:
        print('setup')
        yield 'the resource'
    finally:
        print('teardown')

with my_resource() as r:
    print('using', r)
```
```text answer
setup
using the resource
teardown
```
:::hint
Order of events: enter the `with` (setup) → run the body → leave the `with` (teardown).
:::
::::

:::recap
- Unclosed files can corrupt / hog the OS; a manual `close()` is skipped by errors.
- `with` **guarantees** cleanup on normal exit, `return` and errors. Errors still propagate **after** cleanup.
- Read inside the block, store in a variable, use it after the block.
- Resources: files, website/computer connections, database connections and transactions.
:::
