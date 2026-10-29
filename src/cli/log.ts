/**
 * Terminal output.
 *
 * Commands print for a person; `--json` makes them print for a program. Both
 * readers matter, so no command bakes formatting into its logic.
 */

const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
};

export const log = {
  step: (msg: string) => console.log(`${C.blue}▸${C.reset} ${msg}`),
  done: (msg: string) => console.log(`${C.green}✓${C.reset} ${msg}`),
  warn: (msg: string) => console.log(`${C.yellow}!${C.reset} ${msg}`),
  fail: (msg: string) => console.error(`${C.red}✗${C.reset} ${msg}`),
  dim: (msg: string) => console.log(`${C.dim}${msg}${C.reset}`),
  plain: (msg: string) => console.log(msg),
  title: (msg: string) => console.log(`\n${C.bold}${msg}${C.reset}`),
};

export const fail = (msg: string): never => {
  log.fail(msg);
  process.exit(1);
};
