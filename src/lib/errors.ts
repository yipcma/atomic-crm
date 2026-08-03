/**
 * Narrows an unknown caught value to a message safe to show a user.
 *
 * Replaces the `catch (error: any)` / `error?.message` pattern, which silently
 * yields `undefined` for anything that is not shaped like an Error.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}
