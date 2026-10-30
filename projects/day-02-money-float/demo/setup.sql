-- Day 02 — the dataset.
-- amount_cents is integer ground truth: it never passes through a float, so
-- "the total you meant" is a measurement rather than an assertion.
DROP TABLE IF EXISTS payments;
CREATE TABLE payments AS
SELECT c                   AS amount_cents,
       (c / 100.0)::float8 AS amount
FROM (SELECT (round(random() * 50000))::bigint AS c
      FROM generate_series(1, 5000000)) s;

VACUUM ANALYZE payments;   -- the planner needs stats to choose parallel
