# Research brief — BentoMinder recipe library

Owner: BA · 2026-10-24 · Process: `content-research` skill · Format: `docs/ba/data-contract.md` §3.7 (Recipe) · Ids: `docs/ba/domain-dictionary.md` · Status: **brief only; no research has been done yet** (starts after H1 approval)

## 1. Goal
A curated library of **18 recipes** (allowed range 15–20, US-E6-07) of realistic bentos for children aged about 3–6 that a parent can make on a weekday morning. Each record describes **one bento as the source presents it** (a centrepiece dish plus the simple sides the source shows), unless OQ-09 is answered differently.

| Mix target (from US-E6-07/AC2) | Count |
|---|---|
| `style: japanese` (おにぎり, 卵焼き, 照り焼き, そぼろ, 肉巻き…) | ≥ 6 (aim 10) |
| `style: western-inspired` (サンドイッチ, ナポリタン, ミートボール, オムライス…) | ≥ 4 (aim 7) |
| `minutes ≤ 20` on the morning | ≥ 5 (aim 9) |
| Has a `themeId` (どうぶつ, のりもの, おはな…) | aim 6 |
| Contains none of the 9 mandatory allergens (`alg-egg`, `alg-milk`, `alg-wheat`, …) | aim ≥ 4, so a child with egg/milk/wheat allergies still gets 3 suggestions |
| Fish-free and meat-free options | aim ≥ 3 each |

## 2. Golden rules
1. **Real recipes only.** Research only the candidates assigned to you in `data/_research/candidates.json`. Never invent a recipe, an ingredient, a quantity, a time or a storage claim.
2. **Every fact has a fetched source.** Record every page you used in `sources` (`{ id, publisher, title, url, accessed, language, usedFor }`). Storage advice cites the page it came from; the general bento food-safety notes come from MAFF (§3) and are added by the app, so do not copy them into each record.
3. **Own words.** `description`, `steps`, `storage` and `adaptations` are written fresh in natural Japanese (and English). No run of 8 or more words (Japanese: 12 or more characters of continuous text) copied from a source, except dish names and titles. `validate.mjs overlap` blocks the merge otherwise.
4. **Check the page, not just HTTP 200.** The page title must match the candidate. Fetch slowly, one page at a time, about 3 s apart; back off and retry later on throttling or empty responses.
5. **Skip, don't guess.** If quantities, time or ingredients are missing or contradictory, skip the candidate and take the next from your reserve range. Report why.
6. **Never rename a candidate.** Keep the source's dish name in `name.ja` (you may add the English name). Another candidate may share the base name.
7. **Only known ids.** Every `ingredientId` and `themeId` comes from the dictionary. If nothing fits, use the closest generic id with a note in `adaptations` and propose a new id in your report (id, 表記, よみ, English, category, synonyms, inherent allergens).
8. **Allergens from ingredients, never from absence.** For each ingredient, copy the dictionary's inherent allergens into `allergenIds`. For processed foods (`info: varies`: ウインナー, ハム, ちくわ, カレールウ, パン, マヨネーズ, しょうゆ, みそ…) set `allergenInfo: "varies-by-product"` and list the allergens a typical product label declares in `possibleAllergenIds`, citing the label or the manufacturer page you used. If you can't find a label, skip the candidate.
9. **Brand products become generic.** Manufacturer recipe sites often call for their own products (e.g. a branded stock or curry roux). Record the generic ingredient id, keep the brand only in `sources`, and note the substitution in `adaptations`.
10. **Child portion.** If the source serves adults or several people, scale to one child portion (`yield: 幼児1人分`) and record the factor in `adaptations` (e.g. 「元のレシピ（2人分）を1/2にしました」). Round to sensible kitchen amounts; never change the ratio of ingredients.
11. **Safety notes that are cited.** Where the source or an approved safety source gives child-specific handling (cool before packing, cut round foods for small children, no raw or half-cooked egg), put it in `storage` with that source. Do not add safety claims you can't cite.
12. **Save after every record.** An interruption must not lose finished work.

## 3. Approved sources
Candidate-list agent: verify each domain's recipe pages (title matches, page is a recipe by the publisher, not user-posted) before ranking. Domains marked "verify" have not been fetched by the BA.

