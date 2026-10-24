# Domain dictionary — BentoMinder

Owner: BA · 2026-10-24 · Version **v1 (expandable)** · Status: draft for PO review (H1)

Used by: preference assessment (BR-04, US-E4-01), profile pickers (US-E1-02), allergen and diet filters (BR-06), recipe validation (`docs/ba/data-contract.md` §3.7). The Developer converts these tables into `data/dictionary.json` (one record per row, same ids and fields); this file stays the human-readable source until that file exists, after which changes go through the BA and are mirrored in both.

Scope: v1 covers the dishes and ingredients typical of Japanese kindergarten 給食 menus and of children's bentos: 30 categories and sub-categories, 29 current allergens (+1 retired), 169 ingredients, 55 dishes (224 food terms), 8 themes, 9 ambiguity groups. New terms are added by proposal (id, 表記, よみ, English, category, synonyms) and never by changing an existing id.

## 1. Matching rules (deterministic)
1. **Normalise** both the menu text and every surface form: Unicode NFKC (full/half-width), katakana → hiragana, remove spaces, 「・」 and brackets; keep 「ー」.
2. **One surface form → one id.** Each normalised synonym belongs to exactly one entry, or to one ambiguity group (§7). A form listed in an ambiguity group belongs to the group, not to the candidate entries (e.g. 「さけ」 → amb-sake even though 鮭 → ing-salmon). Text in full-width brackets in the 表記 column (「なし（梨）」) is a display disambiguator, not a surface form; the surface forms are the bare 表記 and the synonyms. Validator rule `dict-synonym-unique`.
3. **Minimum length.** Kana surface forms match only if they have ≥ 2 characters; single-kanji forms (卵, 鮭, 梨…) are allowed.
4. **Dish pass first.** Scan the item left to right with longest match over dish forms. Text covered by a dish match is not rescanned; the dish adds its `name ingredients` (only ingredients literally named in the dish name).
5. **Ingredient pass.** Scan the remaining text, then the listed ingredients of the day, with longest match over ingredient and category forms (e.g. 「切り干し大根」 beats 「大根」, 「ごま油」 beats 「ごま」, 「カニカマ」 beats 「カニ」).
6. **Ambiguity.** A match on an ambiguity-group form is not resolved automatically unless a resolution rule in §7 applies; otherwise it is "unresolved", counts towards `U`, and the review screen asks the parent (US-E4-01/AC6). Typos are never auto-corrected.
7. **Categories.** Liking/disliking a category (e.g. `cat-fish`) matches every ingredient and dish whose category is that category or one of its descendants.
8. **Seasonings do not count** towards D or L unless the child's profile names that exact id.
9. **Allergens are never inferred from the menu.** `inherent allergens` below are used only to validate recipes (`recipe-ingredient-inherent-allergen`) and to label profile pickers; school-menu allergen notices use only what the PDF declares (BR-08).

