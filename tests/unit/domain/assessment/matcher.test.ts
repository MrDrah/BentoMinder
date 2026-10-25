// Dictionary matching (domain dictionary §1 rules 1–7, §7 ambiguity groups) and the review's
// ambiguity prompts (US-E4-01/AC6, AC21; contract rule `resolved-ids-candidates`).
import { describe, expect, it } from 'vitest';
import { ambiguityPrompts, resolvedIdsViolation } from '../../../../src/domain/assessment/ambiguity.ts';
import { createMatcher, matcherFor } from '../../../../src/domain/assessment/matcher.ts';
import { dict } from '../../helpers/menus.ts';

const matcher = createMatcher(dict);
const ids = (text: string, ctx?: Parameters<typeof matcher.match>[1]) => matcher.match(text, ctx).found.map((f) => f.id);
const unresolved = (text: string, ctx?: Parameters<typeof matcher.match>[1]) => matcher.match(text, ctx).unresolved.map((u) => u.groupId);

describe('US-E4-01 matching rules (dictionary §1)', () => {
  it('US-E4-01/AC5 ingredient pass, kana ≥ 2: ピーマンとなすのみそ炒め → pepper, eggplant, miso', () => {
    expect(ids('ピーマンとなすのみそ炒め')).toEqual(['ing-green-pepper', 'ing-eggplant', 'ing-miso']);
  });

  it('US-E4-01/AC5 dish pass first: コーンスープ → the dish and the corn it names', () => {
    expect(ids('コーンスープ')).toEqual(['dish-corn-soup', 'ing-corn']);
  });

  it('US-E4-01/AC5 longest match wins: 切り干し大根の煮物, ごま油, カニカマ', () => {
    expect(ids('切り干し大根の煮物')).toEqual(['dish-kiriboshi-nimono', 'ing-dried-daikon']);
    expect(ids('ごま油', { kind: 'ingredient', neighbourSeasoning: false })).toEqual(['ing-sesame-oil']);
    expect(ids('カニカマ')).toEqual(['ing-crab-stick']);
  });

  it('US-E4-01/AC4 NFKC, katakana → hiragana and removed spaces all map to the same id', () => {
    expect(ids('ｺｰﾝｽｰﾌﾟ')).toEqual(['dish-corn-soup', 'ing-corn']);
    expect(ids('にんじ ん')).toEqual(['ing-carrot']);
    expect(ids('人参')).toEqual(['ing-carrot']);
    expect(ids('ニンジン')).toEqual(['ing-carrot']);
  });

  it('US-E4-01/AC5 a single kana never matches and a typo is never corrected', () => {
    expect(ids('と')).toEqual([]);
    expect(ids('ピーマソ')).toEqual([]);
  });

  it('US-E4-01/AC5 a dish adds only the ingredients literally named: 鶏のから揚げ has chicken, からあげ does not', () => {
    expect(ids('鶏のから揚げ')).toEqual(['dish-karaage', 'ing-chicken']);
    expect(ids('からあげ')).toEqual(['dish-karaage']);
    expect(ids('ポークカレー')).toEqual(['dish-curry-rice', 'ing-rice', 'ing-pork']);
  });
});

