---
title: Functions That Wrap Functions
summary: Pass functions around, accept any arguments with *args, and write a decorator that reports each call.
minutes: 35
---

# Functions That Wrap Functions

:::goal What you will be able to do
- Treat a function as a value.
- Accept any number of arguments with `*args`.
- Write a decorator that adds behaviour around a function.
:::

In Python a function is a value, like a number. You can store it in a variable or pass it to another function.

:::try t-func-value
Run it. The name `f` and `shout` now refer to the same function.

```python starter
def shout(s):
    return s.upper() + '!'

f = shout
print(f('hi'))
print(f.__name__)
```
:::

::::predict p-func-value
What does this print?

```python
def twice(f, x):
    return f(f(x))

print(twice(lambda n: n + 3, 10))
```
```text answer
16
```
:::hint
`f` is the lambda. It is called two times.
:::
:::hint
First call: 10 becomes 13. Second call: 13 becomes ...
:::
:::explain
`f(f(10))` is `f(13)`, which is 16. The function was passed in just like any other argument.
:::
::::

A **decorator** needs to wrap functions with different numbers of arguments. `*args` collects all positional arguments into a tuple. `f(*args)` spreads that tuple back out.

:::try t-star-args
Run it. Then call `show` with three arguments.

```python starter
def show(*args):
    print(args)

show(1, 'a')
show()
```
:::

::::predict p-args
What does this print?

```python
def count(*args):
    return len(args)

print(count(1, 2, 3), count())
```
```text answer
3 0
```
:::hint
`args` is a tuple of everything that was passed in.
:::
:::explain
Three arguments give a 3-tuple. No arguments give the empty tuple, whose length is 0.
:::
::::

A decorator is a function that takes a function and returns a new **wrapper** function. The wrapper runs extra code and calls the original in the middle.

::::fill f-wrapper
```python
def loud(f):
    def wrapper([[*args]]):
        print('calling', f.__name__)
        return f([[*args]])
    return [[wrapper]]
```
:::hint
The wrapper must accept any number of positional arguments.
:::
:::hint
The decorator returns the new function itself, without calling it. What is its name?
:::
:::explain
`*args` in the definition collects, and `*args` in the call spreads. The decorator returns `wrapper` without parentheses: the function, not its result.
:::
::::

Writing `@loud` above a `def` means `add = loud(add)`.

::::predict p-deco
What does this print?

```python
def loud(f):
    def wrapper(*args):
        print('calling', f.__name__)
        return f(*args)
    return wrapper

@loud
def add(a, b):
    return a + b

print(add(2, 3))
```
```text answer
calling add
5
```
:::hint
`add(2, 3)` runs `wrapper(2, 3)`, which prints first.
:::
:::hint
The `print` outside shows what `wrapper` returned.
:::
:::explain
The wrapper prints `calling add`, then returns `f(2, 3)`, which is 5. The outer `print` shows that 5.
:::
::::

:::warning The forgotten return
If `wrapper` calls `f(*args)` but does not `return` it, every call gives back `None`. The decorated function seems to work but its result is lost.
:::

::::quiz q-return
A wrapper contains `f(*args)` on its own line, with no `return`. What does `add(2, 3)` give?

- [ ] `5`
- [x] `None`
- [ ] A `TypeError`
:::hint
What does a function return when it ends without a `return` statement?
:::
:::explain
The wrapper computes 5 and throws it away, then ends. Functions without `return` give back `None`.
:::
::::

When a decorated function calls itself, it calls the **wrapper**, because the name now refers to the wrapper. This changes the order of output.

::::predict p-order
What does this print?

```python
def log_call(f):
    def wrapper(n):
        result = f(n)
        print(n, '->', result)
        return result
    return wrapper

@log_call
def fact(n):
    return 1 if n <= 1 else n * fact(n - 1)

fact(3)
```
```text answer
1 -> 1
2 -> 2
3 -> 6
```
:::hint
The print happens after `f(n)` finishes, and `f(3)` needs `fact(2)` first.
:::
:::hint
The innermost call, `fact(1)`, finishes first.
:::
:::explain
`fact(3)` waits for `fact(2)`, which waits for `fact(1)`. Calls finish from the inside out, so the printing starts with the smallest argument.
:::
::::

