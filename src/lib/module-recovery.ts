const RETRY_KEY = "caixa:module-reload";
const RETRY_INTERVAL = 60_000;

export function isModuleLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Unable to preload CSS/i.test(message);
}

export function canRetryModuleLoad(previous: number, now: number): boolean {
  return !Number.isFinite(previous) || now - previous >= RETRY_INTERVAL;
}

export function recoverModuleLoad(error: unknown): boolean {
  if (!isModuleLoadError(error)) return false;
  try {
    const previous = Number(sessionStorage.getItem(RETRY_KEY) ?? Number.NaN);
    const now = Date.now();
    if (!canRetryModuleLoad(previous, now)) return false;
    sessionStorage.setItem(RETRY_KEY, String(now));
    window.location.reload();
    return true;
  } catch {
    // Storage can be blocked; do not risk an endless reload loop.
    return false;
  }
}

export function installModuleRecovery(): () => void {
  const onPreload = (event: Event) => {
    if (recoverModuleLoad((event as Event & { payload?: unknown }).payload)) event.preventDefault();
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    if (recoverModuleLoad(event.reason)) event.preventDefault();
  };
  window.addEventListener("vite:preloadError", onPreload);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("vite:preloadError", onPreload);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}