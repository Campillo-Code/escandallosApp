use serde::{Deserialize, Serialize};
use sqlx::mysql::MySqlPool;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

static DB_POOL: Mutex<Option<MySqlPool>> = Mutex::new(None);
static CONFIG_PATH: Mutex<Option<PathBuf>> = Mutex::new(None);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbConfig {
    pub id: String,
    pub nombre: String,
    pub host: String,
    pub puerto: u16,
    pub usuario: String,
    pub password: String,
    pub base_datos: String,
    pub activa: bool,
}

fn get_configs_path() -> PathBuf {
    let lock = CONFIG_PATH.lock().unwrap();
    lock.clone().expect("CONFIG_PATH not initialized")
}

fn load_configs() -> Vec<DbConfig> {
    let path = get_configs_path();
    if !path.exists() {
        return vec![];
    }
    let data = fs::read_to_string(&path).unwrap_or_default();
    serde_json::from_str(&data).unwrap_or_default()
}

fn save_configs(configs: &[DbConfig]) {
    let path = get_configs_path();
    let data = serde_json::to_string_pretty(configs).unwrap();
    fs::write(&path, data).ok();
}

pub fn init_config_path(config_dir: PathBuf) {
    let path = config_dir.join("db_configs.json");
    *CONFIG_PATH.lock().unwrap() = Some(path);
}

fn build_url(c: &DbConfig) -> String {
    format!("mysql://{}:{}@{}:{}/{}", c.usuario, c.password, c.host, c.puerto, c.base_datos)
}

pub fn build_url_public(c: &DbConfig) -> String {
    build_url(c)
}

pub async fn init_db() -> Result<(), sqlx::Error> {
    let configs = load_configs();
    let active = configs.iter().find(|c| c.activa);
    let url = match active {
        Some(c) => build_url(c),
        None => "mysql://campillo:mayo1500@192.168.1.151:3306/escandallos_db".to_string(),
    };
    let pool = MySqlPool::connect(&url).await?;
    *DB_POOL.lock().unwrap() = Some(pool);
    Ok(())
}

pub async fn switch_db(config: &DbConfig) -> Result<(), sqlx::Error> {
    let url = build_url(config);
    let pool = MySqlPool::connect(&url).await?;
    *DB_POOL.lock().unwrap() = Some(pool);
    Ok(())
}

pub fn get_pool() -> MySqlPool {
    DB_POOL.lock().unwrap().clone().expect("Database pool not initialized")
}

pub fn get_all_configs() -> Vec<DbConfig> {
    load_configs()
}

pub fn add_config(config: DbConfig) -> Vec<DbConfig> {
    let mut configs = load_configs();
    if config.activa {
        for c in configs.iter_mut() {
            c.activa = false;
        }
    }
    configs.push(config);
    save_configs(&configs);
    configs
}

pub fn update_config(updated: DbConfig) -> Vec<DbConfig> {
    let mut configs = load_configs();
    if updated.activa {
        for c in configs.iter_mut() {
            c.activa = false;
        }
    }
    if let Some(c) = configs.iter_mut().find(|c| c.id == updated.id) {
        *c = updated;
    }
    save_configs(&configs);
    configs
}

pub fn delete_config(id: &str) -> Vec<DbConfig> {
    let mut configs = load_configs();
    configs.retain(|c| c.id != id);
    save_configs(&configs);
    configs
}

pub fn set_active(id: &str) -> Vec<DbConfig> {
    let mut configs = load_configs();
    for c in configs.iter_mut() {
        c.activa = c.id == id;
    }
    save_configs(&configs);
    configs
}
