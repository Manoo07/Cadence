/**
 * Result — the error channel for the pure core.
 *
 * Nothing in `src/core` throws. Fallible transforms return a Result so that
 * callers (and the validator, and Claude) get a complete list of what went
 * wrong instead of only the first failure.
 */

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E = Issue> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export const isOk = <T, E>(r: Result<T, E>): r is Ok<T> => r.ok;
export const isErr = <T, E>(r: Result<T, E>): r is Err<E> => !r.ok;

export const map = <T, U, E>(r: Result<T, E>, f: (t: T) => U): Result<U, E> =>
  r.ok ? ok(f(r.value)) : r;

export const flatMap = <T, U, E>(
  r: Result<T, E>,
  f: (t: T) => Result<U, E>,
): Result<U, E> => (r.ok ? f(r.value) : r);

export const unwrapOr = <T, E>(r: Result<T, E>, fallback: T): T =>
  r.ok ? r.value : fallback;

/** Collect many Results into one, accumulating every error rather than stopping at the first. */
export const all = <T, E>(results: readonly Result<T, E>[]): Result<T[], E[]> => {
  const values: T[] = [];
  const errors: E[] = [];
  for (const r of results) {
    if (r.ok) values.push(r.value);
    else errors.push(r.error);
  }
  return errors.length > 0 ? err(errors) : ok(values);
};

/** A machine-readable problem. The validator emits arrays of these as JSON. */
export type Severity = "error" | "warning" | "info";

export type Issue = {
  readonly code: string;
  readonly message: string;
  readonly severity: Severity;
  /** Scene id the issue belongs to, when it is scene-scoped. */
  readonly scene?: string;
  /** Dotted path into the offending data, e.g. "scenes.3.props.title". */
  readonly path?: string;
  /** What to do about it — written for an agent to act on. */
  readonly hint?: string;
};

export const issue = (
  code: string,
  message: string,
  extra: Partial<Omit<Issue, "code" | "message">> = {},
): Issue => ({ code, message, severity: "error", ...extra });
