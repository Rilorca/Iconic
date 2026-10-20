// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // WebKitGTK DMA-BUF renderer on Wayland causes Protocol Error 71 in many Linux environments.
    // Forcing X11 backend or disabling compositing fixes the crash seamlessly.
    if std::env::var("GDK_BACKEND").is_err() {
        std::env::set_var("GDK_BACKEND", "x11,wayland");
    }
    if std::env::var("WEBKIT_DISABLE_COMPOSITING_MODE").is_err() {
        std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
    }
    if std::env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    tauri_app_lib::run()
}