describe('US-E4-01/AC6 ambiguity groups (dictionary §7)', () => {
  it('amb-curry: カレーライス and カレールウ resolve by longest match; カレー味 is the flavour; a standalone カレー asks', () => {
    expect(ids('カレーライス')).toContain('dish-curry-rice');
    expect(unresolved('カレーライス')).toEqual([]);
    expect(ids('カレールウ', { kind: 'ingredient', neighbourSeasoning: false })).toEqual(['ing-curry-roux']);
    expect(ids('カレー味のスープ')).toContain('ing-curry-powder');
    expect(unresolved('カレー味のスープ')).toEqual([]);
    expect(unresolved('カレー')).toEqual(['amb-curry']);
    expect(unresolved('カレーうどん')).toEqual(['amb-curry']);
    expect(ids('カレーうどん')).toEqual(['ing-udon']);
  });

  it('amb-aji: しおあじ is a taste suffix (ignored), 鯵 is fish, a standalone あじ asks', () => {
    expect(ids('しおあじ')).toEqual(['ing-salt']);
    expect(unresolved('しおあじ')).toEqual([]);
    expect(ids('みそあじ')).toEqual(['ing-miso']);
    expect(ids('鯵フライ')).toEqual(['ing-horse-mackerel']);
    expect(unresolved('アジフライ')).toEqual(['amb-aji']);
  });

  it('amb-momo: 鶏もも and 豚もも resolve, 桃 is a peach, a standalone もも asks', () => {
    expect(ids('鶏もものてりやき')).toEqual(['ing-chicken-thigh']);
    expect(ids('豚もも肉')).toEqual(['ing-pork']);
    expect(unresolved('豚もも肉')).toEqual([]);
    expect(ids('桃')).toEqual(['ing-peach']);
    expect(unresolved('もも')).toEqual(['amb-momo']);
  });

  it('amb-nashi: 「給食なし」 is none (ignored); a standalone なし asks; 梨 is a pear', () => {
    expect(ids('給食なし')).toEqual([]);
    expect(unresolved('給食なし')).toEqual([]);
    expect(unresolved('なし')).toEqual(['amb-nashi']);
    expect(ids('梨')).toEqual(['ing-pear']);
  });

  it('amb-kaki: かき揚げ is the dish, 柿 a persimmon, 牡蠣 an oyster, a bare かき asks', () => {
    expect(ids('かき揚げ')).toEqual(['dish-kakiage']);
    expect(ids('柿')).toEqual(['ing-persimmon']);
    expect(ids('牡蠣')).toEqual(['ing-oyster']);
    expect(unresolved('かき')).toEqual(['amb-kaki']);
  });

  it('amb-soba: 焼きそば and 中華そば are wheat noodles, a standalone そば is buckwheat and flagged on review', () => {
    expect(ids('焼きそば')).toEqual(['dish-yakisoba', 'ing-chinese-noodles']);
    expect(ids('中華そば')).toEqual(['ing-chinese-noodles']);
    const m = matcher.match('そば');
    expect(m.found.map((f) => f.id)).toEqual(['ing-soba']);
    expect(m.flags).toEqual(['amb-soba']);
    expect(matcher.match('蕎麦').flags).toEqual([]);
  });

  it('amb-tako: たこさんウインナー is the dish (no octopus), a standalone たこ is octopus', () => {
    expect(ids('たこさんウインナー')).toEqual(['dish-octopus-sausage', 'ing-sausage']);
    expect(ids('たこ')).toEqual(['ing-octopus']);
  });

  it('amb-sake: in a dish name 「さけ」 is salmon; in an ingredient list next to a seasoning it asks; 酒 is cooking sake', () => {
    expect(ids('さけのしおやき')).toEqual(['dish-salted-salmon', 'ing-salmon', 'ing-salt']);
    expect(ids('さけの照り焼き')).toContain('ing-salmon');
    expect(unresolved('さけ', { kind: 'ingredient', neighbourSeasoning: true })).toEqual(['amb-sake']);
    expect(ids('さけ', { kind: 'ingredient', neighbourSeasoning: false })).toEqual(['ing-salmon']);
    expect(ids('酒')).toEqual(['ing-cooking-sake']);
  });

  it('amb-pan: パン粉 is bread crumbs, フライパン is not a food, a plain パン is bread', () => {
    expect(ids('パン粉')).toEqual(['ing-bread-crumbs']);
    expect(ids('フライパン')).toEqual([]);
    expect(ids('パン')).toEqual(['ing-bread']);
  });

  it('amb-imo: the compound forms win, a standalone いも / 芋 / おいも asks', () => {
    expect(ids('さつまいも')).toEqual(['ing-sweet-potato']);
    expect(ids('里芋の煮物')).toEqual(['ing-taro']);
    for (const t of ['いも', '芋', 'おいものにもの']) expect(unresolved(t)).toEqual(['amb-imo']);
  });
});

describe('US-E4-01/AC21 the review asks about unresolved forms and stores the choice (rule resolved-ids-candidates)', () => {
  it('lists each unresolved group once with its candidates and the non-food reading', () => {
    expect(ambiguityPrompts(dict, 'カレー')).toEqual([
      { groupId: 'amb-curry', surface: 'かれー', candidateIds: ['dish-curry-rice', 'ing-curry-powder', 'ing-curry-roux'], nonFoodReading: null },
    ]);
    expect(ambiguityPrompts(dict, 'あじ')[0]).toMatchObject({ groupId: 'amb-aji', candidateIds: ['ing-horse-mackerel'], nonFoodReading: '味' });
    expect(ambiguityPrompts(dict, 'なし')[0]).toMatchObject({ groupId: 'amb-nashi', nonFoodReading: '無し' });
    expect(ambiguityPrompts(dict, 'ごはん')).toEqual([]);
    expect(ambiguityPrompts(dict, 'いもといも')).toHaveLength(1);
  });

  it('accepts a candidate id or [] for a non-food reading, and refuses everything else', () => {
    expect(resolvedIdsViolation(dict, 'もも', ['ing-peach'])).toBe(false);
    expect(resolvedIdsViolation(dict, 'もも', ['ing-peach', 'ing-pork'])).toBe(false);
    expect(resolvedIdsViolation(dict, 'もも', ['ing-apple'])).toBe(true); // not a candidate
    expect(resolvedIdsViolation(dict, 'もも', [])).toBe(true); // amb-momo has no non-food reading
    expect(resolvedIdsViolation(dict, 'あじ', [])).toBe(false);
    expect(resolvedIdsViolation(dict, 'なし', [])).toBe(false);
    expect(resolvedIdsViolation(dict, 'ごはん', ['ing-rice'])).toBe(true); // nothing unresolved in the text
  });
});

describe('matcher caching', () => {
  it('returns the same matcher object for the same dictionary', () => {
    expect(matcherFor(dict)).toBe(matcherFor(dict));
  });
});
