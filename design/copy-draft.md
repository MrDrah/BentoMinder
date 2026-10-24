# BentoMinder: microcopy draft v0.2 (direction preview) — SUPERSEDED

> **Superseded on 2026-10-24 by `design/copy.md` (H2 final).** Kept for history only; do not import strings from this file. Several draft strings changed (state labels now follow US-E4-04/AC2, the reservation en label avoids "booked", fetch errors use the US-E2-02/AC1 wording).

> Status: **draft for the direction review**, 2026-10-24. Covers the screens in `design/preview/index.html` plus the honest disclaimers. Strings marked **AC** are fixed by an acceptance criterion in `docs/ba/user-stories.md` and must stay verbatim (QA asserts on them). The full verbatim sheet (`design/copy.md`) follows once the PO approves the direction.
>
> Japanese is primary and is written as Japanese, not translated from English. English is natural, not word-for-word. `{name}`, `{date}`, `{n}` are placeholders. Dates follow US-E8-03: ja 「11月4日（水）」 / en "Wed, Nov 4"; months 「2026年11月」 / "November 2026". Menu dish names are never translated (US-E8-01/AC4).

## Voice

| | Japanese | English |
|---|---|---|
| Register | です・ます, soft and short; one request per sentence. | Plain, friendly, short. |
| Child references | The nickname as typed (はなちゃん). | Nickname as typed. |
| Food judgement | 「苦手かも」「苦手な食材」 describe the child's taste, never the food. Never 「よくない」「不健康」 (US-E4-04). | "might not enjoy", "foods {name} doesn't like". Never "bad", "unhealthy". |
| Certainty | No 「必ず」「安全です」 about allergens or notifications. Never claim a booking (US-E5-07/AC2). | Same. Never "booked", "reserved for you". |

## Global

| key | ja | en | src |
|---|---|---|---|
| app.name | BentoMinder | BentoMinder | |
| app.tagline | おべんとう、忘れない。 | Never forget a bento day. | brief |
| lang.toggle | 日本語 / EN (segmented; current side filled) | 日本語 / EN | AC US-E8-01/AC2 |
| lang.toggle.aria | 表示言語：日本語 / EN | Display language: 日本語 / EN | |
| nav.recipes | レシピ | Recipes | |
| nav.settings | 設定 | Settings | |
| common.close | 閉じる | Close | |
| common.back | 戻る | Back | |
| common.next | 次へ | Next | |
| common.cancel | キャンセル | Cancel | AC US-E5-06/AC3 |

## Calendar (home)

| key | ja | en | src |
|---|---|---|---|
| cal.title | {year}年{month}月 | {Month} {year} | AC US-E8-03 |
| cal.prevMonth | 前の月 | Previous month | |
| cal.nextMonth | 次の月 | Next month | AC US-E5-01/AC5 |
| cal.today | 今日 | Today | AC US-E5-01/AC5 |
| cal.weekdays (Sunday start) | 日 月 火 水 木 金 土 | Sun Mon Tue Wed Thu Fri Sat | AC US-E5-01/AC2 |
| cal.weekdays (Monday start, if the PO picks it) | 月 火 水 木 金 土 日 | Mon Tue Wed Thu Fri Sat Sun | proposal |
| cell.school | 給食 | Lunch | AC US-E5-01/AC4 |
| cell.notConfirmed | 未定 | TBD | AC US-E5-05/AC1 |
| cell.noLunch | 給食なし | No lunch | AC US-E5-08/AC2 |
| cell.bentoDay | お弁当の日 | Bento day | |
| cell.holiday | 祝 | Hol. | |
| cell.aria | {date}、判定：{assessment}。予定：{decision} | {date}, assessment: {assessment}. plan: {decision} | |
| cell.aria.today | 今日、{…} | Today, {…} | |
| cell.aria.planned | 予定：手作りお弁当「{recipe}」 | plan: homemade bento, {recipe} | |
| assess.enjoy | 食べやすそう | Likely enjoyable | |
| assess.mixed | 好き嫌いが混在 | Mixed | |
| assess.low | 苦手かも | Might not enjoy | |
| assess.none | 未判定 | Not assessed | |
| legend.title | 表示の見かた | Key | |
| legend.rule | 右上の記号＝給食の相性（アプリの見立て）。下の文字と枠＝家族の予定。 | Top-right mark = how the lunch suits {name}. Word or box = your plan. | |
| legend.planned | 手作りお弁当（決定） | Homemade bento (planned) | |
| legend.notConfirmed | 未定（あとで決める） | Not decided (decide later) | |
| legend.suggest | 苦手かも（予定は給食） | Might not enjoy (still lunch) | |
| legend.bentoDay | 園のお弁当の日 | School's bento day | |
| legend.weekend | お休み | No school | |
| upcoming.title | これからの手作りお弁当 | Upcoming homemade bento | |
| upcoming.empty | 予定している手作りお弁当はありません | No homemade bento planned | AC US-E5-01/AC7 |
| upcoming.tomorrow | 明日 | Tomorrow | |
| upcoming.inDays | {n}日後 | In {n} days | |
| upcoming.lowCount | 苦手かもの日が{n}日 | {n} day(s) might not suit {name} | AC7 (count) |
| upcoming.lowCount.sub | 7日以内・まだ計画していません（{dates}） | Next 7 days · not planned yet ({dates}) | |
| menu.missing | {month}月の献立がまだありません | No menu for {Month} yet | |
| menu.import | 献立を取り込む | Import the menu | AC US-E2-01/AC4 |
| share.button | 今週の予定を共有 | Share this week's plan | |
| share.copied | コピーしました | Copied | |

