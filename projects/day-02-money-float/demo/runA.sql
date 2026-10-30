\echo '=== RUN A — serial ==='
SET max_parallel_workers_per_gather = 0;
SELECT sum(amount) AS total_a FROM payments;
EXPLAIN (ANALYZE, VERBOSE) SELECT sum(amount) FROM payments;
