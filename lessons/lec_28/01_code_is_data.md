---
title: Code is Data and Interpreters
summary: Explain what an interpreter is and name the steps it takes to turn text into a running program.
minutes: 20
---

# Code is Data and Interpreters

:::goal
By the end you can explain why a program's source code is just text (data) and describe the pipeline an interpreter follows: tokenize, parse, run.
:::

## Programs are just text

A Python file is a string of characters. That means a Python program can **receive another program as input**, the same way it can receive a name or a number.

```python
def execute(code: str):
    ...  # solve: run the program described by `code`
```

A program that does this job is called an **interpreter**. The `python3` command on your computer is one: it takes Python code as input and "runs" it.

:::key Code is data
Source code is only text, so one program can read, analyze, transform and run another program. Everything in this lesson builds on that fact.
:::

::::quiz q-interpreter
What is an **interpreter**?

- [ ] A program that translates English into Python
- [x] A program that takes code as input and runs it
- [ ] A program that only checks code for spelling mistakes
- [ ] A special kind of variable that stores functions
:::hint
Think about what `python3 myfile.py` does with the file you give it.
:::
:::hint
The key word is "runs": the input is code, and the output is behavior.
:::
:::explain
An interpreter takes code as its input and executes it. `python3` is the interpreter for Python.
:::
::::

::::quiz q-code-text
To a program that reads a `.py` file as input, what is the file's content?

- [ ] Executable instructions that run automatically
- [ ] A list of function objects
- [x] Just a string of characters, like any other text
- [ ] A dictionary of variable names and values
:::hint
Opening a `.py` file with `open(...).read()` gives you what type?
:::
:::explain
Reading a file gives a `str`. Nothing runs until something (an interpreter) decides to treat that text as code.
:::
::::

## Why running code is harder than it looks

Start with the easy case: variable assignments, arithmetic and `print`.

```python
x = 5
y = x + 2
z = x * y - 123
print(y)
print(z)
```

Now add `if`, `else` and `for`. How do you find where a block begins and ends? What about a block inside a block? **Nesting is the hard part.** The rest of the course will keep returning to it.

::::quiz q-hard-part
Which feature makes interpreting code much harder than interpreting a flat list of assignments?

- [ ] Using the `print` function
- [ ] Having more than one variable
- [x] Nested blocks, such as an `if` inside a `for`
- [ ] Writing numbers with more than one digit
:::hint
Which feature forces you to keep track of "where am I inside what"?
:::
:::explain
Flat statements can be handled one at a time. Nested blocks require tracking structure, which is why parsing needs recursion or a stack.
:::
::::

## The pipeline

An interpreter works in stages.

1. **Tokenize.** Group characters into meaningful units called **tokens**.
2. **Parse.** Arrange the tokens into a tree called an **abstract syntax tree** (AST).
3. **Run.** Walk the tree and simulate what the code says.

Steps 1 and 2 are the **compilation** phase. Step 3 is the **runtime** phase.

For example, `val = int(input("Enter val"))` becomes these tokens:

```text
'val'  '='  'int'  '('  'input'  '('  '"Enter val"'  ')'  ')'
```

::::quiz q-token-count
How many tokens does `print(x, 1)` contain?

- [ ] 3
- [ ] 4
- [x] 6
- [ ] 9
:::hint
Parentheses and commas count as tokens too.
:::
:::hint
List them one by one: `print`, then the opening parenthesis, and so on.
:::
:::explain
The tokens are `print`, `(`, `x`, `,`, `1`, `)`: six in total. Spaces only separate tokens and are not tokens themselves.
:::
::::

::::quiz q-pipeline-order
Put the stages in the correct order.

- [ ] Run, then parse, then tokenize
- [ ] Parse, then tokenize, then run
- [x] Tokenize, then parse, then run
- [ ] Tokenize, then run, then parse
:::hint
You can't build a tree out of raw characters. What must exist first?
:::
:::explain
Characters are grouped into tokens, tokens are arranged into a tree, and only then can the tree be run.
:::
::::

## Indentation as parentheses

Python uses indentation instead of braces. A tokenizer handles this by emitting a special `INDENT` token when indentation increases and a `DEDENT` token when it decreases. They behave like `(` and `)`, so blocks can be matched the same way.

```text
if a:
    for v in b:
        x
y
```

::::quiz q-dedent
In the code above, how many `DEDENT` tokens appear before `y`?

- [ ] 0
- [ ] 1
- [x] 2
- [ ] 3
:::hint
Every `INDENT` needs a matching `DEDENT`, just like parentheses.
:::
:::hint
Count how many levels of indentation you have to leave to get back to `y`.
:::
:::explain
The code indents twice (into the `if`, then into the `for`). Returning to column 0 for `y` closes both blocks, so two `DEDENT` tokens are emitted.
:::
::::

::::quiz q-phases
Which stage belongs to the **runtime** step rather than the compilation step?

- [ ] Tokenizing the text
- [ ] Parsing tokens into a tree
- [x] Simulating the code: storing variables and handling calls
- [ ] Reporting a missing colon
:::hint
Compilation is about understanding the text. Runtime is about doing what it says.
:::
:::explain
Tokenizing and parsing (which also catches syntax errors) happen before anything runs. Keeping variables and a call stack happens while running.
:::
::::

:::note Python in Python
With a lot of work you can tokenize, parse and run Python **using Python**. CPython, the standard `python3`, is written in C. More on this in CS 155 and CS 21.
:::

:::recap
- Code is text, so programs can process programs.
- An interpreter takes code as input and runs it.
- Pipeline: tokenize, parse into an AST, run.
- `INDENT` and `DEDENT` tokens act like parentheses around blocks.
:::