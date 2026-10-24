// Profile form (design/components.md §6.2–§6.4), shared by onboarding step 1 and the profile
// edit screen: nickname, age chips, likes/dislikes pickers, allergy status + allergens, diet,
// themes, note. Rules live in src/domain/profile (BR-20); this file only renders them.
import { useId, useRef, useState, type ReactNode } from 'react';
import {
  AGE_RANGES,
} from '../../domain/schema/profile.ts';
import { DIETS, type Diet } from '../../domain/schema/primitives.ts';
import {
  clampCodePoints,
  foodLabel,
  NICKNAME_MAX,
  NOTE_MAX,
  POPULAR_FOOD_IDS,
  searchFoods,
  toggleFood,
  toggleIn,
  toggleTheme,
  validateProfileForm,
  type FoodOption,
  type ProfileError,
  type ProfileForm as Form,
} from '../../domain/profile/profile.ts';
import type { MessageKey } from '../../i18n/index.ts';
import { useApp } from '../app-store.tsx';
import { Banner, Chip, FieldError } from '../components/Controls.tsx';

const AGE_KEYS: Record<(typeof AGE_RANGES)[number], MessageKey> = {
  'age-under-3': 'profile.age.under3',
  'age-3-4': 'profile.age.3to4',
  'age-4-5': 'profile.age.4to5',
  'age-5-6': 'profile.age.5to6',
  'age-6-9': 'profile.age.6to9',
  'age-9-12': 'profile.age.9to12',
};
const DIET_KEYS: Record<Diet, MessageKey> = {
  vegetarian: 'diet.vegetarian',
  pescatarian: 'diet.pescatarian',
  'no-pork': 'diet.noPork',
  'no-beef': 'diet.noBeef',
  'no-seafood': 'diet.noSeafood',
};
const ALLERGY_KEYS = { 'none-known': 'allergy.status.none', 'has-known': 'allergy.status.has', unknown: 'allergy.status.unknown' } as const;

function count(text: string): number {
  return [...text].length;
}

function Legend({ children, required }: { children: ReactNode; required: boolean }) {
  const { t } = useApp();
  return (
    <legend className="field__label">
      {children}
      <span className="field__tag">{t(required ? 'common.required' : 'common.optional')}</span>
    </legend>
  );
}

interface PickerProps {
  name: 'likes' | 'dislikes' | 'other-foods';
  legend: string;
  hint?: string;
  selected: string[];
  kinds: FoodOption['kind'][];
  onPick: (id: string) => void;
  showPopular: boolean;
}

