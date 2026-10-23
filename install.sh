#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Checking Iconic release binary..."

if [ ! -f "$DIR/src-tauri/target/release/iconic" ]; then
    echo "==> Release binary not found, building with Tauri..."
    if command -v npm >/dev/null 2>&1; then
        (cd "$DIR" && npm install && npx tauri build)
    else
        echo "Error: npm is required to build Iconic." >&2
        exit 1
    fi
fi

if [ "$1" = "--system" ]; then
    PREFIX="/usr/local"
    APP_DIR="/usr/share/applications"
    ICON_DIR="/usr/share/icons/hicolor"
    SUDO="sudo"
else
    PREFIX="$HOME/.local"
    APP_DIR="$PREFIX/share/applications"
    ICON_DIR="$PREFIX/share/icons/hicolor"
    SUDO=""
fi

echo "==> Installing Iconic to $PREFIX..."

$SUDO mkdir -p "$PREFIX/bin"
$SUDO install -m 755 "$DIR/src-tauri/target/release/iconic" "$PREFIX/bin/iconic"

$SUDO mkdir -p "$ICON_DIR/512x512/apps" "$ICON_DIR/scalable/apps"
$SUDO install -m 644 "$DIR/src-tauri/icons/512x512.png" "$ICON_DIR/512x512/apps/io.github.rilorca.Iconic.png"
if [ -f "$DIR/src/assets/icon.svg" ]; then
    $SUDO install -m 644 "$DIR/src/assets/icon.svg" "$ICON_DIR/scalable/apps/io.github.rilorca.Iconic.svg"
fi

$SUDO mkdir -p "$APP_DIR"
$SUDO tee "$APP_DIR/io.github.rilorca.Iconic.desktop" > /dev/null << EOF
[Desktop Entry]
Name=Iconic
Comment=Custom Icon Mixer & Theme Blender for Linux Desktop
Exec=$PREFIX/bin/iconic
Icon=io.github.rilorca.Iconic
Terminal=false
Type=Application
Categories=Settings;DesktopSettings;
StartupWMClass=iconic
EOF

if command -v update-desktop-database >/dev/null 2>&1; then
    $SUDO update-desktop-database "$APP_DIR" 2>/dev/null || true
fi

if command -v kbuildsycoca6 >/dev/null 2>&1; then
    kbuildsycoca6 --noincremental 2>/dev/null || true
elif command -v kbuildsycoca5 >/dev/null 2>&1; then
    kbuildsycoca5 --noincremental 2>/dev/null || true
fi

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    $SUDO gtk-update-icon-cache -f -t "$ICON_DIR" 2>/dev/null || true
fi

echo "==> Installation complete! You can now launch 'Iconic' from your application menu or terminal."
