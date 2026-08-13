/** Today's UTC date as `YYYY-MM-DD` — used to key the daily puzzle so every
 * player gets the same chain (and the same scrambles) on a given day. */
export function todayUtcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}
