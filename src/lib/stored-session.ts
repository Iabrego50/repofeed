/**
 * Whether this browser holds a saved sign-in. Signed-out visitors (no saved session) can be
 * shown the public homepage immediately instead of waiting for the auth check to finish.
 */
export function hasStoredSession(): boolean {
  const key = `oidc.user:${import.meta.env.VITE_HERCULES_OIDC_AUTHORITY}:${import.meta.env.VITE_HERCULES_OIDC_CLIENT_ID}`;
  const read = (store: () => Storage) => {
    try {
      return store().getItem(key) !== null;
    } catch {
      // Storage can be blocked (e.g. some privacy modes); assume a session so we wait for auth.
      return true;
    }
  };
  return read(() => window.localStorage) || read(() => window.sessionStorage);
}
