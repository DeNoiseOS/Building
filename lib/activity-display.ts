/**
 * Compose an activity line for display.
 *
 * - When `actorName` is present, prefix the actor and lowercase the first
 *   letter of the message: "Faris created task 'X'."
 * - When `actorName` is absent (very old V0.1 rows that escaped the
 *   migration backfill), leave the message untouched.
 *
 * Messages are stored either capitalized (legacy / pre-V0.2) or
 * non-capitalized (V0.2 onward). The display always normalizes to a
 * sentence that reads naturally with or without the actor.
 */
export function formatActivityLine(
  actorName: string | null | undefined,
  message: string
): string {
  if (!actorName) return message;
  const trimmed = message.trimStart();
  const lowered = trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
  return `${actorName} ${lowered}`;
}
