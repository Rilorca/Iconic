use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IconTheme {
    pub id: String,
    pub name: String,
    pub comment: Option<String>,
    pub inherits: Vec<String>,
    pub path: String,
    pub is_user: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppEntry {
    pub file_name: String,
    pub path: String,
    pub name: String,
    pub generic_name: Option<String>,
    pub comment: Option<String>,
    pub icon_name: String,
    pub categories: Vec<String>,
    pub exec: Option<String>,
    pub is_user_override: bool,
    pub current_icon_data: Option<String>, // data:image/svg+xml;base64,... or png
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ThemeIconMatch {
    pub theme_id: String,
    pub theme_name: String,
    pub icon_path: String,
    pub icon_format: String, // "svg" or "png"
    pub icon_data: String,   // base64 data uri
    pub target_app_icon: Option<String>, // The icon name expected by the .desktop file
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MixProfile {
    pub target_theme_name: String,
    pub base_theme: String,
    pub overrides: HashMap<String, AppOverride>, // app_file_name -> AppOverride
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppOverride {
    pub source_theme: String,
    pub icon_name: String,
    pub icon_path: String,
}

// Get system icon search directories
fn get_icon_search_dirs() -> Vec<PathBuf> {
    let mut dirs_list = Vec::new();
    let mut seen = HashSet::new();

    if let Some(home) = dirs::home_dir() {
        let user_icons = home.join(".local/share/icons");
        let legacy_icons = home.join(".icons");
        let flatpak_icons = home.join(".local/share/flatpak/exports/share/icons");
        for p in [user_icons, legacy_icons, flatpak_icons] {
            if seen.insert(p.clone()) {
                dirs_list.push(p);
            }
        }
    }

    // XDG_DATA_DIRS
    if let Ok(xdg_data_dirs) = std::env::var("XDG_DATA_DIRS") {
        for part in xdg_data_dirs.split(':') {
            if !part.trim().is_empty() {
                let p = PathBuf::from(part.trim()).join("icons");
                if seen.insert(p.clone()) {
                    dirs_list.push(p);
                }
            }
        }
    }

    for standard in [
        "/usr/share/icons",
        "/usr/local/share/icons",
        "/var/lib/flatpak/exports/share/icons",
        "/var/lib/snapd/desktop/icons",
    ] {
        let p = PathBuf::from(standard);
        if seen.insert(p.clone()) {
            dirs_list.push(p);
        }
    }

    dirs_list
}

// Get desktop application search directories (including Flatpak and Snap)
fn get_app_search_dirs() -> Vec<PathBuf> {
    let mut dirs_list = Vec::new();
    let mut seen = HashSet::new();

    if let Some(home) = dirs::home_dir() {
        let user_apps = home.join(".local/share/applications");
        let flatpak_user = home.join(".local/share/flatpak/exports/share/applications");
        for p in [user_apps, flatpak_user] {
            if seen.insert(p.clone()) {
                dirs_list.push(p);
            }
        }
    }

    // XDG_DATA_DIRS
    if let Ok(xdg_data_dirs) = std::env::var("XDG_DATA_DIRS") {
        for part in xdg_data_dirs.split(':') {
            if !part.trim().is_empty() {
                let p = PathBuf::from(part.trim()).join("applications");
                if seen.insert(p.clone()) {
                    dirs_list.push(p);
                }
            }
        }
    }

    for standard in [
        "/usr/share/applications",
        "/usr/local/share/applications",
        "/var/lib/flatpak/exports/share/applications",
        "/var/lib/snapd/desktop/applications",
    ] {
        let p = PathBuf::from(standard);
        if seen.insert(p.clone()) {
            dirs_list.push(p);
        }
    }

    dirs_list
}

// Helper: load image file to data URI
fn file_to_data_uri(path: &Path) -> Option<String> {
    if !path.exists() || !path.is_file() {
        return None;
    }
    let ext = path.extension()?.to_str()?.to_lowercase();
    let mime = match ext.as_str() {
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "xpm" => "image/x-xpixmap",
        _ => return None,
    };
    let bytes = fs::read(path).ok()?;
    let encoded = BASE64.encode(&bytes);
    Some(format!("data:{};base64,{}", mime, encoded))
}

// Helper to parse simple key-value ini/desktop file
fn parse_ini_file(path: &Path) -> HashMap<String, HashMap<String, String>> {
    let mut result: HashMap<String, HashMap<String, String>> = HashMap::new();
    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return result,
    };

    let mut current_section = String::new();
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            current_section = trimmed[1..trimmed.len() - 1].trim().to_string();
            result.entry(current_section.clone()).or_default();
        } else if let Some((key, value)) = trimmed.split_once('=') {
            if !current_section.is_empty() {
                result
                    .entry(current_section.clone())
                    .or_default()
                    .insert(key.trim().to_string(), value.trim().to_string());
            }
        }
    }
    result
}

#[tauri::command]
fn list_icon_themes() -> Result<Vec<IconTheme>, String> {
    let mut themes = Vec::new();
    let mut seen_ids = HashSet::new();

    let user_home = dirs::home_dir();

    for dir in get_icon_search_dirs() {
        if !dir.exists() {
            continue;
        }
        let read_dir = match fs::read_dir(&dir) {
            Ok(d) => d,
            Err(_) => continue,
        };

        for entry in read_dir.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let theme_file = path.join("index.theme");
                if theme_file.exists() {
                    let id = entry.file_name().to_string_lossy().to_string();
                    if seen_ids.contains(&id) {
                        continue;
                    }

                    let ini = parse_ini_file(&theme_file);
                    let icon_theme_sec = ini.get("Icon Theme");

                    let name = icon_theme_sec
                        .and_then(|s| s.get("Name"))
                        .cloned()
                        .unwrap_or_else(|| id.clone());

                    let comment = icon_theme_sec.and_then(|s| s.get("Comment")).cloned();

                    let inherits = icon_theme_sec
                        .and_then(|s| s.get("Inherits"))
                        .map(|inh| {
                            inh.split(',')
                                .map(|x| x.trim().to_string())
                                .filter(|x| !x.is_empty())
                                .collect()
                        })
                        .unwrap_or_default();

                    let is_user = if let Some(ref home) = user_home {
                        path.starts_with(home)
                    } else {
                        false
                    };

                    seen_ids.insert(id.clone());
                    themes.push(IconTheme {
                        id,
                        name,
                        comment,
                        inherits,
                        path: path.to_string_lossy().to_string(),
                        is_user,
                    });
                }
            }
        }
    }

    // Sort by name
    themes.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(themes)
}

