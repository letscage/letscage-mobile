use anyhow::Result;

#[cfg(target_os = "android")]
use jni::{
    objects::{JClass, JObject, JString},
    sys::jint,
    JNIEnv,
};

#[cfg(target_os = "android")]
use ndk::looper::ThreadLooper;
#[cfg(target_os = "android")]
use ndk_glue::native_activity;

use reqwest::Client;
use std::env;
use std::path::PathBuf;
use std::time::Duration;
use tauri::path::BaseDirectory;
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

//use tracing_subscriber::filter::LevelFilter;
use log::LevelFilter;

mod background;
pub use background::arti_start;

mod profile;
pub use profile::*;

use tauri::async_runtime::spawn;

pub fn start_android_service(app_config_path: &PathBuf) {
    use std::process::Command;

    // Define the package name and service class name
    let package_name = "com.letscage_mobile.app";
    let service_name = ".BackgroundService";

    // Build the shell command to start the service
    let mut cmd = Command::new("am");
    cmd.args(&[
        "start-foreground-service",
        "-n",
        &format!("{}/{}", package_name, service_name),
    ]);

    log::info!("Cmd is {:?}", cmd);

    match cmd.output() {
        Ok(output) => {
            if output.status.success() {
                log::info!(
                    "Service started successfully: {}",
                    String::from_utf8_lossy(&output.stdout)
                );
            } else {
                log::info!(
                    "Failed to start service: {}",
                    String::from_utf8_lossy(&output.stderr)
                );
            }
        }
        Err(e) => log::error!("Failed to execute command: {}", e),
    }
}

pub fn start_desktop_service(config_path: &PathBuf) {
    let config = config_path.clone();
    std::thread::spawn(|| perform_background_task(Some(config)));
}

pub fn perform_background_task(config_path: Option<PathBuf>) {
    let runtime = match tokio::runtime::Runtime::new() {
        Ok(rt) => rt,
        Err(e) => {
            log::error!("Failed to create Tokio runtime: {}", e);
            return;
        }
    };

    let handle = runtime.spawn(async {
        log::info!("Arti daemon is now starting...");
        let _ = arti_start(config_path).await;
    });

    // Keep runtime alive and monitor task
    runtime.block_on(async {
        if let Err(e) = handle.await {
            log::error!("Task failed: {}", e);
        }
    });
}


#[cfg(target_os = "android")]
#[no_mangle]
pub extern "C" fn Java_com_letscage_1mobile_app_BackgroundServiceNative_invokeRustBackgroundTask(
) -> jint {
    std::thread::spawn(|| perform_background_task(None));
    42 // Return an integer as an example
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
async fn send_message(to: String, msg: String, app_handle: tauri::AppHandle) -> Result<String, ()> {
    let binding = app_handle.path().app_data_dir().unwrap();
    let app_data_dir = binding.to_str().unwrap();
    log::info!("Tauri app data dir: {:?}", app_data_dir);
    let proxy = reqwest::Proxy::http("socks5h://127.0.0.1:9050").unwrap();
    let client = Client::builder()
        .proxy(proxy)
        .timeout(Duration::from_secs(120))
        .build()
        .unwrap();

    // Prepare JSON payload for POST
    let payload = serde_json::json!({
        "from": to,
        "content": msg
    });

    // Perform POST request to /message endpoint
    let post_url = format!("{}/message", format!("http://{}", to));
    let response = client
        .post(post_url)
        .json(&payload)
        .send()
        .await
        .map_err(|_| ())?;

    let body = response.text().await.map_err(|_| ())?;
    log::info!("Server response: {}", body);

    Ok(format!("Message posted to {}, with content '{}', response was: {}", to, msg, body))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create messages table",  
            sql: "CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, -- Unique identifier for each message
                    from_user TEXT NOT NULL,              -- Sender's identifier (could be user ID, email, etc.)
                    to_user TEXT NOT NULL,                -- Recipient's identifier
                    message_id TEXT UNIQUE NOT NULL,      -- Unique message ID (useful for external references)
                    content TEXT NOT NULL,                -- Message content
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, -- Timestamp of when the message was sent
                    unread BOOLEAN DEFAULT 1             -- Whether the message is unread (1 for unread, 0 for read)
                    )",  
            kind: MigrationKind::Up,
        }
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:letscage.db", migrations)
                .build(),
        )
        .plugin(
            tauri_plugin_log::Builder::new()
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::Stdout,
                ))
                .level(LevelFilter::Info)
                .build(),
        )
        .setup(|app| {
            let app_handle = app.handle().clone();
            let path = app.path().resolve("", BaseDirectory::AppConfig)?;
            log::info!("Path: {:?}", path);

            //ANDROID
            #[cfg(target_os = "android")]
            start_android_service(&path);

            //DESKTOP
            #[cfg(not(target_os = "android"))]
            start_desktop_service(&path);

            //spawn profiler_setter here
            // Spawn profiler_setter
            //tokio::spawn(async move {
            //    profiler_setter(&app_handle, path.clone()).await;
            ///});
            spawn(profiler_setter(app_handle, path.clone()));

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![send_message])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
