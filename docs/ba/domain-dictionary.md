# Domain dictionary — BentoMinder

Owner: BA · 2026-10-24 · Version **v1 (expandable)** · Status: **H1 final** (2026-10-24; ids are stable from here on, new terms by proposal only; H1 fix round: `animalOrigin` column (ruling B14), 2 new ingredients, verdict rule B2; M1 prep 2026-10-24: categories are labels only, new ambiguity group `amb-imo`; M2 prep 2026-10-25: amb-momo candidate id, non-food readings, picker kind labels, §8; research phase 2 prep 2026-10-25: 10 ingredients, §8)

Used by: preference assessment (BR-04, US-E4-01), profile pickers (US-E1-02), allergen and diet filters (BR-06), recipe validation (`docs/ba/data-contract.md` §3.7). `scripts/build-dictionary.mjs` converts these tables into `data/dictionary.json` (generated: one record per row, same ids; never edited by hand). This file is the source: changes go through the BA here, then `npm run build:dictionary`.

Scope: v1 covers the dishes and ingredients typical of Japanese kindergarten 給食 menus and of children's bentos: 30 categories and sub-categories, 29 current allergens (+1 retired), 181 ingredients, 55 dishes (236 food terms), 8 themes, 10 ambiguity groups. New terms are added by proposal (id, 表記, よみ, English, category, synonyms) and never by changing an existing id.

## 1. Matching rules (deterministic)
1. **Normalise** both the menu text and every surface form: Unicode NFKC (full/half-width), katakana → hiragana, remove spaces, 「・」 and brackets; keep 「ー」.
2. **One surface form → one id.** Each normalised synonym belongs to exactly one entry, or to one ambiguity group (§7). A form listed in an ambiguity group belongs to the group, not to the candidate entries (e.g. 「さけ」 → amb-sake even though 鮭 → ing-salmon). Text in full-width brackets in the 表記 column (「なし（梨）」) is a display disambiguator, not a surface form; the surface forms are the bare 表記 and the synonyms. Only ingredients (§4), dishes (§5) and ambiguity groups (§7) have surface forms; **categories (§2) have none** (their 表記 is a label, M1 prep). Validator rule `dict-synonym-unique`.
3. **Minimum length.** Kana surface forms match only if they have ≥ 2 characters; single-kanji forms (卵, 鮭, 梨…) are allowed.
4. **Dish pass first.** Scan the item left to right with longest match over dish forms. Text covered by a dish match is not rescanned; the dish adds its `name ingredients` (only ingredients literally named in the dish name).
5. **Ingredient pass.** Scan the remaining text, then the listed ingredients of the day, with longest match over ingredient forms and ambiguity-group forms (e.g. 「切り干し大根」 beats 「大根」, 「ごま油」 beats 「ごま」, 「カニカマ」 beats 「カニ」).
6. **Ambiguity.** A match on an ambiguity-group form is not resolved automatically unless a resolution rule in §7 applies; otherwise it is "unresolved", counts towards `U`, and the review screen asks the parent (US-E4-01/AC6). Typos are never auto-corrected.
7. **Categories.** Liking/disliking a category (e.g. `cat-fish`) matches every found ingredient and dish whose category is that category or one of its descendants. A category is never found in menu text by itself: a menu word that names a whole group is a surface form of one generic ingredient (「さかな」→ `ing-fish`, 「鶏肉」→ `ing-chicken`) or of an ambiguity group (「いも」→ `amb-imo`), and reaches the category through that entry.
7a. **One verdict per food, most specific entry wins** (H1 rulings B1, B2, follow-up, "OQ-16 overruled", "collapse narrowed", "collapse detail"). D and L count foods, not profile entries. Within one lunch item a matched dish and its `definingIngredientId` (§5) are one food; other ingredients named in the dish stay separate (豚のしょうが焼き = 豚肉-food + しょうが = 2). A found ancestor id folds into each found descendant; siblings stay separate (鶏肉 + 鶏もも肉 + 鶏むね肉 = 2 foods). Nothing is chained: different items merge only through identical or ancestor/descendant ids, and two dishes never merge. A defining-ingredient link never crosses items (「鶏のから揚げ」 + 「鶏もも肉のてりやき」 = 2 foods). The verdict is checked level by level: the food's ingredient ids → their dictionary parents → the dish id → categories and ancestors (ingredient → dish → category); at the deciding level a dislike beats a like. Example: likes `cat-fish`, dislikes `ing-mackerel` → さば is disliked only, さけ is liked. Full rule and worked example: `user-stories.md` E4.
8. **Seasonings do not count** towards D or L unless the child's profile names that exact id.
9. **Allergens are never inferred from the menu.** `inherent allergens` below are used only to validate recipes (`recipe-ingredient-inherent-allergen`) and to label profile pickers; school-menu allergen notices use only what the PDF declares (BR-08).

