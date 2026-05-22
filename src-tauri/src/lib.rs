use tauri::Manager;
use std::fs;
use std::path::PathBuf;

#[derive(serde::Serialize)]
struct VideoFile {
    name: String,
    path: String,
    size: u64,
    extension: String,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn scan_videos(app: tauri::AppHandle) -> Result<Vec<VideoFile>, String> {
    let mut videos = Vec::new();
    
    // Scan Videos directory
    if let Ok(video_dir) = app.path().video_dir() {
        if video_dir.exists() && video_dir.is_dir() {
            let _ = scan_directory(&video_dir, &mut videos);
        }
    }

    // Scan Downloads directory to be thorough
    if let Ok(downloads_dir) = app.path().download_dir() {
        if downloads_dir.exists() && downloads_dir.is_dir() {
            let mut downloads_videos = Vec::new();
            if scan_directory(&downloads_dir, &mut downloads_videos).is_ok() {
                // Limit to 15 files from downloads to prevent overwhelming lists
                videos.extend(downloads_videos.into_iter().take(15));
            }
        }
    }
    
    Ok(videos)
}

fn scan_directory(dir: &PathBuf, list: &mut Vec<VideoFile>) -> Result<(), String> {
    let entries = fs::read_dir(dir).map_err(|e| e.to_string())?;
    let valid_extensions = vec!["mp4", "mkv", "webm", "ogg", "avi", "mov", "3gp", "flv"];

    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    let ext_lower = ext.to_lowercase();
                    if valid_extensions.contains(&ext_lower.as_str()) {
                        if let Ok(metadata) = entry.metadata() {
                            let name = path.file_name()
                                .and_then(|n| n.to_str())
                                .unwrap_or("Unknown Video")
                                .to_string();
                            
                            list.push(VideoFile {
                                name,
                                path: path.to_string_lossy().to_string(),
                                size: metadata.len(),
                                extension: ext_lower,
                            });
                        }
                    }
                }
            }
        }
    }
    Ok(())
}

async fn check_and_update(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    use tauri_plugin_updater::UpdaterExt;

    if let Some(update) = app.updater()?.check().await? {
        update.download_and_install(|_chunk_received, _content_length| {}, || {}).await?;
        app.restart();
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let _ = check_and_update(&handle).await;
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet, scan_videos])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
