const KEY = "indifferent-not-interested-categories";

export function readNotInterested() {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { return new Set(); }
}

function write(set) {
  try { localStorage.setItem(KEY, JSON.stringify([...set])); } catch { /* best-effort */ }
}

/** Excludes `categories` going forward and returns an undo function. */
export function excludeCategories(categories) {
  const before = readNotInterested();
  const after = new Set(before);
  categories.forEach((c) => after.add(c));
  write(after);
  return () => write(before);
}
