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
        Some(c) => {
            println!("[DB] Config activa encontrada: {}@{}:{}/{}", c.usuario, c.host, c.puerto, c.base_datos);
            build_url(c)
        }
        None => {
            println!("[DB] No hay config activa, usando fallback");
            "mysql://campillo:mayo1500@192.168.1.151:3306/escandallos_db".to_string()
        }
    };
    println!("[DB] Conectando a: {}", url.replace(&url[url.find("://").unwrap_or(0)+3..url.find("@").unwrap_or(url.len())], "***:***"));
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

    // Ensure receta_ingredientes table exists with correct structure
    let _ = sqlx::query("CREATE TABLE IF NOT EXISTS receta_ingredientes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        receta_id INT NOT NULL,
        ingrediente_id INT,
        sub_receta_id INT,
        cantidad DECIMAL(12,2) NOT NULL DEFAULT 0,
        unidad VARCHAR(20) NOT NULL DEFAULT 'g',
        merma_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 0,
        notas TEXT,
        orden INT DEFAULT 0,
        KEY idx_ri_receta (receta_id),
        KEY idx_ri_ingrediente (ingrediente_id),
        KEY idx_ri_subreceta (sub_receta_id)
    )").execute(pool).await;

    // Ensure orden column exists (for pre-existing tables)
    let check_orden: Option<(String,)> = sqlx::query_as(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'receta_ingredientes' AND COLUMN_NAME = 'orden'"
    ).fetch_optional(pool).await.unwrap_or(None);
    if check_orden.is_none() {
        let _ = sqlx::query("ALTER TABLE receta_ingredientes ADD COLUMN orden INT DEFAULT 0").execute(pool).await;
        println!("ALTER TABLE receta_ingredientes ADD orden completed");
    }

    // Fix NULL orden values for existing rows
    let _ = sqlx::query("UPDATE receta_ingredientes SET orden = 0 WHERE orden IS NULL").execute(pool).await;

    // CAJA: Create caja_categorias table
    let _ = sqlx::query("CREATE TABLE IF NOT EXISTS caja_categorias (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(50) NOT NULL,
        precio DECIMAL(10,2) NOT NULL DEFAULT 0,
        plus DECIMAL(10,2) NOT NULL DEFAULT 0,
        orden INT DEFAULT 0,
        activa BOOLEAN DEFAULT TRUE
    )").execute(pool).await;

    // CAJA: Create caja_tickets table
    let _ = sqlx::query("CREATE TABLE IF NOT EXISTS caja_tickets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        fecha DATE NOT NULL,
        hora TIME NOT NULL,
        total DECIMAL(10,2) NOT NULL DEFAULT 0,
        items JSON NOT NULL,
        notas TEXT,
        metodo_pago VARCHAR(20) DEFAULT 'efectivo',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_caja_fecha (fecha)
    )").execute(pool).await;

    // CAJA: Seed default categories if empty
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM caja_categorias")
        .fetch_one(pool).await.unwrap_or((0,));
    if count.0 == 0 {
        let defaults = vec![
            ("Primero", 8.00, 0.00, 1),
            ("Primero + Plus", 8.00, 2.50, 2),
            ("Segundo", 9.00, 0.00, 3),
            ("Segundo + Plus", 9.00, 2.50, 4),
            ("Ración", 7.00, 0.00, 5),
            ("Postre", 4.50, 0.00, 6),
            ("Menú", 12.00, 0.00, 7),
            ("Bebida", 2.00, 0.00, 8),
        ];
        for (nombre, precio, plus, orden) in defaults {
            let _ = sqlx::query("INSERT INTO caja_categorias (nombre, precio, plus, orden) VALUES (?, ?, ?, ?)")
                .bind(nombre).bind(precio).bind(plus).bind(orden)
                .execute(pool).await;
        }
        println!("Caja: default categories seeded");
    }

    // CAJA: Create caja_platos table
    let _ = sqlx::query("CREATE TABLE IF NOT EXISTS caja_platos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        categoria_id INT NOT NULL,
        receta_id INT NULL,
        nombre VARCHAR(100) NOT NULL,
        activo BOOLEAN DEFAULT TRUE,
        KEY idx_plato_categoria (categoria_id),
        KEY idx_plato_receta (receta_id)
    )").execute(pool).await;

    // CAJA: Add receta_id to caja_platos if not exists
    let check_receta: Option<(String,)> = sqlx::query_as(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'caja_platos' AND COLUMN_NAME = 'receta_id'"
    ).fetch_optional(pool).await.unwrap_or(None);
    if check_receta.is_none() {
        let _ = sqlx::query("ALTER TABLE caja_platos ADD COLUMN receta_id INT NULL AFTER categoria_id").execute(pool).await;
        let _ = sqlx::query("ALTER TABLE caja_platos ADD KEY idx_plato_receta (receta_id)").execute(pool).await;
        println!("ALTER TABLE caja_platos ADD receta_id completed");
    }

    // CAJA: Add metodo_pago to caja_tickets if not exists
    let check_mp: Option<(String,)> = sqlx::query_as(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'caja_tickets' AND COLUMN_NAME = 'metodo_pago'"
    ).fetch_optional(pool).await.unwrap_or(None);
    if check_mp.is_none() {
        let _ = sqlx::query("ALTER TABLE caja_tickets ADD COLUMN metodo_pago VARCHAR(20) DEFAULT 'efectivo' AFTER notas").execute(pool).await;
        println!("ALTER TABLE caja_tickets ADD metodo_pago completed");
    }

    // VENTAS: Add ticket_id to link ventas to caja_tickets
    let check_tid: Option<(String,)> = sqlx::query_as(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ventas' AND COLUMN_NAME = 'ticket_id'"
    ).fetch_optional(pool).await.unwrap_or(None);
    if check_tid.is_none() {
        let _ = sqlx::query("ALTER TABLE ventas ADD COLUMN ticket_id INT NULL AFTER id").execute(pool).await;
        println!("ALTER TABLE ventas ADD ticket_id completed");
    }

    let check_desc: Option<(String,)> = sqlx::query_as("SHOW COLUMNS FROM fichas_tecnicas LIKE 'descripcion'")
        .fetch_optional(pool).await.unwrap_or(None);
    if check_desc.is_none() {
        let _ = sqlx::query("ALTER TABLE fichas_tecnicas ADD COLUMN descripcion TEXT AFTER notas_adicionales").execute(pool).await;
        println!("ALTER TABLE fichas_tecnicas ADD descripcion completed");
    }

    let check_elab: Option<(String,)> = sqlx::query_as("SHOW COLUMNS FROM recetas LIKE 'elaboracion'")
        .fetch_optional(pool).await.unwrap_or(None);
    if check_elab.is_none() {
        let _ = sqlx::query("ALTER TABLE recetas ADD COLUMN elaboracion TEXT AFTER descripcion").execute(pool).await;
        println!("ALTER TABLE recetas ADD elaboracion completed");
    }

    let check_cons: Option<(String,)> = sqlx::query_as("SHOW COLUMNS FROM recetas LIKE 'conservacion'")
        .fetch_optional(pool).await.unwrap_or(None);
    if check_cons.is_none() {
        let _ = sqlx::query("ALTER TABLE recetas ADD COLUMN conservacion VARCHAR(255) AFTER elaboracion").execute(pool).await;
        println!("ALTER TABLE recetas ADD conservacion completed");
    }

    let check_regen: Option<(String,)> = sqlx::query_as("SHOW COLUMNS FROM recetas LIKE 'regeneracion'")
        .fetch_optional(pool).await.unwrap_or(None);
    if check_regen.is_none() {
        let _ = sqlx::query("ALTER TABLE recetas ADD COLUMN regeneracion VARCHAR(255) AFTER conservacion").execute(pool).await;
        println!("ALTER TABLE recetas ADD regeneracion completed");
    }

    let check_vida: Option<(String,)> = sqlx::query_as("SHOW COLUMNS FROM recetas LIKE 'vida_util'")
        .fetch_optional(pool).await.unwrap_or(None);
    if check_vida.is_none() {
        let _ = sqlx::query("ALTER TABLE recetas ADD COLUMN vida_util VARCHAR(255) AFTER regeneracion").execute(pool).await;
        println!("ALTER TABLE recetas ADD vida_util completed");
    }

    let check_peso: Option<(String,)> = sqlx::query_as("SHOW COLUMNS FROM recetas LIKE 'peso_por_racion'")
        .fetch_optional(pool).await.unwrap_or(None);
    if check_peso.is_none() {
        let _ = sqlx::query("ALTER TABLE recetas ADD COLUMN peso_por_racion DECIMAL(8,2) NULL AFTER margen_porcentaje").execute(pool).await;
        println!("ALTER TABLE recetas ADD peso_por_racion completed");
    }

    // Upgrade fotos columns from TEXT to MEDIUMTEXT for larger images
    let _ = sqlx::query("ALTER TABLE fichas_receta MODIFY COLUMN fotos MEDIUMTEXT NULL").execute(pool).await;
    let _ = sqlx::query("ALTER TABLE fichas_tecnicas MODIFY COLUMN fotos MEDIUMTEXT NULL").execute(pool).await;

    let _ = sqlx::query(
        "CREATE TABLE IF NOT EXISTS fichas_receta (
            id INT AUTO_INCREMENT PRIMARY KEY,
            receta_id INT NOT NULL,
            catalogado_en VARCHAR(255) NULL,
            fecha DATE NULL,
            fotos TEXT NULL,
            notas_adicionales TEXT NULL,
            FOREIGN KEY (receta_id) REFERENCES recetas(id) ON DELETE CASCADE
        )"
    ).execute(pool).await;

    // DESPIECE: Create despieces table (definition of how to break down an ingredient)
    let _ = sqlx::query(
        "CREATE TABLE IF NOT EXISTS despieces (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nombre VARCHAR(255) NOT NULL,
            ingrediente_entrada_id INT NOT NULL,
            cantidad_entrada DECIMAL(12,2) NOT NULL DEFAULT 1,
            unidad_entrada VARCHAR(20) NOT NULL,
            notas TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_desp_entrada (ingrediente_entrada_id)
        )"
    ).execute(pool).await;

    // DESPIECE: Create despiece_salidas table (output pieces from a breakdown)
    let _ = sqlx::query(
        "CREATE TABLE IF NOT EXISTS despiece_salidas (
            id INT AUTO_INCREMENT PRIMARY KEY,
            despiece_id INT NOT NULL,
            ingrediente_id INT NOT NULL,
            porcentaje DECIMAL(5,2),
            cantidad DECIMAL(12,2),
            unidad VARCHAR(20) NOT NULL DEFAULT 'g',
            notas TEXT,
            KEY idx_ds_despiece (despiece_id),
            KEY idx_ds_ingrediente (ingrediente_id)
        )"
    ).execute(pool).await;
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

pub fn get_pool_safe() -> Option<MySqlPool> {
    DB_POOL.lock().unwrap().clone()
}

pub fn is_connected() -> bool {
    DB_POOL.lock().unwrap().is_some()
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