## Today card (top of the calendar)

| key | ja | en | src |
|---|---|---|---|
| today.label | 今日・{date} | Today · {date} | |
| today.planned | 今日は手作りお弁当：{recipe} | Homemade bento today: {recipe} | AC US-E7-03/AC1 |
| today.school | 今日は給食 | School lunch today | AC US-E7-03/AC1 |
| today.notConfirmed | 今日の予定は未定です | Today's plan isn't decided yet | AC US-E7-03/AC1 |
| today.noLunch | 今日は給食がありません | No school lunch today | AC US-E7-03/AC1 |
| today.nextSchoolDay | 次の登園日：{date}{decision} | Next school day: {date} · {decision} | AC US-E7-03/AC2 |
| reservation.note | 給食の予約は園の方法で行ってください（このアプリでは予約されません） | Book school lunch the school's usual way (this app doesn't book it). | AC US-E5-07/AC1 |
| reservation.mark | 園で予約済み（自分で記録） | Booked with the school (my own note) | AC US-E5-07/AC3 |

## Day sheet

| key | ja | en | src |
|---|---|---|---|
| day.title | {month}月{day}日（{weekday}） | {Wkd}, {Mon} {day} | AC US-E5-02/AC1 |
| day.outsideMenu | この日は献立に記載がありません | This day isn't on the menu | AC US-E5-02/AC2 |
| day.menu.heading | 給食の献立 | School lunch menu | |
| day.menu.allergens | 献立表のアレルゲン表示：{list} | Allergens listed on the menu: {list} | |
| day.menu.dislikedTag | 苦手 | dislikes | |
| day.explain.low | {weekday}曜日の給食には、苦手な食材が{n}つ含まれています。 | {Weekday}'s lunch has {n} foods {name} doesn't like. | brief §8 |
| day.explain.foods | 苦手な食材：{list}。判定は、登録した好みと献立表の内容だけで決まります。 | Disliked: {list}. Based only on the preferences you entered and the menu. | |
| day.override | 判定を変更 | Change assessment | |
| day.override.manual | 手動で変更済み | Changed by you | |
| day.decision.heading | この日はどうしますか？ | What's the plan for this day? | |
| day.decision.school | 給食 | School lunch | |
| day.decision.current | いまの予定 | Current plan | |
| day.decision.bento | 手作りお弁当にする | Make a homemade bento | AC US-E5-03/AC1 |
| day.decision.bento.sub | 3つのレシピから選べます | Pick from 3 recipes | |
| day.decision.later | あとで決める | Decide later | AC US-E5-05/AC1 |
| day.decision.later.sub | カレンダーに「未定」と表示します | Shown as TBD in the calendar | |
| day.bentoDay.plan | お弁当を計画する | Plan a bento | AC US-E5-08/AC1 |
| day.cancel.button | 給食に戻す | Back to school lunch | AC US-E5-06/AC2 |
| day.cancel.confirm | {month}月{day}日の手作りお弁当の予定を取り消しますか？ | Cancel the homemade bento plan for {Mon} {day}? | AC US-E5-06/AC3 |
| day.cancel.yes | 取り消す | Cancel the plan | |

## Recommendations and recipe

| key | ja | en | src |
|---|---|---|---|
| rec.title | {date}のお弁当 | Bento for {date} | |
| rec.subtitle | {name}の好みに合いそうな3つ | 3 ideas that suit {name} | |
| rec.top | いちばんのおすすめ | Top pick | |
| rec.time | 約{n}分 | About {n} min | |
| rec.reason.fav | 好きな「{food}」を使います | Uses {name}'s favourite: {food} | |
| rec.reason.theme | テーマ：{theme} | Theme: {theme} | |
| rec.reason.variety | 最近は作っていません | Not made recently | |
| rec.reason.quick | 朝の準備が短め | Quick to make | |
| rec.allergens | アレルゲン：{list} | Allergens: {list} | |
| rec.unknown | 確認が必要：{item}（パッケージをご確認ください） | Check: {item} (see the package) | |
| rec.confirm | この日に決定 | Confirm for this day | AC US-E5-03/AC2 |
| rec.more | ほかの候補を見る | Show other ideas | |
| allergy.disclaimer (recommendations + every recipe detail) | アレルギーの安全を保証するものではありません。使用する食品の表示を必ずご確認ください。 | This app can't guarantee allergy safety. Always check the labels of the foods you use. | AC US-E6-03/AC1 |
| allergy.none | 表示対象のアレルゲン：使用していません（食品の表示をご確認ください） | Labelled allergens: none used (check the food labels) | AC US-E6-03/AC3 |
| recipe.plannedFor | {date}のお弁当に決定 | Planned for {date} | |
| recipe.time | 調理時間 約{n}分 | About {n} min | |
| recipe.ingredients | 材料（1人分） | Ingredients (1 serving) | |
| recipe.steps | 作り方 | Steps | |
| recipe.safety | 衛生と保存 | Food safety | |
| recipe.source | 出典 | Source | |
| recipe.change | レシピを変更 | Change recipe | AC US-E5-06/AC1 |
| recipe.cancel | 給食に戻す | Back to school lunch | AC US-E5-06/AC2 |

