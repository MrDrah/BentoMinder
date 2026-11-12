// US-E17-01: the art frame renders first, then the lazy drawing fills it; any unknown type shows `other`.
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DISH_TYPES } from '../../../src/domain/schema/index.ts';
import { RecipeArt } from '../../../src/ui/recommend/parts.tsx';

afterEach(cleanup);

describe('RecipeArt frame', () => {
  it('US-E17-01/AC1 the frame carries the type and gets exactly one drawing, for every type and size', async () => {
    for (const size of ['card', 'thumb', 'hero'] as const) {
      for (const t of DISH_TYPES) {
        const { container, unmount } = render(<RecipeArt size={size} dishType={t} />);
        const frame = container.querySelector('[data-testid="recipe-art"]') as HTMLElement;
        expect(frame.dataset['dishType']).toBe(t);
        await waitFor(() => expect(frame.querySelectorAll('svg')).toHaveLength(1));
        unmount();
      }
    }
  });

  it('US-E17-01/AC2 a missing, empty or unknown type renders the other drawing and nothing breaks', async () => {
    for (const bad of [undefined, null, '', 'pizza', 42]) {
      const { container, unmount } = render(<RecipeArt size="card" dishType={bad} />);
      const frame = container.querySelector('[data-testid="recipe-art"]') as HTMLElement;
      expect(frame.dataset['dishType']).toBe('other');
      await waitFor(() => expect(frame.querySelector('svg')).not.toBeNull());
      unmount();
    }
  });

  it('US-E17-01/AC6 the frame is there before the drawing arrives (the stripe is part of the first paint)', () => {
    const { container } = render(<RecipeArt size="hero" dishType="egg" />);
    expect(container.querySelector('.recipe-art--hero .recipe-art__stripe')).not.toBeNull();
  });

  it('US-E17-01/AC3 the drawing is hidden from assistive technology and holds no text, title or role', async () => {
    const { container } = render(<RecipeArt size="card" dishType="salad" />);
    const svg = await waitFor(() => {
      const el = container.querySelector('svg');
      expect(el).not.toBeNull();
      return el as SVGSVGElement;
    });
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
    expect(svg.hasAttribute('role')).toBe(false);
    expect(svg.querySelector('text, title, desc, image, filter')).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
  });
});
