"""Generate problems.json + manifest.json for the 'Algorithm Ladder' module.

Deterministic (fixed seeds).  Every problem has:
  * a fast reference solution (`ref`)
  * a slow-but-obviously-correct `brute` used to cross-check `ref` on the
    small (and, when cheap, medium) tests
  * tests at three sizes (small / medium / large) tagged for the scoring tiers.

Run:  python testgen.py        (writes problems.json and manifest.json next to it)
"""
import base64
import bisect
import copy
import heapq
import json
import math
import os
import random
import sys
import zlib
from collections import deque
from functools import lru_cache, reduce

HERE = os.path.dirname(os.path.abspath(__file__))
MOD = 10**9 + 7
N_MED = 1500
N_BIG = 15000

GROUPS = [
    ("sorting", "1. Sorting and Greedy"),
    ("prefix", "2. Prefix Sums and Difference Arrays"),
    ("hashing", "3. Hashing and Counting (dict / set)"),
    ("binsearch", "4. Binary Search"),
    ("window", "5. Two Pointers and Sliding Window"),
    ("stack", "6. Stacks and Monotonic Stacks"),
    ("dp", "7. Dynamic Programming (1D and Knapsack)"),
    ("griddp", "8. Grid DP"),
    ("graphs", "9. Graphs: Union-Find, BFS, Dijkstra"),
    ("mathalgo", "10. Number Theory and Fast Exponentiation"),
]

PROBLEMS = []


def problem(**kw):
    PROBLEMS.append(kw)


def rl(r, n, lo, hi):
    return [r.randint(lo, hi) for _ in range(n)]


def tiers3(i, c1, c2, c3):
    return [("small", 30, c1), ("medium", 50, c2), ("all", 80 + 20 * i, c3)]


def tiers2(i, c1, c3):
    return [("small", 40, c1), ("all", 80 + 20 * i, c3)]


# ======================================================================
# GROUP 1: Sorting and Greedy
# ======================================================================
def a1_ref(budget, prices):
    total = cnt = 0
    for p in sorted(prices):
        if total + p > budget:
            break
        total += p
        cnt += 1
    return cnt


def a1_brute(budget, prices):
    n = len(prices)
    best = 0
    for mask in range(1 << n):
        s = c = 0
        for i in range(n):
            if mask >> i & 1:
                s += prices[i]
                c += 1
        if s <= budget:
            best = max(best, c)
    return best


def a1_small(r, k):
    return [r.randint(0, 80), rl(r, r.randint(0, 12), 1, 20)]


