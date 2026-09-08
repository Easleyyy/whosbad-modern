import { registerSW } from 'virtual:pwa-register';

let applyUpdate: ((reload?: boolean) => Promise<void>) | undefined;

/**
 * Registers the service worker ourselves (instead of vite-plugin-pwa's
 * auto-injected script) so an already-open tab gets told a new version is
 * ready instead of silently continuing to run stale JS — the app is a PWA
 * people keep open for days, and stale bundles have already caused confusing
 * "empty data" / broken-request symptoms this way.
 */
export function initPwaUpdate(onNeedRefresh: () => void) {
  applyUpdate = registerSW({
    onNeedRefresh,
    onRegisteredSW(_url, registration) {
      if (!registration) return;

      // registerSW()'s onNeedRefresh only reliably fires for an update that
      // starts DURING this page's session (via the 'updatefound' event) — if
      // a previous tab already left a worker sitting in `waiting` before this
      // registration ran, that event never refires and onNeedRefresh is
      // silently skipped. Check for that case explicitly, and keep watching
      // for new installs the same way instead of trusting onNeedRefresh alone.
      if (registration.waiting) onNeedRefresh();
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        installing?.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            onNeedRefresh();
          }
        });
      });

      // Update checks only happen on navigation by default — for a PWA that
      // stays open for a long time, also poll periodically.
      window.setInterval(() => registration.update(), 60 * 60 * 1000);
    },
  });
}

export function applyPwaUpdate() {
  void applyUpdate?.(true);
}
