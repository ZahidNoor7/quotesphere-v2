// Client-safe. Pulls a trailing "SUGGESTIONS: a | b | c" line out of the
// assistant's reply so it can render as tap-able follow-up chips.
export function parseSuggestions(text: string): { content: string; suggestions: string[] } {
  const m = text.match(/\n?\s*SUGGESTIONS:\s*([^\n]+?)\s*$/i);
  if (!m || m.index === undefined) return { content: text, suggestions: [] };
  const content = text.slice(0, m.index).replace(/\s+$/, "");
  const suggestions = m[1]
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);
  return { content, suggestions };
}
