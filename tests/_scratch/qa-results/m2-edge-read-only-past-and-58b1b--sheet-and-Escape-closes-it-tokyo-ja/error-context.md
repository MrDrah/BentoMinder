# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: m2-edge.spec.ts >> read-only past and hostile menu text (BR-27, US-E5-02/AC3, US-NF-02) >> US-E5-01/AC3 US-NF-02/AC1 [M2-D01 open P3, expected to fail until fixed] after a keyboard action the focus stays in the sheet and Escape closes it
- Location: tests\e2e\qa\m2-edge.spec.ts:165:3

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByTestId('day-sheet').locator(':focus')
Expected: 1
Received: 0
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" getByTestId('day-sheet').locator(':focus') with timeout 5000ms
  - waiting for getByTestId('day-sheet').locator(':focus')
    14 × locator resolved to 0 elements
       - unexpected value "0"

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - link "本文へ移動" [ref=e3] [cursor=pointer]:
    - /url: "#main"
  - generic [ref=e4]:
    - banner [ref=e5]:
      - generic [ref=e6]:
        - img "BentoMinder" [ref=e8]
        - generic [ref=e9]:
          - radiogroup "表示言語" [ref=e11]:
            - radio "日本語" [checked] [ref=e12] [cursor=pointer]
            - radio "EN" [ref=e13] [cursor=pointer]
          - link "レシピ" [ref=e14] [cursor=pointer]:
            - /url: "#/recipes"
          - link "設定" [ref=e17] [cursor=pointer]:
            - /url: "#/settings"
    - main [ref=e21]:
      - region [ref=e22]:
        - heading "これからの手作りお弁当" [level=2] [ref=e23]
        - list [ref=e24]:
          - listitem [ref=e25]:
            - button "11月4日（水） くまさんおにぎり弁当 2日後" [ref=e26] [cursor=pointer]:
              - generic [ref=e31]:
                - text: 11月4日（水） くまさんおにぎり弁当
                - generic [ref=e32]: 2日後
      - navigation "月の切り替え" [ref=e33]:
        - button "前の月" [ref=e34] [cursor=pointer]
        - heading "2026年11月" [level=2] [ref=e37]
        - button "次の月" [ref=e38] [cursor=pointer]
      - paragraph [ref=e41]
      - grid "2026年11月のカレンダー" [ref=e43]:
        - row [ref=e44]:
          - columnheader "月曜日" [ref=e45]: 月
          - columnheader "火曜日" [ref=e46]: 火
          - columnheader "水曜日" [ref=e47]: 水
          - columnheader "木曜日" [ref=e48]: 木
          - columnheader "金曜日" [ref=e49]: 金
          - columnheader "土曜日" [ref=e50]: 土
          - columnheader "日曜日" [ref=e51]: 日
        - row [ref=e52]:
          - gridcell [aria-hidden] [ref=e53]
          - gridcell [aria-hidden] [ref=e54]
          - gridcell [aria-hidden] [ref=e55]
          - gridcell [aria-hidden] [ref=e56]
          - gridcell [aria-hidden] [ref=e57]
          - gridcell [aria-hidden] [ref=e58]
          - gridcell [ref=e59]:
            - button "11月1日（日）、献立に記載なし、過去の日" [ref=e60] [cursor=pointer]:
              - generic [aria-hidden] [ref=e63]: "1"
        - row [ref=e65]:
          - gridcell [ref=e66]:
            - button "今日、11月2日（月）、たのしめそう、給食" [ref=e67] [cursor=pointer]:
              - generic [aria-hidden] [ref=e70]: "2"
              - generic [ref=e75]: 給食
          - gridcell [ref=e76]:
            - button "11月3日（火）、献立に記載なし" [ref=e77] [cursor=pointer]:
              - generic [aria-hidden] [ref=e80]: "3"
          - gridcell [ref=e82]:
            - button "11月4日（水）、苦手かも、手作りお弁当：くまさんおにぎり弁当" [ref=e83] [cursor=pointer]:
              - generic [aria-hidden] [ref=e86]: "4"
              - generic [aria-hidden] [ref=e91]:
                - generic [ref=e95]: くま
                - generic [ref=e96]: おにぎり
          - gridcell [ref=e97]:
            - button "11月5日（木）、どちらとも、給食、手動で変更" [ref=e98] [cursor=pointer]:
              - generic [aria-hidden] [ref=e101]: "5"
              - generic [ref=e106]: 給食
          - gridcell [ref=e107]:
            - button "11月6日（金）、どちらとも、給食" [ref=e108] [cursor=pointer]:
              - generic [aria-hidden] [ref=e111]: "6"
              - generic [ref=e116]: 給食
          - gridcell [ref=e117]:
            - button "11月7日（土）、献立に記載なし" [ref=e118] [cursor=pointer]:
              - generic [aria-hidden] [ref=e121]: "7"
          - gridcell [ref=e123]:
            - button "11月8日（日）、献立に記載なし" [ref=e124] [cursor=pointer]:
              - generic [aria-hidden] [ref=e127]: "8"
        - row [ref=e129]:
          - gridcell [ref=e130]:
            - button "11月9日（月）、たのしめそう、給食" [ref=e131] [cursor=pointer]:
              - generic [aria-hidden] [ref=e134]: "9"
              - generic [ref=e139]: 給食
          - gridcell [ref=e140]:
            - button "11月10日（火）、どちらとも、給食" [ref=e141] [cursor=pointer]:
              - generic [aria-hidden] [ref=e144]: "10"
              - generic [ref=e149]: 給食
          - gridcell [ref=e150]:
            - button "11月11日（水）、たのしめそう、給食" [ref=e151] [cursor=pointer]:
              - generic [aria-hidden] [ref=e154]: "11"
              - generic [ref=e159]: 給食
          - gridcell [ref=e160]:
            - button "11月12日（木）、苦手かも、給食" [ref=e161] [cursor=pointer]:
              - generic [aria-hidden] [ref=e164]: "12"
              - generic [ref=e170]: 給食
          - gridcell [ref=e171]:
            - button "11月13日（金）、どちらとも、給食" [ref=e172] [cursor=pointer]:
              - generic [aria-hidden] [ref=e175]: "13"
              - generic [ref=e180]: 給食
          - gridcell [ref=e181]:
            - button "11月14日（土）、献立に記載なし" [ref=e182] [cursor=pointer]:
              - generic [aria-hidden] [ref=e185]: "14"
          - gridcell [ref=e187]:
            - button "11月15日（日）、献立に記載なし" [ref=e188] [cursor=pointer]:
              - generic [aria-hidden] [ref=e191]: "15"
        - row [ref=e193]:
          - gridcell [ref=e194]:
            - button "11月16日（月）、たのしめそう、給食" [ref=e195] [cursor=pointer]:
              - generic [aria-hidden] [ref=e198]: "16"
              - generic [ref=e203]: 給食
          - gridcell [ref=e204]:
            - button "11月17日（火）、苦手かも、給食" [ref=e205] [cursor=pointer]:
              - generic [aria-hidden] [ref=e208]: "17"
              - generic [ref=e214]: 給食
          - gridcell [ref=e215]:
            - button "11月18日（水）、どちらとも、未定" [ref=e216] [cursor=pointer]:
              - generic [aria-hidden] [ref=e219]: "18"
              - generic [ref=e227]: 未定
          - gridcell [ref=e228]:
            - button "11月19日（木）、たのしめそう、給食" [ref=e229] [cursor=pointer]:
              - generic [aria-hidden] [ref=e232]: "19"
              - generic [ref=e237]: 給食
          - gridcell [ref=e238]:
            - button "11月20日（金）、お弁当の日、未計画" [ref=e239] [cursor=pointer]:
              - generic [aria-hidden] [ref=e242]: "20"
              - generic [aria-hidden] [ref=e243]:
                - generic [ref=e247]: お弁当
                - generic [ref=e248]: の日
          - gridcell [ref=e249]:
            - button "11月21日（土）、献立に記載なし" [ref=e250] [cursor=pointer]:
              - generic [aria-hidden] [ref=e253]: "21"
          - gridcell [ref=e255]:
            - button "11月22日（日）、献立に記載なし" [ref=e256] [cursor=pointer]:
              - generic [aria-hidden] [ref=e259]: "22"
        - row [ref=e261]:
          - gridcell [ref=e262]:
            - button "11月23日（月）、献立に記載なし" [ref=e263] [cursor=pointer]:
              - generic [aria-hidden] [ref=e266]: "23"
          - gridcell [ref=e268]:
            - button "11月24日（火）、苦手かも、給食" [ref=e269] [cursor=pointer]:
              - generic [aria-hidden] [ref=e272]: "24"
              - generic [ref=e278]: 給食
          - gridcell [ref=e279]:
            - button "11月25日（水）、どちらとも、給食" [ref=e280] [cursor=pointer]:
              - generic [aria-hidden] [ref=e283]: "25"
              - generic [ref=e288]: 給食
          - gridcell [ref=e289]:
            - button "11月26日（木）、たのしめそう、給食" [ref=e290] [cursor=pointer]:
              - generic [aria-hidden] [ref=e293]: "26"
              - generic [ref=e298]: 給食
          - gridcell [ref=e299]:
            - button "11月27日（金）、給食なし（午前保育（給食なし））" [ref=e300] [cursor=pointer]:
              - generic [aria-hidden] [ref=e303]: "27"
              - generic [ref=e305]: 給食なし
          - gridcell [ref=e306]:
            - button "11月28日（土）、献立に記載なし" [ref=e307] [cursor=pointer]:
              - generic [aria-hidden] [ref=e310]: "28"
          - gridcell [ref=e312]:
            - button "11月29日（日）、献立に記載なし" [ref=e313] [cursor=pointer]:
              - generic [aria-hidden] [ref=e316]: "29"
        - row [ref=e318]:
          - gridcell [ref=e319]:
            - button "11月30日（月）、たのしめそう、給食" [ref=e320] [cursor=pointer]:
              - generic [aria-hidden] [ref=e323]: "30"
              - generic [ref=e328]: 給食
          - gridcell [aria-hidden] [ref=e329]
          - gridcell [aria-hidden] [ref=e330]
          - gridcell [aria-hidden] [ref=e331]
          - gridcell [aria-hidden] [ref=e332]
          - gridcell [aria-hidden] [ref=e333]
          - gridcell [aria-hidden] [ref=e334]
      - button "表示の見かた" [ref=e336] [cursor=pointer]
    - dialog [ref=e340]:
      - generic [ref=e342]:
        - heading "11月18日（水）" [level=2] [ref=e343]
        - button "閉じる" [ref=e344] [cursor=pointer]
      - generic [ref=e347]:
        - generic [ref=e348]:
          - heading "給食の献立" [level=3] [ref=e349]
          - list [ref=e350]:
            - listitem [ref=e351]:
              - generic [ref=e352]: タンドリーチキン
              - generic [ref=e353]: 好き
            - listitem [ref=e354]:
              - generic [ref=e355]: ナン
            - listitem [ref=e356]:
              - generic [ref=e357]: ミネストローネ
          - paragraph [ref=e358]: アレルゲンの記載がありません
        - generic [ref=e359]:
          - heading "給食の見立て" [level=3] [ref=e360]
          - generic [ref=e361]:
            - generic [ref=e362]: どちらとも
            - paragraph [ref=e365]: わからない料理が多いため、判断できませんでした（ナン、ミネストローネ）。
            - paragraph [ref=e366]: 判定は、登録した好みと献立表の文字だけをもとにしています。
            - button "判定を変更" [ref=e367] [cursor=pointer]
            - status [ref=e368]
        - generic [ref=e369]:
          - heading "この日の予定" [level=3] [ref=e370]
          - paragraph [ref=e371]: いまの予定：未定
          - generic [ref=e375]:
            - button "手作りお弁当にする おすすめのレシピから選べます" [ref=e376] [cursor=pointer]:
              - text: 手作りお弁当にする
              - generic [ref=e377]: おすすめのレシピから選べます
            - button "給食に戻す" [ref=e378] [cursor=pointer]
  - status
