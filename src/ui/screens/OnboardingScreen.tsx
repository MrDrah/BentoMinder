// Onboarding frame (design/components.md §6.1, flows F1): 3 input steps (profile → menu source
// → review), then the calendar, which is not a numbered step (US-E1-01/AC1). Step 1 is saved on
// 「次へ」 so a reload resumes at step 2 with the answers kept (US-E1-01/AC3–AC4).
import { emptyProfileForm, formToProfile, profileToForm, saveProfile } from '../../domain/profile/profile.ts';
import { pendingReview } from '../../domain/menu/store-ops.ts';
import type { YearMonth } from '../../domain/time/jst.ts';
import { useApp, useStore } from '../app-store.tsx';
import { LangToggle } from '../components/LangToggle.tsx';
import { Icon } from '../components/Icon.tsx';
import { Stepper } from '../components/Controls.tsx';
import { navigate, toHash, type OnboardingStep } from '../router.ts';
import { ImportScreen } from './ImportScreen.tsx';
import { ProfileForm } from './ProfileForm.tsx';
import { ReviewScreen } from './ReviewScreen.tsx';

export function OnboardingScreen({ step, month, manual }: { step: OnboardingStep; month: YearMonth | null; manual: boolean }) {
  const { t, now, commit, showToast } = useApp();
  const store = useStore();
  const title = t(step === 1 ? 'ob.step1.name' : step === 2 ? 'ob.step2.name' : 'ob.step3.name');
  const reviewMonth = month ?? (pendingReview(store)?.month as YearMonth | undefined) ?? null;
  const back = step === 2 ? toHash({ name: 'onboarding', step: 1, month: null, manual: false }) : step === 3 ? toHash({ name: 'onboarding', step: 2, month: null, manual: false }) : null;

  return (
    <div className="screen screen--onboarding" data-testid="screen-onboarding">
      <header className="topbar">
        <div className="appbar__inner">
          {back !== null && (
            <a className="iconbtn" href={back} data-testid="topbar-back" aria-label={t('nav.backTo', { screen: t(step === 2 ? 'ob.step1.name' : 'ob.step2.name') })}>
              <Icon name="chevronLeft" />
            </a>
          )}
          <h1 className="topbar__title" data-testid="topbar-title">
            {title}
          </h1>
          <LangToggle />
        </div>
        <div className="appbar__inner">
          <Stepper step={step} />
        </div>
      </header>
      <main id="main" className="page page--onboarding" data-testid={`ob-step-${step}`}>
        {step === 1 && (
          <>
            <p className="hero">{t('ob.welcome.title')}</p>
            <p>{t('ob.welcome.lead')}</p>
            <ProfileForm
              initial={store.profile === null ? emptyProfileForm() : profileToForm(store.profile)}
              submitLabel={t('common.next')}
              submitTestId="ob-next"
              footerNote={<p className="field__hint">{t('ob.privacy.local')}</p>}
              onSubmit={async (form) => {
                const r = formToProfile(form, now(), store.profile);
                if (!r.ok) return;
                if (await commit(saveProfile(store, r.profile, now()))) {
                  // US-E1-06/AC3: with a confirmed menu already stored, the menu is not imported again.
                  const hasMenu = Object.values(store.menus).some((m) => m.confirmed !== null);
                  navigate(hasMenu ? { name: 'calendar', month: null } : { name: 'onboarding', step: 2, month: null, manual: false });
                } else showToast(t('toast.saveFailed'));
              }}
            />
          </>
        )}
        {step === 2 && <ImportScreen onboarding />}
        {step === 3 && reviewMonth !== null && <ReviewScreen key={`${reviewMonth}-${manual}`} month={reviewMonth} manual={manual} onboarding />}
        {step === 3 && reviewMonth === null && <ImportScreen onboarding />}
      </main>
    </div>
  );
}
