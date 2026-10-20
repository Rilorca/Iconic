# Icon Mixer 🎨

[![Linux](https://img.shields.io/badge/Platform-Linux-orange.svg)](https://kernel.org)
[![Tauri](https://img.shields.io/badge/Tauri-v2-blue.svg)](https://tauri.app)
[![Rust](https://img.shields.io/badge/Rust-1.70+-DEA584.svg)](https://www.rust-lang.org)
[![Adwaita](https://img.shields.io/badge/UI-GNOME%20Adwaita-3584e4.svg)](https://gnome.org)

**Icon Mixer** es una aplicación de escritorio nativa, moderna y ultra rápida para Linux construida con **Tauri v2 + Rust**, con diseño fiel a **GNOME 46+ / GTK4 libadwaita**. Permite crear paquetes combinados de iconos (*mix-and-match*), editar temas existentes y personalizar los iconos de tus aplicaciones con total libertad.

---

## 🌟 Características

- **Libre Albedrío de Iconos**: Asigna variantes de cualquier aplicación a otra (por ejemplo, usa los iconos de *Discord* para *Equibop*, o los iconos de *Spotify* para *Sonora*).
- **Compatibilidad Total**: Detecta automáticamente aplicaciones nativas (`/usr/share/applications`), aplicaciones de usuario (`~/.local/share/applications`), **Flatpak** (`/var/lib/flatpak/exports`, `~/.local/share/flatpak/exports`), **Snap** y todas las rutas configuradas en `$XDG_DATA_DIRS`.
- **Carga en Paralelo & Barra de Progreso**: Escaneo fluido y rápido de aplicaciones y sus iconos con resolución concurrente en segundo plano e indicador visual de progreso.
- **Detalle de Dimensiones en Pixeles**: En el selector de variantes podrás ver si el icono es **Vectorial (SVG)** o su resolución exacta en píxeles (ej. `48x48`, `128x128`, `256x256`).
- **Edición y Gestión de Temas Creados**: Puedes volver a editar temas combinados creados previamente con el botón **✏️ Editar**, agregar o quitar iconos con **💾 Guardar y Aplicar**, o eliminarlos limpiamente con **🗑️**.
- **Invalidación Inteligente de Caché**: Refresca automáticamente la caché de GTK e invalida la memoria de GNOME Shell para que los cambios se reflejen de inmediato sin reiniciar sesión.
- **Soporte Nativo de Modo Oscuro**: Integrado con la paleta oficial de GNOME y persistencia de configuración.

---

## 📦 Requisitos Previos

En cualquier distribución Linux moderna necesitarás las dependencias comunes de Tauri:

### Fedora / RHEL / Nobara
```bash
sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget squashfs-tools
# Opcional (para compilar librsvg / svg a png si fuera necesario):
sudo dnf install librsvg2-tools
```

### Ubuntu / Debian / Pop!_OS / Linux Mint
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-bin
```

### Arch Linux / Manjaro
```bash
sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget openssl librsvg
```

Asegúrate de contar con **Node.js** (v18+) y **Rust**:
```bash
# Instalar Rust si no lo tienes:
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

---

## 🚀 Instalación y Uso

### 1. Clonar el repositorio
```bash
git clone https://github.com/tu-usuario/icon-mixer.git
cd icon-mixer
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Ejecutar en desarrollo
```bash
npm run dev
```

### 4. Compilar binario / paquete instalador (.deb, .rpm, AppImage)
```bash
npm run tauri build
```
Los ejecutables y paquetes listos para instalar se generarán automáticamente en:
`src-tauri/target/release/bundle/`

---

## 🧪 Pruebas Unitarias
El proyecto cuenta con un suite de pruebas automatizadas que verifican la integridad del sistema Freedesktop:
```bash
npm test
```

---

## 📄 Licencia
Distribuido bajo la Licencia MIT.
