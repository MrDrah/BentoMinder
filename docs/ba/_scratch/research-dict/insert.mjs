import fs from 'node:fs';
const p = 'C:/Projects/BentoMinder/docs/ba/domain-dictionary.md';
let s = fs.readFileSync(p, 'utf8');
function ins(prefix, rows) {
  const i = s.indexOf(prefix); if (i < 0) throw new Error(prefix);
  const j = s.indexOf('\n', i) + 1;
  s = s.slice(0, j) + rows + s.slice(j);
}
ins('| ing-bread-crumbs |','| ing-tortilla | トルティーヤ | とるてぃーや | Wheat flour tortilla | cat-grain | トルティーア, トルティア, フラワートルティーヤ | alg-wheat | varies | ? |\n');
ins('| ing-green-peas |','| ing-black-beans | 黒いんげん豆 | くろいんげんまめ | Black beans (black kidney beans; not 黒豆 black soybeans) | cat-vegetable | 黒インゲン豆, 黒いんげん, ブラックビーンズ, ブラックビーン | – | known | – |\n');
ins('| ing-ginger |','| ing-shiso | 青じそ | あおじそ | Green shiso (perilla leaf) | cat-leafy-vegetable | 大葉, おおば, オオバ, 青ジソ, 青紫蘇, しそ, シソ, 紫蘇 | – | known | – |\n| ing-coriander-leaf | パクチー | ぱくちー | Coriander leaf (cilantro) | cat-leafy-vegetable | 香菜, シャンツァイ, コリアンダーの葉, コリアンダーリーフ | – | known | – |\n| ing-radish | ラディッシュ | らでぃっしゅ | Radish (small red) | cat-vegetable | 二十日大根, はつかだいこん, ハツカダイコン | – | known | – |\n');
ins('| ing-salmon-roe |','| ing-salmon-flakes | 鮭フレーク | さけふれーく | Salmon flakes (child of ing-salmon) | cat-fish | さけフレーク, しゃけフレーク, サケフレーク, サーモンフレーク | alg-salmon | varies | fish-seafood |\n| ing-tarako | たらこ | たらこ | Pollock roe (tarako) | cat-fish | 鱈子, タラコ | – | varies | fish-seafood |\n');
ins('| ing-crab-stick |','| ing-sakura-denbu | 桜でんぶ | さくらでんぶ | Sweet pink fish flakes (sakura denbu) | cat-fish-processed | さくらでんぶ, 桜田麩, でんぶ, 田麩 | – | varies | fish-seafood |\n');
ins('| ing-curry-powder |','| ing-cumin | クミン | くみん | Cumin | cat-seasoning | クミンシード, クミンパウダー | – | known | – |\n| ing-dried-herbs | 乾燥ハーブ | かんそうはーぶ | Dried herbs | cat-seasoning | ドライハーブ | – | varies | – |\n');
fs.writeFileSync(p, s);
