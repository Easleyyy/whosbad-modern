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
      // Update checks only happen on navigation by default — for a PWA that
      // stays open for a long time, also poll periodically.
      window.setInterval(() => registration.update(), 60 * 60 * 1000);
    },
  });
}

export function applyPwaUpdate() {
  void applyUpdate?.(true);
}
