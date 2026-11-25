---
title: Lesson Title Here
summary: One sentence saying what the learner will be able to do.
minutes: 20
---

# Lesson Title Here

:::goal What you will be able to do
- Goal one.
- Goal two.
:::

Teach ONE small idea in a few sentences. Then make the learner use it right away.

:::try t-demo
Press **Run** and watch what happens. Then change a value and run again.

```python starter
print("hello")
```
:::

::::exercise ex-example kind=write
Write `double(n)` that returns `n` times two.

```python starter
def double(n):
    pass
```
```python tests
check(lambda: double(4), 8, "double(4)")
check(lambda: double(-1), -2, "double(-1)")
```
```python solution
def double(n):
    return n * 2
```
:::hint
Use the `*` operator.
:::
:::hint
`return n * 2`
:::
:::explain
`return` hands a value back to the caller.
:::
::::

::::predict p-example
What does this print?

```python
x = 3
x = x + 1
print(x)
```
```text answer
4
```
:::hint
Trace it line by line.
:::
::::

:::fill f-example
```python
[[def]] double(n):
    [[return]] n * 2
```
:::

:::quiz q-example
Which keyword sends a value back from a function?

- [ ] `print`
- [x] `return`
- [ ] `input`
:::

:::recap
- Key point one.
- Key point two.
:::
