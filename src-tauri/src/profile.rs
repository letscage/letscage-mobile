use rusqlite::{Connection};
use uuid::Uuid;
use std::fs as std_fs;
use tauri::{AppHandle, Emitter};
use std::io::{self, Result};
use tokio::fs;
use tokio::time::{self, Duration};

pub struct ProfileInfo {
    pub id: String,
    pub nickname: String,
}

pub async fn profiler_setter(app: AppHandle, config_path: String) {
    let mut interval = time::interval(Duration::from_secs(3));

    loop {
        interval.tick().await;
        
        if let Ok(addr) = read_tor_addr_from_file(Some(config_path.clone())).await {
            let _ = app.emit("profile", addr);
        }
    }
}

pub async fn read_tor_addr_from_file(path: Option<String>) -> Result<String> {
    let file_path = format!(
        "{}/onion_addr.txt",
        path.unwrap()
    );

    let onion_addr = fs::read_to_string(file_path).await?;
    Ok(onion_addr)
}


pub fn write_tor_addr_to_file(path: String, onion_addr: String) -> Result<()> {
    let file_path = format!(
        "{}/onion_addr.txt",
        path.clone()
    );
    
    std_fs::write(file_path, onion_addr)?;

    Ok(())
}


pub fn get_or_create_profile(path: String) -> ProfileInfo {
    let db_path = format!(
        "{}/letscage.db",
        path.clone()
    );

    log::info!("DB path is: {}", db_path);

    let conn = Connection::open(&db_path).expect("Failed to open database");

    // Create table if not exists
    conn.execute(
        "CREATE TABLE IF NOT EXISTS profile (
            id TEXT PRIMARY KEY,
            nickname TEXT NOT NULL
        )",
        [],
    )
    .expect("Failed to create table");

    // Try to get existing profile
    let profile = conn
        .query_row(
            "SELECT id, nickname FROM profile LIMIT 1",
            [],
            |row| {
                Ok(ProfileInfo {
                    id: row.get(0)?,
                    nickname: row.get(1)?,
                })
            },
        );

    match profile {
        Ok(profile) => profile,
        Err(_) => {
            // Create new profile
            let new_profile = ProfileInfo {
                id: Uuid::new_v4().to_string(),
                nickname: format!("{}", Uuid::new_v4().to_string()),
            };

            conn.execute(
                "INSERT INTO profile (id, nickname) VALUES (?1, ?2)",
                [&new_profile.id, &new_profile.nickname],
            )
            .expect("Failed to insert profile");

            new_profile
        }
    }
}