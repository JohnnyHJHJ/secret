---
title: Reflection and Metaprogramming
summary: Inspect a running program with locals() and friends, and recognize metaprogramming in compilers, macros, transpilers and Lisp.
minutes: 30
---

# Reflection and Metaprogramming

:::goal
You will inspect variables at runtime, define reflection and metaprogramming precisely, and understand why macros and homoiconic languages like Lisp matter.
:::

## Reflection: a program looking at itself

While a program runs, Python keeps variables, attributes and the call stack in data structures. You can read them from your own code.

```python
bbb = 10
def test():
    foo = 5
    bar = 10
    baz = 'c'
    quux = ()
    print('variables starting with b:')
    for var, val in locals().items():
        if var.startswith('b'):
            print(f"variable {var} has value {val}")
test()
```

`locals()` returns the local variables of the current function as a dictionary. Related tools include `globals()`, `vars()`, `getattr()`, `setattr()`, `delattr()`, and metadata such as `__name__`, `__doc__` and `__class__`.

::::quiz q-locals-output
Which variables does the loop above print?

- [ ] `bbb`, `bar` and `baz`
- [x] `bar` and `baz`
- [ ] `foo`, `bar`, `baz` and `quux`
- [ ] Nothing, because `locals()` is empty
:::hint
`locals()` only sees variables local to the function it is called in.
:::
:::hint
Is `bbb` defined inside `test`? Then check which local names start with `b`.
:::
:::explain
`bbb` is global, so it isn't in `test`'s `locals()`. Of the locals, only `bar` and `baz` start with `b`.
:::
::::

::::quiz q-reflection-def
Which statement best defines **reflection**?

- [ ] Printing a variable's value for debugging
- [x] Accessing and modifying a program's own runtime information while it runs
- [ ] Converting source code from one language to another
- [ ] Running code faster by caching results
:::hint
The word suggests a program looking at itself.
:::
:::explain
Reflection means reading and changing runtime information such as variables, attributes and classes, during runtime.
:::
::::

::::quiz q-getattr
Which function reads an attribute whose name is stored in a string variable?

- [ ] `locals()`
- [ ] `delattr()`
- [x] `getattr()`
- [ ] `compile()`
:::hint
The name starts with the verb for "obtain".
:::
:::explain
`getattr(obj, "name")` fetches `obj.name` using a string. `setattr` assigns and `delattr` deletes.
:::
::::

## Metaprogramming

:::key Metaprogramming
**Metaprogramming** is when programs treat programs as data, so they can be accessed and manipulated like any other data. Reflection is one special case of it.
:::

It is used everywhere:

- compilers and interpreters process code as data;
- websites arrive as bits and contain JavaScript that your browser runs;
- **transpilers** (source-to-source compilers) translate, for example, TypeScript into JavaScript, because browsers only run JavaScript;
- **macros** substitute text before parsing.

::::quiz q-transpiler
What does a transpiler do?

- [ ] Runs a program on many computers at once
- [x] Translates a program in one language into a program in another language
- [ ] Finds bugs while the program runs
- [ ] Compresses source code into fewer bytes
:::hint
The usual example turns TypeScript into JavaScript.
:::
:::explain
A transpiler is a source-to-source compiler. Its input is code in one language and its output is code in another.
:::
::::

## Macros are powerful and dangerous

In C, `#define` replaces tokens before the code is parsed.

```c
#include <assert.h>
#include <stdio.h>
#define FOO 2+3
int main() {
    assert(FOO == 5);
    int bar = FOO * 3;
    printf("bar = %d\n", bar);
}
```

::::quiz q-macro-output
What does this C program print?

- [ ] `bar = 15`
- [x] `bar = 11`
- [ ] `bar = 5`
- [ ] Nothing: the `assert` fails
:::hint
The macro substitutes text, not a computed value.
:::
:::hint
Write out `FOO * 3` after substitution and apply normal precedence.
:::
:::explain
`FOO * 3` becomes `2+3 * 3`, which is `2 + 9 = 11`. The `assert` passes because `2+3 == 5`. Macros substitute tokens blindly, so they can break operator precedence.
:::
::::

:::warning Use sparingly
Metaprogramming is powerful and easy to abuse. Use it only when you have a really good reason.
:::

## Same syntax for everything: Lisp

In Python, `min(3, 1)` and `Movie('Happy Death Day', 2017)` look the same, so a class can be passed where a function is expected. Take that idea to the extreme: write **everything** as a parenthesized list.

| Python | Lisp-style |
|---|---|
| `a + b` | `(+ a b)` |
| `f(a, b, c)` | `(f a b c)` |
| `f(a, g(b), c+d)` | `(f a (g b) (+ c d))` |

```text
(define (fac n) (if (= n 0) 1 (* n (fac (- n 1)))))
```

Parsing becomes easy (mostly matching parentheses), and the code is already a nested list. This property is called **homoiconicity**. Lisp has it. Python does not, so metaprogramming is harder in Python.

::::quiz q-lisp-syntax
How would `f(a, g(b), c+d)` be written in this uniform syntax?

- [ ] `f (a, g(b), c+d)`
- [ ] `(f a g b + c d)`
- [x] `(f a (g b) (+ c d))`
- [ ] `((f a) (g b) (c + d))`
:::hint
The operator or function name always comes first inside the parentheses.
:::
:::hint
Both `g(b)` and `c+d` become their own nested lists.
:::
:::explain
Every call, including `+`, is written `(name arguments...)`, and nested calls are nested lists.
:::
::::

::::quiz q-homoiconic
Why does homoiconicity make metaprogramming easier?

- [ ] It makes programs run faster
- [x] A program's structure is already an ordinary nested list, so it is trivial to represent as data
- [ ] It forbids using parentheses
- [ ] It removes the need for any parser
:::hint
Remember what the AST looked like compared with the source text in Python.
:::
:::explain
In Lisp the source text is itself a nested list, so no complicated parsing step is needed to turn code into data. A program can easily build or change code the same way it builds any list.
:::
::::

:::recap
- Reflection: reading and changing runtime information (`locals()`, `getattr()`, ...).
- Metaprogramming: programs treat programs as data; reflection is a special case.
- Macros and `eval` can break things quietly, so use them sparingly.
- Homoiconic languages like Lisp represent code as nested lists, which makes metaprogramming natural.
:::