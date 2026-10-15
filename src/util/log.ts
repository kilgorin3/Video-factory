const tty = process.stderr.isTTY && !process.env.NO_COLOR;
const c = (code: number) => (s: string) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);

export const color = {
  dim: c(2),
  bold: c(1),
  red: c(31),
  green: c(32),
  yellow: c(33),
  blue: c(34),
  magenta: c(35),
  cyan: c(36),
};

type Sink = (line: string) => void;
let sink: Sink = (line) => process.stderr.write(`${line}\n`);

/** Redirect logs (the MCP server must keep stdout clean for JSON-RPC). */
export function setLogSink(next: Sink) {
  sink = next;
}

export const log = {
  step: (msg: string) => sink(`${color.cyan("▸")} ${color.bold(msg)}`),
  info: (msg: string) => sink(`  ${msg}`),
  ok: (msg: string) => sink(`  ${color.green("✓")} ${msg}`),
  warn: (msg: string) => sink(`  ${color.yellow("!")} ${msg}`),
  error: (msg: string) => sink(`  ${color.red("✗")} ${msg}`),
  dim: (msg: string) => sink(color.dim(`  ${msg}`)),
};
