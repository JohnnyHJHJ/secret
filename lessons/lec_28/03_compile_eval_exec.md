---
title: compile, eval, exec and Code Injection
summary: Use Python's built-in tokenizer, parser and runner, and recognize why running user-supplied text is dangerous.
minutes: 25
---

# compile, eval, exec and Code Injection

:::goal
You will use `ast`, `compile`, `eval` and `exec`, and explain why feeding them user input can destroy data.
:::

## Python gives you the pieces

CPython exposes its own tools for every stage of the pipeline.

```python
import tokenize
with open('test.py', 'rb') as file:
    for token in tokenize.tokenize(file.readline):
        print(token)
```

```python
import ast
tree = ast.parse("""
if 1 > 0:
    x = 1
    x += 2
""")
print(ast.dump(tree, indent=4))
```

::::quiz q-ast-module
Which module turns source code into an abstract syntax tree?

- [ ] `tokenize`
- [x] `ast`
- [ ] `locals`
- [ ] `exec`
:::hint
Its name is the abbreviation of "abstract syntax tree".
:::
:::explain
`ast.parse` builds the tree and `ast.dump` prints it. `tokenize` stops earlier, at tokens.
:::
::::

## compile only compiles

```python
code1 = compile('5**2 + 6**2', '<string>', 'eval')
code2 = compile("""
def fib(n):
    return n if n <= 1 else fib(n - 1) + fib(n - 2)
print(fib(6))
""", '<string>', 'exec')
```

`compile` does the whole compilation step and raises `SyntaxError` for invalid code. It does **not run** anything.

## eval and exec run code

```python
print(eval(code1))   # 61
exec(code2)          # defines fib and prints 8
```

You can also give them a string directly; the compile step is done for you.

```python
print(eval('5**2 + 6**2'))
print(eval('(lambda x: x**2)(5) + 6'))
```

::::quiz q-compile-runs
After `code = compile('print("hi")', '<string>', 'exec')`, what has been printed?

- [ ] `hi`
- [x] Nothing yet
- [ ] A `SyntaxError`
- [ ] `<string>`
:::hint
Recall what `compile` is responsible for, and what it is not.
:::
:::hint
To actually run the compiled object you need another function.
:::
:::explain
`compile` only prepares the code. The `print` happens when you call `exec(code)`.
:::
::::

::::quiz q-eval-value
What does `print(eval('(lambda x: x**2)(5) + 6'))` display?

- [ ] `25`
- [ ] `11`
- [x] `31`
- [ ] A `SyntaxError`
:::hint
The lambda squares its argument, then `6` is added.
:::
:::hint
`5**2` is `25`.
:::
:::explain
`(lambda x: x**2)(5)` evaluates to `25`, and `25 + 6 = 31`.
:::
::::

::::quiz q-eval-vs-exec
Which function is the right choice for running a whole block that defines a function and prints something?

- [ ] `eval` with mode `'eval'`
- [x] `exec`
- [ ] `ast.dump`
- [ ] `tokenize.tokenize`
:::hint
`eval` handles a single expression that produces a value.
:::
:::explain
`exec` runs statements, including `def`, loops and `print`. `eval` evaluates one expression and returns its value.
:::
::::

## The danger

:::danger Never eval or exec untrusted text
`eval` and `exec` run **anything** they are given. If a user controls the text, the user controls your program.
:::

```python
age = eval(input("What is your age?"))
print(f"Your age is {age}.")
```

Typing `11` works. So does `10 + 8`. But so does:

```python
(open('database.sqlite3', 'w') and 5)
```

Opening a file in write mode **erases it**, and the program then reports `5` as the age.

::::quiz q-eval-danger
Why is `eval(input("What is your age?"))` unsafe?

- [ ] It is slower than `int(input(...))`
- [ ] It only works for numbers
- [x] The user can type any Python expression, including one that deletes data
- [ ] It forgets the input afterward
:::hint
Think about what `eval` will accept as input besides digits.
:::
:::explain
`eval` runs whatever expression it is given, so the user can run arbitrary code with your program's permissions.
:::
::::

::::quiz q-safe-parse
Which line reads an age safely?

- [ ] `age = eval(input("Age? "))`
- [ ] `age = exec(input("Age? "))`
- [x] `age = int(input("Age? "))`
- [ ] `age = compile(input("Age? "), '<string>', 'eval')`
:::hint
Pick the one that can only turn text into a number.
:::
:::explain
`int(...)` accepts only number text and raises `ValueError` for anything else. It never runs arbitrary code.
:::
::::

## Code injection through string pasting

Even building code with an f-string is risky if it is later executed.

```python
name = input('What is your name?')
code = f"""\
with open('events.log', 'w') as f:
    print('{name}', file=f)
"""
exec(code)
```

If the user enters `Kevin'); open('database.sqlite3', 'w') #`, the quote and parenthesis close the `print` call early, and the rest becomes new code. The `#` turns the leftover text into a comment. This attack is called **code injection**, and it is the same idea as the famous SQL injection joke (xkcd 327).

::::quiz q-injection-fix
What is the best way to fix the program above?

- [ ] Ask users to type their names carefully
- [x] Don't build code from user text; write the name directly with `print(name, file=f)` in normal code
- [ ] Use `eval` instead of `exec`
- [ ] Remove the `#` character from the input
:::hint
Is there a reason the program needs to *run a string as code* at all?
:::
:::hint
The name is data. Keep data and code separate.
:::
:::explain
The name is only data, so there is no need to turn it into code. Passing it as a normal value cannot change the program's behavior. Trying to filter dangerous characters out is fragile and easy to get wrong.
:::
::::

:::recap
- `tokenize`, `ast` and `compile` expose the stages of the pipeline; `compile` does not run anything.
- `eval` runs an expression; `exec` runs statements.
- Never run user-supplied text with `eval` or `exec`: it enables code injection.
- Keep **code** and **data** separate whenever you can.
:::