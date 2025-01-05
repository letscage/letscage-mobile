use rusqlite::{Connection, Result};
use std::path::PathBuf;
use uuid::Uuid;
use std::fs;

pub struct ProfileInfo {
    pub id: String,
    pub nickname: String,
}

pub fn write_tor_addr_to_file(path: Option<PathBuf>, onion_addr: String) -> Result<()> {
    let file_path = format!(
        "{}/onion_addr.txt",
        path.as_ref().unwrap().to_str().unwrap()
    );
    
    fs::write(file_path, onion_addr);

    Ok(())
}


pub fn get_or_create_profile(path: Option<PathBuf>) -> ProfileInfo {
    let db_path = format!(
        "{}/letscage.db",
        path.as_ref().unwrap().to_str().unwrap()
    );

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