/** §6.3 food picker: selected chips (removable), search, common choices. */
function FoodPicker({ name, legend, hint, selected, kinds, onPick, showPopular }: PickerProps) {
  const { t, state, services } = useApp();
  const lang = state.language;
  const dict = services.dictionary;
  const [query, setQuery] = useState('');
  const hintId = useId();
  const results = searchFoods(dict, query, 12, kinds);
  const label = (id: string) => foodLabel(dict, id, lang);
  return (
    <fieldset className="field" data-testid={`picker-${name}`} aria-describedby={hint === undefined ? undefined : hintId}>
      <legend className="field__label">{legend}</legend>
      {hint !== undefined && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      <ul className="chips" aria-label={legend}>
        {selected.length === 0 && <li className="field__hint">{t('profile.foods.empty')}</li>}
        {selected.map((id) => (
          <li key={id}>
            <span className="chip is-selected chip--removable" data-testid={`picker-${name}-chip-${id}`}>
              {label(id)}
              <button type="button" className="chip__remove" aria-label={t('profile.foods.remove', { food: label(id) })} onClick={() => onPick(id)}>
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
                  <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </button>
            </span>
          </li>
        ))}
      </ul>
      <label className="field__sublabel">
        {t('profile.foods.search')}
        <input
          className="input"
          type="search"
          value={query}
          placeholder={t('profile.foods.search')}
          onChange={(e) => setQuery(e.target.value)}
          data-testid={`picker-${name}-search`}
          autoComplete="off"
        />
      </label>
      {query.trim() !== '' && results.length === 0 && <p className="field__hint">{t('profile.foods.searchEmpty', { q: query.trim() })}</p>}
      {query.trim() === '' && showPopular && <p className="field__sublabel">{t('profile.foods.popular')}</p>}
      <div className="chips">
        {(query.trim() === '' ? (showPopular ? [...POPULAR_FOOD_IDS] : []) : results.map((r) => r.id)).map((id) => (
          <Chip key={id} testId={`picker-${name}-option-${id}`} label={label(id)} selected={selected.includes(id)} mode="pressed" onToggle={() => onPick(id)} />
        ))}
      </div>
    </fieldset>
  );
}

export interface ProfileFormProps {
  initial: Form;
  submitLabel: string;
  submitTestId: string;
  onSubmit: (form: Form) => Promise<void>;
  /** Rendered between the fields and the submit button (e.g. the edit screen's note). */
  footerNote?: ReactNode;
  secondary?: ReactNode;
  onChange?: (form: Form) => void;
}

export function ProfileForm({ initial, submitLabel, submitTestId, onSubmit, footerNote, secondary, onChange }: ProfileFormProps) {
  const { t, state, services } = useApp();
  const lang = state.language;
  const dict = services.dictionary;
  const [form, setFormState] = useState<Form>(initial);
  const [errors, setErrors] = useState<ProfileError[]>([]);
  const [notice, setNotice] = useState('');
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const ageRef = useRef<HTMLFieldSetElement>(null);
  const allergyRef = useRef<HTMLFieldSetElement>(null);
  const ids = { age: useId(), allergy: useId(), allergen: useId(), nick: useId(), note: useId() };

  const setForm = (next: Form) => {
    setFormState(next);
    onChange?.(next);
    if (errors.length > 0) setErrors(validateProfileForm(next).filter((e) => errors.includes(e)));
  };

  const pickFood = (list: 'likes' | 'dislikes', id: string) => {
    const out = toggleFood(form, list, id);
    const food = foodLabel(dict, id, lang);
    if (out.refused === 'limit') setNotice(t('profile.foods.limit'));
    else if (out.moved === 'toLikes') setNotice(t('profile.foods.moved.toLikes', { food }));
    else if (out.moved === 'toDislikes') setNotice(t('profile.foods.moved.toDislikes', { food }));
    else setNotice('');
    setForm(out.form);
  };

  const submit = async () => {
    const found = validateProfileForm(form);
    setErrors(found);
    if (found.length > 0) {
      setSummary(t('live.formErrors', { n: found.length }));
      // US-E1-02/AC4: focus moves to the first invalid group.
      const target = found[0] === 'age-required' ? ageRef.current : allergyRef.current;
      target?.querySelector<HTMLElement>('button, input')?.focus();
      return;
    }
    setSummary('');
    setBusy(true);
    try {
      await onSubmit(form);
    } finally {
      setBusy(false);
    }
  };

  const allergensBy = (tier: 'mandatory' | 'recommended') => dict.allergens.filter((a) => a.tier === tier && !a.retired);
  const has = (e: ProfileError) => errors.includes(e);

  return (
    <form
      className="form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <p className="visually-hidden" role="alert" data-testid="form-errors">
        {summary}
      </p>
      <p className="visually-hidden" role="status" aria-live="polite" data-testid="profile-notice">
        {notice}
      </p>

      <div className="field">
        <label className="field__label" htmlFor={ids.nick}>
          {t('profile.nickname.label')}
          <span className="field__tag">{t('common.optional')}</span>
        </label>
        <input
          id={ids.nick}
          className="input"
          value={form.nickname}
          onChange={(e) => setForm({ ...form, nickname: clampCodePoints(e.target.value, NICKNAME_MAX) })}
          aria-describedby={`${ids.nick}-hint`}
          data-testid="input-nickname"
          autoComplete="off"
        />
        <p id={`${ids.nick}-hint`} className="field__hint field__hint--split">
          <span>{t('profile.nickname.hint')}</span>
          <span className={count(form.nickname) >= NICKNAME_MAX ? 'counter is-limit' : 'counter'}>{t('profile.nickname.counter', { n: count(form.nickname) })}</span>
        </p>
      </div>

      <fieldset ref={ageRef} className={`field${has('age-required') ? ' has-error' : ''}`} data-testid="group-age" aria-describedby={has('age-required') ? ids.age : undefined}>
        <Legend required>{t('profile.age.label')}</Legend>
        {has('age-required') && <FieldError id={ids.age} text={t('profile.age.error')} testId="age-error" />}
        <div className="chips" role="radiogroup" aria-label={t('profile.age.label')}>
          {AGE_RANGES.map((age) => (
            <Chip key={age} testId={`chip-age-${age}`} label={t(AGE_KEYS[age])} selected={form.ageRange === age} mode="radio" onToggle={() => setForm({ ...form, ageRange: age })} />
          ))}
        </div>
      </fieldset>

      <FoodPicker name="likes" legend={t('profile.likes.label')} hint={t('profile.foods.hint')} selected={form.likedIds} kinds={['ingredient', 'category', 'dish']} onPick={(id) => pickFood('likes', id)} showPopular />
      <FoodPicker name="dislikes" legend={t('profile.dislikes.label')} hint={t('profile.foods.hint')} selected={form.dislikedIds} kinds={['ingredient', 'category', 'dish']} onPick={(id) => pickFood('dislikes', id)} showPopular />

      <fieldset
        ref={allergyRef}
        className={`field${has('allergy-status-required') || has('allergen-required') ? ' has-error' : ''}`}
        data-testid="group-allergy"
        aria-describedby={`${ids.allergy}-helper${has('allergy-status-required') ? ` ${ids.allergy}` : ''}`}
      >
        <Legend required>{t('allergy.label')}</Legend>
        <p id={`${ids.allergy}-helper`} className="field__hint">
          {t('allergy.helper')}
        </p>
        {has('allergy-status-required') && <FieldError id={ids.allergy} text={t('allergy.status.error')} testId="allergy-error" />}
        <div className="radios">
          {(['none-known', 'has-known', 'unknown'] as const).map((status) => (
            <label key={status} className={`radio${form.allergyStatus === status ? ' is-checked' : ''}`}>
              <input
                type="radio"
                name="allergy-status"
                checked={form.allergyStatus === status}
                onChange={() => setForm({ ...form, allergyStatus: status })}
                data-testid={`radio-allergy-${status}`}
              />
              {t(ALLERGY_KEYS[status])}
            </label>
          ))}
        </div>
        {form.allergyStatus === 'unknown' && (
          <Banner variant="warning" testId="banner-allergy-unknown" live={false}>
            {t('allergy.unknown.banner')}
          </Banner>
        )}
        {form.allergyStatus === 'has-known' && (
          <div className="subgroup" data-testid="picker-allergens">
            {has('allergen-required') && <FieldError id={ids.allergen} text={t('allergy.pick.error')} testId="allergy-error" />}
            {(['mandatory', 'recommended'] as const).map((tier) => (
              <div key={tier}>
                <p className="field__sublabel">{t(tier === 'mandatory' ? 'allergy.pick.mandatory' : 'allergy.pick.recommended')}</p>
                <div className="chips">
                  {allergensBy(tier).map((a) => (
                    <Chip
                      key={a.id}
                      testId={`chip-allergen-${a.id}`}
                      label={a[lang]}
                      selected={form.knownAllergenIds.includes(a.id)}
                      mode="pressed"
                      onToggle={() => setForm({ ...form, knownAllergenIds: toggleIn(form.knownAllergenIds, a.id) })}
                    />
                  ))}
                </div>
              </div>
            ))}
            <FoodPicker
              name="other-foods"
              legend={t('allergy.pick.other')}
              hint={t('allergy.pick.otherHint')}
              selected={form.excludedIngredientIds}
              kinds={['ingredient', 'category']}
              onPick={(id) => setForm({ ...form, excludedIngredientIds: toggleIn(form.excludedIngredientIds, id) })}
              showPopular={false}
            />
          </div>
        )}
      </fieldset>

      <fieldset className="field" data-testid="group-diet">
        <Legend required={false}>{t('diet.label')}</Legend>
        <p className="field__hint">{t('diet.hint')}</p>
        <div className="chips">
          {DIETS.map((d) => (
            <Chip key={d} testId={`chip-diet-${d}`} label={t(DIET_KEYS[d])} selected={form.diet.includes(d)} mode="pressed" onToggle={() => setForm({ ...form, diet: toggleIn(form.diet, d) })} />
          ))}
        </div>
      </fieldset>

      <fieldset className="field" data-testid="group-theme">
        <Legend required={false}>{t('theme.label')}</Legend>
        <p className="field__hint">{t('theme.hint')}</p>
        <div className="chips">
          {dict.themes.map((theme) => (
            <Chip
              key={theme.id}
              testId={`chip-theme-${theme.id}`}
              label={theme[lang]}
              selected={form.themeIds.includes(theme.id)}
              disabledLook={!form.themeIds.includes(theme.id) && form.themeIds.length >= 3}
              mode="pressed"
              onToggle={() => {
                const out = toggleTheme(form, theme.id);
                setNotice(out.refused === 'limit' ? t('theme.limit') : '');
                setForm(out.form);
              }}
            />
          ))}
        </div>
        {notice === t('theme.limit') && <p className="field__hint" data-testid="theme-limit">{t('theme.limit')}</p>}
      </fieldset>

      <div className="field">
        <label className="field__label" htmlFor={ids.note}>
          {t('profile.note.label')}
          <span className="field__tag">{t('common.optional')}</span>
        </label>
        <textarea
          id={ids.note}
          className="input textarea"
          rows={3}
          value={form.note}
          placeholder={t('profile.note.placeholder')}
          onChange={(e) => setForm({ ...form, note: clampCodePoints(e.target.value, NOTE_MAX) })}
          aria-describedby={`${ids.note}-hint`}
          data-testid="input-note"
        />
        <p id={`${ids.note}-hint`} className="field__hint field__hint--split">
          <span>{t('profile.note.hint')}</span>
          <span className="counter">{t('profile.note.counter', { n: count(form.note) })}</span>
        </p>
      </div>

      {footerNote}
      <div className="footer-actions">
        <button type="submit" className="btn btn--primary btn--block" data-testid={submitTestId} aria-busy={busy || undefined} disabled={busy}>
          {submitLabel}
        </button>
        {secondary}
      </div>
    </form>
  );
}
