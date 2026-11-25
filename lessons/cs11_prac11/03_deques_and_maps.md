---
title: Deques, Rolling Minimums and Two-Way Maps
summary: Use a deque as a fast queue, keep a rolling minimum, and build a class with two dicts that stay in sync.
minutes: 40
---

# Deques, Rolling Minimums and Two-Way Maps

:::goal What you will be able to do
- Use `collections.deque` as a queue.
- Keep the minimum of a moving window without rescanning it.
- Keep two dicts consistent inside a class and raise `ValueError` correctly.
:::

A **queue** is first in, first out: you add at the back and remove from the front. A `deque` (say "deck") does both ends quickly.

:::try t-deque
Run it. Then add another `append` and `popleft` and look at the deque.

```python starter
from collections import deque

q = deque([3, 1, 6])
q.append(2)
print(q.popleft())
print(q)
```
:::

::::predict p-deque
What does this print?

```python
from collections import deque

q = deque()
q.append(5)
q.append(7)
q.appendleft(1)
print(q.pop(), q.popleft(), len(q))
```
```text answer
7 1 1
```
:::hint
After the three adds the deque is `1, 5, 7`.
:::
:::hint
`pop()` takes from the back, `popleft()` from the front.
:::
:::explain
`pop()` returns 7, `popleft()` returns 1, and only 5 is left, so the length is 1.
:::
::::

::::quiz q-listpop0
Why use a `deque` instead of a list with `pop(0)` for a big queue?

- [ ] `pop(0)` returns the wrong item
- [x] `pop(0)` shifts every other item, so it gets slow on long lists, but `popleft()` does not
- [ ] A `deque` keeps its items sorted
:::hint
Think about what must happen to the other items when the first one of a list disappears.
:::
:::explain
Removing the front of a list moves all the remaining items. A deque is built so both ends are cheap.
:::
::::

Now a **rolling minimum**. Rescanning the whole queue for its minimum every time is slow. Instead, keep a second deque `d` where values only **increase** from front to back. Before adding `x`, throw away every value at the back that is `>= x`: it can never be the minimum again, because `x` is smaller or equal and will stay in the queue longer.

::::predict p-mono
What does this print?

```python
from collections import deque

d = deque()
for x in [4, 2, 5, 1]:
    while d and d[-1] >= x:
        d.pop()
    d.append(x)
    print(list(d))
```
```text answer
[4]
[2]
[2, 5]
[1]
```
:::hint
For each `x`, first pop from the back while the last value is `>= x`.
:::
:::hint
For `x = 1`, both 5 and 2 are `>= 1`.
:::
:::explain
4 is removed by 2. 5 is kept because 2 < 5. Then 1 removes 5 and 2. The front of `d` is always the smallest value seen so far.
:::
::::

::::fill f-mono
```python
from collections import deque

nums = [4, 2, 5, 1]
d = deque()
for x in nums:
    while d and d[-1] [[>=]] x:
        d.[[pop]]()
    d.[[append]](x)
print(d[0])
```
:::hint
Which comparison means "the back is no smaller than `x`"?
:::
:::hint
You remove from the **back** with `pop`, and add `x` at the back with `append`.
:::
:::explain
This is the same loop you just traced. After it, `d[0]` is the minimum of everything seen.
:::
::::

A real window also **expires** old items. So store **indexes** in `d` instead of values: the front index can then be dropped once it falls out of the window.

::::exercise ex-window kind=complete
Write `window_mins(nums, k)`: the minimum of every window of `k` consecutive numbers, in order. For `[4, 2, 5, 1, 3]` and `k = 3` the answer is `[2, 1, 1]`. Follow the numbered comments.

```python starter
from collections import deque

def window_mins(nums, k):
    d = deque()      # indexes; their values increase from front to back
    result = []
    for i in range(len(nums)):
        # 1. pop indexes from the back while nums[d[-1]] >= nums[i]
        # 2. append i at the back
        # 3. if the front index is no longer in the window, popleft it
        # 4. once the first window is full, add nums[d[0]] to result
        pass
    return result
```
```python tests
check(lambda: window_mins([4, 2, 5, 1, 3], 3), [2, 1, 1], "example")
check(lambda: window_mins([4, 2, 5], 1), [4, 2, 5], "k = 1")
check(lambda: window_mins([3, 1, 2], 3), [1], "window as long as the list")
check(lambda: window_mins([2, 2, 2, 2], 2), [2, 2, 2], "equal values")
check(lambda: window_mins([5, 4, 3, 2, 1], 2), [4, 3, 2, 1], "decreasing list")
check(uses('While'), True, "uses a while loop")
```
```python solution
from collections import deque

def window_mins(nums, k):
    d = deque()
    result = []
    for i in range(len(nums)):
        while d and nums[d[-1]] >= nums[i]:
            d.pop()
        d.append(i)
        if d[0] <= i - k:
            d.popleft()
        if i >= k - 1:
            result.append(nums[d[0]])
    return result
```
:::hint
Steps 1 and 2 are the loop you just practised, but compare `nums[d[-1]]` with `nums[i]` because `d` holds indexes.
:::
:::hint
The window ending at `i` covers indexes `i - k + 1` to `i`. So the front index has expired when it is `<= i - k`.
:::
:::hint
The first full window ends at `i = k - 1`. Only from then on append `nums[d[0]]` to `result`.
:::
:::explain
Each index is added once and removed at most once, so the whole thing is fast. Only one front index can expire per step, because exactly one new index was added.
:::
::::