| Source | Use for | Notes / quirks |
|--------|---------|----------------|
| 農林水産省 「お弁当づくりによる食中毒を予防するために」 https://www.maff.go.jp/j/syouan/seisaku/foodpoisoning/lunchbox.html (verified 2026-10-24) | General bento food-handling notes shown on every recipe (US-E6-04/AC2): つけない・ふやさない・やっつける; cool before closing; keep cool when carrying | Government page; paraphrase, cite. |
| 消費者庁 food allergy labelling (via https://www.pref.kyoto.jp/shoku-kawaraban/allergie01.html, verified 2026-10-24) | Allergen scheme `caa-2026-04` (9 + 20 items) | Use only for the scheme, not for recipes. |
| 消費者庁 / こども家庭庁 guidance on choking risks for young children | `storage`/handling notes on round foods (ミニトマト, ぶどう) | verify the current page before use. |
| 厚生労働省 home food-poisoning guidance | Secondary handling source | verify. |
| NHK 「みんなのきょうの料理」 (kyounoryouri.jp) | Japanese recipes with quantities and times | verify; editorial, named cooks. |
| 白ごはん.com (sirogohan.com) | Japanese home cooking basics (卵焼き, おにぎり, そぼろ) | verify; single professional author. |
| Publisher magazines: オレンジページ (orangepage.net), レタスクラブ (lettuceclub.net) | Kids' bento features (幼稚園弁当) | verify; prefer pages with times and quantities. |
| Food-manufacturer recipe sites: 味の素パーク, キッコーマン ホームクッキング, ハウス食品, ミツカン | Many kids' bento recipes with times | verify; rule 9 (brand → generic). |
| Editorial video recipe sites: クラシル (kurashiru.com), DELISH KITCHEN (delishkitchen.tv) | Short kids' bentos | verify; editorial (not user-posted) pages only. |
| Just One Cookbook (justonecookbook.com) | English-language Japanese bento recipes; English names | verify. |
| BBC Good Food (bbcgoodfood.com; publisher: Immediate Media Company Ltd under BBC licence) | Western-inspired lunchbox recipes | verify; convert units to g/ml. |
| 仙台市 (city.sendai.jp) | Allergen-labelling scheme changes (source for the dictionary's allergen list only, not for recipes) | verify. |

**Not approved:** user-generated recipe posts (e.g. Cookpad user recipes, Allrecipes user submissions), blogs without a named author, AI-generated recipe sites, pages behind a login or paywall.

## 4. Record format
One record per recipe in `data/_research/batch-<letter>.json`, exactly the fields of the Recipe contract (`docs/ba/data-contract.md` §3.7), `reviewedBy: "ba-research"`, `allergenScheme: "caa-2026-04"`. Overlap fields (for `quality-gate.json → overlap.fields`): `description`, `steps`, `storage`, `adaptations`.

## 4a. Ingredients of unknown animal origin (H1, OQ-18 accepted)
Recipes using an ingredient whose dictionary `animalOrigin` ends in `?` (`ing-dashi` だし, `ing-bread` パン, `ing-bread-crumbs` パン粉, `ing-consomme` コンソメ, `ing-curry-roux` カレールウ, `ing-stew-roux` シチュールウ, `ing-worcester-sauce` ソース) are excluded for every selected diet unless the cited source states that product's ingredients (`animalOriginKnown`, data contract §3.7–§3.8). When choosing candidates, prefer recipes that avoid these or that specify them: e.g. 昆布だし (`ing-kombu`) or かつおだし made from `ing-bonito-flakes` instead of plain だし, rice instead of bread. Record `animalOrigin` for every ingredient and report each recipe that ends with `dietDataComplete = false`.

## 5. Batch plan
| Step | Who | Output | Size |
|------|-----|--------|------|
| 0 | Orchestrator | PO answers OQ-09 (what a "recipe" is) and approves the source list | – |
| 1 | Candidate agent | `data/_research/candidates.json`: ranked, de-duplicated, each with a verified URL, `style`, rough `minutes`, likely allergens | 27 (18 + 50% reserve) |
| 2 | Research agent A | `batch-a.json`: Japanese-style candidates ranked 1–10, reserves 19–23 | 10 |
| 2 | Research agent B | `batch-b.json`: western-inspired and allergen-light candidates ranked 11–18, reserves 24–27 | 8 |
| 3 | Orchestrator | diff-guard, cross-batch id/name uniqueness, merge to `data/library.json` (generated), `overlap --fetch` | – |
| 4 | Editor agent (if needed) | rewrites only the FAIL sentences | – |
| 5 | Verifier | spot-check ≥ 2 recipes (10%, at least one per batch) against their sources: ingredients, quantities, time, allergens | – |

The candidate agent must make sure the mix targets in §1 are reachable from ranks 1–18 alone, and that each reserve range can replace a skipped record of the same style.

## 6. Self-check before reporting
```bash
node scripts/validate-data.mjs data/_research/<your-file>.json
```
Report: record count, skips with reason and the reserves used, proposed new dictionary ids, source disagreements (e.g. two sources give different times), validator output.