Column meaning: **inherent allergens** = the food is itself that allergen item (卵 → alg-egg). **info** = `known` (single food) or `varies` (processed food whose allergens depend on the product; recipes must record the label's allergens as `possibleAllergenIds`). **animalOrigin** (H1 ruling B14; used only by the diet filter, data contract §3.8) = the animal-origin tags the food has or that its common products contain, from `meat` (species not stated or varying), `pork`, `beef`, `chicken`, `fish-seafood`, `egg`, `dairy`, `gelatin`; `–` = no animal origin; a trailing `?` = the animal origin of the food's products cannot be bounded (JSON: `animalOrigin` array + `animalOriginKnown: false`). A recipe ingredient copies these tags (it may add tags, never remove them); a `?` ingredient makes the recipe `dietDataComplete = false`, and so excluded for every selected diet, unless the recipe's cited source states that product's ingredients.

**animalOrigin coverage (H1; research phase 2 prep):** 181 of 181 ingredients carry a value: 65 with at least one tag or `?`, 116 `–`. Unknown (`?`, 8): `ing-bread`, `ing-bread-crumbs` (milk, butter or egg are common; other animal-derived fats or additives cannot be ruled out across products), `ing-worcester-sauce` (some products may use animal extracts; not established), `ing-curry-roux`, `ing-stew-roux` (typically contain meat extracts and fats and milk; exact species vary), `ing-dashi` (fish-based; granulated 和風だし may contain other extracts), `ing-consomme` (beef, chicken and pork extracts or fats are common; varies), `ing-tortilla` (flour tortillas are made with a fat that may be vegetable oil, shortening or lard depending on the product; not established, so no tag is asserted). Hidden sources tagged without `?`: かつおぶし, 煮干し (`fish-seafood`), ウインナー, ハム (`meat`, `pork`), ベーコン (`pork`), ちくわ, かまぼこ, はんぺん, さつま揚げ, カニカマ, 桜でんぶ, たらこ, 鮭フレーク (`fish-seafood`), マヨネーズ (`egg`), バター and other dairy (`dairy`), ヨーグルト (`dairy`, `gelatin`: some products contain gelatin), ひき肉 with species not stated (`meat`). Still to verify: animal rennet in チーズ (tagged `dairy` only; see `open-questions.md`).

## 2. Categories
| id | 表記 | よみ | English | parent |
|----|------|------|---------|--------|
| cat-grain | 主食・穀類 | しゅしょく・こくるい | Grains & staples | – |
| cat-noodle | めん類 | めんるい | Noodles | cat-grain |
| cat-potato | いも類 | いもるい | Potatoes & tubers | – |
| cat-vegetable | 野菜 | やさい | Vegetables | – |
| cat-green-vegetable | 緑黄色野菜 | りょくおうしょくやさい | Green & yellow vegetables | cat-vegetable |
| cat-leafy-vegetable | 葉もの野菜 | はものやさい | Leafy greens | cat-vegetable |
| cat-mushroom | きのこ | きのこ | Mushrooms | – |
| cat-seaweed | 海そう | かいそう | Seaweed | – |
| cat-soy | 大豆・大豆製品 | だいず・だいずせいひん | Soy & soy products | – |
| cat-egg | たまご | たまご | Eggs | – |
| cat-dairy | 乳製品 | にゅうせいひん | Dairy | – |
| cat-meat | 肉 | にく | Meat | – |
| cat-chicken | 鶏肉 | とりにく | Chicken | cat-meat |
| cat-pork | 豚肉 | ぶたにく | Pork | cat-meat |
| cat-beef | 牛肉 | ぎゅうにく | Beef | cat-meat |
| cat-meat-processed | ハム・ソーセージ類 | はむ・そーせーじるい | Processed meat | cat-meat |
| cat-fish | さかな | さかな | Fish | – |
| cat-seafood | えび・いか・貝など | えび・いか・かいなど | Shellfish & other seafood | – |
| cat-fish-processed | 練りもの | ねりもの | Fish-paste products | – |
| cat-fruit | くだもの | くだもの | Fruit | – |
| cat-nuts-seeds | ナッツ・種実 | なっつ・しゅじつ | Nuts & seeds | – |
| cat-seasoning | 調味料 | ちょうみりょう | Seasonings | – |
| cat-sweets | おやつ・デザート | おやつ・でざーと | Sweets & desserts | – |
| cat-drink | 飲みもの | のみもの | Drinks | – |
| cat-dish-rice | ごはんもの | ごはんもの | Rice dishes | – |
| cat-dish-noodle | めん料理 | めんりょうり | Noodle dishes | – |
| cat-dish-fried | 揚げもの | あげもの | Fried dishes | – |
| cat-dish-simmered | 煮もの | にもの | Simmered dishes | – |
| cat-dish-soup | 汁もの・スープ | しるもの・すーぷ | Soups | – |
| cat-dish-salad | サラダ・あえもの | さらだ・あえもの | Salads & dressed vegetables | – |

**Labels only (M1 prep).** The 表記 column is the label shown in profile pickers and explanations; it is **not** a surface form, and the matcher never finds a category in menu text (§1 rules 2, 5, 7). Where a category label is also an everyday menu word, that word belongs to exactly one ingredient or ambiguity group: 「鶏肉」→ `ing-chicken`, 「豚肉」→ `ing-pork`, 「牛肉」→ `ing-beef`, 「たまご」→ `ing-egg`, 「さかな」→ `ing-fish`, 「いも」→ `amb-imo` (§7). A child who dislikes `cat-chicken` therefore still gets a disliked verdict for 「鶏肉」 in a menu, through `ing-chicken`'s category.

`cat-fish-processed` is deliberately **not** under `cat-fish`: many children who dislike fish eat ちくわ or かまぼこ, so parents select it separately. Diet filters list it explicitly (data contract §3.8).

## 3. Allergens — Japanese labelling scheme `caa-2026-04`
Source: Consumer Affairs Agency (消費者庁) scheme as summarised by Kyoto Prefecture, https://www.pref.kyoto.jp/shoku-kawaraban/allergie01.html (fetched 2026-10-24), and Sendai City on the 2024 change, https://www.city.sendai.jp/sekatsuese-shokuhin/makadamia-matsutake.html. Cashew became mandatory in April 2026 (old labels allowed for products made until 2028-03-31); pistachio is now on the recommended list; macadamia was added and matsutake removed in March 2024.

**特定原材料 (mandatory labelling, 9 items)**
| id | 表記 | よみ | English | synonyms |
|----|------|------|---------|----------|
| alg-shrimp | えび | えび | Shrimp/prawn | エビ, 海老 |
| alg-crab | かに | かに | Crab | カニ, 蟹 |
| alg-walnut | くるみ | くるみ | Walnut | クルミ, 胡桃 |
| alg-wheat | 小麦 | こむぎ | Wheat | こむぎ |
| alg-buckwheat | そば | そば | Buckwheat | 蕎麦, ソバ |
| alg-egg | 卵 | たまご | Egg | たまご, 玉子, 鶏卵 |
| alg-milk | 乳 | にゅう | Milk | 乳成分, 牛乳 |
| alg-peanut | 落花生 | らっかせい | Peanut | ピーナッツ |
| alg-cashew | カシューナッツ | かしゅーなっつ | Cashew nut | – |

**特定原材料に準ずるもの (recommended labelling, 20 items)**
| id | 表記 | よみ | English |
|----|------|------|---------|
| alg-almond | アーモンド | あーもんど | Almond |
| alg-abalone | あわび | あわび | Abalone |
| alg-squid | いか | いか | Squid |
| alg-salmon-roe | いくら | いくら | Salmon roe |
| alg-orange | オレンジ | おれんじ | Orange |
| alg-kiwi | キウイフルーツ | きういふるーつ | Kiwifruit |
| alg-beef | 牛肉 | ぎゅうにく | Beef |
| alg-sesame | ごま | ごま | Sesame |
| alg-salmon | さけ | さけ | Salmon |
| alg-mackerel | さば | さば | Mackerel |
| alg-soybean | 大豆 | だいず | Soybean |
| alg-chicken | 鶏肉 | とりにく | Chicken |
| alg-banana | バナナ | ばなな | Banana |
| alg-pistachio | ピスタチオ | ぴすたちお | Pistachio |
| alg-pork | 豚肉 | ぶたにく | Pork |
| alg-macadamia | マカダミアナッツ | まかだみあなっつ | Macadamia nut |
| alg-peach | もも | もも | Peach |
| alg-yam | やまいも | やまいも | Yam (Japanese yam) |
| alg-apple | りんご | りんご | Apple |
| alg-gelatin | ゼラチン | ぜらちん | Gelatin |

**Retired:** `alg-matsutake` まつたけ (removed 2024-03): readable in old data, never offered or written (`allergen-retired`). Checked 2026-10-30 against Sendai City (https://www.city.sendai.jp/sekatsuese-shokuhin/makadamia-matsutake.html): the 2024 amendment removed まつたけ and added マカダミアナッツ on the recommended list; consistent.

Allergen synonyms are used only to map **declared** allergen lines of the menu PDF (「卵・乳・小麦」) to ids; they are a separate index from ingredient synonyms.

## 4. Ingredients
### 4.1 Grains, noodles, potatoes
| id | 表記 | よみ | English | category | synonyms | inherent allergens | info | animalOrigin |
|----|------|------|---------|----------|----------|--------------------|------|--------------|
| ing-rice | ごはん | ごはん | Cooked rice | cat-grain | ご飯, 白飯, 米, お米, ライス, 白ごはん | – | known | – |
| ing-rice-flour | 米粉 | こめこ | Rice flour | cat-grain | – | – | varies | – |
| ing-mixed-grain-rice | 麦ごはん | むぎごはん | Rice with barley | cat-grain | 麦ご飯, 押麦 | – | known | – |
| ing-bread | パン | ぱん | Bread | cat-grain | 食パン, ロールパン, コッペパン | – | varies | dairy, egg, ? |
| ing-wheat-flour | 小麦粉 | こむぎこ | Wheat flour | cat-grain | 薄力粉, 強力粉 | alg-wheat | known | – |
| ing-bread-crumbs | パン粉 | ぱんこ | Bread crumbs | cat-grain | – | – | varies | dairy, egg, ? |
| ing-tortilla | トルティーヤ | とるてぃーや | Wheat flour tortilla | cat-grain | トルティーア, トルティア, フラワートルティーヤ | alg-wheat | varies | ? |
| ing-udon | うどん | うどん | Udon noodles | cat-noodle | ウドン, 饂飩 | alg-wheat | varies | – |
| ing-soba | そば（蕎麦） | そば | Buckwheat noodles | cat-noodle | 蕎麦, 日本そば | alg-buckwheat | varies | – |
| ing-chinese-noodles | 中華めん | ちゅうかめん | Chinese-style wheat noodles | cat-noodle | 中華麺, ラーメン, 焼きそばめん | – | varies | egg |
| ing-spaghetti | スパゲティ | すぱげてぃ | Spaghetti | cat-noodle | スパゲッティ, パスタ | alg-wheat | varies | – |
| ing-macaroni | マカロニ | まかろに | Macaroni | cat-noodle | – | alg-wheat | varies | – |
| ing-harusame | 春雨 | はるさめ | Glass noodles | cat-noodle | はるさめ, ハルサメ | – | varies | – |
| ing-potato | じゃがいも | じゃがいも | Potato | cat-potato | ジャガイモ, じゃが芋, 馬鈴薯, ポテト | – | known | – |
| ing-sweet-potato | さつまいも | さつまいも | Sweet potato | cat-potato | サツマイモ, さつま芋, 薩摩芋 | – | known | – |
| ing-taro | さといも | さといも | Taro | cat-potato | 里芋, サトイモ | – | known | – |
| ing-yam | やまいも | やまいも | Japanese yam | cat-potato | 山芋, 長いも, 長芋, ながいも | alg-yam | known | – |
| ing-konjac | こんにゃく | こんにゃく | Konjac | cat-potato | 蒟蒻, 糸こんにゃく, しらたき | – | known | – |

`いも`, `芋` and `おいも` alone belong to the ambiguity group `amb-imo` (§7; M1 prep, replacing the earlier "maps to `cat-potato`"): the menu doesn't say which potato, so the review asks. The compound forms above (じゃがいも, さつま芋, 里芋, 長いも…) are ingredient forms and win by longest match.

### 4.2 Vegetables
| id | 表記 | よみ | English | category | synonyms | inherent allergens | info | animalOrigin |
|----|------|------|---------|----------|----------|--------------------|------|--------------|
| ing-carrot | にんじん | にんじん | Carrot | cat-green-vegetable | 人参, ニンジン, キャロット | – | known | – |
| ing-onion | たまねぎ | たまねぎ | Onion | cat-vegetable | 玉ねぎ, 玉葱, タマネギ, オニオン | – | known | – |
| ing-cabbage | キャベツ | きゃべつ | Cabbage | cat-leafy-vegetable | – | – | known | – |
| ing-chinese-cabbage | はくさい | はくさい | Napa cabbage | cat-leafy-vegetable | 白菜, ハクサイ | – | known | – |
| ing-daikon | だいこん | だいこん | Daikon radish | cat-vegetable | 大根, ダイコン | – | known | – |
| ing-dried-daikon | 切り干し大根 | きりぼしだいこん | Dried daikon strips | cat-vegetable | 切干大根, 切り干しだいこん | – | known | – |
| ing-burdock | ごぼう | ごぼう | Burdock root | cat-vegetable | 牛蒡, ゴボウ | – | known | – |
| ing-lotus-root | れんこん | れんこん | Lotus root | cat-vegetable | 蓮根, レンコン | – | known | – |
| ing-green-pepper | ピーマン | ぴーまん | Green bell pepper | cat-green-vegetable | – | – | known | – |
| ing-paprika | パプリカ | ぱぷりか | Red/yellow bell pepper | cat-green-vegetable | 赤ピーマン | – | known | – |
| ing-eggplant | なす | なす | Eggplant | cat-vegetable | 茄子, ナス, なすび | – | known | – |
| ing-pumpkin | かぼちゃ | かぼちゃ | Kabocha squash | cat-green-vegetable | 南瓜, カボチャ, パンプキン | – | known | – |
| ing-broccoli | ブロッコリー | ぶろっこりー | Broccoli | cat-green-vegetable | – | – | known | – |
| ing-cauliflower | カリフラワー | かりふらわー | Cauliflower | cat-vegetable | – | – | known | – |
| ing-spinach | ほうれん草 | ほうれんそう | Spinach | cat-leafy-vegetable | ほうれんそう, ホウレンソウ | – | known | – |
| ing-komatsuna | こまつな | こまつな | Komatsuna | cat-leafy-vegetable | 小松菜, コマツナ | – | known | – |
| ing-bok-choy | チンゲン菜 | ちんげんさい | Bok choy | cat-leafy-vegetable | チンゲンサイ, 青梗菜 | – | known | – |
| ing-mizuna | 水菜 | みずな | Mizuna | cat-leafy-vegetable | みずな, ミズナ | – | known | – |
| ing-shungiku | 春菊 | しゅんぎく | Garland chrysanthemum | cat-leafy-vegetable | しゅんぎく | – | known | – |
| ing-lettuce | レタス | れたす | Lettuce | cat-leafy-vegetable | – | – | known | – |
| ing-cucumber | きゅうり | きゅうり | Cucumber | cat-vegetable | 胡瓜, キュウリ | – | known | – |
| ing-tomato | トマト | とまと | Tomato | cat-green-vegetable | – | – | known | – |
| ing-cherry-tomato | ミニトマト | みにとまと | Cherry tomato (child of ing-tomato) | cat-green-vegetable | プチトマト | – | known | – |
| ing-bean-sprouts | もやし | もやし | Bean sprouts | cat-vegetable | モヤシ | – | known | – |
| ing-green-onion | ねぎ | ねぎ | Green onion / leek | cat-vegetable | 長ねぎ, 青ねぎ, 万能ねぎ, ネギ, 葱 | – | known | – |
| ing-chinese-chive | にら | にら | Chinese chives | cat-green-vegetable | ニラ, 韮 | – | known | – |
| ing-corn | とうもろこし | とうもろこし | Corn | cat-vegetable | コーン, スイートコーン, トウモロコシ | – | known | – |
| ing-edamame | えだまめ | えだまめ | Edamame | cat-vegetable | 枝豆, エダマメ | alg-soybean (conservative, see note) | known | – |
| ing-green-peas | グリーンピース | ぐりーんぴーす | Green peas | cat-vegetable | グリンピース, えんどう豆 | – | known | – |
| ing-black-beans | 黒いんげん豆 | くろいんげんまめ | Black beans (black kidney beans; not 黒豆 black soybeans) | cat-vegetable | 黒インゲン豆, 黒いんげん, ブラックビーンズ, ブラックビーン | – | known | – |
| ing-green-beans | いんげん | いんげん | Green beans | cat-green-vegetable | さやいんげん, インゲン | – | known | – |
| ing-snow-peas | きぬさや | きぬさや | Snow peas | cat-green-vegetable | 絹さや, さやえんどう | – | known | – |
| ing-okra | オクラ | おくら | Okra | cat-green-vegetable | – | – | known | – |
| ing-asparagus | アスパラガス | あすぱらがす | Asparagus | cat-green-vegetable | アスパラ | – | known | – |
| ing-celery | セロリ | せろり | Celery | cat-vegetable | – | – | known | – |
| ing-turnip | かぶ | かぶ | Turnip | cat-vegetable | 蕪, カブ | – | known | – |
| ing-zucchini | ズッキーニ | ずっきーに | Zucchini | cat-vegetable | – | – | known | – |
| ing-bamboo-shoot | たけのこ | たけのこ | Bamboo shoot | cat-vegetable | 筍, タケノコ | – | known | – |
| ing-garlic | にんにく | にんにく | Garlic | cat-vegetable | ニンニク, 大蒜 | – | known | – |
| ing-ginger | しょうが | しょうが | Ginger | cat-vegetable | 生姜, ショウガ | – | known | – |
| ing-shiso | 青じそ | あおじそ | Green shiso (perilla leaf) | cat-leafy-vegetable | 大葉, おおば, オオバ, 青ジソ, 青紫蘇, しそ, シソ, 紫蘇 | – | known | – |
| ing-coriander-leaf | パクチー | ぱくちー | Coriander leaf (cilantro) | cat-leafy-vegetable | 香菜, シャンツァイ, コリアンダーの葉, コリアンダーリーフ | – | known | – |
| ing-radish | ラディッシュ | らでぃっしゅ | Radish (small red) | cat-vegetable | 二十日大根, はつかだいこん, ハツカダイコン | – | known | – |
| ing-mixed-vegetables | ミックスベジタブル | みっくすべじたぶる | Frozen mixed vegetables | cat-vegetable | – | – | varies | – |

Note on new vegetables (research phase 2 prep): 黒いんげん豆 (`ing-black-beans`) is a kidney-bean variety, not a soybean, so it has no `alg-soybean`; 「黒豆」 (black soybeans) is deliberately **not** a form of it and has no entry yet (propose `ing-black-soybean` with `alg-soybean` when needed). 「しそ」 maps to `ing-shiso` (green shiso is what bento and menu text mean; red shiso appears as ゆかり or in 梅干し, which are not entries). Bare 「コリアンダー」 is not a form of `ing-coriander-leaf`, because in Japanese spice lists it usually means the seed; only 「コリアンダーの葉」「コリアンダーリーフ」 map. 「二十日大根」 beats 「大根」 by longest match. 「黒いんげん豆」 beats 「いんげん」 likewise. Source (accessed 2026-10-30): MAFF lists いんげん豆 and 大豆 as separate bean crops and names 黒大豆 as a colour of soybean (https://www.maff.go.jp/j/pr/aff/2102/spe1_01.html), so black kidney beans and 黒豆 are different foods.

Note on ing-edamame and ing-mandarin (decided default, H1): edamame are immature soybeans, and みかん is a citrus close to the CAA オレンジ item. Whether the CAA 大豆 and オレンジ items cover them has not been confirmed from a CAA source. Until it is, both carry the allergen as an **inherent** allergen (`alg-soybean`, `alg-orange`), so recipes list it in `allergenIds` and the hard filter (BR-06) excludes them for a child with that allergy. This errs on the side of excluding. If the CAA source shows an item is not covered, the BA removes the inherent allergen by proposal and cites the source (open-questions.md, "Still to verify").

### 4.3 Mushrooms and seaweed
| id | 表記 | よみ | English | category | synonyms | inherent allergens | info | animalOrigin |
|----|------|------|---------|----------|----------|--------------------|------|--------------|
| ing-shiitake | しいたけ | しいたけ | Shiitake | cat-mushroom | 椎茸, シイタケ, 干ししいたけ | – | known | – |
| ing-enoki | えのき | えのき | Enoki | cat-mushroom | えのきたけ, エノキ | – | known | – |
| ing-shimeji | しめじ | しめじ | Shimeji | cat-mushroom | シメジ, ぶなしめじ | – | known | – |
| ing-maitake | まいたけ | まいたけ | Maitake | cat-mushroom | 舞茸, マイタケ | – | known | – |
| ing-eringi | エリンギ | えりんぎ | King oyster mushroom | cat-mushroom | – | – | known | – |
| ing-mushroom | マッシュルーム | まっしゅるーむ | Button mushroom | cat-mushroom | – | – | known | – |
| ing-hijiki | ひじき | ひじき | Hijiki seaweed | cat-seaweed | 鹿尾菜, ヒジキ, 芽ひじき | – | known | – |
| ing-wakame | わかめ | わかめ | Wakame | cat-seaweed | 若布, ワカメ | – | known | – |
| ing-nori | のり | のり | Nori | cat-seaweed | 海苔, 焼きのり, きざみのり, ノリ | – | known | – |
| ing-aonori | 青のり | あおのり | Green laver flakes | cat-seaweed | あおのり | – | known | – |
| ing-kombu | こんぶ | こんぶ | Kombu | cat-seaweed | 昆布, 塩こんぶ | – | known | – |
| ing-agar | 寒天 | かんてん | Agar | cat-seaweed | かんてん | – | known | – |

### 4.4 Soy, eggs, dairy
| id | 表記 | よみ | English | category | synonyms | inherent allergens | info | animalOrigin |
|----|------|------|---------|----------|----------|--------------------|------|--------------|
| ing-soybean | 大豆 | だいず | Soybeans | cat-soy | だいず, 水煮大豆 | alg-soybean | known | – |
| ing-tofu | とうふ | とうふ | Tofu | cat-soy | 豆腐, 木綿豆腐, 絹ごし豆腐 | alg-soybean | known | – |
| ing-fried-tofu | 油揚げ | あぶらあげ | Fried tofu pouch | cat-soy | 油あげ, あぶらあげ, うす揚げ | alg-soybean | known | – |
| ing-thick-fried-tofu | 厚揚げ | あつあげ | Thick fried tofu | cat-soy | 生揚げ, あつあげ | alg-soybean | known | – |
| ing-koya-tofu | 高野豆腐 | こうやどうふ | Freeze-dried tofu | cat-soy | 凍り豆腐 | alg-soybean | known | – |
| ing-natto | 納豆 | なっとう | Natto | cat-soy | なっとう | alg-soybean | known | – |
| ing-soy-milk | 豆乳 | とうにゅう | Soy milk | cat-soy | とうにゅう | alg-soybean | varies | – |
| ing-kinako | きな粉 | きなこ | Roasted soybean flour | cat-soy | きなこ | alg-soybean | known | – |
| ing-egg | たまご | たまご | Egg | cat-egg | 卵, 玉子, 鶏卵, タマゴ, 全卵 | alg-egg | known | egg |
| ing-quail-egg | うずらの卵 | うずらのたまご | Quail egg | cat-egg | うずら卵, うずらたまご | alg-egg | known | egg |
| ing-milk | 牛乳 | ぎゅうにゅう | Milk | cat-dairy | ミルク, 牛乳（飲用） | alg-milk | known | dairy |
| ing-cheese | チーズ | ちーず | Cheese | cat-dairy | とろけるチーズ, 粉チーズ, スライスチーズ | alg-milk | varies | dairy |
| ing-yogurt | ヨーグルト | よーぐると | Yogurt | cat-dairy | – | alg-milk | varies | dairy, gelatin |
| ing-butter | バター | ばたー | Butter | cat-dairy | – | alg-milk | known | dairy |
| ing-cream | 生クリーム | なまくりーむ | Fresh cream | cat-dairy | – | alg-milk | varies | dairy |
| ing-skim-milk | スキムミルク | すきむみるく | Skim milk powder | cat-dairy | 脱脂粉乳 | alg-milk | known | dairy |

### 4.5 Meat and fish
| id | 表記 | よみ | English | category | synonyms | inherent allergens | info | animalOrigin |
|----|------|------|---------|----------|----------|--------------------|------|--------------|
| ing-chicken | 鶏肉 | とりにく | Chicken | cat-chicken | とり肉, とりにく, 鶏, チキン | alg-chicken | known | chicken |
| ing-chicken-thigh | 鶏もも肉 | とりももにく | Chicken thigh (child of ing-chicken) | cat-chicken | 鶏もも, とりもも | alg-chicken | known | chicken |
| ing-chicken-breast | 鶏むね肉 | とりむねにく | Chicken breast (child of ing-chicken) | cat-chicken | 鶏むね, 鶏胸肉 | alg-chicken | known | chicken |
| ing-chicken-tender | ささみ | ささみ | Chicken tenderloin (child of ing-chicken) | cat-chicken | ササミ, 鶏ささみ | alg-chicken | known | chicken |
| ing-ground-chicken | 鶏ひき肉 | とりひきにく | Ground chicken (child of ing-chicken) | cat-chicken | 鶏ミンチ, とりひき肉 | alg-chicken | known | chicken |
| ing-pork | 豚肉 | ぶたにく | Pork | cat-pork | ぶた肉, 豚, ポーク, 豚こま, 豚ロース | alg-pork | known | pork |
| ing-ground-pork | 豚ひき肉 | ぶたひきにく | Ground pork (child of ing-pork) | cat-pork | 豚ミンチ | alg-pork | known | pork |
| ing-beef | 牛肉 | ぎゅうにく | Beef | cat-beef | 牛こま, ビーフ | alg-beef | known | beef |
| ing-ground-beef | 牛ひき肉 | ぎゅうひきにく | Ground beef (child of ing-beef) | cat-beef | 牛ミンチ | alg-beef | known | beef |
| ing-ground-mixed | 合いびき肉 | あいびきにく | Ground beef & pork | cat-beef, cat-pork | あいびき肉, 合挽肉 | alg-beef, alg-pork | known | beef, pork |
| ing-ground-meat | ひき肉 | ひきにく | Ground meat (species not stated) | cat-meat | 挽肉, ミンチ | – | varies | meat |
| ing-ham | ハム | はむ | Ham | cat-meat-processed | ロースハム | – | varies | meat, pork |
| ing-sausage | ウインナー | ういんなー | Sausage / wiener | cat-meat-processed | ウィンナー, ソーセージ, ウインナーソーセージ | – | varies | meat, pork |
| ing-bacon | ベーコン | べーこん | Bacon | cat-meat-processed | – | – | varies | pork |
| ing-fish | 魚 | さかな | Fish (unspecified) | cat-fish | さかな, お魚 | – | known | fish-seafood |
| ing-white-fish | 白身魚 | しろみざかな | White fish (unspecified) | cat-fish | 白身, ホキ, メルルーサ | – | known | fish-seafood |
| ing-salmon | さけ | さけ | Salmon | cat-fish | 鮭, しゃけ, サケ, サーモン, 銀鮭 | alg-salmon | known | fish-seafood |
| ing-mackerel | さば | さば | Mackerel | cat-fish | 鯖, サバ | alg-mackerel | known | fish-seafood |
| ing-cod | たら | たら | Cod | cat-fish | 鱈, タラ | – | known | fish-seafood |
| ing-yellowtail | ぶり | ぶり | Yellowtail | cat-fish | 鰤, ブリ | – | known | fish-seafood |
| ing-horse-mackerel | あじ（鯵） | あじ | Horse mackerel | cat-fish | 鯵, アジ | – | known | fish-seafood |
| ing-spanish-mackerel | さわら | さわら | Japanese Spanish mackerel | cat-fish | 鰆, サワラ | – | known | fish-seafood |
| ing-saury | さんま | さんま | Pacific saury | cat-fish | 秋刀魚, サンマ | – | known | fish-seafood |
| ing-sardine | いわし | いわし | Sardine | cat-fish | 鰯, イワシ | – | known | fish-seafood |
| ing-shishamo | ししゃも | ししゃも | Shishamo smelt | cat-fish | シシャモ, 柳葉魚 | – | known | fish-seafood |
| ing-tuna | まぐろ | まぐろ | Tuna | cat-fish | 鮪, マグロ | – | known | fish-seafood |
| ing-canned-tuna | ツナ | つな | Canned tuna | cat-fish | ツナ缶 | – | varies | fish-seafood |
| ing-whitebait | しらす | しらす | Whitebait | cat-fish | ちりめんじゃこ, じゃこ, しらす干し | – | known | fish-seafood |
| ing-bonito-flakes | かつおぶし | かつおぶし | Bonito flakes | cat-fish | かつお節, 鰹節, おかか, 削り節 | – | known | fish-seafood |
| ing-niboshi | 煮干し | にぼし | Dried baby sardines (for stock) | cat-fish | にぼし, いりこ | – | known | fish-seafood |
| ing-salmon-roe | いくら | いくら | Salmon roe | cat-fish | イクラ | alg-salmon-roe | known | fish-seafood |
| ing-salmon-flakes | 鮭フレーク | さけふれーく | Salmon flakes (child of ing-salmon) | cat-fish | さけフレーク, しゃけフレーク, サケフレーク, サーモンフレーク | alg-salmon | varies | fish-seafood |
| ing-tarako | たらこ | たらこ | Pollock roe (tarako) | cat-fish | 鱈子, タラコ | – | varies | fish-seafood |
| ing-shrimp | えび | えび | Shrimp | cat-seafood | エビ, 海老, むきえび, 桜えび | alg-shrimp | known | fish-seafood |
| ing-crab | かに | かに | Crab | cat-seafood | カニ, 蟹 | alg-crab | known | fish-seafood |
| ing-squid | いか | いか | Squid | cat-seafood | イカ, 烏賊 | alg-squid | known | fish-seafood |
| ing-octopus | たこ | たこ | Octopus | cat-seafood | タコ, 蛸 | – | known | fish-seafood |
| ing-clam | あさり | あさり | Manila clam | cat-seafood | アサリ, 浅蜊 | – | known | fish-seafood |
| ing-scallop | ほたて | ほたて | Scallop | cat-seafood | 帆立, ホタテ, ベビーほたて | – | known | fish-seafood |
| ing-oyster | かき（牡蠣） | かき | Oyster | cat-seafood | 牡蠣, カキ | – | known | fish-seafood |
| ing-chikuwa | ちくわ | ちくわ | Chikuwa fish cake | cat-fish-processed | 竹輪, チクワ | – | varies | fish-seafood |
| ing-kamaboko | かまぼこ | かまぼこ | Kamaboko fish cake | cat-fish-processed | 蒲鉾, カマボコ | – | varies | fish-seafood |
| ing-hanpen | はんぺん | はんぺん | Hanpen fish cake | cat-fish-processed | – | – | varies | fish-seafood, egg |
| ing-satsuma-age | さつま揚げ | さつまあげ | Fried fish cake | cat-fish-processed | さつまあげ, 薩摩揚げ | – | varies | fish-seafood |
| ing-crab-stick | カニカマ | かにかま | Crab-flavoured fish stick | cat-fish-processed | かにかま, かに風味かまぼこ | – | varies | fish-seafood |
| ing-sakura-denbu | 桜でんぶ | さくらでんぶ | Sweet pink fish flakes (sakura denbu) | cat-fish-processed | さくらでんぶ, 桜田麩, でんぶ, 田麩 | – | varies | fish-seafood |

Note (research phase 2 prep): `ing-tarako` たらこ is the roe of walleye pollock (スケトウダラ). It is neither いくら (`alg-salmon-roe`) nor さけ, and たら/たらこ are not on the CAA list, so it has no inherent allergen; 明太子 (spiced, a different product) is not a form. It is not a child of `ing-cod`: disliking a cod fillet says nothing about roe. 「たらこ」 beats 「たら」 by longest match. `ing-salmon-flakes` is a child of `ing-salmon` and carries `alg-salmon`; 「鮭フレーク」「さけフレーク」 beat 「鮭」 and the amb-sake form 「さけ」 by longest match. `ing-sakura-denbu` (white fish, typically cod, flaked and sweetened) sits in `cat-fish-processed` like ちくわ, for the same reason (many fish-averse children eat it); 「でんぶ」 alone maps to it. Sources (accessed 2026-10-30): sakura denbu is flaked, sweetened fish meat, mainly sea bream or cod, coloured pink with food colouring (デリッシュキッチン, https://delishkitchen.tv/articles/1482). A Nissui roasted salmon-flake label (https://www.nissui.co.jp/product/00046.html) lists さけ among its allergens, which supports `alg-salmon` on `ing-salmon-flakes`. For `ing-tarako` (pollock roe) and `ing-tortilla` no fetched source could be confirmed in the label round, so their notes stay unsourced (not asserted by a citation).

`ing-chicken-thigh` etc. are children of `ing-chicken`: a child who dislikes 鶏肉 also dislikes 鶏もも肉; an exclusion of `ing-chicken` also excludes its children (BR-06).

### 4.6 Fruit, nuts and seeds
| id | 表記 | よみ | English | category | synonyms | inherent allergens | info | animalOrigin |
|----|------|------|---------|----------|----------|--------------------|------|--------------|
| ing-apple | りんご | りんご | Apple | cat-fruit | リンゴ, 林檎, アップル | alg-apple | known | – |
| ing-banana | バナナ | ばなな | Banana | cat-fruit | – | alg-banana | known | – |
| ing-mandarin | みかん | みかん | Mandarin orange | cat-fruit | ミカン, 蜜柑, 温州みかん, みかん缶 | alg-orange (conservative, see note §4.2) | known | – |
| ing-orange | オレンジ | おれんじ | Orange | cat-fruit | – | alg-orange | known | – |
| ing-grapefruit | グレープフルーツ | ぐれーぷふるーつ | Grapefruit | cat-fruit | – | – | known | – |
| ing-kiwi | キウイ | きうい | Kiwifruit | cat-fruit | キウイフルーツ | alg-kiwi | known | – |
| ing-strawberry | いちご | いちご | Strawberry | cat-fruit | 苺, イチゴ | – | known | – |
| ing-peach | もも（果物） | もも | Peach | cat-fruit | 桃, ピーチ, 黄桃, 白桃 | alg-peach | known | – |
| ing-pineapple | パイナップル | ぱいなっぷる | Pineapple | cat-fruit | パイン | – | known | – |
| ing-grape | ぶどう | ぶどう | Grape | cat-fruit | ブドウ, 葡萄, グレープ, マスカット | – | known | – |
| ing-raisin | レーズン | れーずん | Raisin | cat-fruit | 干しぶどう | – | known | – |
| ing-melon | メロン | めろん | Melon | cat-fruit | – | – | known | – |
| ing-watermelon | すいか | すいか | Watermelon | cat-fruit | 西瓜, スイカ | – | known | – |
| ing-pear | なし（梨） | なし | Japanese pear | cat-fruit | 梨, ナシ, 洋なし, ラ・フランス | – | known | – |
| ing-persimmon | かき（柿） | かき | Persimmon | cat-fruit | 柿, カキ（果物） | – | known | – |
| ing-lemon | レモン | れもん | Lemon | cat-fruit | – | – | known | – |
| ing-sesame | ごま | ごま | Sesame | cat-nuts-seeds | 胡麻, ゴマ, すりごま, いりごま, 白ごま, 黒ごま, ねりごま | alg-sesame | known | – |
| ing-peanut | ピーナッツ | ぴーなっつ | Peanut | cat-nuts-seeds | 落花生, らっかせい, ピーナツ | alg-peanut | known | – |
| ing-walnut | くるみ | くるみ | Walnut | cat-nuts-seeds | クルミ, 胡桃 | alg-walnut | known | – |
| ing-almond | アーモンド | あーもんど | Almond | cat-nuts-seeds | – | alg-almond | known | – |
| ing-cashew | カシューナッツ | かしゅーなっつ | Cashew | cat-nuts-seeds | – | alg-cashew | known | – |

Note: 「カキ」 in katakana belongs to the ambiguity group amb-kaki (§7), not directly to either entry.

### 4.7 Seasonings, sweets, drinks
| id | 表記 | よみ | English | category | synonyms | inherent allergens | info | animalOrigin |
|----|------|------|---------|----------|----------|--------------------|------|--------------|
| ing-soy-sauce | しょうゆ | しょうゆ | Soy sauce | cat-seasoning | 醤油, しょう油, うすくちしょうゆ | – | varies | – |
| ing-miso | みそ | みそ | Miso | cat-seasoning | 味噌, ミソ, 白みそ, 赤みそ | – | varies | – |
| ing-sugar | 砂糖 | さとう | Sugar | cat-seasoning | さとう, 三温糖 | – | known | – |
| ing-salt | 塩 | しお | Salt | cat-seasoning | しお | – | known | – |
| ing-vinegar | 酢 | す | Vinegar | cat-seasoning | 米酢, 穀物酢 | – | varies | – |
| ing-mirin | みりん | みりん | Mirin | cat-seasoning | 本みりん | – | known | – |
| ing-cooking-sake | 酒 | さけ | Cooking sake | cat-seasoning | 料理酒 | – | known | – |
| ing-oil | 油 | あぶら | Cooking oil | cat-seasoning | サラダ油, 植物油, なたね油 | – | known | – |
| ing-sesame-oil | ごま油 | ごまあぶら | Sesame oil | cat-seasoning | – | alg-sesame | known | – |
| ing-mayonnaise | マヨネーズ | まよねーず | Mayonnaise | cat-seasoning | マヨ | – | varies | egg |
| ing-ketchup | ケチャップ | けちゃっぷ | Ketchup | cat-seasoning | トマトケチャップ | – | varies | – |
| ing-worcester-sauce | ソース | そーす | Japanese brown sauce | cat-seasoning | ウスターソース, 中濃ソース, とんかつソース | – | varies | ? |
| ing-curry-roux | カレールウ | かれーるう | Curry roux | cat-seasoning | カレールー | – | varies | meat, pork, beef, chicken, dairy, ? |
| ing-stew-roux | シチュールウ | しちゅーるう | Stew roux | cat-seasoning | シチュールー | – | varies | meat, pork, beef, chicken, dairy, ? |
| ing-curry-powder | カレー粉 | かれーこ | Curry powder | cat-seasoning | カレーパウダー | – | varies | – |
| ing-cumin | クミン | くみん | Cumin | cat-seasoning | クミンシード, クミンパウダー | – | known | – |
| ing-dried-herbs | 乾燥ハーブ | かんそうはーぶ | Dried herbs | cat-seasoning | ドライハーブ | – | varies | – |
| ing-dashi | だし | だし | Dashi stock | cat-seasoning | 出汁, かつおだし, 和風だし | – | varies | fish-seafood, ? |
| ing-consomme | コンソメ | こんそめ | Consommé stock | cat-seasoning | ブイヨン, 洋風だし | – | varies | beef, chicken, pork, ? |
| ing-potato-starch | 片栗粉 | かたくりこ | Potato starch | cat-seasoning | かたくり粉 | – | known | – |
| ing-gelatin | ゼラチン | ぜらちん | Gelatin | cat-sweets | 粉ゼラチン, 板ゼラチン | alg-gelatin | known | gelatin |
| ing-jam | ジャム | じゃむ | Jam | cat-sweets | いちごジャム | – | varies | – |
| ing-honey | はちみつ | はちみつ | Honey | cat-sweets | 蜂蜜, ハチミツ | – | known | – |
| ing-barley-tea | 麦茶 | むぎちゃ | Barley tea | cat-drink | むぎちゃ | – | known | – |

Cumin and dried herbs are seasonings (rule 8). 「ハーブ」 alone is not a form of `ing-dried-herbs` (it may be fresh herbs); it stays unmatched. `ing-tortilla` carries `alg-wheat` (flour tortilla, as used in children's wrap bentos); corn tortillas are not covered by this entry.

Honey: 厚生労働省 advises against honey for infants under 1 year, which is below every age range offered (OQ-12), so the MVP has no honey filter. The research agent cites the MHLW page if a recipe uses honey.

## 5. Dishes
`name ingredients` = ingredients literally named in the dish name (matching rule 4); nothing is inferred from the recipe a school might use.
`definingIngredientId` (H1, OQ-16 collapse narrowed) = the one ingredient that *is* the dish's main food, so that the dish and that ingredient count as one food when both are found in the same lunch item (rule 7a); `null` when the dish has no single defining food (mixed dishes such as 八宝菜, カレーライス, ミックスフライ-type dishes, dressings such as ごまあえ, or variants such as コロッケ). It is always one of the dish's name ingredients (`dish-karaage`: ing-chicken, which the dish adds only when 鶏 is in the name). Coverage: 24 of 55 dishes have a defining ingredient, 31 are null. Validator rule `dict-defining-ingredient` (null or an `ing-` id among the dish's name ingredients).

| id | 表記 | よみ | English | category | synonyms | name ingredients | definingIngredientId |
|----|------|------|---------|----------|----------|------------------|----------------------|
| dish-curry-rice | カレーライス | かれーらいす | Curry and rice | cat-dish-rice | ライスカレー, ポークカレー, チキンカレー, 野菜カレー | ing-rice (+ ing-pork/ing-chicken/cat-vegetable from the variant) | null |
| dish-hayashi-rice | ハヤシライス | はやしらいす | Hashed beef rice | cat-dish-rice | – | ing-rice | null |
| dish-oyakodon | 親子丼 | おやこどん | Chicken and egg rice bowl | cat-dish-rice | おやこどん | – | null |
| dish-gomoku-rice | 五目ごはん | ごもくごはん | Mixed rice | cat-dish-rice | 五目ご飯, 炊き込みごはん, かやくごはん | ing-rice | ing-rice |
| dish-chirashi | ちらし寿司 | ちらしずし | Scattered sushi | cat-dish-rice | ちらしずし, ちらし | – | null |
| dish-onigiri | おにぎり | おにぎり | Rice ball | cat-dish-rice | おむすび | – | null |
| dish-fried-rice | チャーハン | ちゃーはん | Fried rice | cat-dish-rice | 炒飯, 焼き飯, 焼きめし | – | null |
| dish-omurice | オムライス | おむらいす | Omelette rice | cat-dish-rice | – | – | null |
| dish-yakisoba | 焼きそば | やきそば | Fried noodles | cat-dish-noodle | やきそば, ソース焼きそば | ing-chinese-noodles | ing-chinese-noodles |
| dish-yaki-udon | 焼きうどん | やきうどん | Fried udon | cat-dish-noodle | – | ing-udon | ing-udon |
| dish-napolitan | ナポリタン | なぽりたん | Ketchup spaghetti | cat-dish-noodle | スパゲティナポリタン | ing-spaghetti (when named) | ing-spaghetti |
| dish-meat-sauce | ミートソーススパゲティ | みーとそーすすぱげてぃ | Spaghetti with meat sauce | cat-dish-noodle | ミートスパゲティ, ミートソース | ing-spaghetti | ing-spaghetti |
| dish-karaage | からあげ | からあげ | Japanese fried chicken | cat-dish-fried | から揚げ, 唐揚げ, 鶏のから揚げ | (ing-chicken when 鶏 is in the name) | ing-chicken |
| dish-white-fish-fry | 白身魚のフライ | しろみざかなのふらい | Fried white fish | cat-dish-fried | 魚フライ, 白身フライ | ing-white-fish | ing-white-fish |
| dish-croquette | コロッケ | ころっけ | Croquette | cat-dish-fried | ポテトコロッケ, かぼちゃコロッケ | (variant ingredient if named) | null |
| dish-kakiage | かき揚げ | かきあげ | Mixed vegetable tempura | cat-dish-fried | かきあげ | – | null |
| dish-tempura | 天ぷら | てんぷら | Tempura | cat-dish-fried | てんぷら | (named ingredient, e.g. ちくわの天ぷら) | null |
| dish-spring-roll | 春巻き | はるまき | Spring roll | cat-dish-fried | 春巻, はるまき | – | null |
| dish-hamburg | ハンバーグ | はんばーぐ | Hamburg steak | – (main) | 煮込みハンバーグ, 豆腐ハンバーグ | (ing-tofu when named) | null |
| dish-meatball | 肉だんご | にくだんご | Meatballs | – (main) | ミートボール, 肉団子 | – | null |
| dish-teriyaki-chicken | 鶏の照り焼き | とりのてりやき | Teriyaki chicken | – (main) | 照り焼きチキン, チキンの照り焼き | ing-chicken | ing-chicken |
| dish-ginger-pork | 豚のしょうが焼き | ぶたのしょうがやき | Ginger pork | – (main) | しょうが焼き, 生姜焼き | ing-pork, ing-ginger | ing-pork |
| dish-saba-miso | さばのみそ煮 | さばのみそに | Mackerel simmered in miso | cat-dish-simmered | 鯖の味噌煮, さばみそ | ing-mackerel, ing-miso | ing-mackerel |
| dish-salted-salmon | 鮭の塩焼き | さけのしおやき | Salt-grilled salmon | – (main) | さけのしおやき, 焼き鮭 | ing-salmon, ing-salt | ing-salmon |
| dish-tamagoyaki | 卵焼き | たまごやき | Rolled omelette | – (side) | たまご焼き, 玉子焼き, だし巻き卵 | ing-egg | ing-egg |
| dish-gyoza | 餃子 | ぎょうざ | Gyoza dumplings | – (main) | ぎょうざ, ギョーザ, 焼き餃子 | – | null |
| dish-shumai | しゅうまい | しゅうまい | Shumai dumplings | – (main) | シュウマイ, 焼売, シューマイ | – | null |
| dish-mapo-tofu | 麻婆豆腐 | まーぼーどうふ | Mapo tofu (mild) | – (main) | マーボー豆腐, マーボ豆腐 | ing-tofu | ing-tofu |
| dish-happosai | 八宝菜 | はっぽうさい | Stir-fried mixed vegetables | – (main) | – | – | null |
| dish-sweet-sour-pork | 酢豚 | すぶた | Sweet and sour pork | – (main) | すぶた | ing-pork | ing-pork |
| dish-octopus-sausage | たこさんウインナー | たこさんういんなー | Octopus-shaped sausage (no octopus) | – (side) | タコさんウインナー, たこウインナー | ing-sausage | ing-sausage |
| dish-nikujaga | 肉じゃが | にくじゃが | Meat and potato stew | cat-dish-simmered | にくじゃが | ing-potato (+ cat-meat) | null |
| dish-chikuzenni | 筑前煮 | ちくぜんに | Simmered chicken and root vegetables | cat-dish-simmered | がめ煮 | – | null |
| dish-hijiki-nimono | ひじきの煮物 | ひじきのにもの | Simmered hijiki | cat-dish-simmered | ひじき煮, ひじきの煮もの | ing-hijiki | ing-hijiki |
| dish-kiriboshi-nimono | 切り干し大根の煮物 | きりぼしだいこんのにもの | Simmered dried daikon | cat-dish-simmered | 切り干し大根煮 | ing-dried-daikon | ing-dried-daikon |
| dish-kinpira | きんぴらごぼう | きんぴらごぼう | Burdock kinpira | cat-dish-simmered | きんぴら, 金平ごぼう | ing-burdock | ing-burdock |
| dish-pumpkin-nimono | かぼちゃの煮物 | かぼちゃのにもの | Simmered kabocha | cat-dish-simmered | かぼちゃの煮もの, かぼちゃ煮 | ing-pumpkin | ing-pumpkin |
| dish-miso-soup | みそ汁 | みそしる | Miso soup | cat-dish-soup | 味噌汁, おみそしる, おみそ汁 | ing-miso | null |
| dish-clear-soup | すまし汁 | すましじる | Clear soup | cat-dish-soup | おすまし, すましじる | – | null |
| dish-tonjiru | 豚汁 | とんじる | Pork and vegetable miso soup | cat-dish-soup | ぶたじる, とん汁 | ing-pork | ing-pork |
| dish-corn-soup | コーンスープ | こーんすーぷ | Corn soup | cat-dish-soup | コーンポタージュ | ing-corn | ing-corn |
| dish-consomme-soup | コンソメスープ | こんそめすーぷ | Consommé soup | cat-dish-soup | 野菜スープ | ing-consomme | null |
| dish-pot-au-feu | ポトフ | ぽとふ | Pot-au-feu | cat-dish-soup | – | – | null |
| dish-stew | クリームシチュー | くりーむしちゅー | Cream stew | cat-dish-soup | シチュー, ホワイトシチュー | – | null |
| dish-gratin | グラタン | ぐらたん | Gratin | – (main) | マカロニグラタン | (ing-macaroni when named) | null |
| dish-potato-salad | ポテトサラダ | ぽてとさらだ | Potato salad | cat-dish-salad | ポテサラ | ing-potato | ing-potato |
| dish-macaroni-salad | マカロニサラダ | まかろにさらだ | Macaroni salad | cat-dish-salad | – | ing-macaroni | ing-macaroni |
| dish-coleslaw | コールスロー | こーるすろー | Coleslaw | cat-dish-salad | コールスローサラダ | – | null |
| dish-harusame-salad | 春雨サラダ | はるさめさらだ | Glass noodle salad | cat-dish-salad | 中華サラダ | ing-harusame | ing-harusame |
| dish-ohitashi | おひたし | おひたし | Blanched greens with soy dressing | cat-dish-salad | お浸し | (named green, e.g. ほうれん草のおひたし) | null |
| dish-goma-ae | ごまあえ | ごまあえ | Sesame-dressed vegetables | cat-dish-salad | ごま和え, 胡麻和え | ing-sesame | null |
| dish-jelly | ゼリー | ぜりー | Jelly | cat-sweets | フルーツゼリー | (named fruit) | null |
| dish-pudding | プリン | ぷりん | Custard pudding | cat-sweets | – | – | null |
| dish-fruit-punch | フルーツポンチ | ふるーつぽんち | Fruit punch (dessert) | cat-sweets | – | – | null |
| dish-steamed-bread | 蒸しパン | むしぱん | Steamed bun | cat-sweets | むしパン | – | null |

Dish names that combine a named ingredient and a method (「ちくわの磯辺揚げ」「ブロッコリーのおかかあえ」) are not separate entries: the ingredient pass picks up ちくわ, ブロッコリー, おかか. Add a dish entry only when the dish name alone hides its main ingredient or causes a false match (e.g. たこさんウインナー).

## 6. Themes (creative bento themes, profile and recipes)
| id | 表記 | English |
|----|------|---------|
| theme-animals | どうぶつ | Animals |
| theme-dinosaurs | きょうりゅう | Dinosaurs |
| theme-vehicles | のりもの | Vehicles |
| theme-flowers | おはな | Flowers |
| theme-stars | ほし・うちゅう | Stars & space |
| theme-sea | うみのいきもの | Sea creatures |
| theme-seasonal | きせつ・行事 | Seasons & events |
| theme-rainbow | カラフル | Colourful |

No licensed characters (copyright): themes are generic.

## 7. Ambiguity groups (the UI asks; never guess)
| group id | Surface form | Candidates | Automatic resolution (only these) |
|----------|--------------|------------|-----------------------------------|
| amb-curry | カレー | dish-curry-rice, ing-curry-powder (flavour), ing-curry-roux | Longest match first: 「カレーライス」→dish; 「カレー粉」「カレールウ」→ingredient. Followed by 味/風味/炒め/煮 (「カレー炒め」) → ing-curry-powder. Standalone 「カレー」 → ask. |
| amb-aji | あじ / アジ | ing-horse-mackerel, 「味」 (taste suffix, not a food) | Preceded by a seasoning or flavour word (「しおあじ」「みそあじ」「カレーあじ」) → taste suffix, ignored. Kanji 鯵 → fish. Else ask. |
| amb-momo | もも / モモ | ing-peach, ing-chicken-thigh, ing-pork (豚もも) | 「鶏もも」「とりもも」→ ing-chicken-thigh; 「豚もも」→ ing-pork; kanji 桃 → peach. Standalone → ask. |
| amb-nashi | なし | ing-pear, 「無し」 (none) | Directly after a noun (「給食なし」「アレルゲンなし」「〇〇なし」) → "none", ignored as food. Kanji 梨 → pear. Standalone item 「なし」 → ask. |
| amb-kaki | かき / カキ | ing-persimmon, ing-oyster, dish-kakiage | 「かき揚げ」→ dish-kakiage; kanji 柿 → persimmon; 牡蠣 → oyster. Else ask. |
| amb-soba | そば | ing-soba (buckwheat), dish-yakisoba / ing-chinese-noodles | 「焼きそば」「中華そば」「ソース焼きそば」→ wheat noodles (longest match). Standalone 「そば」 or 蕎麦 → ing-soba (buckwheat), but flagged on review because it matters for allergies. |
| amb-tako | たこ / タコ | ing-octopus, dish-octopus-sausage | 「たこさんウインナー」「たこウインナー」 → dish (no octopus). Kanji 蛸 → octopus. Standalone → ing-octopus. |
| amb-sake | さけ / サケ | ing-salmon, ing-cooking-sake | In an ingredient list next to seasonings (「さとう、さけ、しょうゆ」) → ask; in a dish name (「さけのしおやき」) → salmon. Kanji 鮭 → salmon; 酒 → cooking sake. |
| amb-pan | パン | ing-bread, ing-bread-crumbs (パン粉) | Longest match only: 「パン粉」 → bread crumbs; 「フライパン」 is ignored (not a food); else ing-bread. No question needed. |
| amb-imo | いも / 芋 / おいも | ing-potato, ing-sweet-potato, ing-taro, ing-yam | Longest match first: the ingredient forms in §4.1 (「じゃがいも」「じゃが芋」「さつまいも」「さつま芋」「さといも」「里芋」「やまいも」「山芋」「長いも」…) → that ingredient. Standalone 「いも」「芋」「おいも」 (e.g. 「おいものにもの」) → ask. (M1 prep: replaces the category-level form 「いも」 → `cat-potato`.) |

**Asking on review** (M2 prep, US-E4-01/AC6, AC21; data contract §3.3 `resolvedIds`). For an item with an unresolved form, the review offers the group's candidates by their dictionary labels, plus 「わからない」. Two groups also have a **non-food reading**, which has no id: amb-aji 「味」 (taste suffix) and amb-nashi 「無し」 (none). It is offered as its own option and stored as `resolvedIds: []` (no food; the form no longer counts as unresolved). amb-pan never asks; amb-tako and amb-soba resolve automatically (amb-soba is still shown on review because buckwheat matters for allergies).

**Kind labels in the profile pickers** (M2 prep, US-E1-02/AC8). Each search result shows the kind of its entry: ingredient (§4) 「食材」 / "Ingredient", category (§2) 「種類」 / "Food group", dish (§5) 「料理」 / "Dish". Needed because some labels exist at two levels (鶏肉 = `ing-chicken` and `cat-chicken`; 豚肉, 牛肉 and たまご likewise).

## 8. Change process
- Research agents and developers propose new terms in their report (id, 表記, よみ, English, category, synonyms, inherent allergens); the BA adds them here. Ids are never renamed or reused; a retired term keeps its id with `retired: <date>`.
- Validator rules for the JSON version: `id-format` (the general id rule of data contract §2; the earlier name `dict-id-format` is merged into it, M1 prep), `dict-id-unique`, `dict-synonym-unique`, `dict-parent-resolves`, `dict-category-resolves`, `dict-allergen-resolves`, `dict-ambiguity-candidates-resolve`, `dict-animal-origin-valid` (every `ing-` record has `animalOrigin` ⊆ the 8 tags and a boolean `animalOriginKnown`).
- H1 fix round additions (BA, 2026-10-24): `ing-niboshi` 煮干し (B14 hidden source, stock fish) and `ing-stew-roux` シチュールウ (B14 hidden source). Note: in a menu *item* the dish pass matches 「シチュー」 (dish-stew) first, so 「シチュールウ」 is recognised in listed ingredients and recipes, not inside dish names.
- M1 prep changes (BA, 2026-10-24; Developer item in PLAN §7 "M0 done"): categories are **labels only**, with no surface forms (§1 rules 2, 5, 7; §2 note), so `dict-synonym-unique` holds for 鶏肉, 豚肉, 牛肉, たまご and さかな, which stay forms of `ing-chicken`, `ing-pork`, `ing-beef`, `ing-egg` and `ing-fish`. The one category-level form that had no entry, 「いも」, moves to the new ambiguity group `amb-imo` (with 「芋」「おいも」). `dict-id-format` merged into `id-format`. No id changed.
- M2 prep changes (BA, 2026-10-25): amb-momo's third candidate is written as the id `ing-pork` (豚もも); it was the words "pork thigh", which `build-dictionary` cannot turn into an id, so `candidateIds` lacked it. §7 states how review asks and how the non-food readings of amb-aji and amb-nashi are stored. §7 also fixes the picker kind labels. No id added, changed or retired. **`npm run build:dictionary` must be re-run** (generated `data/dictionary.json`).
- Research phase 2 prep (BA, 2026-10-25; requested by the Organisator for recipe research phase 2): 10 new ingredients, no id changed or retired. `ing-tortilla` (4.1, `alg-wheat`, animalOrigin `?`); `ing-black-beans`, `ing-shiso`, `ing-coriander-leaf`, `ing-radish` (4.2); `ing-salmon-flakes` (child of `ing-salmon`, `alg-salmon`), `ing-tarako`, `ing-sakura-denbu` (4.5, `fish-seafood`); `ing-cumin`, `ing-dried-herbs` (4.7, seasonings). Forms left out on purpose to keep one form → one id: 「黒豆」 (black soybean, a different food), bare 「コリアンダー」 (usually the seed spice), 「ハーブ」 (fresh or dried), 「明太子」 (different product), 「トルティージャ」 (also the Spanish omelette). **`npm run build:dictionary` must be re-run.**
