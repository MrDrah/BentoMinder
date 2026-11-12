// Lazy chunk `dish-art` (US-E17-01): the baked, static dish illustrations. Decorative only: aria-hidden,
// no text, no image request. The frame (RecipeArt) paints first at its fixed size; this fills it.
import { useEffect, useRef } from 'react';
import { normalizeDishType, type DishType } from '../../domain/schema/dish-type.ts';
import { ART } from './art-data.ts';
import './dish-art.css';

export interface DishArtProps {
  type: DishType | string | null | undefined;
  /** Recipe page header: loops on its own (5 cycles), paused while off-screen. */
  ambient?: boolean;
}

export default function DishArt({ type, ambient = false }: DishArtProps) {
  const ref = useRef<SVGSVGElement>(null);
  const art = ART[normalizeDishType(type)];
  useEffect(() => {
    const el = ref.current;
    if (!ambient || el === null || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) el.removeAttribute('data-paused');
        else el.setAttribute('data-paused', '');
      }
    });
    io.observe(el);
  return () => io.disconnect();
  }, [ambient]);
  // `art` is static, build-time markup (art-data.ts); nothing user-supplied reaches it.
  return (
    <svg
      ref={ref}
      className="dish"
      viewBox="0 0 120 120"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
      data-ambient={ambient ? '' : undefined}
      dangerouslySetInnerHTML={{ __html: art }}
    />
  );
}
