\echo '=== version (record what you verified against) ==='
SELECT version();

\echo ''
\echo '=== cast semantics Scene 6 depends on ==='
SELECT 0.1::float8::numeric    AS tenth,
       123.45::float8::numeric AS cents;

\echo ''
\echo '=== GROUND TRUTH 1 of 2 — the aggregate ==='
SELECT sum(amount_cents)::numeric / 100                      AS intended_total,
       sum(amount::numeric)                                  AS cast_sum,
       sum(amount::numeric) - sum(amount_cents)::numeric/100 AS cast_error
FROM payments;

\echo ''
\echo '=== GROUND TRUTH 2 of 2 — every row ==='
-- A zero aggregate error does not prove each row cast correctly: row errors
-- can offset one another and net to zero across five million rows.
SELECT count(*) AS rows_where_cast_lost_the_amount
FROM payments
WHERE amount::numeric <> amount_cents::numeric / 100;
