export const sleep = (ms:number)=> new Promise(res=>setTimeout(res, ms));
export function expBackoff(attempt: number, baseMs: number = 1000) {
  return Math.min(30_000, Math.round((2 ** attempt) * baseMs));
}
export function redactSecrets(obj: any) {
  if (obj == null || typeof obj !== "object") return obj;
  const clone: any = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" && /key|secret|token|password/i.test(k)) clone[k] = "****";
    else clone[k] = redactSecrets(v);
  }
  return clone;
}