```

# Test source

```ts
  75  |     expect(await page.locator('[data-assessment]').count()).toBe(0);
  76  |   });
  77  | });
  78  | 
  79  | test.describe('refresh is atomic (US-E3-05/AC5, BR-12, BR-13)', () => {
  80  |   const snapshot = (st: Json) => JSON.stringify({ menus: st.menus, decisions: st.decisions, overrides: st.overrides });
  81  | 
  82  |   test('US-E3-05/AC5 a refresh whose extraction fails validation leaves the confirmed menu, decisions and overrides unchanged', async ({ page }) => {
  83  |     await seed(page, STATE);
  84  |     await useScenario(page, `${FX}/hand-schema-invalid`);
  85  |     await page.goto('./');
  86  |     const before = snapshot(await readStore(page));
  87  |     await page.goto('./#/import');
  88  |     await page.getByTestId('import-month').selectOption('2026-11');
  89  |     await page.getByTestId('import-upload').setInputFiles(FX01);
  90  |     const replace = page.getByTestId('dialog-replace-menu');
  91  |     if (await replace.isVisible().catch(() => false)) await page.getByTestId('dialog-replace-menu-confirm').click();
  92  |     const consent = page.getByTestId('consent-accept');
  93  |     if (await consent.isVisible().catch(() => false)) await consent.click();
  94  |     await expect(page.getByTestId('import-error')).toBeVisible({ timeout: 30_000 });
  95  |     const after = await readStore(page);
  96  |     expect(after.menus['2026-11'].confirmed.version).toBe(STATE.menus['2026-11'].confirmed.version);
  97  |     expect(snapshot(after).replace(/"updatedAt":"[^"]*"/g, '')).toBe(before.replace(/"updatedAt":"[^"]*"/g, ''));
  98  |   });
  99  | 
  100 |   test('US-E3-05/AC5 the parent leaves the review without confirming: the previous menu stays active, also after a reload', async ({ page }) => {
  101 |     await seed(page, STATE);
  102 |     await useScenario(page, `${FX}/hand-1`);
  103 |     await page.goto('./');
  104 |     const before = await readStore(page);
  105 |     await page.goto('./#/import');
  106 |     await page.getByTestId('import-month').selectOption('2026-11');
  107 |     await page.getByTestId('import-upload').setInputFiles(FX01);
  108 |     const replace = page.getByTestId('dialog-replace-menu');
  109 |     if (await replace.isVisible().catch(() => false)) await page.getByTestId('dialog-replace-menu-confirm').click();
  110 |     const consent = page.getByTestId('consent-accept');
  111 |     if (await consent.isVisible().catch(() => false)) await consent.click();
  112 |     await expect(page.getByTestId('screen-review')).toBeVisible({ timeout: 30_000 });
  113 |     await page.goto('./'); // abandon without confirming
  114 |     await page.reload();
  115 |     const after = await readStore(page);
  116 |     expect(after.menus['2026-11'].confirmed).toEqual(before.menus['2026-11'].confirmed);
  117 |     expect(after.decisions).toEqual(before.decisions);
  118 |     expect(after.overrides).toEqual(before.overrides);
  119 |     await expect(cell(page, '2026-11-04')).toHaveAttribute('data-decision', 'homemade-bento-planned');
  120 |   });
  121 | });
  122 | 
  123 | test.describe('read-only past and hostile menu text (BR-27, US-E5-02/AC3, US-NF-02)', () => {
  124 |   test('US-E5-02/AC3 US-E4-03/AC6 a past planned day is read-only: the plan is shown, no action or override control is offered, the store is untouched', async ({ page }) => {
  125 |     await seed(page, STATE, new Date('2026-11-06T01:00:00Z')); // 11-04 is past
  126 |     await page.goto('./');
  127 |     const before = await readStore(page);
  128 |     await openDay(page, '2026-11-04');
  129 |     await expect(page.getByTestId('day-past-note')).toBeVisible();
  130 |     await expect(page.getByTestId('day-sheet')).toContainText('くまさんおにぎり弁当');
  131 |     await expect(page.getByTestId('override-open')).toHaveCount(0);
  132 |     await expect(page.getByTestId('day-sheet').getByRole('button', { name: /あとで決める|給食に戻す|レシピを変更|手作りお弁当にする/ })).toHaveCount(0);
  133 |     expect((await readStore(page)).decisions).toEqual(before.decisions);
  134 |   });
  135 | 
  136 |   test('US-NF-02/AC1 hostile dish text (script tag, emoji, 40 characters of full-width text) is shown as text, never run, and does not break the layout', async ({ page }) => {
  137 |     const s = clone(STATE);
  138 |     const days = s.menus['2026-11'].confirmed.days;
  139 |     const target = days.find((x: Json) => x.date === '2026-11-12') ?? days[0];
  140 |     target.items[0].text = '<script>window.__x=1</script><b>x</b>';
  141 |     target.items[1] = { ...target.items[1], text: '🍙🍱🥢🍙🍱🥢🍙🍱🥢🍙🍱🥢🍙🍱🥢🍙🍱🥢🍙🍱🥢🍙🍱🥢🍙🍱🥢🍙' };
  142 |     if (target.items[2]) target.items[2].text = 'あ'.repeat(40);
  143 |     await seed(page, s);
  144 |     await page.goto('./');
  145 |     await openDay(page, target.date);
  146 |     await expect(page.getByTestId('day-menu')).toContainText('<script>window.__x=1</script>');
  147 |     expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined();
  148 |     const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  149 |     expect(overflow).toBeLessThanOrEqual(1);
  150 |     await seriousAxe(page, 'hostile day sheet');
  151 |   });
  152 | 
  153 |   test('US-E5-01/AC3 keyboard only: a day opens with Enter and 「あとで決める」 works with Enter', async ({ page }) => {
  154 |     await seed(page, STATE);
  155 |     await page.goto('./');
  156 |     await cell(page, '2026-11-18').getByRole('button').focus();
  157 |     await page.keyboard.press('Enter');
  158 |     await expect(page.getByTestId('day-sheet')).toBeVisible();
  159 |     const later = page.getByTestId('day-sheet').getByRole('button', { name: 'あとで決める' });
  160 |     await later.focus();
  161 |     await page.keyboard.press('Enter');
  162 |     await expect.poll(async () => (await readStore(page)).decisions['2026-11-18']?.state).toBe('not-confirmed');
  163 |   });
  164 | 
  165 |   test('US-E5-01/AC3 US-NF-02/AC1 [M2-D01 open P3, expected to fail until fixed] after a keyboard action the focus stays in the sheet and Escape closes it', async ({ page }) => {
  166 |     test.fail(true, 'M2-D01: the activated button is removed and focus falls to BODY, so Escape no longer closes the sheet');
  167 |     await seed(page, STATE);
  168 |     await page.goto('./');
  169 |     await cell(page, '2026-11-18').getByRole('button').focus();
  170 |     await page.keyboard.press('Enter');
  171 |     const later = page.getByTestId('day-sheet').getByRole('button', { name: 'あとで決める' });
  172 |     await later.focus();
  173 |     await page.keyboard.press('Enter');
  174 |     await expect.poll(async () => (await readStore(page)).decisions['2026-11-18']?.state).toBe('not-confirmed');
> 175 |     await expect(page.getByTestId('day-sheet').locator(':focus')).toHaveCount(1);
      |                                                                   ^ Error: expect(locator).toHaveCount(expected) failed
  176 |     await page.keyboard.press('Escape');
  177 |     await expect(page.getByTestId('day-sheet')).toBeHidden({ timeout: 2000 });
  178 |     await expect(cell(page, '2026-11-18').getByRole('button')).toBeFocused();
  179 |   });
  180 | });
  181 | 
  182 | test.describe('URL and back-button state', () => {
  183 |   test('US-E5-01/AC1 settings and back: the browser back button returns to the calendar with the same month', async ({ page }) => {
  184 |     await seed(page, STATE);
  185 |     await page.goto('./');
  186 |     await page.getByTestId('cal-next').click();
  187 |     await page.getByTestId('appbar-settings').click();
  188 |     await expect(page.getByTestId('screen-settings')).toBeVisible();
  189 |     await page.goBack();
  190 |     await expect(page.getByTestId('screen-calendar')).toBeVisible();
  191 |   });
  192 | 
  193 |   test('US-E3-05/AC9 an unknown or refresh-review deep link without a pending refresh does not crash and leaves the store alone', async ({ page }) => {
  194 |     await seed(page, STATE);
  195 |     await page.goto('./');
  196 |     const before = await readStore(page);
  197 |     for (const hash of ['#/does-not-exist', '#/refresh-review', '#/review']) {
  198 |       await page.goto(`./${hash}`);
  199 |       await expect(page.getByTestId('screen-loading')).toHaveCount(0);
  200 |       await expect(page.locator('body')).not.toContainText('Error');
  201 |     }
  202 |     expect((await readStore(page)).decisions).toEqual(before.decisions);
  203 |   });
  204 | });
  205 | 
  206 | test.describe('accessibility in both themes and both widths (US-NF-02/AC1)', () => {
  207 |   for (const scheme of ['light', 'dark'] as const) {
  208 |     for (const [w, h] of [[390, 844], [1280, 800]] as const) {
  209 |       test(`US-NF-02/AC1 US-E5-01/AC4 axe: calendar, day sheet and settings, ${scheme}, ${w}px`, async ({ page }) => {
  210 |         await page.setViewportSize({ width: w, height: h });
  211 |         await page.emulateMedia({ colorScheme: scheme });
  212 |         await seed(page, STATE);
  213 |         await page.goto('./');
  214 |         await expect(page.getByTestId('cal-grid')).toBeVisible();
  215 |         await seriousAxe(page, `calendar ${scheme} ${w}`);
  216 |         await openDay(page, '2026-11-04');
  217 |         await seriousAxe(page, `day sheet ${scheme} ${w}`);
  218 |         await page.goto('./#/settings');
  219 |         await expect(page.getByTestId('screen-settings')).toBeVisible();
  220 |         await seriousAxe(page, `settings ${scheme} ${w}`);
  221 |       });
  222 |     }
  223 |   }
  224 | });
  225 | 
```