// ADR 004 §5 module boundaries and purity, checked on the source text (the lint rule enforces
// the same; this test keeps it true even if lint is skipped).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BR04, BR09, BR16, DECISION_HISTORY_LIMIT, REMINDER_HORIZON_DAYS, REMINDER_LOG_RETENTION_DAYS } from '../../../src/domain/rules.ts';

const domainDir = fileURLToPath(new URL('../../../src/domain', import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

const files = walk(domainDir).map((path) => ({ path: relative(domainDir, path).replaceAll('\\', '/'), text: readFileSync(path, 'utf8') }));
const importsOf = (text: string) => [...text.matchAll(/^\s*(?:import|export)[^'"]*from\s+'([^']+)'/gm)].map((m) => m[1] ?? '');

describe('the domain is pure (ADR 004)', () => {
  it('imports no React, UI, adapters, i18n or debug code', () => {
    const offenders = files.flatMap((f) =>
      importsOf(f.text)
        .filter((spec) => /^react(-dom)?(\/|$)/.test(spec) || /\/(ui|adapters|i18n|debug)(\/|$)/.test(spec))
        .map((spec) => `${f.path} → ${spec}`),
    );
    expect(offenders).toEqual([]);
  });

  it('never reads the device clock, randomness, storage or the network', () => {
    const forbidden = [/Date\.now\(/, /new Date\(\)/, /Math\.random\(/, /localStorage/, /\bfetch\(/, /crypto\.randomUUID/];
    const offenders = files.flatMap((f) => forbidden.filter((re) => re.test(f.text)).map((re) => `${f.path} ${re.source}`));
    expect(offenders).toEqual([]);
  });

  it('imports only zod from packages', () => {
    const packages = files.flatMap((f) => importsOf(f.text).filter((s) => !s.startsWith('.')));
    expect(new Set(packages)).toEqual(new Set(['zod']));
  });
});

describe('business-rule constants match the approved BR table (PLAN §3)', () => {
  it('BR-04 low-preference at two disliked foods; U compared as one half', () => {
    expect(BR04).toEqual({ lowPreferenceDislikes: 2, uncertainShareNumerator: 1, uncertainShareDenominator: 2 });
  });

  it('BR-09 score terms, top 3, ±14 days, over 20 minutes', () => {
    expect(BR09).toEqual({
      topCount: 3,
      perLikedId: 2,
      themeMatch: 1,
      perDislikedId: -3,
      recentlyPlanned: -2,
      recentWindowDays: 14,
      slowRecipe: -1,
      slowRecipeAboveMinutes: 20,
    });
  });

  it('BR-16 reminder defaults and planning windows', () => {
    expect(BR16).toEqual({ weeklyWeekday: 0, weeklyTime: '14:00', weeklyCoveredDays: 7, dayBeforeTime: '17:30', timeStepMinutes: 15 });
    expect(REMINDER_HORIZON_DAYS).toEqual({ web: 8, android: 35 });
    expect(REMINDER_LOG_RETENTION_DAYS).toBe(60);
    expect(DECISION_HISTORY_LIMIT).toBe(5);
  });
});