::::exercise ex-log kind=write
Write a decorator `log_call(f)`. The decorated function must still return what `f` returns, and it must also print `NAME(ARGS) -> RESULT`. Here `NAME` is `f.__name__`, `ARGS` are the `repr` of each argument joined with `", "`, and `RESULT` is the `repr` of the result. For example `add(1, 2) -> 3`.

```python starter
def log_call(f):
    def wrapper(*args):
        pass
    return wrapper
```
```python tests
@log_call
def add(a, b):
    return a + b

@log_call
def greet(name):
    return 'hi ' + name

@log_call
def zero():
    return 0

check(lambda: add(1, 2), 3, "still returns the value")
check_output(lambda: add(1, 2), "add(1, 2) -> 3", "prints name, args and result")
check_output(lambda: greet('Ana'), "greet('Ana') -> 'hi Ana'", "uses repr for strings")
check_output(lambda: zero(), "zero() -> 0", "no arguments")
```
```python solution
def log_call(f):
    def wrapper(*args):
        result = f(*args)
        shown = ', '.join(repr(a) for a in args)
        print(f"{f.__name__}({shown}) -> {result!r}")
        return result
    return wrapper
```
:::hint
Call `f(*args)` first and keep the result in a variable.
:::
:::hint
Build the argument text with `', '.join(...)` over `repr(a)` for each `a` in `args`.
:::
:::hint
Print the line, then `return result`.
:::
:::explain
`repr` shows strings with quotes (`'Ana'`), which is what the output format expects. Keeping `result` in a variable lets you both print it and return it.
:::
::::

::::exercise ex-count kind=challenge
Write a decorator `count_calls(f)` so that the decorated function has an attribute `calls` that counts how many times it has been called. It starts at 0.

```python starter
def count_calls(f):
    def wrapper(*args):
        return f(*args)
    wrapper.calls = 0
    return wrapper
```
```python tests
@count_calls
def sq(x):
    return x * x

check(lambda: sq.calls, 0, "starts at 0")
check(lambda: sq(3), 9, "returns the value")
sq(4)
check(lambda: sq.calls, 2, "counted two calls")
check(lambda: sq(5), 25, "still works")
check(lambda: sq.calls, 3, "counted three calls")
```
```python solution
def count_calls(f):
    def wrapper(*args):
        wrapper.calls += 1
        return f(*args)
    wrapper.calls = 0
    return wrapper
```
:::hint
Functions are objects, so `wrapper.calls` is just a variable stored on the function.
:::
:::hint
Increase it inside `wrapper` every time it runs.
:::
:::hint
`wrapper.calls += 1` before returning `f(*args)`.
:::
:::explain
Inside `wrapper`, the name `wrapper` refers to the function itself, so `wrapper.calls += 1` updates the attribute. The counter lives on the function, not in a global variable.
:::
::::

::::quiz q-mix
Earlier you needed the front item of a long queue removed quickly. Which tool fits, and what does it support?

- [ ] A list, because `list.pop(0)` is the fastest way
- [x] A `deque`, because `popleft()` is cheap at the front
- [ ] A decorator, because it wraps `pop`
:::hint
Remember which collection from the previous lesson is built for both ends.
:::
:::explain
A `deque` removes from the front quickly. A decorator changes how a function behaves, which is a different job.
:::
::::

:::recap
- Functions are values: pass them in, return them, store them.
- `*args` collects arguments; `f(*args)` passes them on.
- A decorator takes `f` and returns a `wrapper`; `@d` above `def f` means `f = d(f)`.
- Always `return` the result of `f(*args)` from the wrapper.
- When a decorated function calls itself, it calls the wrapper.
:::
