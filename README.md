# Icon Mixer 🎨

Una aplicación de escritorio en **Rust + Tauri v2** con diseño fiel a **GNOME 46+ / GTK4 libadwaita**, orientada a personalizar y crear temas combinados de iconos en distribuciones Linux.

---

## 🌟 Características Principales

1. **Detección Automática de Paquetes de Iconos**:
   - Escanea automáticamente directorios del sistema (`/usr/share/icons`, `/usr/local/share/icons`) y del usuario (`~/.local/share/icons`, `~/.icons`).
   - Lee y analiza los archivos `index.theme` (nombre, descripción, jerarquía de herencia `Inherits`).
   - Permite **activar cualquier tema** instalado directamente con un clic (integración con `gsettings` / GNOME / Budgie / Cinnamon / etc.).

2. **Explorador de Aplicaciones Instaladas**:
   - Rastrea aplicaciones mediante archivos `.desktop` (`/usr/share/applications` y `~/.local/share/applications`).
   - Muestra el nombre, descripción, icono actual y el identificador de icono Freedesktop.
   - Búsqueda en tiempo real por nombre de app o nombre de icono.
   - Filtro rápido para ver solo aplicaciones que han sido personalizadas.

3. **Selector Multivariante de Iconos**:
   - Al pulsar sobre cualquier app, busca instantáneamente en todos los temas de iconos instalados si existe una versión correspondiente para esa app.
   - Vista previa en tiempo real tanto en formato **SVG** vectorial como **PNG** de alta resolución codificados en Base64.

4. **Constructor de Tema Combinado (Mix Profile)**:
   - Permite mezclar: por ejemplo, tener la base de iconos en *Papirus*, pero usar el icono de Firefox de *Tela*, el de Spotify de *Colloid*, etc.
   - Selector de **Tema Base (Fallback)** para heredar automáticamente los miles de iconos del sistema que no hayan sido sustituidos.
   - Persistencia local automática de tus asignaciones para no perder tu configuración al cerrar la app.

5. **Exportador de Tema Nativo Linux**:
   - Genera una carpeta válida en `~/.local/share/icons/<tu-tema>` con su `index.theme`, `scalable/apps`, y `256x256/apps`.
   - Ejecuta `gtk-update-icon-cache` para refrescar la caché de iconos GTK.
   - Opción para aplicar el nuevo tema inmediatamente al escritorio.

6. **Modificación Directa por .desktop (Opcional)**:
   - Permite aplicar el icono directamente sobre el archivo `.desktop` en `~/.local/share/applications`, manteniendo intactos los archivos del sistema y permitiendo restaurar el valor original en cualquier momento.

7. **Interfaz Adwaita Auténtica**:
   - Barra de encabezado Adwaita con *ViewSwitcher* segmentado.
   - Selector de modo Oscuro / Claro.
   - Diálogos modales y notificaciones toast estilo GNOME Shell.

---

## 🚀 Cómo Ejecutar

### Modo Desarrollo
```bash
npm run tauri dev
```

### Compilar para Producción (Binario Linux)
```bash
npm run tauri build
```
El ejecutable resultante estará en `src-tauri/target/release/tauri-app`.
