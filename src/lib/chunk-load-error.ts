/** Detects stale Vite chunk / dynamic-import failures after a deploy. */

const CHUNK_ERROR_RE =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|'text\/html' is not a valid JavaScript MIME type/i;

const RELOAD_AT_KEY = "repofeed:chunk-reload-at";
const RELOAD_COOLDOWN_MS = 30_000;

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string") return message;
  }
  return String(error ?? "");
}

/** True when `error` looks like a failed lazy/dynamic chunk load. */
export function isChunkLoadError(error: unknown): boolean {
  return CHUNK_ERROR_RE.test(errorMessage(error));
}

/**
 * Full page reload so the browser picks up the new index + chunk hashes.
 * Guarded by sessionStorage so a persistent failure cannot reload-loop.
 * @returns whether a reload was started
 */
export function reloadForChunkError(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_AT_KEY) ?? "0");
    if (Number.isFinite(last) && Date.now() - last < RELOAD_COOLDOWN_MS) {
      return false;
    }
    sessionStorage.setItem(RELOAD_AT_KEY, String(Date.now()));
  } catch {
    // sessionStorage may be unavailable; still attempt a single reload
  }
  window.location.reload();
  return true;
}

/** Register window listeners for Vite preload + unhandled chunk failures. */
export function installChunkLoadErrorHandlers(): void {
  window.addEventListener("vite:preloadError", ((event: Event) => {
    event.preventDefault();
    reloadForChunkError();
  }) as EventListener);

  window.addEventListener("unhandledrejection", (event) => {
    if (!isChunkLoadError(event.reason)) return;
    event.preventDefault();
    reloadForChunkError();
  });

  window.addEventListener("error", (event) => {
    if (!isChunkLoadError(event.error ?? event.message)) return;
    reloadForChunkError();
  });
}
