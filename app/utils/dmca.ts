const DMCA_BLOCKED_IDS = new Set([
  "4bafceb5-c1b9-46f7-928d-3ff01b6627b4", // O Ultimo Saiyuki
  "141609b6-cf86-4266-904c-6648f389cdc9", // RuriDragon
  "c0defdaa-e9eb-4c7d-ae27-db989fcf0105", // Viz Manga reported listing
  "1044287a-73df-48d0-b0b2-5327f32dd651", // JoJo's Bizarre Adventure Part 7: Steel Ball Run
  "47e5c76d-1420-4bfa-a973-90524c9d6f13", // Pokemon Adventures
]);

/**
 * Checks if a given MangaDex ID is blocked due to a DMCA copyright complaint.
 */
export function isDmcaBlocked(id: string | null | undefined): boolean {
  if (!id) return false;
  return DMCA_BLOCKED_IDS.has(id.toLowerCase().trim());
}
