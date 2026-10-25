# Pause notes: maker-label round + verifier fixes (BA, 2026-10-25)

Paused at the coordinator's request, before any record was edited.

## State
- **No project files changed.** `data/_research/batch-a.json` and `batch-b.json` are unchanged and still parse as valid JSON (checked). Nothing fetched, nothing saved under this folder apart from this note.
- Done: read the plan §7 rows (batch B → verifier spot-check), the research brief, the contract headings and the recipe schema checks (`src/domain/schema/recipe.ts`: may-contain = union of `possibleAllergenIds` of varies items; `allergenDataComplete` = no `unknown` item; `dietDataComplete` = every `animalOriginKnown`).

## Inventory (from the batch files, still to do)
Processed foods still `allergenInfo: "unknown"`. None has a label source yet:
| Food | Recipes |
|---|---|
| たらこ `ing-tarako` | rcp-nhk-sake-teriyaki-bento, rcp-kikkoman-sanshoku-mini-onigiri-bento |
| ツナ缶 `ing-canned-tuna` | rcp-kikkoman-tuna-tamago-soboro-bento |
| ハム `ing-ham` | rcp-kikkoman-tuna-tamago-soboro-bento, rcp-nhk-ohanabatake-bento, rcp-kikkoman-youfuu-makizushi-bento |
| ソーセージ/ウインナー `ing-sausage` | rcp-delish-himawari-bento, rcp-kikkoman-sanshoku-mini-onigiri-bento, rcp-delish-penguin-onigirazu-bento, rcp-delish-kuma-usagi-sandwich |
| 鮭フレーク `ing-salmon-flakes` | rcp-delish-himawari-bento |
| みそ `ing-miso` | rcp-nhk-ohanabatake-bento |
| 桜でんぶ `ing-sakura-denbu` | rcp-delish-penguin-seiretsu-bento |
| チーズ `ing-cheese` (processed / stick / cheddar) | rcp-kikkoman-niku-yasaimaki-bento, rcp-kikkoman-youfuu-makizushi-bento, rcp-bbc-black-bean-quesadilla |
| パン粉 `ing-bread-crumbs` (also animalOriginKnown false) | rcp-nhk-juicy-hamburg-bento |
| ロールパン/食パン `ing-bread` (also animalOriginKnown false) | rcp-delish-kuma-usagi-sandwich, rcp-joc-tamago-sando-bento |
| トルティーヤ `ing-tortilla` (also animalOriginKnown false) | rcp-bbc-black-bean-quesadilla |

Ketchup and curry powder still marked `known` with no allergens. All of them need to become `varies-by-product`:
- `ing-ketchup` (cite src-kikkoman-delmonte-ketchup[-label]): rcp-kikkoman-sake-hamburg-bento, rcp-delish-penguin-onigirazu-bento, rcp-kikkoman-omurice-bento, rcp-kikkoman-buta-ketchup-bento, rcp-nhk-juicy-hamburg-bento, rcp-delish-kuma-usagi-sandwich
- `ing-curry-powder` (cite the House labels already in the record): rcp-delish-niwatori-hiyoko-onigiri, rcp-delish-kuma-usagi-sandwich

## Verifier fixes: none done yet
- 2a curry-chahan: still has 7 g さやいんげん (source says 2本), a 1/3 family portion, and a "顆粒" roux claim that hasn't been checked against the label.
- 2b ketchup/curry powder → varies-by-product: not done.
- 2c quesadilla: yield is still 「幼児1〜2人分」 and salt/pepper is still `small-amount`.
- 2d sake-hamburg storage[1] MAFF note: not removed.
- 2e pistachio gap on the House roux label (rank 19 = curry-chahan): not noted.

## Dictionary / contract / brief: none done yet
- Sources still needed for ing-tarako, ing-sakura-denbu, ing-tortilla, ing-black-beans, ing-salmon-flakes. alg-matsutake is not checked yet. `npm run build:dictionary` has not been run.
- Contract §3.7, §6.1 and §3.10 and research-brief §3 have not been touched.

## Exact next step
1. Do the 2b ketchup/curry-powder flips (no fetching needed). For each ingredient set `allergenInfo: "varies-by-product"` and the cited label's allergens (may be empty). Then recompute the recipe's `mayContainAllergenIds` and add the 「表示を確認」 wording in `adaptations`.
2. Then do 2a, 2c, 2d and 2e. After that, fetch maker labels one at a time (about 3 s apart, check each page title), starting with ハム and ソーセージ (they affect 7 recipes).
3. Run `node scripts/validate-data.mjs data/_research/batch-a.json` (and the same for batch-b) after each record.
