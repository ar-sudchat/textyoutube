# GetText AI

Extract the transcript from a YouTube video and turn it into an article, an
executive summary or a timestamped outline with Gemini.

FastAPI backend, vanilla-JS frontend, no build step. Interface available in
English (default), Thai, Simplified Chinese and Japanese.

## How transcripts are fetched

Three strategies run in order; the first that succeeds wins:

1. **`youtube-transcript-api`** — fastest and cleanest.
2. **`yt-dlp` subtitles** — parses the `json3` caption track.
3. **Audio + Gemini speech-to-text** — downloads the audio and transcribes it.
   Needs `ffmpeg` and a Gemini API key.

When all three fail the response carries an `attempts` array explaining what each
one hit, so a genuine "no captions" video is distinguishable from YouTube
refusing the request.

## Running locally

```bash
./run.sh          # creates venv, installs deps, serves on http://localhost:8000
```

## Running as a macOS app

```bash
./build-macapp.sh                 # -> dist/GetText AI.app
./build-macapp.sh /Applications   # or install straight away
```

The bundle lives in the menu bar: click the icon to open the page, restart the
server, or quit. It creates the venv on first launch, always serves on
`http://127.0.0.1:8765` (so the URL can be bookmarked), and stops the server when
you quit. It has no Dock icon by design — the page is the interface.

Where `swiftc` is unavailable the build falls back to a shell launcher that opens
the browser and is quit from a button in the page.

Running locally also sidesteps the blocking described under
[Why a deployed instance needs cookies](#why-a-deployed-instance-needs-cookies):
YouTube does not block residential IPs, so no cookies are needed at all. Private
videos are covered by `YOUTUBE_COOKIES_FROM_BROWSER`, which the app sets to
`chrome` so yt-dlp reads the local browser profile directly.

## Running with Docker

```bash
docker build -t gettext-ai .
docker run -p 8000:8000 gettext-ai
```

## Configuration

Every variable is optional — the app runs without them — but a server deployment
generally needs the cookie one. See below.

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Default Gemini key. Users can also supply their own in the UI, which takes priority. |
| `YOUTUBE_COOKIES_FILE` | Path to a `cookies.txt`. Best paired with a persistent volume. |
| `YOUTUBE_COOKIES` | The same contents inline, for hosts that only offer env vars. `\n` escapes are converted to real newlines. |
| `YOUTUBE_PROXY` | Route all YouTube traffic through a proxy, e.g. `http://user:pass@host:port`. |
| `PORT` | Listen port. Defaults to `8000`. |

Check what a running instance picked up:

```bash
curl https://your-host/api/health
# {"status":"ok","gemini_key_set":true,"youtube_cookies_set":true,"youtube_proxy_set":false}
```

### Why a deployed instance needs cookies

YouTube blocks datacenter and VPS IP ranges, answering with *"Sign in to confirm
you're not a bot"*. The same code that works from a home connection fails from a
server, which is what `youtube_blocked` in the API response means.

Two ways out, and they combine:

- **Cookies** — export `cookies.txt` from a logged-in browser session (the
  *Get cookies.txt LOCALLY* extension produces the right Netscape format) and
  point `YOUTUBE_COOKIES_FILE` at it. Use a throwaway YouTube account: a cookie
  jar is a full session for whatever account created it.
- **A residential proxy** via `YOUTUBE_PROXY`, for when cookies alone are not
  enough.

Cookies expire. When a previously working deployment starts returning
`youtube_blocked` again, re-export them.

## API

| Endpoint | Purpose |
| --- | --- |
| `POST /api/extract` | `{url, cookies_text?, gemini_api_key?, languages?}` → transcript |
| `POST /api/summarize` | `{transcript_text, summary_type?, custom_instructions?, gemini_api_key?, language?}` → Markdown |
| `GET /api/health` | Status and which credentials are configured |

Failures return a stable `error_code` (`invalid_url`, `no_transcript`,
`youtube_blocked`, `stt_api_key_required`, `stt_failed`, `missing_api_key`,
`empty_transcript`, `summarize_failed`) which the frontend localises.

## Adding a UI language

Copy the `en` block in `static/i18n.js`, translate the values, and add a matching
`<option>` to `#ui-language` in `static/index.html`. Missing keys fall back to
English. `?lang=xx` deep-links a language.