// Find icon file in a specific theme by name
fn find_icon_in_theme(theme_path: &Path, icon_name: &str) -> Option<PathBuf> {
    if !theme_path.exists() {
        return None;
    }

    // Direct path match if icon_name is already a path
    let direct = Path::new(icon_name);
    if direct.is_absolute() && direct.exists() {
        return Some(direct.to_path_buf());
    }

    let exts = ["svg", "png", "webp", "xpm"];

    // First check scalable apps or largest sizes
    // Search priorities: apps, scalable, 128x128, 64x64, 48x48, etc.
    let mut candidate_svg: Option<PathBuf> = None;
    let mut candidate_png: Option<PathBuf> = None;

    for entry in WalkDir::new(theme_path)
        .max_depth(5)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let p = entry.path();
        if p.is_file() {
            if let Some(stem) = p.file_stem().and_then(|s| s.to_str()) {
                if stem.eq_ignore_ascii_case(icon_name) {
                    if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
                        let ext_lower = ext.to_lowercase();
                        if ext_lower == "svg" {
                            candidate_svg = Some(p.to_path_buf());
                            break; // Scalable SVG is ideal
                        } else if exts.contains(&ext_lower.as_str()) {
                            let path_str = p.to_string_lossy();
                            if path_str.contains("apps") || path_str.contains("scalable") || path_str.contains("512") || path_str.contains("256") || path_str.contains("128") {
                                candidate_png = Some(p.to_path_buf());
                            } else if candidate_png.is_none() {
                                candidate_png = Some(p.to_path_buf());
                            }
                        }
                    }
                }
            }
        }
    }

    candidate_svg.or(candidate_png)
}

