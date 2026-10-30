---
title: Money Is Never a Float
voice: elevenlabs:Liam
style: paper-vector
format: 9x16
captions: selection
---

<!--
  Day 02 — Why Your Database Does That

  EVERY FIGURE BELOW IS MEASURED, from one session:
    demo/capture-20261029-164354.log
    PostgreSQL 17.11 (Homebrew) on aarch64-apple-darwin25.6.0

  Ground truth, both checks passed:
    aggregate cast_error            0.00000000
    per-row mismatches              0
  So Scene 10 is entitled to say "the total, to the cent" for this
  dataset, this version, this run — and no further.

  Cast semantics verified on 17.11:
    0.1::float8::numeric    -> 0.1
    123.45::float8::numeric -> 123.45

  The two totals DIFFER, so the primary Scene 1 opening and the primary
  Scene 11 take are the correct ones. Nothing was re-rolled.

  Scene 3 (binary fractions) is the designated cut if the edit runs long.
-->

## 01 — the discrepancy
:: code { kind: "card", eyebrow: "same table · same rows", headline: "Two totals", title: "sum(amount) · 5,000,000 rows", lines: ["run A   1250655316.889824", "run B   1250655316.8900142", "", "0.1 + 0.2 = 0.30000000000000004"], highlight: [0, 1] }
Two totals from the same table. Same five million rows. Nobody wrote to it in between. Both are valid. But look closely — they **disagree**. Where did that difference come from?

## 02 — what didn't change
:: stack { order: "down", title: "What changed?", items: ["INSERT", "UPDATE", "DELETE", "MIGRATION", "EXECUTION PLAN"], revealed: 5, active: 4 }
> transition: fade
Nothing was written. No migration, no update, no new rows. The only thing that changed is how Postgres decided to **execute** the query. Two causes, stacked.

## 03 — binary can't hold a tenth
:: code { kind: "card", eyebrow: "cause one", headline: "The value isn't what you typed", title: "binary fractions", lines: ["1/2 = 0.1", "1/4 = 0.01", "1/8 = 0.001", "", "1/10 = 0.0001100110011..."], highlight: [4] }
> transition: slide
First: a float stores numbers in binary. One tenth can't be written in binary — ten factors into two times five, and five isn't a power of two — so it repeats **forever**, like one third in decimal.

## 04 — what is actually stored
:: code { kind: "terminal", title: "float8 value of 0.1, exact in decimal", lines: ["0.1000000000000000055511151231257827", "  021181583404541015625"], highlight: [0, 1] }
> transition: fade
What's in your column is **this**.

## 05 — not associative
:: code { kind: "card", eyebrow: "cause two", headline: "Order changes the answer", title: "float addition", lines: ["a + (b + c)   ≠   (a + b) + c"], highlight: [0] }
> transition: slide
Second: because **some** values are approximations, changing the order you add them in can change the answer. Float addition isn't associative.

## 06 — the prediction
:: code { kind: "card", headline: "Same rows. 4 workers instead of 0.", title: "what changes?", lines: ["→  the data", "→  the calculation order", "→  nothing"] }
> transition: fade
> hold: 1000
So — same rows, four workers instead of zero. What changes?

## 07 — the answer
:: diagram { arrange: "hub", eyebrow: "parallel aggregate", headline: "The calculation order", nodes: [{ id: "t", label: "payments", tone: "ink" }, { id: "w1", label: "WORKER 1", tone: "cool" }, { id: "w2", label: "WORKER 2", tone: "cool" }, { id: "w3", label: "WORKER 3", tone: "cool" }, { id: "w4", label: "WORKER 4", tone: "accent" }], edges: [{ from: "t", to: "w1" }, { from: "t", to: "w2" }, { from: "t", to: "w3" }, { from: "t", to: "w4" }] }
> transition: slide
The calculation order. Postgres can run a parallel aggregate — splitting your rows across worker processes, each summing its own chunk, then combining them.

## 08 — the plan
:: code { kind: "terminal", title: "EXPLAIN ANALYZE · run B", lines: ["Finalize Aggregate", "  -> Gather", "       Workers Planned: 4", "       Workers Launched: 4", "       -> Partial Aggregate"], highlight: [1, 3] }
> transition: fade
Changing the split changes the order of addition. With floating-point arithmetic, that **can** change the total.

## 09 — the payoff
:: title { text: "Your data never changed. Your execution plan did." }
> transition: fade
> hold: 700
Your data never changed. Your execution plan **did**.

## 10 — the check
:: code { kind: "card", eyebrow: "postgres 17.11 · one run", headline: "Does a fraction of a cent matter?", title: "payments · 5,000,000 rows", lines: ["intended   1250655316.89", "float8     1250655316.8900335", "off by     0.00003"], highlight: [2] }
> transition: slide
Does a fraction of a cent matter? Here's the check: sum the original integer cents — that's the total, and it never touched a float. Then sum the float column.

## 11 — what the run showed
:: title { text: "An audit total that can't reproduce isn't a total", eyebrow: "measured, not assumed" }
> transition: fade
In my run, the two **didn't** match. Not by much. But an audit total that can't reproduce isn't a total.

## 12 — the fix
:: code { kind: "card", eyebrow: "the fix", headline: "Money doesn't go in a float", title: "column types", lines: ["amount        DOUBLE PRECISION   ✗", "amount        NUMERIC(12,2)      ✓", "amount_cents  BIGINT             ✓"], highlight: [1, 2] }
> transition: slide
So money doesn't go in a float. For ordinary two-decimal currency, use **numeric** for exact decimal arithmetic, or store cents in a bigint. Numeric can be slower, so benchmark if performance matters.

## 13 — the caveat
:: code { kind: "card", eyebrow: "neither fixes this", headline: "Division", title: "$10.00 ÷ 3", lines: ["3.33  +  3.33  +  3.34"], highlight: [0] }
> transition: fade
Neither fixes division — split ten dollars three ways and somebody gets the **extra** cent. That's a business rule, not a bug.

## 14 — tomorrow
:: title { text: "Your email is not a primary key", eyebrow: "day 03", subtitle: "what broke for you?" }
> transition: fade
If you've hit a production bug caused by the wrong column type, tell me what broke. Tomorrow: why your email should never be a primary key.
