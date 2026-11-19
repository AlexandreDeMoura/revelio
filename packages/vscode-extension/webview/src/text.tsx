// Text as the page shows it.

// Text with code, an address or a label on screen marked between backticks.
export function InlineText({ text }: { text: string }) {
  return text.split("`").map((piece, i) => (i % 2 === 1 ? <code key={i}>{piece}</code> : piece));
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
