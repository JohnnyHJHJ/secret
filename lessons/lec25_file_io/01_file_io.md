---
title: File I/O: Reading and Writing Files
summary: Read lines from a file, write results to a file, and avoid the classic newline and 'w' traps.
minutes: 35
---

# File I/O

:::goal What you will be able to do
- Read text from a file (one line, many lines, everything).
- Write text to a file without accidentally destroying it.
- Build file paths that work on every computer.
- Explain what `stdin` and `stdout` are.
:::

Every code box on this page **runs for real**. Each lesson here makes you type the code yourself, so you get it right away. Stuck? Open **Need help?** under an activity and click the black bars to reveal hints.

## 1. What is I/O?

**I/O = Input / Output.** It is how your program talks to the outside world. So far you only used the terminal: `input()` reads from it and `print()` writes to it. When your program ends, that data is gone. A **file** lets data survive.

::::quiz q-io
Which of these is **output**?

- [ ] `name = input()`
- [x] `print(name)`
- [ ] `name = name.upper()`
::::

## 2. Reading a file

Say `hello.txt` sits next to your program and contains three lines:

```text
Hello World!
This is line two.
Third line here.
```

The basic recipe:

```python
with open('hello.txt') as file:
    line = file.readline()
    print('The first line is:', line)
```

| Piece | Meaning |
|---|---|
| `open('hello.txt')` | Ask the computer to open the file named `hello.txt`. |
| `as file` | Give the opened file a variable name (any name works). |
| `with ... :` | A **context block**: the file is closed automatically when the block ends. |
| `file.readline()` | Read **one line** from the file. |

::::try t-first
Press **Run**. The file `hello.txt` already exists in the folder this code runs in. Look at what is printed, then change `readline()` to something else and run again.

```python starter
with open('hello.txt') as file:
    line = file.readline()
    print('The first line is:', line)
```
```text file:hello.txt
Hello World!
This is line two.
Third line here.
```
::::

Notice the blank line after the output? That is the next gotcha.

### The newline gotcha

Every line in a file ends with an invisible **newline character**, written `'\n'`. `print` adds its own newline on top, so you get an extra blank line. Remove it with `.rstrip()`, which strips whitespace from the **right end** of a string.

::::exercise ex-first-line kind=write
Write a function `first_line(filename)` that opens the file and **returns** its first line **without** the newline.

```python starter
def first_line(filename):
    pass
```
```text file:hello.txt
Hello World!
This is line two.
Third line here.
```
```text file:other.txt
Only one line
```
```python tests
check(lambda: first_line('hello.txt'), 'Hello World!', "hello.txt")
check(lambda: first_line('other.txt'), 'Only one line', "other.txt")
check(uses('With'), True, "uses a with block")
```
```python solution
def first_line(filename):
    with open(filename) as file:
        return file.readline().rstrip()
```
:::hint
Open the file with `with open(filename) as file:`, then call `file.readline()`.
:::
:::hint
`readline()` gives `'Hello World!\n'`. Put `.rstrip()` on the end of it.
:::
:::explain
`rstrip()` removes the `'\n'`, so `'Hello World!\n'` becomes `'Hello World!'`. And `return` inside a `with` is fine: the file still gets closed first.
:::
::::

### The bookmark idea

Python keeps an invisible **bookmark** in the file. It starts at the beginning, and each read moves it forward. Reads continue where the last one stopped.

::::predict p-bookmark
What do these four prints show? Remember: each read continues from the bookmark, and `''` means end of file.

```python
with open('hello.txt') as file:
    print(repr(file.readline()))
    print(repr(file.readline()))
    print(repr(file.readline()))
    print(repr(file.readline()))
```
```text file:hello.txt
Hello World!
This is line two.
Third line here.
```
```text answer
'Hello World!\n'
'This is line two.\n'
'Third line here.\n'
''
```
:::hint
Every line of the file ends with `'\n'`. And after the last line, there is nothing left to read.
:::
:::explain
`readline()` returns an **empty string `''`** at the end of the file. A blank line in the middle of a file is `'\n'`, which is *not* empty, so you can tell them apart.
:::
::::

Quick self-test: what does `readline()` return when there is nothing left to read? Say it out loud, then **click the black bar** to check: ||an empty string `''`||.

