# Label round: state after SLICE 1 (BA, 2026-10-30)

## Done in slice 1 (batch-a.json / batch-b.json edited; both validate except the expected `library.json generated-stale`)
- 2b: `ing-ketchup` (6 recipes) and `ing-curry-powder` (2 recipes) are `varies-by-product`, possibleAllergenIds empty (cited labels list none), 「表示を確認」 adaptation added. May-contain ids unchanged.
- 2a curry-chahan: green beans 0.67 piece (source: 2本, no weight), yield 1 serving (source does not state a child share), "顆粒" removed (label does not say granule form).
- 2c quesadilla: yield 1-2 servings (source "Serves 2-4" halved), salt/pepper `to-taste`.
- 2d sake-hamburg: storage lettuce note and its src-maff-lunchbox source removed.
- 2e curry-chahan: pistachio gap noted (not in the House label's list of 28 items).
- ハム `ing-ham` (3 recipes): label = Nippon Ham 彩りキッチン ロースハム (egg, milk, soy, pork). ソーセージ `ing-sausage` (4 recipes): label = Nippon Ham シャウエッセン (pork). Sources src-nipponham-irodori-roast-ham-label, src-nipponham-schauessen-label (accessed 2026-10-30); pages saved in `pages/`, fetch log `fetchlog.tsv`. New host: nipponham.co.jp.
- Scripts used: `s1-2b.cjs`, `s1-2acde.cjs`, `s1-ham-sausage.cjs` (one-off, do not re-run).

## Still to do (unchanged inventory, minus ham/sausage)
- Maker labels: たらこ `ing-tarako` (2), ツナ缶 `ing-canned-tuna` (1), 鮭フレーク `ing-salmon-flakes` (1), みそ `ing-miso` (1), 桜でんぶ `ing-sakura-denbu` (1), チーズ `ing-cheese` (3), パン粉 `ing-bread-crumbs` (1), パン `ing-bread` (2), トルティーヤ `ing-tortilla` (1). Bread/crumbs/tortilla also have animalOriginKnown false.
- Dictionary sources (tarako, sakura-denbu, tortilla, black-beans, salmon-flakes), alg-matsutake check, `npm run build:dictionary`.
- Contract §3.7, §6.1, §3.10; research-brief §3. Orchestrator: add nipponham.co.jp to APPROVED_HOSTS, run `overlap --fetch`, then `npm run merge:research`.
- Recipe may-contain / allergenDataComplete must be recomputed again after each further label (see the scripts for the pattern).

## SLICE 2 result (BA, 2026-10-31)
- Done (varies-by-product, label cited): ツナ缶 (Hagoromo Lフレーク: soy), 鮭フレーク (Nissui: salmon, soy), みそ (Marukome 料亭の味 生みそ: soy), プロセスチーズ in rcp-kikkoman-niku-yasaimaki (Snow Brand 6P: milk only). Script `s2-labels.cjs`, `s2-dict.cjs` (one-off). Dictionary notes sourced (sakura denbu, salmon flakes, black beans, matsutake verified); build:dictionary run.
- Left unknown (no label found/fetchable): たらこ x2, 桜でんぶ, パン粉, ロールパン, 食パン (Yamazaki pages have no ingredient list), トルティーヤ, スティックチーズ, チェダーチーズ. animalOriginKnown unchanged for bread, crumbs, tortilla. No source found for tarako/tortilla dictionary notes (MAFF pdf unreadable).
- New hosts: hagoromofoods.co.jp, marukome.co.jp, nissui.co.jp, meg-snow.com (plus nipponham.co.jp from slice 1; already in APPROVED_HOSTS). Orchestrator: add, overlap --fetch, merge:research.

## Cancelled (2026-11-01)
All remaining label research listed above (Still to do, Left unknown) is cancelled by the PO decision of 2026-11-01; there is no further label pass.
