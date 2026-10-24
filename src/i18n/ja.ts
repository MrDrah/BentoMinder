// Japanese catalog: the source of truth for message keys (ADR 001). Values are copied verbatim
// from design/copy.md (H2 final) by key. M0 seeds only the strings the app shell uses; each
// milestone adds the keys of its screens. Placeholders: {name}.
export const ja = {
  // §1 Global, app bar, common actions
  'app.name': 'BentoMinder',
  'app.tagline': 'おべんとう、忘れない。',
  'app.docTitle': '{screen}｜BentoMinder',
  'lang.toggle.ja': '日本語',
  'lang.toggle.en': 'EN',
  'lang.toggle.aria': '表示言語',
  'nav.recipes': 'レシピ',
  'nav.settings': '設定',
  'nav.calendar': 'カレンダー',
  'nav.back': '戻る',
  'nav.backTo': '{screen}に戻る',
  'nav.skip': '本文へ移動',
  'common.loading': '読み込んでいます…',
  'notFound.title': 'ページが見つかりません',
  'notFound.back': 'カレンダーに戻る',

  // §2 Dates, weekdays, formats
  'fmt.month': '{year}年{monthNumber}月',
  'fmt.date': '{monthNumber}月{day}日（{wd}）',
  'fmt.dateNoWd': '{monthNumber}月{day}日',
  'wd.short.0': '日',
  'wd.short.1': '月',
  'wd.short.2': '火',
  'wd.short.3': '水',
  'wd.short.4': '木',
  'wd.short.5': '金',
  'wd.short.6': '土',
  'wd.long.0': '日曜日',
  'wd.long.1': '月曜日',
  'wd.long.2': '火曜日',
  'wd.long.3': '水曜日',
  'wd.long.4': '木曜日',
  'wd.long.5': '金曜日',
  'wd.long.6': '土曜日',

  // §3 Onboarding step names (placeholder screens until M1)
  'ob.step1.name': 'お子さまのこと',
  'ob.step2.name': '献立の取り込み',
  'ob.step3.name': '献立の確認',

  // §8 Calendar (home)
  'cal.prevMonth': '前の月',
  'cal.nextMonth': '次の月',
  'cal.today': '今日',
  'cal.grid.label': '{month}のカレンダー',
  'cell.aria.today': '今日、',
  'cell.aria.outside': '{date}、献立に記載なし',
  'cell.aria.noMenu': '{date}、献立未取り込み',
  'menuCard.missing.current': '今月の献立がまだありません',
  'menuCard.missing.month': '{m}月の献立がまだありません',
  'menuCard.missing.body': '献立表を取り込むと、給食の見立てとお弁当の計画ができます。',

  // §10 Day sheet, §12 Library, §14 Settings (screen titles of the placeholders)
  'day.panel.empty': '日付を選ぶと、ここに詳細が表示されます。',
  'library.title': 'レシピ一覧',
  'settings.title': '設定',

  // §16 Data, storage, recovery
  'storage.unavailable': 'この端末に保存できません',
  'storage.unavailable.body':
    'プライベートブラウズ中か、保存できる容量がいっぱいの可能性があります。今の変更は保存されていません。',
  'storage.newer': '新しいバージョンのデータです。アプリを更新してください。',
  'storage.newer.body': 'データを守るため、このアプリでは何も書き込みません。',
  'storage.corrupt.title': '保存されたデータを読み込めませんでした',
  'storage.corrupt.body': 'どうするか選ぶまで、データには何も書き込みません。',

  // §17 Live messages
  'live.monthChanged': '{month}を表示しています',
} as const;

export type MessageKey = keyof typeof ja;
export type Catalog = Record<MessageKey, string>;