## Reminders

| key | ja | en | src |
|---|---|---|---|
| reminder.dayBefore | 明日は手作りお弁当の日！レシピを確認しましょう。 | Homemade bento tomorrow! Take a look at the recipe. | AC US-E7-02/AC1 |
| reminder.dayBefore.cta | レシピを見る | View recipe | AC US-E7-03/AC1 |
| reminder.weekly.lowItem | {date}苦手かも・未計画 | {date} might not enjoy · not planned | AC US-E7-01/AC1 |
| reminder.weekly.plannedItem | {date}手作りお弁当：{recipe} | {date} homemade bento: {recipe} | AC US-E7-01/AC1 |
| reminder.weekly.plan | 計画する | Plan | AC US-E7-01/AC2 |
| reminder.weekly.none | 来週は手作りお弁当の予定はありません | No homemade bento planned next week | AC US-E7-01/AC3 |
| reminder.weekly.noMenuMonth | {month}月の献立がまだありません | No menu for {Month} yet | AC US-E7-01/AC4 |
| reminder.weekly.noMenu | 来週の献立がまだありません | No menu for next week yet | AC US-E7-01/AC5 |
| reminder.dismiss | 閉じる | Dismiss | |
| notify.web.limit | ブラウザ版では、アプリを開いているとき・次に開いたときにお知らせします。閉じている間は通知できません。 | In the browser, reminders appear while the app is open or the next time you open it. They can't reach you while it's closed. | AC US-E7-06/AC1 |
| notify.android.denied | 通知がオフになっています。お知らせを受け取るには、端末の設定で通知を許可してください。 | Notifications are off. Allow them in your phone's settings to get reminders. | |

## Onboarding step 2: school menu

| key | ja | en | src |
|---|---|---|---|
| ob.step | ステップ {n} / {total} | Step {n} of {total} | |
| ob.menu.title | 給食の献立表を取り込みます | Import the school lunch menu | |
| ob.menu.lead | 園が公開している月間献立表（PDF）のURLを入力してください。 | Enter the web address of the monthly menu PDF your school publishes. | |
| ob.menu.url.label | 献立表PDFのURL | Menu PDF address (URL) | |
| ob.menu.url.hint | 次の月からも同じURLを使えます。 | We'll keep this address for next month. | |
| ob.menu.url.error.format | PDFのURL（https://…）を入力してください | Enter the PDF's address (https://…) | AC US-E2-01/AC2 |
| ob.menu.fetch.network | URLから取得できませんでした。PDFをアップロードしてください。 | We couldn't get the file from this address. Please upload the PDF. | AC US-E2-02/AC1 |
| ob.menu.fetch.404 | ファイルが見つかりませんでした。… | (complete with BA) | AC US-E2-02/AC1 |
| ob.menu.fetch.403 | このサイトからは自動で取得できません。… | (complete with BA) | AC US-E2-02/AC1 |
| ob.menu.fetch.html | PDFではないようです。… | (complete with BA) | AC US-E2-02/AC1 |
| ob.menu.or | または | or | |
| ob.menu.upload | PDFファイルを選ぶ | Choose a PDF file | AC US-E2-02/AC1 |
| ob.menu.upload.notPdf | PDFファイルを選んでください | Please choose a PDF file | AC US-E2-03/AC2 |
| ob.menu.upload.tooBig | ファイルが大きすぎます（10MBまで） | The file is too large (10 MB max) | AC US-E2-03/AC3 |
| ob.menu.upload.unreadable | このPDFは読み取れませんでした | We couldn't read this PDF | AC US-E2-03/AC4 |
| ob.menu.import | 取り込む | Import | AC US-E2-01/AC1 |
| ob.menu.loading | 献立を読み取っています… | Reading the menu… | AC US-E2-01/AC1 |
| ob.menu.privacy.title | AIに送る内容 | What we send to the AI | |
| ob.menu.privacy.body | 献立表のPDFだけを送ります。{name}のプロフィールや好みは送りません。最初の読み取りの前に、同意を確認します。 | Only the menu PDF. Nothing about {name}'s profile or preferences. You'll be asked to agree before the first reading. | US-NF-03 |
| ob.menu.privacy.freeTier | 無料プランのAIサービスでは、送った内容が提供元のサービス改善に使われる場合があります。 | On the free AI plan, what you send may be used by the provider to improve its services. | US-E2-08 |
| ob.consent.accept | 同意して読み取る | Agree and read | AC US-E2-08/AC1 |
| ob.consent.decline | 同意しない | Don't agree | AC US-E2-08/AC2 |
