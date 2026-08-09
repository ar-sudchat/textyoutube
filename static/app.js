document.addEventListener('DOMContentLoaded', () => {
    // --- State Management ---
    const state = {
        geminiApiKey: localStorage.getItem('gemini_api_key') || '',
        cookiesText: localStorage.getItem('yt_cookies_text') || '',
        currentTranscript: null,
        currentSummary: '',
        activeViewMode: 'clean', // 'clean' or 'timestamped'
        statusKey: null,         // 'extracting' | 'summarizing' — kept so we can re-translate live
        lastError: null,         // { key } or { code, raw }
    };

    // --- DOM Elements ---
    const urlInput = document.getElementById('youtube-url');
    const btnClearUrl = document.getElementById('btn-clear-url');
    const btnPasteUrl = document.getElementById('btn-paste-url');

    const uiLanguageSelect = document.getElementById('ui-language');

    const btnToggleSettings = document.getElementById('btn-toggle-settings');
    const btnCloseSettings = document.getElementById('btn-close-settings');
    const settingsPanel = document.getElementById('settings-panel');
    const inputGeminiKey = document.getElementById('input-gemini-key');
    const inputCookies = document.getElementById('input-cookies');
    const fileCookieUpload = document.getElementById('file-cookie-upload');
    const cookieStatus = document.getElementById('cookie-status');
    const btnSaveSettings = document.getElementById('btn-save-settings');

    const summaryTypeSelect = document.getElementById('summary-type');
    const outputLanguageSelect = document.getElementById('output-language');
    const customInstructionsInput = document.getElementById('custom-instructions');
    const btnToggleCustomPrompt = document.getElementById('btn-toggle-custom-prompt');
    const customPromptWrapper = document.getElementById('custom-prompt-wrapper');

    const btnExtractOnly = document.getElementById('btn-extract-only');
    const btnExtractSummarize = document.getElementById('btn-extract-summarize');

    const loadingContainer = document.getElementById('loading-container');
    const statusTitle = document.getElementById('status-title');
    const statusDetail = document.getElementById('status-detail');

    const errorContainer = document.getElementById('error-container');
    const errorMessage = document.getElementById('error-message');
    const btnCloseError = document.getElementById('btn-close-error');

    const outputContainer = document.getElementById('output-container');
    const tabSummary = document.getElementById('tab-summary');
    const tabTranscript = document.getElementById('tab-transcript');
    const panelSummary = document.getElementById('panel-summary');
    const panelTranscript = document.getElementById('panel-transcript');

    const summaryRender = document.getElementById('summary-render');
    const transcriptRender = document.getElementById('transcript-render');
    const transcriptSearch = document.getElementById('transcript-search');
    const btnViewClean = document.getElementById('btn-view-clean');
    const btnViewTimestamped = document.getElementById('btn-view-timestamped');

    const btnCopyActive = document.getElementById('btn-copy-active');
    const btnDownloadActive = document.getElementById('btn-download-active');

    const authStatus = document.getElementById('auth-status');
    const authStatusText = document.getElementById('auth-status-text');

    // --- Language bootstrap (default English, see i18n.js) ---
    const OUTPUT_LANG_KEY = 'output_lang';
    let outputLangPinned = !!localStorage.getItem(OUTPUT_LANG_KEY);

    const activeLang = i18n.restore();
    uiLanguageSelect.value = activeLang;
    outputLanguageSelect.value = outputLangPinned
        ? localStorage.getItem(OUTPUT_LANG_KEY)
        : activeLang;
    i18n.apply();

    uiLanguageSelect.addEventListener('change', () => {
        i18n.set(uiLanguageSelect.value);
        // Output language follows the UI until the user pins it explicitly.
        if (!outputLangPinned) outputLanguageSelect.value = uiLanguageSelect.value;
        refreshDynamicText();
    });

    outputLanguageSelect.addEventListener('change', () => {
        outputLangPinned = true;
        localStorage.setItem(OUTPUT_LANG_KEY, outputLanguageSelect.value);
    });

    /**
     * Whether YouTube requests will be authenticated. Cookies decide whether a
     * deployed instance works at all, so this is surfaced up front rather than
     * left to be discovered through a failed extraction.
     */
    const auth = { serverCookies: false, known: false };

    async function loadAuthStatus() {
        try {
            const resp = await fetch('/api/health');
            const data = await resp.json();
            auth.serverCookies = !!data.youtube_cookies_set;
        } catch (err) {
            console.error('Health check failed:', err);
            auth.serverCookies = false;
        }
        auth.known = true;
        renderAuthStatus();
    }

    function renderAuthStatus() {
        const hasUserCookies = !!state.cookiesText.trim();
        let key = 'auth.checking';
        let tone = '';

        if (auth.known || hasUserCookies) {
            if (hasUserCookies) {
                key = 'auth.user';
                tone = 'ok';
            } else if (auth.serverCookies) {
                key = 'auth.server';
                tone = 'ok';
            } else {
                key = 'auth.none';
                tone = 'warn';
            }
        }

        authStatusText.setAttribute('data-i18n', key);
        authStatusText.textContent = i18n.t(key);
        authStatus.classList.toggle('is-ok', tone === 'ok');
        authStatus.classList.toggle('is-warn', tone === 'warn');
    }

    authStatus.addEventListener('click', () => {
        settingsPanel.classList.remove('hidden');
        inputCookies.focus();
    });

    /** Re-render everything that i18n.apply() cannot reach (JS-generated text). */
    function refreshDynamicText() {
        updateCookieStatus();
        renderAuthStatus();
        if (state.statusKey) {
            statusTitle.textContent = i18n.t(`status.${state.statusKey}.title`);
            statusDetail.textContent = i18n.t(`status.${state.statusKey}.detail`);
        }
        if (state.lastError) {
            errorMessage.textContent = state.lastError.key
                ? i18n.t(state.lastError.key)
                : i18n.tError(state.lastError.code, state.lastError.raw);
        }
        renderTranscript();
    }

    // --- Initialize UI from State ---
    inputGeminiKey.value = state.geminiApiKey;
    inputCookies.value = state.cookiesText;
    updateCookieStatus();
    renderAuthStatus();
    loadAuthStatus();
    urlInput.focus();

    // --- Event Listeners ---
    urlInput.addEventListener('input', () => {
        btnClearUrl.classList.toggle('hidden', !urlInput.value);
    });

    btnClearUrl.addEventListener('click', () => {
        urlInput.value = '';
        btnClearUrl.classList.add('hidden');
        urlInput.focus();
    });

    btnPasteUrl.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                urlInput.value = text.trim();
                btnClearUrl.classList.remove('hidden');
                urlInput.focus();
            }
        } catch (err) {
            console.error('Failed to paste from clipboard:', err);
            urlInput.focus();
        }
    });

    // Enter in the URL field runs the primary action
    urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            runProcess(false);
        }
    });

    // Settings Modal
    btnToggleSettings.addEventListener('click', () => settingsPanel.classList.remove('hidden'));
    btnCloseSettings.addEventListener('click', () => settingsPanel.classList.add('hidden'));
    settingsPanel.addEventListener('click', (e) => {
        if (e.target === settingsPanel) settingsPanel.classList.add('hidden');
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') settingsPanel.classList.add('hidden');
    });

    btnSaveSettings.addEventListener('click', () => {
        state.geminiApiKey = inputGeminiKey.value.trim();
        state.cookiesText = inputCookies.value.trim();
        localStorage.setItem('gemini_api_key', state.geminiApiKey);
        localStorage.setItem('yt_cookies_text', state.cookiesText);
        updateCookieStatus();
        renderAuthStatus();
        settingsPanel.classList.add('hidden');
        showToast(i18n.t('toast.saved'));
    });

    fileCookieUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                inputCookies.value = event.target.result;
                updateCookieStatus();
            };
            reader.readAsText(file);
        }
    });

    function updateCookieStatus() {
        const isSet = !!inputCookies.value.trim();
        cookieStatus.textContent = i18n.t(isSet ? 'settings.cookies.set' : 'settings.cookies.notSet');
        cookieStatus.classList.toggle('active', isSet);
    }

    // Custom Prompt Toggle
    btnToggleCustomPrompt.addEventListener('click', () => {
        customPromptWrapper.classList.toggle('hidden');
        const icon = btnToggleCustomPrompt.querySelector('i');
        icon.classList.toggle('fa-chevron-down');
        icon.classList.toggle('fa-chevron-up');
    });

    // Error Close
    btnCloseError.addEventListener('click', () => hideError());

    // Tabs Switch
    tabSummary.addEventListener('click', () => switchTab('summary'));
    tabTranscript.addEventListener('click', () => switchTab('transcript'));

    function switchTab(tab) {
        const isSummary = tab === 'summary';
        tabSummary.classList.toggle('active', isSummary);
        tabTranscript.classList.toggle('active', !isSummary);
        panelSummary.classList.toggle('hidden', !isSummary);
        panelTranscript.classList.toggle('hidden', isSummary);
    }

    // Transcript View Mode
    btnViewClean.addEventListener('click', () => {
        state.activeViewMode = 'clean';
        btnViewClean.classList.add('active');
        btnViewTimestamped.classList.remove('active');
        renderTranscript();
    });

    btnViewTimestamped.addEventListener('click', () => {
        state.activeViewMode = 'timestamped';
        btnViewTimestamped.classList.add('active');
        btnViewClean.classList.remove('active');
        renderTranscript();
    });

    transcriptSearch.addEventListener('input', renderTranscript);

    // Action Execution
    btnExtractOnly.addEventListener('click', () => runProcess(false));
    btnExtractSummarize.addEventListener('click', () => runProcess(true));

    async function runProcess(doSummarize = true) {
        const url = urlInput.value.trim();
        if (!url) {
            showErrorKey('error.noUrl');
            urlInput.focus();
            return;
        }

        hideError();
        outputContainer.classList.add('hidden');
        setBusy(true);
        showLoading('extracting');

        try {
            // 1. Extract Transcript API
            const extractResp = await fetch('/api/extract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: url,
                    // Always send cookies when the user has them, not just for
                    // private videos: a server whose IP YouTube has flagged needs
                    // them for public videos too.
                    cookies_text: state.cookiesText || null,
                    gemini_api_key: state.geminiApiKey || null,
                    // Prefer a subtitle track in the user's language, then fall back.
                    languages: [...new Set([i18n.get(), 'en', 'th'])]
                })
            });

            const extractData = await readJson(extractResp);
            if (!extractResp.ok || !extractData.success) {
                throw new ApiError(extractData.error_code, extractData.error);
            }

            state.currentTranscript = extractData;
            renderTranscript();

            // If extract only, done!
            if (!doSummarize) {
                hideLoading();
                outputContainer.classList.remove('hidden');
                switchTab('transcript');
                return;
            }

            // 2. Summarize API
            showLoading('summarizing');

            const textToSummarize = extractData.full_text_timestamped || extractData.full_text_clean;

            const summarizeResp = await fetch('/api/summarize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transcript_text: textToSummarize,
                    summary_type: summaryTypeSelect.value,
                    custom_instructions: customInstructionsInput.value.trim(),
                    gemini_api_key: state.geminiApiKey || null,
                    language: outputLanguageSelect.value
                })
            });

            const summarizeData = await readJson(summarizeResp);
            if (!summarizeResp.ok || !summarizeData.success) {
                throw new ApiError(summarizeData.error_code, summarizeData.error);
            }

            state.currentSummary = summarizeData.result;
            renderSummary(state.currentSummary);

            hideLoading();
            outputContainer.classList.remove('hidden');
            switchTab('summary');

        } catch (err) {
            hideLoading();
            if (err instanceof ApiError) {
                showErrorCode(err.code, err.raw);
            } else {
                // Never swallow an unexpected failure behind a fixed string: a
                // dead CDN, an offline server and a bad response all used to look
                // identical here, which made them impossible to tell apart.
                console.error('Request failed:', err);
                showErrorText(`${i18n.t('error.generic')} (${err.message})`);
            }
        } finally {
            setBusy(false);
        }
    }

    /** Parse a JSON body, reporting the HTTP status when the body is not JSON. */
    async function readJson(response) {
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch (err) {
            const snippet = text.trim().slice(0, 120) || '(empty response)';
            throw new Error(`HTTP ${response.status} — ${snippet}`);
        }
    }

    /** Render Markdown, degrading to plain text if the Markdown CDN never loaded. */
    function renderSummary(markdown) {
        if (window.marked && typeof marked.parse === 'function') {
            summaryRender.innerHTML = marked.parse(markdown);
            if (window.hljs) {
                summaryRender.querySelectorAll('pre code').forEach((b) => hljs.highlightElement(b));
            }
        } else {
            summaryRender.innerHTML = `<pre class="plain-summary">${escapeHtml(markdown)}</pre>`;
        }
    }

    /** Error carrying a stable backend code so it can be translated client-side. */
    class ApiError extends Error {
        constructor(code, raw) {
            super(raw || code || 'error');
            this.code = code;
            this.raw = raw;
        }
    }

    // --- Render Functions ---
    function renderTranscript() {
        if (!state.currentTranscript) return;

        const query = transcriptSearch.value.trim();
        let contentHtml = '';

        if (state.activeViewMode === 'timestamped' && state.currentTranscript.items && state.currentTranscript.items.length > 0) {
            const needle = query.toLowerCase();
            const filteredItems = state.currentTranscript.items.filter(item =>
                !needle || item.text.toLowerCase().includes(needle)
            );

            if (filteredItems.length === 0) {
                contentHtml = `<p class="text-dim">${escapeHtml(i18n.t('transcript.notFound'))}</p>`;
            } else {
                contentHtml = filteredItems.map(item => `
                    <div class="transcript-item">
                        <span class="ts-badge">[${escapeHtml(item.timestamp)}]</span>
                        <span class="ts-text">${highlight(item.text, query)}</span>
                    </div>
                `).join('');
            }
        } else {
            const text = state.currentTranscript.full_text_clean || '';
            contentHtml = `<p>${highlight(text, query)}</p>`;
        }

        transcriptRender.innerHTML = contentHtml;
    }

    /** Escape first, then wrap matches — doing it the other way round escapes the <mark>. */
    function highlight(text, query) {
        const safe = escapeHtml(text);
        if (!query) return safe;
        const regex = new RegExp(`(${escapeRegExp(escapeHtml(query))})`, 'gi');
        return safe.replace(regex, '<mark>$1</mark>');
    }

    // Copy & Download Handlers
    function activeText() {
        if (tabSummary.classList.contains('active')) return state.currentSummary;
        return state.activeViewMode === 'timestamped'
            ? (state.currentTranscript?.full_text_timestamped || '')
            : (state.currentTranscript?.full_text_clean || '');
    }

    btnCopyActive.addEventListener('click', async () => {
        const textToCopy = activeText();
        if (!textToCopy) return;
        try {
            await navigator.clipboard.writeText(textToCopy);
            showToast(i18n.t('toast.copied'));
        } catch (err) {
            console.error('Clipboard write failed:', err);
        }
    });

    btnDownloadActive.addEventListener('click', () => {
        const isSummaryActive = tabSummary.classList.contains('active');
        const content = activeText();
        if (!content) return;

        const videoId = state.currentTranscript?.video_id || 'youtube';
        const filename = isSummaryActive ? `summary_${videoId}.md` : `transcript_${videoId}.txt`;

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    });

    // Helper utilities
    function setBusy(busy) {
        [btnExtractOnly, btnExtractSummarize].forEach(b => { b.disabled = busy; });
    }

    function showLoading(statusKey) {
        state.statusKey = statusKey;
        statusTitle.textContent = i18n.t(`status.${statusKey}.title`);
        statusDetail.textContent = i18n.t(`status.${statusKey}.detail`);
        loadingContainer.classList.remove('hidden');
    }

    function hideLoading() {
        state.statusKey = null;
        loadingContainer.classList.add('hidden');
    }

    function showErrorKey(key) {
        state.lastError = { key: key };
        errorMessage.textContent = i18n.t(key);
        errorContainer.classList.remove('hidden');
    }

    function showErrorCode(code, raw) {
        state.lastError = { code: code, raw: raw };
        errorMessage.textContent = i18n.tError(code, raw);
        errorContainer.classList.remove('hidden');
    }

    /** Show a message that has no translation key — keep it verbatim on re-render. */
    function showErrorText(text) {
        state.lastError = { code: null, raw: text };
        errorMessage.textContent = text;
        errorContainer.classList.remove('hidden');
    }

    function hideError() {
        state.lastError = null;
        errorContainer.classList.add('hidden');
    }

    function showToast(msg) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = msg;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('toast-in'));
        setTimeout(() => {
            toast.classList.remove('toast-in');
            setTimeout(() => toast.remove(), 250);
        }, 2400);
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function escapeRegExp(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
});
