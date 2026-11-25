---
title: Queues, Limits, and the Set ADT
summary: Build a LimitedStack, a fast Queue and a SummedQueue, and combine match with a Stack.
minutes: 40
---

# Queues, Limits, and the Set ADT

:::goal What you will be able to do
- Write a stack with a limited capacity.
- Tell a stack (LIFO) from a queue (FIFO).
- Write a Queue whose operations are all fast (**O(1)**).
- Keep a running total to make `sum()` fast.
- Combine `match` with a Stack.
:::

## Stack with a limit

A real stack of plates cannot grow forever. A **LimitedStack** has a finite capacity, set in the constructor. Pushing onto a full one raises an error called a **stack overflow**.

::::exercise ex-limited-stack kind=write
Write `LimitedStack(capacity)` with `push`, `pop`, `is_empty` and `remaining_capacity()`. Pushing onto a full stack must raise `OverflowError`. Popping an empty stack raises `ValueError`.

```python starter
class LimitedStack:
    def __init__(self, capacity):
        pass

    def remaining_capacity(self):
        pass

    def push(self, val):
        pass

    def pop(self):
        pass

    def is_empty(self):
        pass
```
```python tests
def two_pushes():
    s = LimitedStack(3)
    s.push('a')
    s.push('a')
    return s.remaining_capacity()

def fill_up():
    s = LimitedStack(2)
    s.push(1)
    s.push(2)
    return s.remaining_capacity()

def overflow():
    s = LimitedStack(1)
    s.push(1)
    s.push(2)

def order():
    s = LimitedStack(3)
    s.push(1)
    s.push(2)
    return [s.pop(), s.pop()]

check(lambda: LimitedStack(3).remaining_capacity(), 3, "a new stack has full capacity")
check(two_pushes, 1, "3 - 2 = 1 remaining")
check(fill_up, 0, "0 remaining when full")
check_raises(overflow, OverflowError, "pushing onto a full stack overflows")
check(order, [2, 1], "still last in, first out")
check_raises(lambda: LimitedStack(2).pop(), ValueError, "pop on empty raises ValueError")
check(lambda: LimitedStack(0).is_empty(), True, "capacity 0 stack is empty")
```
```python solution
class LimitedStack:
    def __init__(self, capacity):
        self._capacity = capacity
        self._values = []

    def remaining_capacity(self):
        return self._capacity - len(self._values)

    def push(self, val):
        if self.remaining_capacity() == 0:
            raise OverflowError("stack overflow")
        self._values.append(val)

    def pop(self):
        if self._values:
            return self._values.pop()
        raise ValueError

    def is_empty(self):
        return not self._values
```
:::hint
Store the capacity and a list in `__init__`.
:::
:::hint
`remaining_capacity` is the capacity minus the number of items.
:::
:::hint
In `push`, check `self.remaining_capacity() == 0` first and `raise OverflowError`.
:::
:::explain
Checking the remaining capacity **before** appending means a full stack is never changed. The 4th push in a capacity-3 stack finds 0 remaining and raises.
:::
::::

## Queues

A real-life queue (a line of people): people join at the **back** and leave from the **front**. A **Queue** has `enqueue(x)` (add at the back), `dequeue()` (remove and return the front) and `is_empty()`. It is **FIFO**: **F**irst **I**n, **F**irst **O**ut.

| ADT | Order | Mnemonic |
|---|---|---|
| Stack | last in, first out | LIFO |
| Queue | first in, first out | FIFO |

::::quiz q-stack-or-queue
Which of these is a **queue**?

- [ ] The undo history of a text editor
- [x] Print jobs waiting for a printer
- [ ] The pages behind a browser's back button
- [ ] A pile of books where you always take the top one
:::hint
Ask: who gets served first, the newest or the oldest?
:::
:::hint
The three wrong options all give the most recent item first.
:::
:::explain
Print jobs are served in the order they arrived (first come, first served). Undo history and the back button give you the most recent item first, which is a stack.
:::
::::

Why not just use a list? Removing the first item with `pop(0)` makes every other item shift over, which gets slower as the list grows.

:::try t-pop0
Run it and see how the list changes. Every remaining item had to move one place left.

```python starter
line = ["ana", "ben", "cy", "dee"]
print(line.pop(0))
print(line)
```
:::

::::quiz q-pop0
Why is `list.pop(0)` a poor choice for a queue?

- [ ] It raises an error on lists with more than one item.
- [ ] It removes the **last** item, not the first.
- [x] All remaining items must shift left, so it takes **O(n)** time.
- [ ] It cannot return a value.
:::hint
Look at the printed list in the previous activity. What happened to `"ben"`'s position?
:::
:::hint
O(n) means the work grows with the number of items.
:::
:::explain
**O(1)** means constant time: it does not get slower as the queue grows. `pop(0)` is O(n) because everything shifts. A `deque`'s `popleft()` is O(1).
:::
::::

