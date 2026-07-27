/** Normalize Express 5 route params that may be string | string[] */
export function paramId(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}
