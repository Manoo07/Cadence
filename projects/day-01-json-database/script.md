---
title: The JSON File That Became a Database
voice: elevenlabs:Liam
style: paper-vector
format: 9x16
captions: selection
---

<!--
  Day 01 — Why Your Database Does That

  The seven-slot spine is carried by the `stack` layout: it holds the full
  failure list from the first frame and reveals one more each time a failure
  lands. The viewer watches the map fill in, which is the whole premise.

  Mechanism scenes and naming scenes alternate, so the spine returns often
  enough to stay present without twenty seconds of the same picture.
-->

## 01 — the hook
:: device { kind: "card", title: "users.json · 12 KB", body: ["{", "  \"users\": [", "    { \"id\": 1, \"email\": \"ravi@example.com\" },", "    { \"id\": 2, \"email\": \"mira@example.com\" }", "  ]", "}"] }
I replaced my database with a single JSON file. And it worked. For about four days. Then it **broke** — in the exact same order it breaks for everybody.

## 02 — the map
:: stack { items: ["", "", "", "", "", "", ""], revealed: 7, title: "Seven failures", order: "down" }
> transition: fade
Seven failures, in order. Every one is something your database already solved for you. That's the reason it exists.

## 03 — two writers
:: diagram { arrange: "hub", eyebrow: "problem 01", headline: "Lost update", nodes: [{ id: "f", label: "users.json", tone: "ink" }, { id: "a", label: "REQUEST A", tone: "cool" }, { id: "b", label: "REQUEST B", tone: "accent" }], edges: [{ from: "a", to: "f" }, { from: "b", to: "f" }] }
> transition: slide
One. Two requests land in the same millisecond. Both read the file. Both change a different user. Both write it all back.

## 04 — lost update
:: stack { items: ["LOST UPDATE", "", "", "", "", "", ""], revealed: 7, active: 0, title: "Seven failures", order: "down" }
> transition: fade
The second write lands on top of the first — and that first change is just **gone**. No error. No log line. Gone.

## 05 — truncated
:: code { kind: "terminal", eyebrow: "problem 02", headline: "Truncated file", title: "write interrupted", lines: ["{", "  \"users\": [", "    { \"id\": 1, \"email\": \"ravi@exa", "", "SyntaxError: Unexpected end of JSON input"], highlight: [2, 4] }
> transition: slide
Two. The process is killed halfway through a write. Now the file is truncated JSON that will not even parse.

## 06 — no recovery
:: stack { items: ["LOST UPDATE", "NO CRASH RECOVERY", "", "", "", "", ""], revealed: 7, active: 1, title: "Seven failures", order: "down" }
> transition: fade
Your data isn't corrupted in some abstract sense — it's **unreadable**.

## 07 — full scan
:: stat { eyebrow: "problem 03", headline: "Full scan", stats: [{ value: 4, suffix: " GB", label: "read every time", tone: "accent" }], caption: "No way to jump to the right place" }
> transition: slide
Three. The file is four gigabytes now. Finding one user by email means reading all four, every **single** time.

## 08 — no index
:: stack { items: ["LOST UPDATE", "NO CRASH RECOVERY", "NO INDEX", "", "", "", ""], revealed: 7, active: 2, title: "Seven failures", order: "down" }
> transition: fade
No way to jump straight there.

## 09 — nested loops
:: code { kind: "terminal", eyebrow: "problem 04", headline: "Nested loops", title: "query.js", lines: ["for (const u of users) {", "  for (const o of orders) {", "    if (o.userId === u.id) ...", "  }", "}", "", "> done in 6m 14s"], highlight: [1, 6] }
> transition: slide
Four. Last week's signups, joined against orders. A loop inside a loop. **Six minutes**.

## 10 — two copies
:: compare { eyebrow: "problem 05", headline: "Two drifting copies", left: { title: "users.json", items: ["id: 2", "email: mira@…", "plan: pro"] }, right: { title: "users-by-plan.json", items: ["id: 2", "email: mira@…", "plan: free"], tone: "accent" } }
> transition: slide
Five. Two features need different shapes, so you keep two copies. They **drift** within a week.

## 11 — no truth
:: stack { items: ["LOST UPDATE", "NO CRASH RECOVERY", "NO INDEX", "NO QUERY ENGINE", "NO SOURCE OF TRUTH", "", ""], revealed: 7, active: 4, title: "Seven failures", order: "down" }
> transition: fade
No query engine. No single source of truth.

## 12 — the string twelve
:: code { kind: "card", eyebrow: "problem 06", headline: "No schema", title: "users.json", lines: ["{ \"id\": 7,", "  \"name\": \"Dev\",", "  \"age\": \"twelve\" }"], highlight: [2] }
> transition: slide
Six. Someone writes the string **twelve** into the age field. Nothing stops them. You find out six months later, in a report that won't add up.

## 13 — whole file
:: grid { columns: 3, eyebrow: "problem 07", headline: "Whole file only", items: [{ label: "id" }, { label: "email", tone: "accent" }, { label: "age" }, { label: "plan" }, { label: "city" }, { label: "created" }] }
> transition: slide
Seven. A teammate needs one column — and the only unit you have is the **whole file**.

## 14 — all seven
:: stack { items: ["LOST UPDATE", "NO CRASH RECOVERY", "NO INDEX", "NO QUERY ENGINE", "NO SOURCE OF TRUTH", "NO SCHEMA", "NO ACCESS CONTROL"], revealed: 7, active: 6, title: "Seven failures", order: "down" }
> transition: fade
Here's the part that matters. None of those is a problem with your app. They're **general** — every application hits them, in that order.

## 15 — the turn
:: compare { headline: "Seven failures, seven features", divider: "→", left: { title: "What broke", items: ["Lost update", "Truncated file", "Full scan", "Nested loops", "Two copies", "\"twelve\"", "Whole file"] }, right: { title: "What you get", items: ["Concurrency control", "Crash recovery", "Indexes", "Query planner", "One source of truth", "Enforced schema", "Per-user permissions"], tone: "good" } }
> transition: fade
> hold: 900
So somebody solved them once, properly, in a separate piece of software. And now you rent that solution for the price of a connection string. That software is a **DBMS**.

## 16 — vocabulary
:: diagram { arrange: "column", headline: "Not the same thing", nodes: [{ id: "db", label: "DATABASE", sub: "the data" }, { id: "dbms", label: "DBMS", sub: "the software", tone: "cool" }, { id: "rdbms", label: "RDBMS", sub: "tables with rules", tone: "accent" }] }
> transition: slide
Quick vocabulary. The database is the data. The DBMS is the software managing it. An RDBMS stores it as tables with rules — written once, enforced on **every** writer.

## 17 — tomorrow
:: title { text: "Money is never a float", eyebrow: "day 02", subtitle: "0.1 + 0.2 = 0.30000000000000004" }
> transition: fade
That's the entire reason this field exists. Tomorrow: the type decision that silently breaks **money**. If you store prices as a float, you already have the bug.