::::predict p-queue
What does this print?

```python
from collections import deque

class Queue:
    def __init__(self):
        self._items = deque()

    def enqueue(self, x):
        self._items.append(x)

    def dequeue(self):
        if not self._items:
            raise ValueError
        return self._items.popleft()

    def is_empty(self):
        return not self._items

q = Queue()
q.enqueue('a')
q.enqueue('b')
q.enqueue('c')
print(q.dequeue())
print(q.dequeue())
print(q.is_empty())
```
```text answer
a
b
False
```
:::hint
A queue gives back the **oldest** item first.
:::
:::hint
After two dequeues, one item is left.
:::
:::explain
`popleft()` removes from the front, so the order out is `a`, `b`. `'c'` is still waiting, so `is_empty()` is `False`.
:::
::::

::::exercise ex-queue kind=write
Write `Queue` using `collections.deque` (it is fast at both ends). `dequeue()` on an empty queue must raise `ValueError`.

```python starter
from collections import deque

class Queue:
    def __init__(self):
        pass

    def enqueue(self, x):
        pass

    def dequeue(self):
        pass

    def is_empty(self):
        pass
```
```python tests
def fifo():
    q = Queue()
    q.enqueue('a')
    q.enqueue('b')
    q.enqueue('c')
    return [q.dequeue(), q.dequeue(), q.dequeue()]

def becomes_empty():
    q = Queue()
    q.enqueue(1)
    q.dequeue()
    return q.is_empty()

check(lambda: Queue().is_empty(), True, "a new queue is empty")
check(fifo, ['a', 'b', 'c'], "first in, first out")
check(becomes_empty, True, "empty after the last dequeue")
check_raises(lambda: Queue().dequeue(), ValueError, "dequeue on empty raises ValueError")
check(calls('popleft'), True, "uses popleft for O(1) removal")
```
```python solution
from collections import deque

class Queue:
    def __init__(self):
        self._items = deque()

    def enqueue(self, x):
        self._items.append(x)

    def dequeue(self):
        if not self._items:
            raise ValueError
        return self._items.popleft()

    def is_empty(self):
        return not self._items
```
:::hint
Create `self._items = deque()` in `__init__`.
:::
:::hint
`enqueue` uses `append` (back). `dequeue` removes from the front with a different method.
:::
:::hint
Front removal on a deque is `popleft()`. Check for emptiness first with `if not self._items:`.
:::
:::explain
`append` and `popleft` are both O(1) on a deque, so the queue stays fast no matter how long it gets.
:::
::::

There is also an option with no imports: keep a list and a **front index**. Instead of removing items, move a pointer.

::::fill f-queue-head
```python
class Queue:
    def __init__(self):
        self._items = []
        self._head = 0

    def enqueue(self, x):
        self._items.append(x)

    def dequeue(self):
        if self.is_empty():
            raise ValueError
        x = self._items[ [[self._head]] ]
        self._head [[+=]] 1
        return x

    def is_empty(self):
        return self._head == [[len]](self._items)
```
:::hint
The front item sits at the index stored in `self._head`.
:::
:::hint
After taking the front item, the head moves one step forward: `+= 1`.
:::
:::hint
The queue is empty when the head index equals the length of the list.
:::
::::

## Keeping a running total

A **SummedQueue** is a Queue of numbers with an extra `sum()` that returns the total of everything currently in the queue. Adding up all the items every time would be O(n). Instead, **keep a running total** and update it on every `enqueue` and `dequeue`. You trade a little extra stored state for speed.

::::exercise ex-summed-queue kind=write
A `Queue` is given. Write `SummedQueue` that wraps a `Queue` and has `enqueue`, `dequeue`, `is_empty` and `sum`. `sum()` must **not** use a loop: keep a running total instead.