### All the ways to read

| Method | Returns | Use when |
|---|---|---|
| `file.readline()` | the next **one line** | you want to go line by line manually |
| `file.read(n)` | up to the next **n characters** | you want a fixed-size chunk |
| `file.read()` | **everything remaining** as one string | the file is small |
| `file.readlines()` | **all lines** as a list | the file is small and you want a list |
| `for line in file:` | one line per loop turn | line by line (also good for big files) |

::::fill f-read
Fill in the blanks to print every line of the file, without the extra blank lines.

```python
[[with]] open('hello.txt') [[as]] file:
    [[for]] line [[in]] file:
        print(line.[[rstrip]]())
```
::::

::::exercise ex-sum kind=write
`numbers.txt` has one integer per line. Write `sum_file(filename)` that returns the **sum** of all the numbers. Use a `for` loop over the file.

```python starter
def sum_file(filename):
    total = 0
    # your code here
    return total
```
```text file:numbers.txt
10
20
30
```
```text file:more.txt
5
7
9
-1
```
```python tests
check(lambda: sum_file('numbers.txt'), 60, "numbers.txt")
check(lambda: sum_file('more.txt'), 20, "more.txt (has a negative)")
check(uses('With', 'For'), True, "uses with and for")
```
```python solution
def sum_file(filename):
    total = 0
    with open(filename) as file:
        for line in file:
            total += int(line)
    return total
```
:::hint
Open the file with `with`, loop `for line in file:`, and add to `total` inside the loop.
:::
:::hint
`line` is a string like `'10\n'`. Turn it into a number with `int(line)`.
:::
:::explain
`int('10\n')` works, because `int` ignores surrounding whitespace, so no `rstrip` was needed. But `'10\n' == '10'` is `False`, so if you **compare** strings you must `rstrip()` first.
:::
::::

:::warning Process data after the file is closed
Once you have read what you need into a variable, do the heavy work **outside** the `with` block (unindented). Computers have trouble when too many files are open, and the variable is still there after the block ends. The only reason to stay inside is when you handle the file piece by piece (huge files).
:::

## 3. Writing to a file

`open` takes an optional second argument, the **mode**: `'r'` = read (the default), `'w'` = write.

:::danger 'w' wipes the file
Opening an existing file in `'w'` mode **erases everything in it immediately**, before you even write anything. If the file does not exist yet, `'w'` creates it. Double-check the filename and mode!
:::

```python
with open('hello.txt', 'w') as file:
    file.write('Hello World!\n')     # way 1: you add \n yourself
    print('Hello', 'World!', file=file)   # way 2: print adds \n for you
```

| | `file.write(...)` | `print(..., file=file)` |
|---|---|---|
| Adds a newline? | **No** | **Yes** |
| Accepts non-strings? | No (must be `str`) | Yes |
| `sep=` / `end=`? | No | Yes |

::::predict p-write
Two writes without newlines. What does `out.txt` contain? (The code then prints the file back.)

```python
with open('out.txt', 'w') as file:
    file.write('one')
    file.write('two')

with open('out.txt') as file:
    print(file.read())
```
```text answer
onetwo
```
:::hint
`write` does not add `'\n'`. So where does the first word end?
:::
:::explain
Both words land on **one line**: `onetwo`. Fix: `file.write('one\n')`, or use `print('one', file=file)`.
:::
::::

::::exercise ex-squares kind=write
Write `write_squares(filename, n)` that writes the squares of `1` to `n` into the file, **one per line**. For `n = 5` the file contains `1`, `4`, `9`, `16`, `25` on separate lines. Use `print(..., file=file)`.

```python starter
def write_squares(filename, n):
    pass
```
```python tests
write_squares('squares.txt', 5)
check_file('squares.txt', '1\n4\n9\n16\n25', "n = 5")
write_squares('s2.txt', 3)
check_file('s2.txt', '1\n4\n9', "n = 3")
check(uses('With'), True, "uses with")
```
```python solution
def write_squares(filename, n):
    with open(filename, 'w') as file:
        for i in range(1, n + 1):
            print(i * i, file=file)
```
:::hint
Open with mode `'w'`, loop `for i in range(1, n + 1):`.
:::
:::hint
Inside the loop: `print(i * i, file=file)`. The `print` adds the newline and converts the number for you.
:::
:::explain
`file.write(i * i)` would crash with a `TypeError` because `write` needs a string. `print(..., file=file)` converts and adds `'\n'`.
:::
::::

