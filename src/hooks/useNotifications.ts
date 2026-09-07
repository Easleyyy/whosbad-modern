import { useCallback } from 'react';

export function useNotifications() {
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }, []);

  const showPendingReminder = useCallback((count: number, amount: number) => {
    if (Notification.permission !== 'granted') return;
    new Notification("Who's Bad Logistic", {
      body: `${count} vente${count > 1 ? 's' : ''} en attente — ${amount.toFixed(0)} € à encaisser`,
      icon: '/icon-192.png',
      tag: 'pending-reminder',
      silent: false,
    });
  }, []);

  return { requestPermission, showPendingReminder };
}
