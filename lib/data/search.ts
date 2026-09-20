import Fuse from "fuse.js";
const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[_@]/g, " ")
    .replace(/payments/g, "payment")
    .replace(/reels/g, "reel")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
/** Every search term must match; Fuse tolerates small spelling mistakes. */
export function searchItems<T>(
  items: T[],
  query: string,
  toText: (item: T) => string,
): T[] {
  const terms = normalize(query).split(" ").filter(Boolean);
  if (!terms.length) return items;
  let candidates = items.map((item) => ({
    item,
    text: normalize(toText(item)),
  }));
  for (const term of terms) {
    // Short opinion terms must not confuse "late" with "date" or "paid" with "said".
    if (term.length <= 4) {
      candidates = candidates.filter((candidate) =>
        candidate.text.split(" ").some((word) => word.startsWith(term)),
      );
      continue;
    }
    candidates = new Fuse(candidates, {
      keys: ["text"],
      threshold: 0.3,
      ignoreLocation: true,
      ignoreFieldNorm: true,
    })
      .search(term)
      .map((result) => result.item);
  }
  return candidates.map((candidate) => candidate.item);
}
