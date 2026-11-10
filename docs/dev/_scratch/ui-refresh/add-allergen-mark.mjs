// Adds the allergen mark to the tile preview (slot h, matrix, legend). Idempotent. node docs/dev/_scratch/ui-refresh/add-allergen-mark.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const f = 'design/_scratch/preview.src.html';
let s = readFileSync(f, 'utf8');
if (s.includes('tl-al')) { console.log('already'); process.exit(0); }
function rep(a, b) { if (!s.includes(a)) throw new Error('missing: ' + a.slice(0, 70)); s = s.replace(a, () => b); }
// CSS
rep('.tl.is-past{background:transparent;--tile-ink:var(--ink-3)}',
`.tl-al{position:absolute;right:3px;bottom:3px;width:18px;height:18px;box-sizing:border-box;border-radius:50%;background:var(--danger-soft);color:var(--danger);border:1.5px solid var(--danger);display:grid;place-items:center;font-size:var(--text-xs);font-weight:700;line-height:1;pointer-events:none}
@media (min-width:768px){.tl-al{width:20px;height:20px;right:4px;bottom:4px;font-size:13px}}
.lg-s[data-sample=allergen],.lg-s[data-sample=allergen] .tl{height:56px;min-height:56px}
.lg-s .tl-al{width:16px;height:16px;right:2px;bottom:2px}
.tl.is-past{background:transparent;--tile-ink:var(--ink-3)}`);
// data
rep("6:{i:'school'}", "6:{i:'school',al:1}");
rep("17:{i:'school'}", "17:{i:'school',al:1}");
rep("19:{i:'school',ch:1}", "19:{i:'school',ch:1,al:1}");
rep('ch:x.ch,dash:x.dash', 'ch:x.ch,al:x.al,dash:x.dash');
rep("n+=sep+SW[(o.i==='home'&&o.bd)?'homeDay':o.i][lang]; }", "n+=sep+SW[(o.i==='home'&&o.bd)?'homeDay':o.i][lang]; if(o.al)n+=lang==='ja'?'、アレルギーに注意':', allergen alert'; }");
rep("if(o.i)c.push('has-icon');", "if(o.i)c.push('has-icon'); if(o.al)c.push('has-allergen');");
rep("+((o.dash&&!o.past)?'<span class=\"tl-dash\"></span>':'');", "+((o.dash&&!o.past)?'<span class=\"tl-dash\"></span>':'')+(o.al?'<span class=\"tl-al\" aria-hidden=\"true\">!</span>':'');");
rep('function mo(kind,time,ch){var d=time[2];var o={d:d,wd:wdOf(d),past:time[0]===\'past\',today:time[0]===\'today\',tmr:time[0]===\'tmr\',ch:ch};',
    'function mo(kind,time,ch,al){var d=time[2];var o={d:d,wd:wdOf(d),past:time[0]===\'past\',today:time[0]===\'today\',tmr:time[0]===\'tmr\',ch:ch,al:al};');
rep("['school',1,T('給食・変更あり','School lunch, changed')],", "['school',1,T('給食・変更あり','School lunch, changed')],['school',0,T('給食・アレルギー注意（!）','School lunch, allergen alert (!)'),1],['school',1,T('給食・変更あり・アレルギー注意','School lunch, changed, allergen alert'),1],");
rep("tileHtml(mo(r[0],t,r[1]),'span')", "tileHtml(mo(r[0],t,r[1],r[3]),'span')");
// interaction states: home block + school allergen block
const iStart = s.indexOf("    // interaction states");
const iEnd = s.indexOf("    // weekend narrow column");
const block = s.slice(iStart, iEnd);
const block2 = block.replace("T('操作の状態（お弁当・変更あり）','Interaction states (bento, changed)')", "T('操作の状態（給食・変更あり・アレルギー注意）','Interaction states (school lunch, changed, allergen alert)')").replace("mo('home',t,1)", "mo('school',t,1,1)").replace('    // interaction states', '    // interaction states, allergen mark');
s = s.slice(0, iEnd) + block2 + s.slice(iEnd);
// weekend
rep("['school','home','unsure','dash'].map(function(k){return '<span class=\"tm-h\">'+k+'</span>';})", "['school','school!','home','unsure','dash'].map(function(k){return '<span class=\"tm-h\">'+k+'</span>';})");
rep("grid-template-columns:132px repeat(4,52px)", "grid-template-columns:132px repeat(5,52px)");
rep("      ['school','home','unsure','dash'].forEach(function(k){var o=wk(r[0],k==='dash'?'home':k);", "      ['school','school!','home','unsure','dash'].forEach(function(k){var o=wk(r[0],k==='dash'?'home':(k==='school!'?'school':k)); if(k==='school!')o.al=1;");
// legend
rep('<li><span class="lg-s" data-sample="changed"', '<li><span class="lg-s" data-sample="allergen" aria-hidden="true"></span><span data-en="! mark: school lunch day that needs allergen attention (your registered allergens)">！：登録したアレルギーに注意が必要な給食の日</span></li>\n            <li><span class="lg-s" data-sample="changed"');
rep("changed:{d:19,i:'school',ch:1},", "changed:{d:19,i:'school',ch:1},allergen:{d:12,i:'school',al:1},");
// notes
rep('red top line = a day you changed (4th, 9th, 13th, 18th, 19th, 24th, 25th);', 'red top line = a day you changed (4th, 9th, 13th, 18th, 19th, 24th, 25th); small ! mark bottom right = allergen alert on a school lunch day (6th, 17th, 19th);');
rep('赤い上の線＝手動で変更した日、', '赤い上の線＝手動で変更した日、右下の小さな「!」＝給食の日のアレルギー注意（6日・17日・19日）、');
rep('31 base combinations.', '39 base combinations (31 plus 8 with the ! mark).');
rep('基本の組み合わせは31通り。', '基本の組み合わせは39通り（31通りと、「!」つきの8通り）。');
writeFileSync(f, s);
console.log('ok');
