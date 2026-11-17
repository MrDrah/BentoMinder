// Are we inside the Capacitor native shell (Android app)? The shell injects `window.Capacitor` before the page's
// scripts run, so asking it needs no import: @capacitor/core stays out of the web bundle entirely.
// Equivalent to `Capacitor.isNativePlatform()`; a plain browser (or a Capacitor web stub) answers false.
export function isNativePlatform(scope: unknown = globalThis): boolean {
  const cap = (scope as { Capacitor?: { isNativePlatform?: () => boolean } } | undefined)?.Capacitor;
  try {
    return typeof cap?.isNativePlatform === 'function' && cap.isNativePlatform() === true;
  } catch {
    return false;
  }
}
