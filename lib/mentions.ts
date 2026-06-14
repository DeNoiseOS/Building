/**
 * V0.7 — @mention token parsing.
 *
 * Mentions are stored inline in comment / announcement bodies as
 *   @[Display Name](userId)
 *
 * The picker UI inserts this token form when a user is selected from the
 * autocomplete dropdown. The server parses tokens to emit notifications.
 *
 * This module is intentionally pure — usable in both client and server.
 */

const MENTION_REGEX = /@\[([^\]]+)\]\(([a-zA-Z0-9_-]+)\)/g;

export interface ParsedMention {
  name: string;
  userId: string;
  /** Index within the body where the token starts. */
  start: number;
  /** Length of the raw token (`@[...](...)`). */
  length: number;
}

export function parseMentions(body: string): ParsedMention[] {
  const out: ParsedMention[] = [];
  for (const m of body.matchAll(MENTION_REGEX)) {
    out.push({
      name: m[1],
      userId: m[2],
      start: m.index ?? 0,
      length: m[0].length,
    });
  }
  return out;
}

/** Distinct mentioned user IDs, in order of first appearance. */
export function mentionedUserIds(body: string): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const m of parseMentions(body)) {
    if (!seen.has(m.userId)) {
      seen.add(m.userId);
      ids.push(m.userId);
    }
  }
  return ids;
}

/**
 * Convert a body containing `@[Name](id)` tokens into structured segments
 * for rendering. Used by the comment renderer to highlight mentions.
 */
export type BodySegment =
  | { type: "text"; value: string }
  | { type: "mention"; name: string; userId: string };

export function bodySegments(body: string): BodySegment[] {
  const out: BodySegment[] = [];
  let cursor = 0;
  for (const m of parseMentions(body)) {
    if (m.start > cursor) {
      out.push({ type: "text", value: body.slice(cursor, m.start) });
    }
    out.push({ type: "mention", name: m.name, userId: m.userId });
    cursor = m.start + m.length;
  }
  if (cursor < body.length) {
    out.push({ type: "text", value: body.slice(cursor) });
  }
  return out;
}
