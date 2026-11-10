# BentoMinder: microcopy sheet (ja / en) v1.0

> Status: **H2 final**, 2026-10-24; **revised 2026-10-25 (M2 prep)**: `picker.group.*` (§3) and `review.dateFix.*` (§7), see the note at the end. Supersedes `design/copy-draft.md`. Owner: Designer. The developer imports these strings into the `ja` and `en` catalogs **verbatim, by key**; QA asserts on keys (and on the literal where the story says "exact" or quotes the string).
>
> **Banned-phrase check: done.** Every ja and en value in this sheet was checked against `data/banned-phrases.json` (v1, 23 ja + 20 en phrases) with the US-E6-03/AC2 matching rule (NFKC + case-fold; ja as substring, en as whole words/word sequences) by `design/_scratch/check-copy.mjs`: **0 matches**, with **0 exemptions used** (the US-E5-07/AC2 exemption for the reservation checkbox is not needed: its en label avoids "reserved"). Assessment strings (`assess.*`, `state.*`) were also checked for 「よくない」, "unsuitable", "avoid" (US-E4-04/AC1): 0 matches. Strings were also checked against the US-E7-06/AC2 examples (「閉じていても通知」, "even when closed", "push notification") and the US-E9-02/AC2 sync claim: 0 matches.

## 0. Conventions

- **Column "story/AC"**: `(verbatim)` = the AC quotes this exact text; it must not change without a story change. `(AC en)` = the AC also fixes the English. No marker = designer copy, free to refine later through this sheet.
- **Placeholders** use ICU MessageFormat: `{date}`, `{n}`, `{recipe}`… Plurals: `{n, plural, one {…} other {…}}` (en only; Japanese has no plural). Never build a sentence by concatenating keys.
- **Dates** (US-E8-03/AC1): `{date}` = ja 「11月4日（水）」 / en "Wed, Nov 4"; `{dateShort}` = ja 「11月4日」 / en "Nov 4"; `{month}` = ja 「2026年11月」 / en "November 2026"; `{m}` = month number (ja 「11」 → 「11月」) / en month name ("November"). Times `17:30` in both. No 令和 (US-E8-03/AC2). The weekday character in `（水）` is the full-width-paren pattern of the AC.
- **Japanese counters**: 「つ」 for 1–9, 「個」 for 10 and more (natural Japanese). Implemented as `{n, select …}` in the ja catalog: e.g. `assess.low` with n = 12 reads 「苦手な食材が12個含まれています」.
- **Lists** inside a sentence: ja joined with 「、」, en with ", ". More than 3 items: the first 3 + `common.andMore`.
- **Voice**: ja です・ます, short, one request per sentence; describes the child's taste, never judges food; never promises safety, delivery, booking or sync. en: plain, friendly, short; "your child" (the nickname is never inserted in assessment text, so the catalogs stay neutral).
- **Menu dish names** stay as imported (Japanese) in both languages (US-E8-01/AC4). **Recipe names** come from data (`name.ja` / `name.en`), not from this sheet.
- **Dev-only strings** (§18) live in a separate `debug` catalog that is only imported by the debug module, so the production bundle contains none of them (BR-24, US-E11-01/AC2). They are still listed here so the copy is reviewed.
- Keys marked **(v1)** are written now so v1 doesn't need a copy round; they must not ship in the MVP catalogs.

---

## 1. Global, app bar, common actions

| key | ja | en | where | story/AC |
|---|---|---|---|---|
| app.name | BentoMinder | BentoMinder | App bar, title | |
| app.tagline | おべんとう、忘れない。 | Never forget a bento day. | Onboarding hero, document title suffix | brief |
| app.docTitle | {screen}｜BentoMinder | {screen} · BentoMinder | `<title>` per screen | |
| lang.toggle.ja | 日本語 | 日本語 | Language segmented control, left side (always Japanese) | US-E8-01/AC2, US-E8-02/AC2 |
| lang.toggle.en | EN | EN | Language segmented control, right side | US-E8-01/AC2 |
| lang.toggle.aria | 表示言語 | Display language | Group label of the toggle | US-E8-01/AC2 |
| nav.recipes | レシピ | Recipes | App-bar icon button label | US-E6-05 |
| nav.settings | 設定 | Settings | App-bar icon button label | US-E7-04 |
| nav.calendar | カレンダー | Calendar | Back target name, breadcrumbs | |
| nav.back | 戻る | Back | Top-bar back button | |
| nav.backTo | {screen}に戻る | Back to {screen} | Back button accessible name | |
| nav.skip | 本文へ移動 | Skip to main content | Skip link (first focus stop) | US-NF-02/AC2 |
| common.close | 閉じる | Close | Sheet/dialog close | |
| common.cancel | キャンセル | Cancel | Dialog secondary | US-E5-06/AC3 (verbatim), US-E1-05/AC3 (verbatim), US-E1-06/AC1 (verbatim) |
| common.next | 次へ | Next | Onboarding step 1 | US-E1-02/AC1 (verbatim) |
| common.save | 保存 | Save | Profile edit, settings forms | |
| common.retry | もう一度 | Try again | Import error actions | US-E2-05/AC2 (verbatim) |
| common.retryIn | もう一度（あと{s}秒） | Try again (in {s} s) | Disabled retry with countdown | US-E2-06/AC6, AC9 (verbatim pattern) |
| common.loading | 読み込んでいます… | Loading… | Generic loading (screen reader text for skeletons) | |
| common.optional | 任意 | optional | Field label suffix | |
| common.required | 必須 | required | Field label suffix | |
| common.andMore | ほか{n}つ | and {n} more | Shortened lists | |
| assess.labels.more | {list}、ほか{n, select, 1 {1つ} 2 {2つ} 3 {3つ} 4 {4つ} 5 {5つ} 6 {6つ} 7 {7つ} 8 {8つ} 9 {9つ} other {{n}個}} | {list} and {n} more | The `{labels}` / `{liked}` / `{disliked}` / `{unmatched}` value of an `assess.*` explanation when the count is larger than the 3 names given: `{list}` = the 3 names joined with 「、」 / ", "; `{n}` = count − 3. e.g. 「ピーマン、なす、にんじん、ほか2つ」 / "green pepper, eggplant, carrot and 2 more". The sentence count stays the full D or L (contract §3.5 `explanationParams`, M2 prep) | US-E4-02/AC1 |
| common.selected | 選択中 | selected | Screen-reader suffix on chips | |
| common.error.generic | うまくいきませんでした。もう一度お試しください。 | Something went wrong. Please try again. | Unexpected error fallback | |
| common.newWindow | （新しいタブで開きます） | (opens in a new tab) | Suffix on external links | |
| common.japanTime | （日本時間） | (Japan time) | After any time when the device timezone isn't Asia/Tokyo | US-E7-07/AC2 (verbatim, AC en) |
| notFound.title | ページが見つかりません | Page not found | Not-found route (also /debug in production) | US-E11-01/AC2 |
| notFound.back | カレンダーに戻る | Back to the calendar | Not-found action | |

## 2. Dates, weekdays, formats

