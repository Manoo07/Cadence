# Day 02 demo

Every figure in the video comes from one session here. Nothing is retyped
from the script, and nothing is simulated.

```bash
createdb day02
psql -d day02 -f setup.sql    # 5M rows, ~20s
./run.sh                      # checks + run A + run B + scene 6, all logged
```

## What decides the edit

**Scene 1** — the two totals from run A and run B. If they match, use the
alternative opening; do not re-roll until they differ.

**Scene 8** — the real `EXPLAIN` from run B. The demo fails if there is no
`Gather` node. `Workers Launched` is the number that matters, not
`Workers Planned` — if it is 0, nothing parallel happened.

**Scene 10/11** — `intended_total` vs `float_sum`. Both ground-truth checks
must pass (aggregate error zero *and* per-row mismatches zero) before the
on-screen label can say "the total, to the cent".

**Scene 11** has two takes. Record the one matching what the log says.
