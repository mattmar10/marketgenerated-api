export function parseBooleanEnv(
  env: string | undefined,
  defaultValue: boolean
): boolean {
  if (env === undefined) {
    return defaultValue;
  }
  return env.toLowerCase() === "true";
}
