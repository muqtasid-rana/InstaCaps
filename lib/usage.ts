/** Caption generations each new account gets. Change it per user with `generationsLimit` in Firestore. */
export const FREE_GENERATIONS = 2;

export type Usage = {
  used: number;
  limit: number;
  /** False in local development without Firebase server keys: nothing is counted. */
  enforced: boolean;
};

export function usageLine(u: Usage) {
  const left = Math.max(0, u.limit - u.used);
  if (!u.enforced) return "Local mode: generations aren't counted";
  if (left === 0) return `You've used your ${u.limit} free generations`;
  return `${left} of ${u.limit} free ${u.limit === 1 ? "generation" : "generations"} left`;
}