// Resolve icon for an app according to a theme hierarchy (or current system theme)
#[tauri::command]
fn resolve_app_icon(icon_name: String, theme_id: Option<String>) -> Result<Option<String>, String> {
    let icon_p = Path::new(&icon_name);
    if icon_p.is_absolute() && icon_p.exists() {
        return Ok(file_to_data_uri(icon_p));
    }

    let search_dirs = get_icon_search_dirs();
    let mut themes_to_try = Vec::new();

    if let Some(ref tid) = theme_id {
        themes_to_try.push(tid.clone());
    }

    // Add fallback themes
    themes_to_try.push("hicolor".to_string());
    themes_to_try.push("Adwaita".to_string());
    themes_to_try.push("breeze".to_string());

    for tid in &themes_to_try {
        for base in &search_dirs {
            let tdir = base.join(tid);
            if let Some(found) = find_icon_in_theme(&tdir, &icon_name) {
                if let Some(uri) = file_to_data_uri(&found) {
                    return Ok(Some(uri));
                }
            }
        }
    }

    // Check direct pixmaps
    let pixmaps = PathBuf::from("/usr/share/pixmaps");
    for ext in &["svg", "png", "xpm"] {
        let p = pixmaps.join(format!("{}.{}", icon_name, ext));
        if p.exists() {
            if let Some(uri) = file_to_data_uri(&p) {
                return Ok(Some(uri));
            }
        }
    }

    Ok(None)
}

#[tauri::command]
fn list_applications() -> Result<Vec<AppEntry>, String> {
    let mut apps = Vec::new();
    let mut seen_ids = HashSet::new();

    let user_home = dirs::home_dir();
    let user_apps_dir = user_home.as_ref().map(|h| h.join(".local/share/applications"));

    for dir in get_app_search_dirs() {
        if !dir.exists() {
            continue;
        }

        let read_dir = match fs::read_dir(&dir) {
            Ok(d) => d,
            Err(_) => continue,
        };

        for entry in read_dir.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("desktop") {
                let file_name = entry.file_name().to_string_lossy().to_string();
                if seen_ids.contains(&file_name) {
                    continue;
                }

                let ini = parse_ini_file(&path);
                if let Some(sec) = ini.get("Desktop Entry") {
                    let no_display = sec.get("NoDisplay").map(|v| v.as_str()).unwrap_or("false");
                    if no_display.eq_ignore_ascii_case("true") {
                        continue;
                    }

                    let name = match sec.get("Name") {
                        Some(n) if !n.is_empty() => n.clone(),
                        _ => continue,
                    };

                    let icon_name = match sec.get("Icon") {
                        Some(i) if !i.is_empty() => i.clone(),
                        _ => continue, // only show apps that have an icon defined
                    };

                    let generic_name = sec.get("GenericName").cloned();
                    let comment = sec.get("Comment").cloned();
                    let exec = sec.get("Exec").cloned();
                    let categories = sec
                        .get("Categories")
                        .map(|c| {
                            c.split(';')
                                .map(|x| x.trim().to_string())
                                .filter(|x| !x.is_empty())
                                .collect()
                        })
                        .unwrap_or_default();

                    let is_user_override = if let Some(ref uad) = user_apps_dir {
                        path.starts_with(uad)
                    } else {
                        false
                    };

                    seen_ids.insert(file_name.clone());
                    apps.push(AppEntry {
                        file_name,
                        path: path.to_string_lossy().to_string(),
                        name,
                        generic_name,
                        comment,
                        icon_name,
                        categories,
                        exec,
                        is_user_override,
                        current_icon_data: None,
                    });
                }
            }
        }
    }

    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(apps)
}

