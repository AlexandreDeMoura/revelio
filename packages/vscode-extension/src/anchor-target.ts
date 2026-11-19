// Where an Anchor's `at` points: a file of the app, and the symbol after `#` when there is one.
import path from "node:path";

export type AnchorTarget = { file: string; symbol?: string };

// The file and symbol `at` names, or undefined when it names nothing inside the app.
export function anchorTarget(appRoot: string, at: string): AnchorTarget | undefined {
  const [relative = "", symbol] = at.split("#");
  if (!relative || path.isAbsolute(relative)) return undefined;
  const file = path.resolve(appRoot, relative);
  const inside = path.relative(appRoot, file);
  if (!inside || inside.startsWith("..") || path.isAbsolute(inside)) return undefined;
  return symbol ? { file, symbol } : { file };
}

const modifiers = String.raw`(?:(?:export|default|declare|abstract|async|static|public|private|protected|readonly|override|get|set)\s+)*`;
const keywords = String.raw`(?:function\*?|class|interface|type|enum|const|let|var|def|async\s+def)`;

// Where `text` defines `symbol` (`name`, or `Class.member` for a member): the first character
// of that line, past its indent. Used when the editor has no symbols for the file.
export function definitionOffset(text: string, symbol: string): number | undefined {
  const [name = "", member] = symbol.split(".");
  const at = findLine(text, new RegExp(String.raw`^[ \t]*${modifiers}${keywords}\s+${escape(name)}\b`, "m"), 0) ??
    // Python's `NAME = value` and `NAME: type = value` at the top level.
    findLine(text, new RegExp(String.raw`^${escape(name)}\s*(?::[^=\n]*)?=`, "m"), 0);
  if (at === undefined || member === undefined) return at;
  // A member is defined further in, at the first line after its class that names it.
  const memberLine = new RegExp(String.raw`^[ \t]*${modifiers}(?:def\s+|async\s+def\s+)?${escape(member)}\b\s*[(=:<?!]`, "m");
  return findLine(text, memberLine, at + 1);
}

function findLine(text: string, pattern: RegExp, from: number): number | undefined {
  const match = pattern.exec(text.slice(from));
  if (!match) return undefined;
  const start = from + match.index;
  return start + (match[0].length - match[0].trimStart().length);
}

function escape(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
