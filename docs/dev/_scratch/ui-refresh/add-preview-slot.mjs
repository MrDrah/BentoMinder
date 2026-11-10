// Adds slot (h) "UI refresh 2026-11" to design/_scratch/preview.src.html (idempotent: skips if present).
import { readFileSync, writeFileSync } from 'node:fs';
const f = 'design/_scratch/preview.src.html';
let s = readFileSync(f, 'utf8');
if (s.includes('cap-h')) { console.log('already present'); process.exit(0); }

const css = `
/* (h) UI refresh 2026-11 */
.rf .brand-btn{display:inline-flex;align-items:center;gap:8px;position:relative;min-width:44px;min-height:44px;border:0;background:none;color:var(--ink-1);font:inherit;cursor:pointer;border-radius:var(--radius-pill);padding:0 4px;flex:0 0 auto}
.rf .badge{position:absolute;right:0;bottom:2px;width:16px;height:16px;border-radius:50%;background:var(--surface-1);color:var(--ink-1);display:grid;place-items:center;font-size:11px;font-weight:700;line-height:1;border:1px solid var(--ink-1)}
.rf .brand-btn[aria-expanded=true] .badge{background:var(--ink-1);color:var(--ink-inverse)}
.rf .spacer{flex:1}
.rf .about{padding:20px;background:var(--surface-2);border-bottom:1px solid var(--line-1)}
.rf .about[hidden]{display:none}
.rf .about h2{font-family:var(--font-display);font-size:var(--text-lg);margin:0 0 12px}
.rf .about p{margin:0 0 12px;color:var(--ink-2);max-width:36em}
.rf .about .row{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:8px}
.rf .about small{color:var(--ink-3)}
.rf .tbtn{min-height:44px;padding:0 12px;border:0;background:none;color:var(--ink-1);font:inherit;font-weight:700;text-decoration:underline;text-underline-offset:4px;cursor:pointer}
.rf .monthnav{padding:8px;justify-content:flex-start;gap:8px}
.rf .monthnav .iconbtn{width:48px;height:48px}
.rf .monthnav h2{flex:1}
.rf .cell{min-height:var(--cell-min-height);padding:6px}
.rf .cal-grid.compact .cell{min-height:var(--cell-row-compact)}
.rf .below{display:grid;gap:24px;padding:40px 20px 24px}
.rf .below .card{padding:20px;box-shadow:none}
.rf .below .note{font-size:var(--text-sm);color:var(--ink-2);margin:12px 0 0}
.rf .tools{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
.rf .tools .btn{flex:1 1 auto}
.rf .legend-card{display:none}
.rf .legend-card.is-open{display:block}
`;
s = s.replace('</style>', css + '</style>');

