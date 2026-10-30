\echo '=== RUN B — parallel ==='
SET max_parallel_workers_per_gather = 4;
SET max_parallel_workers = 8;
SET parallel_setup_cost = 0;
SET parallel_tuple_cost = 0;
SET min_parallel_table_scan_size = 0;

SELECT sum(amount) AS total_b FROM payments;
EXPLAIN (ANALYZE, VERBOSE) SELECT sum(amount) FROM payments;
