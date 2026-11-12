// Main-chunk side of the dish illustrations: loads the `dish-art` chunk lazily and never breaks the frame
// (design/illustrations.md §4, §5): while loading or on any error the empty panel and stripe stay.
import { Component, lazy, Suspense, type ReactNode } from 'react';

const DishArt = lazy(() => import('./DishArt.tsx'));

class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function DishArtSlot({ type, ambient }: { type: unknown; ambient?: boolean }) {
  return (
    <Quiet>
      <Suspense fallback={null}>
        <DishArt type={typeof type === 'string' ? type : null} ambient={ambient === true} />
      </Suspense>
    </Quiet>
  );
}
