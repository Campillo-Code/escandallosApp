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
    *DB_POOL.lock().unwrap() = Some(pool.clone());
    run_migrations(&pool).await;
    Ok(())
}

async fn run_migrations(pool: &MySqlPool) {
    let migrations = [
        "CREATE TABLE IF NOT EXISTS lotes_ingredientes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            ingrediente_id INT NOT NULL,
            proveedor_id INT NOT NULL,
            numero_lote VARCHAR(100) NOT NULL,
            fecha_recepcion DATE NOT NULL,
            fecha_caducidad DATE,
            cantidad_recibida DECIMAL(12,2) NOT NULL DEFAULT 0,
            unidad VARCHAR(20) NOT NULL,
            albaran_id INT,
            notas TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_lotes_ingrediente (ingrediente_id),
            KEY idx_lotes_proveedor (proveedor_id),
            KEY idx_lotes_albaran (albaran_id),
            KEY idx_lotes_caducidad (fecha_caducidad)
        )",
        "CREATE TABLE IF NOT EXISTS produccion (
            id INT AUTO_INCREMENT PRIMARY KEY,
            receta_id INT NOT NULL,
            fecha_elaboracion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            cantidad_producida INT NOT NULL DEFAULT 1,
            lote_producto VARCHAR(100) NOT NULL,
            fecha_caducidad DATE,
            responsable VARCHAR(100),
            notas TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_produccion_receta (receta_id),
            KEY idx_produccion_lote (lote_producto),
            KEY idx_produccion_caducidad (fecha_caducidad)
        )",
        "CREATE TABLE IF NOT EXISTS produccion_detalle (
            id INT AUTO_INCREMENT PRIMARY KEY,
            produccion_id INT NOT NULL,
            lote_ingrediente_id INT NOT NULL,
            cantidad_utilizada DECIMAL(12,2) NOT NULL DEFAULT 0,
            KEY idx_pd_produccion (produccion_id),
            KEY idx_pd_lote (lote_ingrediente_id)
        )",
    ];
    for sql in &migrations {
        match sqlx::query(sql).execute(pool).await {
            Ok(_) => println!("Migration OK: {}", &sql[..40]),
            Err(e) => eprintln!("Migration info: {}", e),
        }
    }
    // Check if columns exist before ALTER
    let check: Option<(String,)> = sqlx::query_as(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'albaranes_detalle' AND COLUMN_NAME = 'numero_lote'"
    ).fetch_optional(pool).await.unwrap_or(None);
    if check.is_some() {
        println!("Columns already exist, skipping ALTER");
    } else {
        let _ = sqlx::query("ALTER TABLE albaranes_detalle ADD COLUMN numero_lote VARCHAR(100) AFTER precio_unitario").execute(pool).await;
        let _ = sqlx::query("ALTER TABLE albaranes_detalle ADD COLUMN fecha_caducidad DATE AFTER numero_lote").execute(pool).await;
        println!("ALTER TABLE albaranes_detalle completed");
    }

    // CAJA: Create caja_tickets table
    let _ = sqlx::query("CREATE TABLE IF NOT EXISTS caja_tickets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        fecha DATE NOT NULL,
        hora TIME NOT NULL,
        total DECIMAL(10,2) NOT NULL DEFAULT 0,
        items JSON NOT NULL,
        tipo_venta VARCHAR(50),
        notas TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_caja_fecha (fecha)
    )").execute(pool).await;

    // CAJA: Add codigo_caja to recetas if not exists
    let check_codigo: Option<(String,)> = sqlx::query_as(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'recetas' AND COLUMN_NAME = 'codigo_caja'"
    ).fetch_optional(pool).await.unwrap_or(None);
    if check_codigo.is_none() {
        let _ = sqlx::query("ALTER TABLE recetas ADD COLUMN codigo_caja VARCHAR(10) NULL AFTER margen_porcentaje").execute(pool).await;
        println!("ALTER TABLE recetas ADD codigo_caja completed");
    }
}

pub async fn switch_db(config: &DbConfig) -> Result<(), sqlx::Error> {
    let url = build_url(config);
    let pool = MySqlPool::connect(&url).await?;
    *DB_POOL.lock().unwrap() = Some(pool.clone());
    run_migrations(&pool).await;
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