Now a different tool. When you must look things up in **both directions** (spy to agent and agent to spy), keep **two dicts**, one per direction. Every change must update both.

:::try t-two-dicts
Run it, then add a locker for `'Ben'` in both dicts.

```python starter
to_locker = {'Ana': 7}
to_student = {7: 'Ana'}
print(to_locker['Ana'], to_student[7])
```
:::

Methods often must **raise** an error on bad input. `raise ValueError('message')` stops the method, and the caller can catch it with `try` and `except`.

::::predict p-except
What does this print?

```python
try:
    d = {'a': 1}
    print(d['b'])
except KeyError:
    print('missing')
print('done')
```
```text answer
missing
done
```
:::hint
Looking up a missing key raises `KeyError`.
:::
:::hint
After an `except` block finishes, the program carries on with the next line.
:::
:::explain
`d['b']` raises `KeyError` before `print` can run, so only `'missing'` is printed. Then the program continues and prints `'done'`.
:::
::::

::::quiz q-order
In `assign(student, locker)` you must refuse the call if the student or the locker is already used. Which order keeps the two dicts consistent?

- [x] Check both conditions first, then write to both dicts
- [ ] Write to the student dict first, then check the locker and raise if it is taken
- [ ] Write to both dicts, then check and raise if either was already there
:::hint
Imagine the error is raised halfway through the method. What state are the dicts left in?
:::
:::explain
If you raise after changing one dict, the dicts disagree forever. Validate everything first, change things last.
:::
::::

::::exercise ex-lockers kind=complete
Finish `LockerBook`. Methods:

- `assign(student, locker)` stores the pair. It raises `ValueError` if the student already has a locker or the locker is already taken. It returns `None`.
- `locker_of(student)` returns the student's locker, or raises `ValueError` if unknown.
- `release(student)` removes the student's pair from **both** dicts, or raises `ValueError` if unknown.

```python starter
class LockerBook:
    def __init__(self):
        self.by_student = {}
        self.by_locker = {}

    def assign(self, student, locker):
        pass

    def locker_of(self, student):
        pass

    def release(self, student):
        pass
```
```python tests
b = LockerBook()
check(lambda: b.assign('Ana', 7), None, "assign returns None")
check(lambda: b.locker_of('Ana'), 7, "lookup works")
check_raises(lambda: b.assign('Ana', 8), ValueError, "student already has a locker")
check_raises(lambda: b.assign('Ben', 7), ValueError, "locker already taken")
check_raises(lambda: b.locker_of('Zed'), ValueError, "unknown student")
check(lambda: b.release('Ana'), None, "release returns None")
check_raises(lambda: b.locker_of('Ana'), ValueError, "gone after release")
check(lambda: b.assign('Ben', 7), None, "locker 7 is free again")
check_raises(lambda: b.release('Zed'), ValueError, "release unknown student")
```
```python solution
class LockerBook:
    def __init__(self):
        self.by_student = {}
        self.by_locker = {}

    def assign(self, student, locker):
        if student in self.by_student or locker in self.by_locker:
            raise ValueError('already used')
        self.by_student[student] = locker
        self.by_locker[locker] = student

    def locker_of(self, student):
        if student not in self.by_student:
            raise ValueError('unknown student')
        return self.by_student[student]

    def release(self, student):
        if student not in self.by_student:
            raise ValueError('unknown student')
        locker = self.by_student.pop(student)
        del self.by_locker[locker]
```
:::hint
Test membership with `in` on the dicts before changing anything.
:::
:::hint
In `release`, you need the locker number to clean the second dict, so keep what `pop` returns.
:::
:::hint
`locker = self.by_student.pop(student)` then `del self.by_locker[locker]`.
:::
:::explain
Validate first, change last, and always update both dicts together. If `release` forgot the second dict, locker 7 would stay "taken" forever.
:::
::::

:::recap
- `deque` gives fast `append`, `pop`, `appendleft` and `popleft`.
- A deque of indexes with increasing values gives a rolling minimum: trim the back, add the new index, expire the front.
- For two-way lookup keep two dicts and update both together.
- Check every condition before changing state, then `raise ValueError` early.
:::
