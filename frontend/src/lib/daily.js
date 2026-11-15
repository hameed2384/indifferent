/** Index of today's motion: same for everyone on a given UTC day, changes daily. */
export function dailyIndex(count, date = new Date()) {
  if (!count) return 0;
  const day = Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86400000);
  return day % count;
}
