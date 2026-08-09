#!/bin/bash
#
# Build "GetText AI.app" — a double-clickable macOS wrapper around the local
# server. The bundle points at this project folder rather than embedding a copy,
# so it stays small and picks up code changes; rebuild it if you move the project.
#
#   ./build-macapp.sh                 -> dist/GetText AI.app
#   ./build-macapp.sh ~/Applications  -> installs there instead
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEST_DIR="${1:-$PROJECT_DIR/dist}"
APP_NAME="GetText AI"
APP="$DEST_DIR/$APP_NAME.app"
BUNDLE_ID="com.arsudchat.gettextai"
VERSION="1.0"

echo "Building $APP_NAME.app"
echo "  project : $PROJECT_DIR"
echo "  output  : $APP"

# A python3 is needed to draw the icon; prefer the project venv if it exists.
PY="$PROJECT_DIR/venv/bin/python"
[ -x "$PY" ] || PY="$(command -v python3 || true)"
[ -n "$PY" ] || { echo "error: python3 not found (run: xcode-select --install)" >&2; exit 1; }

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

# --- Icon -----------------------------------------------------------------
ICONSET="$(mktemp -d)/GetText.iconset"
mkdir -p "$ICONSET"
"$PY" "$PROJECT_DIR/tools/make_icon.py" iconset "$ICONSET" >/dev/null
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/icon.icns"
rm -rf "$(dirname "$ICONSET")"
echo "  icon    : ok"

# --- Launcher -------------------------------------------------------------
# Escape for sed: the project path may contain characters sed treats specially.
ESCAPED_DIR=$(printf '%s\n' "$PROJECT_DIR" | sed 's/[&|\\]/\\&/g')
sed "s|__PROJECT_DIR__|$ESCAPED_DIR|" "$PROJECT_DIR/mac/launcher.sh" \
    > "$APP/Contents/MacOS/GetTextAI"
chmod +x "$APP/Contents/MacOS/GetTextAI"

# --- Info.plist -----------------------------------------------------------
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>              <string>$APP_NAME</string>
    <key>CFBundleDisplayName</key>       <string>$APP_NAME</string>
    <key>CFBundleIdentifier</key>        <string>$BUNDLE_ID</string>
    <key>CFBundleExecutable</key>        <string>GetTextAI</string>
    <key>CFBundleIconFile</key>          <string>icon</string>
    <key>CFBundlePackageType</key>       <string>APPL</string>
    <key>CFBundleShortVersionString</key><string>$VERSION</string>
    <key>CFBundleVersion</key>           <string>$VERSION</string>
    <key>LSMinimumSystemVersion</key>    <string>11.0</string>
    <key>NSHighResolutionCapable</key>   <true/>
</dict>
</plist>
PLIST

# Refresh the icon cache; Finder otherwise shows a stale or generic icon.
touch "$APP"
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \
    -f "$APP" >/dev/null 2>&1 || true

echo ""
echo "Built: $APP"
echo ""
echo "Next:"
echo "  open \"$DEST_DIR\"        # then drag the app to Applications or the Dock"
echo "  open \"$APP\"             # or launch it right away"
