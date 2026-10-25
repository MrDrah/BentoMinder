// Small browser hooks shared by the sheets: viewport mode, focus trap, container width.
import { useEffect, useState, type RefObject } from 'react';

/** `matchMedia` where it exists (jsdom has none: the answer is then `false`). */
export function useMatchMedia(query: string): boolean {
  const get = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export type SheetMode = 'sheet' | 'dialog' | 'panel';

/** components §1.12: bottom sheet below 768 px, centred dialog 768–1279 px, side panel from 1280 px. */
export function useSheetMode(): SheetMode {
  const wide = useMatchMedia('(min-width: 1280px)');
  const medium = useMatchMedia('(min-width: 768px)');
  return wide ? 'panel' : medium ? 'dialog' : 'sheet';
}

const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Keeps Tab inside `ref` while `active`, and Esc calls `onEscape` (dialogs and modal sheets). */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean, onEscape: () => void): void {
  useEffect(() => {
    if (!active) return undefined;
    const node = ref.current;
    if (node === null) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onEscape();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');
      const first = items[0];
      const last = items.at(-1);
      if (first === undefined || last === undefined) return;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    node.addEventListener('keydown', onKeyDown);
    return () => node.removeEventListener('keydown', onKeyDown);
  }, [ref, active, onEscape]);
}

/** The width of an element in CSS px (ResizeObserver; 0 where it doesn't exist, e.g. jsdom). */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (node === null || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => setWidth(node.getBoundingClientRect().width));
    observer.observe(node);
    setWidth(node.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}
