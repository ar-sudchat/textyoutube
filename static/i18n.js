/**
 * GetText AI — i18n layer
 *
 * Default language is English. To add a language:
 *   1. add a dictionary below (copy `en` and translate),
 *   2. add an <option> to #ui-language in index.html.
 * Missing keys automatically fall back to English.
 */
(function (global) {
    'use strict';

    const DEFAULT_LANG = 'en';
    const STORAGE_KEY = 'ui_lang';

    const DICT = {
        en: {
            'app.title': 'GetText AI — YouTube Transcript & AI Summarizer',
            'app.tagline': 'Smart YouTube transcript extraction & AI article summaries (Public & Private)',
            'app.quit': "Quit GetText AI",
            'app.quitConfirm': "Stop the GetText AI server?\n\nThis page will stop working until you launch the app again.",
            'app.quitDone': "GetText AI has stopped. You can close this tab.",

            'settings.open': 'API Key / Cookies settings',
            'settings.title': 'API & Authentication settings',
            'settings.apiKey.label': 'Gemini API Key (for AI summaries / videos without subtitles)',
            'settings.apiKey.help': 'Powered by Gemini 2.0 Flash — sharp summaries and direct audio transcription.',
            'settings.cookies.label': 'Session Cookies (`cookies.txt` for private videos)',
            'settings.cookies.placeholder': 'Paste your Netscape cookies.txt content here to access private videos...',
            'settings.cookies.upload': 'Upload cookies.txt',
            'settings.cookies.notSet': 'No cookie set',
            'settings.cookies.set': 'Cookie ready',
            'settings.save': 'Save settings',

            'url.placeholder': 'Paste a YouTube URL here (e.g. https://www.youtube.com/watch?v=...)',
            'url.clear': 'Clear link',
            'url.paste': 'Paste link',
            'url.pasteShort': 'Paste',
            'options.access': 'YouTube access',
            'auth.open': 'Open settings to add cookies',
            'auth.checking': 'Checking…',
            'auth.server': 'Signed in · server cookies',
            'auth.user': 'Signed in · your cookies',
            'auth.local': "Local app · no sign-in needed",
            'auth.none': 'Not signed in — add cookies',
            'options.summaryType': 'Summary format',
            'options.outputLanguage': 'Output language',

            'summaryType.article': '📰 Full Article',
            'summaryType.executive': '⚡ Executive Summary',
            'summaryType.takeaways': '🎯 Key Takeaways',
            'summaryType.timestamps': '⏱️ Timestamp Outline',
            'summaryType.fullReport': '📊 Comprehensive Full Report',

            'customPrompt.toggle': 'Add special instructions for the AI (optional)',
            'customPrompt.placeholder': "Tell the AI what to focus on, e.g. 'highlight the coding techniques', 'analyse pros and cons'...",

            'action.extractOnly': 'Get transcript only',
            'action.extractSummarize': 'Transcript + AI summary',

            'status.extracting.title': 'Fetching transcript…',
            'status.extracting.detail': 'Looking for and extracting the text from this video',
            'status.summarizing.title': 'AI is writing the summary…',
            'status.summarizing.detail': 'Gemini 2.0 Flash is analysing and organising the content',

            'error.title': 'Something went wrong',
            'error.generic': 'The request could not be completed.',
            'error.noUrl': 'Please enter a YouTube URL first.',

            'tab.summary': 'AI Summary',
            'tab.transcript': 'Transcript',
            'output.copy': 'Copy',
            'output.download': 'Download',

            'transcript.search': 'Search inside the transcript...',
            'transcript.viewClean': 'Plain text',
            'transcript.viewTimestamped': 'With timestamps',
            'transcript.notFound': 'No matching text found.',

            'footer': '© 2026 GetText AI • YouTube transcript extraction & article summaries powered by Gemini 2.0 Flash',

            'toast.saved': 'Settings saved.',
            'toast.copied': 'Copied to clipboard.',

            'err.invalid_url': 'That URL is not valid, or no video ID could be found.',
            'err.no_transcript': 'This video’s text could not be retrieved. Check that you have permission to watch it and that it is not restricted.',
            'err.youtube_blocked': 'YouTube refused this request from the server — its IP is likely rate-limited or flagged as automated traffic. Adding session cookies in settings usually fixes it.',
            'err.stt_api_key_required': 'This video has no subtitles, so a Gemini API Key is required to transcribe its audio (speech-to-text).',
            'err.stt_failed': 'Audio transcription failed.',
            'err.missing_api_key': 'No Gemini API Key found. Add one in settings or set the GEMINI_API_KEY environment variable.',
            'err.empty_transcript': 'There is no transcript text to summarise.',
            'err.summarize_failed': 'AI summarisation failed.'
        },

        th: {
            'app.title': 'GetText AI — ดึง Transcript & สรุปบทความจาก YouTube',
            'app.tagline': 'ระบบดึง Transcript & สรุปบทความอัจฉริยะจาก YouTube (Public & Private)',
            'app.quit': "ปิด GetText AI",
            'app.quitConfirm': "ต้องการหยุดเซิร์ฟเวอร์ GetText AI ไหม?\n\nหน้านี้จะใช้งานไม่ได้จนกว่าจะเปิดแอปใหม่",
            'app.quitDone': "GetText AI หยุดทำงานแล้ว ปิดแท็บนี้ได้เลย",

            'settings.open': 'ตั้งค่า API Key / Cookies',
            'settings.title': 'ตั้งค่าการเชื่อมต่อ API & Authentication',
            'settings.apiKey.label': 'Gemini API Key (สำหรับสรุปบทความ / คลิปไม่มี Subtitle)',
            'settings.apiKey.help': 'ระบบรองรับ Gemini 2.0 Flash ช่วยสรุปภาษาไทยได้คมชัดและถอดเสียงได้โดยตรง',
            'settings.cookies.label': 'Session Cookies (`cookies.txt` สำหรับ Private Videos)',
            'settings.cookies.placeholder': 'คัดลอกข้อความ Netscape cookies.txt มาวางที่นี่ สำหรับดึงคลิปส่วนตัว...',
            'settings.cookies.upload': 'อัปโหลดไฟล์ cookies.txt',
            'settings.cookies.notSet': 'ยังไม่ได้ตั้งค่า Cookie',
            'settings.cookies.set': 'ตั้งค่า Cookie แล้ว',
            'settings.save': 'บันทึกการตั้งค่า',

            'url.placeholder': 'วางลิงก์ YouTube ที่นี่ (เช่น https://www.youtube.com/watch?v=...)',
            'url.clear': 'ล้างลิงก์',
            'url.paste': 'วางลิงก์',
            'url.pasteShort': 'วาง',
            'options.access': 'การเข้าถึง YouTube',
            'auth.open': 'เปิดตั้งค่าเพื่อใส่ Cookies',
            'auth.checking': 'กำลังตรวจสอบ…',
            'auth.server': 'ล็อกอินแล้ว · Cookies ของเซิร์ฟเวอร์',
            'auth.user': 'ล็อกอินแล้ว · Cookies ของคุณ',
            'auth.local': "แอปบนเครื่อง · ไม่ต้องล็อกอิน",
            'auth.none': 'ยังไม่ได้ล็อกอิน — กรุณาใส่ Cookies',
            'options.summaryType': 'รูปแบบบทความสรุป',
            'options.outputLanguage': 'ภาษาผลลัพธ์',

            'summaryType.article': '📰 บทความฉบับสมบูรณ์',
            'summaryType.executive': '⚡ สรุปผู้บริหาร',
            'summaryType.takeaways': '🎯 ประเด็นสำคัญ',
            'summaryType.timestamps': '⏱️ สารบัญตามเวลา',
            'summaryType.fullReport': '📊 รายงานฉบับเต็มทุกมิติ',

            'customPrompt.toggle': 'เพิ่มคำสั่งพิเศษสำหรับ AI (ไม่บังคับ)',
            'customPrompt.placeholder': "ระบุสิ่งที่ต้องการเน้น เช่น 'เน้นสรุปเทคนิคการเขียนโค้ด', 'วิเคราะห์ข้อดีข้อเสีย'...",

            'action.extractOnly': 'ดึง Transcript อย่างเดียว',
            'action.extractSummarize': 'ดึงข้อความ + สรุปบทความ AI',

            'status.extracting.title': 'กำลังดึงข้อความ (Transcript)...',
            'status.extracting.detail': 'ระบบกำลังค้นหาและถอดข้อความจากวิดีโอ',
            'status.summarizing.title': 'กำลังให้ AI สรุปบทความ...',
            'status.summarizing.detail': 'Gemini 2.0 Flash กำลังวิเคราะห์และเรียบเรียงเนื้อหา',

            'error.title': 'เกิดข้อผิดพลาด',
            'error.generic': 'ไม่สามารถดำเนินการได้',
            'error.noUrl': 'กรุณากรอก YouTube URL ก่อนเริ่มทำงาน',

            'tab.summary': 'บทความสรุป AI',
            'tab.transcript': 'ข้อความถอดจากคลิป',
            'output.copy': 'คัดลอก',
            'output.download': 'ดาวน์โหลด',

            'transcript.search': 'ค้นหาข้อความในคลิป...',
            'transcript.viewClean': 'ข้อความล้วน',
            'transcript.viewTimestamped': 'พร้อมเวลา [MM:SS]',
            'transcript.notFound': 'ไม่พบข้อความที่ค้นหา',

            'footer': '© 2026 GetText AI • ระบบถอดข้อความและสรุปบทความจาก YouTube ด้วย Gemini 2.0 Flash',

            'toast.saved': 'บันทึกการตั้งค่าเรียบร้อยแล้ว',
            'toast.copied': 'คัดลอกข้อความลง Clipboard แล้ว',

            'err.invalid_url': 'URL รูปแบบไม่ถูกต้อง หรือไม่พบ Video ID',
            'err.no_transcript': 'ไม่สามารถดึงข้อความจากวิดีโอนี้ได้ (กรุณาตรวจสอบว่ามีสิทธิ์รับชม หรือวิดีโอถูกจำกัดสิทธิ์หรือไม่)',
            'err.youtube_blocked': 'YouTube ปฏิเสธคำขอจากเซิร์ฟเวอร์นี้ — น่าจะโดนจำกัดอัตราหรือถูกมองว่าเป็นบอท ลองใส่ Session Cookies ในหน้าตั้งค่ามักแก้ได้',
            'err.stt_api_key_required': 'วิดีโอนี้ไม่มีซับไตเติ้ลในตัว และจำเป็นต้องใช้ Gemini API Key เพื่อแปลงไฟล์เสียงเป็นข้อความ (Speech-to-Text)',
            'err.stt_failed': 'การถอดข้อความจากเสียงล้มเหลว',
            'err.missing_api_key': 'ไม่พบ Gemini API Key กรุณาระบุ API Key ในหน้าตั้งค่า หรือตั้งตัวแปร GEMINI_API_KEY',
            'err.empty_transcript': 'ไม่มีข้อความ Transcript สำหรับสรุป',
            'err.summarize_failed': 'การสรุปด้วย AI ล้มเหลว'
        },

        zh: {
            'app.title': 'GetText AI — YouTube 字幕提取与 AI 摘要',
            'app.tagline': '智能提取 YouTube 字幕并生成 AI 文章摘要（公开与私享视频）',
            'app.quit': "退出 GetText AI",
            'app.quitConfirm': "要停止 GetText AI 服务器吗？\n\n在重新启动应用之前，此页面将无法使用。",
            'app.quitDone': "GetText AI 已停止，可以关闭此标签页。",

            'settings.open': 'API Key / Cookies 设置',
            'settings.title': 'API 与身份验证设置',
            'settings.apiKey.label': 'Gemini API Key（用于 AI 摘要／无字幕视频）',
            'settings.apiKey.help': '由 Gemini 2.0 Flash 驱动 — 摘要精准，并可直接转写音频。',
            'settings.cookies.label': 'Session Cookies（私享视频需要 `cookies.txt`）',
            'settings.cookies.placeholder': '将 Netscape 格式的 cookies.txt 内容粘贴到此处，以访问私享视频…',
            'settings.cookies.upload': '上传 cookies.txt',
            'settings.cookies.notSet': '尚未设置 Cookie',
            'settings.cookies.set': 'Cookie 已就绪',
            'settings.save': '保存设置',

            'url.placeholder': '在此粘贴 YouTube 链接（例如 https://www.youtube.com/watch?v=…）',
            'url.clear': '清除链接',
            'url.paste': '粘贴链接',
            'url.pasteShort': '粘贴',
            'options.access': 'YouTube 访问权限',
            'auth.open': '打开设置以添加 Cookies',
            'auth.checking': '检查中…',
            'auth.server': '已登录 · 服务器 Cookies',
            'auth.user': '已登录 · 你的 Cookies',
            'auth.local': "本地应用 · 无需登录",
            'auth.none': '未登录 — 请添加 Cookies',
            'options.summaryType': '摘要格式',
            'options.outputLanguage': '输出语言',

            'summaryType.article': '📰 完整文章',
            'summaryType.executive': '⚡ 高管摘要',
            'summaryType.takeaways': '🎯 重点提炼',
            'summaryType.timestamps': '⏱️ 时间轴大纲',
            'summaryType.fullReport': '📊 全面完整报告',

            'customPrompt.toggle': '为 AI 添加特殊指令（可选）',
            'customPrompt.placeholder': '告诉 AI 需要着重什么，例如「重点总结编程技巧」「分析优缺点」…',

            'action.extractOnly': '仅提取字幕',
            'action.extractSummarize': '字幕 + AI 摘要',

            'status.extracting.title': '正在提取字幕…',
            'status.extracting.detail': '正在查找并提取该视频中的文字',
            'status.summarizing.title': 'AI 正在撰写摘要…',
            'status.summarizing.detail': 'Gemini 2.0 Flash 正在分析并整理内容',

            'error.title': '出现错误',
            'error.generic': '无法完成该请求。',
            'error.noUrl': '请先输入 YouTube 链接。',

            'tab.summary': 'AI 摘要',
            'tab.transcript': '字幕原文',
            'output.copy': '复制',
            'output.download': '下载',

            'transcript.search': '在字幕中搜索…',
            'transcript.viewClean': '纯文本',
            'transcript.viewTimestamped': '带时间戳',
            'transcript.notFound': '未找到匹配的文字。',

            'footer': '© 2026 GetText AI • 由 Gemini 2.0 Flash 驱动的 YouTube 字幕提取与文章摘要',

            'toast.saved': '设置已保存。',
            'toast.copied': '已复制到剪贴板。',

            'err.invalid_url': '该链接无效，或找不到视频 ID。',
            'err.no_transcript': '无法获取该视频的文字内容。请确认你有观看权限，且视频未被限制。',
            'err.youtube_blocked': 'YouTube 拒绝了来自服务器的此次请求 — 其 IP 可能被限流或被判定为自动化流量。在设置中添加 Session Cookies 通常可以解决。',
            'err.stt_api_key_required': '该视频没有字幕，需要 Gemini API Key 才能将音频转写为文字（语音转文字）。',
            'err.stt_failed': '音频转写失败。',
            'err.missing_api_key': '未找到 Gemini API Key。请在设置中填写，或设置 GEMINI_API_KEY 环境变量。',
            'err.empty_transcript': '没有可供摘要的字幕文本。',
            'err.summarize_failed': 'AI 摘要生成失败。'
        },

        ja: {
            'app.title': 'GetText AI — YouTube 文字起こし & AI 要約',
            'app.tagline': 'YouTube の文字起こし抽出と AI 記事要約（公開・限定公開・非公開に対応）',
            'app.quit': "GetText AI を終了",
            'app.quitConfirm': "GetText AI のサーバーを停止しますか？\n\nアプリを再度起動するまで、このページは使えなくなります。",
            'app.quitDone': "GetText AI を停止しました。このタブを閉じてかまいません。",

            'settings.open': 'API キー / Cookie の設定',
            'settings.title': 'API と認証の設定',
            'settings.apiKey.label': 'Gemini API キー（AI 要約・字幕なし動画用）',
            'settings.apiKey.help': 'Gemini 2.0 Flash 対応 — 的確な要約と音声の直接文字起こしが可能です。',
            'settings.cookies.label': 'セッション Cookie（非公開動画には `cookies.txt` が必要）',
            'settings.cookies.placeholder': 'Netscape 形式の cookies.txt の内容をここに貼り付けてください…',
            'settings.cookies.upload': 'cookies.txt をアップロード',
            'settings.cookies.notSet': 'Cookie は未設定',
            'settings.cookies.set': 'Cookie 設定済み',
            'settings.save': '設定を保存',

            'url.placeholder': 'YouTube の URL をここに貼り付け（例：https://www.youtube.com/watch?v=…）',
            'url.clear': 'リンクをクリア',
            'url.paste': 'リンクを貼り付け',
            'url.pasteShort': '貼り付け',
            'options.access': 'YouTube へのアクセス',
            'auth.open': '設定を開いて Cookie を追加',
            'auth.checking': '確認中…',
            'auth.server': 'ログイン済み · サーバーの Cookie',
            'auth.user': 'ログイン済み · あなたの Cookie',
            'auth.local': "ローカルアプリ · ログイン不要",
            'auth.none': '未ログイン — Cookie を追加してください',
            'options.summaryType': '要約の形式',
            'options.outputLanguage': '出力言語',

            'summaryType.article': '📰 完全な記事',
            'summaryType.executive': '⚡ エグゼクティブサマリー',
            'summaryType.takeaways': '🎯 重要ポイント',
            'summaryType.timestamps': '⏱️ タイムスタンプ目次',
            'summaryType.fullReport': '📊 総合レポート',

            'customPrompt.toggle': 'AI への追加指示（任意）',
            'customPrompt.placeholder': '重視してほしい点を指定（例：「コーディング技術を中心に」「メリットとデメリットを分析」）…',

            'action.extractOnly': '文字起こしのみ取得',
            'action.extractSummarize': '文字起こし + AI 要約',

            'status.extracting.title': '文字起こしを取得中…',
            'status.extracting.detail': '動画からテキストを検索・抽出しています',
            'status.summarizing.title': 'AI が要約を作成中…',
            'status.summarizing.detail': 'Gemini 2.0 Flash が内容を分析・整理しています',

            'error.title': 'エラーが発生しました',
            'error.generic': 'リクエストを完了できませんでした。',
            'error.noUrl': 'まず YouTube の URL を入力してください。',

            'tab.summary': 'AI 要約',
            'tab.transcript': '文字起こし',
            'output.copy': 'コピー',
            'output.download': 'ダウンロード',

            'transcript.search': '文字起こし内を検索…',
            'transcript.viewClean': 'プレーンテキスト',
            'transcript.viewTimestamped': 'タイムスタンプ付き',
            'transcript.notFound': '該当するテキストが見つかりません。',

            'footer': '© 2026 GetText AI • Gemini 2.0 Flash による YouTube 文字起こしと記事要約',

            'toast.saved': '設定を保存しました。',
            'toast.copied': 'クリップボードにコピーしました。',

            'err.invalid_url': 'URL が正しくないか、動画 ID が見つかりません。',
            'err.no_transcript': 'この動画のテキストを取得できませんでした。視聴権限があるか、制限がかかっていないかご確認ください。',
            'err.youtube_blocked': 'YouTube がサーバーからのこのリクエストを拒否しました — IP がレート制限されているか、自動化トラフィックと判定された可能性があります。設定でセッション Cookie を追加すると解決することが多いです。',
            'err.stt_api_key_required': 'この動画には字幕がないため、音声を文字起こしするには Gemini API キーが必要です。',
            'err.stt_failed': '音声の文字起こしに失敗しました。',
            'err.missing_api_key': 'Gemini API キーが見つかりません。設定画面で入力するか、環境変数 GEMINI_API_KEY を設定してください。',
            'err.empty_transcript': '要約する文字起こしテキストがありません。',
            'err.summarize_failed': 'AI による要約に失敗しました。'
        }
    };

    let current = DEFAULT_LANG;

    function available() {
        return Object.keys(DICT);
    }

    function get() {
        return current;
    }

    function set(lang) {
        current = DICT[lang] ? lang : DEFAULT_LANG;
        try {
            localStorage.setItem(STORAGE_KEY, current);
        } catch (e) { /* storage may be unavailable */ }
        document.documentElement.lang = current;
        apply();
        return current;
    }

    /**
     * Resolve the active language, in priority order:
     *   ?lang=xx in the URL  ->  saved preference  ->  English.
     * A ?lang= override is persisted so it survives later navigation.
     */
    function restore() {
        let saved = null;
        try {
            saved = localStorage.getItem(STORAGE_KEY);
        } catch (e) { /* ignore */ }

        let param = null;
        if (typeof location !== 'undefined' && location.search) {
            param = new URLSearchParams(location.search).get('lang');
        }

        if (DICT[param]) {
            return set(param);
        }

        current = DICT[saved] ? saved : DEFAULT_LANG;
        document.documentElement.lang = current;
        return current;
    }

    /** Translate a key; falls back to English, then to the key itself. */
    function t(key) {
        const table = DICT[current] || DICT[DEFAULT_LANG];
        if (table && table[key] !== undefined) return table[key];
        const base = DICT[DEFAULT_LANG];
        if (base && base[key] !== undefined) return base[key];
        return key;
    }

    /** Translate a backend error_code, falling back to the raw server message. */
    function tError(code, fallback) {
        if (!code) return fallback || t('error.generic');
        const key = 'err.' + code;
        const table = DICT[current] || {};
        const base = DICT[DEFAULT_LANG] || {};
        if (table[key] !== undefined) return table[key];
        if (base[key] !== undefined) return base[key];
        return fallback || t('error.generic');
    }

    /** Walk the DOM and fill in every data-i18n* attribute. */
    function apply(root) {
        const scope = root || document;
        scope.querySelectorAll('[data-i18n]').forEach(function (el) {
            el.textContent = t(el.getAttribute('data-i18n'));
        });
        scope.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
            el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
        });
        scope.querySelectorAll('[data-i18n-title]').forEach(function (el) {
            el.title = t(el.getAttribute('data-i18n-title'));
        });
        document.title = t('app.title');
    }

    global.i18n = { t: t, tError: tError, apply: apply, set: set, get: get, restore: restore, available: available, DEFAULT_LANG: DEFAULT_LANG };
})(window);
