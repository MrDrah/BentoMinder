#!/usr/bin/env node
// One-time mapping recipe id -> dishType for batch-a..h (US-E17-01), chosen from each recipe's name,
// description and ingredients (closest of the 18 illustration types). Reviewable table; new batches carry
// their own `dishType` in the record. `node scripts/dish-type-map.mjs` writes the field into batch-a..h
// (after `style`) and is idempotent; it never touches other batch files.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DISH_TYPE_MAP = {
  'rcp-nhk-sake-teriyaki-bento': 'grilled-fish',
  'rcp-kikkoman-sake-hamburg-bento': 'meat-patty',
  'rcp-delish-niwatori-hiyoko-onigiri': 'onigiri',
  'rcp-kikkoman-tuna-tamago-soboro-bento': 'rice-bowl',
  'rcp-delish-himawari-bento': 'other',
  'rcp-nhk-ohanabatake-bento': 'rice-bowl',
  'rcp-delish-penguin-seiretsu-bento': 'onigiri',
  'rcp-kikkoman-niku-yasaimaki-bento': 'meat-roll',
  'rcp-delish-yaki-oyakodon-bento': 'rice-bowl',
  'rcp-kikkoman-sanshoku-mini-onigiri-bento': 'onigiri',
  'rcp-kikkoman-tori-tamago-onigiri-bento': 'onigiri',
  'rcp-delish-penguin-onigirazu-bento': 'onigiri',
  'rcp-kikkoman-omurice-bento': 'egg',
  'rcp-kikkoman-buta-ketchup-bento': 'simmered',
  'rcp-nhk-juicy-hamburg-bento': 'meat-patty',
  'rcp-kikkoman-youfuu-makizushi-bento': 'meat-roll',
  'rcp-delish-kuma-usagi-sandwich': 'sandwich',
  'rcp-bbc-black-bean-quesadilla': 'sandwich',
  'rcp-house-hajimete-curry-chahan': 'rice-bowl',
  'rcp-joc-tamago-sando-bento': 'sandwich',
  'rcp-nhk-chicken-soboro-bento': 'rice-bowl',
  'rcp-delish-panda-onigiri': 'onigiri',
  'rcp-delish-niku-maki-onigiri-stick': 'onigiri',
  'rcp-nhk-salmon-shimeji-teriyaki-bento': 'grilled-fish',
  'rcp-delish-corn-edamame-mixed-rice': 'rice-bowl',
  'rcp-delish-sasami-karaage-nori-bento': 'fried-chicken',
  'rcp-delish-reindeer-bento': 'onigiri',
  'rcp-nhk-frozen-egg-sandwich-bento': 'sandwich',
  'rcp-kikkoman-potato-croquette-bento': 'fritter',
  'rcp-kikkoman-butahire-panko-bento': 'fried-chicken',
  'rcp-delish-kumahiyo-bento': 'onigiri',
  'rcp-delish-5min-microwave-bento': 'egg',
  'rcp-nhk-curry-soboro-musubi': 'onigiri',
  'rcp-delish-wafu-keema-curry-bento': 'rice-bowl',
  'rcp-delish-donguri-onigiri': 'onigiri',
  'rcp-delish-broccoli-mazegohan': 'rice-bowl',
  'rcp-delish-yakiudon-bento': 'noodles',
  'rcp-delish-yofu-soboro-bento': 'rice-bowl',
  'rcp-delish-flower-bento': 'egg',
  'rcp-kikkoman-asupara-cheese-maki-bento': 'meat-roll',
  'rcp-bbc-hoisin-wraps': 'sandwich',
  'rcp-delish-tamagoyaki-5min-bento': 'egg',
  'rcp-kikkoman-mini-hamburg-bento': 'meat-patty',
  'rcp-kikkoman-tori-tsukune-bento': 'meat-patty',
  'rcp-delish-sake-soboro-mosaic-bento': 'rice-bowl',
  'rcp-delish-undokai-ouen-onigiri': 'onigiri',
  'rcp-nhk-jako-onigiri-misoni-plate': 'onigiri',
  'rcp-nhk-sabakan-onigiri': 'onigiri',
  'rcp-kikkoman-ebi-harumaki-bento': 'fritter',
  'rcp-delish-kuma-hamburg': 'meat-patty',
  'rcp-delish-chicken-wrap-sandwich': 'sandwich',
  'rcp-delish-taco-rice-bento': 'rice-bowl',
  'rcp-delish-kirin-tamagoyaki-deco-bento': 'egg',
  'rcp-delish-range-shumai-bento': 'dumpling',
  'rcp-bbc-veggie-olive-wrap': 'sandwich',
  'rcp-nhk-yasai-yakisoba-bento': 'noodles',
  'rcp-bbc-lunchbox-pasta-salad': 'salad',
  'rcp-delish-soboro-mille-bento': 'rice-bowl',
  'rcp-delish-kuma-kazarimaki': 'meat-roll',
  'rcp-delish-gyudon-bento': 'rice-bowl',
  'rcp-delish-halloween-pumpkin-bento': 'onigiri',
  'rcp-delish-snowman-meatball-bento': 'onigiri',
  'rcp-delish-nasigoreng-style-bento': 'rice-bowl',
  'rcp-nhk-sake-bento': 'grilled-fish',
  'rcp-nhk-kajiki-mayo-steak-bento': 'grilled-fish',
  'rcp-delish-satsumaimo-chicken-bento': 'simmered',
  'rcp-delish-halloween-ghost-bento': 'onigiri',
  'rcp-bbc-coronation-chickpea-sandwich': 'sandwich',
  'rcp-bbc-summer-couscous-salad': 'salad',
  'rcp-delish-soboro-edamame-gohan': 'rice-bowl',
  'rcp-kikkoman-takenoko-tsukune-bento': 'meat-patty',
  'rcp-delish-neko-kinoko-inari': 'onigiri',
  'rcp-delish-satsumaimo-gohan-bento': 'rice-bowl',
  'rcp-kikkoman-mini-kakiage-bento': 'fritter',
  'rcp-nhk-napolitan-bento': 'noodles',
  'rcp-kikkoman-cornball-bento': 'fritter',
  'rcp-delish-cafe-sandwich-bento': 'sandwich',
  'rcp-delish-hanabatake-lion': 'rice-bowl',
  'rcp-delish-renchin-khaomangai-bento': 'rice-bowl',
  'rcp-bbc-falafel-lunchbox': 'salad',
  'rcp-nhk-buta-enoki-amakara-youji': 'meat-roll',
  'rcp-delish-kuma-nugget': 'fried-chicken',
  'rcp-delish-2shoku-soboro-bento': 'rice-bowl',
  'rcp-delish-soccer-ball-onigiri-bento': 'onigiri',
  'rcp-delish-inari-zukinchan-bento': 'onigiri',
  'rcp-delish-nanohana-ebi-onigiri': 'onigiri',
  'rcp-nhk-jako-yasai-pasta-bento': 'noodles',
  'rcp-delish-nyugakushiki-bento': 'rice-bowl',
  'rcp-nhk-kankoku-norimaki-bento': 'meat-roll',
  'rcp-bbc-super-salad-wraps': 'sandwich',
  'rcp-kikkoman-kitsune-tsukune-sand-bento': 'sandwich',
  'rcp-kikkoman-hitokuchi-menchikatsu-bento': 'fried-chicken',
};

/** Batches covered by the one-time mapping (batch-i and later carry their own dishType). */
export const MAPPED_BATCHES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

function main() {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', '_research');
  const seen = new Set();
  for (const b of MAPPED_BATCHES) {
    const file = join(dir, `batch-${b}.json`);
    const doc = JSON.parse(readFileSync(file, 'utf8'));
    const out = doc.map((r) => {
      const type = DISH_TYPE_MAP[r.id];
      if (type === undefined) throw new Error(`no dishType mapped for ${r.id}`);
      seen.add(r.id);
      const next = {};
      for (const [k, v] of Object.entries(r)) {
        if (k === 'dishType') continue;
        next[k] = v;
        if (k === 'style') next.dishType = type;
      }
      return next;
    });
    writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
  }
  const extra = Object.keys(DISH_TYPE_MAP).filter((id) => !seen.has(id));
  if (extra.length > 0) throw new Error(`mapped ids not found in batch-a..h: ${extra.join(', ')}`);
  console.log(`dishType written for ${seen.size} recipes`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