::::exercise ex-copy-upper kind=write
Write `copy_upper(src, dest)` that copies the text of `src` into `dest` with everything in **UPPERCASE**. Read it all, close the file, then write (two separate `with` blocks).

```python starter
def copy_upper(src, dest):
    pass
```
```text file:a.txt
hello
world
```
```python tests
copy_upper('a.txt', 'b.txt')
check_file('b.txt', 'HELLO\nWORLD', "b.txt is uppercase")
check(lambda: read_file('a.txt').strip(), 'hello\nworld', "a.txt is left unchanged")
check(lambda: SOURCE.count('with') >= 2, True, "two with blocks")
```
```python solution
def copy_upper(src, dest):
    with open(src) as srcf:
        text = srcf.read()
    with open(dest, 'w') as targf:
        targf.write(text.upper())
```
:::hint
First `with open(src) as srcf:` and `text = srcf.read()`. Then a **second** `with open(dest, 'w') as targf:`.
:::
:::explain
Simple is better than complex: small files do not need both open at once. (You *can* open two files in one `with`, separated by a comma, which is useful for huge files.)
:::
::::

## 4. Paths: files in other folders

Mac/Linux use `/` between folders, Windows uses `\`. So `'path/to/hello.txt'` can break on Windows. Use **`pathlib`**:

```python
from pathlib import Path

path = Path('path') / 'to' / 'hello.txt'
with path.open() as file:
    data = file.read()
```

`Path(...) / 'name'` builds a path with the right separator for your OS. (That `/` on a `Path` is **operator overloading**: the type defines what `/` means for it.)

::::fill f-path
Build the portable path for `data/input/file.txt`.

```python
from pathlib import [[Path]]

path = Path('data') [[/]] 'input' / 'file.txt'
```
::::

## 5. stdin and stdout: the terminal as a file

```python
from sys import stdin, stdout
```

`stdin` is the "file" that reads from the terminal; `stdout` writes to it. So `print(x)` is the same as `print(x, file=stdout)`, and you can loop over `stdin` like a file. They are "file-like" enough: that is **duck typing**.

::::exercise ex-stdin kind=write
The program's input (shown in the box below the code) is a few lines. Write code that reads every line from `stdin` and prints each one **in uppercase**. Press **Run** to try it, then **Check**.

```python starter
from sys import stdin

# loop over stdin here
```
```text stdin
apple
banana
cherry
```
```text expect_output
APPLE
BANANA
CHERRY
```
```python solution
from sys import stdin

for line in stdin:
    print(line.rstrip().upper())
```
:::hint
`for line in stdin:` works exactly like looping over a file.
:::
::::

## 6. Common errors

| Error | Likely cause |
|---|---|
| `FileNotFoundError` | Wrong filename/path, or the program runs from a different folder than you think. |
| `ValueError: invalid literal for int()` | A line was not a valid integer (blank line, or text). |
| `TypeError: write() argument must be str` | You passed a non-string to `.write()`. |
| `io.UnsupportedOperation: not writable` | Opened in read mode but tried to write. |
| `ValueError: I/O operation on closed file` | You used `file` after the `with` block ended. |
| Output all on one line | Forgot `'\n'` with `.write()`. |
| File emptied unexpectedly | You opened it with `'w'`. |

::::quiz q-notes
A file `notes.txt` has 500 lines. You run `open('notes.txt', 'w')` and immediately close it. What is in the file now?

- [ ] All 500 lines, unchanged
- [ ] Only the first line
- [x] Nothing: it is empty
- [ ] The program crashes
:::hint
Which mode wipes the file?
:::
:::explain
`'w'` truncates the file the moment it is opened.
:::
::::

:::recap
- `with open(name) as file:` every time.
- `readline()` one line, `read()` everything, `for line in file` line by line. Lines end in `'\n'`, so `rstrip()`.
- `'w'` **wipes** the file; `write` needs a string and no auto newline; `print(..., file=file)` adds one.
- Use `Path('a') / 'b'` for portable paths. `stdin` / `stdout` are file-like.
:::
