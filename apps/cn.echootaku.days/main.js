var DAYS_STORAGE_KEY = 'days.events.v1';
var DAYS_CATEGORIES_STORAGE_KEY = 'days.categories.v1';
var DAYS_THEME_STORAGE_KEY = 'days.theme.v1';
var DAYS_COLORS = ['#D97757', '#C6924B', '#66917A', '#6687A8', '#8D78A8', '#B56F83'];
var DAYS_CATEGORY_IDS = { life: true, birthday: true, anniversary: true, study: true, travel: true, other: true };
var DAYS_I18N_FALLBACK = {
  'zh-CN': {
    appName: '朝夕', subtitle: '把期待写进日历，也把走过的日子留在身边。', newEvent: '新建日子',
    nextMeeting: '下一次相见', emptyHero: '记录一个值得期待的日子', startToday: '从今天开始', dayUnit: '天',
    filterAria: '筛选日子', search: '搜索名称或备注', statusFilter: '状态筛选', all: '全部', upcoming: '即将到来', pinnedFilter: '已置顶', past: '已过单次',
    momentsTitle: '我的日子', dayCount: '{count} 个日子', emptyTitle: '还没有符合条件的日子', emptyBody: '创建一个纪念日、生日、考试或任何值得期待的时刻。', createFirst: '创建第一个日子',
    editorNew: '新建日子', editorEdit: '编辑日子', closeEditor: '关闭编辑器', name: '名称', namePlaceholder: '例如：去看海的日子', date: '日期', quickDate: '快捷选择日期', today: '今天', in7Days: '7 天后', in30Days: '30 天后', inOneYear: '一年后',
    category: '分类', chooseCategory: '选择分类', custom: '自定义', categoryPlaceholder: '输入新分类', newCategoryName: '新分类名称', add: '添加', note: '备注', notePlaceholder: '写下一点期待，或关于这一天的故事',
    annual: '每年重复', annualHint: '适合生日与纪念日', pinEvent: '置顶日子', pinHint: '优先展示在首页与 Widget', color: '标记颜色', delete: '删除', cancel: '取消', save: '保存日子', saving: '保存中…',
    pinned: '置顶', soon: '临近', yearly: '每年', once: '单次', remembered: '这一天值得被记住。', editAria: '编辑 {title}',
    categoryAdded: '分类“{label}”已添加', saved: '日子已保存', updated: '日子已更新', deleted: '日子已删除', saveFailed: '保存失败，请稍后重试', categoryFailed: '分类添加失败，请稍后重试', editorFailed: '编辑器打开失败，请重新加载页面', deleteConfirm: '确定删除“{title}”吗？',
    countToday: '今', isToday: '就是今天', remaining: '还有 {count} 天', elapsed: '已经 {count} 天', annualSuffix: ' · 每年', addImportant: '添加一个重要日子', anticipated: '值得期待的日子', widgetEmpty: '在朝夕中创建第一个重要日子', everyDayEchoes: '每一天都有回声',
    themeStudio: '主题工作室', themeSubtitle: '让主界面与小组件拥有同一套气质。', closeTheme: '关闭主题工作室', themePreset: '主题预设', presetSunset: '朝霞', presetViolet: '暮紫', presetOcean: '远海', presetForest: '森语', presetMono: '留白', accentColor: '强调色', glassStrength: 'Glass 强度', cornerStyle: '圆角风格', cornerSoft: '柔和', cornerRound: '圆润', cornerCompact: '利落', glassScope: 'Glass 应用范围', glassPage: '主界面画布', glassHero: '焦点倒数卡', glassToolbar: '搜索与筛选', glassCards: '日子卡片', glassEditor: '编辑器与主题面板', glassWidgets: '主页小组件', themeCode: '分享主题码', themeCodeHint: '主题码只包含外观设置，不包含你的日子。', copyCode: '复制主题码', importCode: '导入主题码', importPlaceholder: '粘贴 CX1- 开头的主题码', applyCode: '应用主题码', resetTheme: '恢复默认', themeSaved: '主题已保存', themeCopied: '主题码已复制', themeSelected: '已选中主题码，请手动复制', themeImported: '主题码已应用', themeInvalid: '主题码无效或版本不受支持', themeReset: '已恢复默认主题',
    presetSystem: '跟随 Myriad', glassProfile: 'Glass 布局', glassProfileAll: '全界面', glassProfileFocus: '重点界面', glassProfileMinimal: '仅小组件', themePreview: '效果预览', themePreviewTitle: '下一次相见', themePreviewMeta: '主题会同步到主页小组件',
    categoryLife: '生活', categoryBirthday: '生日', categoryAnniversary: '纪念', categoryStudy: '学习', categoryTravel: '旅行', categoryOther: '其他',
    eyebrowIntro: '值得铭记的日子', eyebrowMoments: '你的时刻', editorEyebrow: '时间中的一刻', themeEyebrow: '定义你的风格'
  },
  'en-US': {
    appName: 'Days', subtitle: 'Keep future moments close, and remember the days already lived.', newEvent: 'New day',
    nextMeeting: 'NEXT MOMENT', emptyHero: 'Record a day worth looking forward to', startToday: 'Start today', dayUnit: 'days',
    filterAria: 'Filter days', search: 'Search names or notes', statusFilter: 'Status filters', all: 'All', upcoming: 'Upcoming', pinnedFilter: 'Pinned', past: 'Past one-time',
    momentsTitle: 'My days', dayCount: '{count} days', emptyTitle: 'No matching days yet', emptyBody: 'Create an anniversary, birthday, exam, or any moment worth anticipating.', createFirst: 'Create your first day',
    editorNew: 'New day', editorEdit: 'Edit day', closeEditor: 'Close editor', name: 'Name', namePlaceholder: 'For example: A day by the sea', date: 'Date', quickDate: 'Quick date choices', today: 'Today', in7Days: 'In 7 days', in30Days: 'In 30 days', inOneYear: 'In one year',
    category: 'Category', chooseCategory: 'Choose a category', custom: 'Custom', categoryPlaceholder: 'New category', newCategoryName: 'New category name', add: 'Add', note: 'Note', notePlaceholder: 'Write down what makes this day meaningful',
    annual: 'Repeat yearly', annualHint: 'Great for birthdays and anniversaries', pinEvent: 'Pin day', pinHint: 'Show first on the page and Widget', color: 'Marker color', delete: 'Delete', cancel: 'Cancel', save: 'Save day', saving: 'Saving…',
    pinned: 'Pinned', soon: 'Soon', yearly: 'Yearly', once: 'Once', remembered: 'A day worth remembering.', editAria: 'Edit {title}',
    categoryAdded: 'Category “{label}” added', saved: 'Day saved', updated: 'Day updated', deleted: 'Day deleted', saveFailed: 'Could not save. Please try again.', categoryFailed: 'Could not add the category. Please try again.', editorFailed: 'Could not open the editor. Please reload.', deleteConfirm: 'Delete “{title}”?',
    countToday: 'Now', isToday: 'Today', remaining: '{count} days left', elapsed: '{count} days ago', annualSuffix: ' · Yearly', addImportant: 'Add an important day', anticipated: 'Days to look forward to', widgetEmpty: 'Create your first important day in Days', everyDayEchoes: 'Every day leaves an echo',
    themeStudio: 'Theme studio', themeSubtitle: 'Give the page and widgets one shared visual language.', closeTheme: 'Close theme studio', themePreset: 'Theme preset', presetSunset: 'Sunrise', presetViolet: 'Twilight', presetOcean: 'Ocean', presetForest: 'Forest', presetMono: 'Paper', accentColor: 'Accent color', glassStrength: 'Glass strength', cornerStyle: 'Corner style', cornerSoft: 'Soft', cornerRound: 'Round', cornerCompact: 'Crisp', glassScope: 'Glass surfaces', glassPage: 'Page canvas', glassHero: 'Countdown hero', glassToolbar: 'Search and filters', glassCards: 'Day cards', glassEditor: 'Editor and theme panel', glassWidgets: 'Home widgets', themeCode: 'Share theme code', themeCodeHint: 'Theme codes contain appearance only—never your dates.', copyCode: 'Copy theme code', importCode: 'Import theme code', importPlaceholder: 'Paste a theme code beginning with CX1-', applyCode: 'Apply theme code', resetTheme: 'Reset theme', themeSaved: 'Theme saved', themeCopied: 'Theme code copied', themeSelected: 'Theme code selected; copy it manually', themeImported: 'Theme code applied', themeInvalid: 'Invalid or unsupported theme code', themeReset: 'Default theme restored',
    presetSystem: 'Follow Myriad', glassProfile: 'Glass layout', glassProfileAll: 'Everywhere', glassProfileFocus: 'Key surfaces', glassProfileMinimal: 'Widgets only', themePreview: 'Live preview', themePreviewTitle: 'Next moment', themePreviewMeta: 'Your home widget uses the same theme',
    categoryLife: 'Life', categoryBirthday: 'Birthday', categoryAnniversary: 'Anniversary', categoryStudy: 'Study', categoryTravel: 'Travel', categoryOther: 'Other',
    eyebrowIntro: 'DAYS THAT MATTER', eyebrowMoments: 'YOUR MOMENTS', editorEyebrow: 'A MOMENT IN TIME', themeEyebrow: 'MAKE IT YOURS'
  },
  'ja-JP': {
    appName: '日々', subtitle: '楽しみな日も、過ぎた大切な日も、いつでもそばに。', newEvent: '日を追加',
    nextMeeting: '次の大切な日', emptyHero: '楽しみにしたい日を記録しましょう', startToday: '今日から始める', dayUnit: '日',
    filterAria: '日の絞り込み', search: '名前やメモを検索', statusFilter: '状態フィルター', all: 'すべて', upcoming: 'これから', pinnedFilter: '固定済み', past: '過ぎた一回限り',
    momentsTitle: '私の日々', dayCount: '{count} 件', emptyTitle: '条件に合う日がありません', emptyBody: '記念日、誕生日、試験など、楽しみにしたい日を作成しましょう。', createFirst: '最初の日を作成',
    editorNew: '日を追加', editorEdit: '日を編集', closeEditor: '編集画面を閉じる', name: '名前', namePlaceholder: '例：海を見に行く日', date: '日付', quickDate: '日付のクイック選択', today: '今日', in7Days: '7日後', in30Days: '30日後', inOneYear: '1年後',
    category: 'カテゴリー', chooseCategory: 'カテゴリーを選択', custom: 'カスタム', categoryPlaceholder: '新しいカテゴリー', newCategoryName: '新しいカテゴリー名', add: '追加', note: 'メモ', notePlaceholder: 'この日への思いや楽しみを書きましょう',
    annual: '毎年繰り返す', annualHint: '誕生日や記念日に最適', pinEvent: '固定する', pinHint: 'ページとWidgetで優先表示', color: 'マーカー色', delete: '削除', cancel: 'キャンセル', save: '保存', saving: '保存中…',
    pinned: '固定', soon: 'もうすぐ', yearly: '毎年', once: '一回', remembered: '忘れたくない大切な日。', editAria: '{title}を編集',
    categoryAdded: 'カテゴリー「{label}」を追加しました', saved: '保存しました', updated: '更新しました', deleted: '削除しました', saveFailed: '保存できませんでした。もう一度お試しください。', categoryFailed: 'カテゴリーを追加できませんでした。', editorFailed: '編集画面を開けませんでした。再読み込みしてください。', deleteConfirm: '「{title}」を削除しますか？',
    countToday: '今', isToday: '今日です', remaining: 'あと {count} 日', elapsed: '{count} 日前', annualSuffix: ' · 毎年', addImportant: '大切な日を追加', anticipated: '楽しみにしている日', widgetEmpty: '日々で最初の大切な日を作成', everyDayEchoes: '一日一日に余韻がある',
    themeStudio: 'テーマスタジオ', themeSubtitle: 'ページとWidgetの雰囲気を一つに整えます。', closeTheme: 'テーマスタジオを閉じる', themePreset: 'テーマプリセット', presetSunset: '朝焼け', presetViolet: '夕紫', presetOcean: '遠い海', presetForest: '森の声', presetMono: '余白', accentColor: 'アクセント色', glassStrength: 'Glass の強さ', cornerStyle: '角のスタイル', cornerSoft: 'やわらか', cornerRound: '丸み', cornerCompact: 'シャープ', glassScope: 'Glass の適用範囲', glassPage: 'ページ全体', glassHero: 'カウントダウンカード', glassToolbar: '検索とフィルター', glassCards: '日カード', glassEditor: '編集・テーマパネル', glassWidgets: 'ホームWidget', themeCode: 'テーマコードを共有', themeCodeHint: 'テーマコードに日付データは含まれません。', copyCode: 'コードをコピー', importCode: 'テーマコードを読み込む', importPlaceholder: 'CX1- から始まるコードを貼り付け', applyCode: 'テーマを適用', resetTheme: '初期設定に戻す', themeSaved: 'テーマを保存しました', themeCopied: 'テーマコードをコピーしました', themeSelected: 'コードを選択しました。手動でコピーしてください', themeImported: 'テーマコードを適用しました', themeInvalid: 'テーマコードが無効か未対応です', themeReset: '初期テーマに戻しました',
    presetSystem: 'Myriadに合わせる', glassProfile: 'Glass レイアウト', glassProfileAll: '全画面', glassProfileFocus: '主要部分', glassProfileMinimal: 'Widgetのみ', themePreview: 'ライブプレビュー', themePreviewTitle: '次の大切な日', themePreviewMeta: 'ホームWidgetにも同じテーマを適用',
    categoryLife: '生活', categoryBirthday: '誕生日', categoryAnniversary: '記念日', categoryStudy: '勉強', categoryTravel: '旅行', categoryOther: 'その他',
    eyebrowIntro: '大切な日々', eyebrowMoments: 'あなたの瞬間', editorEyebrow: '時の中の一瞬', themeEyebrow: '自分らしいテーマ'
  }
};
Object.assign(DAYS_I18N_FALLBACK['zh-CN'], {
  dataManager:'数据管理', viewMode:'视图', viewCards:'卡片', viewCalendar:'日历', viewTimeline:'时间线', previousMonth:'上个月', nextMonth:'下个月',
  aiQuickAdd:'AI 快速录入', aiHint:'用自然语言描述日子，AI 只填写草稿，由你确认后保存。', aiPlaceholder:'例如：下个月 18 日妈妈生日，每年提醒我', aiParse:'生成草稿', aiUnavailable:'管理员尚未为 Myriad 配置 AI 能力', aiWorking:'正在理解…', aiReady:'草稿已填写，请检查后保存', aiFailed:'AI 生成失败，请稍后重试',
  aiSystemPrompt:'今天是 {today}，界面语言为 {locale}。把用户描述转换为日期草稿。日期必须是 YYYY-MM-DD；不确定时选择最合理的未来日期；只返回符合 schema 的 JSON。用户描述：{request}',
  reminders:'系统提醒', enableReminders:'启用提醒', reminderHint:'由 Myriad 后台任务发送通知', reminderOffsets:'提前提醒', before30Days:'提前 30 天', before7Days:'提前 7 天', before1Day:'提前 1 天', sameDay:'当天', reminderTime:'提醒时间', reminderTaskName:'朝夕：{title}', reminderToday:'今天就是这个重要日子', reminderBefore:'还有 {count} 天', reminderUnavailable:'日子已保存，但当前账号不可使用后台提醒', reminderFailed:'日子已保存，但提醒任务创建失败',
  dataEyebrow:'掌握你的数据', dataHint:'导出完整备份，或预览并导入另一份备份。', closeData:'关闭数据管理', exportBackup:'导出备份', exportHint:'包含日子、自定义分类、提醒和主题设置。', downloadJson:'下载 JSON', importBackup:'导入备份', chooseFile:'选择 JSON 文件', orPasteJson:'或粘贴 JSON', backupJson:'备份 JSON', importWaiting:'选择文件或粘贴内容后预览。', previewImport:'预览', mergeImport:'合并导入', replaceImport:'替换全部', close:'关闭', exported:'备份已下载', exportFailed:'备份导出失败', importSummary:'有效备份：{events} 个日子，{categories} 个自定义分类，{conflicts} 个同 ID 冲突', importInvalid:'备份无效、过大或版本不受支持', replaceConfirm:'替换会覆盖当前全部日子、分类和主题，继续吗？', importMerged:'备份已合并', importReplaced:'备份已替换', importFailed:'导入失败，原数据已保留'
});
Object.assign(DAYS_I18N_FALLBACK['en-US'], {
  dataManager:'Data', viewMode:'View', viewCards:'Cards', viewCalendar:'Calendar', viewTimeline:'Timeline', previousMonth:'Previous month', nextMonth:'Next month',
  aiQuickAdd:'AI quick add', aiHint:'Describe a date naturally. AI fills a draft that you review before saving.', aiPlaceholder:'For example: Mom’s birthday on the 18th next month, remind me yearly', aiParse:'Create draft', aiUnavailable:'Your administrator has not configured Myriad AI', aiWorking:'Understanding…', aiReady:'Draft filled. Review it before saving.', aiFailed:'AI could not create a draft. Try again later.', aiSystemPrompt:'Today is {today} and the UI locale is {locale}. Convert the user request into a date draft. Date must be YYYY-MM-DD. If ambiguous, choose the most reasonable future date. Return only schema-valid JSON. Request: {request}',
  reminders:'Reminders', enableReminders:'Enable reminders', reminderHint:'Sent by a Myriad background task', reminderOffsets:'Reminder lead time', before30Days:'30 days before', before7Days:'7 days before', before1Day:'1 day before', sameDay:'Same day', reminderTime:'Reminder time', reminderTaskName:'Days: {title}', reminderToday:'This important day is today', reminderBefore:'{count} days to go', reminderUnavailable:'Day saved, but background reminders are unavailable for this account', reminderFailed:'Day saved, but reminder scheduling failed',
  dataEyebrow:'YOUR DATA', dataHint:'Export a full backup, or preview and import another backup.', closeData:'Close data manager', exportBackup:'Export backup', exportHint:'Includes days, custom categories, reminders, and theme settings.', downloadJson:'Download JSON', importBackup:'Import backup', chooseFile:'Choose JSON file', orPasteJson:'Or paste JSON', backupJson:'Backup JSON', importWaiting:'Choose a file or paste content to preview it.', previewImport:'Preview', mergeImport:'Merge import', replaceImport:'Replace all', close:'Close', exported:'Backup downloaded', exportFailed:'Could not export the backup', importSummary:'Valid backup: {events} days, {categories} custom categories, {conflicts} ID conflicts', importInvalid:'Invalid, oversized, or unsupported backup', replaceConfirm:'Replace all current days, categories, and theme?', importMerged:'Backup merged', importReplaced:'Backup replaced', importFailed:'Import failed; your original data was kept'
});
Object.assign(DAYS_I18N_FALLBACK['ja-JP'], {
  dataManager:'データ', viewMode:'表示', viewCards:'カード', viewCalendar:'カレンダー', viewTimeline:'タイムライン', previousMonth:'前の月', nextMonth:'次の月',
  aiQuickAdd:'AI クイック入力', aiHint:'自然な文章から下書きを作成します。保存前に必ず確認できます。', aiPlaceholder:'例：来月18日は母の誕生日。毎年知らせて', aiParse:'下書きを作成', aiUnavailable:'管理者が Myriad AI を設定していません', aiWorking:'解析中…', aiReady:'下書きを入力しました。確認して保存してください。', aiFailed:'AIで下書きを作成できませんでした。', aiSystemPrompt:'今日は {today}、UI言語は {locale} です。ユーザーの説明を日付の下書きに変換してください。日付は YYYY-MM-DD。不明確な場合は最も自然な未来の日付を選び、schema に合う JSON のみ返してください。説明：{request}',
  reminders:'リマインダー', enableReminders:'通知を有効にする', reminderHint:'Myriad のバックグラウンドタスクで通知', reminderOffsets:'通知のタイミング', before30Days:'30日前', before7Days:'7日前', before1Day:'1日前', sameDay:'当日', reminderTime:'通知時刻', reminderTaskName:'日々：{title}', reminderToday:'大切な日は今日です', reminderBefore:'あと {count} 日', reminderUnavailable:'保存しましたが、このアカウントでは通知を利用できません', reminderFailed:'保存しましたが、通知を登録できませんでした',
  dataEyebrow:'あなたのデータ', dataHint:'完全なバックアップを書き出すか、別のバックアップを確認して読み込みます。', closeData:'データ管理を閉じる', exportBackup:'バックアップを書き出す', exportHint:'日付、カスタムカテゴリー、通知、テーマを含みます。', downloadJson:'JSON を保存', importBackup:'バックアップを読み込む', chooseFile:'JSON ファイルを選択', orPasteJson:'または JSON を貼り付け', backupJson:'バックアップ JSON', importWaiting:'ファイルを選ぶか内容を貼り付けてください。', previewImport:'確認', mergeImport:'結合して読み込む', replaceImport:'すべて置換', close:'閉じる', exported:'バックアップを保存しました', exportFailed:'バックアップを書き出せませんでした', importSummary:'有効：{events} 件、カスタムカテゴリー {categories} 件、同一 ID {conflicts} 件', importInvalid:'無効、容量超過、または未対応のバックアップです', replaceConfirm:'現在の日付、カテゴリー、テーマをすべて置き換えますか？', importMerged:'バックアップを結合しました', importReplaced:'バックアップで置き換えました', importFailed:'読み込みに失敗しました。元のデータは保持されています'
});
var daysCurrentLocale = 'zh-CN';
function daysNormalizeLocale(locale) { var value = String(locale || '').toLowerCase(); if (value.indexOf('ja') === 0) return 'ja-JP'; if (value.indexOf('en') === 0) return 'en-US'; return 'zh-CN'; }
function daysT(key, values) {
  try {
    if (typeof Tapp !== 'undefined' && Tapp.i18n && typeof Tapp.i18n.t === 'function') {
      var translated = Tapp.i18n.t(key, values || {});
      if (translated && translated !== key) return String(translated);
    }
  } catch (_) {}
  var table = DAYS_I18N_FALLBACK[daysCurrentLocale] || DAYS_I18N_FALLBACK['zh-CN'];
  var text = table[key] || DAYS_I18N_FALLBACK['zh-CN'][key] || key;
  return String(text).replace(/\{(\w+)\}/g, function (_, name) { return values && values[name] != null ? String(values[name]) : ''; });
}
function daysCategoryKey(id) { return 'category' + String(id || 'other').charAt(0).toUpperCase() + String(id || 'other').slice(1); }
function daysDefaultCategories() { return Object.keys(DAYS_CATEGORY_IDS).map(function (id) { return { id: id, label: daysT(daysCategoryKey(id)), custom: false }; }); }
var DAYS_THEME_PRESETS = {
  system: { accent: '#D97757', tint: '124, 104, 181' }, sunset: { accent: '#D97757', tint: '214, 142, 105' }, violet: { accent: '#7C68B5', tint: '139, 116, 188' }, ocean: { accent: '#3C87A8', tint: '77, 151, 177' }, forest: { accent: '#54836A', tint: '91, 139, 110' }, mono: { accent: '#6F6A65', tint: '142, 136, 130' }
};
var DAYS_DEFAULT_THEME = {
  version: 1, preset: 'system', accent: '#D97757', glassStrength: 64, corner: 'round',
  glass: { page: true, hero: true, toolbar: true, cards: true, editor: true, widgets: true }
};
function daysCloneTheme(theme) { return JSON.parse(JSON.stringify(theme)); }
function daysValidColor(value, fallback) { return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).toUpperCase() : fallback; }
function daysClamp(value, min, max, fallback) { var number = Number(value); return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback; }
function daysNormalizeTheme(value) {
  var source = value && typeof value === 'object' ? value : {}; var glass = source.glass && typeof source.glass === 'object' ? source.glass : {};
  var preset = DAYS_THEME_PRESETS[source.preset] ? source.preset : DAYS_DEFAULT_THEME.preset; var defaultAccent = DAYS_THEME_PRESETS[preset].accent;
  return {
    version: 1, preset: preset, accent: daysValidColor(source.accent, defaultAccent), glassStrength: Math.round(daysClamp(source.glassStrength, 0, 100, DAYS_DEFAULT_THEME.glassStrength)),
    corner: ['soft', 'round', 'compact'].indexOf(source.corner) >= 0 ? source.corner : DAYS_DEFAULT_THEME.corner,
    glass: {
      page: glass.page !== false, hero: glass.hero !== false, toolbar: glass.toolbar !== false, cards: glass.cards !== false,
      editor: glass.editor !== false, widgets: glass.widgets !== false
    }
  };
}
function daysHexRgb(hex) { var value = daysValidColor(hex, '#D97757').slice(1); return parseInt(value.slice(0, 2), 16) + ', ' + parseInt(value.slice(2, 4), 16) + ', ' + parseInt(value.slice(4, 6), 16); }
function daysThemeCode(theme) {
  var json = JSON.stringify(daysNormalizeTheme(theme)); var bytes = unescape(encodeURIComponent(json));
  return 'CX1-' + btoa(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function daysThemeFromCode(code) {
  var raw = String(code || '').trim(); if (raw.length > 4096 || raw.indexOf('CX1-') !== 0) throw new Error('invalid theme code');
  var encoded = raw.slice(4).replace(/-/g, '+').replace(/_/g, '/'); while (encoded.length % 4) encoded += '=';
  var parsed = JSON.parse(decodeURIComponent(escape(atob(encoded)))); if (!parsed || parsed.version !== 1) throw new Error('unsupported theme code');
  return daysNormalizeTheme(parsed);
}
function daysIsLegacyDefaultTheme(value) {
  if (!value || value.preset !== 'sunset' || String(value.accent || '').toUpperCase() !== '#D97757' || Number(value.glassStrength) !== 72 || value.corner !== 'round') return false;
  var glass = value.glass || {}; return ['page', 'hero', 'toolbar', 'cards', 'editor', 'widgets'].every(function (key) { return glass[key] !== false; });
}
function daysGlassVisuals(strength) {
  var ratio = daysClamp(strength, 0, 100, DAYS_DEFAULT_THEME.glassStrength) / 100;
  var surfaceCurve = Math.pow(1 - ratio, 1.65);
  var pageCurve = Math.pow(1 - ratio, 1.75);
  return {
    surfaceAlpha: (.02 + surfaceCurve * .96).toFixed(3),
    pageAlpha: (.015 + pageCurve * .965).toFixed(3),
    overlayAlpha: (.24 + surfaceCurve * .74).toFixed(3),
    blur: (ratio * 34).toFixed(0) + 'px',
    saturation: (1 + ratio * .58).toFixed(2),
    sheenAlpha: (.028 + ratio * .092).toFixed(3)
  };
}
async function daysLoadTheme() { try { var stored = await Tapp.storage.get(DAYS_THEME_STORAGE_KEY); return daysIsLegacyDefaultTheme(stored) ? daysCloneTheme(DAYS_DEFAULT_THEME) : daysNormalizeTheme(stored); } catch (_) { return daysCloneTheme(DAYS_DEFAULT_THEME); } }
async function daysSaveTheme(theme) { var normalized = daysNormalizeTheme(theme); await Tapp.storage.set(DAYS_THEME_STORAGE_KEY, normalized); return normalized; }
function daysApplyThemeConfig(root, theme, primaryColor) {
  if (!root) return; var normalized = daysNormalizeTheme(theme); var radius = normalized.corner === 'soft' ? 14 : normalized.corner === 'compact' ? 10 : 20; var styleRoot = document.documentElement || root;
  var preset = DAYS_THEME_PRESETS[normalized.preset]; var glass = daysGlassVisuals(normalized.glassStrength); root.dataset.themePreset = normalized.preset; root.dataset.corner = normalized.corner;
  if (normalized.preset === 'system') {
    var systemAccent = daysValidColor(primaryColor, '');
    styleRoot.style.setProperty('--days-accent', systemAccent || 'var(--tapp-primary, #D97757)');
    styleRoot.style.setProperty('--days-accent-rgb', systemAccent ? daysHexRgb(systemAccent) : 'var(--tapp-primary-rgb, 217, 119, 87)');
  }
  else { styleRoot.style.setProperty('--days-accent', normalized.accent); styleRoot.style.setProperty('--days-accent-rgb', daysHexRgb(normalized.accent)); }
  styleRoot.style.setProperty('--days-theme-tint-rgb', preset.tint); styleRoot.style.setProperty('--days-glass-alpha', glass.surfaceAlpha); styleRoot.style.setProperty('--days-page-glass-alpha', glass.pageAlpha); styleRoot.style.setProperty('--days-overlay-glass-alpha', glass.overlayAlpha); styleRoot.style.setProperty('--days-glass-blur', glass.blur); styleRoot.style.setProperty('--days-glass-saturation', glass.saturation); styleRoot.style.setProperty('--days-glass-sheen-alpha', glass.sheenAlpha); styleRoot.style.setProperty('--days-radius', radius + 'px');
  root.classList.toggle('page-glass-disabled', !normalized.glass.page);
  var pageBackground = document.querySelector('[data-days-background]'); if (pageBackground) pageBackground.classList.toggle('page-glass-disabled', !normalized.glass.page);
  root.querySelectorAll('[data-glass-key]').forEach(function (element) { var key = element.dataset.glassKey; element.classList.toggle('glass-disabled', !normalized.glass[key]); });
}

function daysPad(value) { return String(value).padStart(2, '0'); }
function daysTodayKey() {
  var now = new Date();
  return now.getFullYear() + '-' + daysPad(now.getMonth() + 1) + '-' + daysPad(now.getDate());
}
function daysDateKeyFromOffset(offset) {
  var date = new Date();
  date.setHours(12, 0, 0, 0); date.setDate(date.getDate() + Number(offset || 0));
  return date.getFullYear() + '-' + daysPad(date.getMonth() + 1) + '-' + daysPad(date.getDate());
}
function daysParseDate(value) {
  var match = /^(\d{4,})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  var year = Number(match[1]); var month = Number(match[2]); var day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  var date = new Date(0); date.setFullYear(year, month - 1, day); date.setHours(12, 0, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}
function daysUtcDay(date) { return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000; }
function daysOccurrence(event, now) {
  var source = daysParseDate(event.date);
  if (!source) return null;
  if (!event.annual) return source;
  var candidate = new Date(now.getFullYear(), source.getMonth(), source.getDate(), 12, 0, 0, 0);
  if (candidate.getMonth() !== source.getMonth()) candidate = new Date(now.getFullYear(), source.getMonth() + 1, 0, 12, 0, 0, 0);
  if (daysUtcDay(candidate) < daysUtcDay(now)) {
    candidate = new Date(now.getFullYear() + 1, source.getMonth(), source.getDate(), 12, 0, 0, 0);
    if (candidate.getMonth() !== source.getMonth()) candidate = new Date(now.getFullYear() + 1, source.getMonth() + 1, 0, 12, 0, 0, 0);
  }
  return candidate;
}
function daysDifference(event, now) {
  var target = daysOccurrence(event, now || new Date());
  if (!target) return 0;
  return Math.round(daysUtcDay(target) - daysUtcDay(now || new Date()));
}
function daysNormalizeCategories(value) {
  if (!Array.isArray(value)) return [];
  var seen = {};
  return value.map(function (item) {
    var label = String(item && item.label || '').trim().slice(0, 12); var id = String(item && item.id || '').trim().slice(0, 48);
    if (!label || !id || DAYS_CATEGORY_IDS[id] || seen[id]) return null;
    seen[id] = true; return { id: id, label: label, custom: true };
  }).filter(Boolean);
}
function daysCategoryLabel(category, fallback) { return DAYS_CATEGORY_IDS[category] ? daysT(daysCategoryKey(category)) : String(fallback || '').trim().slice(0, 12) || daysT('categoryOther'); }
function daysNormalizeEvents(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(function (item) { return item && typeof item.title === 'string' && daysParseDate(item.date); }).map(function (item, index) {
    var customLabel = String(item.categoryLabel || '').trim().slice(0, 12); var rawCategory = String(item.category || 'other').slice(0, 48);
    return {
      id: String(item.id || ('legacy-' + index)), title: item.title.trim().slice(0, 80), date: item.date,
      category: (DAYS_CATEGORY_IDS[rawCategory] || customLabel) ? rawCategory : 'other', categoryLabel: DAYS_CATEGORY_IDS[rawCategory] ? '' : customLabel,
      note: String(item.note || '').slice(0, 240),
      annual: Boolean(item.annual), color: /^#[0-9a-f]{6}$/i.test(item.color || '') ? item.color : DAYS_COLORS[index % DAYS_COLORS.length],
      pinned: Boolean(item.pinned),
      createdAt: Number(item.createdAt) || Date.now()
    };
  });
}
function daysNormalizeStore(eventsValue, categoriesValue) {
  var events = daysNormalizeEvents(Array.isArray(eventsValue) ? eventsValue : eventsValue && eventsValue.events);
  var categories = daysNormalizeCategories(categoriesValue).concat(daysNormalizeCategories(eventsValue && eventsValue.categories));
  categories = daysNormalizeCategories(categories);
  events.forEach(function (event) { if (!event.categoryLabel || categories.some(function (item) { return item.id === event.category; })) return; categories.push({ id: event.category, label: event.categoryLabel, custom: true }); });
  return { events: events, categories: categories };
}
function daysSortEvents(events) {
  var now = new Date();
  return events.slice().sort(function (a, b) {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    var ad = daysDifference(a, now); var bd = daysDifference(b, now);
    var ar = ad >= 0 ? 0 : 1; var br = bd >= 0 ? 0 : 1;
    if (ar !== br) return ar - br;
    return ar === 0 ? ad - bd : bd - ad;
  });
}
async function daysLoadStore() {
  try {
    var values = await Promise.all([Tapp.storage.get(DAYS_STORAGE_KEY), Tapp.storage.get(DAYS_CATEGORIES_STORAGE_KEY)]);
    return daysNormalizeStore(values[0], values[1]);
  }
  catch (error) { console.error('[Days] load failed', error); return { events: [], categories: [] }; }
}
async function daysLoadEvents() { return (await daysLoadStore()).events; }
async function daysSaveEvents(events) { await Tapp.storage.set(DAYS_STORAGE_KEY, daysNormalizeEvents(events)); }
async function daysSaveCategories(categories) { await Tapp.storage.set(DAYS_CATEGORIES_STORAGE_KEY, daysNormalizeCategories(categories)); }
function daysFormatDate(date, annual) {
  var options = annual ? { month: 'long', day: 'numeric' } : { year: 'numeric', month: 'long', day: 'numeric' };
  try { return new Intl.DateTimeFormat(daysCurrentLocale, options).format(date); } catch (_) { return date.toLocaleDateString(); }
}
function daysCountCopy(diff) {
  if (diff === 0) return { count: daysT('countToday'), unit: daysT('dayUnit'), phrase: daysT('isToday') };
  if (diff > 0) return { count: String(diff), unit: daysT('dayUnit'), phrase: daysT('remaining', { count: diff }) };
  return { count: String(Math.abs(diff)), unit: daysT('dayUnit'), phrase: daysT('elapsed', { count: Math.abs(diff) }) };
}
function daysNotify(message, type) {
  if (Tapp.ui && typeof Tapp.ui.showNotification === 'function') {
    return Tapp.ui.showNotification({ title: daysT('appName'), message: message, type: type || 'success', duration: 2600 }).catch(function () { return null; });
  }
  return Promise.resolve();
}
var daysThemeOff = null;
function daysApplyTheme(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  if (document.body) document.body.classList.toggle('dark', theme === 'dark');
}
async function daysInitTheme(fallbackTheme) {
  try { daysApplyTheme(await Tapp.ui.getTheme()); } catch (_) { if (fallbackTheme) daysApplyTheme(fallbackTheme); }
  if (daysThemeOff) daysThemeOff(); daysThemeOff = null;
  if (Tapp.ui && typeof Tapp.ui.onThemeChange === 'function') {
    var off = Tapp.ui.onThemeChange(daysApplyTheme); if (typeof off === 'function') daysThemeOff = off;
  }
}
function daysSetText(root, selector, value) { var element = root.querySelector(selector); if (element) element.textContent = value; }
function daysApplyStaticLocale(root) {
  if (!root) return;
  document.documentElement.lang = daysCurrentLocale;
  root.querySelectorAll('[data-i18n]').forEach(function (element) { element.textContent = daysT(element.dataset.i18n); });
  root.querySelectorAll('[data-i18n-placeholder]').forEach(function (element) { element.setAttribute('placeholder', daysT(element.dataset.i18nPlaceholder)); });
  root.querySelectorAll('[data-i18n-aria-label]').forEach(function (element) { element.setAttribute('aria-label', daysT(element.dataset.i18nAriaLabel)); });
}
var daysLocaleOff = null;
async function daysInitLocale(fallbackLocale, onChange) {
  var locale = fallbackLocale;
  try { if (Tapp.i18n && typeof Tapp.i18n.getLocale === 'function') locale = Tapp.i18n.getLocale(); else if (Tapp.ui && typeof Tapp.ui.getLocale === 'function') locale = await Tapp.ui.getLocale(); } catch (_) {}
  daysCurrentLocale = daysNormalizeLocale(locale);
  if (daysLocaleOff) daysLocaleOff(); daysLocaleOff = null;
  if (Tapp.ui && typeof Tapp.ui.onLocaleChange === 'function') {
    var off = Tapp.ui.onLocaleChange(function (nextLocale) { daysCurrentLocale = daysNormalizeLocale(nextLocale); if (typeof onChange === 'function') onChange(); });
    if (typeof off === 'function') daysLocaleOff = off;
  }
}

// Shared by Page and Widget sandboxes. Keep above the surface composition markers.
function daysRequestGlassComposite(target) {
  if (!target || target.isConnected === false || typeof requestAnimationFrame !== 'function') return;
  var token = String((Number(target.dataset.daysGlassPaintToken) || 0) + 1); target.dataset.daysGlassPaintToken = token;
  requestAnimationFrame(function () {
    if (target.isConnected === false || target.dataset.daysGlassPaintToken !== token) return;
    target.style.setProperty('--days-glass-paint-nudge', '.01px');
    requestAnimationFrame(function () {
      if (target.isConnected === false || target.dataset.daysGlassPaintToken !== token) return;
      target.style.removeProperty('--days-glass-paint-nudge');
    });
  });
}
function daysWatchGlassVisibility(target, onVisible) {
  if (!target || typeof IntersectionObserver !== 'function') return null;
  var observer = new IntersectionObserver(function (entries) {
    if (entries.some(function (entry) { return entry.isIntersecting && entry.intersectionRatio > 0; })) onVisible();
  }, { threshold: [0, .01] });
  observer.observe(target); return observer;
}

// ========== Widget Code ==========
var daysWidgetOff = null;
var daysWidgetDestroyBound = false;
var daysWidgetMidnightTimer = null;
var daysWidgetInstances = [];
var daysWidgetRefreshGeneration = 0;
var daysWidgetDestroyed = false;
function daysRememberWidget(root, props) {
  var existing = daysWidgetInstances.find(function (item) { return item.root === root; });
  if (existing) { existing.props = props || {}; existing.generation += 1; return existing; }
  existing = { root: root, props: props || {}, generation: 1, paintTimer: null, visibilityObserver: null };
  existing.visibilityObserver = daysWatchGlassVisibility(root, function () { daysRequestGlassComposite(root); }); daysWidgetInstances.push(existing); return existing;
}
function daysScheduleWidgetGlassComposite(instance) {
  if (!instance || !instance.root) return; daysRequestGlassComposite(instance.root);
  if (instance.paintTimer) clearTimeout(instance.paintTimer);
  instance.paintTimer = setTimeout(function () { instance.paintTimer = null; daysRequestGlassComposite(instance.root); }, 340);
}
async function daysRefreshWidgets() {
  var generation = ++daysWidgetRefreshGeneration;
  daysWidgetInstances = daysWidgetInstances.filter(function (item) { return item.root && item.root.isConnected !== false; });
  var values = await Promise.all([daysLoadEvents(), daysLoadTheme()]);
  if (daysWidgetDestroyed || generation !== daysWidgetRefreshGeneration) return;
  daysWidgetInstances.forEach(function (item) { daysRenderWidget(item.root, values[0], item.props, values[1]); daysScheduleWidgetGlassComposite(item); });
}
function daysScheduleWidgetMidnight() {
  if (daysWidgetMidnightTimer) clearTimeout(daysWidgetMidnightTimer);
  var now = new Date(); var next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0);
  daysWidgetMidnightTimer = setTimeout(function () {
    daysRefreshWidgets().then(daysScheduleWidgetMidnight).catch(console.error);
  }, Math.max(1000, next.getTime() - now.getTime()));
}
function daysWidgetConfig(props) {
  var source = props && (props.config || props.settings) ? (props.config || props.settings) : {};
  return {
    themeSource: source.themeSource === 'instance' ? 'instance' : 'shared', themePreset: DAYS_THEME_PRESETS[source.themePreset] ? source.themePreset : 'system',
    surface: source.surface === 'solid' || source.glassMode === 'none' ? 'solid' : 'glass', density: source.density === 'compact' ? 'compact' : 'comfortable',
    eventScope: ['smart', 'upcoming', 'pinned'].indexOf(source.eventScope) >= 0 ? source.eventScope : 'smart',
    showDate: source.showDate !== false, showCategory: source.showCategory !== false, maxItems: Math.round(daysClamp(source.maxItems, 1, 6, 4))
  };
}
function daysWidgetEvents(events, scope) {
  var sorted = daysSortEvents(events); var now = new Date();
  if (scope === 'upcoming') return sorted.filter(function (event) { return daysDifference(event, now) >= 0; });
  if (scope === 'pinned') return sorted.filter(function (event) { return event.pinned; });
  return sorted;
}
function daysApplyWidgetTheme(root, sharedTheme, config, props) {
  var theme = daysNormalizeTheme(sharedTheme); var glass = daysGlassVisuals(theme.glassStrength); var preset = config.themeSource === 'instance' ? config.themePreset : theme.preset;
  var presetMeta = DAYS_THEME_PRESETS[preset]; var accent = config.themeSource === 'instance' ? presetMeta.accent : theme.accent;
  var glassEnabled = theme.glass.widgets && config.surface === 'glass'; root.dataset.themePreset = preset; root.dataset.surface = glassEnabled ? 'glass' : 'solid'; root.dataset.density = config.density;
  if (preset === 'system') { root.style.setProperty('--days-accent', (props && props.primaryColor) || 'var(--tapp-primary, #D97757)'); root.style.setProperty('--days-accent-rgb', (props && props.primaryColor) ? daysHexRgb(props.primaryColor) : 'var(--tapp-primary-rgb, 217, 119, 87)'); }
  else { root.style.setProperty('--days-accent', accent); root.style.setProperty('--days-accent-rgb', daysHexRgb(accent)); }
  root.style.setProperty('--days-theme-tint-rgb', presetMeta.tint); root.style.setProperty('--tapp-scale', String(daysClamp(props && props.scale, .1, 2, 1))); root.style.setProperty('--tapp-font-scale', String(daysClamp(props && props.fontScale, .1, 2, 1)));
  root.style.setProperty('--days-glass-alpha', glass.surfaceAlpha); root.style.setProperty('--days-glass-blur', glass.blur); root.style.setProperty('--days-glass-saturation', glass.saturation); root.style.setProperty('--days-glass-sheen-alpha', glass.sheenAlpha);
  root.classList.toggle('glass-disabled', !glassEnabled); root.classList.toggle('widget-items-glass', glassEnabled);
  [['[data-widget-date]', config.showDate], ['[data-widget-category]', config.showCategory]].forEach(function (entry) { root.querySelectorAll(entry[0]).forEach(function (element) { element.hidden = !entry[1]; }); });
}
function daysRenderWidget(root, events, props, sharedTheme) {
  var config = daysWidgetConfig(props); var sorted = daysWidgetEvents(events, config.eventScope); var now = new Date();
  daysApplyStaticLocale(root);
  daysApplyWidgetTheme(root, sharedTheme, config, props);
  daysSetText(root, '[data-widget-date]', new Intl.DateTimeFormat(daysCurrentLocale, { month: 'short', day: 'numeric' }).format(now));
  var primary = sorted[0];
  if (primary) {
    var target = daysOccurrence(primary, now); var diff = daysDifference(primary, now); var copy = daysCountCopy(diff);
    root.setAttribute('aria-label', primary.title + '. ' + copy.phrase + '. ' + daysT('dayCount', { count: sorted.length }));
    daysSetText(root, '[data-widget-category]', daysCategoryLabel(primary.category, primary.categoryLabel));
    daysSetText(root, '[data-widget-title]', primary.title);
    daysSetText(root, '[data-widget-count]', copy.count);
    daysSetText(root, '[data-widget-unit]', copy.unit);
    daysSetText(root, '[data-widget-full-date]', daysFormatDate(target, primary.annual));
    var dot = root.querySelector('[data-widget-dot]'); if (dot) dot.style.background = primary.color;
  } else {
    root.setAttribute('aria-label', daysT('widgetEmpty'));
    daysSetText(root, '[data-widget-category]', daysT('nextMeeting'));
    daysSetText(root, '[data-widget-title]', daysT('addImportant'));
    daysSetText(root, '[data-widget-count]', '0'); daysSetText(root, '[data-widget-unit]', daysT('dayUnit'));
    daysSetText(root, '[data-widget-full-date]', daysT('startToday'));
    var emptyDot = root.querySelector('[data-widget-dot]'); if (emptyDot) emptyDot.style.removeProperty('background');
  }
  var list = root.querySelector('[data-widget-list]'); var empty = root.querySelector('[data-widget-empty]');
  if (list) {
    list.textContent = '';
    sorted.slice(0, config.maxItems).forEach(function (event) {
      var item = document.createElement('article'); item.className = 'widget-list-item' + (event.pinned ? ' is-pinned' : '');
      var mark = document.createElement('i'); mark.style.background = event.color;
      var copy = document.createElement('div'); var title = document.createElement('strong'); title.textContent = event.title;
      var meta = document.createElement('span'); meta.textContent = daysFormatDate(daysOccurrence(event, now), event.annual);
      var count = document.createElement('b'); count.textContent = daysCountCopy(daysDifference(event, now)).phrase;
      copy.appendChild(title); copy.appendChild(meta); item.appendChild(mark); item.appendChild(copy); item.appendChild(count); list.appendChild(item);
    });
    if (empty) empty.hidden = sorted.length > 0;
  }
  daysSetText(root, '[data-widget-total]', daysT('dayCount', { count: sorted.length }));
}
function daysRegisterWidgetLayer() {
  if (typeof Tapp === 'undefined' || !Tapp.widgets) return;
  Tapp.widgets['days-countdown'] = {
    render: async function (container, props) {
      var root = container.querySelector('[data-widget-root]') || container;
      var instance = daysRememberWidget(root, props || {}); var generation = instance.generation;
      await daysInitTheme(props && props.theme);
      if (daysWidgetDestroyed || generation !== instance.generation || root.isConnected === false) return;
      await daysInitLocale(props && props.locale, function () { daysRefreshWidgets().catch(console.error); });
      if (daysWidgetDestroyed || generation !== instance.generation || root.isConnected === false) return;
      var initial = await Promise.all([daysLoadEvents(), daysLoadTheme()]);
      if (daysWidgetDestroyed || generation !== instance.generation || root.isConnected === false) return;
      daysRenderWidget(root, initial[0], props || {}, initial[1]);
      daysScheduleWidgetGlassComposite(instance);
      daysScheduleWidgetMidnight();
      if (!daysWidgetOff && Tapp.storage && typeof Tapp.storage.onChanged === 'function') {
        daysWidgetOff = Tapp.storage.onChanged(function (event) {
          if (!event || !event.key || event.key === DAYS_STORAGE_KEY || event.key === DAYS_THEME_STORAGE_KEY) daysRefreshWidgets().catch(console.error);
        });
      }
      if (!daysWidgetDestroyBound) {
        daysWidgetDestroyBound = true;
        if (typeof Tapp.lifecycle.onPause === 'function') Tapp.lifecycle.onPause(function () { if (daysWidgetMidnightTimer) clearTimeout(daysWidgetMidnightTimer); daysWidgetMidnightTimer = null; });
        if (typeof Tapp.lifecycle.onResume === 'function') Tapp.lifecycle.onResume(function () { daysRefreshWidgets().then(daysScheduleWidgetMidnight).catch(console.error); });
        Tapp.lifecycle.onDestroy(function () { daysWidgetDestroyed = true; ++daysWidgetRefreshGeneration; if (daysWidgetOff) daysWidgetOff(); if (daysThemeOff) daysThemeOff(); if (daysLocaleOff) daysLocaleOff(); if (daysWidgetMidnightTimer) clearTimeout(daysWidgetMidnightTimer); daysWidgetInstances.forEach(function (item) { if (item.paintTimer) clearTimeout(item.paintTimer); if (item.visibilityObserver) item.visibilityObserver.disconnect(); }); daysWidgetOff = null; daysThemeOff = null; daysLocaleOff = null; daysWidgetMidnightTimer = null; daysWidgetInstances = []; });
      }
    }
  };
}
if (typeof module !== 'undefined' && module.exports) module.exports.registerWidgetLayer = daysRegisterWidgetLayer;
// ========== Page Code ==========
var daysPageState = { events: [], categories: [], theme: daysCloneTheme(DAYS_DEFAULT_THEME), primaryColor: null, primaryColorOff: null, primaryColorRevision: 0, filter: 'all', query: '', editingId: null, off: null, editorToken: 0, saving: false, editorReturnFocus: null, themeReturnFocus: null, themeSaveTimer: null, themeSaveToken: 0, controller: null, mountToken: 0, storeRefreshToken: 0, themeRefreshToken: 0, glassVisibilityObserver: null, timers: [] };
function daysPageSetTimeout(callback, delay) {
  var handle = setTimeout(function () { daysPageState.timers = daysPageState.timers.filter(function (item) { return item !== handle; }); callback(); }, delay);
  daysPageState.timers.push(handle); return handle;
}
function daysPageClearTimeout(handle) { if (!handle) return; clearTimeout(handle); daysPageState.timers = daysPageState.timers.filter(function (item) { return item !== handle; }); }
function daysApplyPagePrimaryColor(root, color) {
  var normalized = daysValidColor(color, ''); if (!root || !normalized) return false;
  daysPageState.primaryColor = normalized; var styleRoot = document.documentElement || root; var rgb = daysHexRgb(normalized);
  styleRoot.style.setProperty('--tapp-primary', normalized); styleRoot.style.setProperty('--tapp-primary-rgb', rgb);
  if (daysPageState.theme.preset === 'system') { daysApplyThemeConfig(root, daysPageState.theme, normalized); daysRequestGlassComposite(styleRoot); }
  return true;
}
async function daysInitPrimaryColor(root, mountToken) {
  if (daysPageState.primaryColorOff) daysPageState.primaryColorOff(); daysPageState.primaryColorOff = null;
  var observedRevision = daysPageState.primaryColorRevision;
  try {
    if (Tapp.ui && typeof Tapp.ui.onPrimaryColorChange === 'function') {
      var off = Tapp.ui.onPrimaryColorChange(function (color) {
        if (mountToken !== daysPageState.mountToken) return;
        if (daysApplyPagePrimaryColor(root, color)) ++daysPageState.primaryColorRevision;
      });
      if (typeof off === 'function') daysPageState.primaryColorOff = off;
    }
  } catch (_) {}
  try {
    if (Tapp.ui && typeof Tapp.ui.getPrimaryColor === 'function') {
      var color = await Tapp.ui.getPrimaryColor();
      if (mountToken === daysPageState.mountToken && observedRevision === daysPageState.primaryColorRevision) daysApplyPagePrimaryColor(root, color);
    }
  } catch (_) {}
}
function daysElement(tag, className, text) { var el = document.createElement(tag); if (className) el.className = className; if (text != null) el.textContent = text; return el; }
function daysSyncOverlayScrollLock(root) {
  var editor = root && root.querySelector('[data-editor]'); var theme = root && root.querySelector('[data-theme-panel]');
  var locked = Boolean((editor && !editor.hidden) || (theme && !theme.hidden));
  if (locked) {
    var viewportWidth = typeof window !== 'undefined' && Number.isFinite(window.innerWidth) ? window.innerWidth : document.documentElement.clientWidth;
    document.documentElement.style.setProperty('--days-scrollbar-gap', Math.max(0, viewportWidth - document.documentElement.clientWidth) + 'px');
  } else document.documentElement.style.removeProperty('--days-scrollbar-gap');
  document.documentElement.classList.toggle('days-overlay-open', locked);
  if (document.body) document.body.classList.toggle('days-overlay-open', locked);
  Array.prototype.forEach.call(root ? root.children : [], function (child) {
    var isDialog = child.matches && child.matches('[data-editor], [data-theme-panel]');
    if (locked && !isDialog) { child.inert = true; child.setAttribute('aria-hidden', 'true'); child.setAttribute('data-days-dialog-inert', ''); }
    else if (!locked && child.hasAttribute && child.hasAttribute('data-days-dialog-inert')) { child.inert = false; child.removeAttribute('aria-hidden'); child.removeAttribute('data-days-dialog-inert'); }
  });
}
function daysActiveDialog(root) {
  var theme = root && root.querySelector('[data-theme-panel]'); var editor = root && root.querySelector('[data-editor]');
  if (theme && !theme.hidden) return theme; if (editor && !editor.hidden) return editor; return null;
}
function daysTrapDialogFocus(root, event) {
  if (event.key !== 'Tab') return false; var dialog = daysActiveDialog(root); if (!dialog) return false;
  var focusable = Array.prototype.filter.call(dialog.querySelectorAll('button:not([disabled]):not([hidden]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'), function (element) { return element.offsetParent !== null; });
  if (!focusable.length) { event.preventDefault(); return true; }
  var first = focusable[0]; var last = focusable[focusable.length - 1];
  if (!dialog.contains(document.activeElement)) { event.preventDefault(); first.focus(); return true; }
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); return true; }
  if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); return true; }
  return false;
}
function daysAllCategories() { return daysDefaultCategories().concat(daysPageState.categories); }
function daysFindCategory(id) { return daysAllCategories().find(function (item) { return item.id === id; }) || daysDefaultCategories()[0]; }
var DAYS_GLASS_PROFILES = {
  all: { page: true, hero: true, toolbar: true, cards: true, editor: true, widgets: true },
  focus: { page: true, hero: true, toolbar: true, cards: false, editor: true, widgets: true },
  minimal: { page: false, hero: false, toolbar: false, cards: false, editor: false, widgets: true }
};
function daysGlassProfile(theme) {
  return Object.keys(DAYS_GLASS_PROFILES).find(function (name) { return Object.keys(DAYS_GLASS_PROFILES[name]).every(function (key) { return Boolean(theme.glass[key]) === DAYS_GLASS_PROFILES[name][key]; }); }) || '';
}
function daysRenderThemeStudio(root) {
  var panel = root.querySelector('[data-theme-panel]'); if (!panel) return; var theme = daysNormalizeTheme(daysPageState.theme);
  var preset = panel.querySelector('[name="themePreset"]'); var accent = panel.querySelector('[name="themeAccent"]'); var strength = panel.querySelector('[name="glassStrength"]'); var corner = panel.querySelector('[name="themeCorner"]');
  if (preset) preset.value = theme.preset; if (accent) { accent.value = theme.accent; accent.disabled = theme.preset === 'system'; } if (strength) strength.value = String(theme.glassStrength); if (corner) corner.value = theme.corner;
  panel.querySelectorAll('[data-glass-toggle]').forEach(function (input) { input.checked = Boolean(theme.glass[input.dataset.glassToggle]); });
  var profile = daysGlassProfile(theme); panel.querySelectorAll('[data-theme-glass-profile]').forEach(function (button) { button.setAttribute('aria-pressed', button.dataset.themeGlassProfile === profile ? 'true' : 'false'); });
  daysSetText(panel, '[data-glass-strength-value]', theme.glassStrength + '%'); var code = panel.querySelector('[data-theme-code]'); if (code) code.value = daysThemeCode(theme);
  daysApplyThemeConfig(root, theme, daysPageState.primaryColor);
}
function daysThemeFromStudio(root) {
  var panel = root.querySelector('[data-theme-panel]'); if (!panel) return daysCloneTheme(DAYS_DEFAULT_THEME); var glass = {};
  panel.querySelectorAll('[data-glass-toggle]').forEach(function (input) { glass[input.dataset.glassToggle] = input.checked; });
  return daysNormalizeTheme({ version: 1, preset: panel.querySelector('[name="themePreset"]').value, accent: panel.querySelector('[name="themeAccent"]').value, glassStrength: panel.querySelector('[name="glassStrength"]').value, corner: panel.querySelector('[name="themeCorner"]').value, glass: glass });
}
async function daysUpdateThemeFromStudio(root, changedField, persist) {
  var panel = root.querySelector('[data-theme-panel]'); if (!panel) return;
  if (changedField && changedField.name === 'themePreset' && DAYS_THEME_PRESETS[changedField.value]) panel.querySelector('[name="themeAccent"]').value = DAYS_THEME_PRESETS[changedField.value].accent;
  daysPageState.theme = daysThemeFromStudio(root); daysRenderThemeStudio(root);
  if (persist !== false) daysPageState.theme = await daysSaveTheme(daysPageState.theme);
}
function daysScheduleThemeSave() {
  if (daysPageState.themeSaveTimer) daysPageClearTimeout(daysPageState.themeSaveTimer);
  var token = ++daysPageState.themeSaveToken;
  daysPageState.themeSaveTimer = daysPageSetTimeout(function () {
    daysPageState.themeSaveTimer = null;
    if (token !== daysPageState.themeSaveToken) return;
    daysSaveTheme(daysPageState.theme).then(function (saved) { if (token === daysPageState.themeSaveToken) daysPageState.theme = saved; }).catch(console.error);
  }, 140);
}
function daysFlushThemeSave(root, changedField) {
  if (daysPageState.themeSaveTimer) daysPageClearTimeout(daysPageState.themeSaveTimer); daysPageState.themeSaveTimer = null; ++daysPageState.themeSaveToken;
  return daysUpdateThemeFromStudio(root, changedField, true);
}
async function daysApplyGlassProfile(root, profile) {
  if (!DAYS_GLASS_PROFILES[profile]) return; var panel = root.querySelector('[data-theme-panel]'); if (!panel) return;
  panel.querySelectorAll('[data-glass-toggle]').forEach(function (input) { input.checked = DAYS_GLASS_PROFILES[profile][input.dataset.glassToggle]; });
  await daysUpdateThemeFromStudio(root, null, true);
}
function daysOpenThemeStudio(root) {
  var panel = root.querySelector('[data-theme-panel]'); if (!panel) return; daysPageState.themeReturnFocus = document.activeElement; panel.hidden = false; panel.setAttribute('aria-hidden', 'false'); daysSyncOverlayScrollLock(root); daysRenderThemeStudio(root);
  requestAnimationFrame(function () { requestAnimationFrame(function () { panel.classList.add('is-open'); var first = panel.querySelector('select, input, button'); if (first) { try { first.focus({ preventScroll: true }); } catch (_) { first.focus(); } } }); });
}
function daysCloseThemeStudio(root) {
  var panel = root.querySelector('[data-theme-panel]'); if (!panel || panel.hidden) return; var card = panel.querySelector('.theme-card'); var returnFocus = daysPageState.themeReturnFocus; var finished = false; var fallbackTimer = null; daysPageState.themeReturnFocus = null;
  function finishClose() {
    if (finished) return; finished = true; if (card) card.removeEventListener('transitionend', handleTransitionEnd); if (fallbackTimer) daysPageClearTimeout(fallbackTimer);
    if (panel.classList.contains('is-open')) return; panel.setAttribute('aria-hidden', 'true'); panel.hidden = true; daysSyncOverlayScrollLock(root); if (returnFocus && returnFocus.isConnected) { try { returnFocus.focus({ preventScroll: true }); } catch (_) { returnFocus.focus(); } }
  }
  function handleTransitionEnd(event) { if (event.target === card && event.propertyName === 'transform') finishClose(); }
  if (card) card.addEventListener('transitionend', handleTransitionEnd, daysPageState.controller ? { signal: daysPageState.controller.signal } : undefined); panel.classList.remove('is-open'); fallbackTimer = daysPageSetTimeout(finishClose, 380);
}
async function daysCopyThemeCode(root) {
  var code = root.querySelector('[data-theme-code]'); if (!code) return; code.focus(); code.select(); var copied = false;
  try { copied = Boolean(document.execCommand && document.execCommand('copy')); } catch (_) {}
  await daysNotify(daysT(copied ? 'themeCopied' : 'themeSelected'), copied ? 'success' : 'info');
}
async function daysImportThemeCode(root) {
  var input = root.querySelector('[data-theme-import]'); if (!input) return;
  try { daysPageState.theme = await daysSaveTheme(daysThemeFromCode(input.value)); input.value = ''; daysRenderThemeStudio(root); daysRenderPage(root); await daysNotify(daysT('themeImported')); }
  catch (_) { await daysNotify(daysT('themeInvalid'), 'error'); input.focus(); }
}
async function daysResetTheme(root) { daysPageState.theme = await daysSaveTheme(daysCloneTheme(DAYS_DEFAULT_THEME)); daysRenderThemeStudio(root); daysRenderPage(root); await daysNotify(daysT('themeReset'), 'info'); }
function daysSetCategoryPopover(root, open) {
  var popover = root.querySelector('[data-category-popover]'); var trigger = root.querySelector('[data-action="toggle-category"]');
  if (!popover || !trigger) return;
  popover.hidden = !open; trigger.setAttribute('aria-expanded', open ? 'true' : 'false'); trigger.classList.toggle('is-open', open);
  if (open) { var input = popover.querySelector('[data-category-input]'); if (input) daysPageSetTimeout(function () { if (!popover.hidden && input.isConnected) input.focus(); }, 40); }
}
function daysRenderCategoryPicker(root, selectedId) {
  var form = root.querySelector('[data-event-form]'); if (!form) return;
  var field = form.querySelector('[name="category"]'); var value = root.querySelector('[data-category-value]'); var options = root.querySelector('[data-category-options]');
  if (!field || !value || !options) return;
  var selected = daysFindCategory(selectedId || field.value); field.value = selected.id; value.textContent = selected.label; options.textContent = '';
  daysAllCategories().forEach(function (category) {
    var button = daysElement('button', 'category-option', category.label); button.type = 'button'; button.dataset.action = 'select-category'; button.dataset.categoryId = category.id;
    button.setAttribute('aria-pressed', category.id === selected.id ? 'true' : 'false');
    if (category.custom) { var badge = daysElement('small', '', daysT('custom')); button.appendChild(badge); }
    options.appendChild(button);
  });
}
async function daysAddCategory(root) {
  var input = root.querySelector('[data-category-input]'); if (!input) return;
  var label = input.value.trim().slice(0, 12); if (!label) { input.focus(); return; }
  var existing = daysAllCategories().find(function (item) { return item.label.toLowerCase() === label.toLowerCase(); });
  if (existing) { daysRenderCategoryPicker(root, existing.id); input.value = ''; daysSetCategoryPopover(root, false); return; }
  var category = { id: 'custom-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6), label: label, custom: true };
  var nextCategories = daysPageState.categories.concat(category); await daysSaveCategories(nextCategories); daysPageState.categories = nextCategories;
  input.value = ''; daysRenderCategoryPicker(root, category.id); daysSetCategoryPopover(root, false); await daysNotify(daysT('categoryAdded', { label: label }));
}
function daysFilteredEvents() {
  var query = daysPageState.query.trim().toLowerCase(); var now = new Date();
  return daysSortEvents(daysPageState.events).filter(function (event) {
    var diff = daysDifference(event, now);
    if (daysPageState.filter === 'upcoming' && diff < 0) return false;
    if (daysPageState.filter === 'past' && (event.annual || diff >= 0)) return false;
    if (daysPageState.filter === 'pinned' && !event.pinned) return false;
    return !query || event.title.toLowerCase().includes(query) || event.note.toLowerCase().includes(query);
  });
}
function daysRenderHero(root) {
  var event = daysSortEvents(daysPageState.events)[0];
  if (!event) {
    daysSetText(root, '[data-hero-category]', daysT('nextMeeting')); daysSetText(root, '[data-hero-title]', daysT('emptyHero'));
    daysSetText(root, '[data-hero-date]', daysT('startToday')); daysSetText(root, '[data-hero-count]', '0'); daysSetText(root, '[data-hero-unit]', daysT('dayUnit')); return;
  }
  var target = daysOccurrence(event, new Date()); var copy = daysCountCopy(daysDifference(event, new Date()));
  daysSetText(root, '[data-hero-category]', daysCategoryLabel(event.category, event.categoryLabel)); daysSetText(root, '[data-hero-title]', event.title);
  daysSetText(root, '[data-hero-date]', daysFormatDate(target, event.annual) + (event.annual ? daysT('annualSuffix') : ''));
  daysSetText(root, '[data-hero-count]', copy.count); daysSetText(root, '[data-hero-unit]', copy.unit);
  var hero = root.querySelector('[data-hero]'); if (hero) hero.style.setProperty('--event-color', event.color);
}
function daysRenderPage(root) {
  daysApplyStaticLocale(root); daysApplyThemeConfig(root, daysPageState.theme, daysPageState.primaryColor); daysRenderHero(root); var events = daysFilteredEvents(); var list = root.querySelector('[data-event-list]'); var empty = root.querySelector('[data-empty]');
  list.textContent = ''; daysSetText(root, '[data-event-total]', daysT('dayCount', { count: events.length })); empty.hidden = events.length > 0;
  events.forEach(function (event) {
    var diff = daysDifference(event, new Date()); var target = daysOccurrence(event, new Date()); var copy = daysCountCopy(diff);
    var card = daysElement('article', 'event-card glass days-glass-surface' + (event.pinned ? ' is-pinned' : '')); card.style.setProperty('--event-color', event.color); card.tabIndex = 0; card.setAttribute('role', 'button'); card.setAttribute('aria-label', daysT('editAria', { title: event.title })); card.dataset.eventId = event.id; card.dataset.glassKey = 'cards'; card.classList.toggle('glass-disabled', !daysPageState.theme.glass.cards);
    var top = daysElement('div', 'event-card-top'); var category = daysElement('span', 'event-category', daysCategoryLabel(event.category, event.categoryLabel));
    var badges = daysElement('span', 'event-badges');
    if (event.pinned) badges.appendChild(daysElement('span', 'event-pin', daysT('pinned')));
    if (diff >= 0 && diff <= 7) badges.appendChild(daysElement('span', 'event-soon', diff === 0 ? daysT('today') : daysT('soon')));
    badges.appendChild(daysElement('span', 'event-repeat', event.annual ? daysT('yearly') : daysT('once'))); top.appendChild(category); top.appendChild(badges);
    var title = daysElement('h3', '', event.title); var note = daysElement('p', 'event-note', event.note || daysT('remembered'));
    var bottom = daysElement('div', 'event-card-bottom'); var date = daysElement('span', 'event-date', daysFormatDate(target, event.annual));
    var counter = daysElement('strong', 'event-count', copy.phrase); bottom.appendChild(date); bottom.appendChild(counter);
    card.appendChild(top); card.appendChild(title); card.appendChild(note); card.appendChild(bottom); list.appendChild(card);
  });
}
function daysOpenEditor(root, event) {
  var panel = root.querySelector('[data-editor]'); var form = root.querySelector('[data-event-form]');
  if (!panel || !form) throw new Error('[Days] editor template is incomplete');
  var idField = form.querySelector('[name="id"]'); var titleField = form.querySelector('[name="title"]'); var dateField = form.querySelector('[name="date"]');
  var categoryField = form.querySelector('[name="category"]'); var noteField = form.querySelector('[name="note"]'); var annualField = form.querySelector('[name="annual"]'); var pinnedField = form.querySelector('[name="pinned"]'); var colorField = form.querySelector('[name="color"]');
  if (!idField || !titleField || !dateField || !categoryField || !noteField || !annualField || !pinnedField || !colorField) throw new Error('[Days] editor fields are incomplete');
  daysPageState.editorReturnFocus = document.activeElement && typeof document.activeElement.focus === 'function' ? document.activeElement : null;
  var token = ++daysPageState.editorToken; panel.hidden = false; panel.setAttribute('aria-hidden', 'false'); panel.classList.remove('is-open'); daysSyncOverlayScrollLock(root); form.reset();
  daysPageState.editingId = event ? event.id : null; idField.value = event ? event.id : '';
  titleField.value = event ? event.title : ''; dateField.value = event ? event.date : daysTodayKey();
  categoryField.value = event ? event.category : 'life'; noteField.value = event ? event.note : '';
  annualField.checked = event ? event.annual : false; pinnedField.checked = event ? event.pinned : false; colorField.value = event ? event.color : DAYS_COLORS[daysPageState.events.length % DAYS_COLORS.length];
  daysRenderCategoryPicker(root, categoryField.value); daysSetCategoryPopover(root, false);
  daysSetText(root, '[data-editor-title]', event ? daysT('editorEdit') : daysT('editorNew')); var deleteButton = root.querySelector('[data-action="delete-event"]'); if (deleteButton) deleteButton.hidden = !event;
  requestAnimationFrame(function () { requestAnimationFrame(function () {
    if (daysPageState.editorToken !== token || panel.hidden) return; panel.classList.add('is-open');
    try { titleField.focus({ preventScroll: true }); } catch (_) { titleField.focus(); }
  }); });
}
function daysCloseEditor(root) {
  var panel = root.querySelector('[data-editor]'); if (!panel || panel.hidden) return;
  var returnFocus = daysPageState.editorReturnFocus; daysPageState.editorReturnFocus = null; ++daysPageState.editorToken; panel.classList.remove('is-open'); daysPageState.editingId = null; daysSetCategoryPopover(root, false);
  daysPageSetTimeout(function () { if (!panel.classList.contains('is-open')) { panel.setAttribute('aria-hidden', 'true'); panel.hidden = true; daysSyncOverlayScrollLock(root); if (returnFocus && returnFocus.isConnected) { try { returnFocus.focus({ preventScroll: true }); } catch (_) { returnFocus.focus(); } } } }, 300);
}
function daysSetQuickDate(root, offset) {
  var field = root.querySelector('[data-event-form] [name="date"]'); if (!field) return;
  field.value = daysDateKeyFromOffset(offset); field.dispatchEvent(new Event('change', { bubbles: true }));
}
async function daysSubmitEvent(root, form) {
  var idField = form.querySelector('[name="id"]'); var titleField = form.querySelector('[name="title"]'); var dateField = form.querySelector('[name="date"]'); var categoryField = form.querySelector('[name="category"]');
  var noteField = form.querySelector('[name="note"]'); var annualField = form.querySelector('[name="annual"]'); var pinnedField = form.querySelector('[name="pinned"]'); var colorField = form.querySelector('[name="color"]');
  if (!idField || !titleField || !dateField || !categoryField || !noteField || !annualField || !pinnedField || !colorField) throw new Error('[Days] editor fields are incomplete');
  if (typeof form.reportValidity === 'function' && !form.reportValidity()) return false;
  var id = String(idField.value || ''); var existing = daysPageState.events.find(function (event) { return event.id === id; }); var selectedCategory = daysFindCategory(categoryField.value);
  var next = { id: id || ('day-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7)), title: String(titleField.value || '').trim(), date: String(dateField.value || ''), category: selectedCategory.id, categoryLabel: selectedCategory.custom ? selectedCategory.label : '', note: String(noteField.value || '').trim(), annual: annualField.checked, pinned: pinnedField.checked, color: String(colorField.value || '#D97757'), createdAt: existing ? existing.createdAt : Date.now() };
  if (!next.title || !daysParseDate(next.date)) return false;
  var nextEvents = existing ? daysPageState.events.map(function (event) { return event.id === id ? next : event; }) : daysPageState.events.concat(next);
  await daysSaveEvents(nextEvents); daysPageState.events = nextEvents; daysCloseEditor(root); daysRenderPage(root); await daysNotify(daysT(existing ? 'updated' : 'saved')); return true;
}
async function daysHandleSave(root) {
  if (daysPageState.saving) return;
  var form = root.querySelector('[data-event-form]'); var button = root.querySelector('[data-action="save-event"]'); if (!form) throw new Error('[Days] editor form is missing');
  daysPageState.saving = true; if (button) { button.disabled = true; button.textContent = daysT('saving'); }
  try { await daysSubmitEvent(root, form); }
  catch (error) { console.error('[Days] save failed', error); await daysNotify(daysT('saveFailed'), 'error'); }
  finally { daysPageState.saving = false; if (button) { button.disabled = false; button.textContent = daysT('save'); } }
}
async function daysDeleteEvent(root) {
  var event = daysPageState.events.find(function (item) { return item.id === daysPageState.editingId; }); if (!event) return;
  var confirmed = await Tapp.ui.confirm(daysT('deleteConfirm', { title: event.title })); if (!confirmed) return;
  var nextEvents = daysPageState.events.filter(function (item) { return item.id !== event.id; });
  await daysSaveEvents(nextEvents); daysPageState.events = nextEvents; daysCloseEditor(root); daysRenderPage(root); await daysNotify(daysT('deleted'), 'info');
}
async function daysMountPage(root) {
  if (root.dataset.ready === 'true' || root.dataset.ready === 'mounting') return; root.dataset.ready = 'mounting'; var mountToken = ++daysPageState.mountToken;
  await daysInitTheme(); if (mountToken !== daysPageState.mountToken) return;
  await daysInitLocale(null, function () { daysRenderPage(root); if (!root.querySelector('[data-editor]').hidden) { var editing = daysPageState.events.find(function (item) { return item.id === daysPageState.editingId; }); daysSetText(root, '[data-editor-title]', editing ? daysT('editorEdit') : daysT('editorNew')); daysRenderCategoryPicker(root, root.querySelector('[name="category"]').value); } if (!root.querySelector('[data-theme-panel]').hidden) daysRenderThemeStudio(root); });
  if (mountToken !== daysPageState.mountToken) return;
  var initial = await Promise.all([daysLoadStore(), daysLoadTheme(), daysInitPrimaryColor(root, mountToken)]); if (mountToken !== daysPageState.mountToken) return;
  daysPageState.events = initial[0].events; daysPageState.categories = initial[0].categories; daysPageState.theme = initial[1]; daysRenderPage(root);
  if (daysPageState.glassVisibilityObserver) daysPageState.glassVisibilityObserver.disconnect();
  daysPageState.glassVisibilityObserver = daysWatchGlassVisibility(root, function () { daysRequestGlassComposite(document.documentElement); });
  daysRequestGlassComposite(document.documentElement); daysPageSetTimeout(function () { daysRequestGlassComposite(document.documentElement); }, 340);
  if (daysPageState.controller) daysPageState.controller.abort(); daysPageState.controller = new AbortController(); var listenerOptions = { signal: daysPageState.controller.signal };
  root.addEventListener('click', function (event) {
    var action = event.target.closest('[data-action]');
    if (action) {
      var name = action.dataset.action;
      if (name === 'new-event') { daysCloseThemeStudio(root); try { daysOpenEditor(root, null); } catch (error) { console.error(error); daysNotify(daysT('editorFailed'), 'error'); } }
      if (name === 'open-theme') { daysCloseEditor(root); daysOpenThemeStudio(root); }
      if (name === 'close-theme') daysCloseThemeStudio(root);
      if (name === 'copy-theme-code') daysCopyThemeCode(root).catch(console.error);
      if (name === 'import-theme-code') daysImportThemeCode(root).catch(console.error);
      if (name === 'reset-theme') daysResetTheme(root).catch(console.error);
      if (name === 'set-glass-profile') daysApplyGlassProfile(root, action.dataset.themeGlassProfile).catch(console.error);
      if (name === 'close-editor') daysCloseEditor(root);
      if (name === 'delete-event') daysDeleteEvent(root).catch(console.error);
      if (name === 'save-event') daysHandleSave(root).catch(console.error);
      if (name === 'toggle-category') { var popover = root.querySelector('[data-category-popover]'); daysSetCategoryPopover(root, Boolean(popover && popover.hidden)); }
      if (name === 'select-category') { daysRenderCategoryPicker(root, action.dataset.categoryId); daysSetCategoryPopover(root, false); }
      if (name === 'add-category') daysAddCategory(root).catch(function (error) { console.error(error); daysNotify(daysT('categoryFailed'), 'error'); });
      if (name === 'set-date') daysSetQuickDate(root, action.dataset.offset);
      return;
    }
    if (!event.target.closest('[data-category-picker]')) daysSetCategoryPopover(root, false);
    var filter = event.target.closest('[data-filter]'); if (filter) { daysPageState.filter = filter.dataset.filter; root.querySelectorAll('[data-filter]').forEach(function (button) { var active = button === filter; button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', active ? 'true' : 'false'); }); daysRenderPage(root); return; }
    var card = event.target.closest('[data-event-id]');
    if (card) { try { daysOpenEditor(root, daysPageState.events.find(function (item) { return item.id === card.dataset.eventId; })); } catch (error) { console.error(error); daysNotify(daysT('editorFailed'), 'error'); } }
  }, listenerOptions);
  root.addEventListener('keydown', function (event) {
    if (daysTrapDialogFocus(root, event)) return;
    var card = event.target.closest('[data-event-id]'); if (card && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); card.click(); return; }
    if (event.key === 'Enter' && event.target.matches('[data-category-input]')) { event.preventDefault(); daysAddCategory(root).catch(console.error); return; }
    if (event.key === 'Enter' && event.target.closest('[data-event-form]') && !event.target.matches('textarea, button')) { event.preventDefault(); daysHandleSave(root).catch(console.error); return; }
    if (event.key === 'Escape') { var popover = root.querySelector('[data-category-popover]'); var themePanel = root.querySelector('[data-theme-panel]'); if (popover && !popover.hidden) daysSetCategoryPopover(root, false); else if (themePanel && !themePanel.hidden) daysCloseThemeStudio(root); else daysCloseEditor(root); }
  }, listenerOptions);
  root.querySelector('[data-search]').addEventListener('input', function (event) { daysPageState.query = event.target.value; daysRenderPage(root); }, listenerOptions);
  root.querySelector('[data-event-form]').addEventListener('submit', function (event) { event.preventDefault(); event.stopPropagation(); daysHandleSave(root).catch(console.error); }, { capture: true, signal: daysPageState.controller.signal });
  root.querySelector('[data-theme-panel]').addEventListener('input', function (event) { if (event.target.matches('[name="glassStrength"]')) { daysUpdateThemeFromStudio(root, event.target, false).then(daysScheduleThemeSave).catch(console.error); } }, listenerOptions);
  root.querySelector('[data-theme-panel]').addEventListener('change', function (event) { if (event.target.matches('select, input')) daysFlushThemeSave(root, event.target).catch(console.error); }, listenerOptions);
  if (Tapp.storage && typeof Tapp.storage.onChanged === 'function') {
    daysPageState.off = Tapp.storage.onChanged(function (event) {
      if (!event || !event.key || event.key === DAYS_STORAGE_KEY || event.key === DAYS_CATEGORIES_STORAGE_KEY) { var storeToken = ++daysPageState.storeRefreshToken; daysLoadStore().then(function (nextStore) { if (storeToken !== daysPageState.storeRefreshToken) return; daysPageState.events = nextStore.events; daysPageState.categories = nextStore.categories; daysRenderPage(root); }); }
      if (!event || !event.key || event.key === DAYS_THEME_STORAGE_KEY) { var themeToken = ++daysPageState.themeRefreshToken; daysLoadTheme().then(function (theme) { if (themeToken !== daysPageState.themeRefreshToken) return; daysPageState.theme = theme; daysRenderPage(root); if (!root.querySelector('[data-theme-panel]').hidden) daysRenderThemeStudio(root); }); }
    });
  }
  root.dataset.ready = 'true'; daysSyncOverlayScrollLock(root);
}
function daysDestroyPage() {
  ++daysPageState.mountToken; ++daysPageState.storeRefreshToken; ++daysPageState.themeRefreshToken;
  if (daysPageState.controller) daysPageState.controller.abort(); if (daysPageState.off) daysPageState.off(); if (daysPageState.primaryColorOff) daysPageState.primaryColorOff(); if (daysThemeOff) daysThemeOff(); if (daysLocaleOff) daysLocaleOff(); if (daysPageState.glassVisibilityObserver) daysPageState.glassVisibilityObserver.disconnect();
  daysPageState.timers.forEach(clearTimeout); daysPageState.timers = []; daysPageState.controller = null; daysPageState.off = null; daysPageState.primaryColor = null; daysPageState.primaryColorOff = null; daysPageState.themeSaveTimer = null; daysPageState.glassVisibilityObserver = null;
  document.documentElement.classList.remove('days-overlay-open'); document.documentElement.style.removeProperty('--days-scrollbar-gap'); if (document.body) document.body.classList.remove('days-overlay-open'); daysThemeOff = null; daysLocaleOff = null;
}
// ========== v0.4 Planning, backup, reminders and AI ==========
var DAYS_BACKUP_FORMAT = 'cn.echootaku.days.backup';
var DAYS_BACKUP_VERSION = 1;
var DAYS_REMINDER_OFFSETS = [0, 1, 7, 30];
var daysNormalizeEventsBase = daysNormalizeEvents;
daysNormalizeEvents = function (value) {
  var sources = Array.isArray(value) ? value.filter(function (item) { return item && typeof item.title === 'string' && daysParseDate(item.date); }) : [];
  return daysNormalizeEventsBase(value).map(function (event, index) {
    var source = sources[index]; var reminder = source && source.reminders && typeof source.reminders === 'object' ? source.reminders : {};
    var offsets = Array.isArray(reminder.offsets) ? reminder.offsets.map(Number).filter(function (item, position, list) { return DAYS_REMINDER_OFFSETS.indexOf(item) >= 0 && list.indexOf(item) === position; }).sort(function (a, b) { return b - a; }) : [];
    event.reminders = { enabled: Boolean(reminder.enabled) && offsets.length > 0, offsets: offsets, time: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(reminder.time || '')) ? String(reminder.time) : '09:00' };
    return event;
  });
};
function daysOccurrenceInYear(event, year) {
  var source = daysParseDate(event && event.date); if (!source) return null;
  var day = Math.min(source.getDate(), new Date(year, source.getMonth() + 1, 0).getDate()); return new Date(year, source.getMonth(), day);
}
function daysPermissionGranted(permission) { try { return Boolean(Tapp.permissions && typeof Tapp.permissions.includes === 'function' && Tapp.permissions.includes(permission)); } catch (_) { return false; } }
function daysReminderTaskId(eventId, offset) { return 'days-reminder-' + String(eventId || '').replace(/[^a-z0-9._-]/gi, '-').slice(0, 70) + '-' + offset; }
function daysReminderDate(event, offset) {
  var target = event.annual ? daysOccurrenceInYear(event, new Date().getFullYear()) : daysParseDate(event.date); if (!target) return null;
  var parts = String(event.reminders && event.reminders.time || '09:00').split(':'); target.setHours(Number(parts[0]), Number(parts[1]), 0, 0); target.setDate(target.getDate() - Number(offset));
  if (event.annual && target.getTime() <= Date.now()) { target = daysOccurrenceInYear(event, new Date().getFullYear() + 1); target.setHours(Number(parts[0]), Number(parts[1]), 0, 0); target.setDate(target.getDate() - Number(offset)); }
  return target;
}
function daysReminderTask(event, offset) {
  var at = daysReminderDate(event, offset); if (!at || at.getTime() <= Date.now()) return null;
  return { taskId: daysReminderTaskId(event.id, offset), name: daysT('reminderTaskName', { title: event.title }), scheduleType: 'once', schedule: { at: at.getTime() }, executionTarget: 'backend', backendActions: [{ type: 'notification.queue', title: event.title, message: offset === 0 ? daysT('reminderToday') : daysT('reminderBefore', { count: offset }) }], missedPolicy: 'skip' };
}
function daysReminderTaskMatches(current, desired) {
  if (!current || !desired) return false;
  var scheduleType = current.scheduleType || current.schedule_type; var executionTarget = current.executionTarget || current.execution_target; var missedPolicy = current.missedPolicy || current.missed_policy; var backendActions = current.backendActions || current.backend_actions;
  return String(scheduleType || '') === desired.scheduleType && Number(current.schedule && current.schedule.at) === desired.schedule.at && String(current.name || '') === desired.name && String(executionTarget || '') === desired.executionTarget && String(missedPolicy || '') === desired.missedPolicy && JSON.stringify(backendActions || []) === JSON.stringify(desired.backendActions);
}
async function daysUnregisterReminderTasks(event) {
  if (!event || !Tapp.scheduler || typeof Tapp.scheduler.unregister !== 'function' || !daysPermissionGranted('scheduler:register')) return;
  await Promise.all(DAYS_REMINDER_OFFSETS.map(function (offset) { return Tapp.scheduler.unregister(daysReminderTaskId(event.id, offset)).catch(function () {}); }));
}
async function daysSyncReminderTasks(event, previous) {
  if (!daysPermissionGranted('scheduler:register') || !Tapp.scheduler || typeof Tapp.scheduler.register !== 'function') return { ok: false, reason: 'unavailable' };
  await daysUnregisterReminderTasks(previous || event); if (!event.reminders || !event.reminders.enabled) return { ok: true };
  var tasks = event.reminders.offsets.map(function (offset) { return daysReminderTask(event, offset); }).filter(Boolean);
  try { await Promise.all(tasks.map(function (task) { return Tapp.scheduler.register(task); })); return { ok: true }; } catch (error) { console.error('[Days] reminder sync failed', error); return { ok: false, reason: 'failed' }; }
}
async function daysReconcileReminders(events) {
  if (!daysPermissionGranted('scheduler:register') || !Tapp.scheduler || typeof Tapp.scheduler.list !== 'function' || typeof Tapp.scheduler.register !== 'function' || typeof Tapp.scheduler.unregister !== 'function') return;
  var list = await Tapp.scheduler.list();
  var items = Array.isArray(list) ? list : Array.isArray(list && list.tasks) ? list.tasks : [];
  var desired = {};
  daysNormalizeEvents(events).forEach(function (event) { if (!event.reminders.enabled) return; event.reminders.offsets.forEach(function (offset) { var task = daysReminderTask(event, offset); if (task) desired[task.taskId] = task; }); });
  var removals = [];
  items.filter(function (task) { return String(task && (task.taskId || task.task_id || task.id) || '').indexOf('days-reminder-') === 0; }).forEach(function (task) {
    var id = String(task.taskId || task.task_id || task.id); var expected = desired[id];
    if (expected && daysReminderTaskMatches(task, expected)) { delete desired[id]; return; }
    removals.push(Tapp.scheduler.unregister(id).catch(function () {}));
  });
  await Promise.all(removals);
  await Promise.all(Object.keys(desired).map(function (id) { return Tapp.scheduler.register(desired[id]); }));
}
var daysReminderReconcilePromise = null;
var daysReminderReconciledAt = 0;
function daysRequestReminderReconcile(events, force) {
  if (!daysPermissionGranted('scheduler:register') || !Tapp.scheduler) return Promise.resolve();
  if (daysReminderReconcilePromise) return daysReminderReconcilePromise;
  if (!force && Date.now() - daysReminderReconciledAt < 21600000) return Promise.resolve();
  daysReminderReconcilePromise = daysReconcileReminders(events).then(function () { daysReminderReconciledAt = Date.now(); }).finally(function () { daysReminderReconcilePromise = null; });
  return daysReminderReconcilePromise;
}
function daysBackupSnapshot() { return { format: DAYS_BACKUP_FORMAT, schemaVersion: DAYS_BACKUP_VERSION, exportedAt: new Date().toISOString(), data: { events: daysNormalizeEvents(daysPageState.events), categories: daysNormalizeCategories(daysPageState.categories), theme: daysNormalizeTheme(daysPageState.theme) } }; }
function daysParseBackup(text) {
  var raw = String(text || ''); if (!raw || raw.length > 1048576) throw new Error('backup size'); var value = JSON.parse(raw);
  if (!value || value.format !== DAYS_BACKUP_FORMAT || value.schemaVersion !== DAYS_BACKUP_VERSION || !value.data || !Array.isArray(value.data.events)) throw new Error('backup format');
  var store = daysNormalizeStore(value.data.events, value.data.categories); var ids = store.events.map(function (event) { return event.id; });
  if (store.events.length !== value.data.events.length || ids.some(function (id, index) { return ids.indexOf(id) !== index; })) throw new Error('backup events');
  return { events: store.events, categories: store.categories, theme: daysNormalizeTheme(value.data.theme) };
}
function daysMergeBackup(current, incoming) {
  var byId = {}; current.events.forEach(function (event) { byId[event.id] = event; }); incoming.events.forEach(function (event) { byId[event.id] = event; });
  var categories = daysNormalizeCategories(current.categories.concat(incoming.categories)); return { events: Object.keys(byId).map(function (id) { return byId[id]; }), categories: categories, theme: current.theme };
}
async function daysPersistSnapshot(snapshot) {
  var old = { events: daysPageState.events, categories: daysPageState.categories, theme: daysPageState.theme };
  try { await daysSaveEvents(snapshot.events); await daysSaveCategories(snapshot.categories); await daysSaveTheme(snapshot.theme); }
  catch (error) { try { await daysSaveEvents(old.events); await daysSaveCategories(old.categories); await daysSaveTheme(old.theme); } catch (_) {} throw error; }
  daysPageState.events = daysNormalizeEvents(snapshot.events); daysPageState.categories = daysNormalizeCategories(snapshot.categories); daysPageState.theme = daysNormalizeTheme(snapshot.theme);
}
function daysRenderViews(root, events) {
  var list = root.querySelector('[data-event-list]'); var calendar = root.querySelector('[data-calendar]'); var timeline = root.querySelector('[data-timeline]'); var empty = root.querySelector('[data-empty]');
  if (list) list.hidden = daysPageState.view !== 'cards'; if (calendar) calendar.hidden = daysPageState.view !== 'calendar'; if (timeline) timeline.hidden = daysPageState.view !== 'timeline';
  if (empty) empty.hidden = events.length > 0; root.querySelectorAll('[data-view]').forEach(function (button) { var active = button.dataset.view === daysPageState.view; button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', active ? 'true' : 'false'); });
  if (daysPageState.view === 'calendar') daysRenderCalendar(root, events); if (daysPageState.view === 'timeline') daysRenderTimeline(root, events);
}
function daysRenderCalendar(root, events) {
  var grid = root.querySelector('[data-calendar-grid]'); if (!grid) return; grid.textContent = ''; var month = daysPageState.calendarMonth || new Date(); var year = month.getFullYear(); var monthIndex = month.getMonth();
  daysSetText(root, '[data-calendar-title]', new Intl.DateTimeFormat(daysCurrentLocale, { year: 'numeric', month: 'long' }).format(month));
  var startOfWeek = daysCurrentLocale === 'en-US' ? 0 : 1; var labels = [];
  for (var weekday = 0; weekday < 7; weekday += 1) { var labelDate = new Date(2024, 0, 7 + ((startOfWeek + weekday) % 7)); labels.push(new Intl.DateTimeFormat(daysCurrentLocale, { weekday: 'short' }).format(labelDate)); }
  labels.forEach(function (label) { grid.appendChild(daysElement('div', 'calendar-weekday', label)); });
  var first = new Date(year, monthIndex, 1); var offset = (first.getDay() - startOfWeek + 7) % 7; var cursor = new Date(year, monthIndex, 1 - offset); var today = daysTodayKey();
  for (var cell = 0; cell < 42; cell += 1) {
    var date = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + cell); var key = date.getFullYear() + '-' + daysPad(date.getMonth() + 1) + '-' + daysPad(date.getDate()); var day = daysElement('div', 'calendar-day');
    day.classList.toggle('is-outside', date.getMonth() !== monthIndex); day.classList.toggle('is-today', key === today); day.appendChild(daysElement('span', 'calendar-day-number', String(date.getDate())));
    events.filter(function (event) { var target = event.annual ? daysOccurrenceInYear(event, date.getFullYear()) : daysParseDate(event.date); return target && target.getFullYear() === date.getFullYear() && target.getMonth() === date.getMonth() && target.getDate() === date.getDate(); }).slice(0, 3).forEach(function (event) {
      var button = daysElement('button', 'calendar-event', event.title); button.type = 'button'; button.dataset.eventId = event.id; button.style.setProperty('--event-color', event.color); button.setAttribute('aria-label', daysT('editAria', { title: event.title })); day.appendChild(button);
    }); grid.appendChild(day);
  }
}
function daysRenderTimeline(root, events) {
  var container = root.querySelector('[data-timeline]'); if (!container) return; container.textContent = ''; var groups = {};
  events.map(function (event) { return { event:event, target:event.annual ? daysOccurrence(event,new Date()) : daysParseDate(event.date) }; }).sort(function (a, b) { return a.target - b.target; }).forEach(function (item) { var date = item.target; var key = date.getFullYear() + '-' + daysPad(date.getMonth() + 1); (groups[key] || (groups[key] = [])).push(item); });
  Object.keys(groups).sort().forEach(function (key) { var section = daysElement('section', 'timeline-group'); section.appendChild(daysElement('h3', '', new Intl.DateTimeFormat(daysCurrentLocale, { year: 'numeric', month: 'long' }).format(daysParseDate(key + '-01')))); var items = daysElement('div', 'timeline-items');
    groups[key].forEach(function (item) { var event = item.event; var button = daysElement('button', 'timeline-item'); button.type = 'button'; button.dataset.eventId = event.id; button.style.setProperty('--event-color', event.color); button.appendChild(daysElement('strong', '', daysFormatDate(item.target, event.annual))); button.appendChild(daysElement('span', '', event.title)); button.appendChild(daysElement('small', '', daysCategoryLabel(event.category, event.categoryLabel))); items.appendChild(button); }); section.appendChild(items); container.appendChild(section); });
}
function daysToggleReminderOptions(root) { var enabled = root.querySelector('[name="reminderEnabled"]'); var options = root.querySelector('[data-reminder-options]'); if (options) options.hidden = !(enabled && enabled.checked); }
function daysFillAiDraft(root, draft) {
  var form = root.querySelector('[data-event-form]'); if (!form || !draft) return; var title = String(draft.title || '').trim().slice(0, 80); var date = String(draft.date || ''); if (title) form.elements.title.value = title; if (daysParseDate(date)) form.elements.date.value = date;
  form.elements.annual.checked = Boolean(draft.annual); form.elements.note.value = String(draft.note || '').slice(0, 240); var category = daysFindCategory(String(draft.category || 'other')); form.elements.category.value = category.id; daysRenderCategoryPicker(root, category.id);
  var offsets = Array.isArray(draft.reminderOffsets) ? draft.reminderOffsets.map(Number).filter(function (item) { return DAYS_REMINDER_OFFSETS.indexOf(item) >= 0; }) : []; form.elements.reminderEnabled.checked = offsets.length > 0;
  root.querySelectorAll('[name="reminderOffset"]').forEach(function (input) { input.checked = offsets.indexOf(Number(input.value)) >= 0; }); if (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(draft.reminderTime || ''))) form.elements.reminderTime.value = draft.reminderTime; daysToggleReminderOptions(root);
}
function daysExtractAiValue(value) {
  if (typeof value === 'string') { try { return JSON.parse(value); } catch (_) { return null; } } if (!value || typeof value !== 'object') return null;
  if (value.title || value.date) return value; return daysExtractAiValue(value.value) || daysExtractAiValue(value.result) || daysExtractAiValue(value.output) || daysExtractAiValue(value.data);
}
function daysNormalizeAiDraft(value) { var draft = daysExtractAiValue(value); if (!draft || !String(draft.title || '').trim() || !daysParseDate(String(draft.date || ''))) return null; return draft; }
async function daysAiParse(root) {
  var prompt = root.querySelector('[data-ai-prompt]'); var status = root.querySelector('[data-ai-status]'); var button = root.querySelector('[data-action="ai-parse"]'); if (!prompt || !prompt.value.trim()) { if (prompt) prompt.focus(); return; }
  if (!daysPermissionGranted('ai:generate') || !Tapp.ai || !Tapp.ai.tasks) { if (status) status.textContent = daysT('aiUnavailable'); return; }
  if (button) button.disabled = true; if (status) status.textContent = daysT('aiWorking');
  try {
    var task = await Tapp.ai.tasks.create({ version: 2, operation: 'generate', input: { prompt: daysT('aiSystemPrompt', { today: daysTodayKey(), locale: daysCurrentLocale, request: prompt.value.trim() }) }, context: [], output: { format: 'json', schema: { type: 'object', additionalProperties: false, required: ['title', 'date', 'annual', 'category', 'note', 'reminderOffsets', 'reminderTime'], properties: { title: { type: 'string', maxLength: 80 }, date: { type: 'string' }, annual: { type: 'boolean' }, category: { type: 'string', enum: ['life','birthday','anniversary','study','travel','other'] }, note: { type: 'string', maxLength: 240 }, reminderOffsets: { type: 'array', items: { type: 'number', enum: [0,1,7,30] } }, reminderTime: { type: 'string' } } } }, delivery: 'stream', idempotencyKey: 'days-ai-' + Date.now().toString(36) });
    var taskId = task && (task.taskId || task.id); daysPageState.aiTaskId = taskId; var immediate = daysNormalizeAiDraft(task); var result = immediate;
    if (!result && taskId && typeof Tapp.ai.tasks.subscribe === 'function') result = await new Promise(function (resolve, reject) { var settled = false; var timer = daysPageSetTimeout(function () { if (!settled) { settled = true; reject(new Error('AI timeout')); } }, 120000); Tapp.ai.tasks.subscribe(taskId, function (message) { if (settled) return; var parsed = daysExtractAiValue(message); var state = message && (message.event || message.type); if (parsed) { settled = true; daysPageClearTimeout(timer); resolve(parsed); } else if (['error','failed','cancelled'].indexOf(state) >= 0) { settled = true; daysPageClearTimeout(timer); reject(new Error(state)); } }).then(function (off) { if (settled && typeof off === 'function') off(); else daysPageState.aiUnsubscribe = off; }).catch(reject); });
    if (!result && taskId && typeof Tapp.ai.tasks.get === 'function') result = daysNormalizeAiDraft(await Tapp.ai.tasks.get(taskId)); result = daysNormalizeAiDraft(result); if (!result) throw new Error('AI result missing'); daysFillAiDraft(root, result); if (status) status.textContent = daysT('aiReady');
  } catch (error) { console.error('[Days] AI parse failed', error); if (status) status.textContent = daysT('aiFailed'); }
  finally { if (typeof daysPageState.aiUnsubscribe === 'function') { try { daysPageState.aiUnsubscribe(); } catch (_) {} } daysPageState.aiUnsubscribe = null; daysPageState.aiTaskId = null; if (button) button.disabled = false; }
}
daysPageState.view = 'cards'; daysPageState.calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1); daysPageState.importPreview = null; daysPageState.dataReturnFocus = null; daysPageState.aiTaskId = null; daysPageState.aiUnsubscribe = null;
daysSyncOverlayScrollLock = function (root) {
  var dialogs = root ? root.querySelectorAll('[data-editor], [data-theme-panel], [data-data-panel]') : []; var locked = Array.prototype.some.call(dialogs, function (dialog) { return !dialog.hidden; });
  if (locked) { var viewportWidth = Number.isFinite(window.innerWidth) ? window.innerWidth : document.documentElement.clientWidth; document.documentElement.style.setProperty('--days-scrollbar-gap', Math.max(0, viewportWidth - document.documentElement.clientWidth) + 'px'); } else document.documentElement.style.removeProperty('--days-scrollbar-gap');
  document.documentElement.classList.toggle('days-overlay-open', locked); if (document.body) document.body.classList.toggle('days-overlay-open', locked);
  Array.prototype.forEach.call(root ? root.children : [], function (child) { var isDialog = child.matches && child.matches('[data-editor], [data-theme-panel], [data-data-panel]'); if (locked && !isDialog) { child.inert = true; child.setAttribute('aria-hidden','true'); child.setAttribute('data-days-dialog-inert',''); } else if (!locked && child.hasAttribute && child.hasAttribute('data-days-dialog-inert')) { child.inert = false; child.removeAttribute('aria-hidden'); child.removeAttribute('data-days-dialog-inert'); } });
};
daysActiveDialog = function (root) { var selectors = ['[data-data-panel]','[data-theme-panel]','[data-editor]']; for (var i = 0; i < selectors.length; i += 1) { var dialog = root && root.querySelector(selectors[i]); if (dialog && !dialog.hidden) return dialog; } return null; };
function daysOpenDataPanel(root) { var panel = root.querySelector('[data-data-panel]'); if (!panel) return; daysPageState.dataReturnFocus = document.activeElement; panel.hidden = false; panel.setAttribute('aria-hidden','false'); daysSyncOverlayScrollLock(root); requestAnimationFrame(function () { panel.classList.add('is-open'); var first = panel.querySelector('button'); if (first) first.focus(); }); }
function daysCloseDataPanel(root) { var panel = root.querySelector('[data-data-panel]'); if (!panel || panel.hidden) return; var focus = daysPageState.dataReturnFocus; panel.classList.remove('is-open'); daysPageSetTimeout(function () { if (!panel.classList.contains('is-open')) { panel.hidden = true; panel.setAttribute('aria-hidden','true'); daysSyncOverlayScrollLock(root); if (focus && focus.isConnected) focus.focus(); } }, 300); }
async function daysExportData() { var json = JSON.stringify(daysBackupSnapshot(), null, 2); await Tapp.file.download(json, 'chaoxi-backup-' + daysTodayKey() + '.json', 'application/json'); await daysNotify(daysT('exported')); }
function daysSetImportPreview(root, snapshot) { daysPageState.importPreview = snapshot; var currentIds = daysPageState.events.map(function (event) { return event.id; }); var conflicts = snapshot.events.filter(function (event) { return currentIds.indexOf(event.id) >= 0; }).length; daysSetText(root, '[data-import-preview]', daysT('importSummary', { events: snapshot.events.length, categories: snapshot.categories.length, conflicts: conflicts })); root.querySelectorAll('[data-action="import-merge"], [data-action="import-replace"]').forEach(function (button) { button.disabled = false; }); }
function daysPreviewImport(root) { var textarea = root.querySelector('[data-import-json]'); try { daysSetImportPreview(root, daysParseBackup(textarea && textarea.value)); } catch (error) { daysPageState.importPreview = null; daysSetText(root, '[data-import-preview]', daysT('importInvalid')); root.querySelectorAll('[data-action="import-merge"], [data-action="import-replace"]').forEach(function (button) { button.disabled = true; }); } }
async function daysApplyImport(root, mode) {
  var incoming = daysPageState.importPreview; if (!incoming) return; if (mode === 'replace' && !(await Tapp.ui.confirm(daysT('replaceConfirm')))) return;
  var snapshot = mode === 'merge' ? daysMergeBackup({ events: daysPageState.events, categories: daysPageState.categories, theme: daysPageState.theme }, incoming) : incoming; await daysPersistSnapshot(snapshot); daysRenderPage(root); daysCloseDataPanel(root); daysReconcileReminders(daysPageState.events).catch(console.error); await daysNotify(daysT(mode === 'merge' ? 'importMerged' : 'importReplaced'));
}
var daysRenderPageBase = daysRenderPage;
daysRenderPage = function (root) { daysRenderPageBase(root); daysRenderViews(root, daysFilteredEvents()); };
var daysOpenEditorBase = daysOpenEditor;
daysOpenEditor = function (root, event) {
  daysOpenEditorBase(root, event); var reminder = event && event.reminders || { enabled:false, offsets:[], time:'09:00' }; var form = root.querySelector('[data-event-form]'); form.elements.reminderEnabled.checked = Boolean(reminder.enabled); form.elements.reminderTime.value = reminder.time || '09:00'; root.querySelectorAll('[name="reminderOffset"]').forEach(function (input) { input.checked = reminder.offsets.indexOf(Number(input.value)) >= 0; }); var prompt = root.querySelector('[data-ai-prompt]'); var status = root.querySelector('[data-ai-status]'); if (prompt) prompt.value = ''; if (status) status.textContent = daysPermissionGranted('ai:generate') ? '' : daysT('aiUnavailable'); daysToggleReminderOptions(root);
};
daysSubmitEvent = async function (root, form) {
  var id = String(form.elements.id.value || ''); var existing = daysPageState.events.find(function (event) { return event.id === id; }); if (typeof form.reportValidity === 'function' && !form.reportValidity()) return false; var selectedCategory = daysFindCategory(form.elements.category.value); var offsets = Array.prototype.map.call(form.querySelectorAll('[name="reminderOffset"]:checked'), function (input) { return Number(input.value); });
  var next = { id: id || ('day-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,7)), title: String(form.elements.title.value || '').trim(), date: String(form.elements.date.value || ''), category:selectedCategory.id, categoryLabel:selectedCategory.custom ? selectedCategory.label : '', note:String(form.elements.note.value || '').trim(), annual:form.elements.annual.checked, pinned:form.elements.pinned.checked, color:String(form.elements.color.value || '#D97757'), createdAt:existing ? existing.createdAt : Date.now(), reminders:{ enabled:form.elements.reminderEnabled.checked && offsets.length > 0, offsets:offsets, time:String(form.elements.reminderTime.value || '09:00') } };
  if (!next.title || !daysParseDate(next.date)) return false; var nextEvents = existing ? daysPageState.events.map(function (event) { return event.id === id ? next : event; }) : daysPageState.events.concat(next); await daysSaveEvents(nextEvents); daysPageState.events = daysNormalizeEvents(nextEvents); var sync = await daysSyncReminderTasks(next, existing); daysCloseEditor(root); daysRenderPage(root); await daysNotify(daysT(existing ? 'updated' : 'saved')); if (!sync.ok && next.reminders.enabled) await daysNotify(daysT(sync.reason === 'unavailable' ? 'reminderUnavailable' : 'reminderFailed'), 'warning'); return true;
};
daysDeleteEvent = async function (root) { var event = daysPageState.events.find(function (item) { return item.id === daysPageState.editingId; }); if (!event) return; if (!(await Tapp.ui.confirm(daysT('deleteConfirm',{title:event.title})))) return; var next = daysPageState.events.filter(function (item) { return item.id !== event.id; }); await daysSaveEvents(next); daysPageState.events = next; await daysUnregisterReminderTasks(event); daysCloseEditor(root); daysRenderPage(root); await daysNotify(daysT('deleted'),'info'); };
var daysMountPageBase = daysMountPage;
daysMountPage = async function (root) {
  await daysMountPageBase(root); if (root.dataset.v040Ready === 'true') return; root.dataset.v040Ready = 'true'; var signal = daysPageState.controller && daysPageState.controller.signal;
  root.addEventListener('click', function (event) { var action = event.target.closest('[data-action]'); var name = action && action.dataset.action;
    if (name === 'open-data') { daysCloseEditor(root); daysCloseThemeStudio(root); daysOpenDataPanel(root); }
    if (name === 'close-data') daysCloseDataPanel(root); if (name === 'export-data') daysExportData().catch(function (error) { console.error(error); daysNotify(daysT('exportFailed'),'error'); }); if (name === 'preview-import') daysPreviewImport(root); if (name === 'import-merge') daysApplyImport(root,'merge').catch(function (error) { console.error(error); daysNotify(daysT('importFailed'),'error'); }); if (name === 'import-replace') daysApplyImport(root,'replace').catch(function (error) { console.error(error); daysNotify(daysT('importFailed'),'error'); }); if (name === 'ai-parse') daysAiParse(root);
    if (name === 'calendar-prev' || name === 'calendar-next') { var delta = name === 'calendar-prev' ? -1 : 1; daysPageState.calendarMonth = new Date(daysPageState.calendarMonth.getFullYear(), daysPageState.calendarMonth.getMonth() + delta, 1); daysRenderPage(root); } if (name === 'calendar-today') { daysPageState.calendarMonth = new Date(new Date().getFullYear(),new Date().getMonth(),1); daysRenderPage(root); }
    var view = event.target.closest('[data-view]'); if (view) { daysPageState.view = view.dataset.view; daysRenderPage(root); }
  }, signal ? { signal:signal } : undefined);
  root.addEventListener('change', function (event) { if (event.target.matches('[name="reminderEnabled"]')) daysToggleReminderOptions(root); if (event.target.matches('[data-import-file]')) { var file = event.target.files && event.target.files[0]; if (!file || file.size > 1048576) { daysSetText(root,'[data-import-preview]',daysT('importInvalid')); return; } file.text().then(function (text) { var area = root.querySelector('[data-import-json]'); area.value = text; daysPreviewImport(root); }).catch(console.error); } }, signal ? {signal:signal} : undefined);
  root.addEventListener('keydown', function (event) { if (event.key === 'Escape') { var panel = root.querySelector('[data-data-panel]'); if (panel && !panel.hidden) daysCloseDataPanel(root); } }, signal ? {signal:signal} : undefined);
  daysRequestReminderReconcile(daysPageState.events, true).catch(function (error) { console.error('[Days] reminder reconcile failed', error); });
};
var daysDestroyPageBase = daysDestroyPage;
daysDestroyPage = function () { if (typeof daysPageState.aiUnsubscribe === 'function') { try { daysPageState.aiUnsubscribe(); } catch (_) {} } if (daysPageState.aiTaskId && Tapp.ai && Tapp.ai.tasks && typeof Tapp.ai.tasks.cancel === 'function') Tapp.ai.tasks.cancel(daysPageState.aiTaskId).catch(function () {}); daysPageState.aiUnsubscribe = null; daysPageState.aiTaskId = null; daysDestroyPageBase(); };

if (typeof Tapp !== 'undefined' && Tapp.lifecycle) {
  Tapp.lifecycle.onReady(function () { var root = document.querySelector('[data-days-page]'); if (root) daysMountPage(root).catch(console.error); });
  if (typeof Tapp.lifecycle.onResume === 'function') Tapp.lifecycle.onResume(function () { var root = document.querySelector('[data-days-page]'); if (root) { daysRequestGlassComposite(document.documentElement); daysRequestReminderReconcile(daysPageState.events, false).catch(function (error) { console.error('[Days] reminder reconcile failed', error); }); } });
  Tapp.lifecycle.onDestroy(daysDestroyPage);
}