#[tauri::command]
fn find_icons_in_all_themes(icon_name: String) -> Result<Vec<ThemeIconMatch>, String> {
    let themes = list_icon_themes()?;
    let mut matches = Vec::new();

    for theme in themes {
        let t_path = PathBuf::from(&theme.path);
        if let Some(found_path) = find_icon_in_theme(&t_path, &icon_name) {
            let format = found_path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("png")
                .to_lowercase();
            if let Some(data) = file_to_data_uri(&found_path) {
                    matches.push(ThemeIconMatch {
                        theme_id: theme.id,
                        theme_name: theme.name,
                        icon_path: found_path.to_string_lossy().to_string(),
                        icon_format: format,
                        icon_data: data,
                        target_app_icon: Some(icon_name.clone()),
                    });
            }
        }
    }

    Ok(matches)
}

#[tauri::command]
fn get_current_desktop_theme() -> Result<String, String> {
    let output = std::process::Command::new("gsettings")
        .args(["get", "org.gnome.desktop.interface", "icon-theme"])
        .output();

    if let Ok(out) = output {
        if out.status.success() {
            let val = String::from_utf8_lossy(&out.stdout)
                .trim()
                .trim_matches('\'')
                .to_string();
            if !val.is_empty() {
                return Ok(val);
            }
        }
    }
    Ok("Adwaita".to_string())
}

