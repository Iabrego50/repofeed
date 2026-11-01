export class ServerNotConfiguredError extends Error {
  readonly status = 503;

  constructor(public readonly envVar: string) {
    super(`Server not configured: ${envVar} missing`);
    this.name = "ServerNotConfiguredError";
  }
}

export function envValue(name: string): string {
  return String(process.env[name] ?? "").trim();
}

/** First non-empty env var wins; error names the first candidate. */
export function requiredEnv(...names: string[]): string {
  for (const name of names) {
    const value = envValue(name);
    if (value) return value;
  }
  throw new ServerNotConfiguredError(names[0]);
}

export function isServerNotConfigured(error: unknown): error is ServerNotConfiguredError {
  return (
    error instanceof ServerNotConfiguredError ||
    (error instanceof Error &&
      error.message.startsWith("Server not configured:") &&
      error.message.endsWith(" missing"))
  );
}