```python starter
from collections import deque

class Queue:
    def __init__(self):
        self._items = deque()

    def enqueue(self, x):
        self._items.append(x)

    def dequeue(self):
        if not self._items:
            raise ValueError
        return self._items.popleft()

    def is_empty(self):
        return not self._items

class SummedQueue:
    def __init__(self):
        self._queue = Queue()

    def enqueue(self, x):
        pass

    def dequeue(self):
        pass

    def is_empty(self):
        pass

    def sum(self):
        pass
```
```python tests
def after_two():
    sq = SummedQueue()
    sq.enqueue(5)
    sq.enqueue(10)
    return sq.sum()

def after_dequeue():
    sq = SummedQueue()
    sq.enqueue(5)
    sq.enqueue(10)
    first = sq.dequeue()
    return (first, sq.sum())

def back_to_zero():
    sq = SummedQueue()
    sq.enqueue(4)
    sq.dequeue()
    return sq.sum()

check(lambda: SummedQueue().sum(), 0, "empty queue sums to 0")
check(after_two, 15, "5 + 10 = 15")
check(after_dequeue, (5, 10), "dequeue returns the front and lowers the sum")
check(back_to_zero, 0, "sum is 0 again when emptied")
check(lambda: SummedQueue().is_empty(), True, "starts empty")
check_raises(lambda: SummedQueue().dequeue(), ValueError, "dequeue on empty raises ValueError")
check(lambda: not uses('For') and not uses('While'), True, "no loops (keeps it O(1))")
```
```python solution
from collections import deque

class Queue:
    def __init__(self):
        self._items = deque()

    def enqueue(self, x):
        self._items.append(x)

    def dequeue(self):
        if not self._items:
            raise ValueError
        return self._items.popleft()

    def is_empty(self):
        return not self._items

class SummedQueue:
    def __init__(self):
        self._queue = Queue()
        self._total = 0

    def enqueue(self, x):
        self._queue.enqueue(x)
        self._total += x

    def dequeue(self):
        x = self._queue.dequeue()
        self._total -= x
        return x

    def is_empty(self):
        return self._queue.is_empty()

    def sum(self):
        return self._total
```
:::hint
Add a private attribute that holds the total, starting at 0.
:::
:::hint
Every `enqueue` adds to the total. Every `dequeue` subtracts the removed item.
:::
:::hint
`dequeue` should store the removed item first: `x = self._queue.dequeue()`, then subtract it and return it.
:::
:::explain
The total is always up to date, so `sum()` just returns it. If the inner `dequeue` raises (empty queue), the error happens before the total changes, so the total stays correct.
:::
::::

## Putting it together: match and a Stack

::::exercise ex-run-commands kind=write
A `Stack` is given. Write `run(commands)`. Each command is a list: `["push", value]` pushes a value, and `["pop"]` pops one. Use `match` for the commands. `run` returns the list of popped values, in the order they were popped. Any other command raises `ValueError`.

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

def run(commands):
    stack = Stack()
    popped = []
    for cmd in commands:
        pass  # your match statement here
    return popped
```
```python tests
check(lambda: run([["push", 1], ["push", 2], ["pop"], ["push", 3], ["pop"], ["pop"]]), [2, 3, 1], "mixed commands")
check(lambda: run([["push", "a"], ["pop"]]), ["a"], "one push, one pop")
check(lambda: run([]), [], "no commands")
check_raises(lambda: run([["jump"]]), ValueError, "unknown command")
check_raises(lambda: run([["push"]]), ValueError, "push needs a value")
check_raises(lambda: run([["pop"]]), ValueError, "popping an empty stack")
check(uses('Match'), True, "uses a match statement")
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

def run(commands):
    stack = Stack()
    popped = []
    for cmd in commands:
        match cmd:
            case ["push", value]:
                stack.push(value)
            case ["pop"]:
                popped.append(stack.pop())
            case _:
                raise ValueError("unknown command")
    return popped
```
:::hint
Inside the loop, write `match cmd:` with three cases.
:::
:::hint
The push pattern has a constant and a capture: `["push", value]`. The pop pattern is `["pop"]`.
:::
:::hint
End with `case _:` and `raise ValueError`. For pop, `popped.append(stack.pop())`.
:::
:::explain
The pattern checks the shape (one or two items) and names the value in one line. `["push"]` has the wrong shape, so it reaches `_`. Popping an empty stack raises `ValueError` from the Stack itself.
:::
::::

## The Set ADT

The **Set** ADT is a collection of **distinct** objects with `add(x)` (does nothing if `x` is already there), `contains(x)`, `remove(x)` (an error if `x` is missing) and a way to go through the elements.

::::quiz q-set
Which statements are true? Select all that apply.

- [x] Python's built-in `set` is an implementation of the Set ADT.
- [x] Adding the same item twice leaves only one copy in a set.
- [ ] A set remembers the order in which items were added, and you can rely on it.
- [ ] Removing an item that is not in a set quietly does nothing, by the ADT's definition.
:::hint
The word "distinct" in the definition is the key to the second statement.
:::
:::hint
The Set ADT says `remove` raises an error when the item is missing.
:::
:::explain
A set holds distinct items, so a duplicate `add` changes nothing. You must never rely on the order of a set's elements. Removing a missing item is an error in the ADT.
:::
::::

:::recap
- A **LimitedStack** raises an error (stack overflow) when pushed past its capacity.
- A **Queue** is **FIFO**; a Stack is **LIFO**.
- `deque.popleft()` and a head index give **O(1)** dequeue; `list.pop(0)` is O(n).
- Keep a running total to make `SummedQueue.sum()` O(1).
- `match` and ADTs combine well: a pattern reads the command, and the Stack does the work.
- A Set holds distinct items; Python's `set` implements the Set ADT.
:::