def a1_med(r, k):
    pr = rl(r, N_MED, 1, 1000)
    return [sum(pr) // 2 if k == 0 else sum(pr) + 5, pr]


def a1_big(r, k):
    if k == 0:
        pr = rl(r, N_BIG, 1, 10**6)
        return [sum(pr) // 3, pr]
    return [7777, [1] * N_BIG]


problem(
    id="A1", title="Sari-Sari Budget", func="max_items", params="budget, prices", group="sorting",
    story="""Totoy has a fixed budget at Aling Nena's sari-sari store, and he wants to buy as many DIFFERENT items as he can (one piece of each item, he is not greedy for duplicates, just for quantity).

Given his budget and the price of every item in the store, what is the largest number of items he can buy?""",
    corner="""A greedy algorithm repeatedly makes the choice that looks best right now, and never looks back. It only works when you can argue that the locally-best choice never hurts.

Here: if Totoy buys some set of items, swapping any item for a cheaper one he has not bought can only lower the total. So the best plan is always 'buy the cheapest items first'. Sorting the prices turns 'cheapest first' into a simple left-to-right loop.""",
    hint="Sort the prices. Walk through them from cheapest to priciest, keeping a running total, and stop as soon as the next item would break the budget.",
    task="""Implement a function called `max_items`. It has two parameters:
- `budget`, an int.
- `prices`, a list of `n` ints, the price of each item.

It must return an int: the maximum number of items that can be bought with total price at most `budget`.""",
    ref=a1_ref, brute=a1_brute, brute_levels=("small",),
    samples=[[50, [20, 5, 30, 10, 8]], [3, [4, 5]]],
    edges=[("no items", [10, []]), ("zero budget", [0, [1, 2]]), ("exact fit", [6, [1, 2, 3]]),
           ("one item too pricey", [4, [5]]), ("everything affordable", [100, [1, 1, 1]])],
    small=a1_small, medium=a1_med, large=a1_big,
    constraints=["0 <= n <= 15,000", "1 <= each price <= 10^6", "0 <= budget <= 10^11"],
    tiers=tiers3(0, "n <= 12", "n <= 1,500", "n <= 15,000"),
)


def a2_ref(events):
    last = -10**18
    c = 0
    for s, e in sorted(events, key=lambda x: (x[1], x[0])):
        if s >= last:
            c += 1
            last = e
    return c


def a2_brute(events):
    n = len(events)
    best = 0
    for mask in range(1 << n):
        ch = sorted([events[i] for i in range(n) if mask >> i & 1])
        if all(ch[i][1] <= ch[i + 1][0] for i in range(len(ch) - 1)):
            best = max(best, len(ch))
    return best


def mk_events(r, n, smax, lmax):
    out = []
    for _ in range(n):
        s = r.randint(0, smax)
        out.append([s, s + r.randint(1, lmax)])
    return out


problem(
    id="A2", title="AVR Booking Frenzy", func="max_events", params="events", group="sorting",
    story="""The Audio-Visual Room (AVR) is the most contested room on campus. Many orgs filed a request, each for a time slot [start, end]: the org needs the AVR from `start` until `end`.

Two events can both be held if they do not overlap. If one ends at exactly the moment the other starts, that is fine. The AVR manager wants to approve as many events as possible. What is that maximum?""",
    corner="""Activity selection is the classic greedy-by-sorting problem. Which sort key? Not the start time (a very long event can start first and block everything). Not the length (a short event in the middle can split two good ones).

Sort by END time. The event that finishes earliest leaves the most room for everything after it, so you can always safely take it, then take the next event that starts at or after it ends, and so on.""",
    hint="Sort by end time. Keep the end time of the last event you accepted. Accept an event if its start is at least that end time.",
    task="""Implement a function called `max_events`. Its only parameter is `events`, a list of `n` pairs `[start, end]` of ints with `start < end`.

It must return an int: the maximum number of events that can be held with no two overlapping.""",
    ref=a2_ref, brute=a2_brute, brute_levels=("small",),
    samples=[[[[1, 4], [3, 5], [0, 6], [5, 7], [3, 9], [5, 9], [6, 10], [8, 11]]], [[[1, 2], [2, 3], [3, 4]]]],
    edges=[("no events", [[]]), ("one event", [[[5, 9]]]), ("all identical", [[[1, 3]] * 6]),
           ("one giant blocker", [[[0, 100], [1, 2], [2, 3], [3, 4]]]), ("touching chain", [[[i, i + 1] for i in range(10)]])],
    small=lambda r, k: [mk_events(r, r.randint(0, 10), 15, 6)],
    medium=lambda r, k: [mk_events(r, N_MED, 10**4, 50)],
    large=lambda r, k: [mk_events(r, N_BIG, 10**6, 1000 if k == 0 else 10)],
    constraints=["0 <= n <= 15,000", "0 <= start < end <= 2 * 10^6"],
    tiers=tiers3(1, "n <= 10", "n <= 1,500", "n <= 15,000"),
)


def a3_ref(pos):
    s = sorted(pos)
    m = s[len(s) // 2]
    return sum(abs(x - m) for x in s)


def a3_brute(pos):
    return min(sum(abs(x - t) for x in pos) for t in range(min(pos), max(pos) + 1))


problem(
    id="A3", title="Barkada Meetup", func="meeting_point", params="positions", group="sorting",
    story="""A barkada lives along Katipunan Avenue, which we model as a number line. Friend i lives at position `positions[i]`. They want to meet at a single spot (any integer position) so that the TOTAL distance everyone has to walk is as small as possible.

What is that minimum total walking distance?""",
    hint="Try a tiny case by hand: positions 1, 2, 10. Where is the best meeting spot? Now add a friend at 50 and see how it changes. Sorting the positions makes the answer easy to see.",
    task="""Implement a function called `meeting_point`. Its only parameter is `positions`, a non-empty list of `n` ints.

It must return an int: the minimum over all integer meeting spots `t` of the sum of `|positions[i] - t|`.""",
    ref=a3_ref, brute=a3_brute, brute_levels=("small",),
    samples=[[[1, 2, 10]], [[4, 8]]],
    edges=[("single friend", [[7]]), ("all same", [[5, 5, 5, 5]]), ("two far apart", [[0, 100]]),
           ("even count", [[1, 3, 5, 7]]), ("negative positions", [[-5, -1, 4]])],
    small=lambda r, k: [rl(r, r.randint(1, 10), -15, 30)],
    medium=lambda r, k: [rl(r, N_MED, 0, 10**6)],
    large=lambda r, k: [rl(r, N_BIG, 0, 10**10)],
    constraints=["1 <= n <= 15,000", "-10^10 <= positions[i] <= 10^10"],
    tiers=tiers3(2, "n <= 10 and |positions[i]| <= 30", "n <= 1,500", "n <= 15,000"),
    corner="""This is a famous fact: on a number line, the point that minimises the total distance to a set of points is the MEDIAN. Moving the meeting spot one step right helps everyone on the right and hurts everyone on the left, so you stop moving when the two sides are balanced. Sort, and look at the middle element.""",
)


# ======================================================================
# GROUP 2: Prefix sums and difference arrays
# ======================================================================
def b1_ref(values, queries):
    pre = [0]
    for v in values:
        pre.append(pre[-1] + v)
    return [pre[r] - pre[l - 1] for l, r in queries]


def b1_brute(values, queries):
    return [sum(values[l - 1:r]) for l, r in queries]


def mk_queries(r, n, q):
    out = []
    for _ in range(q):
        a, b = r.randint(1, n), r.randint(1, n)
        out.append([min(a, b), max(a, b)])
    return out


def b1_small(r, k):
    n = r.randint(1, 10)
    return [rl(r, n, -20, 20), mk_queries(r, n, r.randint(0, 8))]


def b1_med(r, k):
    return [rl(r, N_MED, -1000, 1000), mk_queries(r, N_MED, N_MED)]


def b1_big(r, k):
    return [rl(r, N_BIG, -10**6, 10**6), mk_queries(r, N_BIG, N_BIG)]


problem(
    id="B1", title="Fiesta Donations", func="range_sums", params="values, queries", group="prefix",
    story="""The barangay fiesta lasted `n` days. The treasurer wrote down the net donations of each day (a day can be negative if the expenses were bigger than the donations).

Now the barangay captain keeps asking questions like: 'What was the total from day 3 to day 8?' The treasurer is tired of re-adding the same numbers again and again. Can you answer all the questions fast?""",
    corner="""Prefix sums: build an array `pre` where `pre[k]` is the sum of the first `k` values (so `pre[0] = 0`). Then the sum of days l..r (1-indexed) is simply `pre[r] - pre[l-1]`, answered in O(1) after O(n) preparation.

values = 5 2 7 1    pre = 0 5 7 14 15
sum of days 2..4 = pre[4] - pre[1] = 15 - 5 = 10

Whenever you see MANY 'sum of a range' questions, think prefix sums.""",
    hint="Do not loop over l..r for every query. Compute `pre` once, then every query is one subtraction.",
    task="""Implement a function called `range_sums`. It has two parameters:
- `values`, a list of `n` ints (day 1 is `values[0]`).
- `queries`, a list of `q` pairs `[l, r]` with `1 <= l <= r <= n` (1-indexed, inclusive).

It must return a list of `q` ints: for each query, the sum of days `l` to `r`, in order.""",
    ref=b1_ref, brute=b1_brute,
    samples=[[[5, 2, 7, 1], [[1, 4], [2, 4], [3, 3]]]],
    edges=[("no queries", [[1, 2, 3], []]), ("single day", [[9], [[1, 1]]]),
           ("negatives", [[-5, 3, -2, 8], [[1, 4], [1, 1], [2, 3]]]), ("whole range", [[1, 1, 1, 1, 1], [[1, 5]]])],
    small=b1_small, medium=b1_med, large=b1_big,
    constraints=["1 <= n <= 15,000", "0 <= q <= 15,000", "|values[i]| <= 10^6"],
    tiers=tiers3(0, "n, q <= 10", "n, q <= 1,500", "n, q <= 15,000"),
)


def b2_ref(n, ops):
    d = [0] * (n + 1)
    for l, r, v in ops:
        d[l] += v
        d[r + 1] -= v
    out = []
    cur = 0
    for i in range(n):
        cur += d[i]
        out.append(cur)
    return out


def b2_brute(n, ops):
    a = [0] * n
    for l, r, v in ops:
        for i in range(l, r + 1):
            a[i] += v
    return a


def mk_ops(r, n, q, vmax):
    out = []
    for _ in range(q):
        a, b = r.randint(0, n - 1), r.randint(0, n - 1)
        out.append([min(a, b), max(a, b), r.randint(-vmax, vmax)])
    return out


def b2_small(r, k):
    n = r.randint(1, 10)
    return [n, mk_ops(r, n, r.randint(0, 6), 5)]


def b2_med(r, k):
    return [N_MED, mk_ops(r, N_MED, N_MED, 100)]


def b2_big(r, k):
    return [N_BIG, mk_ops(r, N_BIG, N_BIG, 1000)]


problem(
    id="B2", title="Christmas Lights", func="final_brightness", params="n, operations", group="prefix",
    story="""Come December, the Quezon Memorial Circle is lined with `n` light bulbs in a row, all starting at brightness 0. The electrician flips a long series of switches. Each switch affects a stretch of bulbs: it ADDS some value `v` to the brightness of every bulb from position `l` to position `r` (the value can be negative, which dims them).

After all the switches, what is the brightness of each bulb?""",
    corner="""Difference arrays are 'prefix sums in reverse'. Instead of touching every bulb in l..r, you mark only the two endpoints: add `v` at index `l` and subtract `v` at index `r+1`. Later, a running sum over the marks rebuilds the real values, because the +v keeps 'switching on' for every bulb to its right until the -v cancels it.

n = 5, add 3 to bulbs 1..3:   marks = 0 3 0 0 -3 0   running sum = 0 3 3 3 0""",
    hint="Make an array `marks` of size n+1. For each operation do exactly two updates. At the end, walk left to right with a running total.",
    task="""Implement a function called `final_brightness`. It has two parameters:
- `n`, the number of bulbs (positions are 0-indexed: `0` to `n-1`).
- `operations`, a list of triples `[l, r, v]` with `0 <= l <= r < n` meaning: add `v` to every bulb from `l` to `r`, inclusive.

It must return a list of `n` ints: the final brightness of each bulb.""",
    ref=b2_ref, brute=b2_brute,
    samples=[[5, [[1, 3, 3], [0, 4, 1]]], [3, []]],
    edges=[("one bulb", [1, [[0, 0, 5], [0, 0, -2]]]), ("everything cancels", [4, [[0, 3, 7], [0, 3, -7]]]),
           ("last bulb only", [6, [[5, 5, 9]]]), ("overlaps", [6, [[0, 2, 1], [1, 4, 2], [2, 5, 3]]])],
    small=b2_small, medium=b2_med, large=b2_big,
    constraints=["1 <= n <= 15,000", "0 <= q <= 15,000", "|v| <= 1,000"],
    tiers=tiers3(1, "n, q <= 10", "n, q <= 1,500", "n, q <= 15,000"),
)


def b3_ref(changes, target):
    cnt = {0: 1}
    s = ans = 0
    for x in changes:
        s += x
        ans += cnt.get(s - target, 0)
        cnt[s] = cnt.get(s, 0) + 1
    return ans


def b3_brute(changes, target):
    n = len(changes)
    ans = 0
    for i in range(n):
        s = 0
        for j in range(i, n):
            s += changes[j]
            if s == target:
                ans += 1
    return ans


def b3_small(r, k):
    return [rl(r, r.randint(0, 10), -3, 5), r.randint(-3, 8)]


def b3_med(r, k):
    return [rl(r, N_MED, -3, 5), r.randint(0, 6)]


def b3_big(r, k):
    if k == 0:
        return [rl(r, N_BIG, -2, 4), 5]
    return [[0] * (N_BIG // 2) + rl(r, N_BIG // 2, -1, 1), 0]


problem(
    id="B3", title="Ipon Challenge", func="count_exact_streaks", params="changes, target", group="prefix",
    story="""You joined the Ipon Challenge! Every day you write down how much your savings changed (negative if you spent more than you saved that day, zero if nothing changed).

A 'streak' is any stretch of one or more consecutive days. You want to know how many different streaks have a total change of EXACTLY `target` pesos. Two streaks are different if they start or end on different days, even if they contain the same numbers.""",
    corner="""Combine prefix sums with a dictionary. Let `pre[j]` be the running total after day j. The streak from day i+1 to day j has total `pre[j] - pre[i]`. It equals `target` exactly when `pre[i] = pre[j] - target`.

So while sweeping left to right, keep a dict that counts how many times each prefix value has appeared so far. At every day, the number of streaks ENDING today is `count[pre[j] - target]`. Do not forget the empty prefix (value 0) at the very start.""",
    hint="Start the dict as {0: 1}. For each day: update the running total, add `count.get(total - target, 0)` to the answer, then record the total in the dict.",
    task="""Implement a function called `count_exact_streaks`. It has two parameters:
- `changes`, a list of `n` ints (can be negative or zero).
- `target`, an int.

It must return an int: the number of pairs `(i, j)` with `0 <= i <= j < n` such that `changes[i] + ... + changes[j] == target`.""",
    ref=b3_ref, brute=b3_brute,
    samples=[[[1, 2, 3, 0, 3], 3], [[1, -1, 1, -1], 0]],
    edges=[("empty", [[], 0]), ("single hit", [[4], 4]), ("single miss", [[4], 5]),
           ("all zeros", [[0] * 8, 0]), ("negative target", [[-2, -1, 3], -3])],
    small=b3_small, medium=b3_med, large=b3_big,
    constraints=["0 <= n <= 15,000", "|changes[i]| <= 10^6", "|target| <= 10^9"],
    tiers=tiers3(2, "n <= 10", "n <= 1,500", "n <= 15,000"),
)


# ======================================================================
# GROUP 3: Hashing and counting
# ======================================================================
def c1_ref(prices, target):
    cnt = {}
    ans = 0
    for p in prices:
        ans += cnt.get(target - p, 0)
        cnt[p] = cnt.get(p, 0) + 1
    return ans


def c1_brute(prices, target):
    n = len(prices)
    return sum(1 for i in range(n) for j in range(i + 1, n) if prices[i] + prices[j] == target)


def c1_big(r, k):
    if k == 0:
        return [rl(r, N_BIG, 1, 2000), 2001]
    return [rl(r, N_BIG, 1, 10**9), 10**9 + 1]


problem(
    id="C1", title="Gift Card Pairs", func="count_pairs_with_sum", params="prices, target", group="hashing",
    story="""You won a mall gift card with exactly `target` pesos on it, and you do not want to waste a single centavo. You plan to buy TWO different items whose prices add up to exactly `target`.

The mall lists `n` items with their prices. How many different pairs of items (by position in the list) have prices that sum to `target`?""",
    corner="""A dict (hash map) gives you 'have I seen this before?' and 'how many times?' in O(1) on average, which turns many nested loops into one loop.

Looping over all pairs is O(n^2). Instead, loop once. For each price `p`, the partner you need is `target - p`. Ask the dict how many earlier items have exactly that price, add it to the answer, and then record `p` in the dict.""",
    hint="Count pairs i < j. When you stand at item j, you only need to look at the items before it, which are already in your dict.",
    task="""Implement a function called `count_pairs_with_sum`. It has two parameters:
- `prices`, a list of `n` ints.
- `target`, an int.

It must return an int: the number of pairs `(i, j)` with `i < j` and `prices[i] + prices[j] == target`.""",
    ref=c1_ref, brute=c1_brute,
    samples=[[[1, 5, 3, 3, 3], 6], [[2, 2, 2], 4]],
    edges=[("empty", [[], 5]), ("one item", [[5], 10]), ("no pair", [[1, 2, 3], 100]),
           ("half and half", [[5, 5, 5, 5], 10])],
    small=lambda r, k: [rl(r, r.randint(0, 10), 1, 8), r.randint(2, 14)],
    medium=lambda r, k: [rl(r, N_MED, 1, 300), r.randint(100, 500)],
    large=c1_big,
    constraints=["0 <= n <= 15,000", "1 <= prices[i] <= 10^9", "1 <= target <= 2 * 10^9"],
    tiers=tiers3(0, "n <= 10", "n <= 1,500", "n <= 15,000"),
)


def c2_ref(words):
    cnt = {}
    for w in words:
        key = "".join(sorted(w))
        cnt[key] = cnt.get(key, 0) + 1
    return sum(c * (c - 1) // 2 for c in cnt.values())


def c2_brute(words):
    n = len(words)
    return sum(1 for i in range(n) for j in range(i + 1, n) if sorted(words[i]) == sorted(words[j]))


def mk_words(r, n, maxlen, alpha):
    return ["".join(r.choice(alpha) for _ in range(r.randint(1, maxlen))) for _ in range(n)]


problem(
    id="C2", title="Group Chat Anagrams", func="count_anagram_pairs", params="words", group="hashing",
    story="""Your org's group chat is full of one-word messages. Two messages are 'twins' if one can be rearranged into the other using exactly the same letters, like `listen` and `silent`.

Given every message in order, how many pairs of messages (by position, i < j) are twins? Identical words are twins too.""",
    hint="What do all words in a twin family have in common once you sort their letters? Use that 'signature' as a dict key and count how many words share each signature. A family of c words has c * (c - 1) / 2 pairs.",
    task="""Implement a function called `count_anagram_pairs`. Its only parameter is `words`, a list of `n` non-empty lowercase strings.

It must return an int: the number of pairs `(i, j)` with `i < j` such that `words[i]` and `words[j]` are anagrams of each other.""",
    ref=c2_ref, brute=c2_brute,
    samples=[[["listen", "silent", "enlist", "google", "gogole", "cat"]], [["a", "b", "a"]]],
    edges=[("empty", [[]]), ("single", [["abc"]]), ("all the same", [["ab"] * 6]),
           ("all different", [["a", "b", "c", "d"]])],
    small=lambda r, k: [mk_words(r, r.randint(0, 10), 4, "abc")],
    medium=lambda r, k: [mk_words(r, N_MED, 6, "abcd")],
    large=lambda r, k: [mk_words(r, N_BIG, 8, "abcd" if k == 0 else "abcdefghij")],
    constraints=["0 <= n <= 15,000", "each word has 1 to 8 lowercase English letters"],
    tiers=tiers3(1, "n <= 10", "n <= 1,500", "n <= 15,000"),
)


def c3_ref(s):
    first = {0: -1}
    bal = best = 0
    for i, ch in enumerate(s):
        bal += 1 if ch == "U" else -1
        if bal in first:
            best = max(best, i - first[bal])
        else:
            first[bal] = i
    return best


def c3_brute(s):
    n = len(s)
    best = 0
    for i in range(n):
        u = k = 0
        for j in range(i, n):
            if s[j] == "U":
                u += 1
            else:
                k += 1
            if u == k:
                best = max(best, j - i + 1)
    return best


def mk_uk(r, n, pu=0.5):
    return "".join("U" if r.random() < pu else "K" for _ in range(n))


problem(
    id="C3", title="Ube-Keso Balance", func="longest_balanced", params="scoops", group="hashing",
    story="""A dirty-ice-cream vendor stacks scoops in a long tray, left to right. Each scoop is either ube (`U`) or keso (`K`).

A customer wants a 'balanced cup': a contiguous stretch of scoops with exactly as many `U` as `K`. What is the length of the longest balanced stretch in the tray? (Return 0 if none exists.)""",
    hint="Turn every `U` into +1 and every `K` into -1, and keep a running balance. A stretch is balanced exactly when the balance is the same at its two ends. For each balance value, remember only the FIRST position you saw it (a dict), since the earliest start makes the longest stretch.",
    task="""Implement a function called `longest_balanced`. Its only parameter is `scoops`, a string of `U` and `K` characters (possibly empty).

It must return an int: the length of the longest contiguous substring with equally many `U` and `K`, or 0 if there is none.""",
    ref=c3_ref, brute=c3_brute,
    samples=[["UUKKUK"], ["UUU"]],
    edges=[("empty", [""]), ("one scoop", [["U", "K"][0]]), ("alternating", ["UKUKUKUK"]),
           ("all ube", ["UUUUUUUU"]), ("balanced only at the middle", ["UUUKKK"])],
    small=lambda r, k: [mk_uk(r, r.randint(0, 12))],
    medium=lambda r, k: [mk_uk(r, N_MED, 0.5 if k == 0 else 0.7)],
    large=lambda r, k: [mk_uk(r, N_BIG, 0.5 if k == 0 else 0.55)],
    constraints=["0 <= length <= 15,000", "the string only contains `U` and `K`"],
    tiers=tiers3(2, "length <= 12", "length <= 1,500", "length <= 15,000"),
)


# ======================================================================
# GROUP 4: Binary search
# ======================================================================
def d1_ref(scores, queries):
    return [len(scores) - bisect.bisect_left(scores, x) for x in queries]


def d1_brute(scores, queries):
    return [sum(1 for v in scores if v >= x) for x in queries]


def d1_small(r, k):
    return [sorted(rl(r, r.randint(0, 10), 0, 20)), rl(r, r.randint(0, 8), -2, 22)]


def d1_med(r, k):
    return [sorted(rl(r, N_MED, 0, 1000)), rl(r, N_MED, -5, 1005)]


def d1_big(r, k):
    return [sorted(rl(r, N_BIG, 0, 10**6)), rl(r, N_BIG, -10, 10**6 + 10)]


problem(
    id="D1", title="Cutoff Grades", func="count_at_least", params="scores, queries", group="binsearch",
    story="""The registrar has the exam scores of everyone in the class, already sorted from lowest to highest. Students keep asking: 'If the cutoff is x, how many people got at least x?'

The registrar wants to answer every question without re-reading the whole list each time.""",
    corner="""Binary search finds a position in a SORTED list in O(log n) by repeatedly cutting the search range in half: look at the middle; if it is too small, throw away the left half, otherwise throw away the right half.

A very useful form is 'lower bound': the FIRST index whose value is >= x.

lo, hi = 0, len(a)
while lo < hi:
    mid = (lo + hi) // 2
    if a[mid] < x:
        lo = mid + 1      # mid is too small, answer is to the right
    else:
        hi = mid          # mid might be the answer, keep it
# lo is now the first index with a[lo] >= x (or len(a))

Everything at index lo and beyond is >= x.""",
    hint="The answer for a query x is `len(scores) - lower_bound(x)`. Write the loop above yourself (imports are not allowed).",
    task="""Implement a function called `count_at_least`. It has two parameters:
- `scores`, a list of `n` ints sorted in non-decreasing order.
- `queries`, a list of `q` ints.

It must return a list of `q` ints: for each query `x`, how many entries of `scores` are `>= x`.""",
    ref=d1_ref, brute=d1_brute,
    samples=[[[50, 60, 60, 75, 90], [60, 100, 0, 76]]],
    edges=[("no scores", [[], [1, 2]]), ("no queries", [[1, 2, 3], []]), ("all equal", [[5, 5, 5], [5, 4, 6]]),
           ("single", [[10], [10, 11, 9]])],
    small=d1_small, medium=d1_med, large=d1_big,
    constraints=["0 <= n, q <= 15,000", "0 <= scores[i] <= 10^6", "-10 <= x <= 10^6 + 10"],
    tiers=tiers3(0, "n, q <= 10", "n, q <= 1,500", "n, q <= 15,000"),
    restr=["No imports are allowed (write your own binary search)."],
)


def d2_ref(stores, queries):
    s = sorted(stores)
    out = []
    for x in queries:
        i = bisect.bisect_left(s, x)
        cands = []
        if i < len(s):
            cands.append(s[i])
        if i > 0:
            cands.append(s[i - 1])
        out.append(min(cands, key=lambda v: (abs(v - x), v)))
    return out


def d2_brute(stores, queries):
    return [min(stores, key=lambda v: (abs(v - x), v)) for x in queries]


problem(
    id="D2", title="Nearest Ukay Store", func="nearest_store", params="stores, queries", group="binsearch",
    story="""Ukay-ukay stores are scattered along Commonwealth Avenue (a number line). You are walking and, at various positions `x`, you wonder: 'Which store is closest to me?' You can walk in either direction.

If two stores are equally close, you prefer the one with the smaller position. Stores are NOT given in any particular order.""",
    hint="Sort the stores once. For a query x, find the first store position >= x with binary search. The nearest store is either that one or the one right before it. Compare the two (and remember the tie rule).",
    task="""Implement a function called `nearest_store`. It has two parameters:
- `stores`, a non-empty list of `n` ints (positions; duplicates are possible).
- `queries`, a list of `q` ints.

It must return a list of `q` ints: for each query `x`, the position of the closest store; if two stores are equally close, the smaller position.""",
    ref=d2_ref, brute=d2_brute,
    samples=[[[10, 20, 50], [12, 15, 40, 100, -5]]],
    edges=[("one store", [[7], [0, 7, 100]]), ("no queries", [[1, 2], []]), ("duplicates", [[5, 5, 9], [6, 7, 8]]),
           ("exact tie", [[10, 20], [15]])],
    small=lambda r, k: [rl(r, r.randint(1, 8), -10, 20), rl(r, r.randint(0, 8), -15, 25)],
    medium=lambda r, k: [rl(r, N_MED, -10**4, 10**4), rl(r, N_MED, -11000, 11000)],
    large=lambda r, k: [rl(r, N_BIG, -10**9, 10**9), rl(r, N_BIG, -10**9, 10**9)],
    constraints=["1 <= n <= 15,000", "0 <= q <= 15,000", "|stores[i]|, |x| <= 10^9"],
    tiers=tiers3(1, "n, q <= 8", "n, q <= 1,500", "n, q <= 15,000"),
    restr=["No imports are allowed (`sorted` is fine)."],
)


def d3_ref(rib, k):
    if sum(rib) < k:
        return 0
    lo, hi = 1, max(rib)
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if sum(x // mid for x in rib) >= k:
            lo = mid
        else:
            hi = mid - 1
    return lo


def d3_brute(rib, k):
    for L in range(max(rib, default=0), 0, -1):
        if sum(x // L for x in rib) >= k:
            return L
    return 0


def d3_small(r, k):
    return [rl(r, r.randint(0, 6), 1, 30), r.randint(1, 20)]


def d3_med(r, k):
    rib = rl(r, N_MED, 1, 2000)
    return [rib, r.randint(1, max(1, sum(rib) // (50 if k == 0 else 1000)))]


def d3_big(r, k):
    rib = rl(r, N_BIG, 1, 10**9)
    return [rib, r.randint(1, sum(rib) // (3000 if k == 0 else 10**6) + 1)]


problem(
    id="D3", title="Sampaguita Garlands", func="max_piece_length", params="ribbons, k", group="binsearch",
    story="""Before the Flores de Mayo, you have `n` strips of ribbon of various lengths, and you need to make at least `k` garlands. Every garland must have the SAME whole-number length `L`, and each garland is cut from a single strip (you cannot tie strips together; leftovers are thrown away).

What is the largest length `L` you can use? If you cannot even make `k` garlands of length 1, the answer is 0.""",
    corner="""Binary search on the answer. You do not need a sorted array: you only need a yes/no question that is MONOTONE. Here: 'can I cut at least k pieces of length L?'. If it is yes for some L, it is also yes for any smaller L. So the answers look like YES YES YES ... YES NO NO ... NO, and you binary search for the last YES.

Checking one L costs O(n): a strip of length x gives `x // L` pieces. Total time: O(n log(max length)).

lo, hi = 1, max_length
while lo < hi:
    mid = (lo + hi + 1) // 2     # round UP when you write lo = mid
    if can_cut(mid): lo = mid
    else: hi = mid - 1""",
    hint="First handle the impossible case (even L = 1 fails, meaning the total length is less than k). Then binary search L between 1 and the longest strip.",
    task="""Implement a function called `max_piece_length`. It has two parameters:
- `ribbons`, a list of `n` positive ints.
- `k`, a positive int.

It must return an int: the largest `L >= 1` such that `sum(x // L for x in ribbons) >= k`, or 0 if no such `L` exists.""",
    ref=d3_ref, brute=d3_brute,
    samples=[[[9, 7, 5], 5], [[3, 4], 100]],
    edges=[("no ribbons", [[], 1]), ("one ribbon one garland", [[10], 1]), ("exactly one per ribbon", [[4, 4, 4], 3]),
           ("impossible", [[1, 1], 3]), ("k equals total length", [[2, 3], 5])],
    small=d3_small, medium=d3_med, large=d3_big,
    constraints=["0 <= n <= 15,000", "1 <= ribbons[i] <= 10^9", "1 <= k <= 10^13"],
    tiers=tiers3(2, "n <= 6 and ribbons[i] <= 30", "n <= 1,500 and ribbons[i] <= 2,000", "n <= 15,000 and ribbons[i] <= 10^9"),
    restr=["No imports are allowed."],
)


# ======================================================================
# GROUP 5: Two pointers and sliding window
# ======================================================================
def e1_ref(w, limit):
    s = sorted(w)
    i, j, b = 0, len(s) - 1, 0
    while i <= j:
        if i < j and s[i] + s[j] <= limit:
            i += 1
        j -= 1
        b += 1
    return b


def e1_brute(w, limit):
    @lru_cache(None)
    def go(t):
        if not t:
            return 0
        a, rest = t[0], t[1:]
        best = 1 + go(rest)
        for i in range(len(rest)):
            if a + rest[i] <= limit:
                best = min(best, 1 + go(rest[:i] + rest[i + 1:]))
        return best
    return go(tuple(sorted(w)))


def e1_small(r, k):
    lim = r.randint(5, 20)
    return [rl(r, r.randint(0, 9), 1, lim), lim]


def e1_med(r, k):
    lim = 1000
    return [rl(r, N_MED, 1, lim), lim]


def e1_big(r, k):
    lim = 10**9
    if k == 0:
        return [rl(r, N_BIG, 1, lim), lim]
    return [rl(r, N_BIG, lim // 3, lim // 2 + 1), lim]


problem(
    id="E1", title="Bangka Crossing", func="min_boats", params="weights, limit", group="window",
    story="""A fleet of small bangka (outrigger boats) ferries people across a lake. Every bangka can carry AT MOST TWO people, and the total weight of the people in it must not exceed `limit`. Everyone weighs at most `limit`, so anyone can ride alone.

Given the weights of all the people waiting, what is the minimum number of boats needed to carry everybody across?""",
    corner="""Two pointers: keep one index at each end of a SORTED array and move them toward each other. Here, look at the lightest and the heaviest remaining person. The heaviest person must take a boat anyway. If the lightest can share it, great, let them. If even the lightest cannot fit, nobody can, so the heaviest rides alone.

Each step retires one boat and moves at least one pointer, so the whole thing is O(n) after sorting.""",
    hint="Sort the weights. Use `i` for the lightest and `j` for the heaviest. Each iteration uses one boat for person `j`; also advance `i` if `weights[i] + weights[j] <= limit`. Careful when `i == j`: that is a single person.",
    task="""Implement a function called `min_boats`. It has two parameters:
- `weights`, a list of `n` ints with `1 <= weights[i] <= limit`.
- `limit`, an int.

It must return an int: the minimum number of boats, each carrying at most 2 people with total weight at most `limit`.""",
    ref=e1_ref, brute=e1_brute, brute_levels=("small",),
    samples=[[[3, 2, 2, 1], 3], [[5, 5, 5], 9]],
    edges=[("nobody", [[], 10]), ("one person", [[7], 7]), ("all pairs fit", [[1, 1, 1, 1], 5]),
           ("nobody can pair", [[6, 6, 6], 10]), ("odd count", [[1, 2, 3], 4])],
    small=e1_small, medium=e1_med, large=e1_big,
    constraints=["0 <= n <= 15,000", "1 <= limit <= 10^9", "1 <= weights[i] <= limit"],
    tiers=tiers3(0, "n <= 9", "n <= 1,500", "n <= 15,000"),
)


def e2_ref(nums, target):
    best = l = s = 0
    for r, x in enumerate(nums):
        s += x
        while s >= target:
            ln = r - l + 1
            if best == 0 or ln < best:
                best = ln
            s -= nums[l]
            l += 1
    return best


def e2_brute(nums, target):
    best = 0
    for i in range(len(nums)):
        s = 0
        for j in range(i, len(nums)):
            s += nums[j]
            if s >= target:
                if best == 0 or j - i + 1 < best:
                    best = j - i + 1
                break
    return best


def e2_big(r, k):
    nums = rl(r, N_BIG, 1, 1000)
    return [nums, sum(nums) // 20 if k == 0 else sum(nums) + 1]


problem(
    id="E2", title="Finals Week Grind", func="shortest_grind", params="hours, target", group="window",
    story="""Finals week is coming! On each day you record how many hours you studied (always at least 1 hour per day, you are no slacker).

You want to know the SHORTEST stretch of consecutive days in which you studied a total of at least `target` hours. How many days long is that shortest stretch? If no stretch ever reaches `target`, answer 0.""",
    corner="""A sliding window keeps two indices, `left` and `right`, and a running sum of what is between them. Expand `right` one day at a time. While the window is 'good enough', record its length, then shrink from the left to see if a shorter window is still good.

This works here because every value is POSITIVE: expanding always increases the sum, shrinking always decreases it. Each index moves forward only, so the total work is O(n) even though there are two nested-looking loops.""",
    hint="For each new `right`, add `hours[right]` to the sum. While `sum >= target`, update the best length and then subtract `hours[left]` and move `left` forward.",
    task="""Implement a function called `shortest_grind`. It has two parameters:
- `hours`, a list of `n` positive ints.
- `target`, a positive int.

It must return an int: the length of the shortest contiguous stretch with sum at least `target`, or 0 if there is none.""",
    ref=e2_ref, brute=e2_brute,
    samples=[[[2, 3, 1, 2, 4, 3], 7], [[1, 1, 1], 10]],
    edges=[("empty", [[], 1]), ("single day enough", [[9], 5]), ("need everything", [[1, 2, 3], 6]),
           ("one big day", [[1, 1, 100, 1], 50])],
    small=lambda r, k: [rl(r, r.randint(0, 10), 1, 9), r.randint(1, 30)],
    medium=lambda r, k: [rl(r, N_MED, 1, 100), r.randint(100, 5000)],
    large=e2_big,
    constraints=["0 <= n <= 15,000", "1 <= hours[i] <= 1,000", "1 <= target <= 10^8"],
    tiers=tiers3(1, "n <= 10", "n <= 1,500", "n <= 15,000"),
)


def e3_ref(s, k):
    cnt = {}
    l = best = 0
    for r, ch in enumerate(s):
        cnt[ch] = cnt.get(ch, 0) + 1
        while len(cnt) > k:
            c = s[l]
            cnt[c] -= 1
            if cnt[c] == 0:
                del cnt[c]
            l += 1
        best = max(best, r - l + 1)
    return best


def e3_brute(s, k):
    best = 0
    for i in range(len(s)):
        seen = set()
        for j in range(i, len(s)):
            seen.add(s[j])
            if len(seen) > k:
                break
            best = max(best, j - i + 1)
    return best


def mk_str(r, n, alpha):
    return "".join(r.choice(alpha) for _ in range(n))


problem(
    id="E3", title="Halo-Halo Toppings", func="longest_k_toppings", params="toppings, k", group="window",
    story="""A halo-halo stall lines up its toppings on a long counter, each topping labelled by a lowercase letter (for example `u` = ube, `l` = leche flan, `s` = sago).

A customer asks for the longest stretch of CONSECUTIVE toppings that uses at most `k` different kinds. How long is it?""",
    hint="Slide a window and keep a dict of how many of each topping are currently inside. After adding the new right end, while the dict has more than `k` kinds, remove from the left (and delete a kind from the dict when its count reaches 0).",
    task="""Implement a function called `longest_k_toppings`. It has two parameters:
- `toppings`, a string of lowercase letters (possibly empty).
- `k`, an int with `k >= 1`.

It must return an int: the length of the longest substring containing at most `k` distinct characters.""",
    ref=e3_ref, brute=e3_brute,
    samples=[["eceba", 2], ["aaaa", 1]],
    edges=[("empty", ["", 3]), ("one char", ["a", 1]), ("k covers all", ["abcabc", 3]),
           ("k = 1 alternating", ["abababab", 1]), ("k larger than alphabet", ["abc", 26])],
    small=lambda r, k: [mk_str(r, r.randint(0, 12), "abcde"), r.randint(1, 4)],
    medium=lambda r, k: [mk_str(r, N_MED, "abcdefgh"), r.randint(1, 5)],
    large=lambda r, k: [mk_str(r, N_BIG, "abcdefghijklmnopqrstuvwxyz"), r.randint(3, 12)],
    constraints=["0 <= length <= 15,000", "1 <= k <= 26"],
    tiers=tiers3(2, "length <= 12", "length <= 1,500", "length <= 15,000"),
)


# ======================================================================
# GROUP 6: Stacks and monotonic stacks
# ======================================================================
def f1_ref(s):
    st = []
    pair = {")": "(", "]": "[", "}": "{"}
    for ch in s:
        if ch in "([{":
            st.append(ch)
        else:
            if not st or st.pop() != pair[ch]:
                return False
    return not st


def f1_brute(s):
    while True:
        t = s.replace("()", "").replace("[]", "").replace("{}", "")
        if t == s:
            return s == ""
        s = t


def gen_brackets(r, pairs, corrupt=False):
    sets = ["()", "[]", "{}"]
    out, st, opens = [], [], pairs
    while opens > 0 or st:
        if opens > 0 and (not st or r.random() < 0.5):
            p = r.choice(sets)
            out.append(p[0])
            st.append(p[1])
            opens -= 1
        else:
            out.append(st.pop())
    s = "".join(out)
    if corrupt and s:
        i = r.randrange(len(s))
        s = s[:i] + r.choice("()[]{}") + s[i + 1:]
    return s


def f1_small(r, k):
    return [gen_brackets(r, r.randint(0, 6), corrupt=(k % 2 == 1))]


def f1_med(r, k):
    return [gen_brackets(r, N_MED // 2, corrupt=(k == 1))]


def f1_big(r, k):
    if k == 0:
        return [gen_brackets(r, 50000)]
    if k == 1:
        return ["(" * 50000 + ")" * 50000]
    return ["[" * 50000 + "]" * 49999 + "}"]


problem(
    id="F1", title="Bracket Bandit", func="brackets_ok", params="code", group="stack",
    story="""You are writing the syntax checker for a tiny programming language. The only thing it checks is brackets: every opening bracket `(`, `[`, `{` must be closed by the matching closing bracket `)`, `]`, `}` in the correct order, like Russian dolls: the most recently opened bracket must be the first one closed.

`([]{})` is fine. `([)]` is not. `((` is not (never closed). `)(` is not either.""",
    corner="""A stack is 'last in, first out': the thing you pushed most recently is the first thing you pop. That is exactly the shape of nested brackets.

Scan left to right. On an opening bracket, push it. On a closing bracket, the top of the stack MUST be its matching opener: pop it; if the stack is empty or the top does not match, the string is invalid. At the end the stack must be empty (nothing left open).

In Python a list works as a stack: `append` pushes, `pop()` pops the last element.""",
    hint="Use a dict like {')': '(', ']': '[', '}': '{'} to find the matching opener. Do not forget both failure cases: wrong match AND leftovers at the end.",
    task="""Implement a function called `brackets_ok`. Its only parameter is `code`, a string consisting only of the characters `()[]{}` (possibly empty).

It must return a bool: `True` if the brackets are correctly matched and nested, otherwise `False`.""",
    ref=f1_ref, brute=f1_brute,
    samples=[["([]{})"], ["([)]"], ["(("]],
    edges=[("empty", [""]), ("single open", ["("]), ("single close", [")"]), ("reversed", [")("]),
           ("nested ok", ["{[()]}"]), ("sequence ok", ["()[]{}"]), ("close before open", ["]["])],
    small=f1_small, medium=f1_med, large=f1_big, nbig=3,
    constraints=["0 <= length <= 100,000", "the string only contains `(`, `)`, `[`, `]`, `{`, `}`"],
    tiers=tiers3(0, "length <= 12", "length <= 1,500", "length <= 100,000"),
)


def f2_ref(t):
    res = [0] * len(t)
    st = []
    for i, x in enumerate(t):
        while st and t[st[-1]] < x:
            j = st.pop()
            res[j] = i - j
        st.append(i)
    return res


def f2_brute(t):
    n = len(t)
    res = [0] * n
    for i in range(n):
        for j in range(i + 1, n):
            if t[j] > t[i]:
                res[i] = j - i
                break
    return res


def f2_big(r, k):
    if k == 0:
        return [rl(r, N_BIG, 15, 40)]
    if k == 1:
        return [list(range(N_BIG, 0, -1))]
    return [list(range(1, N_BIG + 1))]


problem(
    id="F2", title="Init ng Maynila", func="days_until_warmer", params="temps", group="stack",
    story="""It is another scorching summer in Manila. For each day, you wonder: 'How many days do I have to wait until a WARMER day (strictly higher temperature) arrives?'

Given the temperature of every day, answer this for every day. If no warmer day ever comes, the answer for that day is 0.""",
    corner="""A monotonic stack keeps its contents in sorted order (here: temperatures that are still waiting for something warmer, from coldest at the top... well, from warmest at the bottom to the coldest at the top). When a new day arrives, every waiting day that is colder than today has just found its answer, so pop them one by one and fill in their waiting time. Then push today.

Each day is pushed once and popped at most once, so the total work is O(n), even though the double loop looks scary. Store INDICES on the stack so you can compute the waiting time.""",
    hint="Loop over days `i`. While the stack is non-empty and `temps[stack[-1]] < temps[i]`, pop `j` and set `answer[j] = i - j`. Then push `i`.",
    task="""Implement a function called `days_until_warmer`. Its only parameter is `temps`, a list of `n` ints.

It must return a list of `n` ints: for each day `i`, the smallest `d > 0` such that `temps[i + d] > temps[i]`, or 0 if there is no such day.""",
    ref=f2_ref, brute=f2_brute,
    samples=[[[30, 25, 28, 35, 20, 21, 40]], [[5, 4, 3]]],
    edges=[("empty", [[]]), ("one day", [[20]]), ("all equal", [[7, 7, 7, 7]]), ("strictly decreasing", [[9, 8, 7, 6]]),
           ("strictly increasing", [[1, 2, 3, 4]])],
    small=lambda r, k: [rl(r, r.randint(0, 10), 15, 25)],
    medium=lambda r, k: [rl(r, N_MED, 15, 40)],
    large=f2_big, nbig=3,
    constraints=["0 <= n <= 15,000", "1 <= temps[i] <= 15,000"],
    tiers=tiers3(1, "n <= 10", "n <= 1,500", "n <= 15,000"),
)


def f3_ref(h):
    st = []
    best = 0
    for i, x in enumerate(h + [0]):
        start = i
        while st and st[-1][1] >= x:
            s0, hh = st.pop()
            best = max(best, hh * (i - s0))
            start = s0
        st.append((start, x))
    return best


def f3_brute(h):
    best = 0
    for i in range(len(h)):
        m = 10**18
        for j in range(i, len(h)):
            m = min(m, h[j])
            best = max(best, m * (j - i + 1))
    return best


def f3_big(r, k):
    if k == 0:
        return [rl(r, N_BIG, 0, 10**6)]
    if k == 1:
        return [[10**6] * N_BIG]
    return [list(range(1, N_BIG + 1)) + list(range(N_BIG, 0, -1))]


problem(
    id="F3", title="Billboard Rush", func="largest_billboard", params="heights", group="stack",
    story="""Along EDSA there is a row of `n` buildings, each exactly 1 meter wide, with heights `heights[i]` meters. An advertising company wants to hang one rectangular billboard on the skyline. The billboard must sit on the ground and fit completely inside a stretch of CONSECUTIVE buildings (it cannot stick out above any building it covers).

What is the largest billboard area possible?""",
    corner="""This is the famous 'largest rectangle in a histogram'. Brute force tries every stretch and uses its shortest building as the billboard height: O(n^2).

With a stack you do better. Keep the stack of buildings whose heights are INCREASING from bottom to top; each is still 'free to extend to the right'. When a new building is shorter than the top, the top building's billboard can extend no further: pop it and compute its best rectangle (its height times how far left it reaches to how far right it reached). Add a height-0 sentinel at the end to flush everything.""",
    hint="When you pop a building of height h, its rectangle spans from the position where it could first start (remember the start index of the popped entry) up to the current index. Push the NEW building with that earliest start index so it can extend leftward.",
    task="""Implement a function called `largest_billboard`. Its only parameter is `heights`, a list of `n` non-negative ints.

It must return an int: the maximum area of a rectangle covering consecutive buildings, where the rectangle's height is at most the height of every building it covers.""",
    ref=f3_ref, brute=f3_brute,
    samples=[[[2, 1, 5, 6, 2, 3]], [[4, 4, 4]]],
    edges=[("empty", [[]]), ("one building", [[7]]), ("all zero", [[0, 0, 0]]), ("single tall", [[1, 1, 9, 1, 1]]),
           ("staircase up", [[1, 2, 3, 4, 5]])],
    small=lambda r, k: [rl(r, r.randint(0, 10), 0, 9)],
    medium=lambda r, k: [rl(r, N_MED, 0, 1000)],
    large=f3_big, nbig=3,
    constraints=["0 <= n <= 30,000", "0 <= heights[i] <= 10^6"],
    tiers=tiers3(2, "n <= 10", "n <= 1,500", "n <= 30,000"),
)


# ======================================================================
# GROUP 7: Dynamic programming
# ======================================================================
def g1_ref(n):
    f = [1, 1, 2]
    if n < 3:
        return f[n]
    a, b, c = 1, 1, 2
    for _ in range(3, n + 1):
        a, b, c = b, c, (a + b + c) % MOD
    return c


def g1_brute(n):
    def go(m):
        if m < 0:
            return 0
        if m == 0:
            return 1
        return go(m - 1) + go(m - 2) + go(m - 3)
    return go(n) % MOD


problem(
    id="G1", title="Hagdan ng Oble", func="stair_ways", params="n", group="dp",
    story="""Every year, a freshman climbs the long stairs of the Quezon Hall for photos with the Oblation. The stairs have `n` steps. In one move, a person can climb 1, 2, or 3 steps.

In how many different ways can someone climb exactly `n` steps (order of the moves matters)? Staying at the bottom counts as exactly one way to climb 0 steps. Since the answer can be huge, output it modulo 1,000,000,007.""",
    corner="""Dynamic programming (DP) solves a big problem by combining answers to smaller, overlapping versions of the same problem, and each smaller answer is computed only ONCE.

Define `ways(n)`: the number of ways to climb n steps. Look at the LAST move: it was 1, 2 or 3 steps, so
    ways(n) = ways(n-1) + ways(n-2) + ways(n-3)      with ways(0) = 1
A naive recursion recomputes the same values exponentially many times. Instead, compute ways(0), ways(1), ways(2), ... in order, keeping only the last three values. That is O(n) time and O(1) memory.""",
    hint="Start from ways(0) = 1 and treat negative arguments as 0 ways. Take `% 1_000_000_007` inside the loop so numbers stay small. A recursive solution without a cache will be far too slow for big `n`.",
    task="""Implement a function called `stair_ways`. Its only parameter is `n`, an int with `n >= 0`.

It must return an int: the number of sequences of moves (each 1, 2 or 3) with total exactly `n`, modulo 1,000,000,007.""",
    ref=g1_ref, brute=g1_brute,
    samples=[[4], [3]],
    edges=[("zero steps", [0]), ("one step", [1]), ("two steps", [2]), ("five steps", [5])],
    small=lambda r, k: [r.randint(0, 20)],
    medium=lambda r, k: [r.randint(1000, 5000)],
    large=lambda r, k: [10**6 if k == 0 else r.randint(500000, 10**6)],
    big_edges=[("max n", [10**6])],
    nsmall=8, nmed=2, nbig=3,
    constraints=["0 <= n <= 10^6"],
    tiers=tiers2(0, "n <= 20", "n <= 10^6"),
    brute_levels=("small",),
)


def g2_ref(v):
    p2 = p1 = 0
    for x in v:
        p2, p1 = p1, max(p1, p2 + x)
    return p1


def g2_brute(v):
    n = len(v)
    best = 0
    for mask in range(1 << n):
        if mask & (mask >> 1):
            continue
        best = max(best, sum(v[i] for i in range(n) if mask >> i & 1))
    return best


problem(
    id="G2", title="Trick-or-Treat Street", func="max_candy", params="candy", group="dp",
    story="""On Halloween night you go trick-or-treating along a street of `n` houses; house `i` will give you `candy[i]` pieces. But the neighbors gossip: if you ring the bell of a house, you cannot ring the bell of the house RIGHT NEXT to it (the owners are best friends and would catch on that you are repeating your costume).

You may skip any houses. What is the maximum total candy you can collect?""",
    hint="Let `best(i)` be the most candy using only the first i houses. For house i, you either skip it (`best(i-1)`) or take it, which forces you to skip i-1 (`best(i-2) + candy[i]`). Take the bigger one. You only ever need the last two values.",
    task="""Implement a function called `max_candy`. Its only parameter is `candy`, a list of `n` non-negative ints.

It must return an int: the maximum sum of a subset of houses with no two adjacent houses chosen (0 if there are no houses).""",
    ref=g2_ref, brute=g2_brute, brute_levels=("small",),
    samples=[[[2, 7, 9, 3, 1]], [[5, 5, 10, 100, 10, 5]]],
    edges=[("no houses", [[]]), ("one house", [[8]]), ("two houses", [[4, 9]]), ("all zero", [[0, 0, 0]]),
           ("greedy trap", [[6, 10, 6]])],
    small=lambda r, k: [rl(r, r.randint(0, 12), 0, 20)],
    medium=lambda r, k: [rl(r, N_MED, 0, 1000)],
    large=lambda r, k: [rl(r, N_BIG, 0, 10**6)],
    constraints=["0 <= n <= 15,000", "0 <= candy[i] <= 10^6"],
    tiers=tiers2(1, "n <= 12", "n <= 15,000"),
)


def g3_ref(budget, items):
    dp = [0] * (budget + 1)
    for w, v in items:
        for c in range(budget, w - 1, -1):
            if dp[c - w] + v > dp[c]:
                dp[c] = dp[c - w] + v
    return dp[budget]


def g3_brute(budget, items):
    n = len(items)
    best = 0
    for mask in range(1 << n):
        w = sum(items[i][0] for i in range(n) if mask >> i & 1)
        if w <= budget:
            best = max(best, sum(items[i][1] for i in range(n) if mask >> i & 1))
    return best


def g3_small(r, k):
    n = r.randint(0, 10)
    return [r.randint(0, 30), [[r.randint(1, 10), r.randint(1, 20)] for _ in range(n)]]


def g3_med(r, k):
    return [r.randint(500, 1500), [[r.randint(1, 150), r.randint(1, 10**4)] for _ in range(60)]]


def g3_big(r, k):
    if k == 0:
        return [5000, [[r.randint(1, 200), r.randint(1, 10**6)] for _ in range(150)]]
    return [5000, [[r.randint(30, 60), r.randint(1, 10**6)] for _ in range(150)]]


problem(
    id="G3", title="Ukay-Ukay Backpack", func="best_haul", params="capacity, items", group="dp",
    story="""It is bargain-hunting day at the ukay-ukay! Your backpack can hold at most `capacity` kilograms. Each item on the rack has a weight and a resale value. You can take each item at most once, and you want the largest possible TOTAL resale value without breaking the backpack.

(This is the legendary 0/1 knapsack problem. Greedy 'best value per kilo first' can fail, so be careful!)""",
    corner="""0/1 knapsack DP: let `dp[c]` be the best total value achievable with a backpack of capacity c using the items processed so far. Process items one at a time. For an item with weight w and value v, every capacity c >= w may improve:
    dp[c] = max(dp[c], dp[c - w] + v)
IMPORTANT: loop c from HIGH to LOW. Going downward guarantees `dp[c - w]` still refers to the situation BEFORE this item, so the item is used at most once. (Going upward would let you reuse it, which is the 'unbounded' knapsack.)

Time O(n * capacity).""",
    hint="Start with `dp = [0] * (capacity + 1)`. For every item, loop `c` from `capacity` down to `w`. The answer is `dp[capacity]` (since dp is non-decreasing in c).",
    task="""Implement a function called `best_haul`. It has two parameters:
- `capacity`, an int.
- `items`, a list of `n` pairs `[weight, value]` of positive ints.

It must return an int: the maximum total value of a subset of items whose total weight is at most `capacity`.""",
    ref=g3_ref, brute=g3_brute, brute_levels=("small",),
    samples=[[10, [[5, 10], [4, 40], [6, 30], [3, 50]]], [4, [[5, 100]]]],
    edges=[("no items", [10, []]), ("zero capacity", [0, [[1, 5]]]), ("everything fits", [100, [[1, 1], [2, 2], [3, 3]]]),
           ("greedy trap", [10, [[6, 30], [5, 20], [5, 20]]])],
    small=g3_small, medium=g3_med, large=g3_big,
    timeout=3.0,
    constraints=["0 <= n <= 150", "0 <= capacity <= 5,000", "1 <= weight <= 200", "1 <= value <= 10^6"],
    tiers=tiers2(2, "n <= 10 and capacity <= 30", "n <= 150 and capacity <= 5,000"),
)


# ======================================================================
# GROUP 8: Grid DP
# ======================================================================
def h1_ref(g):
    r, c = len(g), len(g[0])
    dp = [[0] * c for _ in range(r)]
    for i in range(r):
        for j in range(c):
            if i == 0 and j == 0:
                dp[i][j] = g[0][0]
            else:
                best = min(dp[i - 1][j] if i else 10**18, dp[i][j - 1] if j else 10**18)
                dp[i][j] = best + g[i][j]
    return dp[-1][-1]


def h1_brute(g):
    r, c = len(g), len(g[0])

    def go(i, j):
        if i == r - 1 and j == c - 1:
            return g[i][j]
        best = 10**18
        if i + 1 < r:
            best = min(best, go(i + 1, j))
        if j + 1 < c:
            best = min(best, go(i, j + 1))
        return best + g[i][j]
    return go(0, 0)


def num_grid(r, rows, cols, lo, hi):
    return [rl(r, cols, lo, hi) for _ in range(rows)]


problem(
    id="H1", title="Toll Gate Trek", func="min_toll", params="grid", group="griddp",
    story="""Going home from UP to the province means crossing a grid-like network of toll gates. `grid[i][j]` is the toll you pay when you pass through the gate at row `i`, column `j`. You start at the top-left gate and must reach the bottom-right gate, and you can only move RIGHT or DOWN one gate at a time. You pay the toll of every gate you pass, including the first and the last.

What is the minimum total toll?""",
    corner="""Grid DP: let `dp[i][j]` be the answer for reaching cell (i, j). Because you can only arrive from the cell above or the cell to the left,
    dp[i][j] = grid[i][j] + min(dp[i-1][j], dp[i][j-1])
Fill the table row by row, so that the two cells you depend on are always ready. The first row and first column have only one possible predecessor.

Time O(rows * cols), instead of the exponentially many paths a brute force would try.""",
    hint="Handle the corner (0,0) separately: dp[0][0] = grid[0][0]. For the first row, you can only come from the left; for the first column, only from above.",
    task="""Implement a function called `min_toll`. Its only parameter is `grid`, a list of `r` lists, each with `c` ints (`r, c >= 1`).

It must return an int: the minimum sum of `grid` values along a path from `(0, 0)` to `(r-1, c-1)` moving only right or down.""",
    ref=h1_ref, brute=h1_brute, brute_levels=("small",),
    samples=[[[[1, 3, 1], [1, 5, 1], [4, 2, 1]]], [[[7]]]],
    edges=[("one cell", [[[5]]]), ("one row", [[[1, 2, 3, 4]]]), ("one column", [[[1], [2], [3]]]),
           ("zeros", [[[0, 0], [0, 0]]])],
    small=lambda r, k: [num_grid(r, r.randint(1, 6), r.randint(1, 6), 0, 9)],
    medium=lambda r, k: [num_grid(r, 40, 40, 1, 100)],
    large=lambda r, k: [num_grid(r, 200, 200, 1, 100)],
    constraints=["1 <= r, c <= 200", "0 <= grid[i][j] <= 100"],
    tiers=tiers2(0, "r, c <= 6", "r, c <= 200"),
)


def h2_ref(g):
    r, c = len(g), len(g[0])
    dp = [[0] * c for _ in range(r)]
    for i in range(r):
        for j in range(c):
            if g[i][j] == "#":
                continue
            if i == 0 and j == 0:
                dp[i][j] = 1
            else:
                dp[i][j] = ((dp[i - 1][j] if i else 0) + (dp[i][j - 1] if j else 0)) % MOD
    return dp[-1][-1]


def h2_brute(g):
    r, c = len(g), len(g[0])

    def go(i, j):
        if g[i][j] == "#":
            return 0
        if i == r - 1 and j == c - 1:
            return 1
        t = 0
        if i + 1 < r:
            t += go(i + 1, j)
        if j + 1 < c:
            t += go(i, j + 1)
        return t
    return go(0, 0) % MOD


def rand_grid(r, rows, cols, p, wall="#", free="."):
    return ["".join(wall if r.random() < p else free for _ in range(cols)) for _ in range(rows)]


def corners_free(g, free="."):
    g = [list(x) for x in g]
    g[0][0] = free
    g[-1][-1] = free
    return ["".join(x) for x in g]


problem(
    id="H2", title="Baha sa Maynila", func="count_dry_paths", params="grid", group="griddp",
    story="""Typhoon season! The streets of a neighborhood form an `r x c` grid. Some blocks are flooded (`#`) and cannot be crossed; the rest are dry (`.`). You start at the top-left block and want to reach the bottom-right block, moving only RIGHT or DOWN one block at a time and never stepping on a flooded block.

How many different paths exist? The number can be gigantic, so print it modulo 1,000,000,007.""",
    hint="Same idea as the toll problem, but now you COUNT instead of minimise: `dp[i][j]` = number of ways to reach (i, j) = `dp[i-1][j] + dp[i][j-1]` for a dry block, and 0 for a flooded one. Do not forget the modulo.",
    task="""Implement a function called `count_dry_paths`. Its only parameter is `grid`, a list of `r` strings, each of length `c`, with characters `.` (dry) and `#` (flooded). The top-left and bottom-right blocks are always dry.

It must return an int: the number of right/down paths from the top-left to the bottom-right block that only use dry blocks, modulo 1,000,000,007.""",
    ref=h2_ref, brute=h2_brute, brute_levels=("small",),
    samples=[[["...", ".#.", "..."]], [["."]]],
    edges=[("one cell", [["."]]), ("one row", [["....."]]), ("blocked", [[".#", "#."]]),
           ("open 3x3", [["...", "...", "..."]])],
    small=lambda r, k: [corners_free(rand_grid(r, r.randint(1, 6), r.randint(1, 6), 0.25))],
    medium=lambda r, k: [corners_free(rand_grid(r, 40, 40, 0.15))],
    large=lambda r, k: [corners_free(rand_grid(r, 200, 200, 0.1)) if k == 0 else ["." * 200] * 200],
    constraints=["1 <= r, c <= 200"],
    tiers=tiers2(1, "r, c <= 6", "r, c <= 200"),
)


def h3_ref(g):
    r, c = len(g), len(g[0])
    prev = [0] * (c + 1)
    best = 0
    for i in range(r):
        cur = [0] * (c + 1)
        for j in range(c):
            if g[i][j] == ".":
                cur[j + 1] = 1 + min(prev[j], prev[j + 1], cur[j])
                best = max(best, cur[j + 1])
        prev = cur
    return best


def h3_brute(g):
    r, c = len(g), len(g[0])
    best = 0
    for i in range(r):
        for j in range(c):
            for s in range(1, min(r - i, c - j) + 1):
                if all(g[a][b] == "." for a in range(i, i + s) for b in range(j, j + s)):
                    best = max(best, s)
    return best


problem(
    id="H3", title="Sunken Garden Picnic", func="biggest_picnic_square", params="field", group="griddp",
    story="""The Sunken Garden is a field divided into `r x c` square tiles. Free tiles are `.` and tiles with a tree are `T`. Your org wants to lay out one big SQUARE picnic blanket that covers only free tiles (the blanket's sides are aligned with the grid).

What is the side length of the largest square blanket that fits? (0 if every tile has a tree.)""",
    hint="Let `dp[i][j]` be the side of the largest free square whose BOTTOM-RIGHT corner is tile (i, j). If the tile is a tree it is 0; otherwise it is `1 + min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])`. The answer is the maximum over all cells. Why does the minimum of the three neighbours work? Draw a 3x3 example!",
    task="""Implement a function called `biggest_picnic_square`. Its only parameter is `field`, a list of `r` strings of length `c` with characters `.` and `T`.

It must return an int: the largest `s` such that some `s x s` square of tiles contains no `T`.""",
    ref=h3_ref, brute=h3_brute,
    samples=[[["..T", "...", "..."]], [["TT", "TT"]]],
    edges=[("one tile free", [["."]]), ("one tile tree", [["T"]]), ("all free", [["...", "...", "..."]]),
           ("single row", [["..T.."]]), ("single column", [["T", ".", "."]])],
    small=lambda r, k: [rand_grid(r, r.randint(1, 7), r.randint(1, 7), 0.2, wall="T")],
    medium=lambda r, k: [rand_grid(r, 40, 40, 0.05, wall="T")],
    large=lambda r, k: [rand_grid(r, 200, 200, 0.02, wall="T") if k == 0 else ["." * 200] * 200],
    constraints=["1 <= r, c <= 200"],
    tiers=tiers3(2, "r, c <= 7", "r, c <= 40", "r, c <= 200"),
    brute_levels=("small",),
)


# ======================================================================
# GROUP 9: Graphs
# ======================================================================
def i1_ref(n, pairs):
    p = list(range(n))

    def find(x):
        while p[x] != x:
            p[x] = p[p[x]]
            x = p[x]
        return x
    comps = n
    for a, b in pairs:
        ra, rb = find(a), find(b)
        if ra != rb:
            p[ra] = rb
            comps -= 1
    return comps


def i1_brute(n, pairs):
    label = list(range(n))
    for a, b in pairs:
        la, lb = label[a], label[b]
        if la != lb:
            label = [la if x == lb else x for x in label]
    return len(set(label))


def rand_pairs(r, n, m):
    if n < 2:
        return []
    out = []
    for _ in range(m):
        a = r.randrange(n)
        b = r.randrange(n)
        while b == a:
            b = r.randrange(n)
        out.append([a, b])
    return out


def i1_small(r, k):
    n = r.randint(1, 10)
    return [n, rand_pairs(r, n, r.randint(0, 10))]


def i1_med(r, k):
    return [N_MED, rand_pairs(r, N_MED, 1000 if k == 0 else 1600)]


def i1_big(r, k):
    if k == 0:
        return [N_BIG, rand_pairs(r, N_BIG, 12000)]
    if k == 1:
        pairs = [[i, i + 1] for i in range(N_BIG - 1)]
        return [N_BIG, pairs]
    return [N_BIG, []]


problem(
    id="I1", title="Barkada Circles", func="friend_circles", params="n, pairs", group="graphs",
    story="""The freshmen batch has `n` students, numbered 0 to `n-1`. You are given pairs of students who are friends. Friendship is contagious in a barkada: if A is friends with B and B is friends with C, then A, B and C are all in the SAME circle, even if A and C never met.

How many separate friend circles does the batch have? (A student with no friends is a circle of one.)""",
    corner="""A graph has nodes (students) and edges (friend pairs). A 'connected component' is a maximal group of nodes that can reach each other. Counting components is the classic job for UNION-FIND (disjoint set union):

- Every node starts in its own set, so there are n sets.
- `find(x)` follows parent links to the set's representative. Shorten long chains by 'path compression' (point a node closer to the root as you walk).
- For each edge (a, b): if `find(a) != find(b)`, merge the two sets and decrease the set count by 1.

The final count is the number of components. Almost O(n + m) in practice. (BFS/DFS also works: just be careful with recursion depth on 15,000 chained students.)""",
    hint="Use a parent list `p = list(range(n))`. A loop `while p[x] != x: p[x] = p[p[x]]; x = p[x]` is an iterative `find` with path halving.",
    task="""Implement a function called `friend_circles`. It has two parameters:
- `n`, the number of students (`n >= 1`).
- `pairs`, a list of `m` pairs `[a, b]` with `0 <= a, b < n` and `a != b` (a pair may appear more than once).

It must return an int: the number of connected components.""",
    ref=i1_ref, brute=i1_brute,
    samples=[[5, [[0, 1], [1, 2], [3, 4]]], [4, []]],
    edges=[("single student", [1, []]), ("everybody connected", [4, [[0, 1], [1, 2], [2, 3]]]),
           ("duplicate pairs", [3, [[0, 1], [1, 0], [0, 1]]]), ("two circles", [6, [[0, 1], [2, 3], [4, 5], [1, 2]]])],
    small=i1_small, medium=i1_med, large=i1_big, nbig=3,
    constraints=["1 <= n <= 15,000", "0 <= m <= 15,000"],
    tiers=tiers3(0, "n, m <= 10", "n, m <= 1,600", "n, m <= 15,000"),
)


def i2_ref(g):
    r, c = len(g), len(g[0])
    for i in range(r):
        for j in range(c):
            if g[i][j] == "S":
                s = (i, j)
            elif g[i][j] == "E":
                e = (i, j)
    dist = {s: 0}
    q = deque([s])
    while q:
        i, j = q.popleft()
        if (i, j) == e:
            return dist[e]
        for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            a, b = i + di, j + dj
            if 0 <= a < r and 0 <= b < c and g[a][b] != "#" and (a, b) not in dist:
                dist[(a, b)] = dist[(i, j)] + 1
                q.append((a, b))
    return -1


def i2_brute(g):
    r, c = len(g), len(g[0])
    INF = 10**9
    d = [[INF] * c for _ in range(r)]
    for i in range(r):
        for j in range(c):
            if g[i][j] == "S":
                d[i][j] = 0
            elif g[i][j] == "E":
                ei, ej = i, j
    changed = True
    while changed:
        changed = False
        for i in range(r):
            for j in range(c):
                if g[i][j] == "#":
                    continue
                for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    a, b = i + di, j + dj
                    if 0 <= a < r and 0 <= b < c and g[a][b] != "#" and d[a][b] + 1 < d[i][j]:
                        d[i][j] = d[a][b] + 1
                        changed = True
    return d[ei][ej] if d[ei][ej] < INF else -1


def maze(r, rows, cols, p, s=None, e=None):
    g = [["#" if r.random() < p else "." for _ in range(cols)] for _ in range(rows)]
    cells = [(i, j) for i in range(rows) for j in range(cols)]
    a, b = r.sample(cells, 2) if s is None else (s, e)
    g[a[0]][a[1]] = "S"
    g[b[0]][b[1]] = "E"
    return ["".join(x) for x in g]


def snake(rows, cols):
    g = [["."] * cols for _ in range(rows)]
    for i in range(1, rows, 2):
        for j in range(cols):
            g[i][j] = "#"
        g[i][cols - 1 if i % 4 == 1 else 0] = "."
    g[0][0] = "S"
    g[rows - 1][cols - 1 if (rows - 1) % 4 == 0 else 0] = "E"
    return ["".join(x) for x in g]


def i2_big(r, k):
    if k == 0:
        return [maze(r, 200, 200, 0.25, (0, 0), (199, 199))]
    if k == 1:
        return [snake(101, 200)]
    return [maze(r, 200, 200, 0.45, (0, 0), (199, 199))]


problem(
    id="I2", title="Takas sa Maze", func="maze_steps", params="grid", group="graphs",
    story="""You are lost in the maze of the UP Lagoon garden! The maze is a grid with walls (`#`) and open paths (`.`). You are at `S` and the exit is `E`. In one step you may move to a neighbouring open cell directly UP, DOWN, LEFT or RIGHT (no diagonals), never through a wall.

What is the smallest number of steps needed to reach the exit? If it is impossible, answer -1.""",
    corner="""Breadth-First Search (BFS) explores a graph in 'rings': first the start, then everything 1 step away, then everything 2 steps away, and so on. So the FIRST time BFS reaches a cell, it has used the minimum number of steps (when every move costs the same).

Implementation: a queue (use `collections.deque`, but imports are not allowed here, so a list with a moving head index works too) and a `dist` table. Pop a cell, look at its 4 neighbours, and for every unvisited open neighbour set `dist = dist[current] + 1` and push it. A cell is marked visited the moment it is PUSHED, so it is never queued twice.""",
    hint="Find `S` and `E` first by scanning the grid. Use a list as a queue with an index `head` that moves forward instead of `pop(0)` (which is O(n)). Return -1 if the queue runs dry before you reach `E`.",
    task="""Implement a function called `maze_steps`. Its only parameter is `grid`, a list of `r` strings of length `c` containing exactly one `S`, exactly one `E`, and otherwise `.` and `#`.

It must return an int: the minimum number of steps from `S` to `E` moving in the 4 directions through non-wall cells, or -1 if `E` cannot be reached.""",
    ref=i2_ref, brute=i2_brute,
    samples=[[["S.#", ".#.", "..E"]], [["S#E"]]],
    edges=[("adjacent", [["SE"]]), ("walled off", [["S#E"]]), ("straight corridor", [["S....E"]]),
           ("detour", [["S#E", ".#.", "..."]])],
    small=lambda r, k: [maze(r, r.randint(1, 6), r.randint(2, 6), 0.3)],
    medium=lambda r, k: [maze(r, 40, 40, 0.25, (0, 0), (39, 39))],
    large=i2_big, nbig=3,
    constraints=["1 <= r, c <= 200", "2 <= r * c"],
    tiers=tiers3(1, "r, c <= 6", "r, c <= 40", "r, c <= 200"),
    brute_levels=("small", "medium"),
    nsmall=14, nmed=2,
    restr=["No imports are allowed."],
)


def i3_ref(n, roads, s, e):
    adj = [[] for _ in range(n + 1)]
    for a, b, w in roads:
        adj[a].append((b, w))
        adj[b].append((a, w))
    INF = float("inf")
    d = [INF] * (n + 1)
    d[s] = 0
    pq = [(0, s)]
    while pq:
        du, u = heapq.heappop(pq)
        if du > d[u]:
            continue
        for v, w in adj[u]:
            if du + w < d[v]:
                d[v] = du + w
                heapq.heappush(pq, (d[v], v))
    return d[e] if d[e] < INF else -1


def i3_brute(n, roads, s, e):
    INF = 10**18
    d = [INF] * (n + 1)
    d[s] = 0
    for _ in range(n):
        ch = False
        for a, b, w in roads:
            if d[a] + w < d[b]:
                d[b] = d[a] + w
                ch = True
            if d[b] + w < d[a]:
                d[a] = d[b] + w
                ch = True
        if not ch:
            break
    return d[e] if d[e] < INF else -1


def rand_graph(r, n, m, wmax, connected=True):
    roads = []
    if connected:
        roads = [[i, r.randint(1, i - 1), r.randint(1, wmax)] for i in range(2, n + 1)]
    while len(roads) < m:
        a, b = r.randint(1, n), r.randint(1, n)
        if a != b:
            roads.append([a, b, r.randint(1, wmax)])
    r.shuffle(roads)
    return roads


def i3_small(r, k):
    n = r.randint(1, 8)
    m = r.randint(0, 12) if n > 1 else 0
    return [n, rand_graph(r, n, m, 9, connected=False), r.randint(1, n), r.randint(1, n)]


def i3_med(r, k):
    return [300, rand_graph(r, 300, 900, 100), 1, 300]


def i3_big(r, k):
    n = 4000
    if k == 0:
        return [n, rand_graph(r, n, 12000, 1000), 1, n]
    if k == 1:
        return [n, rand_graph(r, n, 3000, 1000, connected=False), 1, n]
    roads = [[i, i + 1, r.randint(1, 10**6)] for i in range(1, n)]
    r.shuffle(roads)
    return [n, roads, 1, n]


problem(
    id="I3", title="Jeepney Routes", func="fastest_route", params="n, roads, start, end", group="graphs",
    story="""The city has `n` jeepney stops, numbered 1 to `n`. Between some pairs of stops there is a two-way road, and driving along it takes a certain number of minutes (different roads take different times). You are at stop `start` and want to get to stop `end` as quickly as possible, possibly passing through other stops on the way.

What is the shortest possible travel time? If `end` cannot be reached at all, answer -1.""",
    corner="""When roads have different lengths, BFS is no longer enough. Dijkstra's algorithm fixes this: always expand the stop that currently has the SMALLEST known travel time. Since all times are positive, once a stop is the smallest in the queue, nothing can ever improve it.

A priority queue (min-heap) gives you 'the smallest known time' in O(log n). Push `(time, stop)` pairs; when you pop a pair that is already worse than the best known time for that stop, skip it (it is stale). Otherwise relax every outgoing road: if `time + w` beats the known time of the neighbour, update it and push.

Time: O((n + m) log n).""",
    hint="Build an adjacency list first: `adj[u]` holds `(v, w)` for every road touching u (add it in both directions!). Keep `dist` as a list with a huge value for 'unknown'.",
    task="""Implement a function called `fastest_route`. It has four parameters:
- `n`, the number of stops.
- `roads`, a list of `m` triples `[a, b, w]` meaning a two-way road between stops `a` and `b` taking `w` minutes (`1 <= w`). Several roads between the same pair can exist.
- `start` and `end`, two stops (they can be equal).

It must return an int: the minimum total travel time, or -1 if `end` is unreachable from `start`.""",
    ref=i3_ref, brute=i3_brute,
    samples=[[4, [[1, 2, 5], [2, 4, 5], [1, 3, 2], [3, 4, 20]], 1, 4], [3, [[1, 2, 1]], 1, 3]],
    edges=[("same stop", [1, [], 1, 1]), ("two stops, one road", [2, [[1, 2, 7]], 1, 2]),
           ("parallel roads", [2, [[1, 2, 9], [1, 2, 3]], 2, 1]), ("detour is faster", [3, [[1, 3, 100], [1, 2, 1], [2, 3, 1]], 1, 3])],
    small=i3_small, medium=i3_med, large=i3_big, nbig=3,
    timeout=3.0,
    constraints=["1 <= n <= 4,000", "0 <= m <= 12,000", "1 <= w <= 10^6"],
    tiers=tiers3(2, "n <= 8", "n <= 300", "n <= 4,000"),
    restr=["The following imports are allowed: `heappush` and `heappop` from `heapq`."],
)


# ======================================================================
# GROUP 10: Number theory and fast exponentiation
# ======================================================================
def j1_ref(qs):
    m = max(max(qs, default=1), 1)
    sieve = bytearray([1]) * (m + 1)
    sieve[0] = 0
    sieve[1] = 0
    for i in range(2, int(m ** 0.5) + 1):
        if sieve[i]:
            sieve[i * i::i] = bytearray(len(range(i * i, m + 1, i)))
    pre = [0] * (m + 1)
    for i in range(1, m + 1):
        pre[i] = pre[i - 1] + sieve[i]
    return [pre[q] for q in qs]


def j1_brute(qs):
    def is_p(x):
        if x < 2:
            return False
        d = 2
        while d * d <= x:
            if x % d == 0:
                return False
            d += 1
        return True
    return [sum(1 for x in range(2, q + 1) if is_p(x)) for q in qs]


problem(
    id="J1", title="Prime Raffle", func="count_primes", params="queries", group="mathalgo",
    story="""A raffle sells tickets numbered 1, 2, 3, ... and ONLY tickets with a PRIME number can win (the organizer loves primes). Participants keep asking: 'If tickets only go up to q, how many winning tickets are there?'

For each query `q`, count the prime numbers between 1 and `q`, inclusive.""",
    corner="""The Sieve of Eratosthenes finds ALL primes up to a limit M at once in about O(M log log M):

1. Make a list `is_prime` of size M + 1, all True (except 0 and 1).
2. For i = 2, 3, ...: if `is_prime[i]` is still True, it is prime; cross out all its multiples starting at i * i (smaller multiples were already crossed out by smaller primes).
3. You only need to loop i while i * i <= M.

Then a PREFIX SUM over the sieve gives 'number of primes <= q' for every q in O(1). Never test each number separately (trial division per query is far too slow). Sieve once up to the biggest query.""",
    hint="Compute the largest query, sieve up to that, build `prime_count[q]` as a running total, then answer every query by lookup.",
    task="""Implement a function called `count_primes`. Its only parameter is `queries`, a list of `q` ints.

It must return a list of `q` ints: for each query `x`, the number of primes `p` with `p <= x`.""",
    ref=j1_ref, brute=j1_brute,
    samples=[[[10, 1, 2, 100]]],
    edges=[("no queries", [[]]), ("zero and one", [[0, 1]]), ("first prime", [[2, 3]]), ("repeated", [[30, 30, 30]])],
    small=lambda r, k: [rl(r, r.randint(0, 8), 0, 100)],
    medium=lambda r, k: [rl(r, N_MED, 0, 5000)],
    large=lambda r, k: [rl(r, N_BIG, 0, 10**6) if k == 0 else [10**6] * 2000 + [999983, 0, 1]],
    timeout=3.0,
    constraints=["0 <= q <= 15,000", "0 <= x <= 10^6"],
    tiers=tiers3(0, "x <= 100", "x <= 5,000", "x <= 10^6"),
)


def j2_ref(periods):
    return reduce(lambda a, b: a * b // math.gcd(a, b), periods, 1)


def j2_brute(periods):
    t = 1
    while any(t % p for p in periods):
        t += 1
    return t


SMALL_PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43]


def j2_big(r, k):
    if k == 0:
        out = []
        while len(out) < N_BIG:
            d, ps = 1, SMALL_PRIMES[:]
            r.shuffle(ps)
            for p in ps:
                if d * p <= 10**6:
                    d *= p
            out.append(d)
        return [out]
    if k == 1:
        return [[999983, 999979, 999961]]
    return [[r.randint(1, 10**6) for _ in range(2)]]


problem(
    id="J2", title="Blinking Parols", func="next_sync", params="periods", group="mathalgo",
    story="""It is Christmas season and a street is decorated with `n` parols (lanterns). The i-th parol blinks every `periods[i]` seconds: it blinks at time 0, at `periods[i]`, at `2 * periods[i]`, and so on. At time 0 ALL parols blink together.

When is the next time (after time 0) that all parols blink at the very same moment?""",
    corner="""The moment parol i blinks are the multiples of its period. A time where ALL blink together is a COMMON MULTIPLE of all periods, and the first one is the LEAST common multiple (LCM).

gcd(a, b) is the greatest common divisor (Euclid: `gcd(a, b) = gcd(b, a % b)`, ending at `gcd(a, 0) = a`), and
    lcm(a, b) = a // gcd(a, b) * b
(divide first to keep numbers smaller). To get the LCM of a whole list, fold it: lcm(lcm(p0, p1), p2), ...

Looping time = 1, 2, 3, ... until everything divides it is far too slow when the answer is huge.""",
    hint="Write your own gcd with a `while b:` loop, or use `gcd` from `math` (the only import allowed). Python ints never overflow, so large answers are fine.",
    task="""Implement a function called `next_sync`. Its only parameter is `periods`, a non-empty list of `n` positive ints.

It must return an int: the smallest `t >= 1` such that `t` is divisible by every period. It is guaranteed that the answer is at most 10^18.""",
    ref=j2_ref, brute=j2_brute,
    samples=[[[4, 6]], [[3, 5, 7]]],
    edges=[("one parol", [[7]]), ("all the same", [[6, 6, 6]]), ("one divides all", [[2, 4, 8]]),
           ("period 1", [[1, 5]]), ("classic", [[6, 10, 15]])],
    small=lambda r, k: [rl(r, r.randint(1, 4), 1, 12)],
    medium=lambda r, k: [rl(r, 3, 1, 50)],
    large=j2_big, nbig=3, nmed=2,
    constraints=["1 <= n <= 15,000", "1 <= periods[i] <= 10^6", "the answer is at most 10^18"],
    tiers=tiers2(1, "answer <= 10^5", "answer <= 10^18"),
    restr=["The following import is allowed: `gcd` from `math`."],
    brute_levels=("small",),
)


def j3_ref(n):
    base = [1, 1, 2, 3]
    if n < 4:
        return base[n]

    def mul(A, B):
        return [[sum(A[i][k] * B[k][j] for k in range(4)) % MOD for j in range(4)] for i in range(4)]
    M = [[1, 1, 0, 1], [1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0]]
    R = [[int(i == j) for j in range(4)] for i in range(4)]
    p = n - 3
    while p:
        if p & 1:
            R = mul(R, M)
        M = mul(M, M)
        p >>= 1
    v = [3, 2, 1, 1]
    return sum(R[0][k] * v[k] for k in range(4)) % MOD


def j3_brute(n):
    f = [1, 1, 2, 3]
    for i in range(4, n + 1):
        f.append((f[i - 1] + f[i - 2] + f[i - 4]) % MOD)
    return f[n]


problem(
    id="J3", title="Kabute Farm", func="mushrooms", params="n", group="mathalgo",
    story="""You started a mushroom farm. The number of mushrooms on day `n` is described as follows: on days 0, 1, 2, 3 there are 1, 1, 2, 3 mushrooms. From day 4 onward, the count is

    mushrooms(n) = mushrooms(n-1) + mushrooms(n-2) + mushrooms(n-4)

(yesterday's mushrooms stay, the colony from two days ago splits, and the colony from four days ago matures and doubles).

How many mushrooms are there on day `n`? The farm lasts for a very, very long time, so `n` can be up to 10^18. Output the answer modulo 1,000,000,007.""",
    corner="""Looping day by day costs O(n), impossible for n = 10^18. But a linear recurrence can be written as a MATRIX multiplication: keep a state vector of the last four values, and one day is 'multiply by a fixed 4x4 matrix M':

[f(n)  ]   [1 1 0 1] [f(n-1)]
[f(n-1)] = [1 0 0 0] [f(n-2)]
[f(n-2)]   [0 1 0 0] [f(n-3)]
[f(n-3)]   [0 0 1 0] [f(n-4)]

So f(n) comes from M raised to a power, applied to the starting vector. And a power can be computed with FAST EXPONENTIATION (repeated squaring): to compute M^p, square M repeatedly and multiply into the result for each 1-bit of p. That is only about 60 matrix multiplications for p ~ 10^18.

result = identity
while p:
    if p & 1: result = result * M
    M = M * M
    p >>= 1""",
    hint="Reduce modulo 1,000,000,007 after every multiplication. Handle n < 4 directly. For n >= 3, the state vector at day 3 is [f(3), f(2), f(1), f(0)] = [3, 2, 1, 1] and you need M^(n-3) applied to it.",
    task="""Implement a function called `mushrooms`. Its only parameter is `n`, an int with `n >= 0`.

It must return an int: `mushrooms(n)` modulo 1,000,000,007.""",
    ref=j3_ref, brute=j3_brute,
    samples=[[4], [10]],
    edges=[("day 0", [0]), ("day 1", [1]), ("day 2", [2]), ("day 3", [3]), ("day 5", [5])],
    small=lambda r, k: [r.randint(0, 25)],
    medium=lambda r, k: [r.randint(10**5, 10**6)],
    large=lambda r, k: [r.randint(10**15, 10**18)],
    big_edges=[("n = 10^18", [10**18]), ("n = 10^18 - 1", [10**18 - 1])],
    nsmall=8, nmed=3, nbig=4,
    constraints=["0 <= n <= 10^18"],
    tiers=tiers3(2, "n <= 25", "n <= 10^6", "n <= 10^18"),
)


# ======================================================================
# Assembly
# ======================================================================
def fmt_args(args):
    return ", ".join(repr(a) for a in args)


def build_statement(p, sample_results):
    L = ["### %s - %s\n" % (p["id"], p["title"]), p["story"] + "\n"]
    if p.get("corner"):
        L.append("## Algorithm Corner\n" + p["corner"] + "\n")
    if p.get("hint"):
        L.append("## Hint\n" + p["hint"] + "\n")
    L.append("## Task Details\n" + p["task"] + "\n")
    restr = list(p.get("restr", ["No imports are allowed."]))
    restr.append("The source code limit is %d." % p.get("limit", 2000))
    L.append("## Restrictions\n" + "\n".join("- " + x for x in restr) + "\n")
    ex = ["```"]
    for i, (a, res) in enumerate(zip(p["samples"], sample_results), 1):
        ex.append("Example %d: %s(%s) => %r" % (i, p["func"], fmt_args(a), res))
    ex.append("```")
    L.append("## Example Calls\n" + "\n".join(ex) + "\n")
    L.append("## Constraints\n" + "\n".join("- " + c for c in p["constraints"]) + "\n")
    sc = []
    for tag, pts, cond in p["tiers"]:
        if tag == "all":
            sc.append("- You get %d points if you solve all test cases." % pts)
        else:
            sc.append("- You get %d points if you solve all test cases where %s." % (pts, cond))
    sc.append("- Your score is the best tier you fully solve.")
    L.append("## Scoring\n" + "\n".join(sc))
    return "\n".join(L)


def wrap(x):
    s = json.dumps(x, separators=(",", ":"))
    if len(s) > 800:
        return {"$gz": base64.b64encode(zlib.compress(s.encode())).decode()}
    return x


def build_tests(p, rng, errors):
    tag_names = [t for t, _, _ in p["tiers"]]
    tests = []
    levels = []

    def tags_for(level, extra=()):
        tag = {"small": "small", "medium": "medium" if "medium" in tag_names else "all", "large": "all"}[level]
        return tag_names[tag_names.index(tag):] + list(extra)

    def add(name, args, level, extra=()):
        exp = p["ref"](*copy.deepcopy(args))
        tests.append({"name": name, "args": args, "expected": exp, "tags": tags_for(level, extra)})
        levels.append(level)

    for i, a in enumerate(p["samples"]):
        add("sample %d" % (i + 1), a, "small", ("sample", "smoke"))
    for name, a in p["edges"]:
        add(name, a, "small", ("smoke",))
    for k in range(p.get("nsmall", 12)):
        add("random small #%d" % (k + 1), p["small"](rng, k), "small")
    for k in range(p.get("nmed", 2)):
        add("medium #%d" % (k + 1), p["medium"](rng, k), "medium")
    for name, a in p.get("big_edges", []):
        add(name, a, "large")
    for k in range(p.get("nbig", 2)):
        add("large #%d" % (k + 1), p["large"](rng, k), "large")

    # cross-check reference against brute force
    brute = p.get("brute")
    blevels = p.get("brute_levels", ("small", "medium"))
    if brute:
        for t, lv in zip(tests, levels):
            if lv in blevels:
                got = brute(*copy.deepcopy(t["args"]))
                if got != t["expected"]:
                    errors.append("%s: ref/brute mismatch on %s: ref=%r brute=%r" % (p["id"], t["name"], t["expected"], got))
    for t in tests:
        t["expected"] = wrap(t["expected"])
    return tests


def main():
    errors = []
    out_problems = []
    seen_ids = set()
    for idx, p in enumerate(PROBLEMS):
        assert p["id"] not in seen_ids
        seen_ids.add(p["id"])
        rng = random.Random(20261118 + idx * 7919)
        sample_results = [p["ref"](*copy.deepcopy(a)) for a in p["samples"]]
        tests = build_tests(p, rng, errors)
        tiers = [{"points": pts, "tag": tag, "label": ("all test cases" if tag == "all" else cond)}
                 for tag, pts, cond in p["tiers"]]
        for t in p["tiers"]:
            if not any(t[0] in tt["tags"] for tt in tests):
                errors.append("%s: no test carries tier tag %s" % (p["id"], t[0]))
        out_problems.append({
            "id": p["id"],
            "title": p["title"],
            "func": p["func"],
            "params": p["params"],
            "signature": "%s(%s)" % (p["func"], p["params"]),
            "group": p["group"],
            "timeout": p.get("timeout", 2.0),
            "checker": "exact",
            "statement": build_statement(p, sample_results),
            "scoring": {"mode": "best", "tiers": tiers},
            "points": max(t["points"] for t in tiers),
            "tests": tests,
        })
    if errors:
        print("\n".join(errors))
        sys.exit(1)
    data = {"groups": [{"id": g, "title": t} for g, t in GROUPS], "problems": out_problems}
    with open(os.path.join(HERE, "problems.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(HERE, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump({"title": "Algorithm Ladder", "order": 2}, f, indent=2)
    print("OK: %d problems, %d tests" % (len(out_problems), sum(len(q["tests"]) for q in out_problems)))


if __name__ == "__main__":
    main()
