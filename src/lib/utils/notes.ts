export function splitNotesToBullets(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter((x) => x.length > 0);
  }

  if (typeof input !== "string") return [];

  let s = input.trim();
  if (!s) return [];

  // Insert separators before common coaching labels so they become bullets.
  s = s.replace(
    /(\s*)(Tempo:|Focus:|Cue:|Setup:|Brace:|Rest:)/gi,
    (_m, _ws, label) => `\n${label}`
  );

  // Split on newlines and bullet symbols.
  const rawParts = s
    .split(/\r?\n|•/g)
    .map((p) => p.trim())
    .filter(Boolean);

  // Clean leading numbering/bullets/dashes.
  return rawParts
    .map((p) => p.replace(/^[-–—]\s+/, "").replace(/^\d+[\).]\s+/, "").trim())
    .filter((p) => p.length > 0);
}

