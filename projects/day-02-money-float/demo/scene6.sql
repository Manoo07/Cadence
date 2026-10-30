\echo '=== Scene 6 — float summation vs the intended decimal total ==='
SELECT sum(amount_cents)::numeric / 100                        AS intended_total,
       sum(amount::numeric)                                    AS cast_sum,
       sum(amount)                                             AS float_sum,
       sum(amount_cents)::numeric/100 - sum(amount)::numeric   AS float_error
FROM payments;
