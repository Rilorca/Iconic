<p align="center">
  <img src="src/assets/icon.svg" width="128" height="128" alt="Iconic Logo">
</p>

<h1 align="center">Iconic</h1>

<p align="center">
  <strong>The Missing Custom Icon Mixer & Theme Blender for Linux 🎨🐧</strong><br>
  <em>Mix, match, and curate individual app, folder, and mimetype icons across any installed theme with native Rust speed and instant GTK cache updates.</em>
</p>

<p align="center">
  <a href="#why-iconic">Why Iconic?</a> •
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#installation">Installation</a> •
  <a href="#building-from-source">Building from Source</a> •
  <a href="#releasing">Generating a Release</a> •
  <a href="#troubleshooting">Troubleshooting</a> •
  <a href="#license">License</a>
</p>

---

## Why Iconic?

On Linux, desktop personalization is unmatched, but icon theming has always suffered from a classic problem: **you find an icon pack you love, but a handful of application icons are missing, outdated, or downright unappealing**. 

Whether it's modern browsers like *Zen Browser*, Discord clients like *Vesktop* or *Equibop*, media players like *Sonora*, or custom Flatpaks and Snaps, fixing icons previously required:
- Manually editing `.desktop` files in `/usr/share/applications` (which get overwritten on every package update),
- Manually copying SVG files into deep directory structures (`~/.local/share/icons/<theme>/<size>/apps/`), or
- Living with inconsistent desktop visuals.

**Iconic solves this permanently.** Built with native GNOME Adwaita aesthetics and powered by an ultra-fast Rust core:

- 🎨 **Mix & Match with Total Freedom:** Love Papirus overall, but prefer WhiteSur's folder icons and Tela's media icons? Cherry-pick individual icons per app, folder, or file type with visual resolution previews.
- 🔄 **Cross-Application Icon Borrowing:** Assign any application's icon variants to another. For example, give Discord's official theme icon to Equibop or Vesktop, or Spotify's icon to Sonora.
- 📁 **Dedicated Folders & MIME Types Section:** Customize folder categories (Downloads, Music, Videos, Documents) and file format icons independently from your applications.
- ⚡ **High-Performance Rust Scanner:** Rapid multithreaded scanning of native applications (`/usr/share/applications`, `~/.local/share/applications`), Flatpaks (`/var/lib/flatpak/exports`, `~/.local/share/flatpak/exports`), Snaps, and all custom `$XDG_DATA_DIRS`.
- 📦 **Non-Destructive Inheritance:** Creates clean, standard overlay themes in `~/.local/share/icons/` (`Inherits = <base_theme>`) without ever touching root directories or mutating original icon packs.
- 🚀 **Instant GTK Cache Invalidation:** Automatically runs `gtk-update-icon-cache` upon export and signals the desktop environment to reload icons instantly—no logouts or reboots needed.
- 🗂️ **Icon Pack Management:** Browse all installed system and user icon packs, open their container folders in your default file manager, or cleanly delete unwanted packs with one click.

---

## Features