| key | ja | en | where | story/AC |
|---|---|---|---|---|
| fmt.month | {year}年{monthNumber}月 | {monthName} {year} | Calendar header, settings | US-E5-01/AC2 「2026年11月」, US-E8-03/AC1 (verbatim pattern) |
| fmt.date | {monthNumber}月{day}日（{wd}） | {wdShort}, {monShort} {day} | Everywhere a date is shown | US-E8-03/AC1, US-E5-02/AC1 (verbatim pattern) |
| fmt.dateNoWd | {monthNumber}月{day}日 | {monShort} {day} | Inside sentences that already name the weekday; cancel dialog | US-E5-06/AC3 |
| fmt.range | {from}〜{to} | {from} – {to} | Weekly reminder, share header | US-E9-01/AC1 |
| wd.short.0 … 6 | 日 / 月 / 火 / 水 / 木 / 金 / 土 | Sun / Mon / Tue / Wed / Thu / Fri / Sat | Weekday header, dates | US-E5-01/AC2, AC8 |
| wd.long.0 … 6 | 日曜日 / 月曜日 / 火曜日 / 水曜日 / 木曜日 / 金曜日 / 土曜日 | Sunday / Monday / Tuesday / Wednesday / Thursday / Friday / Saturday | Explanations, settings | US-E4-02/AC1, US-E5-01/AC8 |
| fmt.weekdayLunch | {wdLong}の給食 | {wdLongEn}'s lunch | (used inside assess.*) | US-E4-02/AC1 |
| fmt.minutes | 約{n}分 | About {n} min | Recipe time | US-E6-01/AC2 |
| fmt.dayCount | {n}日 | {n, plural, one {# day} other {# days}} | Counts | |

## 3. Onboarding frame and step 1: profile (also used by profile edit)

| key | ja | en | where | story/AC |
|---|---|---|---|---|
| ob.stepper.label | ステップ {n} / 3 | Step {n} of 3 | Stepper text (also its accessible name) | US-E1-01/AC1 |
| ob.stepper.done | 完了 | done | Screen-reader suffix on a finished step | US-E1-01/AC1 |
| ob.stepper.current | 入力中 | current | Screen-reader suffix on the current step (with aria-current="step") | US-E1-01/AC1 |
| ob.step1.name | お子さまのこと | About your child | Step 1 title, stepper label | US-E1-01/AC1 (verbatim) |
| ob.step2.name | 献立の取り込み | Import the menu | Step 2 title, stepper label | US-E1-01/AC3 (verbatim) |
| ob.step3.name | 献立の確認 | Check the menu | Step 3 title, stepper label | US-E1-01/AC1 |
| ob.welcome.title | おべんとう、忘れない。 | Never forget a bento day. | Step 1 hero line | |
| ob.welcome.lead | 3つのステップで、給食の献立カレンダーができあがります。 | Three short steps and your lunch calendar is ready. | Step 1 lead | US-E1-01/AC1 |
| ob.privacy.local | 入力した内容は、この端末だけに保存されます。 | What you enter is saved only on this device. | Step 1 note | BR-22 |
| profile.nickname.label | ニックネーム | Nickname | Field label (+ common.optional) | US-E1-02/AC5 |
| profile.nickname.hint | アプリの中だけで使います（20文字まで）。 | Used only inside the app (up to 20 characters). | Field hint | US-E1-02/AC5 |
| profile.nickname.counter | {n}/20 | {n}/20 | Character counter | US-E1-02/AC5 |
| profile.age.label | 年齢 | Age | Chip-group legend (+ common.required) | US-E1-02/AC1 |
| profile.age.under3 | 3歳未満 | Under 3 | Age chip `age-under-3` | |
| profile.age.3to4 | 年少（3〜4歳） | Nursery year 1 (3–4) | Age chip `age-3-4` | |
| profile.age.4to5 | 年中（4〜5歳） | Nursery year 2 (4–5) | Age chip `age-4-5` | US-E1-02/AC1 (verbatim) |
| profile.age.5to6 | 年長（5〜6歳） | Nursery year 3 (5–6) | Age chip `age-5-6` | |
| profile.age.6to9 | 小学校低学年（6〜9歳） | Primary, lower years (6–9) | Age chip `age-6-9` | |
| profile.age.9to12 | 小学校高学年（9〜12歳） | Primary, upper years (9–12) | Age chip `age-9-12` | |
| profile.age.error | 年齢を選んでください | Please choose an age | Inline error, focus moves to the group | US-E1-02/AC4 (verbatim) |
| profile.likes.label | 好きな食べもの | Foods your child likes | Picker legend | US-E1-02/AC2 |
| profile.dislikes.label | 苦手な食べもの | Foods your child doesn't like | Picker legend | US-E1-02/AC2 |
| profile.foods.hint | 食材のほか、「さかな」のような種類でも選べます（30個まで）。 | Pick single foods or whole groups such as "fish" (up to 30). | Picker hint | US-E1-02/AC2, BR-20 |
| profile.foods.search | 食べものを探す | Search foods | Search input label/placeholder | US-E1-02/AC2 |
| profile.foods.searchEmpty | 「{q}」は見つかりませんでした。別の言い方で探してください。 | No match for "{q}". Try another word. | Search empty state | |
| profile.foods.popular | よく選ばれる食べもの | Common choices | Suggested chips heading | |
| profile.foods.limit | 30個まで選べます | You can pick up to 30 | Inline notice when the 31st is tapped | BR-20 |
| profile.foods.moved.toLikes | 「{food}」を苦手から好きに移しました | Moved "{food}" from dislikes to likes | Polite live-region notice | US-E1-02/AC3 |
| profile.foods.moved.toDislikes | 「{food}」を好きから苦手に移しました | Moved "{food}" from likes to dislikes | Polite live-region notice | US-E1-02/AC3 |
| profile.foods.remove | 「{food}」を外す | Remove "{food}" | Accessible name of a selected chip's remove button | |
| profile.foods.empty | まだ選んでいません | Nothing chosen yet | Empty selection | |
| picker.group.ingredient | 食材 | Ingredient | Result-group heading, kind `ingredient` (group 1) | US-E1-02/AC8 (verbatim, ja + en) |
| picker.group.dish | 料理 | Dish | Result-group heading, kind `dish` (group 2) | US-E1-02/AC8 (verbatim, ja + en) |
| picker.group.category | 種類 | Food group | Result-group heading, kind `category`, e.g. 「さかな」 (group 3) | US-E1-02/AC8 (verbatim, ja + en) |
| picker.withKind | {food}（{kind}） | {food} ({kind}) | Accessible name of every result, popular and selected chip; visible on a selected chip only when another selected chip has the same label. `{kind}` = the `picker.group.*` text | US-E1-02/AC8 (verbatim pattern) |
| profile.note.label | メモ | Note | Field label (+ common.optional) | US-E1-02/AC7 |
| profile.note.placeholder | 例：野菜は細かく切ると食べます | e.g. Eats vegetables when they're chopped small | Placeholder | US-E1-02/AC7 |
| profile.note.hint | 判定やレシピ選びには使いません。どこにも送られません（200文字まで）。 | Not used for assessments or recipes, and never sent anywhere (up to 200 characters). | Field hint | US-E1-02/AC7 |
| profile.note.counter | {n}/200 | {n}/200 | Counter | |

## 4. Allergies

| key | ja | en | where | story/AC |
|---|---|---|---|---|
| allergy.label | 食物アレルギー | Food allergies | Radio-group legend (+ common.required) | US-E1-03/AC3 |
| allergy.helper | 登録した情報だけをもとにレシピを絞り込みます。市販品の原材料や、登録していない食材までは確認できません。 | Recipes are filtered only by what you register here. The app can't check the ingredients of store-bought products or anything you haven't registered. | Helper under the legend | US-E1-03/AC6 |
| allergy.status.none | 特になし | None known | Radio | US-E1-03/AC3 (verbatim) |
| allergy.status.has | アレルギーあり | Has allergies | Radio | US-E1-03/AC3 (verbatim) |
| allergy.status.unknown | わからない・未確認 | Don't know yet | Radio | US-E1-03/AC3 (verbatim) |
| allergy.status.error | アレルギーについて、どれか1つを選んでください | Please choose one option about allergies | Inline error | US-E1-03/AC3 |
| allergy.pick.mandatory | 表示が義務の9品目 | The 9 mandatory label items | Group heading (scheme caa-2026-04: 9 items incl. cashew) | PLAN §4 |
| allergy.pick.recommended | 表示が推奨の20品目 | The 20 recommended label items | Group heading | PLAN §4 |
| allergy.pick.other | その他の食材 | Other foods | Search group for excluded ingredients | US-E1-03/AC2 (verbatim) |
| allergy.pick.otherHint | 表示の対象にない食材は、ここで探して追加します。 | Add foods that aren't on the label list here. | Hint | US-E1-03/AC2 |
| allergy.pick.error | アレルギーの食材を1つ以上選んでください | Please choose at least one allergy food | Inline error | US-E1-03/AC4 (verbatim) |
| allergy.unknown.banner | アレルギー情報が未登録です。材料の表示を必ずご確認ください。 | No allergy information is registered. Always check the ingredient labels. | Warning banner above recipes when status = unknown | US-E1-03/AC5 (verbatim) |
| allergy.processed.hint | 市販品を使うレシピには、登録したアレルゲンを挙げて、パッケージの表示を確認するようご案内します。 | For recipes that use store-bought products, the app lists the allergens you register and reminds you to check the package label. | Hint under the allergen picker; only when 「アレルギーあり」 is selected and at least one allergen is chosen | US-E1-03/AC7 |


Allergen names come from the dictionary (`alg-*` labels, ja/en). Diet and theme names:

## 5. Diet and themes

| key | ja | en | where | story/AC |
|---|---|---|---|---|
| diet.label | 食事の制限 | Dietary restrictions | Chip-group legend (+ common.optional) | US-E1-04 |
| diet.hint | 選んだ条件に合わないレシピは提案しません。 | Recipes that don't fit are never suggested. | Hint | US-E1-04/AC1 |
| diet.vegetarian | ベジタリアン（肉・魚なし） | Vegetarian (no meat or fish) | Chip | US-E1-04/AC4 |
| diet.pescatarian | ペスカタリアン（肉なし・魚は可） | Pescatarian (no meat, fish OK) | Chip | |
| diet.noPork | 豚肉なし | No pork | Chip | US-E1-04/AC1 (verbatim) |
| diet.noBeef | 牛肉なし | No beef | Chip | US-E1-04/AC2 |
| diet.noSeafood | 魚介なし | No seafood | Chip | US-E6-02/AC7 |
| theme.label | すきなテーマ | Favourite themes | Chip-group legend (+ common.optional) | US-E1-04/AC3 (verbatim) |
| theme.hint | お弁当の飾りつけのヒントに使います（3つまで）。 | Used for decoration ideas (up to 3). | Hint | US-E1-04/AC3 |
| theme.limit | テーマは3つまで選べます | You can choose up to 3 themes | Inline notice, polite live region | US-E1-04/AC3 (verbatim) |

Theme names come from the dictionary (`theme-*`: どうぶつ, きょうりゅう, のりもの, おはな, ほし・うちゅう, うみのいきもの, きせつ・行事, カラフル).

## 6. Step 2: import the menu (also 「献立を取り込む」 from settings and cards)

| key | ja | en | where | story/AC |
|---|---|---|---|---|
| import.title | 給食の献立表を取り込みます | Import the school lunch menu | Screen title | US-E2-01 |
| import.lead | 園が公開している月間献立表（PDF）のURLを入力するか、PDFファイルを選んでください。 | Enter the address of the monthly menu PDF your school publishes, or choose the PDF file. | Lead | US-E2-01, US-E2-03 |
| import.month.label | 取り込む月 | Month to import | Month select | US-E2-01/AC5, US-E3-04/AC1 |
| import.url.label | 献立表PDFのURL | Menu PDF address (URL) | Field label | US-E2-01 |
| import.url.placeholder | https://… | https://… | Placeholder | BR-14 |
| import.url.hint | 次の月からも同じURLを使えます。 | We'll keep this address for next month. | Hint | US-E2-01/AC4 |
| import.url.error | PDFのURL（https://…）を入力してください | Enter the PDF's address (https://…) | Inline error | US-E2-01/AC2 (verbatim) |
| import.submit | 取り込む | Import | Primary button | US-E2-01/AC1 (verbatim) |
| import.or | または | or | Divider | |
| import.upload | PDFファイルを選ぶ | Choose a PDF file | Secondary button (becomes primary after a fetch error) | US-E2-02/AC1 (verbatim) |
| import.upload.selected | 選んだファイル：{filename} | Selected file: {filename} | After picking | US-E2-02/AC2 |
| import.later | あとで取り込む | Import later | Text button, onboarding only | US-E1-01/AC5 (verbatim) |
| import.manual | 手入力する | Enter it by hand | Text button | US-E2-05/AC2 (verbatim), US-E3-04/AC1 (verbatim) |
| import.privacy.title | AIに送る内容 | What is sent to the AI | Box title | US-NF-03 |
| import.privacy.body | 送るのは献立表のPDFだけです。お子さまのことや、ご家族の予定は送りません。 | Only the menu PDF is sent. Nothing about your child or your family's plans. | Box body | US-E2-04/AC7, US-NF-03 |
| import.privacy.more | くわしく見る | Read more | Opens the consent text (read-only) | US-E2-08 |
| import.progress | 献立を読み取っています… | Reading the menu… | Progress screen | US-E2-01/AC1 (verbatim) |
| import.progress.sub | 1分ほどかかることがあります。このままお待ちください。 | This can take about a minute. Please keep this screen open. | Progress sub-line | US-NF-04/AC3 |
| import.progress.fetching | PDFを取得しています… | Getting the PDF… | Progress step 1 (URL path) | US-E2-01 |
| import.progress.cancel | 中止する | Stop | Cancel the running import | US-E2-04/AC8 |
| import.sameFile | 同じファイルです | This is the same file | Info banner on review when sha256 matches | US-E2-07/AC1 (verbatim) |
| import.sameFile.sub | 前に読み取った内容を表示しています（AIは使っていません）。 | Showing the earlier reading (the AI wasn't used again). | Sub-line | US-E2-07/AC1 |
| import.err.network | URLから取得できませんでした。PDFをアップロードしてください。 | We couldn't get the file from this address. Please upload the PDF. | Error panel | US-E2-02/AC1 (verbatim, AC en) |
| import.err.notFound | ファイルが見つかりませんでした。URLを確かめるか、PDFをアップロードしてください。 | No file was found at this address. Check the address or upload the PDF. | Error panel | US-E2-02/AC1 (verbatim, AC en) |
| import.err.blocked | このサイトからは自動で取得できません。PDFを保存してから、アップロードしてください。 | This site doesn't allow automatic downloads. Save the PDF, then upload it. | Error panel (403, CORS-type, private address, > 3 redirects) | US-E2-02/AC1, AC3 (verbatim, AC en) |
| import.err.notPdfUrl | PDFではないようです。献立表PDFのURLを入力するか、PDFをアップロードしてください。 | This doesn't look like a PDF. Enter the menu PDF's address or upload the PDF. | Error panel | US-E2-02/AC1 (verbatim, AC en) |
| import.err.tooLarge | ファイルが大きすぎます（10MBまで） | The file is too large (10 MB max) | Error (upload and server fetch) | US-E2-02/AC3, US-E2-03/AC3 (verbatim) |
| import.err.notPdfFile | PDFファイルを選んでください | Please choose a PDF file | Error (upload) | US-E2-03/AC2 (verbatim) |
| import.err.unreadable | このPDFは読み取れませんでした | We couldn't read this PDF | Error (0-byte, encrypted) | US-E2-03/AC4 (verbatim) |
| import.err.malformed | 献立を読み取れませんでした。時間をおいて再度お試しください。 | We couldn't read the menu. Please try again later. | Error panel | US-E2-05/AC2 (verbatim, AC en) |
| import.err.unavailable | 読み取りサービスに接続できませんでした。時間をおいて再度お試しください。登録済みの献立と予定はそのままです。 | We couldn't reach the reading service. Please try again later. Your saved menus and plans are unchanged. | Error panel (also HTTP 400/403/404 from the provider) | US-E2-06/AC2, AC7 (verbatim, AC en) |
| import.err.busy | 混み合っています。1分ほどしてからもう一度お試しください。 | The service is busy. Please try again in about a minute. | Error panel (rate limit, proxy cap) | US-E2-06/AC6, AC8 (verbatim, AC en) |
| import.err.notConfigured | 読み取り機能が設定されていません | Menu reading isn't set up | Error panel | US-E2-06/AC4 (verbatim) |
| import.err.notConfigured.dev | 開発中は、デバッグパネルの「サンプルの献立（2026年11月）」を使えます。 | In development, use "Sample menu (November 2026)" in the debug panel. | Dev builds only (debug catalog) | US-E2-06/AC4 |
| import.err.offline | オフラインのため取り込めません | You're offline, so the menu can't be imported | Error panel; import button disabled | US-E10-01/AC3 (verbatim) |
| import.err.otherPaths | ほかの方法 | Other ways | Heading above upload / manual actions in the error panel | US-E2-05/AC2 |
| import.err.urlKept | 入力したURLはそのまま残しています。 | The address you entered is kept. | Sub-line under fetch errors | US-E2-02/AC1 |
| import.replace.title | {m}月の献立を置き換えますか？ | Replace the {m} menu? | Confirm dialog title | US-E3-05/AC4 |
| import.replace.body | いま使っている{m}月の献立は、新しく確定した内容に置き換わります。お弁当の予定は変更されません。 | The current {m} menu will be replaced by the one you confirm next. Your bento plans won't change. | Dialog body | US-E3-05/AC4 (contains 「お弁当の予定は変更されません」 verbatim) |
| import.replace.confirm | 取り込む | Import | Dialog primary | US-E3-05/AC4 |

### Consent notice (before the first AI reading)

| key | ja | en | where | story/AC |
|---|---|---|---|---|
| consent.title | AIでの読み取りについて | About reading the menu with AI | Dialog title | US-E2-08/AC1 |
| consent.p1 | 献立表のPDFは、GoogleのAIサービス（Gemini）に送られ、カレンダー用のデータに変換されます。送るのは園が公開している献立表PDFだけです。 | The menu PDF is sent to Google's AI service (Gemini), which turns it into calendar data. We send only the public menu PDF from your school. | Paragraph (facts 1) | US-E2-08/AC4 |
| consent.p2 | お子さまの名前・年齢・アレルギー・好みや、ご家族の予定は送りません（この端末だけに保存されます）。 | Nothing about your child (name, age, allergies, likes) and none of your family's plans is sent; they stay on this device. | Paragraph (fact 2) | US-E2-08/AC4 |
| consent.p3 | BentoMinderはGeminiの無料枠を使っています。無料枠では、送った内容と結果がGoogleのサービス改善に使われ、担当者が内容を読む場合があります。 | BentoMinder uses Gemini's free tier. On the free tier, Google may use what is sent and the result to improve its products, and human reviewers may read it. | Paragraph (facts 3, 4) | US-E2-08/AC4 |
| consent.p4 | このアプリは保護者向けです（Geminiの利用規約により18歳以上）。読み取り機能は日本国内でご利用ください。 | This app is for parents (Gemini's terms require users to be 18 or older). Please use the menu import in Japan. | Paragraph (facts 5, 6) | US-E2-08/AC4 |
| consent.link | Gemini API 利用規約（英語） | Gemini API terms | Link to https://ai.google.dev/gemini-api/terms + common.newWindow | US-E2-08/AC4 |
| consent.accept | 同意して読み取る | Agree and read | Primary | US-E2-08/AC1 (verbatim) |
| consent.decline | 同意しない | Don't agree | Secondary | US-E2-08/AC2 (verbatim) |
| consent.declined | AIは使いません。献立は手入力できます。 | The AI won't be used. You can enter the menu by hand. | Info line after declining, with import.manual | US-E2-08/AC2 |

## 7. Step 3: review, edit, confirm (also manual entry and refresh)

| key | ja | en | where | story/AC |
|---|---|---|---|---|
| review.title | {m}月の献立を確認 | Check the {m} menu | Screen title | US-E3-01 |
| review.lead | 献立表と見くらべて、違うところがあれば直してください。 | Compare with the menu sheet and fix anything that's wrong. | Lead | US-E3-01 |
| review.manual.title | {m}月の献立を入力 | Enter the {m} menu | Title in manual mode | US-E3-04/AC1 |
| review.uncertain.summary | 確認が必要な項目：{n}件 | Items to check: {n} | Summary at the top | US-E3-01/AC2 (verbatim) |
| review.uncertain.none | 確認が必要な項目はありません | Nothing needs checking | Summary when 0 | US-E3-01/AC2 |
| review.uncertain.next | 次の要確認へ | Next item to check | Button: moves focus | US-E3-01/AC2 (verbatim) |
| review.uncertain.tag | 要確認 | Check | Tag on an uncertain field (with warning icon) | US-E3-01/AC2 |
| review.reason.lowLegibility | 読み取りにくい文字があります | Some characters were hard to read | Reason line | US-E2-04/AC4 |
| review.reason.weekdayMismatch | 日付と曜日が合いません（献立表では「{printed}」） | The date and weekday don't match (the sheet says "{printed}") | Reason line | US-E2-05/AC5 |
| review.reason.duplicateDate | 同じ日付が複数あったため、1つにまとめました | This date appeared more than once, so the entries were combined | Reason line | US-E2-05/AC6 |
| review.reason.ambiguous | どちらの意味か選んでください | Please choose which one is meant | Reason line + choice | US-E4-01/AC6 |
| review.reason.other | 内容を確かめてください | Please check this entry | Reason line | |
| review.accept | このままにする | Keep as is | Per-field action: stores the field as `uncertain-accepted` (same as the confirm dialog, field by field) | US-E3-03/AC2, AC4 (verbatim) |
| review.openPdf | 元のPDFを見る | Open the original PDF | Link/button | US-E3-01/AC3 (verbatim) |
| review.day.empty | 献立に記載なし | Not on the menu | Weekday row without an entry | US-E3-01/AC1 (verbatim) |
| review.day.noLunch | 給食なし | No school lunch | Row state label | US-E3-01/AC1 (verbatim) |
| review.day.weekendNote | 土日は献立表に書かれている場合だけ表示します。 | Weekends appear only when the sheet lists them. | Note above the list | US-E3-01/AC1 |
| review.dish.label | 料理名 | Dish | Field label (visually hidden in rows) | US-E3-02 |
| review.dish.error | 料理名は1〜40文字で入力してください | Dish names must be 1–40 characters | Inline error | US-E3-02/AC4 (verbatim) |
| review.dish.add | 料理を追加 | Add a dish | Button | US-E3-02/AC5 (verbatim) |
| review.dish.addLimit | 1日12品まで | Up to 12 dishes a day | Hint when add is disabled | US-E3-02/AC5 (verbatim) |
| review.dish.remove | 「{dish}」を削除 | Remove "{dish}" | Icon button accessible name | US-E3-02/AC2 |
| review.dish.snack | おやつ | Snack | Kind tag on snack items | US-E4-01/AC9 |
| review.ingredients | 材料 | Ingredients | Sub-heading | |
| review.ingredients.notListed | 材料の記載なし | No ingredients listed | When ingredientsStatus = not-listed | US-E2-04/AC2 |
| review.ingredients.unreadable | 材料を読み取れませんでした | Ingredients couldn't be read | When unreadable | |
| review.allergens | 献立表のアレルゲン表示 | Allergens printed on the menu | Sub-heading | US-E4-05 |
| review.allergens.notDeclared | 記載なし | Not printed | status not-declared | BR-08 |
| review.allergens.unreadable | 読み取れませんでした | Couldn't be read | status unreadable | BR-08 |
| review.allergens.declaredNone | 献立表の記載：「{raw}」 | The sheet says: "{raw}" | status declared-none: quotes the PDF, never a summary | BR-08, US-E2-04/AC3 |
| review.noLunch.toggle | 給食なしの日にする | Mark as a no-lunch day | Toggle/button on a day | US-E3-02/AC3, AC6 (verbatim) |
| review.noLunch.restore | 給食のある日 | Day with cafeteria lunch | Undo on a no-lunch day | US-E3-02/AC3 (verbatim) |
| review.noLunch.reason | 理由 | Reason | Radio-group legend | US-E3-02/AC6 |
| review.noLunch.bentoDay | お弁当の日（手づくり） | Homemade bento day | reason bento-day | US-E3-02/AC6 (verbatim), US-E5-08 |
| review.noLunch.noLunch | 給食なし（午前保育など） | No lunch (half day etc.) | reason no-lunch | US-E3-02/AC3, AC6 (verbatim) |
| review.noLunch.closed | お休み（休園など） | School closed | reason closed | US-E3-02/AC6 (verbatim) |
| review.noLunch.unknown | その他 | Other | reason unknown | US-E3-02/AC6 (verbatim) |
| review.noLunch.text | 献立表での書き方 | Wording on the sheet | originalText field (1–60), e.g. 「行事」 | US-E3-02/AC3, AC6 (verbatim) |
| review.noLunch.hiddenDishes | この日の料理{n}品は、確定するまで元に戻せます | {n, plural, one {# dish} other {# dishes}} can be restored until you confirm | Note | US-E3-02/AC3 |
| review.outOfMonth.title | 対象月以外の日付（取り込みません） | Dates outside this month (not imported) | Collapsed list | US-E2-05/AC4 (verbatim) |
| review.warn.monthMismatch | 献立表の月が、選んだ月（{m}月）と違うようです。 | The sheet seems to be for a different month than {m}. | Warning banner (warnings[]) | US-E3-01/AC4 (verbatim) |
| review.warn.pagesUnreadable | 読み取れないページがありました。抜けている日がないか確かめてください。 | Some pages couldn't be read. Check that no days are missing. | Warning banner | US-E3-01/AC4 (verbatim) |
| review.warn.layout | 献立表の形式をうまく読み取れなかった可能性があります。 | The sheet's layout may not have been read correctly. | Warning banner | US-E3-01/AC4 (verbatim) |
| review.warn.partial | 一部の日だけ読み取れました。足りない日は入力してください。 | Only some days were read. Please add the missing ones. | Warning banner | US-E3-01/AC4 (verbatim) |
| review.confirm | この内容で確定 | Confirm this menu | Primary (sticky footer) | US-E3-03/AC1 (verbatim) |
| review.confirm.emptyManual | 少なくとも1日分を入力してください | Enter at least one day | Disabled-confirm hint | US-E3-04/AC2 (verbatim) |
| review.confirm.hasErrors | 入力の誤りを直すと確定できます | Fix the highlighted entries to confirm | Disabled-confirm hint (dish errors) | US-E3-02/AC4 |
| review.uncertainDialog.title | 確認が必要な項目が{n}件あります。このまま確定しますか？ | {n, plural, one {# item still needs} other {# items still need}} checking. Confirm anyway? | Dialog | US-E3-03/AC2 (verbatim) |
| review.uncertainDialog.confirm | 確定する | Confirm | Dialog primary | US-E3-03/AC2 (verbatim) |
| review.uncertainDialog.back | 戻る | Go back | Dialog secondary | US-E3-03/AC2 (verbatim) |
| review.leave.title | 確認を中断しますか？ | Stop checking? | Dialog when leaving review | US-E3-03/AC5 (verbatim), US-E3-05/AC5 |
| review.leave.body | 確定していない内容は、カレンダーには使われません。ここまでの修正は保存されませんが、あとでもう一度確認できます。 | Nothing unconfirmed is used in the calendar. Changes made so far aren't saved, but you can check the menu again later. | Dialog body | US-E3-03/AC5, US-E3-05/AC5 |
| review.leave.confirm | 中断する | Stop | Dialog primary | US-E3-03/AC5 (verbatim) |
| review.leave.stay | 確認を続ける | Keep checking | Dialog secondary | US-E3-03/AC5 (verbatim) |
| review.done | {m}月の献立を確定しました | The {m} menu is confirmed | Toast after a successful write | US-E3-03/AC1 |

### Date correction (weekday mismatch; added 2026-10-25, components §6.9)
`{date}` uses `fmt.date`; `{printedDate}` is the day's `printedDateText` and `{printed}` its printed weekday character (both as printed, Japanese, `lang="ja"` in EN). ja strings quoted by US-E2-05/AC7–AC9 are verbatim; the en strings are designer copy.

| key | ja | en | where | story/AC |
|---|---|---|---|---|
| review.dateFix.open | 日付を直す | Fix the date | Secondary small button on a day flagged weekday-mismatch (and on a corrected day), next to `review.accept` | US-E2-05/AC5, AC7 (verbatim), AC10 |
| review.dateFix.openAria | {date}の日付を直す | Fix the date of {date} | Accessible name of that button | US-E2-05/AC7 |
| review.dateFix.title | 正しい日付を選んでください | Choose the correct date | Sheet/popover title | US-E2-05/AC7 |
| review.dateFix.context | 献立表では「{printedDate}」です。いまは{date}になっています。 | The sheet says "{printedDate}". This day is set to {date} now. | Context line under the title | US-E2-05/AC7 |
| review.dateFix.contextWeekday | 献立表の曜日は「{printed}」です。いまは{date}になっています。 | The sheet shows "{printed}" as the weekday. This day is set to {date} now. | Context line when printedDateText is null | US-E2-05/AC7 |
| review.dateFix.gridLabel | {month}から日付を選ぶ | Pick a date in {month} | `aria-label` of the mini-grid | US-E2-05/AC7 |
| review.dateFix.cell.match | 曜日が一致 | Same weekday | Legend item + cell accessible-name suffix (bar marker) | US-E2-05/AC7 (verbatim) |
| review.dateFix.cell.taken | ほかの献立があります | Has another entry | Legend item + suffix of a date that can't be chosen (dot marker) | US-E2-05/AC8 (verbatim) |
| review.dateFix.cell.current | いまの日付 | Current date | Legend item + suffix of the day's own date (dashed marker) | US-E2-05/AC7 |
| review.dateFix.selected | {date}に移します | Moving to {date} | Status line after selecting a free date (polite) | US-E2-05/AC7 |
| review.dateFix.otherWeekday | 献立表の曜日（{printed}）とは違う曜日です。この日でよければ、そのまま進めてください。 | This isn't the weekday on the sheet ({printed}). If this date is right, go ahead. | Info line when the selected weekday differs | US-E2-05/AC7 |
| review.dateFix.cantChoose | {date}は選べません：{reason} | {date} can't be chosen: {reason} | Status line when a taken or current date is activated; `{reason}` = `cell.taken` / `cell.current` text | US-E2-05/AC8 |
| review.dateFix.noFree | 移せる日がありません | There's no free date to move to | Status line when no date of the month is free | US-E2-05/AC8 (verbatim) |
| review.dateFix.apply | この日にする | Use this date | Primary | US-E2-05/AC7 |
| review.dateFix.applyHint | 移す日を選んでください | Choose a date first | Hint while apply is disabled | US-E2-05/AC7 |
| review.dateFix.moved | {from}の献立を{to}に移しました | Moved the {from} entry to {to} | Polite live message after apply (`{from}`, `{to}` = `fmt.date`) | US-E2-05/AC7 |
| review.dateFix.printed | 献立表の表記：{printedDate} | On the sheet: {printedDate} | Line on a corrected row | US-E2-05/AC9 (verbatim) |

### Ambiguity chooser

| key | ja | en | where | story/AC |
|---|---|---|---|---|
| amb.title | 「{surface}」はどちらですか？ | Which "{surface}" is it? | Chooser legend | US-E4-01/AC6 |
| amb.curry.dish | カレーライス（料理） | Curry and rice (dish) | Option | US-E4-01/AC6 (verbatim) |
| amb.curry.powder | カレー粉（調味料） | Curry powder (seasoning) | Option | US-E4-01/AC6 (verbatim) |
| amb.curry.roux | カレールウ（調味料） | Curry roux (seasoning) | Option | dictionary §7 |
| amb.unsure | わからない | Not sure | Option: leaves it unresolved (counts towards U) | US-E4-01/AC13 |
| amb.option | {label} | {label} | Other groups: options use the dictionary labels | dictionary §7 |
| amb.nonFood | {reading}（食べものではない） | "{reading}" (not a food) | Option for a group's non-food reading: amb-aji → 「味（食べものではない）」, amb-nashi → 「無し（食べものではない）」; `{reading}` is Japanese (`lang="ja"` in EN); choosing it stores `resolvedIds: []` (M2 prep) | US-E4-01/AC21 (verbatim ja) |

### Refresh: needs-review list (after confirming a replacement menu)

| key | ja | en | where | story/AC |
|---|---|---|---|---|
| refresh.review.title | 確認が必要な日 | Days to check | List heading | US-E3-05/AC8, AC9, AC11, AC12 (verbatim) |
| refresh.review.lead | 献立の更新で内容が変わった日です。予定と、手動で変えた判定はそのまま残しています。 | The menu update changed these days. Your plans and the assessments you changed yourself were kept as they were. | Lead | US-E3-05/AC9, BR-13 |
| refresh.review.item.planned | 手作りお弁当の予定があります | Homemade bento planned | Row reason | US-E3-05/AC9 |
| refresh.review.item.notConfirmed | 「あとで決める」にしています | Marked "decide later" | Row reason | US-E3-05/AC12 |
| refresh.review.item.override | 判定を手動で変更しています | You changed the assessment | Row reason | US-E3-05/AC8, AC11 |
| refresh.review.item.removed | この日は献立表に載っていません | This day isn't on the menu any more | Row sub-line | US-E3-05/AC6, AC11 |
| refresh.review.item.nowNoLunch | 給食なしの日になりました | It's now a no-lunch day | Row sub-line | US-E3-05/AC2, AC8 |
| refresh.review.open | 開く | Open | Row action (accessible name: refresh.review.openDay) | US-E3-05/AC9 |
| refresh.review.openDay | {date}を開く | Open {date} | Accessible name | |
| refresh.review.visited | 確認済み | checked | Visually hidden suffix on a resolved row (no open needs-review flag left; derived, not stored) | US-E3-05/AC9 |
| refresh.review.empty | 確認が必要な日はありません | No days need checking | Empty state | US-E3-05/AC13 (verbatim) |
| refresh.review.done | カレンダーへ | Go to the calendar | Primary | US-E3-05/AC13 (verbatim) |

## 8. Calendar (home)

| key | ja | en | where | story/AC |
|---|---|---|---|---|
| cal.prevMonth | 前の月 | Previous month | Icon button name | US-E5-01/AC5 |
| cal.nextMonth | 次の月 | Next month | Icon button name | US-E5-01/AC5 (verbatim) |
| cal.today | 今日 | Today | Button | US-E5-01/AC5 (verbatim) |
| cal.grid.label | {month}のカレンダー | Calendar for {month} | Grid accessible name | |
| cal.nav.label | 月の切り替え | Change month | `aria-label` of the month-navigation `nav` (must differ from the grid name; added M2 prep) | |
| cal.agenda.label | {month}の予定一覧 | {month} as a list | Heading of the list layout used when the grid can't fit (narrow or 200% text) | a11y-responsive.md §6 |
| cell.word.school | 給食 | Lunch | Cell decision word | US-E5-01/AC4 (verbatim) |
| cell.word.notConfirmed | 未定 | TBD | Cell decision word | US-E5-05/AC1 (verbatim) |
| cell.word.noLunch | 給食なし | No lunch | Cell word (no-lunch / closed / unknown reasons) | US-E5-08/AC2 |
| cell.word.bentoDay | お弁当の日 | Bento day | Cell word, bento-day not planned | US-E5-08/AC3 (verbatim) |
| cell.word.holiday | 祝 | Hol | Cell word on a public holiday | US-E5-01/AC2 (verbatim) |
| cell.flag.changed | 献立が変わりました | Menu changed | Needs-review badge tooltip/sheet; screen-reader part | US-E3-05/AC2 (verbatim) |
| cell.flag.allergen | アレルゲン注意 | Allergen alert | Screen-reader part when a planned recipe conflicts (E1-05/AC2) | US-E1-05/AC2 |
| cell.aria | {date}、{assessment}、{decision} | {date}, {assessment}, {decision} | Accessible name, school day | US-NF-02/AC4 (pattern verbatim) |
| cell.aria.planned | 手作りお弁当：{recipe} | homemade bento: {recipe} | `{decision}` part when planned (full recipe name) | US-E5-01/AC4 |
| cell.aria.today | 今日、 | Today, | Prefix | US-E5-01/AC1 |
| cell.aria.holiday | 、{holidayName} | , {holidayName} | Inserted after the date | US-E8-04/AC1 |
| cell.aria.override | 、手動で変更 | , changed by you | Suffix | US-E4-03/AC1 |
| cell.aria.changed | 、献立が変わりました | , menu changed | Suffix | US-E3-05/AC2 |
| cell.aria.past | 、過去の日 | , past day | Suffix | US-E5-02/AC3 |
| cell.aria.noLunch | {date}、給食なし（{originalText}） | {date}, no school lunch ({originalText}) | No-lunch day | US-E5-08/AC2 |
| cell.aria.bentoDay | {date}、お弁当の日、{decision} | {date}, bento day, {decision} | Bento day (decision = 未計画 / planned text) | US-E5-08 |
| cell.aria.bentoDayOpen | 未計画 | not planned | `{decision}` on an unplanned bento day | |
| cell.aria.outside | {date}、献立に記載なし | {date}, not on the menu | Weekend / unlisted / no menu month / snack-only / dormant-removed | US-E5-02/AC2 |
| cell.aria.noMenu | {date}、献立未取り込み | {date}, menu not imported | Weekday in a month without a confirmed menu | US-E3-06/AC1 |
| legend.title | 表示の見かた | How to read the calendar | Disclosure button + heading | US-E5-01/AC3 |
| legend.rule | 右上の記号は給食の見立て（アプリの判定）、下の文字と枠は家族の予定です。 | The mark at the top right is the app's guess about the lunch; the word and frame below are your family's plan. | Legend lead | US-E5-01/AC3 |
| legend.planned | 手作りお弁当（決定） | Homemade bento (planned) | Legend item | US-E5-01/AC4 |
| legend.notConfirmed | 未定（あとで決める） | TBD (decide later) | Legend item | US-E5-05 |
| legend.suggest | 苦手かも（予定は給食のまま） | Might not enjoy (plan is still school lunch) | Legend item | US-E5-04 |
| legend.noLunch | 給食なし | No school lunch | Legend item | |
| legend.bentoDay | 園のお弁当の日 | School bento day | Legend item | US-E5-08 |
| legend.changed | 献立が変わった日（要確認） | Menu changed (check this day) | Legend item | US-E3-05 |
| legend.override | 記号の下線：手動で変更 | Underlined mark: changed by you | Legend item | US-E4-03 |
| legend.weekend | 土・日・祝（数字の色と「祝」） | Sat, Sun, holidays (number colour and "Hol") | Legend item | US-E5-01/AC2 |
| menuCard.missing.current | 今月の献立がまだありません | No menu for this month yet | Empty-state card, current month, no menu ever confirmed (onboarding skipped) | US-E1-01/AC5 (verbatim) |
| menuCard.missing.month | {m}月の献立がまだありません | No menu for {m} yet | Empty-state card, any other case | US-E3-06/AC1 (verbatim) |
| menuCard.missing.body | 献立表を取り込むと、給食の見立てとお弁当の計画ができます。 | Import the menu to see lunch assessments and plan bentos. | Card body | |
| menuCard.import | 献立を取り込む | Import the menu | Card action | US-E1-01/AC5, US-E3-06/AC1 (verbatim) |
| menuCard.pending | 確認待ちの献立があります | A menu is waiting for your check | Card | US-E3-03/AC3 (verbatim) |
| menuCard.pending.action | 確認する | Check it | Card action | US-E3-03/AC3 |
| menuCard.nextMonth | 来月（{m}月）の献立を取り込みましょう | Time to import next month's ({m}) menu | Card, from settings.nextMonthPromptFromDay | US-E3-06/AC2 (verbatim) |
| menuCard.dismiss | 今日は表示しない | Hide for today | Card dismiss (shows again next day) | US-E3-06/AC6 (verbatim) |
| upcoming.title | これからの手作りお弁当 | Upcoming homemade bentos | Summary heading | US-E5-01/AC7 |
| upcoming.empty | 予定している手作りお弁当はありません | No homemade bentos planned | Summary empty | US-E5-01/AC7 (verbatim) |
| upcoming.tomorrow | 明日 | Tomorrow | Row sub-line | |
| upcoming.today | 今日 | Today | Row sub-line | |
| upcoming.inDays | {n}日後 | In {n} days | Row sub-line | |
| upcoming.lowCount | 苦手かもの日が{n}日あります | {n, plural, one {# day} other {# days}} your child might not enjoy | Attention row | US-E5-01/AC7 |
| upcoming.lowCount.sub | 7日以内・まだ計画していません | Next 7 days · not planned yet | Attention row sub-line | US-E5-01/AC7 |
| upcoming.notConfirmed | 未定の日：{date} | Undecided: {date} | Row for a not-confirmed day within 7 days | US-E5-05/AC2 |
| upcoming.conflict | 献立が変わりました：{date} | Menu changed: {date} | Row for an unacknowledged refresh conflict | US-E3-05/AC2 (verbatim prefix) |
| share.button | 今週の予定を共有 | Share this week's plan | Button under the calendar | US-E9-01/AC1 (verbatim) |

## 9. Assessment states, explanations, override

| key | ja | en | where | story/AC |
|---|---|---|---|---|
| state.likely | たのしめそう | Likely to enjoy | Chip, legend, aria | US-E4-04/AC2 (verbatim) |
| state.mixed | どちらとも | Hard to say | Chip, legend, aria | US-E4-04/AC2 (verbatim) |
| state.low | 苦手かも | Might not enjoy | Chip, legend, aria | US-E4-04/AC2 (verbatim), US-E7-01/AC1 |
| state.notAssessed | 未判定 | Not assessed | Chip, legend, aria | US-E4-04/AC2 (verbatim) |
| state.noLunch | 給食なし | No school lunch | Chip, aria | US-E4-04/AC2 (verbatim) |
| assess.low | {wdLong}の給食には、苦手な食材が{n}つ含まれています（{labels}）。 | {wdLongEn}'s lunch includes {n, plural, one {# food} other {# foods}} your child dislikes ({labels}). | Explanation (wd 「水曜日」) | US-E4-02/AC1 (verbatim, AC en) |
| assess.likely | {wdLong}の給食には、好きな食材が{n}つあります（{labels}）。苦手な食材は見つかりませんでした。 | {wdLongEn}'s lunch has {n, plural, one {# food} other {# foods}} your child likes ({labels}) and none they dislike. | Explanation | US-E4-02/AC2 |
| assess.mixedOne | {wdLong}の給食には、好きな食材（{liked}）と苦手な食材（{disliked}）があります。 | {wdLongEn}'s lunch has foods your child likes ({liked}) and one they dislike ({disliked}). | Explanation | US-E4-02/AC4 |
| assess.mixedUnknown | わからない料理が多いため、判断できませんでした（{unmatched}）。 | Too many dishes we don't recognise to tell ({unmatched}). | Explanation | US-E4-02/AC3 (verbatim prefix), AC4 |
| assess.mixedNeutral | 好きな食材も苦手な食材も見つかりませんでした。 | We didn't find any foods your child likes or dislikes. | Explanation | US-E4-02/AC4 |
| assess.notAssessed | 好きな食べもの・苦手な食べものが登録されていないため、判定していません。 | Not assessed: no likes or dislikes are registered yet. | Explanation | US-E4-02/AC2 |
| assess.notAssessed.action | 好みを登録する | Add likes and dislikes | Link to profile | US-E4-01/AC8 |
| assess.noLunch | この日は給食がありません。 | There's no school lunch on this day. | Explanation | US-E4-02/AC2 |
| assess.override | 手動で変更 | Changed by you | Label next to the state chip (with pencil icon) | US-E4-03/AC1 (verbatim) |
| assess.override.calc | アプリの判定は「{state}」でした。 | The app's assessment was "{state}". | Line under the label; followed by the calculated explanation | US-E4-02/AC2 |
| assess.basis | 判定は、登録した好みと献立表の文字だけをもとにしています。 | The assessment uses only the likes and dislikes you entered and the menu text. | Footnote under every explanation | BR-04 |
| assess.changed | 献立が変わりました。評価を見直してください。 | The menu changed. Please review the assessment. | Warning line on an overridden day whose dishes changed, or whose override was re-applied | US-E3-05/AC3, AC8 (verbatim) |
| override.button | 判定を変更 | Change assessment | Opens the override control | US-E4-03 |
| override.legend | この日の判定 | Assessment for this day | Radio-group legend | US-E4-03/AC1 |
| override.reset | 自動判定に戻す | Back to the automatic assessment | Text button | US-E4-03/AC3 (verbatim) |
| override.note | 判定を変えても、予定は変わりません。 | Changing the assessment doesn't change the plan. | Hint under the control | US-E4-03/AC5, BR-01 |
| override.saved | 判定を「{state}」にしました | Assessment set to "{state}" | Polite live-region message | |

## 10. Day sheet

| key | ja | en | where | story/AC |
|---|---|---|---|---|
| day.menu.heading | 給食の献立 | School lunch menu | Section heading | US-E5-02/AC1 |
| day.panel.empty | 日付を選ぶと、ここに詳細が表示されます。 | Choose a date to see its details here. | Desktop side panel before a date is chosen | US-E5-02 |
| day.holiday | {holidayName}（祝日） | {holidayName} (public holiday) | Sheet sub-title on a holiday | US-E8-04/AC1 |
| day.menu.dislikedTag | 苦手 | Dislikes | Tag after a disliked item (text, not colour only) | US-E4-02 |
| day.menu.likedTag | 好き | Likes | Tag after a liked item | |
| day.menu.snack | おやつ | Snack | Sub-heading for snack items | US-E4-01/AC9 (verbatim) |
| day.menu.allergens | 献立表のアレルゲン表示：{list} | Allergens printed on the menu: {list} | Line | US-E4-05 |
| day.allergen.match | 献立表に{allergen}の表示があります。園にご確認ください。 | The menu lists {allergen}. Please check with the school. | Warning row | US-E4-05/AC1 (verbatim) |
| day.allergen.notDeclared | アレルゲンの記載がありません | The menu doesn't print allergen information for this day | Info row (child with known allergies) | US-E4-05/AC2 (verbatim) |
| day.assess.heading | 給食の見立て | How the lunch might suit your child | Section heading | US-E5-02/AC1 |
| day.decision.heading | この日の予定 | Plan for this day | Section heading | US-E5-02/AC1 |
| day.decision.current | いまの予定：{decision} | Current plan: {decision} | Status line | US-E5-02/AC1 |
| decision.school | 給食 | School lunch | Decision label | US-E5-01/AC4 |
| decision.bento | 手作りお弁当 | Homemade bento | Decision label | US-E9-01/AC1 |
| decision.notConfirmed | 未定 | Not decided | Decision label | US-E5-05/AC1, US-E9-01/AC1 |
| decision.noLunch | 給食なし | No school lunch | Decision label | |
| day.action.bento | 手作りお弁当にする | Make a homemade bento | Primary action | US-E5-03/AC1 (verbatim), US-E0-01/AC1 |
| day.action.bento.sub | おすすめのレシピから選べます | Choose from suggested recipes | Action sub-line | US-E6-01 |
| day.action.later | あとで決める | Decide later | Secondary action | US-E5-05/AC1 (verbatim) |
| day.action.later.sub | カレンダーに「未定」と表示します | Shows "TBD" on the calendar | Action sub-line | US-E5-05/AC1 |
| day.action.backToSchool | 給食に戻す | Back to school lunch | Action | US-E5-06/AC2 (verbatim) |
| day.action.viewRecipe | レシピを見る | View recipe | Action | US-E7-03/AC1 (verbatim) |
| day.action.changeRecipe | レシピを変更 | Change recipe | Action | US-E5-06/AC1 (verbatim) |
| day.action.planBentoDay | お弁当を計画する | Plan a bento | Primary on a bento day | US-E5-08/AC1 (verbatim) |
| day.action.clearPlan | 計画を取り消す | Remove the plan | Action on bento days and refresh conflicts | US-E3-05/AC2, US-E5-08/AC3 (verbatim) |
| day.action.keep | このまま | Keep it | Refresh-conflict action (KEEP_PLAN) | US-E3-05/AC2, AC7 (verbatim) |
| day.reservation.note | 給食の予約は園の方法で行ってください（このアプリでは予約されません） | Please arrange school lunch through your school as usual (this app doesn't do it for you). | Info note wherever school-lunch-planned shows (sheet, today card) | US-E5-07/AC1 (verbatim) |
| day.reservation.check | 園で予約済み（自分で記録） | Already arranged with the school (my own note) | Checkbox (Should) | US-E5-07/AC3 (verbatim) |
| day.reservation.checkHint | あなた自身の記録です。アプリから園には何も送りません。 | This is only your own note. Nothing is sent to the school. | Checkbox hint | US-E5-07/AC3, BR-19 |
| day.outside | この日は献立に記載がありません | This day isn't on the menu | Body for weekends/unlisted dates | US-E5-02/AC2 (verbatim) |
| day.noMenu | この月の献立はまだ取り込まれていません | This month's menu hasn't been imported yet | Body for weekdays in a month without a menu | US-E5-02/AC4 (verbatim), US-E3-06/AC1 |
| day.noLunch.body | この日は給食がありません（献立表：「{originalText}」） | No school lunch on this day (the sheet says "{originalText}") | Body on a no-lunch day | US-E5-08/AC2 |
| day.bentoDay.body | 園の「お弁当の日」です。 | It's the school's bento day. | Body on a bento day | US-E5-08/AC1 |
| day.snackOnly | おやつだけの日のため、判定と予定はありません。 | Only a snack is listed, so there's no assessment or plan. | Body on a snack-only date | US-E4-01/AC10 |
| day.past | 過去の日のため、予定は変更できません。 | This day has passed, so the plan can't be changed. | Read-only note | US-E5-02/AC3 (BR-27) |
| day.conflict.flag | 献立が変わりました | Menu changed | Warning banner title in the sheet | US-E3-05/AC2 (verbatim) |
| day.conflict.nowNoLunch | 献立の更新で、この日は給食なしになりました。予定を確認してください。 | After the menu update, this day has no school lunch. Please check your plan. | Banner body | US-E3-05/AC2 (verbatim) |
| day.conflict.removed | 献立の更新で、この日は献立表に載っていません。予定を確認してください。 | After the menu update, this day isn't on the menu. Please check your plan. | Banner body | US-E3-05/AC6 (verbatim) |
| day.conflict.kept | このままにしました。前日のお知らせもそのままです。 | Kept as it is. The day-before reminder stays too. | Line after KEEP_PLAN (marker remains) | US-E3-05/AC7 |
| day.recipeMissing | このレシピは見つかりません。別のレシピを選んでください。 | This recipe can't be found. Please choose another one. | Warning row; name shown from snapshot | US-E6-06/AC1 (verbatim) |
| day.recipeMissing.action | レシピを選び直す | Choose another recipe | Action (opens recommendations) | US-E6-06 |
| day.recipeAllergen | 選んだレシピに登録したアレルゲン（{allergens}）が含まれています | The chosen recipe contains a registered allergen ({allergens}) | Danger row + day.action.changeRecipe | US-E1-05/AC2 (verbatim) |
| day.cancel.title | {dateNoWd}の手作りお弁当の予定を取り消しますか？ | Remove the homemade bento plan for {dateNoWd}? | Confirm dialog (給食に戻す) | US-E5-06/AC3 (verbatim) |
| day.cancel.body | 予定は「給食」に戻り、前日のお知らせもなくなります。 | The plan goes back to school lunch and the day-before reminder is removed. | Dialog body | US-E5-06/AC2, US-E7-02/AC6 |
| day.cancel.confirm | 取り消す | Remove plan | Dialog destructive | US-E5-06/AC3 |
| day.clear.title | {dateNoWd}の手作りお弁当の計画を取り消しますか？ | Remove the homemade bento plan for {dateNoWd}? | Confirm dialog (計画を取り消す) | US-E5-08/AC3, US-E3-05/AC7 |
| day.clear.body | この日の予定はなくなり、前日のお知らせもなくなります。 | The plan for this day and its day-before reminder are removed. | Dialog body | US-E5-08/AC3, US-E3-05/AC7 |
| day.clear.confirm | 取り消す | Remove plan | Dialog destructive | |
| day.saved.bento | {date}を手作りお弁当にしました | {date} is now a homemade bento day | Toast after write succeeds | US-E5-03/AC2, US-E10-02/AC6 (verbatim pattern) |
| day.saved.later | {date}を「未定」にしました | {date} is marked as undecided | Toast | US-E5-05/AC1 |
| day.saved.school | {date}を給食に戻しました | {date} is back to school lunch | Toast | US-E5-06/AC2 |
| day.saved.cleared | {date}の計画を取り消しました | The plan for {date} was removed | Toast | US-E5-08/AC3 |
| day.saved.kept | {date}の予定をそのままにしました | Kept the plan for {date} | Toast | US-E3-05/AC7 |

## 11. Recommendations

| key | ja | en | where | story/AC |
|---|---|---|---|---|
| rec.title | {date}のお弁当 | Bento for {date} | Screen title | US-E5-03/AC1 |
| rec.lead | 好みに合いそうなレシピです。 | Recipes that may suit your child. | Lead | US-E6-01 |
| rec.rank | {n}位 | No. {n} | Rank badge (text, not colour) | US-E6-01/AC1 |
| rec.reason.liked | 好きな{food}入り | With {food}, a favourite | Reason chip (≤ 2 per card) | US-E6-01/AC2 (verbatim pattern 「好きな鶏肉入り」) |
| rec.reason.theme | {theme}テーマ | {theme} theme | Reason chip | US-E6-01/AC2 (verbatim pattern 「どうぶつテーマ」) |
| rec.reason.quick | 20分以内でできます | Ready in 20 minutes or less | Reason chip | US-E6-01/AC7 (verbatim), BR-09 |
| rec.allergens | アレルゲン：{list} | Allergens: {list} | Badge line | US-E6-01/AC2 |
| rec.mayContain | 製品によって含むことがあるもの：{list} | May be in some products: {list} | Badge line **RETIRED 2026-11-01** (US-E6-02/AC4 superseded; label data is never shown as a statement, AC13; developer removes the key and its uses) | US-E6-02/AC4 |
| rec.allergensNone | 表示対象のアレルゲン：使用していません（食品の表示をご確認ください） | Labelled allergens: none used (please check the food labels) | Badge line when allergenIds is empty and nothing varies | US-E6-03/AC3 (verbatim) |
| rec.variesByProduct | 市販品は製品によりアレルゲンが異なります。表示を確認してください。 | Store-bought products differ in allergens. Check the label. | Warning row **RETIRED 2026-11-01** (US-E6-02/AC4 superseded by warn.processed.*; developer removes the key and its uses) | US-E6-02/AC4 (verbatim) |
| rec.incomplete | 一部の材料のアレルゲン情報がわかりません。食品の表示を確認してください。 | Allergen information is missing for some ingredients. Check the food labels. | Warning row on incomplete-allergen recipes **RETIRED 2026-11-01** (US-E6-02/AC5, US-E6-04/AC6; replaced by warn.processed.card and warn.processed.recipe; developer removes the key and its uses) | US-E6-02/AC5 (verbatim, AC en) |
| warn.processed.card | 市販品の表示を確認 | Check labels of store-bought items | Compact line (triangle icon + text) on a recommendation card, a 「ほかのレシピ」 row, a plannable library row and the plan-date picker header; only when the child has a registered allergen and the recipe has a processed ingredient | US-E6-02/AC11, AC12 |
| warn.processed.item | 市販品。表示を確認 | Store-bought product: check the label | Marker on each processed ingredient row of the recipe detail | US-E6-02/AC11, US-E6-04/AC4 |
| warn.processed.recipe | 市販品には、登録したアレルゲン（{allergens}）が含まれる場合があります。パッケージの表示を確認してください。 | Store-bought products may contain the registered allergens ({allergens}). Check the package label. | Notice once, above the ingredient list of the recipe detail. {allergens} = the child's full list, dictionary labels in the order of knownAllergenIds, joined with 「、」 (ja) or ", " (en), never shortened | US-E6-02/AC11, US-E6-03/AC4 |
| warn.processed.prefix | 注意 | Note | Visually hidden lead-in read before warn.processed.recipe by screen readers; not shown | US-NF-02 |
| rec.confirm | この日に決定 | Choose for this day | Primary on card 1, secondary on 2–3 | US-E5-03/AC2 (verbatim) |
| rec.current | いまのレシピ | Current recipe | Tag on the planned recipe in change-recipe mode; its button is disabled | US-E5-06/AC1 |
| rec.saving | 保存しています… | Saving… | Busy label on the pressed button | US-E5-03/AC2 |
| rec.details | 作り方を見る | See how to make it | Card link to recipe detail | US-E6-04 |
| rec.more | ほかのレシピ | Other recipes | Text button under the cards | US-E6-01/AC6 (verbatim) |
| rec.more.title | 条件に合うほかのレシピ | Other recipes that fit | Expanded list heading | US-E6-01/AC6 |
| rec.fewer | 条件に合うレシピは{n}件です | {n, plural, one {Only # recipe fits} other {Only # recipes fit}} | Note above the cards when 1–2 | US-E6-01/AC4 (verbatim) |
| rec.none | 条件に合うレシピがありません | No recipes fit | Empty state title | US-E6-01/AC5 (verbatim) |
| rec.none.body | アレルギーや食事の制限に合うレシピが、いまのレシピ集にありません。予定は変わっていません。 | No recipe in the collection fits the allergies or restrictions. Your plan hasn't changed. | Empty state body | US-E6-01/AC5 |
| rec.none.profile | プロフィールを見直す | Review the profile | Empty-state link | US-E6-01/AC5 (verbatim) |
| rec.none.library | レシピ一覧を見る | See all recipes | Empty-state link | US-E6-01/AC5 (verbatim) |
| rec.loading | レシピを選んでいます… | Choosing recipes… | Loading text (screen reader) | |
| allergy.disclaimer | アレルギーの安全を保証するものではありません。使用する食品の表示を必ずご確認ください。 | BentoMinder can't guarantee anything about allergies. Always check the labels of the foods you use. | Always-on box on every recommendation and recipe screen | US-E6-03/AC1 (verbatim) |

## 12. Recipe detail and library

| key | ja | en | where | story/AC |
|---|---|---|---|---|
| recipe.plannedFor | {date}のお弁当に決定 | Planned for {date} | Navy banner when the recipe is planned | US-E6-04 |
| recipe.time | 調理時間 {minutes} | Time: {minutes} | Meta | US-E6-04/AC1 |
| recipe.yield | 分量：{yield} | Makes: {yield} | Meta (yield from data) | US-E6-04/AC1 |
| recipe.theme | テーマ：{theme} | Theme: {theme} | Meta | US-E6-04/AC1 |
| recipe.diet | {diet}の条件に合います | Fits: {diet} | Diet badge (from dietOk; only diets the child selected) | US-E6-04/AC1 |
| recipe.ingredients | 材料 | Ingredients | Heading | US-E6-04/AC1 |
| recipe.steps | 作り方 | Steps | Heading | US-E6-04/AC1 |
| recipe.step.label | 手順{n} | Step {n} | Step accessible label | |
| recipe.storage | 保存と衛生 | Storage and food safety | Heading | US-E6-04/AC1, AC2 |
| recipe.safety.cool | ごはんやおかずは、よく冷ましてから詰めましょう。 | Let rice and side dishes cool fully before packing them. | General note | US-E6-04/AC2 (verified 2026-10-25 against 農林水産省 「お弁当を作るときの注意点」, page updated 2022-10-18) |
| recipe.safety.carry | 長い時間持ち運ぶときは、保冷剤や保冷バッグを使って涼しく保ちましょう。 | When carrying the bento for a long time, keep it cool with an ice pack or a cool bag. | General note | US-E6-04/AC2 (verified 2026-10-25 against the same 農林水産省 page) |
| recipe.safety.credit | 出典：農林水産省 | Source: Ministry of Agriculture, Forestry and Fisheries (Japan) | Credit line, linked | US-E6-04/AC2 |
| recipe.sources | 出典 | Sources | Heading for recipe sources (publisher, title, link) | US-E6-04/AC1, BR-26 |
| recipe.source.accessed | {date}に確認 | Checked {date} | Source meta | |
| recipe.adapted | 子ども向けに分量などを調整しています。 | Amounts are adjusted for a child. | Note when adaptations exist | data contract §1 |
| recipe.notFound | レシピが見つかりません | Recipe not found | Deep link with unknown id | US-E6-04/AC3 (verbatim) |
| recipe.notFound.back | カレンダーに戻る | Back to the calendar | Link | US-E6-04/AC3 |
| recipe.planPick | 日付を選んで計画 | Pick a date to plan | Button in library context | US-E6-05/AC2 (verbatim) |
| recipe.planPick.title | どの日に作りますか？ | Which day will you make it? | Date-picker sheet title | US-E6-05/AC3 (verbatim) |
| recipe.planPick.lead | 今日以降の給食の日とお弁当の日から選べます。 | Choose a school-lunch day or bento day from today on. | Lead | US-E6-05/AC3, BR-25, BR-27 |
| recipe.planPick.empty | 計画できる日がありません。献立を取り込むと選べるようになります。 | There are no days to plan. Import a menu to choose one. | Empty state | US-E6-05/AC4 (verbatim) |
| recipe.planPick.option | {date}（{decision}） | {date} ({decision}) | Radio option | US-E6-05/AC3 |
| library.title | レシピ一覧 | All recipes | Screen title | US-E6-05 (verbatim 「レシピ一覧」 in US-E6-02/AC1) |
| library.lead | 全{n}品。アレルギーや食事の制限に合わないレシピは、理由とともに最後に並べています。 | {n} recipes. Those that don't fit the allergies or restrictions are listed last, with the reason. | Lead | US-E6-05/AC1 |
| library.conflict.allergen | {allergen}を含む | Contains {allergen} | Greyed row reason | US-E6-02/AC1 (verbatim pattern 「卵を含む」) |
| library.conflict.excluded | {food}を含む | Contains {food} | Greyed row reason (excluded ingredient) | US-E6-02/AC2 |
| library.conflict.diet | {diet}の条件に合いません | Doesn't fit: {diet} | Greyed row reason | US-E6-05/AC1 |
| library.conflict.incomplete | アレルゲン情報が不完全なため、登録したアレルギーと照合できません | Allergen information is incomplete, so it can't be checked against the registered allergies | Greyed row reason **RETIRED 2026-11-01** (US-E6-02/AC6 superseded; no exclusion on incomplete data; developer removes the key and its uses) | US-E6-02/AC6 (verbatim, AC en) |
| library.conflict.dietIncomplete | 原材料の由来がわからないため、食事の制限と照合できません | The origin of some ingredients is unknown, so it can't be checked against the diet | Greyed row reason | US-E6-02/AC8 (verbatim, AC en) |
| (reuse) | library.conflict.allergen | | A recipe excluded because a processed ingredient inherently contains a registered allergen reuses 「{allergen}を含む」, e.g. 「卵を含む」; no new string | US-E6-02/AC9 |
| library.conflict.cantPlan | この条件では計画できません | Can't be planned with these settings | Disabled-button hint | US-E6-02/AC1 |
| library.empty | レシピがまだありません | No recipes yet | Empty state (build without library) | |

## 13. Reminders and today card

| key | ja | en | where | story/AC |
|---|---|---|---|---|
| reminder.region | お知らせ | Reminders | Landmark/region name of the banner stack | US-E7-01 |
| reminder.more | ほかに{n}件のお知らせ | {n, plural, one {# more reminder} other {# more reminders}} | Disclosure under the first banner | US-E7-05/AC5 (verbatim pattern) |
| reminder.dismiss | 閉じる | Dismiss | Banner close (accessible name reminder.dismissName) | US-E7-05/AC1 |
| reminder.dismissName | このお知らせを閉じる | Dismiss this reminder | Accessible name | |
| reminder.dayBefore | 明日は手作りお弁当の日！レシピを確認しましょう。 | Homemade bento tomorrow! Take a look at the recipe. | Day-before banner title | US-E7-02/AC1, US-E0-01/AC1 (verbatim) |
| reminder.dayBefore.recipe | {recipe} | {recipe} | Banner sub-line (recipe name) | US-E7-02/AC1 |
| reminder.dayBefore.cta | レシピを見る | View recipe | Banner action | US-E7-02/AC2 |
| reminder.missedAt | {date} {time}のお知らせ | Reminder from {date}, {time} | Label on a missed/repeated reminder | US-E7-05/AC2, AC4 |
| reminder.weekly.title | 週のまとめ（{range}） | Weekly summary ({range}) | Weekly banner title | US-E7-01/AC1, US-E7-04/AC1 |
| reminder.weekly.low | {date}苦手かも・未計画 | {date} might not enjoy · not planned | Weekly item | US-E7-01/AC1 (verbatim pattern) |
| reminder.weekly.planned | {date}手作りお弁当：{recipe} | {date} homemade bento: {recipe} | Weekly item | US-E7-01/AC1 (verbatim pattern) |
| reminder.weekly.notConfirmed | {date}未定 | {date} not decided | Weekly item | US-E5-05/AC2 |
| reminder.weekly.plan | 計画する | Plan | Item action | US-E7-01/AC2, US-E5-05/AC2 (verbatim) |
| reminder.weekly.none | 来週は手作りお弁当の予定はありません | No homemade bentos planned next week | Weekly body when nothing to report | US-E7-01/AC3 (verbatim) |
| reminder.weekly.noMenuMonth | {m}月の献立がまだありません | No menu for {m} yet | Weekly line for days of a month without a menu | US-E7-01/AC4 (verbatim) |
| reminder.weekly.noMenu | 来週の献立がまだありません | No menu for next week yet | Weekly body | US-E7-01/AC5 (verbatim) |
| reminder.weekly.import | 献立を取り込む | Import the menu | Weekly action | US-E7-01/AC5 (verbatim) |
| today.label | 今日・{date} | Today · {date} | Today card eyebrow | US-E7-03 |
| today.planned | 今日は手作りお弁当：{recipe} | Homemade bento today: {recipe} | Today card | US-E7-03/AC1 (verbatim) |
| today.school | 今日は給食 | School lunch today | Today card | US-E7-03/AC1 (verbatim) |
| today.notConfirmed | 今日の予定は未定です | Today's plan isn't decided yet | Today card | US-E7-03/AC1 (verbatim) |
| today.noLunch | 今日は給食がありません | No school lunch today | Today card | US-E7-03/AC1 (verbatim) |
| today.next | 次の登園日：{date}{decision} | Next school day: {date} {decision} | Weekend/outside the menu (decision = 給食 / 未定 / 手作りお弁当：{recipe}) | US-E7-03/AC2 (verbatim pattern 「次の登園日：11月9日（月）給食」) |
| today.nextUnknown | 次の登園日は、献立を取り込むと表示されます | Your next school day appears once a menu is imported | Today card with no upcoming school day | US-E7-03/AC4 (verbatim) |
| today.cta.recipe | レシピを見る | View recipe | Today card action | US-E7-03/AC1 (verbatim) |
| today.cta.plan | 予定を決める | Decide the plan | Today card action when not-confirmed | US-E7-03/AC5 (verbatim) |

## 14. Settings

| key | ja | en | where | story/AC |
|---|---|---|---|---|
| settings.title | 設定 | Settings | Screen title | |
| settings.reminders | お知らせ | Reminders | Section | US-E7-04 |
| settings.weekly | 週のまとめ | Weekly summary | Row label + switch | US-E7-04/AC1 (verbatim) |
| settings.weekly.value | {wdLong} {time} | {wdLongEn} {time} | Row value 「日曜日 14:00」 | US-E7-04/AC1 (verbatim pattern) |
| settings.weekly.day | 曜日 | Day | Select label | US-E7-04/AC3 |
| settings.weekly.hint | 次の日から7日間の予定をまとめてお知らせします。 | Sums up the 7 days starting the next day. | Hint | BR-16 |
| settings.dayBefore | 前日のお知らせ | Day-before reminder | Row label + switch | US-E7-04/AC1, AC4 (verbatim) |
| settings.dayBefore.hint | 手作りお弁当の日の前日にお知らせします。 | Reminds you the day before each homemade bento day. | Hint | BR-16 |
| settings.time.hour | 時 | Hour | Select label (00–23) | US-E7-04/AC3 |
| settings.time.minute | 分 | Minute | Select label (00, 15, 30, 45) | US-E7-04/AC3 |
| settings.time.group | 時刻 | Time | Fieldset legend | |
| settings.switch.on | オン | On | Switch state text | US-E7-04/AC4 |
| settings.switch.off | オフ | Off | Switch state text | US-E7-04/AC4 |
| settings.webLimit | ブラウザ版では、アプリを開いているとき・次に開いたときにお知らせします。閉じている間は通知できません。 | In the browser, reminders appear while the app is open or the next time you open it. They can't reach you while it's closed. | Info box under the reminder section (web build) | US-E7-06/AC1 (verbatim) |
| settings.saved | 設定を保存しました | Settings saved | Polite live-region status after each change | |
| settings.display | 表示 | Display | Section | US-E5-01/AC8, US-E8-05/AC2 (verbatim) |
| settings.language | 言語 | Language | Segmented 日本語 / English | US-E8-01/AC2 |
| settings.language.en | English | English | Option label | |
| settings.weekStart | 週のはじまり | Week starts on | Radio group | US-E5-01/AC8 (verbatim) |
| settings.weekStart.monday | 月曜日 | Monday | Radio | US-E5-01/AC2 |
| settings.weekStart.sunday | 日曜日 | Sunday | Radio | US-E5-01/AC8 (verbatim) |
| settings.theme | テーマ | Theme | Radio group | US-E8-05/AC2 (verbatim) |
| settings.theme.auto | 自動 | Automatic | Radio | US-E8-05/AC2 (verbatim) |
| settings.theme.light | ライト | Light | Radio | US-E8-05 |
| settings.theme.dark | ダーク | Dark | Radio | US-E8-05/AC2 (verbatim) |
| settings.theme.autoHint | 端末の設定に合わせます。 | Follows your device. | Hint | US-E8-05/AC1 |
| settings.menu | 献立表 | Menu | Section | US-E2-01/AC4 |
| settings.menu.url | 保存しているURL | Saved address | Read-only value | US-E2-01/AC4 |
| settings.menu.urlNone | まだ保存していません | None saved yet | Empty value | |
| settings.menu.import | 献立を取り込む | Import the menu | Button | US-E2-01/AC4 (verbatim) |
| settings.menu.needsReview | 確認が必要な日（{n}件） | Days to check ({n}) | Settings link to the refresh needs-review list, shown only while ≥ 1 listed date has an open needs-review flag (M2 prep ruling) | US-E3-05/AC9 |
| settings.menu.review | 献立を確認・修正 | Check or fix the menu | Button (opens review of the shown month; re-confirm = refresh) | US-E3-05 |
| settings.menu.promptDay | 来月の献立のお知らせ | Next month's menu reminder | Select label (1–28) | US-E3-06/AC7 (verbatim), OQ-15 |
| settings.menu.promptDay.value | 毎月{n}日から | From the {n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} of each month | Option label | US-E3-06/AC7 (verbatim pattern) |
| settings.profile | プロフィール | Profile | Section | US-E1-05 |
| settings.profile.edit | プロフィールを編集 | Edit profile | Button | US-E1-05 |
| settings.profile.delete | プロフィールを削除 | Delete profile | Destructive text button | US-E1-06/AC1 (verbatim) |
| settings.data | データ | Data | Section | US-E10 |
| settings.data.where | データはこの端末だけに保存されています。ほかの端末とは同期されません。 | Your data is stored only on this device. It isn't synced with other devices. | Section note | BR-22, PLAN §1 |
| settings.about | このアプリについて | About this app | Section | |
| settings.about.consent | AIでの読み取りについて | About reading the menu with AI | Link to the consent text | US-E2-08 |
| settings.about.version | バージョン {v} | Version {v} | Meta | |

### Profile edit (screen opened from settings; reuses §3–§5 field strings)

| key | ja | en | where | story/AC |
|---|---|---|---|---|
| profileEdit.title | プロフィールを編集 | Edit profile | Screen title | US-E1-05 |
| profileEdit.save | 保存 | Save | Primary | US-E1-05/AC1 |
| profileEdit.cancel | キャンセル | Cancel | Secondary | US-E1-05/AC3 (verbatim) |
| profileEdit.saved | プロフィールを保存しました。判定を計算し直しました。 | Profile saved. Assessments were recalculated. | Toast | US-E1-05/AC1 |
| profileEdit.keepsPlans | 保存しても、お弁当の予定は変わりません。 | Saving doesn't change your bento plans. | Note above the save button | US-E1-05/AC1, BR-02 |
| profileEdit.discard.title | 変更を保存せずに戻りますか？ | Leave without saving? | Dialog | US-E1-05/AC3 |
| profileEdit.discard.confirm | 保存せずに戻る | Leave without saving | Dialog destructive | |
| profileEdit.discard.stay | 編集を続ける | Keep editing | Dialog secondary | |
| profileDelete.title | プロフィールを削除しますか？ | Delete the profile? | Dialog title | US-E1-06/AC1 |
| profileDelete.body | 献立表とお弁当の予定は残ります。好み・アレルギーなどのプロフィールと、手動で変更した判定は削除されます。 | Your menus and bento plans are kept. The profile (likes, allergies and so on) and any assessments you changed by hand are deleted. | Dialog body | US-E1-06/AC1 |
| profileDelete.confirm | 削除する | Delete | Dialog destructive | US-E1-06/AC1 (verbatim) |
| profileDelete.cancel | キャンセル | Cancel | Dialog secondary | US-E1-06/AC1 (verbatim) |

## 15. Share

| key | ja | en | where | story/AC |
|---|---|---|---|---|
| share.sheet.title | 今週の予定を共有 | Share this week's plan | Share sheet title | US-E9-01 |
| share.sheet.preview | 送る内容 | What will be sent | Preview label | US-E9-01/AC4, US-E9-02/AC1 |
| share.sheet.note | 共有した時点の予定です。自動では同期されません。 | This is the plan as of now. It doesn't update automatically. | Note | US-E9-02/AC2 (verbatim) |
| share.sheet.privacy | お子さまのプロフィールは含まれません。 | Your child's profile isn't included. | Note | US-E9-02/AC1, BR-21 |
| share.sheet.share | 共有する | Share | Primary (navigator.share) | US-E9-01/AC2 |
| share.sheet.copy | コピーする | Copy | Secondary (clipboard) | US-E9-01/AC2 |
| share.copied | コピーしました | Copied | Toast | US-E9-01/AC2 (verbatim) |
| share.copyFailed | コピーできませんでした。下の文章を選んでコピーしてください。 | Couldn't copy. Please select the text below and copy it. | Inline message; text gets selected | US-E9-01/AC4 (verbatim) |
| share.text.header | 【BentoMinder】{range}のお弁当予定 | [BentoMinder] Bento plan for {range} | Share text line 1 | US-E9-01/AC1 (exact) |
| share.text.bento | {date}手作りお弁当：{recipe} | {date} Homemade bento: {recipe} | Share text line | US-E9-01/AC1 (exact) |
| share.text.notConfirmed | {date}未定 | {date} Not decided | Share text line | US-E9-01/AC1 (exact) |
| share.text.others | ほかの日は給食（または給食なし）です。 | Other days: school lunch (or no school lunch). | Share text line | US-E9-01/AC1 (exact) |
| share.text.reservation | ※給食の予約は園の方法で行ってください。 | * Please arrange school lunch through your school as usual. | Share text last line | US-E9-01/AC1 (exact) |
| share.text.empty | 今週は手作りお弁当の予定はありません。 | No homemade bentos planned this week. | Replaces the bento/not-confirmed lines when there are none | US-E9-01/AC3 (exact) |

Exact share text for the US-E9-01/AC1 example (lines joined with `\n`, no trailing newline):

```
【BentoMinder】11月2日（月）〜11月8日（日）のお弁当予定
11月4日（水）手作りお弁当：くまさんおにぎり弁当
11月6日（金）未定
ほかの日は給食（または給食なし）です。
※給食の予約は園の方法で行ってください。
```

Empty week (US-E9-01/AC3): header line, then 「今週は手作りお弁当の予定はありません。」, then the reservation line. (The 「ほかの日は…」 line is omitted when the week is empty, because every day is then school lunch or no lunch; flagged for the BA as "AC3 doesn't say", see report.)

## 16. Data, storage, recovery

| key | ja | en | where | story/AC |
|---|---|---|---|---|
| data.export | データを書き出す | Export data | Button | US-E10-03/AC4 (verbatim) |
| data.export.hint | すべての記録を1つのファイル（JSON）に保存します。 | Saves all your records in one file (JSON). | Hint | US-E10-03/AC4 |
| data.export.empty | 書き出すデータがありません | There's no data to export | Disabled-button hint | US-E10-03/AC2 (verbatim) |
| data.export.done | 書き出しました | Exported | Toast | |
| data.import | データを読み込む | Import data | Button (Could) | US-E10-03/AC3 (verbatim) |
| data.import.title | 今のデータを置き換えますか？ | Replace your current data? | Confirm dialog | US-E10-03/AC3 |
| data.import.body | 選んだファイルの内容で、この端末のデータがすべて置き換わります。 | All data on this device will be replaced by the file's contents. | Dialog body | US-E10-03/AC3 |
| data.import.confirm | 置き換える | Replace | Dialog destructive | |
| data.import.invalid | このファイルは読み込めません。BentoMinderから書き出したファイルを選んでください。 | This file can't be imported. Choose a file exported from BentoMinder. | Error | US-E10-03/AC5 (verbatim) |
| data.import.newer | このファイルは新しいバージョンのアプリで作られています。アプリを更新してください。 | This file was made by a newer version of the app. Please update the app. | Error | US-E10-03/AC6 (verbatim) |
| data.deleteAll | すべてのデータを削除 | Delete all data | Destructive text button | US-E10-04/AC1 (verbatim) |
| data.deleteAll.title | すべてのデータを削除しますか？ | Delete all data? | Dialog title | US-E10-04/AC1 |
| data.deleteAll.body | プロフィール、献立、予定、お知らせの記録、同意、言語の設定がこの端末から消え、元に戻せません。必要なら先に「データを書き出す」で保存してください。 | Your profile, menus, plans, reminder history, consent and language setting are removed from this device and can't be recovered. Export your data first if you need it. | Dialog body | US-E10-04/AC1 |
| data.deleteAll.confirm | 削除する | Delete | Dialog destructive | US-E10-04/AC1 (verbatim) |
| data.deleteAll.cancel | キャンセル | Cancel | Dialog secondary | US-E10-04/AC2 |
| storage.unavailable | この端末に保存できません | This device can't save data | Danger banner (persistent) | US-E10-02/AC5 (verbatim) |
| storage.unavailable.body | プライベートブラウズ中か、保存できる容量がいっぱいの可能性があります。今の変更は保存されていません。 | You may be in private browsing, or storage may be full. Your latest change wasn't saved. | Banner body | US-E10-02/AC5 |
| storage.newer | 新しいバージョンのデータです。アプリを更新してください。 | This data is from a newer version. Please update the app. | Recovery screen title | US-E10-02/AC3 (verbatim) |
| storage.newer.body | データを守るため、このアプリでは何も書き込みません。 | To protect your data, this app won't write anything. | Body | US-E10-02/AC3 |
| storage.corrupt.title | 保存されたデータを読み込めませんでした | Your saved data couldn't be read | Recovery screen title | US-E10-02/AC4 |
| storage.corrupt.body | どうするか選ぶまで、データには何も書き込みません。 | Nothing will be written until you choose what to do. | Body | US-E10-02/AC4 |
| storage.corrupt.export | データを書き出す（そのまま） | Export the data as it is | Recovery action | US-E10-02/AC4 (verbatim) |
| storage.corrupt.reset | 初期化する | Start over | Recovery action (destructive, confirm dialog) | US-E10-02/AC4 (verbatim) |
| storage.corrupt.resetTitle | データを初期化しますか？ | Start over with empty data? | Dialog | US-E10-02/AC7 (verbatim) |
| storage.corrupt.resetBody | 読み込めなかったデータは消え、はじめての設定から始まります。 | The unreadable data is removed and setup starts again. | Dialog body | US-E10-02/AC7 |
| storage.migrated | データを新しい形式に更新しました（元のデータは控えとして残しています）。 | Your data was updated to the new format (a backup copy is kept). | One-time info toast | US-E10-02/AC2 |

## 17. Toasts and live messages (generic)

| key | ja | en | where | story/AC |
|---|---|---|---|---|
| toast.saveFailed | 保存できませんでした。もう一度お試しください。 | Couldn't save. Please try again. | Toast after a failed write (never shows a "saved" toast) | US-E10-02/AC5, AC6 (verbatim), US-E10-05/AC1 |
| live.monthChanged | {month}を表示しています | Showing {month} | Polite live region after month navigation | US-E5-01/AC5 |
| live.recCount | おすすめのレシピが{n}件あります | {n, plural, one {# suggested recipe} other {# suggested recipes}} | Polite live region on recommendations | US-E6-01 |
| live.formErrors | 入力内容に{n}件の誤りがあります | {n, plural, one {# entry needs fixing} other {# entries need fixing}} | Assertive, on submit with errors | US-E1-02/AC4 |

## 18. Debug panel (dev-only catalog `debug.*`, never in production)

| key | ja | en | where | story/AC |
|---|---|---|---|---|
| debug.open | Debug | Debug | Corner button | US-E11-01/AC1 (verbatim) |
| debug.title | デバッグパネル（開発用） | Debug panel (development) | Panel title | US-E11-01 |
| debug.marker | BM_DEBUG_PANEL | BM_DEBUG_PANEL | Hidden marker (data-attribute) | US-E11-01/AC2 |
| debug.clock | 時計 | Clock | Section | US-E11-02 |
| debug.clock.now | 現在：{datetime}（日本時間） | Now: {datetime} (Japan time) | Status | US-E11-02/AC1 |
| debug.clock.simulated | シミュレーション中 | Simulated | Badge | US-E11-02/AC1 |
| debug.clock.set | 日時を設定 | Set date and time | Button | US-E11-02/AC1 |
| debug.clock.plus1m | +1分 | +1 min | Button | US-E11-02/AC1 |
| debug.clock.plus1h | +1時間 | +1 hour | Button | |
| debug.clock.plus1d | +1日 | +1 day | Button | |
| debug.clock.real | 実時間に戻す | Back to real time | Button | US-E11-02/AC3 (verbatim) |
| debug.reminders | お知らせ | Reminders | Section | US-E11-02 |
| debug.reminders.weekly | 週のまとめを表示 | Show weekly summary | Button | US-E11-02/AC2 (verbatim) |
| debug.reminders.dayBefore | 前日のお知らせを表示 | Show day-before reminder | Button | US-E11-02/AC2 (verbatim) |
| debug.reminders.force | 強制表示 | Force show | Button | US-E7-05/AC1 (verbatim) |
| debug.reminders.debugTag | デバッグ表示 | Debug-triggered | Tag on debug-triggered banners | US-E11-02/AC2 |
| debug.samples | サンプル | Samples | Section | US-E11-03 |
| debug.samples.profile | サンプルのプロフィール | Sample profile | Button | US-E11-03/AC1 (verbatim) |
| debug.samples.menu | サンプルの献立（2026年11月） | Sample menu (November 2026) | Button | US-E11-03/AC1 (verbatim) |
| debug.ai | AIの失敗をシミュレーション | Simulate AI failures | Select label | US-E11-03/AC2 |
| debug.ai.off | なし（通常） | None (normal) | Option | |
| debug.ai.mode | {mode} | {mode} | Options: malformed-json, malformed-then-valid, rate-limited-primary, rate-limited, unavailable, url-unreachable (ids shown as-is) | US-E11-03/AC2 |
| debug.ai.usage | 今月のAI呼び出し：{n}回 | AI calls this month: {n} | Status | US-E2-07/AC3 (AC en verbatim) |
| debug.data | 保存データ | Stored data | Section | US-E11-03/AC3 |
| debug.data.decisions | 予定 | Decisions | Table caption (date, state, recipeId, decidedAt) | US-E11-03/AC3 |
| debug.data.overrides | 判定の手動変更 | Overrides | Table caption | US-E11-03/AC3 |
| debug.data.empty | データなし | No data | Empty table | |
| debug.data.clear | テストデータを消去 | Clear test data | Destructive button | US-E11-03/AC3 (verbatim) |
| debug.data.clearConfirm | 保存データをすべて消去しますか？ | Clear all stored data? | Confirm dialog | US-E11-03/AC3 |
| debug.data.clearYes | 消去する | Clear | Dialog destructive | |
| debug.close | 閉じる | Close | Close button | |

## 19. v1 strings (do not ship in the MVP)

| key | ja | en | where | story/AC |
|---|---|---|---|---|
| v1.menu.checkUpdate | 更新を確認 | Check for updates | Settings → 献立表 | US-E3-06/AC4 (v1, verbatim) |
| v1.menu.updated | 園の献立が更新されています | The school has updated the menu | Info banner | US-E3-06/AC4 (v1, verbatim) |
| v1.menu.reimport | 取り込み直す | Import again | Banner action | US-E3-06/AC4 (v1, verbatim) |
| v1.reservation.nudge | 今日は給食の日です。園での予約をお忘れなく。 | It's a school-lunch day. Don't forget to arrange it with the school. | Morning reminder | US-E7-08/AC1 (v1, verbatim) |
| v1.reservation.setting | 給食予約のリマインド | School-lunch reminder | Settings row | US-E7-08/AC1 (v1, verbatim) |
| v1.notify.dayBefore | 明日は手作りお弁当の日！ | Homemade bento tomorrow! | Android notification title | US-E12-03/AC1 (v1, verbatim) |
| v1.notify.denied | 通知が許可されていません | Notifications aren't allowed | Settings status | US-E12-04/AC1 (v1, verbatim) |
| v1.notify.openSettings | 設定を開く | Open settings | Link to system settings | US-E12-04/AC1 (v1) |
| v1.notify.inAppStill | アプリ内のお知らせはこれまでどおり表示されます。 | In-app reminders still appear as before. | Status sub-line | US-E12-04/AC1 (v1) |

---

## Strings no AC defines (designer copy, listed for the orchestrator)

All rows without a story marker above are designer copy. The ones that are **load-bearing for behaviour** (tests will likely assert them by key) and that no AC defines:
`import.month.label` (how the target month is chosen), `import.progress.cancel`, `review.accept`, all `review.reason.*` except the reasons themselves, `review.warn.*` (the 4 `warnings[]` values), `review.noLunch.*` reasons and `review.noLunch.text`, `review.leave.*`, `amb.unsure`, `refresh.review.*` (except the title), `menuCard.dismiss`, `upcoming.notConfirmed`, `upcoming.conflict`, `reminder.weekly.notConfirmed`, `reminder.missedAt`, `reminder.more`, `today.nextUnknown`, `today.cta.plan`, `day.snackOnly`, `day.noMenu`, `day.past`, `day.clear.*`, `day.conflict.kept`, `day.saved.*`, `override.note`, `assess.likely`, `assess.mixedOne`, `assess.notAssessed`, `assess.noLunch`, `assess.override.calc`, `rec.reason.quick`, `rec.mayContain`, `recipe.planPick.*`, `library.conflict.diet`, `settings.menu.promptDay*`, `share.sheet.*` (except the note), `share.copyFailed`, `data.import.*` messages, `storage.corrupt.title/body/reset*`, `toast.saveFailed`, `common.retryIn`.

**BA review (M1 prep, 2026-10-24).** Every key above was checked for natural ja/en and against `data/banned-phrases.json` (0 matches). Fixed, with the reason: `review.accept` (「このままにする」 / "Keep as is": the parent keeps the reading without claiming it is correct), `review.reason.duplicateDate` (a date can appear more than twice), `review.noLunch.hiddenDishes` (en "is … them" disagreed in number; ja names the day), `review.leave.body` (the review keeps no draft, so it no longer promises to continue where the parent left off; OQ-23), `refresh.review.lead` (assessments are recalculated on refresh; only plans and manual overrides are kept, BR-13), `day.saved.later` (en "TBD" → "undecided", as elsewhere), `share.copyFailed` (no "long-press" on desktop). The keys that carry a rule are now quoted by an AC (story/AC column updated): US-E2-01/AC5, US-E2-04/AC8, US-E2-06/AC9, US-E3-01/AC4, US-E3-02/AC3, AC6, US-E3-03/AC4, AC5, US-E3-05/AC13, US-E3-06/AC6, AC7, US-E5-02/AC4, US-E6-01/AC7, US-E6-05/AC3, AC4, US-E7-03/AC4, AC5, US-E7-05/AC5, US-E9-01/AC4, US-E10-02/AC6, AC7, US-E10-03/AC5, AC6. The rest are presentational and need no AC: `review.reason.*` texts, `amb.unsure` (rule already in US-E4-01/AC13), `refresh.review.item.*`, `refresh.review.open*`, `refresh.review.visited`, `upcoming.*`, `reminder.weekly.notConfirmed`, `reminder.missedAt` (rule in US-E7-05/AC2), `day.snackOnly`, `day.past`, `day.clear.*`, `day.conflict.kept`, `day.saved.*` other than `bento`, `override.note`, the `assess.*` explanations (keys fixed by US-E4-02), `rec.mayContain`, `library.conflict.diet`, `share.sheet.*`, `data.import.title/body/confirm`, `storage.corrupt.title/body/reset`.

**M2 prep additions (Designer, 2026-10-25).** New keys: `picker.group.ingredient`, `picker.group.dish`, `picker.group.category`, `picker.withKind` (food-picker kind labels, components §6.3; strings fixed by US-E1-02/AC8) , `settings.menu.needsReview` (refresh list re-entry, Orchestrator ruling), `amb.nonFood` (non-food reading, US-E4-01/AC21), `assess.labels.more` (explanations naming more than 3 foods), `cal.nav.label` (month-nav landmark name, distinct from the grid) and 17 `review.dateFix.*` keys (date correction on review, components §6.9; ja strings quoted by US-E2-05/AC7–AC9 are verbatim). Designer copy no AC quotes yet: `review.dateFix.title`, `.context`, `.contextWeekday`, `.selected`, `.otherWeekday`, `.cantChoose`, `.applyHint`, `.moved` and every en value of the dateFix rows. Checked with `check-copy.mjs`: 0 banned-phrase matches.

## 20. Account and sign-in (`auth.*`, Google sign-in only; PO 2026-11-09)

Reference story: `US-E13` (BA is writing US-E13-01…; replace the placeholder per row when the IDs land). Components §15, flow F18. No technical text in any error; every error says what to do next.

| key | ja | en | where | story/AC |
|---|---|---|---|---|
| auth.login.title | ようこそ | Welcome | Login screen h1 (visually small, under the logo) | US-E13 |
| auth.login.tagline | おべんとう、忘れない。 | Never forget a bento day. | Login screen under the wordmark (same text as `app.tagline`) | US-E13 |
| auth.login.lead | はじめにログインしてください。 | Please sign in to get started. | Login screen, above the button | US-E13 |
| auth.google.button | Googleでログイン | Continue with Google | The one button (G slot + label) | US-E13 |
| auth.google.signingIn | ログインしています… | Signing in… | Button busy label | US-E13 |
| auth.signingIn.live | ログインしています。しばらくお待ちください。 | Signing in. Please wait. | Live region (polite) while busy | US-E13 |
| auth.privacy | お名前とメールアドレスは、ログインの確認にだけ使います。献立やお子さまの情報は、この端末に保存されます。 | Your name and email are used only to sign you in. Menus and your child's details stay on this device. | Login screen, below the button | US-E13 |
| auth.restoring | 確認しています… | Checking… | Splash text and its status label | US-E13 |
| auth.error.cancelled | ログインを中止しました。もう一度お試しください。 | Sign-in was cancelled. Please try again. | Error line (Google window closed) | US-E13 |
| auth.error.popupBlocked | ログイン画面が開けませんでした。ポップアップのブロックを解除して、もう一度お試しください。 | The sign-in window couldn't open. Please allow pop-ups for this site and try again. | Error line | US-E13 |
| auth.error.offline | インターネットにつながっていません。接続を確認して、もう一度お試しください。 | You're offline. Please check your connection and try again. | Error line | US-E13 |
| auth.error.other | ログインできませんでした。しばらくしてから、もう一度お試しください。 | We couldn't sign you in. Please try again in a little while. | Error line (any other failure) | US-E13 |
| auth.expired.title | ログインの有効期限が切れました | Your sign-in has expired | Notice on the login screen after a session ended by itself | US-E13 |
| auth.expired.body | もう一度ログインしてください。この端末のデータはそのまま残っています。 | Please sign in again. The data on this device is still here. | Notice body | US-E13 |
| auth.account.section | アカウント | Account | Settings section h2 | US-E13 |
| auth.account.avatarAlt | {name}さんのアイコン | Profile picture of {name} | Avatar image alt (initial fallback is `aria-hidden`) | US-E13 |
| auth.account.google | Googleアカウントでログイン中 | Signed in with Google | Caption under the email | US-E13 |
| auth.account.noName | お名前未設定 | No name set | Name fallback | US-E13 |
| auth.signOut | ログアウト | Sign out | Settings button (destructive-text) | US-E13 |
| auth.signOut.title | ログアウトしますか？ | Sign out? | Dialog title | US-E13 |
| auth.signOut.body | このアカウントのデータは、この端末に残ります。削除はされません。同じアカウントでもう一度ログインすると、そのまま続きから使えます。 | Your data stays on this device and isn't deleted. Sign in again with the same account to pick up where you left off. | Dialog body | US-E13 |
| auth.signOut.cancel | キャンセル | Cancel | Dialog (initial focus) | US-E13 |
| auth.signOut.confirm | ログアウトする | Sign out | Dialog confirm | US-E13 |
| auth.signOut.busy | ログアウトしています… | Signing out… | Confirm busy label | US-E13 |
| auth.signOut.failed | ログアウトできませんでした。もう一度お試しください。 | We couldn't sign you out. Please try again. | Inline error in the dialog | US-E13 |
| auth.signedOut.live | ログアウトしました。 | You have signed out. | Live region (polite) on the login screen after sign-out | US-E13 |
| auth.docTitle | ログイン | Sign in | `{screen}` for `app.docTitle` | US-E13 |

## 21. Hosted AI proxy messages (`proxy.*`; E14, PO 2026-11-09)

Shown in the import error panel (components §6.7 pattern: message, then the other ways). The AC wording is used as written; no codes, URLs or technical text appear (US-E14-08/AC9). `import.err.unavailable` (US-E2-06/AC2) is reused for an unreachable or origin-refused proxy.

| key | ja | en | where | story/AC |
|---|---|---|---|---|
| proxy.expired | ログインの有効期限が切れました。もう一度ログインしてください。 | Your sign-in has expired. Please sign in again. | Import error panel (hosted proxy refused the token twice) | US-E14-08/AC1 (verbatim) |
| proxy.signInAgain | ログインし直す | Sign in again | Button in that panel (signs out, then the login screen) | US-E14-08/AC1 (verbatim ja; en designer copy) |
| proxy.notAllowed | このアカウントでは献立の読み取りを使えません。 | This account can't use menu reading. | Import error panel; only 「手入力する」 follows | US-E14-08/AC2 (verbatim) |
| proxy.limit.hour | 読み取りの回数が上限に達しました。1時間ほどしてからもう一度お試しください。 | You've reached the reading limit for now. Please try again in about an hour. | Import error panel with the retry countdown | US-E14-03/AC4 (verbatim) |
| proxy.limit.day | 今日の読み取り回数の上限に達しました。明日もう一度お試しください。 | You've reached today's reading limit. Please try again tomorrow. | Import error panel, no retry button | US-E14-03/AC4 (verbatim) |
| proxy.limit.fetch | URLからの取得回数が上限に達しました。PDFをアップロードするか、しばらくしてからお試しください。 | You've reached the limit for fetching from addresses. Upload the PDF, or try again later. | Import error panel after a URL fetch, no retry button | US-E14-03/AC4 (verbatim) |

## 22. Family sharing, cloud storage notice and sharing status (`consent.cloud.*`, `family.*`, `sync.*`; E15, PO 2026-11-10)

Reference stories: US-E15-01 to US-E15-11. Components §16, flow F19. Plain words only: 「家族」「共有」「招待コード」「オンラインデータ」; never "sync", "server", a code or a uid (the AC-fixed 「同期済み」 and 「同期中」 are the only 「同期」). The consent text makes no legal claim and does not say "complies with". The en column is the same content, not a translation word for word.
Placeholders: `{date}` ja 「11月18日（水）」 / en "Wed, Nov 18"; `{dateShort}` 「11月18日」 / "Nov 18"; `{month}` 「2026年12月」 / "December 2026"; `{expiry}` ja 「11月13日（金）10:00」 / en "Fri, Nov 13, 10:00" (local time of the device); `{when}` ja 「今日 14:32」「昨日 14:32」「11月9日 14:32」 / en "Today 14:32", "Yesterday 14:32", "Nov 9, 14:32"; `{n}` count; `{name}` the other member's display name or e-mail, as sent by sign-in, never stored in the catalog; `{code}` the 10-character invite code in two groups (`ABCDE FGHJK`); `{link}` the invite link; `{version}` the notice version number; `{consentDate}` the date the parent agreed (ja 「2026年11月10日」 / en "Nov 10, 2026"); `{state}` the word of a `sync.*` state; `{until}` a date; `{profile}` `yes` or `no`; `{months}`, `{decisions}` counts.

### 22.1 Cloud-storage notice (`consent.cloud.*`; US-E15-02, notice version 1)

| key | ja | en | where | story/AC |
|---|---|---|---|---|
| consent.cloud.title | 家族でデータを共有する前に | Before you share with your family | Notice h2 | US-E15-02/AC1 |
| consent.cloud.lead | お子さまの情報を、インターネット上に保存します。内容を読んで、決めてください。 | Your child's information will be stored online. Please read this and decide. | Notice lead | US-E15-02/AC1 |
| consent.cloud.what.h | 保存するもの | What is stored | dt 1 | US-E15-02/AC2(a) |
| consent.cloud.what.b | お子さまのプロフィールと好み、アレルギーと食事の情報（健康に関わる情報です）、学校の献立表から読み取った献立、家族の予定と決定、設定を保存します。献立表のPDFそのものは保存しません。 | We store your child's profile and preferences, allergies and diet (health-related information), the menus read from the school's PDF, your family's plans and decisions, and your settings. The menu PDF itself is not stored. | dd 1 | US-E15-02/AC2(a) |
| consent.cloud.why.h | 保存する理由 | Why | dt 2 | US-E15-02/AC2(b) |
| consent.cloud.why.b | ログインした端末と、家族のもう1人が、同じカレンダーを見られるようにするためです。 | So that every device you sign in on, and the other person in your family, see the same calendar. | dd 2 | US-E15-02/AC2(b) |
| consent.cloud.where.h | 保存する場所 | Where | dt 3 | US-E15-02/AC2(c) |
| consent.cloud.where.b | Googleのサーバー（Firebase・Firestore）の、日本の東京にあるものに保存します。 | In Google's servers (Firebase, Firestore) located in Tokyo, Japan. | dd 3 | US-E15-02/AC2(c) |
| consent.cloud.who.h | 見られる人 | Who can see it | dt 4 | US-E15-02/AC2(d) |
| consent.cloud.who.b | この家族の2人だけです。ほかの利用者には見えません。販売や広告には使いません。 | Only the two people in this family. No other user can see it. It is never sold or used for advertising. | dd 4 | US-E15-02/AC2(d) |
| consent.cloud.operator.h | 運営者について | The person who runs the app | dt 5 | US-E15-02/AC2(e) |
| consent.cloud.operator.b | 運営者は、保存先の管理画面から、技術的にはデータを見られる状態にあります。データは見ないことにしており、使いません。 | The person who runs this app can technically reach the stored data through the hosting console. They do not look at it and do not use it. | dd 5 | US-E15-02/AC2(e) |
| consent.cloud.ai.h | AIでの読み取りとは別です | AI menu reading is separate | dt 6 | US-E15-02/AC2(f) |
| consent.cloud.ai.b | AIで献立を読み取るときは、別の同意が必要です。家族のデータはAIには送りません。 | Reading a menu with AI needs its own agreement. Your family's data is not sent to the AI. | dd 6 | US-E15-02/AC2(f) |
| consent.cloud.stop.h | やめたいとき | How to stop | dt 7 | US-E15-02/AC2(g) |
| consent.cloud.stop.b | 設定で「家族を抜ける」か「家族のオンラインデータを削除」を選べます。この端末のデータは、そのまま残ります。 | In Settings, choose 「Leave the family」 or 「Delete the family's online data」. The data on this device stays. | dd 7 | US-E15-02/AC2(g) |
| consent.cloud.contact | ご質問は q.milavec+bentominder@gmail.com までご連絡ください。 | Questions? Write to q.milavec+bentominder@gmail.com. | Contact line (the address is a mailto link) | US-E15-02/AC2(h) |
| consent.cloud.parent | 「同意して進む」を押すと、あなたがお子さまの親または保護者であること、そして上の内容に同意することになります。 | By pressing 「Agree and continue」 you confirm that you are the child's parent or guardian and that you agree to the above. | Line above the buttons | US-E15-02/AC2(i) |
| consent.cloud.accept | 同意して進む | Agree and continue | Primary | US-E15-02/AC1 (verbatim ja) |
| consent.cloud.decline | やめる | Not now | Secondary (same size) | US-E15-02/AC4 (verbatim ja) |
| consent.cloud.version | お知らせの版：{version} | Notice version: {version} | Bottom note | US-E15-02/AC2 |
| consent.cloud.upgrade.title | お知らせの内容が変わりました | The notice has changed | Banner, re-consent | US-E15-02/AC6 |
| consent.cloud.upgrade.lead | 新しい内容を読んで、同意するかどうか決めてください。決めるまで、家族との共有は止まっています。この端末のデータは、今までどおり使えます。 | Please read the new version and decide. Sharing with your family is paused until you do. You can keep using the data on this device as usual. | Banner, re-consent | US-E15-02/AC6 |
| consent.cloud.declined.toast | 共有はしていません。この端末だけで使えます。 | Nothing is shared. The app works on this device only. | Toast after declining the first time | US-E15-02/AC4 |
| consent.cloud.paused.title | 新しい内容への同意がまだです | You haven't agreed to the new notice yet | Card banner after declining a new version | US-E15-02/AC6 |
| consent.cloud.paused.body | 同意するまで、家族との共有は止まっています。この端末のデータは今までどおり使えます。 | Sharing with your family stays paused until you agree. You can still use the data on this device. | Card banner | US-E15-02/AC6 |
| consent.cloud.paused.review | 内容を読む | Read the notice | Banner action | US-E15-02/AC6 |
| consent.cloud.agreedOn | {consentDate}に同意しました | You agreed on {consentDate} | Read view and settings row | US-E15-02/AC7 |
| consent.cloud.offline | インターネットに接続してから、同意してください。 | Please connect to the internet, then agree. | Hint while offline | US-E15-01/AC7 |
| consent.cloud.busy | 記録しています… | Saving… | Accept busy label | US-E15-02/AC1 |
| consent.cloud.error | 同意を記録できませんでした。もう一度お試しください。何も保存されていません。 | We couldn't record your answer. Please try again. Nothing has been stored. | Inline error | US-E15-02/AC8 |

### 22.2 Family card, create, invite, members (`family.*`)

| key | ja | en | where | story/AC |
|---|---|---|---|---|
| family.section | 家族で共有 | Family sharing | Settings card h2 | US-E15-01/AC1 |
| family.none.lead | 家族でデータを共有する | Share your data with your family | Card lead (variant A) | US-E15-01/AC1 (verbatim 「家族でデータを共有する」) |
| family.none.hint | 共有しなくても、このアプリは今までどおり使えます。 | The app works as before even if you don't share. | Card hint under the lead | US-E15-01/AC1 |
| family.create | 家族をつくる | Create a family | Primary button | US-E15-01/AC1 (verbatim ja) |
| family.join | 招待コードで参加する | Join with an invite code | Secondary button | US-E15-01/AC1 (verbatim ja) |
| family.offline | インターネットに接続してからお試しください | Please connect to the internet and try again | Card error line when offline | US-E15-01/AC7 (verbatim ja) |
| family.offline.action | インターネットに接続してください | Please connect to the internet | Hint on offline-disabled actions | US-E15-03/AC9, US-E15-08/AC9 (verbatim ja) |
| family.create.busy | 家族をつくっています… | Creating your family… | Create progress | US-E15-01/AC8 |
| family.create.keepOpen | 完了まで、このまま少しお待ちください。 | Please wait a moment until this finishes. | Create progress, second line | US-E15-01/AC5 |
| family.create.paused | データの保存が途中で止まりました。インターネットにつながると、自動で続きます。 | Saving was interrupted. It will continue by itself when you're back online. | Card banner | US-E15-01/AC5 |
| family.toast.created | 家族をつくりました。 | Your family is ready. | Toast | US-E15-01/AC3 |
| family.members | 家族のメンバー | Family members | h3 | US-E15-03/AC8 |
| family.member.you | あなた | You | Tag on your own row | US-E15-04/AC12 |
| family.member.noName | お名前未設定 | No name set | Name fallback | US-E15-03/AC8 |
| family.members.room | あと1人、招待できます。 | There's room for one more person. | Member list with one member | US-E15-03/AC1 |
| family.invite.section | 家族を招待する | Invite someone | Invite block h3 | US-E15-03/AC1 |
| family.invite.lead | 招待コードかリンクを送ると、相手が自分のGoogleアカウントで参加できます。 | Send a code or a link, and they can join with their own Google account. | Invite block lead | US-E15-03/AC1 |
| family.invite | 招待する | Invite | Primary | US-E15-03/AC1 (verbatim ja) |
| family.invite.busy | コードをつくっています… | Making a code… | Busy label | US-E15-03/AC1 |
| family.invite.offline | インターネットに接続してください | Please connect to the internet | Disabled hint | US-E15-03/AC9 (verbatim ja) |
| family.invite.waitUpload | データの保存が終わると、招待できます。 | You can invite someone once your data has finished saving. | Disabled hint | US-E15-01/AC5 |
| family.invite.full | メンバーは上限です | The family is full | Disabled hint | US-E15-03/AC5 (verbatim ja) |
| family.invite.codeLabel | 招待コード | Invite code | Label above the code | US-E15-03/AC1 |
| family.invite.copyCode | コードをコピー | Copy code | Button | US-E15-03/AC1 (「コピー」) |
| family.invite.copyLink | リンクをコピー | Copy link | Button | US-E15-03/AC1 |
| family.invite.share | 送る | Send | Button (OS share sheet) | US-E15-03/AC1 |
| family.invite.copyFailed | コピーできませんでした。コードを長押しして選び、コピーしてください。 | Couldn't copy. Press and hold the code to select and copy it. | Inline | US-E15-03/AC1 |
| family.invite.expires | {expiry}まで使えます。 | Works until {expiry}. | Expiry line | US-E15-03/AC1 |
| family.invite.expiresSoon | まもなく期限です：{expiry}まで | Expires soon: until {expiry} | Expiry line under 6 h | US-E15-03/AC1 |
| family.invite.newCode | 新しいコードをつくる | Make a new code | Text button | US-E15-03/AC4 |
| family.invite.newCode.hint | 今のコードは、すぐに使えなくなります。 | The current code stops working right away. | Hint | US-E15-03/AC4 |
| family.invite.cancel | 招待を取り消す | Cancel the invite | Destructive-text | US-E15-03/AC4 (verbatim ja) |
| family.invite.expired | 招待コードの有効期限が切れました。必要なら、新しいコードをつくってください。 | The invite code has expired. Make a new one if you need to. | Info line | US-E15-03/AC2 |
| family.invite.shareText | BentoMinderの家族に招待します。招待コード：{code}　リンク：{link}　{expiry}まで使えます。 | You're invited to my BentoMinder family. Invite code: {code}  Link: {link}  Works until {expiry}. | Text given to the share sheet | US-E15-03/AC1 |
| family.toast.codeCopied | コードをコピーしました。 | Code copied. | Toast | US-E15-03/AC1 |
| family.toast.linkCopied | リンクをコピーしました。 | Link copied. | Toast | US-E15-03/AC1 |
| family.toast.inviteCancelled | 招待を取り消しました。 | The invite was cancelled. | Toast | US-E15-03/AC4 |
| family.toast.joined | {name}さんが家族に加わりました。 | {name} joined your family. | Toast on the inviter's screen | US-E15-03/AC8 |
| family.consent.row | 共有についてのお知らせを読む | Read the sharing notice | Settings row | US-E15-02/AC7 |

### 22.3 Join and choose what to do with this device's data

| key | ja | en | where | story/AC |
|---|---|---|---|---|
| family.docTitle.join | 家族に参加 | Join a family | `{screen}` for `app.docTitle` | US-E15-04/AC1 |
| family.join.loginHint | 家族への招待を受け取りました。ログインすると、参加の手続きに進みます。 | You've received an invite to a family. Sign in to continue. | Banner on the login screen when a join link was opened | US-E15-04/AC1 |
| family.join.title | 家族に参加する | Join a family | h1 | US-E15-04/AC2 |
| family.join.lead | 招待した人から届いた、10文字のコードを入力してください。 | Enter the 10-character code you received from the person who invited you. | Lead | US-E15-04/AC2 |
| family.join.codeLabel | 招待コード | Invite code | Field label | US-E15-04/AC2 |
| family.join.codeHint | 大文字・小文字、空白、ハイフンは、どれでもかまいません。 | Capital or small letters, spaces and hyphens are all fine. | Field hint | US-E15-04/AC2 |
| family.join.confirm.title | この家族に参加しますか？ | Join this family? | Confirm dialog | US-E15-04/AC2 |
| family.join.confirm.body | 参加すると、家族のデータがこの端末にも表示されます。あなたの変更も、家族に共有されます。 | Once you join, your family's data appears on this device too, and your changes are shared with them. | Confirm dialog | US-E15-04/AC2 |
| family.join.confirm.ok | 参加する | Join | Confirm primary | US-E15-04/AC2 (verbatim ja) |
| family.join.busy | 参加しています… | Joining… | Busy label | US-E15-04/AC2 |
| family.join.busy.live | 家族に参加しています。しばらくお待ちください。 | Joining the family. Please wait. | Polite live | US-E15-04/AC2 |
| family.join.resuming | 参加の続きを進めています… | Finishing joining the family… | Loading text after an interruption | US-E15-04/AC11 |
| family.join.err.format | コードは10文字です。もう一度、確認してください。 | The code has 10 characters. Please check it and try again. | Field error | US-E15-04/AC2 |
| family.join.err.generic | このコードは使えません。コードを確かめるか、招待した人に新しいコードをたのんでください。 | This code can't be used. Check it, or ask the person who invited you for a new one. | Field error (wrong, used or cancelled) | US-E15-03/AC7, US-E15-04/AC10 |
| family.join.err.expired | このコードは、有効期限が切れています。招待した人に、新しいコードをたのんでください。 | This code has expired. Ask the person who invited you for a new one. | Field error | US-E15-03/AC2, AC7 |
| family.join.err.full | この家族は、メンバーが上限に達しています。 | This family has reached its member limit. | Field error | US-E15-03/AC5, AC7 |
| family.join.err.rate | しばらくしてからお試しください | Please try again in a little while | Field error, too many tries | US-E15-03/AC6 (verbatim ja) |
| family.join.err.already | すでに別の家族に参加しています。先に家族を抜けてください | You're already in another family. Please leave it first | Field error | US-E15-04/AC9 (verbatim ja) |
| family.join.err.offline | インターネットに接続してからお試しください | Please connect to the internet and try again | Field error | US-E15-04/AC10 |
| family.toast.joinedSelf | 家族に参加しました。 | You joined the family. | Toast | US-E15-04/AC3 |
| family.adopt.title | この端末のデータをどうしますか | What should happen to the data on this device | Choice h1 | US-E15-04/AC4 (verbatim ja) |
| family.adopt.lead | この端末にも、家族のデータにも、すでにデータがあります。どちらを使うか選んでください。 | This device and your family both already have data. Choose which to use. | Lead, after joining | US-E15-04/AC4 |
| family.adopt.lead.device | この端末には、前から使っているデータがあります。家族のデータとどう合わせるか選んでください。 | This device has data from before. Choose how to combine it with your family's data. | Lead, further device of a member | US-E15-05/AC6 |
| family.adopt.lead.resumed | 家族への参加は完了しています。この端末のデータをどうするかだけ、選んでください。 | You've joined the family. Just choose what to do with this device's data. | Lead, interrupted join | US-E15-04/AC11 |
| family.adopt.later | この選択が終わるまで、この端末の共有は始まりません。 | Sharing on this device starts after you choose. | Shown instead of cancel when joining is already done | US-E15-04/AC11 |
| family.adopt.localSummary | この端末のデータ：プロフィール{profile, select, yes {あり} other {なし}}、献立{months}か月分、予定{decisions}件 | Data on this device: profile {profile, select, yes {yes} other {none}}, {months, plural, one {# menu month} other {# menu months}}, {decisions, plural, one {# plan} other {# plans}} | Summary box | US-E15-04/AC4 |
| family.adopt.legend | 使うデータ | Which data to use | Radio legend | US-E15-04/AC4 |
| family.adopt.useFamily | 家族のデータを使う | Use my family's data | Option 1 (preselected) | US-E15-04/AC4 (verbatim ja) |
| family.adopt.useFamily.desc | この端末のデータは、家族のデータに置き換わります。今のデータは、控えとして残ります。 | The data on this device is replaced by your family's data. Your current data is kept as a backup copy. | Option 1 description | US-E15-04/AC5 |
| family.adopt.addLocal | この端末のデータを足す | Add this device's data | Option 2 | US-E15-04/AC4 (verbatim ja) |
| family.adopt.addLocal.desc | 家族にない月の献立や、家族にない日の予定だけを、家族のデータに足します。同じ月や日のデータと、プロフィール、設定は、家族のものが残ります。控えも残ります。 | Menu months and plans that your family doesn't have yet are added to the family's data. If both have the same month or day, the profile or the settings, your family's version stays. A backup copy is kept too. | Option 2 description | US-E15-04/AC6 |
| family.adopt.continue | 続ける | Continue | Primary | US-E15-04/AC4 |
| family.adopt.safety | 元のデータの控えは、この端末に30日間残ります。いつでも書き出せます。 | A backup copy of your original data stays on this device for 30 days. You can export it at any time. | Note under the buttons | US-E15-04/AC5 |
| family.adopt.busy | 準備しています… | Getting ready… | Busy label | US-E15-04/AC5 |
| family.adopt.busy.live | この端末のデータを準備しています。 | Getting this device's data ready. | Polite live | US-E15-04/AC5 |
| family.safety.title | 元のデータの控え | Backup copy of your original data | Safety-copy row | US-E15-04/AC5 |
| family.safety.until | {until}まで、この端末に残ります。家族には送られません。 | Kept on this device until {until}. It is never sent to your family. | Row line | US-E15-04/AC5 |
| family.safety.export | 控えを書き出す | Export the backup | Secondary | US-E15-04/AC5 |
| family.safety.delete | 控えを削除 | Delete the backup | Destructive-text | US-E15-04/AC5 |
| family.safety.delete.title | 控えを削除しますか？ | Delete the backup copy? | Dialog | US-E15-04/AC5 |
| family.safety.delete.body | この端末に残っている、元のデータの控えが消えます。元に戻せません。 | The backup copy of your original data on this device will be removed. This can't be undone. | Dialog | US-E15-04/AC5 |
| family.safety.delete.confirm | 控えを削除する | Delete the backup | Dialog destructive | US-E15-04/AC5 |

### 22.4 New device: loading and retry

| key | ja | en | where | story/AC |
|---|---|---|---|---|
| family.load.title | 家族のデータを読み込んでいます | Loading your family's data | Loading screen | US-E15-05/AC1 |
| family.load.body | 少しお待ちください。 | One moment, please. | Loading screen | US-E15-05/AC1 |
| family.load.failed.title | 家族のデータを読み込めませんでした | We couldn't load your family's data | Retry screen h1 | US-E15-05/AC3 (verbatim ja) |
| family.load.failed.body | 少し待ってから、もう一度お試しください。この端末には何もつくっていないので、データが消えることはありません。 | Please wait a moment and try again. Nothing has been created on this device, so nothing will be lost. | Retry screen | US-E15-05/AC3 |
| family.load.failed.offline | インターネットにつながっていません。接続を確認して、もう一度お試しください。 | You're offline. Please check your connection and try again. | Retry screen when offline | US-E15-05/AC3 |
| family.load.retry | もう一度試す | Try again | Retry primary | US-E15-05/AC3 (verbatim ja) |
| family.load.busy | 読み込んでいます… | Loading… | Retry busy label | US-E15-05/AC3 |

### 22.5 Sharing status (`sync.*`)

| key | ja | en | where | story/AC |
|---|---|---|---|---|
| sync.localOnly | この端末だけで使っています | Used on this device only | Not shown as a button; screen-reader text if asked | US-E15-06/AC4 |
| sync.synced | 同期済み | Up to date | Status word | US-E15-06/AC3 (verbatim ja) |
| sync.synced.hint | 変更は、家族の端末にも届いています。 | Your changes have reached your family's devices. | Sheet hint | US-E15-06/AC4 |
| sync.syncing | 同期中 | Updating | Status word | US-E15-06/AC3 (verbatim ja) |
| sync.syncing.hint | 家族の端末と、データをそろえています。 | Making your data match your family's devices. | Sheet hint | US-E15-06/AC4 |
| sync.pendingOffline | オフライン・未送信の変更があります | Offline. Some changes haven't been sent yet | Status word | US-E15-06/AC2 (verbatim ja) |
| sync.pendingOffline.hint | インターネットにつながると、自動で送ります。それまでも、アプリは今までどおり使えます。 | They'll be sent by themselves when you're online. You can keep using the app meanwhile. | Sheet hint | US-E15-06/AC2, AC7 |
| sync.retrying | 送信をやり直しています | Trying again | Status word | US-E15-06/AC5 |
| sync.retrying.hint | うまく送れませんでした。時間をおいて、自動でやり直します。 | Sending didn't work. We'll try again by ourselves in a little while. | Sheet hint | US-E15-06/AC5 |
| sync.retryNow | 今すぐ再試行 | Try now | Sheet button after 5 min of failure | US-E15-06/AC5 (verbatim ja) |
| sync.retrying.busy | 試しています… | Trying… | Busy label | US-E15-06/AC5 |
| sync.retry.failed | まだ送れませんでした。しばらくしてから、もう一度お試しください。 | It still didn't go through. Please try again in a little while. | Sheet line | US-E15-06/AC5 |
| sync.needsConsent | 確認が必要です | Needs your OK | Status word | US-E15-02/AC6 (verbatim ja) |
| sync.needsConsent.hint | 新しいお知らせに同意するまで、家族との共有は止まっています。この端末のデータは使えます。 | Sharing with your family is paused until you agree to the new notice. The data on this device still works. | Sheet hint | US-E15-02/AC6 |
| sync.needsConsent.action | お知らせを読む | Read the notice | Sheet button | US-E15-02/AC6 |
| sync.limit | データが大きすぎます | The data is too large | Status word (size limit) | US-E15-10/AC1 (verbatim ja) |
| sync.limit.hint | 家族と共有できる大きさを超えました。共有は止まっていますが、この端末では今までどおり使えます。データの書き出しもできます。 | The data is larger than can be shared. Sharing is paused, but the app works on this device as before, and you can still export your data. | Sheet hint | US-E15-10/AC1 |
| sync.limit.writes | 送信を少し休んでいます | Taking a short break from sending | Status word (hourly write guard) | US-E15-10/AC3 |
| sync.limit.writes.hint | 短い間にたくさんの変更がありました。1時間以内に、自動で再開します。変更は消えません。 | There were many changes in a short time. Sending resumes by itself within an hour. Nothing is lost. | Sheet hint | US-E15-10/AC3 |
| sync.appTooOld | アプリを更新してください | Please update the app | Status word | US-E15-06/AC8 (verbatim ja) |
| sync.appTooOld.hint | 家族のデータは、新しいバージョンのアプリで保存されています。更新するまで、共有は止まっています。この端末のデータは変わりません。 | Your family's data was saved by a newer version of the app. Sharing is paused until you update. The data on this device isn't changed. | Sheet hint | US-E15-06/AC8 |
| sync.appTooOld.action | アプリを更新する | Update the app | Sheet button (reloads the page) | US-E15-06/AC8 |
| sync.membershipEnded | 家族との共有が終わりました | Sharing with the family has ended | Status word | US-E15-08/AC3 |
| sync.membershipEnded.hint | この端末のデータは残っていて、この端末だけで使えます。 | The data on this device is still here and works on this device only. | Sheet hint | US-E15-08/AC2 |
| sync.chip.aria | 共有の状態：{state} | Sharing status: {state} | Accessible name of the app-bar button | US-E15-06/AC4 |
| sync.stale.short | 送信できていません | Not sent | Button word when stale | US-E15-06/AC6 |
| sync.stale | 24時間以上、送れていない変更があります。 | Some changes haven't been sent for over 24 hours. | Sheet warning tag | US-E15-06/AC6 |
| sync.last | 最後に更新：{when} | Last updated: {when} | Row and sheet | US-E15-06/AC6 |
| sync.last.never | まだ更新していません | Not updated yet | Row and sheet | US-E15-06/AC6 |
| sync.pending | 未送信の変更：{n}件 | {n, plural, one {# change} other {# changes}} not sent yet | Row and sheet, hidden at 0 | US-E15-06/AC6 |
| sync.row.label | 共有の状態 | Sharing status | Row label (screen readers) | US-E15-06/AC4 |
| sync.sheet.title | 共有の状態 | Sharing status | Sheet h2 | US-E15-06/AC4 |
| sync.live.pendingOffline | オフラインです。変更は、つながったときに送ります。 | You're offline. Changes will be sent when you're back online. | Polite live | US-E15-06/AC2 |
| sync.live.retrying | 送信をやり直しています。 | Trying to send again. | Polite live after 5 min | US-E15-06/AC5 |
| sync.live.paused | 家族との共有が止まっています。設定で確認してください。 | Sharing with your family is paused. Check Settings. | Polite live | US-E15-06/AC4 |
| sync.live.synced | 同期済みになりました。 | Everything is up to date again. | Polite live after a problem | US-E15-06/AC3 |
| sync.live.ended | 家族との共有が終わりました。 | Sharing with the family has ended. | Polite live | US-E15-08/AC3 |

### 22.6 Notes, leave, remove, delete, ended, import

| key | ja | en | where | story/AC |
|---|---|---|---|---|
| family.lost.one.plan | {dateShort}の予定が、家族の変更で更新されました | The plan for {dateShort} was updated by a change from your family | Note | US-E15-07/AC8 (verbatim pattern ja) |
| family.lost.one.override | {dateShort}の判定の変更が、家族の変更で更新されました | The check change for {dateShort} was updated by a change from your family | Note | US-E15-07/AC8 |
| family.lost.one.menu | {month}の献立が、家族の変更で更新されました | The menu for {month} was updated by a change from your family | Note | US-E15-07/AC8 |
| family.lost.one.profile | お子さまのプロフィールが、家族の変更で更新されました | Your child's profile was updated by a change from your family | Note | US-E15-07/AC8 |
| family.lost.one.settings | 設定が、家族の変更で更新されました | Your settings were updated by a change from your family | Note | US-E15-07/AC8 |
| family.lost.many | {n}件の変更が、家族の変更で更新されました | {n} of your changes were updated by changes from your family | Note, several | US-E15-07/AC8 |
| family.lost.show | 見る | Show | Note action (single) | US-E15-07/AC8 |
| family.lost.showAll | 一覧を見る | See the list | Note action (several) | US-E15-07/AC8 |
| family.lost.row.plan | {dateShort}の予定 | Plan for {dateShort} | List row | US-E15-07/AC8 |
| family.lost.row.override | {dateShort}の判定の変更 | Check change for {dateShort} | List row | US-E15-07/AC8 |
| family.lost.row.menu | {month}の献立 | Menu for {month} | List row | US-E15-07/AC8 |
| family.lost.row.profile | お子さまのプロフィール | Your child's profile | List row | US-E15-07/AC8 |
| family.lost.row.settings | 設定 | Settings | List row | US-E15-07/AC8 |
| family.lost.list.title | 更新された変更 | Updated changes | List dialog h2 | US-E15-07/AC8 |
| family.ignored.title | 一部のデータを読み込めませんでした | Some data couldn't be loaded | Note | US-E15-06/AC9 (verbatim ja) |
| family.ignored.body | 読み込めなかったデータは使っていません。ほかのデータには影響がありません。 | The data that couldn't be loaded isn't used. Everything else is fine. | Note | US-E15-06/AC9 |
| family.leave | 家族を抜ける | Leave the family | Destructive-text | US-E15-08/AC1 (verbatim ja) |
| family.leave.title | 家族を抜けますか？ | Leave the family? | Dialog | US-E15-08/AC1 |
| family.leave.body | あなたは、家族の共有から外れます。もう1人のメンバーは、家族のデータをそのまま使えます。この端末のデータは残り、この端末だけで使えます。 | You'll stop sharing with the family. The other member keeps the family's data and can go on using it. The data on this device stays, and works on this device only. | Dialog | US-E15-08/AC1, AC2 |
| family.leave.confirm | 抜ける | Leave | Dialog destructive | US-E15-08/AC1 (verbatim ja) |
| family.leaveLast.title | 家族のオンラインデータを削除して、抜けますか？ | Delete the family's online data and leave? | Dialog (last member) | US-E15-08/AC4 |
| family.leaveLast.body | あなたは、この家族の最後のメンバーです。抜けると、家族のオンラインデータはすべて削除されます。元に戻せません。この端末のデータは残ります。 | You're the last member of this family. If you leave, all of the family's online data is deleted and this can't be undone. The data on this device stays. | Dialog (last member) | US-E15-08/AC4 |
| family.leaveLast.confirm | 削除して抜ける | Delete and leave | Dialog destructive | US-E15-08/AC4 |
| family.remove | メンバーを外す | Remove this member | Destructive-text next to the other member | US-E15-08/AC3 (verbatim ja) |
| family.remove.title | {name}さんを家族から外しますか？ | Remove {name} from the family? | Dialog | US-E15-08/AC3 |
| family.remove.body | {name}さんは、すぐに家族のデータを見られなくなります。{name}さんの端末には今のデータが残り、その端末だけで使えます。あなたのデータは変わりません。 | {name} will lose access to the family's data right away. Their device keeps its current data and works on that device only. Your data doesn't change. | Dialog | US-E15-08/AC3 |
| family.remove.confirm | 外す | Remove | Dialog destructive | US-E15-08/AC3 |
| family.delete | 家族のオンラインデータを削除 | Delete the family's online data | Destructive-text | US-E15-08/AC5 (verbatim ja) |
| family.delete.title | 家族のオンラインデータを削除しますか？ | Delete the family's online data? | Dialog | US-E15-08/AC5 |
| family.delete.body | プロフィール、献立、予定、判定の変更、メンバーの一覧、招待コードなど、家族のオンラインデータがすべて削除され、元に戻せません。家族みんなの共有が終わります。それぞれの端末のデータと、Googleでのログインは残ります。 | The family's online data (profile, menus, plans, check changes, the member list, invite codes) is all deleted and this can't be undone. Sharing ends for everyone. Each device keeps its own data, and Google sign-in stays. | Dialog | US-E15-08/AC5, AC7 |
| family.delete.confirm | 削除する | Delete | Dialog destructive | US-E15-08/AC5 (verbatim ja) |
| family.typed.word | 削除する | Delete | The word to type (ja verbatim AC5; en compared case-insensitively) | US-E15-08/AC5 |
| family.typed.label | 確認のため、「削除する」と入力してください | To confirm, type 「Delete」 | Typed field label | US-E15-08/AC5 |
| family.typed.hint | 入力すると、下のボタンが押せるようになります。 | The button below becomes available once you've typed it. | Typed field hint | US-E15-08/AC5 |
| family.dialog.busy | 処理しています… | Working… | Dialog busy label | US-E15-08/AC8 |
| family.dialog.busy.live | 処理しています。しばらくお待ちください。 | Working on it. Please wait. | Polite live | US-E15-08/AC8 |
| family.toast.left | 家族を抜けました。この端末のデータは残っています。 | You left the family. The data on this device is still here. | Toast | US-E15-08/AC2 |
| family.toast.removed | {name}さんを家族から外しました。 | {name} was removed from the family. | Toast | US-E15-08/AC3 |
| family.toast.deleted | 家族のオンラインデータを削除しました。 | The family's online data was deleted. | Toast | US-E15-08/AC5 |
| family.ended.removed.title | 家族から外されました | You were removed from the family | Banner | US-E15-08/AC3 (verbatim ja) |
| family.ended.removed.body | この端末のデータは残っていて、この端末だけで使えます。家族のデータは見られなくなりました。 | The data on this device is still here and works on this device only. You can no longer see the family's data. | Banner | US-E15-08/AC3 |
| family.ended.deleted.title | 家族のデータが削除されました | The family's data was deleted | Banner | US-E15-08/AC6 (verbatim ja) |
| family.ended.deleted.body | この端末のデータは残っていて、この端末だけで使えます。もう一度共有するには、家族をつくるか、招待コードで参加してください。 | The data on this device is still here and works on this device only. To share again, create a family or join with an invite code. | Banner | US-E15-08/AC6 |
| family.ended.ok | わかりました | Got it | Banner button | US-E15-08/AC3 |
| family.import.title | 家族全員のデータを置き換えますか？ | Replace the whole family's data? | Dialog (importing while in a family) | US-E15-11/AC6 |
| family.import.body | 選んだファイルの内容で、家族全員のデータが置き換わります。ほかの家族の端末にも反映されます。ファイルにない予定や献立は、家族のデータからも消えます。 | The data of everyone in the family will be replaced by the contents of the file you chose. It will show on your family's other devices too. Plans and menus that aren't in the file are removed for everyone. | Dialog | US-E15-11/AC6 |
| family.import.hint | 心配なときは、先に「データを書き出す」で今のデータを保存してください。 | If you're unsure, save your current data first with 「Export data」. | Dialog | US-E15-11/AC6 |
| family.import.confirm | 家族全員のデータを置き換える | Replace everyone's data | Dialog destructive | US-E15-11/AC6 |
| family.deleteAll.note | このアカウントは、家族に参加しています。ここで消えるのは、この端末のデータだけです。オンラインのデータは残り、次にログインすると、家族のデータがもう一度この端末に読み込まれます。オンラインのデータも消すには、先に「家族のオンラインデータを削除」を使ってください。 | This account is in a family. Only the data on this device is deleted here. The online data stays, and the next time you sign in your family's data is loaded onto this device again. To delete the online data too, first use 「Delete the family's online data」. | Added above the body of `data.deleteAll.body` when in a family | US-E15-11/AC7, US-E15-08/AC7 |
| family.data.where | データはこの端末に保存され、家族との間で共有されています。 | Your data is stored on this device and shared with your family. | Replaces `settings.data.where` while in a family | US-E15-02/AC7 |
