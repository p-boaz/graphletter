export function isNewUser(input: { evidenceCount: number }): boolean {
  return input.evidenceCount === 0;
}
