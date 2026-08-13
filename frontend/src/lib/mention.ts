/**
 * `@`-mention helpers for the Agent chat input.
 *
 * The input is a plain textarea (no rich-text editor): typing `@` opens a
 * lightweight autocomplete over attached context snippets and built-ins. The
 * inserted text is a plain reference token (e.g. `@ctx-1`); the backend expands
 * it into the snippet's Markdown content before sending to the model.
 */

export interface MentionOption {
  /** Reference token inserted into the message, e.g. "ctx-1" or "document". */
  ref: string;
  /** Human-readable label shown in the autocomplete list. */
  label: string;
}

export interface MentionState {
  /** Index in `value` where the `@` character sits. */
  start: number;
  /** Text between `@` and the caret, e.g. "ctx" for "@ctx|". */
  query: string;
}

const MENTION_PATTERN = /(?:^|[\s([{])@([A-Za-z0-9_-]*)$/;

/** Detect a mention being typed right before `caret`; null when none. */
export function detectMention(value: string, caret: number): MentionState | null {
  const match = MENTION_PATTERN.exec(value.slice(0, caret));
  if (!match) return null;
  return { start: caret - match[1].length - 1, query: match[1] };
}

/** Replace the mention query at `mention.start` with `@<ref> ` and return the
 * new value plus the caret position right after the inserted reference. */
export function applyMention(
  value: string,
  mention: MentionState,
  ref: string,
): { value: string; caret: number } {
  const insert = `@${ref} `;
  const newValue =
    value.slice(0, mention.start) + insert + value.slice(mention.start + 1 + mention.query.length);
  return { value: newValue, caret: mention.start + insert.length };
}

/** Filter options by a case-insensitive substring match on ref or label. */
export function filterMentionOptions(options: MentionOption[], query: string): MentionOption[] {
  const q = query.toLowerCase();
  if (!q) return options;
  return options.filter(
    (o) => o.ref.toLowerCase().includes(q) || o.label.toLowerCase().includes(q),
  );
}
