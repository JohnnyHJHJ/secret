---
title: The Halting Problem
summary: Explain why no program can decide whether every program halts, using Turing's proof by contradiction.
minutes: 25
---

# The Halting Problem

:::goal
You will follow Turing's proof that some questions about programs cannot be answered by any program, and see where "code is data" is essential.
:::

## The question

Suppose we want a function that analyzes code.

```python
def halts(code: str, input_: str) -> bool:
    ...  # True if running `code` on `input_` eventually stops
```

Why not just run the program and wait? Because if it never stops, you will never know. Waiting 10^100 steps proves nothing either.

::::quiz q-simulate
Why doesn't "run it and see" solve the halting problem?

- [ ] Running programs is not allowed
- [x] If the program never halts, you can't tell the difference between "still running" and "runs forever"
- [ ] Interpreters can't run `while` loops
- [ ] The input string is always too long
:::hint
What would you answer after waiting a very long time and still seeing no result?
:::
:::explain
A program that halts eventually proves itself by halting. One that doesn't halt never does. No finite amount of waiting turns "not yet" into "never".
:::
::::

## The proof

**Claim.** No program solves the halting problem for all cases.

**Proof by contradiction.** Suppose such a `halts` exists. Build this program:

```python
def opp(f: str):
    # halts(code, input_) is the supposedly existing solution
    if halts(f, f):
        while True: pass
    else:
        pass
```

`opp(f)` does the **opposite** of what `halts` predicts for program `f` run on its own source text `f`.

- If `halts` says `f(f)` halts, then `opp(f)` loops forever.
- If `halts` says `f(f)` does not halt, then `opp(f)` halts at once.

Now run `opp` on **its own source code**.

::::quiz q-opp-halts-says-yes
Suppose `halts(opp, opp)` returns `True`. What happens when `opp(opp)` runs?

- [ ] It halts, so `halts` was right
- [x] It loops forever, so `halts` was wrong
- [ ] It raises a `SyntaxError`
- [ ] It prints `True`
:::hint
Look at the `if halts(f, f):` branch and what it does.
:::
:::hint
With `f = opp`, the `if` branch is taken, and that branch is `while True: pass`.
:::
:::explain
`halts` claimed `opp(opp)` halts. But the `True` branch makes `opp(opp)` loop forever, so the claim was wrong.
:::
::::

::::quiz q-opp-halts-says-no
Suppose `halts(opp, opp)` returns `False`. What happens when `opp(opp)` runs?

- [ ] It loops forever, so `halts` was right
- [x] It halts immediately, so `halts` was wrong
- [ ] It calls itself forever
- [ ] It depends on the input
:::hint
Now the `else` branch is taken.
:::
:::explain
`halts` claimed `opp(opp)` never halts. But the `else` branch just does `pass`, so `opp(opp)` stops right away, and `halts` was wrong again.
:::
::::

:::key The contradiction
Whatever `halts(opp, opp)` answers, it answers wrongly. So no correct `halts` can exist.
:::

::::quiz q-assumption
Which assumption does a proof by contradiction make, and then show to be impossible?

- [ ] That `opp` is a valid Python function
- [x] That a program `halts` exists that is correct for every program and input
- [ ] That every program eventually halts
- [ ] That Python is homoiconic
:::hint
The proof begins with the words "Suppose there's a program...".
:::
:::explain
We assume a perfect `halts` exists. Building `opp` from it leads to a situation where `halts` must be wrong, so the assumption must be false.
:::
::::

## Why "code is data" matters here

`opp` receives a program's source code **as a string** and passes it into `halts`. It even feeds `opp` its own source code. That only works because code is data: programs can be inputs to programs, including themselves.

::::quiz q-code-is-data-role
What role does "code is data" play in the proof?

- [ ] None; the proof works without it
- [x] It lets a program take its own source code as input
- [ ] It lets `halts` run faster
- [ ] It guarantees that every program halts
:::hint
Look at what is passed to `opp` in the self-referential call.
:::
:::explain
Because source code is just a string, `opp` can be given its own source as input. That self-reference is what creates the paradox.
:::
::::

## What this tells us

- Turing proved this **before** modern computers existed.
- Problems like this one are called **undecidable**: no program solves them for all cases. Many others are known.
- Similar reasoning lets us study limits of devices not yet built, such as quantum computers. See CS 133 (Theory of Computation).

::::quiz q-undecidable
What does it mean for a problem to be **undecidable**?

- [ ] It takes too long to solve on current hardware
- [ ] It has several correct answers
- [x] No program can correctly solve it for all inputs, however much time it gets
- [ ] It can only be solved in Lisp
:::hint
It is a statement about all possible programs, not about speed.
:::
:::explain
Undecidability is a hard limit: no algorithm works for every case, no matter how fast the computer is or how long it runs.
:::
::::

:::recap
- The halting problem asks whether a given program halts on a given input.
- Assuming a perfect `halts` lets us build `opp`, which contradicts it.
- The proof relies on code being data, so a program can be fed its own source.
- Problems with no always-correct program are called undecidable.
:::