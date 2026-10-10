/**
 * The service worker script and the files it loads with importScripts().
 * Browsers fetch them without a session and a redirect or an HTML answer makes
 * the worker fail to install, so the proxy, the host split and the org-lock
 * redirect must all let them through.
 */
const SERVICE_WORKER_PATHS: ReadonlySet<string> = new Set([
  "/sw.js",
  "/sw-queue-rules.js",
]);

export function isServiceWorkerPath(pathname: string): boolean {
  return SERVICE_WORKER_PATHS.has(pathname);
}