Column meaning: **inherent allergens** = the food is itself that allergen item (卵 → alg-egg). **info** = `known` (single food) or `varies` (processed food whose allergens depend on the product; recipes must record the label's allergens as `possibleAllergenIds`).

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

**Retired:** `alg-matsutake` まつたけ (removed 2024-03): readable in old data, never offered or written (`allergen-retired`).

Allergen synonyms are used only to map **declared** allergen lines of the menu PDF (「卵・乳・小麦」) to ids; they are a separate index from ingredient synonyms.

## 4. Ingredients
### 4.1 Grains, noodles, potatoes
| id | 表記 | よみ | English | category | synonyms | inherent allergens | info |
|----|------|------|---------|----------|----------|--------------------|------|
| ing-rice | ごはん | ごはん | Cooked rice | cat-grain | ご飯, 白飯, 米, お米, ライス, 白ごはん | – | known |
| ing-rice-flour | 米粉 | こめこ | Rice flour | cat-grain | – | – | varies |
| ing-mixed-grain-rice | 麦ごはん | むぎごはん | Rice with barley | cat-grain | 麦ご飯, 押麦 | – | known |
| ing-bread | パン | ぱん | Bread | cat-grain | 食パン, ロールパン, コッペパン | – | varies |
| ing-wheat-flour | 小麦粉 | こむぎこ | Wheat flour | cat-grain | 薄力粉, 強力粉 | alg-wheat | known |
| ing-bread-crumbs | パン粉 | ぱんこ | Bread crumbs | cat-grain | – | – | varies |
| ing-udon | うどん | うどん | Udon noodles | cat-noodle | ウドン, 饂飩 | alg-wheat | varies |
| ing-soba | そば（蕎麦） | そば | Buckwheat noodles | cat-noodle | 蕎麦, 日本そば | alg-buckwheat | varies |
| ing-chinese-noodles | 中華めん | ちゅうかめん | Chinese-style wheat noodles | cat-noodle | 中華麺, ラーメン, 焼きそばめん | – | varies |
| ing-spaghetti | スパゲティ | すぱげてぃ | Spaghetti | cat-noodle | スパゲッティ, パスタ | alg-wheat | varies |
| ing-macaroni | マカロニ | まかろに | Macaroni | cat-noodle | – | alg-wheat | varies |
| ing-harusame | 春雨 | はるさめ | Glass noodles | cat-noodle | はるさめ, ハルサメ | – | varies |
| ing-potato | じゃがいも | じゃがいも | Potato | cat-potato | ジャガイモ, じゃが芋, 馬鈴薯, ポテト | – | known |
| ing-sweet-potato | さつまいも | さつまいも | Sweet potato | cat-potato | サツマイモ, さつま芋, 薩摩芋 | – | known |
| ing-taro | さといも | さといも | Taro | cat-potato | 里芋, サトイモ | – | known |
| ing-yam | やまいも | やまいも | Japanese yam | cat-potato | 山芋, 長いも, 長芋, ながいも | alg-yam | known |
| ing-konjac | こんにゃく | こんにゃく | Konjac | cat-potato | 蒟蒻, 糸こんにゃく, しらたき | – | known |

`いも` alone maps to the category `cat-potato`, not to one ingredient.

### 4.2 Vegetables
| id | 表記 | よみ | English | category | synonyms | inherent allergens | info |
|----|------|------|---------|----------|----------|--------------------|------|
| ing-carrot | にんじん | にんじん | Carrot | cat-green-vegetable | 人参, ニンジン, キャロット | – | known |
| ing-onion | たまねぎ | たまねぎ | Onion | cat-vegetable | 玉ねぎ, 玉葱, タマネギ, オニオン | – | known |
| ing-cabbage | キャベツ | きゃべつ | Cabbage | cat-leafy-vegetable | – | – | known |
| ing-chinese-cabbage | はくさい | はくさい | Napa cabbage | cat-leafy-vegetable | 白菜, ハクサイ | – | known |
| ing-daikon | だいこん | だいこん | Daikon radish | cat-vegetable | 大根, ダイコン | – | known |
| ing-dried-daikon | 切り干し大根 | きりぼしだいこん | Dried daikon strips | cat-vegetable | 切干大根, 切り干しだいこん | – | known |
| ing-burdock | ごぼう | ごぼう | Burdock root | cat-vegetable | 牛蒡, ゴボウ | – | known |
| ing-lotus-root | れんこん | れんこん | Lotus root | cat-vegetable | 蓮根, レンコン | – | known |
| ing-green-pepper | ピーマン | ぴーまん | Green bell pepper | cat-green-vegetable | – | – | known |
| ing-paprika | パプリカ | ぱぷりか | Red/yellow bell pepper | cat-green-vegetable | 赤ピーマン | – | known |
| ing-eggplant | なす | なす | Eggplant | cat-vegetable | 茄子, ナス, なすび | – | known |
| ing-pumpkin | かぼちゃ | かぼちゃ | Kabocha squash | cat-green-vegetable | 南瓜, カボチャ, パンプキン | – | known |
| ing-broccoli | ブロッコリー | ぶろっこりー | Broccoli | cat-green-vegetable | – | – | known |
| ing-cauliflower | カリフラワー | かりふらわー | Cauliflower | cat-vegetable | – | – | known |
| ing-spinach | ほうれん草 | ほうれんそう | Spinach | cat-leafy-vegetable | ほうれんそう, ホウレンソウ | – | known |
| ing-komatsuna | こまつな | こまつな | Komatsuna | cat-leafy-vegetable | 小松菜, コマツナ | – | known |
| ing-bok-choy | チンゲン菜 | ちんげんさい | Bok choy | cat-leafy-vegetable | チンゲンサイ, 青梗菜 | – | known |
| ing-mizuna | 水菜 | みずな | Mizuna | cat-leafy-vegetable | みずな, ミズナ | – | known |
| ing-shungiku | 春菊 | しゅんぎく | Garland chrysanthemum | cat-leafy-vegetable | しゅんぎく | – | known |
| ing-lettuce | レタス | れたす | Lettuce | cat-leafy-vegetable | – | – | known |
| ing-cucumber | きゅうり | きゅうり | Cucumber | cat-vegetable | 胡瓜, キュウリ | – | known |
| ing-tomato | トマト | とまと | Tomato | cat-green-vegetable | – | – | known |
| ing-cherry-tomato | ミニトマト | みにとまと | Cherry tomato (child of ing-tomato) | cat-green-vegetable | プチトマト | – | known |
| ing-bean-sprouts | もやし | もやし | Bean sprouts | cat-vegetable | モヤシ | – | known |
| ing-green-onion | ねぎ | ねぎ | Green onion / leek | cat-vegetable | 長ねぎ, 青ねぎ, 万能ねぎ, ネギ, 葱 | – | known |
| ing-chinese-chive | にら | にら | Chinese chives | cat-green-vegetable | ニラ, 韮 | – | known |
| ing-corn | とうもろこし | とうもろこし | Corn | cat-vegetable | コーン, スイートコーン, トウモロコシ | – | known |
| ing-edamame | えだまめ | えだまめ | Edamame | cat-vegetable | 枝豆, エダマメ | – (see note) | known |
| ing-green-peas | グリーンピース | ぐりーんぴーす | Green peas | cat-vegetable | グリンピース, えんどう豆 | – | known |
| ing-green-beans | いんげん | いんげん | Green beans | cat-green-vegetable | さやいんげん, インゲン | – | known |
| ing-snow-peas | きぬさや | きぬさや | Snow peas | cat-green-vegetable | 絹さや, さやえんどう | – | known |
| ing-okra | オクラ | おくら | Okra | cat-green-vegetable | – | – | known |
| ing-asparagus | アスパラガス | あすぱらがす | Asparagus | cat-green-vegetable | アスパラ | – | known |
| ing-celery | セロリ | せろり | Celery | cat-vegetable | – | – | known |
| ing-turnip | かぶ | かぶ | Turnip | cat-vegetable | 蕪, カブ | – | known |
| ing-zucchini | ズッキーニ | ずっきーに | Zucchini | cat-vegetable | – | – | known |
| ing-bamboo-shoot | たけのこ | たけのこ | Bamboo shoot | cat-vegetable | 筍, タケノコ | – | known |
| ing-garlic | にんにく | にんにく | Garlic | cat-vegetable | ニンニク, 大蒜 | – | known |
| ing-ginger | しょうが | しょうが | Ginger | cat-vegetable | 生姜, ショウガ | – | known |
| ing-mixed-vegetables | ミックスベジタブル | みっくすべじたぶる | Frozen mixed vegetables | cat-vegetable | – | – | varies |

Note on ing-edamame: edamame are immature soybeans; whether the CAA 大豆 item covers them is **not yet verified**. Until confirmed, recipes with edamame list `alg-soybean` in `possibleAllergenIds` (conservative). Same check pending for みかん vs the CAA オレンジ item (§4.6).

### 4.3 Mushrooms and seaweed
| id | 表記 | よみ | English | category | synonyms | inherent allergens | info |
|----|------|------|---------|----------|----------|--------------------|------|
| ing-shiitake | しいたけ | しいたけ | Shiitake | cat-mushroom | 椎茸, シイタケ, 干ししいたけ | – | known |
| ing-enoki | えのき | えのき | Enoki | cat-mushroom | えのきたけ, エノキ | – | known |
| ing-shimeji | しめじ | しめじ | Shimeji | cat-mushroom | シメジ, ぶなしめじ | – | known |
| ing-maitake | まいたけ | まいたけ | Maitake | cat-mushroom | 舞茸, マイタケ | – | known |
| ing-eringi | エリンギ | えりんぎ | King oyster mushroom | cat-mushroom | – | – | known |
| ing-mushroom | マッシュルーム | まっしゅるーむ | Button mushroom | cat-mushroom | – | – | known |
| ing-hijiki | ひじき | ひじき | Hijiki seaweed | cat-seaweed | 鹿尾菜, ヒジキ, 芽ひじき | – | known |
| ing-wakame | わかめ | わかめ | Wakame | cat-seaweed | 若布, ワカメ | – | known |
| ing-nori | のり | のり | Nori | cat-seaweed | 海苔, 焼きのり, きざみのり, ノリ | – | known |
| ing-aonori | 青のり | あおのり | Green laver flakes | cat-seaweed | あおのり | – | known |
| ing-kombu | こんぶ | こんぶ | Kombu | cat-seaweed | 昆布, 塩こんぶ | – | known |
| ing-agar | 寒天 | かんてん | Agar | cat-seaweed | かんてん | – | known |

### 4.4 Soy, eggs, dairy
| id | 表記 | よみ | English | category | synonyms | inherent allergens | info |
|----|------|------|---------|----------|----------|--------------------|------|
| ing-soybean | 大豆 | だいず | Soybeans | cat-soy | だいず, 水煮大豆 | alg-soybean | known |
| ing-tofu | とうふ | とうふ | Tofu | cat-soy | 豆腐, 木綿豆腐, 絹ごし豆腐 | alg-soybean | known |
| ing-fried-tofu | 油揚げ | あぶらあげ | Fried tofu pouch | cat-soy | 油あげ, あぶらあげ, うす揚げ | alg-soybean | known |
| ing-thick-fried-tofu | 厚揚げ | あつあげ | Thick fried tofu | cat-soy | 生揚げ, あつあげ | alg-soybean | known |
| ing-koya-tofu | 高野豆腐 | こうやどうふ | Freeze-dried tofu | cat-soy | 凍り豆腐 | alg-soybean | known |
| ing-natto | 納豆 | なっとう | Natto | cat-soy | なっとう | alg-soybean | known |
| ing-soy-milk | 豆乳 | とうにゅう | Soy milk | cat-soy | とうにゅう | alg-soybean | varies |
| ing-kinako | きな粉 | きなこ | Roasted soybean flour | cat-soy | きなこ | alg-soybean | known |
| ing-egg | たまご | たまご | Egg | cat-egg | 卵, 玉子, 鶏卵, タマゴ, 全卵 | alg-egg | known |
| ing-quail-egg | うずらの卵 | うずらのたまご | Quail egg | cat-egg | うずら卵, うずらたまご | alg-egg | known |
| ing-milk | 牛乳 | ぎゅうにゅう | Milk | cat-dairy | ミルク, 牛乳（飲用） | alg-milk | known |
| ing-cheese | チーズ | ちーず | Cheese | cat-dairy | とろけるチーズ, 粉チーズ, スライスチーズ | alg-milk | varies |
| ing-yogurt | ヨーグルト | よーぐると | Yogurt | cat-dairy | – | alg-milk | varies |
| ing-butter | バター | ばたー | Butter | cat-dairy | – | alg-milk | known |
| ing-cream | 生クリーム | なまくりーむ | Fresh cream | cat-dairy | – | alg-milk | varies |
| ing-skim-milk | スキムミルク | すきむみるく | Skim milk powder | cat-dairy | 脱脂粉乳 | alg-milk | known |

### 4.5 Meat and fish
| id | 表記 | よみ | English | category | synonyms | inherent allergens | info |
|----|------|------|---------|----------|----------|--------------------|------|
| ing-chicken | 鶏肉 | とりにく | Chicken | cat-chicken | とり肉, とりにく, 鶏, チキン | alg-chicken | known |
| ing-chicken-thigh | 鶏もも肉 | とりももにく | Chicken thigh (child of ing-chicken) | cat-chicken | 鶏もも, とりもも | alg-chicken | known |
| ing-chicken-breast | 鶏むね肉 | とりむねにく | Chicken breast (child of ing-chicken) | cat-chicken | 鶏むね, 鶏胸肉 | alg-chicken | known |
| ing-chicken-tender | ささみ | ささみ | Chicken tenderloin (child of ing-chicken) | cat-chicken | ササミ, 鶏ささみ | alg-chicken | known |
| ing-ground-chicken | 鶏ひき肉 | とりひきにく | Ground chicken (child of ing-chicken) | cat-chicken | 鶏ミンチ, とりひき肉 | alg-chicken | known |
| ing-pork | 豚肉 | ぶたにく | Pork | cat-pork | ぶた肉, 豚, ポーク, 豚こま, 豚ロース | alg-pork | known |
| ing-ground-pork | 豚ひき肉 | ぶたひきにく | Ground pork (child of ing-pork) | cat-pork | 豚ミンチ | alg-pork | known |
| ing-beef | 牛肉 | ぎゅうにく | Beef | cat-beef | 牛こま, ビーフ | alg-beef | known |
| ing-ground-beef | 牛ひき肉 | ぎゅうひきにく | Ground beef (child of ing-beef) | cat-beef | 牛ミンチ | alg-beef | known |
| ing-ground-mixed | 合いびき肉 | あいびきにく | Ground beef & pork | cat-beef, cat-pork | あいびき肉, 合挽肉 | alg-beef, alg-pork | known |
| ing-ground-meat | ひき肉 | ひきにく | Ground meat (species not stated) | cat-meat | 挽肉, ミンチ | – | varies |
| ing-ham | ハム | はむ | Ham | cat-meat-processed | ロースハム | – | varies |
| ing-sausage | ウインナー | ういんなー | Sausage / wiener | cat-meat-processed | ウィンナー, ソーセージ, ウインナーソーセージ | – | varies |
| ing-bacon | ベーコン | べーこん | Bacon | cat-meat-processed | – | – | varies |
| ing-fish | 魚 | さかな | Fish (unspecified) | cat-fish | さかな, お魚 | – | known |
| ing-white-fish | 白身魚 | しろみざかな | White fish (unspecified) | cat-fish | 白身, ホキ, メルルーサ | – | known |
| ing-salmon | さけ | さけ | Salmon | cat-fish | 鮭, しゃけ, サケ, サーモン, 銀鮭 | alg-salmon | known |
| ing-mackerel | さば | さば | Mackerel | cat-fish | 鯖, サバ | alg-mackerel | known |
| ing-cod | たら | たら | Cod | cat-fish | 鱈, タラ | – | known |
| ing-yellowtail | ぶり | ぶり | Yellowtail | cat-fish | 鰤, ブリ | – | known |
| ing-horse-mackerel | あじ（鯵） | あじ | Horse mackerel | cat-fish | 鯵, アジ | – | known |
| ing-spanish-mackerel | さわら | さわら | Japanese Spanish mackerel | cat-fish | 鰆, サワラ | – | known |
| ing-saury | さんま | さんま | Pacific saury | cat-fish | 秋刀魚, サンマ | – | known |
| ing-sardine | いわし | いわし | Sardine | cat-fish | 鰯, イワシ | – | known |
| ing-shishamo | ししゃも | ししゃも | Shishamo smelt | cat-fish | シシャモ, 柳葉魚 | – | known |
| ing-tuna | まぐろ | まぐろ | Tuna | cat-fish | 鮪, マグロ | – | known |
| ing-canned-tuna | ツナ | つな | Canned tuna | cat-fish | ツナ缶 | – | varies |
| ing-whitebait | しらす | しらす | Whitebait | cat-fish | ちりめんじゃこ, じゃこ, しらす干し | – | known |
| ing-bonito-flakes | かつおぶし | かつおぶし | Bonito flakes | cat-fish | かつお節, 鰹節, おかか, 削り節 | – | known |
| ing-salmon-roe | いくら | いくら | Salmon roe | cat-fish | イクラ | alg-salmon-roe | known |
| ing-shrimp | えび | えび | Shrimp | cat-seafood | エビ, 海老, むきえび, 桜えび | alg-shrimp | known |
| ing-crab | かに | かに | Crab | cat-seafood | カニ, 蟹 | alg-crab | known |
| ing-squid | いか | いか | Squid | cat-seafood | イカ, 烏賊 | alg-squid | known |
| ing-octopus | たこ | たこ | Octopus | cat-seafood | タコ, 蛸 | – | known |
| ing-clam | あさり | あさり | Manila clam | cat-seafood | アサリ, 浅蜊 | – | known |
| ing-scallop | ほたて | ほたて | Scallop | cat-seafood | 帆立, ホタテ, ベビーほたて | – | known |
| ing-oyster | かき（牡蠣） | かき | Oyster | cat-seafood | 牡蠣, カキ | – | known |
| ing-chikuwa | ちくわ | ちくわ | Chikuwa fish cake | cat-fish-processed | 竹輪, チクワ | – | varies |
| ing-kamaboko | かまぼこ | かまぼこ | Kamaboko fish cake | cat-fish-processed | 蒲鉾, カマボコ | – | varies |
| ing-hanpen | はんぺん | はんぺん | Hanpen fish cake | cat-fish-processed | – | – | varies |
| ing-satsuma-age | さつま揚げ | さつまあげ | Fried fish cake | cat-fish-processed | さつまあげ, 薩摩揚げ | – | varies |
| ing-crab-stick | カニカマ | かにかま | Crab-flavoured fish stick | cat-fish-processed | かにかま, かに風味かまぼこ | – | varies |

`ing-chicken-thigh` etc. are children of `ing-chicken`: a child who dislikes 鶏肉 also dislikes 鶏もも肉; an exclusion of `ing-chicken` also excludes its children (BR-06).

### 4.6 Fruit, nuts and seeds
| id | 表記 | よみ | English | category | synonyms | inherent allergens | info |
|----|------|------|---------|----------|----------|--------------------|------|
| ing-apple | りんご | りんご | Apple | cat-fruit | リンゴ, 林檎, アップル | alg-apple | known |
| ing-banana | バナナ | ばなな | Banana | cat-fruit | – | alg-banana | known |
| ing-mandarin | みかん | みかん | Mandarin orange | cat-fruit | ミカン, 蜜柑, 温州みかん, みかん缶 | – (see note §4.2) | known |
| ing-orange | オレンジ | おれんじ | Orange | cat-fruit | – | alg-orange | known |
| ing-grapefruit | グレープフルーツ | ぐれーぷふるーつ | Grapefruit | cat-fruit | – | – | known |
| ing-kiwi | キウイ | きうい | Kiwifruit | cat-fruit | キウイフルーツ | alg-kiwi | known |
| ing-strawberry | いちご | いちご | Strawberry | cat-fruit | 苺, イチゴ | – | known |
| ing-peach | もも（果物） | もも | Peach | cat-fruit | 桃, ピーチ, 黄桃, 白桃 | alg-peach | known |
| ing-pineapple | パイナップル | ぱいなっぷる | Pineapple | cat-fruit | パイン | – | known |
| ing-grape | ぶどう | ぶどう | Grape | cat-fruit | ブドウ, 葡萄, グレープ, マスカット | – | known |
| ing-raisin | レーズン | れーずん | Raisin | cat-fruit | 干しぶどう | – | known |
| ing-melon | メロン | めろん | Melon | cat-fruit | – | – | known |
| ing-watermelon | すいか | すいか | Watermelon | cat-fruit | 西瓜, スイカ | – | known |
| ing-pear | なし（梨） | なし | Japanese pear | cat-fruit | 梨, ナシ, 洋なし, ラ・フランス | – | known |
| ing-persimmon | かき（柿） | かき | Persimmon | cat-fruit | 柿, カキ（果物） | – | known |
| ing-lemon | レモン | れもん | Lemon | cat-fruit | – | – | known |
| ing-sesame | ごま | ごま | Sesame | cat-nuts-seeds | 胡麻, ゴマ, すりごま, いりごま, 白ごま, 黒ごま, ねりごま | alg-sesame | known |
| ing-peanut | ピーナッツ | ぴーなっつ | Peanut | cat-nuts-seeds | 落花生, らっかせい, ピーナツ | alg-peanut | known |
| ing-walnut | くるみ | くるみ | Walnut | cat-nuts-seeds | クルミ, 胡桃 | alg-walnut | known |
| ing-almond | アーモンド | あーもんど | Almond | cat-nuts-seeds | – | alg-almond | known |
| ing-cashew | カシューナッツ | かしゅーなっつ | Cashew | cat-nuts-seeds | – | alg-cashew | known |

Note: 「カキ」 in katakana belongs to the ambiguity group amb-kaki (§7), not directly to either entry.

### 4.7 Seasonings, sweets, drinks
| id | 表記 | よみ | English | category | synonyms | inherent allergens | info |
|----|------|------|---------|----------|----------|--------------------|------|
| ing-soy-sauce | しょうゆ | しょうゆ | Soy sauce | cat-seasoning | 醤油, しょう油, うすくちしょうゆ | – | varies |
| ing-miso | みそ | みそ | Miso | cat-seasoning | 味噌, ミソ, 白みそ, 赤みそ | – | varies |
| ing-sugar | 砂糖 | さとう | Sugar | cat-seasoning | さとう, 三温糖 | – | known |
| ing-salt | 塩 | しお | Salt | cat-seasoning | しお | – | known |
| ing-vinegar | 酢 | す | Vinegar | cat-seasoning | 米酢, 穀物酢 | – | varies |
| ing-mirin | みりん | みりん | Mirin | cat-seasoning | 本みりん | – | known |
| ing-cooking-sake | 酒 | さけ | Cooking sake | cat-seasoning | 料理酒 | – | known |
| ing-oil | 油 | あぶら | Cooking oil | cat-seasoning | サラダ油, 植物油, なたね油 | – | known |
| ing-sesame-oil | ごま油 | ごまあぶら | Sesame oil | cat-seasoning | – | alg-sesame | known |
| ing-mayonnaise | マヨネーズ | まよねーず | Mayonnaise | cat-seasoning | マヨ | – | varies |
| ing-ketchup | ケチャップ | けちゃっぷ | Ketchup | cat-seasoning | トマトケチャップ | – | varies |
| ing-worcester-sauce | ソース | そーす | Japanese brown sauce | cat-seasoning | ウスターソース, 中濃ソース, とんかつソース | – | varies |
| ing-curry-roux | カレールウ | かれーるう | Curry roux | cat-seasoning | カレールー | – | varies |
| ing-curry-powder | カレー粉 | かれーこ | Curry powder | cat-seasoning | カレーパウダー | – | varies |
| ing-dashi | だし | だし | Dashi stock | cat-seasoning | 出汁, かつおだし, 和風だし | – | varies |
| ing-consomme | コンソメ | こんそめ | Consommé stock | cat-seasoning | ブイヨン, 洋風だし | – | varies |
| ing-potato-starch | 片栗粉 | かたくりこ | Potato starch | cat-seasoning | かたくり粉 | – | known |
| ing-gelatin | ゼラチン | ぜらちん | Gelatin | cat-sweets | 粉ゼラチン, 板ゼラチン | alg-gelatin | known |
| ing-jam | ジャム | じゃむ | Jam | cat-sweets | いちごジャム | – | varies |
| ing-honey | はちみつ | はちみつ | Honey | cat-sweets | 蜂蜜, ハチミツ | – | known |
| ing-barley-tea | 麦茶 | むぎちゃ | Barley tea | cat-drink | むぎちゃ | – | known |

Honey: 厚生労働省 advises against honey for infants under 1 year, which is below every age range offered (OQ-12), so the MVP has no honey filter. The research agent cites the MHLW page if a recipe uses honey.

## 5. Dishes
`name ingredients` = ingredients literally named in the dish name (matching rule 4); nothing is inferred from the recipe a school might use.

| id | 表記 | よみ | English | category | synonyms | name ingredients |
|----|------|------|---------|----------|----------|------------------|
| dish-curry-rice | カレーライス | かれーらいす | Curry and rice | cat-dish-rice | ライスカレー, ポークカレー, チキンカレー, 野菜カレー | ing-rice (+ ing-pork/ing-chicken/cat-vegetable from the variant) |
| dish-hayashi-rice | ハヤシライス | はやしらいす | Hashed beef rice | cat-dish-rice | – | ing-rice |
| dish-oyakodon | 親子丼 | おやこどん | Chicken and egg rice bowl | cat-dish-rice | おやこどん | – |
| dish-gomoku-rice | 五目ごはん | ごもくごはん | Mixed rice | cat-dish-rice | 五目ご飯, 炊き込みごはん, かやくごはん | ing-rice |
| dish-chirashi | ちらし寿司 | ちらしずし | Scattered sushi | cat-dish-rice | ちらしずし, ちらし | – |
| dish-onigiri | おにぎり | おにぎり | Rice ball | cat-dish-rice | おむすび | – |
| dish-fried-rice | チャーハン | ちゃーはん | Fried rice | cat-dish-rice | 炒飯, 焼き飯, 焼きめし | – |
| dish-omurice | オムライス | おむらいす | Omelette rice | cat-dish-rice | – | – |
| dish-yakisoba | 焼きそば | やきそば | Fried noodles | cat-dish-noodle | やきそば, ソース焼きそば | ing-chinese-noodles |
| dish-yaki-udon | 焼きうどん | やきうどん | Fried udon | cat-dish-noodle | – | ing-udon |
| dish-napolitan | ナポリタン | なぽりたん | Ketchup spaghetti | cat-dish-noodle | スパゲティナポリタン | ing-spaghetti (when named) |
| dish-meat-sauce | ミートソーススパゲティ | みーとそーすすぱげてぃ | Spaghetti with meat sauce | cat-dish-noodle | ミートスパゲティ, ミートソース | ing-spaghetti |
| dish-karaage | からあげ | からあげ | Japanese fried chicken | cat-dish-fried | から揚げ, 唐揚げ, 鶏のから揚げ | (ing-chicken when 鶏 is in the name) |
| dish-white-fish-fry | 白身魚のフライ | しろみざかなのふらい | Fried white fish | cat-dish-fried | 魚フライ, 白身フライ | ing-white-fish |
| dish-croquette | コロッケ | ころっけ | Croquette | cat-dish-fried | ポテトコロッケ, かぼちゃコロッケ | (variant ingredient if named) |
| dish-kakiage | かき揚げ | かきあげ | Mixed vegetable tempura | cat-dish-fried | かきあげ | – |
| dish-tempura | 天ぷら | てんぷら | Tempura | cat-dish-fried | てんぷら | (named ingredient, e.g. ちくわの天ぷら) |
| dish-spring-roll | 春巻き | はるまき | Spring roll | cat-dish-fried | 春巻, はるまき | – |
| dish-hamburg | ハンバーグ | はんばーぐ | Hamburg steak | – (main) | 煮込みハンバーグ, 豆腐ハンバーグ | (ing-tofu when named) |
| dish-meatball | 肉だんご | にくだんご | Meatballs | – (main) | ミートボール, 肉団子 | – |
| dish-teriyaki-chicken | 鶏の照り焼き | とりのてりやき | Teriyaki chicken | – (main) | 照り焼きチキン, チキンの照り焼き | ing-chicken |
| dish-ginger-pork | 豚のしょうが焼き | ぶたのしょうがやき | Ginger pork | – (main) | しょうが焼き, 生姜焼き | ing-pork, ing-ginger |
| dish-saba-miso | さばのみそ煮 | さばのみそに | Mackerel simmered in miso | cat-dish-simmered | 鯖の味噌煮, さばみそ | ing-mackerel, ing-miso |
| dish-salted-salmon | 鮭の塩焼き | さけのしおやき | Salt-grilled salmon | – (main) | さけのしおやき, 焼き鮭 | ing-salmon, ing-salt |
| dish-tamagoyaki | 卵焼き | たまごやき | Rolled omelette | – (side) | たまご焼き, 玉子焼き, だし巻き卵 | ing-egg |
| dish-gyoza | 餃子 | ぎょうざ | Gyoza dumplings | – (main) | ぎょうざ, ギョーザ, 焼き餃子 | – |
| dish-shumai | しゅうまい | しゅうまい | Shumai dumplings | – (main) | シュウマイ, 焼売, シューマイ | – |
| dish-mapo-tofu | 麻婆豆腐 | まーぼーどうふ | Mapo tofu (mild) | – (main) | マーボー豆腐, マーボ豆腐 | ing-tofu |
| dish-happosai | 八宝菜 | はっぽうさい | Stir-fried mixed vegetables | – (main) | – | – |
| dish-sweet-sour-pork | 酢豚 | すぶた | Sweet and sour pork | – (main) | すぶた | ing-pork |
| dish-octopus-sausage | たこさんウインナー | たこさんういんなー | Octopus-shaped sausage (no octopus) | – (side) | タコさんウインナー, たこウインナー | ing-sausage |
| dish-nikujaga | 肉じゃが | にくじゃが | Meat and potato stew | cat-dish-simmered | にくじゃが | ing-potato (+ cat-meat) |
| dish-chikuzenni | 筑前煮 | ちくぜんに | Simmered chicken and root vegetables | cat-dish-simmered | がめ煮 | – |
| dish-hijiki-nimono | ひじきの煮物 | ひじきのにもの | Simmered hijiki | cat-dish-simmered | ひじき煮, ひじきの煮もの | ing-hijiki |
| dish-kiriboshi-nimono | 切り干し大根の煮物 | きりぼしだいこんのにもの | Simmered dried daikon | cat-dish-simmered | 切り干し大根煮 | ing-dried-daikon |
| dish-kinpira | きんぴらごぼう | きんぴらごぼう | Burdock kinpira | cat-dish-simmered | きんぴら, 金平ごぼう | ing-burdock |
| dish-pumpkin-nimono | かぼちゃの煮物 | かぼちゃのにもの | Simmered kabocha | cat-dish-simmered | かぼちゃの煮もの, かぼちゃ煮 | ing-pumpkin |
| dish-miso-soup | みそ汁 | みそしる | Miso soup | cat-dish-soup | 味噌汁, おみそしる, おみそ汁 | ing-miso |
| dish-clear-soup | すまし汁 | すましじる | Clear soup | cat-dish-soup | おすまし, すましじる | – |
| dish-tonjiru | 豚汁 | とんじる | Pork and vegetable miso soup | cat-dish-soup | ぶたじる, とん汁 | ing-pork |
| dish-corn-soup | コーンスープ | こーんすーぷ | Corn soup | cat-dish-soup | コーンポタージュ | ing-corn |
| dish-consomme-soup | コンソメスープ | こんそめすーぷ | Consommé soup | cat-dish-soup | 野菜スープ | ing-consomme |
| dish-pot-au-feu | ポトフ | ぽとふ | Pot-au-feu | cat-dish-soup | – | – |
| dish-stew | クリームシチュー | くりーむしちゅー | Cream stew | cat-dish-soup | シチュー, ホワイトシチュー | – |
| dish-gratin | グラタン | ぐらたん | Gratin | – (main) | マカロニグラタン | (ing-macaroni when named) |
| dish-potato-salad | ポテトサラダ | ぽてとさらだ | Potato salad | cat-dish-salad | ポテサラ | ing-potato |
| dish-macaroni-salad | マカロニサラダ | まかろにさらだ | Macaroni salad | cat-dish-salad | – | ing-macaroni |
| dish-coleslaw | コールスロー | こーるすろー | Coleslaw | cat-dish-salad | コールスローサラダ | – |
| dish-harusame-salad | 春雨サラダ | はるさめさらだ | Glass noodle salad | cat-dish-salad | 中華サラダ | ing-harusame |
| dish-ohitashi | おひたし | おひたし | Blanched greens with soy dressing | cat-dish-salad | お浸し | (named green, e.g. ほうれん草のおひたし) |
| dish-goma-ae | ごまあえ | ごまあえ | Sesame-dressed vegetables | cat-dish-salad | ごま和え, 胡麻和え | ing-sesame |
| dish-jelly | ゼリー | ぜりー | Jelly | cat-sweets | フルーツゼリー | (named fruit) |
| dish-pudding | プリン | ぷりん | Custard pudding | cat-sweets | – | – |
| dish-fruit-punch | フルーツポンチ | ふるーつぽんち | Fruit punch (dessert) | cat-sweets | – | – |
| dish-steamed-bread | 蒸しパン | むしぱん | Steamed bun | cat-sweets | むしパン | – |

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
| amb-momo | もも / モモ | ing-peach, ing-chicken-thigh, pork thigh | 「鶏もも」「とりもも」→ ing-chicken-thigh; 「豚もも」→ ing-pork; kanji 桃 → peach. Standalone → ask. |
| amb-nashi | なし | ing-pear, 「無し」 (none) | Directly after a noun (「給食なし」「アレルゲンなし」「〇〇なし」) → "none", ignored as food. Kanji 梨 → pear. Standalone item 「なし」 → ask. |
| amb-kaki | かき / カキ | ing-persimmon, ing-oyster, dish-kakiage | 「かき揚げ」→ dish-kakiage; kanji 柿 → persimmon; 牡蠣 → oyster. Else ask. |
| amb-soba | そば | ing-soba (buckwheat), dish-yakisoba / ing-chinese-noodles | 「焼きそば」「中華そば」「ソース焼きそば」→ wheat noodles (longest match). Standalone 「そば」 or 蕎麦 → ing-soba (buckwheat), but flagged on review because it matters for allergies. |
| amb-tako | たこ / タコ | ing-octopus, dish-octopus-sausage | 「たこさんウインナー」「たこウインナー」 → dish (no octopus). Kanji 蛸 → octopus. Standalone → ing-octopus. |
| amb-sake | さけ / サケ | ing-salmon, ing-cooking-sake | In an ingredient list next to seasonings (「さとう、さけ、しょうゆ」) → ask; in a dish name (「さけのしおやき」) → salmon. Kanji 鮭 → salmon; 酒 → cooking sake. |
| amb-pan | パン | ing-bread, ing-bread-crumbs (パン粉) | Longest match only: 「パン粉」 → bread crumbs; 「フライパン」 is ignored (not a food); else ing-bread. No question needed. |

## 8. Change process
- Research agents and developers propose new terms in their report (id, 表記, よみ, English, category, synonyms, inherent allergens); the BA adds them here. Ids are never renamed or reused; a retired term keeps its id with `retired: <date>`.
- Validator rules for the JSON version: `dict-id-format`, `dict-id-unique`, `dict-synonym-unique`, `dict-parent-resolves`, `dict-category-resolves`, `dict-allergen-resolves`, `dict-ambiguity-candidates-resolve`.
