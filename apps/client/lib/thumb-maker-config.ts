/** Credits per thumbnail — must match server `THUMB_CREDIT_PER_OUTPUT`. */
export const THUMB_CREDIT_PER_OUTPUT = 12;

export function getThumbnailGenerationCreditCost(variations: number): number {
  const count = Math.max(1, Math.floor(variations) || 1);
  return count * THUMB_CREDIT_PER_OUTPUT;
}