const sec = `
<!-- ===================== (h) UI REFRESH 2026-11: SP home, brand info ===================== -->
<section class="slot rf" aria-labelledby="cap-h" style="margin-top:48px">
  <h2 class="slot-cap" id="cap-h"><b>h</b><span data-en="UI refresh 2026-11: calendar as the hero (390). Try the (i) next to the logo and the legend button">UI刷新 2026-11：カレンダーを主役に（390）。ロゴ横の(i)と、表示の見かたのボタンを押してみてください</span></h2>
  <div class="phone">
    <div class="status"><span>17:41</span><span>●●●</span></div>
    <div class="scroll">
      <div class="appbar">
        <button class="brand-btn" id="aboutBtn" type="button" aria-expanded="false" aria-controls="aboutPanel" aria-label="BentoMinderについて" data-en-aria="About BentoMinder"><svg width="36" height="36" aria-hidden="true"><use href="#logo"/></svg><span class="badge" aria-hidden="true">i</span></button>
        <span class="spacer"></span>
        <button class="langbtn" type="button" aria-label="表示言語" data-en-aria="Display language"><b class="l-ja" lang="ja">日本語</b><b class="l-en" lang="en">EN</b></button>
        <button class="iconbtn" type="button" aria-label="レシピ" data-en-aria="Recipes"><svg class="i"><use href="#i-book"/></svg></button>
        <button class="iconbtn" type="button" aria-label="設定" data-en-aria="Settings"><svg class="i"><use href="#i-gear"/></svg></button>
      </div>
      <section class="about" id="aboutPanel" role="region" aria-labelledby="aboutH" hidden>
        <h2 id="aboutH"><span data-en="Never forget a bento day.">おべんとう、忘れない。</span></h2>
        <p><span data-en="BentoMinder reads your school's lunch menu and reminds you about your homemade bento days.">BentoMinderは、園の給食の献立表を読み取って、お弁当の日を忘れないようにお知らせするアプリです。</span></p>
        <p><span data-en="It marks school lunches your child may not enjoy, and suggests three recipes for each bento day.">お子さまの好みに合わなさそうな給食に印をつけ、手作りお弁当の日には、おすすめのレシピを3つ提案します。</span></p>
        <div class="row"><button class="tbtn" type="button"><span data-en="About reading the menu with AI">AIでの読み取りについて</span></button><button class="tbtn" id="aboutClose" type="button" aria-label="説明を閉じる" data-en-aria="Close this description"><span data-en="Close">閉じる</span></button></div>
        <small>バージョン 0.0.1</small>
      </section>
      <div class="monthnav">
        <h2><span data-en="November 2026">2026年11月</span></h2>
        <button class="iconbtn" type="button" aria-label="前の月" data-en-aria="Previous month"><svg class="i"><use href="#i-left"/></svg></button>
        <button class="iconbtn" type="button" aria-label="次の月" data-en-aria="Next month"><svg class="i"><use href="#i-right"/></svg></button>
      </div>
      <div class="cal" id="cal2" role="grid" aria-label="2026年11月のカレンダー" data-en-aria="Calendar for November 2026"></div>
      <div class="below">
        <div class="card"><div class="steplab"><span data-en="Today · Tue, Nov 17">今日・11月17日（火）</span></div><strong class="disp" style="font-size:var(--text-xl)"><span data-en="School lunch today">今日は給食</span></strong><p class="note"><span data-en="Please arrange school lunch through your school as usual (this app doesn't do it for you).">給食の予約は園の方法で行ってください（このアプリでは予約されません）</span></p></div>
        <div class="tools"><button class="btn btn-secondary" type="button"><svg class="i"><use href="#i-share"/></svg><span data-en="Share this week's plan">今週の予定を共有</span></button><button class="tbtn" id="legendBtn" type="button" aria-expanded="false" aria-controls="legendCard"><span data-en="How to read the calendar">表示の見かた</span></button></div>
        <div class="card legend-card" id="legendCard"><p class="meta"><span data-en="The mark at the top right is the app's guess about the lunch; the word and frame below are your family's plan.">右上の記号は給食の見立て（アプリの判定）、下の文字と枠は家族の予定です。</span></p></div>
      </div>
    </div>
  </div>
  <p class="slot-note"><span data-en="Whole month visible on the first screen; today card, upcoming and tools sit below (40 px after the grid, 24 px between blocks). Cells are 80 px high (was 68). The legend is closed until asked for. Preview shows the closed and open behaviour only; layout above 768 px is described in components section 17.">最初の画面で月全体が見えます。今日のカード・予定・ツール行はその下（グリッドの下40px、ブロック間24px）。セルの高さは80px（以前は68px）。表示の見かたは、押すまで閉じています。このプレビューは開閉の動きだけを示します。768px以上のレイアウトは components 17章を参照。</span></p>
</section>

`;
s = s.replace('</main>', sec + '</main>');

s = s.replace("document.getElementById('cal').innerHTML=h;", "document.getElementById('cal').innerHTML=h; var c2=document.getElementById('cal2'); if(c2)c2.innerHTML=h;");

const wire = `  function tog(btn,panel,cls){btn.addEventListener('click',function(){var o=btn.getAttribute('aria-expanded')!=='true';btn.setAttribute('aria-expanded',o);if(cls)panel.classList.toggle('is-open',o);else panel.hidden=!o;});}
  var ab=document.getElementById('aboutBtn');
  tog(ab,document.getElementById('aboutPanel'));
  tog(document.getElementById('legendBtn'),document.getElementById('legendCard'),true);
  document.getElementById('aboutClose').addEventListener('click',function(){ab.click();ab.focus();});
  ab.closest('.rf').addEventListener('keydown',function(e){if(e.key==='Escape'&&ab.getAttribute('aria-expanded')==='true'){ab.click();ab.focus();}});
  renderCal();
  var m=document.getElementById('monthA')`;
const marker = "  renderCal();\n  var m=document.getElementById('monthA')";
if (!s.includes(marker)) throw new Error('marker missing');
s = s.replace(marker, wire);
writeFileSync(f, s);
console.log('ok');
