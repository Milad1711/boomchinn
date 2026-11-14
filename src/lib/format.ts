/** Format numbers with Persian digits. */
export function faNum(n: number): string {
  return new Intl.NumberFormat('fa-IR').format(n)
}
