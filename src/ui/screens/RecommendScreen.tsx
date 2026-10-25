// The recommendation view for one date (design/components.md §4). The recipe library and the three
// ranked suggestions arrive with M3; until then this opens, shows its title and writes nothing, so
// 「手作りお弁当にする」 never changes the decision by itself (US-E5-03/AC1, AC3). Nothing is faked.
import type { LocalDate } from '../../domain/time/jst.ts';
import { formatDate } from '../../i18n/format.ts';
import { useApp } from '../app-store.tsx';
import { TopBar } from '../components/Bars.tsx';

export function RecommendScreen({ date }: { date: LocalDate }) {
  const { t, state } = useApp();
  return (
    <div className="screen" data-testid="screen-recommend" data-date={date}>
      <TopBar title={t('rec.title')} back={{ route: { name: 'day', date }, screen: formatDate(t, state.language, date) }} />
      <main id="main" className="page">
        <p>{t('rec.lead')}</p>
        <p className="field__hint" data-testid="recommend-date">
          {formatDate(t, state.language, date)}
        </p>
      </main>
    </div>
  );
}
