#!/bin/bash
#
# GetText AI — macOS app launcher.
#
# This is the executable inside GetText AI.app. Because it is a plain script
# bundled as CFBundleExecutable, double-clicking runs it with no Terminal window.
# It creates the venv on first launch, starts the local server, opens the browser
# and stays alive behind a small dialog so there is an obvious way to stop it.
#
# __PROJECT_DIR__ is replaced by build-macapp.sh.
set -uo pipefail

PROJECT_DIR="__PROJECT_DIR__"
APP_NAME="GetText AI"
PREFERRED_PORT=8765
LOG_DIR="$HOME/Library/Logs"
LOG_FILE="$LOG_DIR/GetTextAI.log"

mkdir -p "$LOG_DIR"

notify() {
    osascript -e "display notification \"$1\" with title \"$APP_NAME\"" >/dev/null 2>&1 || true
}

fail() {
    osascript >/dev/null 2>&1 <<EOF || true
tell application "System Events"
    activate
    display dialog "$1" buttons {"OK"} default button "OK" with title "$APP_NAME" with icon stop
end tell
EOF
    exit 1
}

# Answers only if it is our server: something else on the port must not be adopted.
is_our_server() {
    curl -sf -m 2 "http://127.0.0.1:$1/api/health" 2>/dev/null | grep -q '"status"'
}

cd "$PROJECT_DIR" 2>/dev/null || fail "Project folder not found:

$PROJECT_DIR

Rebuild the app after moving the project."

PY="$PROJECT_DIR/venv/bin/python"

# --- First launch: build the environment ---------------------------------
if [ ! -x "$PY" ]; then
    command -v python3 >/dev/null 2>&1 || fail "Python 3 is required but was not found.

Install Apple's command line tools with:
    xcode-select --install"

    notify "First launch — setting up, this takes a minute…"
    python3 -m venv "$PROJECT_DIR/venv" >>"$LOG_FILE" 2>&1 \
        || fail "Could not create the Python environment.

See $LOG_FILE"
    "$PROJECT_DIR/venv/bin/pip" install -q --disable-pip-version-check \
        -r "$PROJECT_DIR/requirements.txt" >>"$LOG_FILE" 2>&1 \
        || fail "Could not install dependencies.

See $LOG_FILE"
    notify "Setup complete."
fi

# --- Already running? Just surface it -------------------------------------
if is_our_server "$PREFERRED_PORT"; then
    open "http://127.0.0.1:$PREFERRED_PORT/"
    exit 0
fi

# --- Choose a port --------------------------------------------------------
PORT=$("$PY" - "$PREFERRED_PORT" <<'PY'
import socket, sys

preferred = int(sys.argv[1])
for candidate in list(range(preferred, preferred + 40)) + [0]:
    sock = socket.socket()
    try:
        sock.bind(("127.0.0.1", candidate))
        print(sock.getsockname()[1])
        break
    except OSError:
        continue
    finally:
        sock.close()
PY
)
[ -n "$PORT" ] || fail "Could not find a free port to listen on."

# Private videos work without exporting cookies.txt: yt-dlp can read the cookies
# straight out of a local browser profile. Harmless when the browser is absent.
export YOUTUBE_COOKIES_FROM_BROWSER="${YOUTUBE_COOKIES_FROM_BROWSER:-chrome}"

# Lets the page offer a Quit button. Deliberately scoped to this launcher: the
# same server code runs on public deployments, where a shutdown route would be
# an open invitation.
export GETTEXT_ALLOW_SHUTDOWN=1

{
    echo ""
    echo "=== $(date '+%Y-%m-%d %H:%M:%S') starting on port $PORT ==="
} >>"$LOG_FILE"

"$PY" -m uvicorn server:app --host 127.0.0.1 --port "$PORT" >>"$LOG_FILE" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null' EXIT

# --- Wait for it to answer ------------------------------------------------
READY=""
for _ in $(seq 1 120); do
    if is_our_server "$PORT"; then READY=1; break; fi
    kill -0 "$SERVER_PID" 2>/dev/null || break
    sleep 0.25
done
[ -n "$READY" ] || fail "The server did not start.

See $LOG_FILE"

open "http://127.0.0.1:$PORT/"

# Nothing is shown on screen from here on. An earlier version parked a dialog in
# front of everything, which is both in the way and a trap: dismissing it killed
# the server while the browser tab stayed open and started failing to fetch.
# Quitting now happens from the page itself (POST /api/shutdown).
wait "$SERVER_PID"
