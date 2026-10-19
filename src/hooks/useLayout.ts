import { useEffect, useState } from 'react';

/** Reactive `window.matchMedia` — e.g. `useMediaQuery('(min-width: 1024px)')`. */
export function useMediaQuery(query: string): boolean {
  const get = () => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** Width of an element, not of the screen: a page next to a docked chat panel is narrower than the
 *  viewport, so layout decisions ("two columns or one?") must follow the room it actually has.
 *  Returns a callback ref (not an object ref) so it also works for a page that shows a loading state
 *  first and only renders the measured element later. */
export function useElementWidth<T extends HTMLElement>(): [(node: T | null) => void, number] {
  const [el, setEl] = useState<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, width];
}

/** Pixels the on-screen keyboard covers at the bottom (iOS keeps the layout viewport full-height, so a
 *  bottom-fixed sheet would otherwise sit behind the keyboard with its input hidden). */
export function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!active || !vv) { setInset(0); return; }
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); };
  }, [active]);
  return inset;
}