#[tauri::command]
fn set_current_desktop_theme(theme_name: String) -> Result<String, String> {
    let output = std::process::Command::new("gsettings")
        .args(["set", "org.gnome.desktop.interface", "icon-theme", &theme_name])
        .output()
        .map_err(|e| format!("Failed to run gsettings: {}", e))?;

    if output.status.success() {
        Ok(format!("Theme applied: {}", theme_name))
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

// Generate mixed icon theme
#[tauri::command]
fn export_mixed_theme(
    target_theme_id: String,
    target_theme_name: String,
    base_theme_id: String,
    overrides: Vec<ThemeIconMatch>,
    apply_immediately: bool,
) -> Result<String, String> {
    let home = dirs::home_dir().ok_or_else(|| "Could not find home directory".to_string())?;
    let target_dir = home.join(".local/share/icons").join(&target_theme_id);

    // Create target dir and subdirs
    let scalable_dir = target_dir.join("scalable/apps");
    let fallback_dir = target_dir.join("256x256/apps");

    // Clean previous icons in this theme to ensure newly removed or updated icons take effect
    if scalable_dir.exists() {
        let _ = fs::remove_dir_all(&scalable_dir);
    }
    if fallback_dir.exists() {
        let _ = fs::remove_dir_all(&fallback_dir);
    }

    fs::create_dir_all(&scalable_dir)
        .map_err(|e| format!("Failed to create directory {:?}: {}", scalable_dir, e))?;
    fs::create_dir_all(&fallback_dir)
        .map_err(|e| format!("Failed to create directory {:?}: {}", fallback_dir, e))?;

    // Write index.theme
    let theme_content = format!(
r#"[Icon Theme]
Name={name}
Comment=Custom Icon Mixer theme based on {base}
Inherits={base},hicolor
Directories=scalable/apps,256x256/apps

[scalable/apps]
Size=128
Context=Applications
Type=Scalable
MinSize=16
MaxSize=512

[256x256/apps]
Size=256
Context=Applications
Type=Threshold
"#,
        name = target_theme_name,
        base = base_theme_id
    );

    let index_file = target_dir.join("index.theme");
    fs::write(&index_file, theme_content)
        .map_err(|e| format!("Failed to write index.theme: {}", e))?;

    // Copy each override icon
    let mut copied_count = 0;
    for ov in &overrides {
        let src_path = PathBuf::from(&ov.icon_path);
        if !src_path.exists() {
            continue;
        }

        let file_name = src_path
            .file_name()
            .ok_or_else(|| "Invalid icon path".to_string())?;

        let dest = if ov.icon_format == "svg" {
            scalable_dir.join(file_name)
        } else {
            fallback_dir.join(file_name)
        };

        if let Err(e) = fs::copy(&src_path, &dest) {
            eprintln!("Failed to copy icon from {:?} to {:?}: {}", src_path, dest, e);
        } else {
            copied_count += 1;
        }

        // Also copy under target_app_icon if different (e.g. brave-browser.desktop expects brave-desktop or brave-browser)
        if let Some(ref target_icon) = ov.target_app_icon {
            let target_file_name = format!("{}.{}", target_icon, ov.icon_format);
            if target_file_name != file_name.to_string_lossy() {
                let alias_dest = if ov.icon_format == "svg" {
                    scalable_dir.join(&target_file_name)
                } else {
                    fallback_dir.join(&target_file_name)
                };
                let _ = fs::copy(&src_path, &alias_dest);
            }
        }
    }

    // Update gtk icon cache if gtk-update-icon-cache exists
    let _ = std::process::Command::new("gtk-update-icon-cache")
        .args(["-f", "-t", target_dir.to_str().unwrap()])
        .output();

    if apply_immediately {
        // Force GNOME / GTK to invalidate its in-memory icon cache by toggling theme
        let _ = set_current_desktop_theme("hicolor".to_string());
        std::thread::sleep(std::time::Duration::from_millis(150));
        let _ = set_current_desktop_theme(target_theme_id.clone());
    }

    Ok(format!(
        "Mixed theme '{}' generated successfully at {:?} with {} custom icons!",
        target_theme_name, target_dir, copied_count
    ))
}

// Direct desktop file override feature:
// Copies the desktop file to ~/.local/share/applications/ and edits Icon=...
#[tauri::command]
fn override_single_app_icon(
    desktop_file_name: String,
    new_icon_path: String,
) -> Result<String, String> {
    let home = dirs::home_dir().ok_or_else(|| "Could not find home directory".to_string())?;
    let user_apps_dir = home.join(".local/share/applications");
    fs::create_dir_all(&user_apps_dir)
        .map_err(|e| format!("Failed to create user apps directory: {}", e))?;

    let dest_file = user_apps_dir.join(&desktop_file_name);

    // Find original desktop file
    let mut source_file = None;
    for dir in get_app_search_dirs() {
        let candidate = dir.join(&desktop_file_name);
        if candidate.exists() {
            source_file = Some(candidate);
            break;
        }
    }

    let source = source_file.ok_or_else(|| format!("Desktop file {} not found", desktop_file_name))?;

    let content = fs::read_to_string(&source)
        .map_err(|e| format!("Failed to read source desktop file: {}", e))?;

    let mut new_lines = Vec::new();
    let mut replaced = false;

    for line in content.lines() {
        if line.starts_with("Icon=") {
            new_lines.push(format!("Icon={}", new_icon_path));
            replaced = true;
        } else {
            new_lines.push(line.to_string());
        }
    }

    if !replaced {
        new_lines.push(format!("Icon={}", new_icon_path));
    }

    let updated_content = new_lines.join("\n");
    fs::write(&dest_file, updated_content)
        .map_err(|e| format!("Failed to write override desktop file: {}", e))?;

    // Update desktop database if available
    let _ = std::process::Command::new("update-desktop-database")
        .arg(user_apps_dir.to_str().unwrap())
        .output();

    Ok(format!("Updated desktop entry for {}", desktop_file_name))
}

// Restore original app icon by removing ~/.local/share/applications/<name>.desktop
#[tauri::command]
fn restore_single_app_icon(desktop_file_name: String) -> Result<String, String> {
    let home = dirs::home_dir().ok_or_else(|| "Could not find home directory".to_string())?;
    let user_app_file = home.join(".local/share/applications").join(&desktop_file_name);

    if user_app_file.exists() {
        fs::remove_file(&user_app_file)
            .map_err(|e| format!("Failed to remove override file: {}", e))?;

        let _ = std::process::Command::new("update-desktop-database")
            .arg(home.join(".local/share/applications").to_str().unwrap())
            .output();

        Ok(format!("Restored default icon for {}", desktop_file_name))
    } else {
        Ok("App already uses system default icon".to_string())
    }
}

// Load existing mixed theme overrides and base theme from index.theme and its files
#[tauri::command]
fn load_mixed_theme_overrides(theme_id: String) -> Result<MixProfile, String> {
    let home = dirs::home_dir().ok_or_else(|| "Could not find home directory".to_string())?;
    let target_dir = home.join(".local/share/icons").join(&theme_id);

    if !target_dir.exists() {
        return Err(format!("Theme directory {:?} does not exist", target_dir));
    }

    let index_file = target_dir.join("index.theme");
    let ini = parse_ini_file(&index_file);
    let sec = ini.get("Icon Theme").ok_or_else(|| "Not a valid icon theme".to_string())?;

    let name = sec.get("Name").cloned().unwrap_or_else(|| theme_id.clone());
    let inherits = sec.get("Inherits").cloned().unwrap_or_default();
    let base_theme = inherits
        .split(',')
        .next()
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "hicolor".to_string());

    let mut overrides: HashMap<String, AppOverride> = HashMap::new();

    // Check scalable/apps and 256x256/apps
    for sub in &["scalable/apps", "256x256/apps"] {
        let sub_dir = target_dir.join(sub);
        if sub_dir.exists() {
            if let Ok(entries) = fs::read_dir(&sub_dir) {
                for e in entries.flatten() {
                    let p = e.path();
                    if p.is_file() {
                        if let Some(stem) = p.file_stem().and_then(|s| s.to_str()) {
                            overrides.insert(
                                stem.to_string(),
                                AppOverride {
                                    source_theme: theme_id.clone(),
                                    icon_name: stem.to_string(),
                                    icon_path: p.to_string_lossy().to_string(),
                                },
                            );
                        }
                    }
                }
            }
        }
    }

    Ok(MixProfile {
        target_theme_name: name,
        base_theme,
        overrides,
    })
}

// Delete custom mixed theme
#[tauri::command]
fn delete_mixed_theme(theme_id: String) -> Result<String, String> {
    let home = dirs::home_dir().ok_or_else(|| "Could not find home directory".to_string())?;
    let target_dir = home.join(".local/share/icons").join(&theme_id);

    if target_dir.exists() {
        // Safety check: ensure it is a Custom Icon Mixer theme before deleting
        let index_file = target_dir.join("index.theme");
        if index_file.exists() {
            let content = fs::read_to_string(&index_file).unwrap_or_default();
            if content.contains("Custom Icon Mixer theme") {
                fs::remove_dir_all(&target_dir)
                    .map_err(|e| format!("Failed to delete theme: {}", e))?;
                return Ok(format!("Theme '{}' deleted successfully", theme_id));
            }
        }
        return Err("Only custom Icon Mixer themes can be deleted".to_string());
    }
    Err("Theme directory not found".to_string())
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            list_icon_themes,
            list_applications,
            resolve_app_icon,
            find_icons_in_all_themes,
            get_current_desktop_theme,
            set_current_desktop_theme,
            export_mixed_theme,
            load_mixed_theme_overrides,
            delete_mixed_theme,
            override_single_app_icon,
            restore_single_app_icon
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_parse_ini_file_valid() {
        let temp_dir = std::env::temp_dir().join("icon_mixer_test_ini");
        let _ = fs::create_dir_all(&temp_dir);
        let file_path = temp_dir.join("test.theme");
        
        let content = r#"
# Comment
[Icon Theme]
Name=My Super Theme
Comment=A lovely theme
Inherits=Papirus,hicolor

[scalable/apps]
Size=128
Context=Applications
"#;
        fs::write(&file_path, content).unwrap();

        let parsed = parse_ini_file(&file_path);
        let sec = parsed.get("Icon Theme").expect("Should find [Icon Theme]");
        assert_eq!(sec.get("Name").unwrap(), "My Super Theme");
        assert_eq!(sec.get("Comment").unwrap(), "A lovely theme");
        assert_eq!(sec.get("Inherits").unwrap(), "Papirus,hicolor");

        let sec_apps = parsed.get("scalable/apps").expect("Should find [scalable/apps]");
        assert_eq!(sec_apps.get("Size").unwrap(), "128");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_file_to_data_uri_svg_and_png() {
        let temp_dir = std::env::temp_dir().join("icon_mixer_test_uri");
        let _ = fs::create_dir_all(&temp_dir);

        let svg_path = temp_dir.join("sample.svg");
        fs::write(&svg_path, "<svg><circle cx='5' cy='5' r='5'/></svg>").unwrap();

        let uri = file_to_data_uri(&svg_path);
        assert!(uri.is_some());
        let uri_str = uri.unwrap();
        assert!(uri_str.starts_with("data:image/svg+xml;base64,"));

        let non_existent = temp_dir.join("missing.png");
        assert!(file_to_data_uri(&non_existent).is_none());

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_list_icon_themes_system() {
        let themes = list_icon_themes();
        assert!(themes.is_ok());
        let list = themes.unwrap();
        // Almost all Linux systems have at least hicolor or default icon packs
        assert!(!list.is_empty(), "Should discover at least 1 icon theme on Linux");
        for t in &list {
            assert!(!t.id.is_empty());
            assert!(!t.path.is_empty());
        }
    }

    #[test]
    fn test_list_applications_system() {
        let apps = list_applications();
        assert!(apps.is_ok());
        let list = apps.unwrap();
        // Any Linux desktop installation has .desktop files
        assert!(!list.is_empty(), "Should discover installed .desktop applications");
        for a in &list {
            assert!(!a.name.is_empty());
            assert!(!a.icon_name.is_empty());
        }
    }

    #[test]
    fn test_find_icon_in_theme() {
        let search_dirs = get_icon_search_dirs();
        let mut existing_theme_path = None;
        for d in &search_dirs {
            for t_name in &["hicolor", "Adwaita", "Papirus", "Tela", "breeze"] {
                let candidate = d.join(t_name);
                if candidate.exists() {
                    existing_theme_path = Some(candidate);
                    break;
                }
            }
            if existing_theme_path.is_some() {
                break;
            }
        }

        if let Some(path) = existing_theme_path {
            // Test lookup helper does not crash and returns Option
            let _res = find_icon_in_theme(&path, "system-search");
        }
    }

    #[test]
    fn test_export_mixed_theme_generation() {
        let temp_theme_id = "test-icon-mixer-temp";
        let temp_theme_name = "Test Icon Mixer Theme";
        let base_theme = "hicolor";

        let sample_svg = std::env::temp_dir().join("test_icon_source.svg");
        fs::write(&sample_svg, "<svg></svg>").unwrap();

        let sample_match = ThemeIconMatch {
            theme_id: "test".to_string(),
            theme_name: "Test".to_string(),
            icon_path: sample_svg.to_string_lossy().to_string(),
            icon_format: "svg".to_string(),
            icon_data: "data:image/svg+xml;base64,...".to_string(),
            target_app_icon: Some("test_icon_source".to_string()),
        };

        let result = export_mixed_theme(
            temp_theme_id.to_string(),
            temp_theme_name.to_string(),
            base_theme.to_string(),
            vec![sample_match],
            false, // do not apply to desktop during unit test
        );

        assert!(result.is_ok());

        // Verify generated theme structure in ~/.local/share/icons
        let home = dirs::home_dir().unwrap();
        let target_dir = home.join(".local/share/icons").join(temp_theme_id);
        assert!(target_dir.exists());
        assert!(target_dir.join("index.theme").exists());
        assert!(target_dir.join("scalable/apps/test_icon_source.svg").exists());

        // Cleanup
        let _ = fs::remove_dir_all(&target_dir);
        let _ = fs::remove_file(&sample_svg);
    }
}

