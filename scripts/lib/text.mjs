// Shared, pure text-cleaning helpers — imported by scripts/update-data.mjs
// (build time) and test/text.test.mjs. No I/O, no randomness.

// Strips CDATA wrappers and HTML tags, decodes entities. Order matters:
// entities MUST be decoded BEFORE tag-stripping runs, not after — a string
// containing the literal text "&lt;composer@cursor.com&gt;" (HN encodes
// typed angle brackets as entities) has no literal "<" for a tag-stripper to
// see until entities decode, so stripping first lets it survive as
// "<composer@cursor.com>" in the final output. Stripping AFTER decoding
// catches anything entity-encoding could have smuggled through, not just
// literally-raw tags.
export function decodeEntities(s) {
  if (!s) return '';
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
