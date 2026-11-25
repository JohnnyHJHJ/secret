---
title: Parsing and Syntax Trees
summary: Match nested delimiters with a stack and evaluate an expression by walking its syntax tree recursively.
minutes: 30
---

# Parsing and Syntax Trees

:::goal
You will match nested parentheses with a stack, read an abstract syntax tree, and see how a recursive function evaluates one.
:::

## Start with nesting alone

Before whole expressions, take just the nesting problem: **given a string of parentheses, find the matching pairs.**

```python
assert find_matching_pairs("(()())") == {
    1: 2,
    3: 4,
    0: 5,
}
```

Each key is the index of an opening parenthesis and each value is the index of its partner.

:::key Use a stack
Scan left to right. On `(`, push its index. On `)`, pop the most recent unmatched `(`. That popped index is the partner of this `)`.
:::

::::quiz q-stack-idea
Why does a stack suit matching parentheses?

- [ ] It sorts the parentheses by position
- [x] The most recently opened `(` is always the first one that gets closed
- [ ] It makes the string shorter
- [ ] It counts how many `)` there are
:::hint
Think about which opening parenthesis a new `)` must pair with.
:::
:::hint
It pairs with the *latest* unmatched one. Which data structure gives you the latest item first?
:::
:::explain
Last in, first out: the innermost open parenthesis is the one that closes next. That is exactly stack behavior.
:::
::::

::::quiz q-unbalanced
While scanning `())`, you see a `)` but the stack is empty. What does that mean?

- [ ] The string is valid
- [x] There is a closing parenthesis with no partner
- [ ] You should push the index
- [ ] The string has too many `(`
:::hint
Popping needs something to pop. What does an empty stack tell you?
:::
:::explain
An empty stack means no `(` is waiting to be matched, so this `)` is unmatched and the string is unbalanced.
:::
::::

## Growing the problem

Each extension below is a bigger parsing problem:

- multiple delimiters: `[{}(())]`
- commas: `((), ([], {}))`
- integers and strings: `((1, "two"), ['three', -45, (8,)])`
- operators and variables: `(x + (20 - 3)) * "foo" + 'bar'`

With enough work, all of these can be turned into a **syntax tree**.

## Syntax trees

An **abstract syntax tree (AST)** stores the structure of an expression. Here is `((1, "two"), ['three', 67])` as data:

```python
TupleNode(members=[
    TupleNode(members=[IntNode(1), StrNode("two")]),
    ListNode(members=[StrNode("three"), IntNode(67)]),
])
```

And `(x + (20 - 3)) * "foo" + 'bar'`:

```python
AddNode(
    l=MulNode(
        l=AddNode(
            l=VarNode('x'),
            r=SubNode(l=IntNode(20), r=IntNode(3)),
        ),
        r=StrNode("foo"),
    ),
    r=StrNode('bar'),
)
```

::::quiz q-root
In the tree for `(x + (20 - 3)) * "foo" + 'bar'`, which node is the **root** (the outermost one)?

- [ ] `MulNode`
- [x] `AddNode` joining the product with `'bar'`
- [ ] `SubNode`
- [ ] `VarNode('x')`
:::hint
The root is the operation performed **last**. Which operation is that, given precedence?
:::
:::hint
`*` binds tighter than the final `+ 'bar'`, so the multiplication is computed first.
:::
:::explain
`*` is done before the last `+`, so the final `+` (with `'bar'` on its right) is the root. Operators with higher precedence sit deeper in the tree.
:::
::::

::::quiz q-precedence-tree
For `2 + 3 * 4`, which tree is correct?

- [ ] `MulNode(AddNode(2, 3), 4)`
- [x] `AddNode(2, MulNode(3, 4))`
- [ ] `AddNode(MulNode(2, 3), 4)`
- [ ] `MulNode(2, AddNode(3, 4))`
:::hint
`*` is evaluated before `+`, so the multiplication must be deeper in the tree.
:::
:::explain
`3 * 4` is computed first, so it forms the subtree, and `2` is added to its result. Precedence is encoded as depth.
:::
::::

## Evaluating a tree recursively

To evaluate `X + Y`, wishfully evaluate `X` and `Y`, then add the results. The same idea works for `-`, `*` and every other node kind.

```python
def evaluate(node):
    match node:
        case IntNode(v):
            return v
        case StrNode(s):
            return s
        case AddNode(l, r):
            return evaluate(l) + evaluate(r)
        case SubNode(l, r):
            return evaluate(l) - evaluate(r)
        case MulNode(l, r):
            return evaluate(l) * evaluate(r)
        case ListNode(members):
            return list(map(evaluate, members))
```

:::key Base cases and recursive cases
`IntNode` and `StrNode` are the **base cases**: they return a value directly. `AddNode`, `SubNode` and the other operators are **recursive cases**: they call `evaluate` on their children.
:::

::::quiz q-base-case
Which node kinds in the code above are **base cases**?

- [x] `IntNode`
- [ ] `AddNode`
- [x] `StrNode`
- [ ] `ListNode`
:::hint
A base case does not call `evaluate` again.
:::
:::hint
Look at which `case` branches just `return` something without a recursive call.
:::
:::explain
`IntNode` and `StrNode` return their stored value directly. The other nodes contain child nodes that must be evaluated first.
:::
::::

::::quiz q-evaluate-result
What does `evaluate(AddNode(IntNode(2), MulNode(IntNode(3), IntNode(4))))` return?

- [ ] `20`
- [x] `14`
- [ ] `9`
- [ ] A `MulNode` object
:::hint
Evaluate the inner `MulNode` first.
:::
:::hint
The inner node gives `3 * 4`. Then add `2`.
:::
:::explain
`evaluate` of the right child gives `12`, and `evaluate` of the left child gives `2`. The sum is `14`.
:::
::::

::::quiz q-parser-lookahead
A recursive descent parser sees the token `if`. What does it typically do?

- [ ] Ignores it, since it's only a keyword
- [x] Calls a separate function that parses an `if` block
- [ ] Immediately runs the code
- [ ] Deletes the token
:::hint
Parser functions are mutually recursive, each handling one kind of construct.
:::
:::explain
By looking ahead one or two tokens, the parser decides which function to call: an `if`-block parser for `if`, a `for`-block parser for `for`, and so on. Those functions call each other, which is why it is called recursive descent.
:::
::::

:::recap
- Matching nested delimiters is the core of parsing, and a stack (or recursion) solves it.
- An AST stores an expression as a tree. Precedence becomes depth.
- Evaluating an AST is recursive: leaves return values, operator nodes combine the results of their children.
- A recursive descent parser uses several mutually recursive functions, one per construct.
:::