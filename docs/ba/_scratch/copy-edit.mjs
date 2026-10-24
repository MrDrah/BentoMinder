import { readFileSync, writeFileSync } from 'node:fs';
const p = 'design/copy.md';
const lines = readFileSync(p, 'utf8').split('\n');
// key -> { ja?, en?, ref? }  (ref replaces the story/AC column)
const edits = {
  'common.retryIn': { ref: 'US-E2-06/AC6, AC9 (verbatim pattern)' },
  'import.month.label': { ref: 'US-E2-01/AC5, US-E3-04/AC1' },
  'import.progress.cancel': { ref: 'US-E2-04/AC8' },
  'review.reason.duplicateDate': { ja: '同じ日付が複数あったため、1つにまとめました', en: 'This date appeared more than once, so the entries were combined', ref: 'US-E2-05/AC6' },
  'review.accept': { ja: 'このままにする', en: 'Keep as is', ref: 'US-E3-03/AC2, AC4 (verbatim)' },
  'review.noLunch.toggle': { ref: 'US-E3-02/AC3, AC6 (verbatim)' },
  'review.noLunch.restore': { ref: 'US-E3-02/AC3 (verbatim)' },
  'review.noLunch.reason': { ref: 'US-E3-02/AC6' },
  'review.noLunch.bentoDay': { ref: 'US-E3-02/AC6 (verbatim), US-E5-08' },
  'review.noLunch.noLunch': { ref: 'US-E3-02/AC3, AC6 (verbatim)' },
  'review.noLunch.closed': { ref: 'US-E3-02/AC6 (verbatim)' },
  'review.noLunch.unknown': { ref: 'US-E3-02/AC6 (verbatim)' },
  'review.noLunch.text': { ref: 'US-E3-02/AC3, AC6 (verbatim)' },
  'review.noLunch.hiddenDishes': { ja: 'この日の料理{n}品は、確定するまで元に戻せます', en: '{n, plural, one {# dish} other {# dishes}} can be restored until you confirm', ref: 'US-E3-02/AC3' },
  'review.warn.monthMismatch': { ref: 'US-E3-01/AC4 (verbatim)' },
  'review.warn.pagesUnreadable': { ref: 'US-E3-01/AC4 (verbatim)' },
  'review.warn.layout': { ref: 'US-E3-01/AC4 (verbatim)' },
  'review.warn.partial': { ref: 'US-E3-01/AC4 (verbatim)' },
  'review.leave.title': { ref: 'US-E3-03/AC5 (verbatim), US-E3-05/AC5' },
  'review.leave.body': { ja: '確定していない内容は、カレンダーには使われません。ここまでの修正は保存されませんが、あとでもう一度確認できます。', en: "Nothing unconfirmed is used in the calendar. Changes made so far aren't saved, but you can check the menu again later.", ref: 'US-E3-03/AC5, US-E3-05/AC5' },
  'review.leave.confirm': { ref: 'US-E3-03/AC5 (verbatim)' },
  'review.leave.stay': { ref: 'US-E3-03/AC5 (verbatim)' },
  'refresh.review.lead': { ja: '献立の更新で内容が変わった日です。予定と、手動で変えた判定はそのまま残しています。', en: 'The menu update changed these days. Your plans and the assessments you changed yourself were kept as they were.', ref: 'US-E3-05/AC9, BR-13' },
  'refresh.review.empty': { ref: 'US-E3-05/AC13 (verbatim)' },
  'refresh.review.done': { ref: 'US-E3-05/AC13 (verbatim)' },
  'menuCard.dismiss': { ref: 'US-E3-06/AC6 (verbatim)' },
  'day.noMenu': { ref: 'US-E5-02/AC4 (verbatim), US-E3-06/AC1' },
  'day.saved.bento': { ref: 'US-E5-03/AC2, US-E10-02/AC6 (verbatim pattern)' },
  'day.saved.later': { en: '{date} is marked as undecided' },
  'rec.reason.quick': { ref: 'US-E6-01/AC7 (verbatim), BR-09' },
  'recipe.planPick.title': { ref: 'US-E6-05/AC3 (verbatim)' },
  'recipe.planPick.lead': { ref: 'US-E6-05/AC3, BR-25, BR-27' },
  'recipe.planPick.empty': { ref: 'US-E6-05/AC4 (verbatim)' },
  'recipe.planPick.option': { ref: 'US-E6-05/AC3' },
  'reminder.more': { ref: 'US-E7-05/AC5 (verbatim pattern)' },
  'today.nextUnknown': { ref: 'US-E7-03/AC4 (verbatim)' },
  'today.cta.plan': { ref: 'US-E7-03/AC5 (verbatim)' },
  'settings.menu.promptDay': { ref: 'US-E3-06/AC7 (verbatim), OQ-15' },
  'settings.menu.promptDay.value': { ref: 'US-E3-06/AC7 (verbatim pattern)' },
  'share.copyFailed': { ja: 'コピーできませんでした。下の文章を選んでコピーしてください。', en: "Couldn't copy. Please select the text below and copy it.", ref: 'US-E9-01/AC4 (verbatim)' },
  'share.sheet.preview': { ref: 'US-E9-01/AC4, US-E9-02/AC1' },
  'data.import.invalid': { ref: 'US-E10-03/AC5 (verbatim)' },
  'data.import.newer': { ref: 'US-E10-03/AC6 (verbatim)' },
  'storage.corrupt.resetTitle': { ref: 'US-E10-02/AC7 (verbatim)' },
  'storage.corrupt.resetBody': { ref: 'US-E10-02/AC7' },
  'toast.saveFailed': { ref: 'US-E10-02/AC5, AC6 (verbatim), US-E10-05/AC1' },
};
const seen = new Set();
for (let i = 0; i < lines.length; i++) {
  const m = /^\| ([A-Za-z0-9_.]+) \|/.exec(lines[i]);
  if (!m || !(m[1] in edits)) continue;
  const cells = lines[i].split(' | ');
  // cells: ['| key', ja, en, where, 'story |']
  if (cells.length !== 5) { console.error('unexpected cells', m[1], cells.length); process.exit(1); }
  const e = edits[m[1]];
  if (e.ja) cells[1] = e.ja;
  if (e.en) cells[2] = e.en;
  if (e.ref) cells[4] = e.ref + ' |';
  lines[i] = cells.join(' | ');
  seen.add(m[1]);
}
const missing = Object.keys(edits).filter((k) => !seen.has(k));
if (missing.length) { console.error('missing', missing); process.exit(1); }
writeFileSync(p, lines.join('\n'));
console.log('edited', seen.size);