- **Universal Application Discovery:** Automatically detects native Linux apps, user-level desktop entries, Flatpaks, and Snaps.
- **Cross-App Icon Mapping:** Search and assign icons across different apps (e.g., use Spotify's theme icons for Sonora).
- **Multi-Resolution Visual Picker:** Live preview with resolution badges showing whether an icon is **Vector (SVG)** or exact pixel dimensions (`24x24`, `48x48`, `128x128`, `256x256`, etc.) and its origin theme.
- **Folders & MIME Types Customization:** Separate workspace to tweak system folders (Downloads, Pictures, Documents, etc.) and file format icons.
- **Interactive Theme Editor:** Re-open previously exported mixed themes with **✏️ Edit**, swap icons, and update on the fly.
- **Direct Pack Directory Access & Safe Deletion:** Quick-access button to open icon packs in your file manager (`xdg-open`) and cleanly delete unused themes.
- **Adwaita Dark / Light Theming:** Clean, responsive UI with native dark titlebar support and smooth loading progress feedback.

---

## Architecture

Iconic is built with a lightweight, secure hybrid architecture:

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Frontend UI** | HTML5 + CSS3 + Vanilla JavaScript | Modern Libadwaita styling, fast rendering without heavy framework overhead, responsive modal dialogs, and progress tracking. |
| **Backend Core** | Rust + Tauri v2 | High-performance multithreaded XDG discovery, `.desktop` and `index.theme` parsing, safe file operations, and GTK cache compilation. |
| **Desktop Integration** | Freedesktop Standards | Non-destructive `Inherits` theme layering in `~/.local/share/icons/`, `gtk-update-icon-cache` invalidation, and `xdg-open` file manager integration. |

---

## Installation

### Method 1: Pre-Built Packages (Zero Terminal / Graphical) 📦

> [!TIP]
> **No terminal required!** You can install Iconic simply by downloading the installer package for your Linux distribution from [GitHub Releases](https://github.com/Rilorca/iconic/releases) and **double-clicking** it to open your desktop's graphical Software center.

| Distribution | Package | Graphical 1-Click Install | Terminal Command (Optional) |
| :--- | :--- | :--- | :--- |
| **Ubuntu / Debian / Mint / Pop!_OS** | `.deb` | Double-click `Iconic_0.1.0_amd64.deb` → Click **Install** | `sudo apt install ./Iconic_0.1.0_amd64.deb` |
| **Fedora / RHEL / Nobara** | `.rpm` | Double-click `Iconic-0.1.0-1.x86_64.rpm` → Click **Install** | `sudo dnf install ./Iconic-0.1.0-1.x86_64.rpm` |
| **Arch / Manjaro / CachyOS** | `.pkg.tar.zst` | Double-click `iconic-0.1.0-1-x86_64.pkg.tar.zst` in Pamac / Software | `sudo pacman -U ./iconic-0.1.0-1-x86_64.pkg.tar.zst` |
| **Any Linux (No Install Needed)** | `AppImage` | Right-click `Iconic_*.AppImage` → **Properties** → check **"Allow executing"** → Double-click to run | `chmod +x Iconic_*.AppImage && ./Iconic_*.AppImage` |

---

### Method 2: Building from Source (Native Linux App) ⚡

Compiling from source builds the optimized native binary and automatically installs it into your desktop application menu.

#### 1. Install Dependencies

<details>
<summary><b>Arch Linux / CachyOS / Manjaro</b></summary>

```sh
sudo pacman -S --needed base-devel nodejs npm cargo rust webkit2gtk-4.1 gtk3 libsoup3
```
</details>

<details>
<summary><b>Fedora / Nobara / RHEL</b></summary>

```sh
sudo dnf install nodejs npm cargo rust webkit2gtk4.1-devel gtk3-devel libsoup3-devel openssl-devel
```
</details>

<details>
<summary><b>Debian / Ubuntu / Pop!_OS / Linux Mint</b></summary>

```sh
sudo apt update
sudo apt install -y nodejs npm cargo rustc libwebkit2gtk-4.1-dev libgtk-3-dev libsoup-3.0-dev build-essential libssl-dev
```
</details>

#### 2. Automatic Build & Install

Run the automated installer to compile and register Iconic in your application launcher with a single command:

```sh
git clone https://github.com/Rilorca/iconic.git
cd iconic
./install.sh
```

*(Tip: For Arch-based distros, you can alternatively run `npm run build:arch` to produce an official `.pkg.tar.zst` package)*.

<details>
<summary><b>Manual Step-by-Step Installation (Alternative)</b></summary>

If you prefer to perform each step manually:

```sh
# 1. Install frontend dependencies and build
npm install
npx tauri build

# 2. Install binary to ~/.local/bin
mkdir -p ~/.local/bin
install -m 755 src-tauri/target/release/iconic ~/.local/bin/iconic

# 3. Install desktop icon
mkdir -p ~/.local/share/icons/hicolor/512x512/apps
install -m 644 src-tauri/icons/512x512.png ~/.local/share/icons/hicolor/512x512/apps/io.github.rilorca.Iconic.png

# 4. Create desktop menu entry
mkdir -p ~/.local/share/applications
cat << 'EOF' > ~/.local/share/applications/io.github.rilorca.Iconic.desktop
[Desktop Entry]
Name=Iconic
Comment=Custom Icon Mixer & Theme Blender for Linux Desktop
Exec=iconic
Icon=io.github.rilorca.Iconic
Terminal=false
Type=Application
Categories=Settings;DesktopSettings;
StartupWMClass=iconic
EOF

# 5. Refresh desktop database and icon cache
update-desktop-database ~/.local/share/applications
gtk-update-icon-cache -f -t ~/.local/share/icons/hicolor 2>/dev/null || true
```
</details>

*Tip: Make sure `~/.local/bin` is in your `$PATH` (standard on all modern distributions). You can now launch **Iconic** directly from your application launcher or terminal.*

#### System-Wide Installation (Optional)

If you prefer to install for all users on the machine:
```sh
sudo install -m 755 src-tauri/target/release/iconic /usr/local/bin/iconic
sudo install -m 644 src-tauri/icons/512x512.png /usr/share/icons/hicolor/512x512/apps/io.github.rilorca.Iconic.png
sudo cp ~/.local/share/applications/io.github.rilorca.Iconic.desktop /usr/share/applications/
sudo update-desktop-database /usr/share/applications
```

---

## Contributing & Development

To test, debug, and develop locally without building a full package:

```sh
# Install dependencies
npm install

# Run live development server with hot-reload
npm run tauri dev
```

### Running Test Suites

Iconic includes unit tests in Rust to verify XDG resolution, `.desktop` parsing, and theme inheritance:

```sh
# Run cargo unit tests
cargo test --manifest-path src-tauri/Cargo.toml
```

---

## Releasing

To create a new release and build package bundles (.deb, .rpm, AppImage):

1. Commit your changes on `main`.
2. Tag the release version (e.g. `v0.1.0`):
   ```sh
   git tag v0.1.0
   git push origin v0.1.0
   ```
3. Run `npx tauri build` to generate artifacts in `src-tauri/target/release/bundle/`.

---

## Troubleshooting

- **Icons don't update immediately after exporting?**  
  Iconic automatically invalidates GTK's icon cache. If your desktop environment (such as older XFCE or certain window managers) doesn't reload instantly, you can manually trigger a cache refresh:
  ```sh
  gtk-update-icon-cache -f -t ~/.local/share/icons/<theme-name>
  ```
- **Where are mixed themes stored?**  
  All mixed themes are non-destructively saved in `~/.local/share/icons/`. You can view, rename, or delete them anytime using Iconic's **Icon Packs** tab or in your file manager.
- **How to apply the mixed theme globally?**  
  Once exported, open your desktop settings (e.g., **GNOME Tweaks** on GNOME, **Appearance Settings** on XFCE, or **System Settings → Icons** on KDE Plasma) and select your newly exported theme name from the icon dropdown.

---

## License

Distributed under the [MIT License](LICENSE).
