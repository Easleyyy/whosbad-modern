import { useEffect } from 'react';
import { useDrag } from '@use-gesture/react';
import { useMotionValue, animate } from 'framer-motion';

export function useModalGestures(isOpen: boolean, onClose: () => void) {
  const y = useMotionValue(0);

  // Android back button
  useEffect(() => {
    if (!isOpen) return;
    window.history.pushState(null, '', window.location.href);
    const handler = () => onClose();
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [isOpen, onClose]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Swipe down gesture
  const bind = useDrag(({ movement: [, my], last }) => {
    if (my < 0) return;
    if (last) {
      if (my > 120) { onClose(); }
      else { animate(y, 0, { type: 'spring', stiffness: 400, damping: 30 }); }
    } else {
      y.set(my);
    }
  }, { filterTaps: true });

  return { y, bind };
}
