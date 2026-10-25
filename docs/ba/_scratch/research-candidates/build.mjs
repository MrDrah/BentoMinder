// Builds data/_research/candidates.json; titles are read from fetchlog.tsv (as fetched), never typed by hand.
import fs from 'node:fs';
const dir = 'C:/Projects/BentoMinder/docs/ba/_scratch/research-candidates/';
const log = fs.readFileSync(dir + 'fetchlog.tsv', 'utf8').trim().split('\n').map(l => l.split('\t'));
const dec = s => s.replace(/&#x27;/g, "'").replace(/&#8226;/g, '•').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
const titleOf = url => { const r = log.filter(l => l[1] === url && l[0] === '200').pop(); if (!r) throw new Error('not fetched OK: ' + url); return dec(r[2]); };
const P = {
  nhk: 'NHKエデュケーショナル（みんなのきょうの料理）', siro: '白ごはん.com（冨田ただすけ）', kik: 'キッコーマン株式会社（ホームクッキング）',
  house: 'ハウス食品株式会社', dk: 'デリッシュキッチン (every, Inc.)', bbc: 'Immediate Media Company Ltd (BBC Good Food)',
  joc: 'Just One Cookbook (Namiko Chen)', aji: '味の素株式会社（味の素パーク）', lc: 'レタスクラブ (KADOKAWA LifeDesign)', op: 'オレンジページ (The Orangepage Inc.)',
};
const nhk = p => 'https://www.kyounoryouri.jp' + encodeURI(p);
const kikB = s => `https://www.kikkoman.co.jp/homecook/lunch/enji/${s}.html`;
const kikR = ids => ids.map(i => `https://www.kikkoman.co.jp/homecook/search/recipe/${i}/`);
const dk = id => `https://delishkitchen.tv/recipes/${id}`;
const bbc = s => `https://www.bbcgoodfood.com/recipes/${s}`;
const SOY = 'しょうゆ (ing-soy-sauce, varies-by-product)';
const c = [];
const add = o => c.push({
  rank: null, candidateId: null, nameJa: null, nameEn: null, sourceUrl: null, sourceTitle: null, publisher: null, accessed: '2026-10-25',
  componentUrls: [], sourceFormat: 'bento', style: null, themeId: null, whyIncluded: null,
  expectedAllergens: [], expectedMayContain: [], unknownOriginIngredients: [], proposedNewIds: [], dietNotes: null,
  estMinutes: null, minutesBasis: null, variety: { protein: [], cuisine: null, theme: null }, reserveFor: null, notes: null,
  status: 'verified', rejectReason: null, ...o,
});

// ---------- Ranks 1-20: the library ----------
add({ rank: 1, candidateId: 'nhk-sake-teriyaki-bento', nameJa: '鮭の照り焼き弁当 幼児向け', nameEn: 'Teriyaki salmon bento (for small children)', sourceUrl: nhk('/recipe/1474_鮭の照り焼き弁当 幼児向け.html'), publisher: P.nhk,
  style: 'japanese', whyIncluded: 'Japanese fish bento written for 幼児 portions by a named cook (藤井恵); quick fish option.',
  expectedAllergens: ['alg-salmon', 'alg-milk'], expectedMayContain: ['alg-wheat', 'alg-soybean'], proposedNewIds: ['ing-tarako (たらこ)'],
  dietNotes: 'pescatarian, no-pork, no-beef OK; not vegetarian or no-seafood. Soy sauce: ' + SOY + '.', estMinutes: 10, minutesBasis: 'page 調理時間 10分',
  variety: { protein: ['fish'], cuisine: 'japanese', theme: null }, notes: 'Butter amount not given in the ingredient list (phase 2: check the page, else small-amount).' });
add({ rank: 2, candidateId: 'sirogohan-sanshoku-soborodon', nameJa: '卵と鶏の三色そぼろ丼', nameEn: 'Three-colour chicken and egg soboro rice bowl', sourceUrl: 'https://www.sirogohan.com/recipe/soborodon/', publisher: P.siro,
  sourceFormat: 'dish', style: 'japanese', whyIncluded: 'Classic Japanese bento rice bowl; page says it suits お弁当; chicken + egg, no dashi.',
  expectedAllergens: ['alg-chicken', 'alg-egg'], expectedMayContain: ['alg-wheat', 'alg-soybean'],
  dietNotes: 'no-pork, no-beef, no-seafood OK.', estMinutes: 20, minutesBasis: 'page 調理時間 20分 (2-3 servings; scale to 1 child)',
  variety: { protein: ['chicken', 'egg'], cuisine: 'japanese', theme: null }, notes: 'Single dish presented as suitable for bento (OQ-09: one bento as presented).' });
add({ rank: 3, candidateId: 'kikkoman-enji-omurice-bento', nameJa: 'オムライス弁当', nameEn: 'Omurice bento', sourceUrl: kikB('omurice'), componentUrls: kikR(['00002912', '00002913']), publisher: P.kik,
  style: 'western-inspired', whyIncluded: 'Kindergarten-portion (園児のお弁当用) omurice; Western-inspired staple without consomme.',
  expectedAllergens: ['alg-chicken', 'alg-milk', 'alg-egg', 'alg-soybean'], expectedMayContain: ['alg-wheat'], proposedNewIds: ['ing-radish (ラディッシュ)'],
  dietNotes: 'no-pork, no-beef OK; side salad has ちりめんじゃこ (fish) so not no-seafood unless the side is swapped.', estMinutes: 30, minutesBasis: 'component times 20 + 10 min',
  variety: { protein: ['chicken', 'egg'], cuisine: 'western-inspired', theme: null }, notes: 'Brand items (デルモンテ ketchup, キッコーマン soy sauce) become generic (brief rule 9).' });
add({ rank: 4, candidateId: 'kikkoman-enji-sake-hamberg-bento', nameJa: '鮭ハンバーグ弁当', nameEn: 'Salmon patty bento', sourceUrl: kikB('sakehamberg'), componentUrls: kikR(['00003012', '00003014']), publisher: P.kik,
  style: 'japanese', whyIncluded: 'Kindergarten portion; no egg, milk or wheat ingredient (soy sauce only may contain wheat): allergy-friendly fish bento.',
  expectedAllergens: ['alg-salmon', 'alg-sesame'], expectedMayContain: ['alg-wheat', 'alg-soybean'],
  dietNotes: 'pescatarian, no-pork, no-beef OK.', estMinutes: 30, minutesBasis: 'component times 20 + 10 min',
  variety: { protein: ['fish'], cuisine: 'japanese', theme: null } });
add({ rank: 5, candidateId: 'kikkoman-enji-buta-ketchup-bento', nameJa: '豚肉のケチャップ炒め弁当', nameEn: 'Pork and ketchup stir-fry bento', sourceUrl: kikB('butaketchup'), componentUrls: kikR(['00003261', '00003263']), publisher: P.kik,
  style: 'western-inspired', whyIncluded: 'Kindergarten portion; pork option with no egg, milk or wheat ingredient; 洋食-style ketchup flavour.',
  expectedAllergens: ['alg-pork', 'alg-apple'], expectedMayContain: ['alg-wheat', 'alg-soybean'],
  dietNotes: 'no-beef, no-seafood OK; not no-pork.', estMinutes: 25, minutesBasis: 'component times 15 + 10 min',
  variety: { protein: ['pork'], cuisine: 'western-inspired', theme: null }, notes: 'Style could also be read as japanese (soy sauce + ketchup); BA proposes western-inspired.' });
add({ rank: 6, candidateId: 'delish-niwatori-hiyoko-onigiri', nameJa: 'にわとりとひよこのおにぎり', nameEn: 'Hen and chick rice balls', sourceUrl: dk('153570755777397005'), publisher: P.dk,
  sourceFormat: 'dish', style: 'japanese', themeId: 'theme-animals', whyIncluded: 'Animal-themed bento rice balls with no animal products and none of the 9 mandatory allergens: covers vegetarian + allergy at once.',
  expectedAllergens: [], expectedMayContain: [],
  dietNotes: 'Meat-, fish-, egg- and dairy-free: OK for every MVP diet.', estMinutes: 30, minutesBasis: 'JSON-LD totalTime PT1800S',
  variety: { protein: ['none (rice)'], cuisine: 'japanese', theme: 'animals' }, notes: 'Rice-ball only (no side dishes on the page); recipe credited to a named DELISH creator (なかだみか). Curry powder is info: varies; phase 2 needs a label source or keeps it known-spice.' });
add({ rank: 7, candidateId: 'bbc-easy-kids-omelette', nameJa: 'かんたんキッズオムレツ', nameEn: "Easy kids' omelette", sourceUrl: bbc('kids-omelette'), publisher: P.bbc,
  sourceFormat: 'dish', style: 'western-inspired', whyIncluded: "Quick vegetarian, wheat-free Western option from BBC Good Food's kids' lunchbox collection.",
  expectedAllergens: ['alg-egg', 'alg-milk'], expectedMayContain: [], proposedNewIds: ['ing-dried-herbs (oregano)'],
  dietNotes: 'vegetarian (lacto-ovo) and all MVP diets OK.', estMinutes: 10, minutesBasis: 'JSON-LD prep 5 + cook 5 min',
  variety: { protein: ['egg', 'dairy'], cuisine: 'western-inspired', theme: null }, notes: 'nameJa is a BA translation (source is English-only); JSON-LD yield reads "6" — check on the page. Listed in the collection "75 Kids\' Lunchbox Recipes" (bbcgoodfood.com/recipes/collection/school-lunch-recipes).' });
add({ rank: 8, candidateId: 'kikkoman-enji-tuna-tamago-soboro-bento', nameJa: 'ツナと卵のそぼろご飯弁当', nameEn: 'Tuna and egg soboro rice bento', sourceUrl: kikB('tunatamagosoboro'), componentUrls: kikR(['00003042', '00003043']), publisher: P.kik,
  style: 'japanese', whyIncluded: 'Quick (15 min) kindergarten bento using canned tuna; different protein from the chicken soboro.',
  expectedAllergens: ['alg-egg'], expectedMayContain: ['alg-wheat', 'alg-soybean', 'alg-pork', 'alg-milk'],
  dietNotes: 'no-beef OK; side ハム = pork (not no-pork); tuna = fish.', estMinutes: 15, minutesBasis: 'component times 10 + 5 min',
  variety: { protein: ['fish', 'egg', 'pork (ham)'], cuisine: 'japanese', theme: null } });
add({ rank: 9, candidateId: 'delish-himawari-bento', nameJa: 'ひまわり弁当', nameEn: 'Sunflower bento', sourceUrl: dk('152838397549871567'), publisher: P.dk,
  style: 'japanese', themeId: 'theme-flowers', whyIncluded: 'Flower-themed, 10-minute bento with no egg, milk or wheat ingredient.',
  expectedAllergens: ['alg-salmon', 'alg-sesame', 'alg-soybean'], expectedMayContain: ['alg-pork', 'alg-milk', 'alg-soybean'], proposedNewIds: ['ing-salmon-flakes (鮭フレーク)', 'ing-shiso (大葉)'],
  dietNotes: 'Sausage (pork) + salmon: only no-beef OK.', estMinutes: 10, minutesBasis: 'JSON-LD totalTime PT600S',
  variety: { protein: ['fish', 'pork (sausage)'], cuisine: 'japanese', theme: 'flowers' }, notes: 'Recipe credited to a named DELISH creator (荒谷未来). Sausage/salmon flakes need a typical label source in phase 2.' });
add({ rank: 10, candidateId: 'nhk-juicy-hamberg-bento', nameJa: 'ジューシーハンバーグ弁当', nameEn: 'Juicy hamburger steak bento', sourceUrl: nhk('/recipe/7844_ジューシーハンバーグ弁当.html'), publisher: P.nhk,
  style: 'western-inspired', whyIncluded: 'Kids\' hamburger-steak bento (NHK こども弁当, 上田淳子): Western-inspired, mixed minced meat.',
  expectedAllergens: ['alg-beef', 'alg-pork', 'alg-milk'], expectedMayContain: ['alg-wheat', 'alg-egg', 'alg-soybean'], unknownOriginIngredients: ['ing-bread-crumbs (パン粉)'],
  dietNotes: 'Beef + pork + かつお節: no MVP diet OK; dietDataComplete=false unless a panko label is cited.', estMinutes: 30, minutesBasis: 'page 調理時間 30分',
  variety: { protein: ['beef', 'pork'], cuisine: 'western-inspired', theme: null }, notes: 'Contains はちみつ (fine from age 1; not for infants).' });
add({ rank: 11, candidateId: 'nhk-ohanabatake-bento', nameJa: 'お花畑弁当', nameEn: 'Flower garden bento', sourceUrl: nhk('/recipe/10254_お花畑弁当.html'), publisher: P.nhk,
  style: 'japanese', themeId: 'theme-flowers', whyIncluded: 'NHK こども弁当 with a flower theme in 15 minutes; chicken miso soboro.',
  expectedAllergens: ['alg-chicken', 'alg-wheat', 'alg-egg'], expectedMayContain: ['alg-soybean', 'alg-pork', 'alg-milk'],
  dietNotes: 'Ham = pork: no-beef, no-seafood OK.', estMinutes: 15, minutesBasis: 'page 調理時間 15分',
  variety: { protein: ['chicken', 'egg', 'pork (ham)'], cuisine: 'japanese', theme: 'flowers' } });
add({ rank: 12, candidateId: 'kikkoman-enji-youfuu-makizushi-bento', nameJa: '速攻15分！ 簡単洋風巻きずし弁当', nameEn: '15-minute Western-style sushi roll bento', sourceUrl: kikB('youhuumakizusi'), componentUrls: kikR(['00003117', '00003118', '00003119']), publisher: P.kik,
  style: 'western-inspired', whyIncluded: 'Quick (stated 15 min) kindergarten bento; ham-and-cheese roll is a Western twist on 巻きずし.',
  expectedAllergens: ['alg-milk', 'alg-chicken'], expectedMayContain: ['alg-pork', 'alg-wheat', 'alg-soybean'],
  dietNotes: 'Ham (pork) + chicken: no-beef, no-seafood OK.', estMinutes: 15, minutesBasis: 'page title 速攻15分',
  variety: { protein: ['pork (ham)', 'chicken', 'dairy'], cuisine: 'western-inspired', theme: null }, notes: 'Style could be japanese (巻きずし); the source calls it 洋風.' });
add({ rank: 13, candidateId: 'delish-penguin-seiretsu-bento', nameJa: 'ペンギンさん整列弁当', nameEn: 'Penguins-in-a-row bento', sourceUrl: dk('254879160311218449'), publisher: P.dk,
  style: 'japanese', themeId: 'theme-sea', whyIncluded: 'Sea-creature theme, 10 minutes, none of the 9 mandatory allergens.',
  expectedAllergens: ['alg-sesame'], expectedMayContain: [], proposedNewIds: ['ing-sakura-denbu (桜でんぶ)'],
  dietNotes: '桜でんぶ is fish-based: pescatarian, no-pork, no-beef OK.', estMinutes: 10, minutesBasis: 'JSON-LD totalTime PT600S',
  variety: { protein: ['fish (denbu)'], cuisine: 'japanese', theme: 'sea' }, notes: 'Yield 1 roll (12 pieces, 300 g rice): scale to one child portion.' });
add({ rank: 14, candidateId: 'kikkoman-enji-niku-yasaimaki-bento', nameJa: '肉の野菜巻き弁当', nameEn: 'Beef-wrapped vegetable bento', sourceUrl: kikB('nikuyasaimaki'), componentUrls: kikR(['00002988', '00002989']), publisher: P.kik,
  style: 'japanese', whyIncluded: 'Only beef main in the library; kindergarten portion; 肉巻き is a bento staple.',
  expectedAllergens: ['alg-beef', 'alg-milk'], expectedMayContain: ['alg-wheat', 'alg-soybean'],
  dietNotes: 'no-pork, no-seafood OK.', estMinutes: 30, minutesBasis: 'component times 20 + 10 min',
  variety: { protein: ['beef', 'dairy'], cuisine: 'japanese', theme: null } });
add({ rank: 15, candidateId: 'delish-kuma-usagi-sandwich', nameJa: 'くまとうさぎのサンドイッチ', nameEn: 'Bear and bunny sandwiches', sourceUrl: dk('160803623310197139'), publisher: P.dk,
  sourceFormat: 'dish', style: 'western-inspired', themeId: 'theme-animals', whyIncluded: 'Animal-themed Western sandwich lunch (roll bread + sausage).',
  expectedAllergens: ['alg-milk'], expectedMayContain: ['alg-wheat', 'alg-egg', 'alg-milk', 'alg-pork', 'alg-soybean'], unknownOriginIngredients: ['ing-bread (ロールパン)'],
  dietNotes: 'Sausage = pork; bread origin unknown → dietDataComplete=false unless a label is cited.', estMinutes: 30, minutesBasis: 'JSON-LD totalTime PT1800S',
  variety: { protein: ['pork (sausage)'], cuisine: 'western-inspired', theme: 'animals' }, notes: 'Recipe credited to a named DELISH creator (谷村せな).' });
add({ rank: 16, candidateId: 'delish-yaki-oyakodon-bento', nameJa: '焼き親子丼弁当', nameEn: 'Pan-fried oyakodon bento', sourceUrl: dk('279503143937508563'), publisher: P.dk,
  style: 'japanese', whyIncluded: '15-minute chicken-and-egg rice bento seasoned with soy/mirin/sake only (no dashi); egg fully cooked.',
  expectedAllergens: ['alg-chicken', 'alg-egg'], expectedMayContain: ['alg-wheat', 'alg-soybean'],
  dietNotes: 'no-pork, no-beef, no-seafood OK.', estMinutes: 15, minutesBasis: 'JSON-LD totalTime PT900S',
  variety: { protein: ['chicken', 'egg'], cuisine: 'japanese', theme: null }, notes: 'Recipe credited to a named DELISH creator (山あさ子).' });
add({ rank: 17, candidateId: 'delish-aka-chan-penguin-onigiri', nameJa: '赤ちゃんペンギンのおにぎり', nameEn: 'Baby penguin rice balls', sourceUrl: dk('163680009196667372'), publisher: P.dk,
  sourceFormat: 'dish', style: 'japanese', themeId: 'theme-sea', whyIncluded: 'Vegetarian, sea-themed rice balls in 15 minutes (cheese + nori decoration).',
  expectedAllergens: ['alg-milk'], expectedMayContain: ['alg-wheat', 'alg-soybean'],
  dietNotes: 'vegetarian and all MVP diets OK.', estMinutes: 15, minutesBasis: 'JSON-LD totalTime PT900S',
  variety: { protein: ['dairy'], cuisine: 'japanese', theme: 'sea' }, notes: 'Rice-ball only; rice quantity is 適量 on the page — phase 2 must confirm a quantity or skip.' });
add({ rank: 18, candidateId: 'bbc-cheesy-black-bean-quesadillas', nameJa: 'チーズとブラックビーンズのケサディーヤ', nameEn: 'Cheesy black bean quesadillas', sourceUrl: bbc('cheesy-black-bean-quesadillas'), publisher: P.bbc,
  sourceFormat: 'dish', style: 'western-inspired', whyIncluded: 'Vegetarian bean-protein Western lunch from the kids\' lunchbox collection; egg-free.',
  expectedAllergens: ['alg-milk'], expectedMayContain: ['alg-wheat'], unknownOriginIngredients: ['tortilla wraps (no id yet)'], proposedNewIds: ['ing-black-beans (ブラックビーンズ)', 'ing-tortilla (トルティーヤ)', 'ing-coriander-leaf (パクチー)', 'ing-cumin (クミン)'],
  dietNotes: 'vegetarian; tortilla origin must be stated or dietDataComplete=false.', estMinutes: 25, minutesBasis: 'JSON-LD prep 15 + cook 10 min',
  variety: { protein: ['beans', 'dairy'], cuisine: 'western-inspired', theme: null }, notes: 'nameJa is a BA translation. Needs 4 new dictionary ids before phase 2.' });
add({ rank: 19, candidateId: 'house-hajimete-curry-chahan', nameJa: '＜特定原材料８品目不使用＞はじめて食べるカレーチャーハン', nameEn: 'First curry fried rice (made without the 8 specified allergens)', sourceUrl: 'https://housefoods.jp/recipe/rcp_00020456.html', publisher: P.house,
  sourceFormat: 'dish', style: 'other', whyIncluded: 'Allergy-friendly rice dish built on a roux sold without the 8 specified allergens; mild, aimed at small children.',
  expectedAllergens: ['alg-pork'], expectedMayContain: [], unknownOriginIngredients: ['ing-curry-roux (allergen-free roux; product page must state ingredients)'],
  dietNotes: 'Pork: no-beef, no-seafood OK if the roux label shows no beef/seafood.', estMinutes: 15, minutesBasis: 'JSON-LD totalTime PT15M (3 servings)',
  variety: { protein: ['pork'], cuisine: 'other', theme: null }, notes: 'Phase 2 must cite the housefoods.jp product page for the roux: check cashew (9th mandatory item since caa-2026-04) and animal origin.' });
add({ rank: 20, candidateId: 'kikkoman-enji-sanshoku-mini-onigiri-bento', nameJa: '速攻15分！ 3色ミニおにぎり弁当', nameEn: '15-minute three-colour mini rice ball bento', sourceUrl: kikB('syokuminionigiri'), componentUrls: kikR(['00003143', '00003144', '00003145']), publisher: P.kik,
  style: 'japanese', whyIncluded: 'Quick (stated 15 min) kindergarten onigiri bento with three fillings.',
  expectedAllergens: ['alg-egg'], expectedMayContain: ['alg-wheat', 'alg-soybean', 'alg-pork', 'alg-milk'], proposedNewIds: ['ing-tarako (たらこ)'],
  dietNotes: 'たらこ/しらす (fish) + wiener (pork): only no-beef OK.', estMinutes: 15, minutesBasis: 'page title 速攻15分',
  variety: { protein: ['fish', 'egg', 'pork (sausage)'], cuisine: 'japanese', theme: null } });

// ---------- Reserves 21-30 ----------
add({ rank: 21, candidateId: 'kikkoman-enji-tori-tamago-onigiri-bento', nameJa: '鶏と卵のおにぎり弁当', nameEn: 'Chicken and egg rice ball bento', sourceUrl: kikB('toritamago'), componentUrls: kikR(['00002947', '00002948']), publisher: P.kik,
  style: 'japanese', reserveFor: 'any japanese rank (1-20); closest to rank 2', whyIncluded: 'Reserve: kindergarten chicken+egg onigiri bento.',
  expectedAllergens: ['alg-chicken', 'alg-egg'], expectedMayContain: ['alg-wheat', 'alg-soybean'], dietNotes: 'no-pork, no-beef, no-seafood OK.',
  estMinutes: 30, minutesBasis: 'component times 20 + 10 min', variety: { protein: ['chicken', 'egg'], cuisine: 'japanese', theme: null } });
add({ rank: 22, candidateId: 'ajinomoto-nishoku-soboro-bento', nameJa: '秒速　甘くな～い２色そぼろ弁当', nameEn: 'Speedy not-sweet two-colour soboro bento', sourceUrl: 'https://park.ajinomoto.co.jp/recipe/card/800180/', publisher: P.aji,
  style: 'japanese', reserveFor: 'rank 2 (same dish family: soboro)', whyIncluded: 'Reserve: 8-minute soboro bento tagged as popular with children.',
  expectedAllergens: ['alg-chicken', 'alg-egg', 'alg-sesame'], expectedMayContain: ['alg-wheat', 'alg-soybean'], unknownOriginIngredients: ['ing-dashi (「ほんだし」)', 'branded garlic/ginger paste (Cook Do 香味ペースト)'], proposedNewIds: ['ing-umeboshi (梅干し)'],
  dietNotes: 'Dashi product: dietDataComplete=false unless its ingredients are cited.', estMinutes: 8, minutesBasis: 'JSON-LD totalTime PT8M',
  variety: { protein: ['chicken', 'egg'], cuisine: 'japanese', theme: null }, notes: 'Two branded products → generic (rule 9); 梅干し pit is a choking hazard for small children (cite CAA/CFA if kept).' });
add({ rank: 23, candidateId: 'kikkoman-enji-takenoko-tsukune-bento', nameJa: 'たけのこ入りつくね弁当', nameEn: 'Chicken patty with bamboo shoot bento', sourceUrl: kikB('takenokoiritukune'), componentUrls: kikR(['00003089', '00003090', '00003091']), publisher: P.kik,
  style: 'japanese', reserveFor: 'any japanese rank', whyIncluded: 'Reserve: kindergarten chicken tsukune bento.',
  expectedAllergens: ['alg-chicken', 'alg-egg'], expectedMayContain: ['alg-wheat', 'alg-soybean', 'alg-pork', 'alg-milk'], dietNotes: 'Ham + しらす: only no-beef OK.',
  estMinutes: 35, minutesBasis: 'component times 15 + 10 + 10 min', variety: { protein: ['chicken', 'egg'], cuisine: 'japanese', theme: null } });
add({ rank: 24, candidateId: 'delish-tsuyu-charaben', nameJa: '梅雨キャラ弁当', nameEn: 'Rainy-season character bento', sourceUrl: dk('202514334285300116'), publisher: P.dk,
  style: 'japanese', themeId: 'theme-seasonal', reserveFor: 'themed japanese ranks (9, 11, 13, 17)', whyIncluded: 'Reserve: seasonal theme (梅雨).',
  expectedAllergens: ['alg-chicken', 'alg-egg', 'alg-soybean', 'alg-sesame'], expectedMayContain: ['alg-wheat'], unknownOriginIngredients: ['めんつゆ (dashi-based; no id yet)'], proposedNewIds: ['ing-mentsuyu (めんつゆ)'],
  dietNotes: 'めんつゆ origin unknown → dietDataComplete=false unless cited.', estMinutes: 30, minutesBasis: 'JSON-LD totalTime PT1800S',
  variety: { protein: ['chicken', 'egg'], cuisine: 'japanese', theme: 'seasonal' } });
add({ rank: 25, candidateId: 'delish-shirousagi-omurice-bento', nameJa: '白うさぎのオムライス弁当', nameEn: 'White bunny omurice bento', sourceUrl: dk('158593716271972844'), publisher: P.dk,
  style: 'western-inspired', themeId: 'theme-animals', reserveFor: 'rank 3 (same dish: omurice) or rank 15 (animal theme)', whyIncluded: 'Reserve: themed omurice.',
  expectedAllergens: ['alg-egg', 'alg-milk'], expectedMayContain: [], unknownOriginIngredients: ['ing-consomme (コンソメ)'],
  dietNotes: 'Consomme origin unknown → dietDataComplete=false unless cited.', estMinutes: 30, minutesBasis: 'JSON-LD totalTime PT1800S',
  variety: { protein: ['egg'], cuisine: 'western-inspired', theme: 'animals' } });
add({ rank: 26, candidateId: 'kikkoman-hikiniku-cornball-bento', nameJa: 'ひき肉入りコーンボール弁当', nameEn: 'Pork and corn ball bento', sourceUrl: kikB('cornball'), componentUrls: kikR(['00003664', '00003666', '00003665']), publisher: P.kik,
  style: 'western-inspired', reserveFor: 'rank 10 (minced-meat Western main)', whyIncluded: 'Reserve: Western-style minced-pork bento.',
  expectedAllergens: ['alg-pork', 'alg-milk'], expectedMayContain: ['alg-wheat', 'alg-egg', 'alg-soybean'], unknownOriginIngredients: ['ing-bread-crumbs (パン粉)'],
  dietNotes: 'Pork; panko origin unknown.', estMinutes: 40, minutesBasis: 'component times 20 + 10 + 10 min (components yield 2 servings)',
  variety: { protein: ['pork', 'dairy'], cuisine: 'western-inspired', theme: null }, notes: 'Listed in 園児のお弁当 but its component pages are general recipes (2人分), not 園児 portions.' });
add({ rank: 27, candidateId: 'joc-egg-salad-sandwich-bento', nameJa: 'たまごサンド弁当', nameEn: 'Egg Salad Sandwich Bento', sourceUrl: 'https://www.justonecookbook.com/egg-salad-sandwich-bento/', publisher: P.joc,
  sourceFormat: 'dish', style: 'western-inspired', reserveFor: 'western ranks 7, 15, 18 (quick / vegetarian)', whyIncluded: 'Reserve: 10-minute vegetarian sandwich bento with an English source.',
  expectedAllergens: ['alg-egg'], expectedMayContain: ['alg-wheat', 'alg-milk', 'alg-egg', 'alg-soybean'], unknownOriginIngredients: ['ing-bread (パン)'],
  dietNotes: 'Vegetarian if the bread is; bread origin unknown → dietDataComplete=false unless cited.', estMinutes: 10, minutesBasis: 'JSON-LD prep 10 min',
  variety: { protein: ['egg'], cuisine: 'western-inspired', theme: null } });
add({ rank: 28, candidateId: 'bbc-chickpea-fritters', nameJa: 'ひよこ豆のフリッター', nameEn: 'Chickpea fritters', sourceUrl: bbc('chickpea-fritters'), publisher: P.bbc,
  sourceFormat: 'dish', style: 'western-inspired', reserveFor: 'rank 18 (vegetarian Western)', whyIncluded: 'Reserve: vegetarian legume protein, 20 minutes.',
  expectedAllergens: ['alg-wheat', 'alg-egg', 'alg-milk'], expectedMayContain: [], proposedNewIds: ['ing-chickpea (ひよこ豆)', 'ing-garam-masala', 'ing-cumin', 'ing-coriander-leaf'],
  dietNotes: 'vegetarian.', estMinutes: 20, minutesBasis: 'JSON-LD prep 10 + cook 10 min (batch of 12)',
  variety: { protein: ['beans', 'egg'], cuisine: 'western-inspired', theme: null }, notes: 'nameJa is a BA translation.' });
add({ rank: 29, candidateId: 'delish-penguin-onigirazu-bento', nameJa: 'ペンギンおにぎらず弁当', nameEn: 'Penguin onigirazu bento', sourceUrl: dk('159623626746757523'), publisher: P.dk,
  style: 'japanese', themeId: 'theme-sea', reserveFor: 'themed japanese ranks (9, 11, 13, 17)', whyIncluded: 'Reserve: 15-minute sea-themed bento.',
  expectedAllergens: ['alg-egg', 'alg-milk', 'alg-sesame'], expectedMayContain: ['alg-pork', 'alg-soybean', 'alg-wheat'],
  dietNotes: 'Wiener = pork: no-beef, no-seafood OK.', estMinutes: 15, minutesBasis: 'JSON-LD totalTime PT900S',
  variety: { protein: ['egg', 'pork (sausage)'], cuisine: 'japanese', theme: 'sea' } });
add({ rank: 30, candidateId: 'house-chicken-rice-8-free', nameJa: '＜特定原材料８品目不使用＞チキンライス', nameEn: 'Chicken rice (made without the 8 specified allergens)', sourceUrl: 'https://housefoods.jp/recipe/rcp_00026679.html', publisher: P.house,
  sourceFormat: 'dish', style: 'western-inspired', reserveFor: 'rank 19 (allergy-friendly rice) or rank 3', whyIncluded: 'Reserve: allergy-friendly chicken rice, 15 minutes.',
  expectedAllergens: ['alg-chicken'], expectedMayContain: [], unknownOriginIngredients: ['allergen-free hayashi sauce (no id yet)'], proposedNewIds: ['ing-hayashi-roux (ハヤシライスソース)'],
  dietNotes: 'no-pork, no-beef, no-seafood if the sauce label confirms.', estMinutes: 15, minutesBasis: 'JSON-LD totalTime PT15M (2 servings)',
  variety: { protein: ['chicken'], cuisine: 'western-inspired', theme: null }, notes: 'Phase 2 must cite the housefoods.jp product page for the sauce (cashew, animal origin).' });

// ---------- Rejected (fetched and title-checked, but unusable) ----------
const rej = (o) => add({ status: 'rejected', ...o });
rej({ candidateId: 'lettuceclub-kobuta-onigirazu-bento', nameJa: '子豚のおにぎらず弁当', nameEn: 'Piglet onigirazu bento', sourceUrl: 'https://www.lettuceclub.net/recipe/dish/22911/', publisher: P.lc, style: 'japanese', rejectReason: 'No cooking time on the page (only kcal/salt); brief rule 5 forbids estimating a time.' });
rej({ candidateId: 'lettuceclub-mix-pocket-sand-bento', nameJa: 'ミックスポケットサンド弁当', nameEn: 'Mixed pocket sandwich bento', sourceUrl: 'https://www.lettuceclub.net/recipe/dish/22929/', publisher: P.lc, style: 'western-inspired', rejectReason: 'No cooking time on the page; several ingredients without quantities (マヨネーズ, 塩, こしょう, 粒マスタード).' });
rej({ candidateId: 'orangepage-jack-o-lantern-omurice-bento', nameJa: 'ジャックオーランタンのオムライス弁当', nameEn: "Jack-o'-lantern omurice bento", sourceUrl: 'https://www.orangepage.net/opeditor/theme/321432', publisher: P.op, style: 'western-inspired', themeId: 'theme-seasonal', rejectReason: 'Editor blog post (今日、何作った？), no total time; consomme and 中濃ソース of unknown origin. Use DELISH reserves for themed omurice instead.' });
rej({ candidateId: 'joc-teriyaki-salmon-bento', nameJa: '照り焼きサーモン弁当', nameEn: 'Teriyaki Salmon Bento', sourceUrl: 'https://www.justonecookbook.com/teriyaki-salmon-bento/', publisher: P.joc, style: 'japanese', rejectReason: 'Assembly page: components listed without quantities (point to other recipes); duplicates rank 1.' });
rej({ candidateId: 'joc-chicken-meatball-bento', nameJa: '豆腐ハンバーグ弁当', nameEn: 'Chicken Meatball Bento', sourceUrl: 'https://www.justonecookbook.com/chicken-meatball-bento/', publisher: P.joc, style: 'japanese', rejectReason: 'Assembly page: components listed without quantities (incl. kani salad and fruit).' });
rej({ candidateId: 'joc-cute-octopus-sausage-bento', nameJa: 'たこソーセージ弁当', nameEn: 'Cute Octopus Sausage Bento', sourceUrl: 'https://www.justonecookbook.com/cute-octopus-sausage-bento/', publisher: P.joc, style: 'japanese', rejectReason: 'Assembly page without quantities; whole grapes and cherry tomatoes would need a cited choking note.' });
rej({ candidateId: 'nhk-hijiki-burg-bento', nameJa: 'ひじきバーグ弁当（子ども弁当）', nameEn: 'Hijiki burger bento (kids)', sourceUrl: nhk('/recipe/20734_ひじきバーグ弁当（子ども弁当）.html'), publisher: P.nhk, style: 'japanese', rejectReason: 'All components given as 適量 (separate sub-recipes); no time on the page.' });
rej({ candidateId: 'nhk-tarako-spaghetti-bento', nameJa: 'たらこスパゲッティ弁当 幼児向け', nameEn: 'Cod roe spaghetti bento (for small children)', sourceUrl: nhk('/recipe/17_たらこスパゲッティ弁当 幼児向け.html'), publisher: P.nhk, style: 'western-inspired', rejectReason: 'Main and sides given as 適量 (sub-recipes); no total time.' });
rej({ candidateId: 'ajinomoto-pilaf-inari-bento', nameJa: 'びっくり！ピラフいなり弁当', nameEn: 'Surprise pilaf inari bento', sourceUrl: 'https://park.ajinomoto.co.jp/recipe/card/701031/', publisher: P.aji, style: 'japanese', rejectReason: 'Built on two branded frozen products (shrimp pilaf, shrimp shumai) that have no generic equivalent; adult-oriented.' });
rej({ candidateId: 'delish-teiban-noriben', nameJa: '定番のり弁', nameEn: 'Classic nori bento', sourceUrl: dk('409518151697433782'), publisher: P.dk, style: 'japanese', rejectReason: 'Packing guide: fried fish, chikuwa isobe-age, kinpira etc. listed as finished items (1個, 適量) without recipes.' });
rej({ candidateId: 'bbc-hummus-snack-packs', nameJa: 'フムスのスナックパック', nameEn: 'Hummus snack packs', sourceUrl: bbc('hummus-snack-packs'), publisher: P.bbc, style: 'western-inspired', rejectReason: 'A snack, not a lunch; raw carrot sticks for 3-6-year-olds would need a cited choking note. Kept out; vegetarian/allergen-free need is met by ranks 6 and 17.' });

for (const x of c) { x.sourceTitle = titleOf(x.sourceUrl); }
// sanity
const ids = new Set(); for (const x of c) { if (ids.has(x.candidateId)) throw new Error('dup id ' + x.candidateId); ids.add(x.candidateId); if (/\s/.test(x.sourceUrl)) throw new Error('space in url ' + x.sourceUrl); }
const names = new Set(); for (const x of c.filter(x => x.status === 'verified')) { if (names.has(x.nameJa)) throw new Error('dup name ' + x.nameJa); names.add(x.nameJa); }
const lib = c.filter(x => x.rank && x.rank <= 20), lib18 = lib.filter(x => x.rank <= 18);
const MAND = ['alg-shrimp', 'alg-crab', 'alg-walnut', 'alg-wheat', 'alg-buckwheat', 'alg-egg', 'alg-milk', 'alg-peanut', 'alg-cashew'];
const veg = x => /^Meat-|^vegetarian/.test(x.dietNotes);
const fishy = x => x.variety.protein.some(p => /fish/.test(p)) || /fish|じゃこ|しらす|かつお節|denbu/.test(x.dietNotes);
const mix = s => ({
  count: s.length,
  japanese: s.filter(x => x.style === 'japanese').length, westernInspired: s.filter(x => x.style === 'western-inspired').length, other: s.filter(x => x.style === 'other').length,
  minutesLe20: s.filter(x => x.estMinutes <= 20).length, themed: s.filter(x => x.themeId).length,
  noMandatoryAllergenIngredient: s.filter(x => !x.expectedAllergens.some(a => MAND.includes(a))).map(x => x.rank),
  vegetarian: s.filter(veg).map(x => x.rank),
  fishFree: s.filter(x => !fishy(x)).length,
  noPorkOk: s.filter(x => /(?<!not )no-pork/.test(x.dietNotes) || veg(x)).map(x => x.rank),
});
const out = {
  version: 1, phase: 'candidates (content-research §1)', generatedBy: 'ba (candidate agent)', generatedOn: '2026-10-25',
  notes: [
    'sourceTitle is the <title> of the page as fetched on 2026-10-25 (curl, ~3 s between requests); every verified and rejected URL returned HTTP 200 with a title matching the dish.',
    'expectedAllergens = inherent allergens of the ingredients seen in the source (dictionary ids, provisional); expectedMayContain = typical label allergens of processed ingredients (soy sauce, ham, sausage…), provisional until phase 2 cites labels.',
    'estMinutes is provisional: the source total time, or the sum of component times for キッコーマン 園児のお弁当 menus.',
    'nameJa keeps the source dish name (taglines before the name dropped); for English-only sources nameJa is a BA translation and flagged in notes.',
    'sourceFormat: "bento" = the page presents a whole box; "dish" = a single dish the source presents for lunchboxes (OQ-09 allows one bento as the source presents it).',
    'Ranks 1-18 alone meet every mix target of research-brief §1 (see mix.ranks1to18); ranks 19-20 are extra library slots; 21-30 reserves; rejected entries have rank null.',
  ],
  mix: { ranks1to18: mix(lib18), ranks1to20: mix(lib) },
  candidates: c,
};
fs.writeFileSync('C:/Projects/BentoMinder/data/_research/candidates.json', JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out.mix));
console.log('verified', c.filter(x => x.status === 'verified').length, 'rejected', c.filter(x => x.status === 'rejected').length);
