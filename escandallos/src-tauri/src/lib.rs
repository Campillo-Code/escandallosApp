mod db;

use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ========================================
// MODELOS
// ========================================

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Proveedor {
    pub id: i64,
    pub nombre: String,
    pub contacto: Option<String>,
    pub telefono: Option<String>,
    pub email: Option<String>,
    pub direccion: Option<String>,
    pub notas: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ProveedorInput {
    pub nombre: String,
    pub contacto: Option<String>,
    pub telefono: Option<String>,
    pub email: Option<String>,
    pub direccion: Option<String>,
    pub notas: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Ingrediente {
    pub id: i64,
    pub nombre: String,
    pub unidad_base: String,
    pub categoria: Option<String>,
    pub alergenos: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct IngredienteInput {
    pub nombre: String,
    pub unidad_base: String,
    pub categoria: Option<String>,
    pub alergenos: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Receta {
    pub id: i64,
    pub nombre: String,
    pub descripcion: Option<String>,
    pub categoria: Option<String>,
    pub porciones: i32,
    pub tiempo_preparacion: Option<i32>,
    pub es_base: bool,
}

#[derive(Debug, Deserialize)]
pub struct RecetaInput {
    pub nombre: String,
    pub descripcion: Option<String>,
    pub categoria: Option<String>,
    pub porciones: Option<i32>,
    pub tiempo_preparacion: Option<i32>,
    pub es_base: Option<bool>,
}

// ========================================
// PROVEEDORES
// ========================================

#[tauri::command]
async fn get_proveedores() -> Result<Vec<Proveedor>, String> {
    let pool = db::get_pool();
    let rows: Vec<Proveedor> = sqlx::query_as("SELECT id, nombre, contacto, telefono, email, direccion, notas FROM proveedores ORDER BY nombre")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
async fn create_proveedor(input: ProveedorInput) -> Result<i64, String> {
    let pool = db::get_pool();
    let result = sqlx::query(
        "INSERT INTO proveedores (nombre, contacto, telefono, email, direccion, notas) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&input.nombre)
    .bind(&input.contacto)
    .bind(&input.telefono)
    .bind(&input.email)
    .bind(&input.direccion)
    .bind(&input.notas)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(result.last_insert_id() as i64)
}

#[tauri::command]
async fn update_proveedor(id: i64, input: ProveedorInput) -> Result<(), String> {
    let pool = db::get_pool();
    sqlx::query(
        "UPDATE proveedores SET nombre = ?, contacto = ?, telefono = ?, email = ?, direccion = ?, notas = ? WHERE id = ?"
    )
    .bind(&input.nombre)
    .bind(&input.contacto)
    .bind(&input.telefono)
    .bind(&input.email)
    .bind(&input.direccion)
    .bind(&input.notas)
    .bind(id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn delete_proveedor(id: i64) -> Result<(), String> {
    let pool = db::get_pool();
    sqlx::query("DELETE FROM proveedores WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ========================================
// INGREDIENTES
// ========================================

#[tauri::command]
async fn get_ingredientes() -> Result<Vec<Ingrediente>, String> {
    let pool = db::get_pool();
    let rows: Vec<Ingrediente> = sqlx::query_as("SELECT id, nombre, unidad_base, categoria, alergenos FROM ingredientes ORDER BY nombre")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
async fn create_ingrediente(input: IngredienteInput) -> Result<i64, String> {
    let pool = db::get_pool();
    let result = sqlx::query(
        "INSERT INTO ingredientes (nombre, unidad_base, categoria, alergenos) VALUES (?, ?, ?, ?)"
    )
    .bind(&input.nombre)
    .bind(&input.unidad_base)
    .bind(&input.categoria)
    .bind(&input.alergenos)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(result.last_insert_id() as i64)
}

#[tauri::command]
async fn update_ingrediente(id: i64, input: IngredienteInput) -> Result<(), String> {
    let pool = db::get_pool();
    sqlx::query(
        "UPDATE ingredientes SET nombre = ?, unidad_base = ?, categoria = ?, alergenos = ? WHERE id = ?"
    )
    .bind(&input.nombre)
    .bind(&input.unidad_base)
    .bind(&input.categoria)
    .bind(&input.alergenos)
    .bind(id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn delete_ingrediente(id: i64) -> Result<(), String> {
    let pool = db::get_pool();
    sqlx::query("DELETE FROM ingredientes WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ========================================
// RECETAS
// ========================================

#[tauri::command]
async fn get_recetas() -> Result<Vec<Receta>, String> {
    let pool = db::get_pool();
    let rows: Vec<Receta> = sqlx::query_as("SELECT id, nombre, descripcion, categoria, porciones, tiempo_preparacion, es_base FROM recetas ORDER BY nombre")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
async fn create_receta(input: RecetaInput) -> Result<i64, String> {
    let pool = db::get_pool();
    let result = sqlx::query(
        "INSERT INTO recetas (nombre, descripcion, categoria, porciones, tiempo_preparacion, es_base) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&input.nombre)
    .bind(&input.descripcion)
    .bind(&input.categoria)
    .bind(input.porciones.unwrap_or(1))
    .bind(input.tiempo_preparacion)
    .bind(input.es_base.unwrap_or(false))
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(result.last_insert_id() as i64)
}

#[tauri::command]
async fn update_receta(id: i64, input: RecetaInput) -> Result<(), String> {
    let pool = db::get_pool();
    sqlx::query(
        "UPDATE recetas SET nombre = ?, descripcion = ?, categoria = ?, porciones = ?, tiempo_preparacion = ?, es_base = ? WHERE id = ?"
    )
    .bind(&input.nombre)
    .bind(&input.descripcion)
    .bind(&input.categoria)
    .bind(input.porciones.unwrap_or(1))
    .bind(input.tiempo_preparacion)
    .bind(input.es_base.unwrap_or(false))
    .bind(id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn delete_receta(id: i64) -> Result<(), String> {
    let pool = db::get_pool();
    sqlx::query("DELETE FROM recetas WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ========================================
// INGREDIENTES DE RECETA
// ========================================

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct RecetaIngrediente {
    pub id: i64,
    pub receta_id: i64,
    pub ingrediente_id: Option<i64>,
    pub sub_receta_id: Option<i64>,
    pub cantidad: f64,
    pub unidad: String,
    pub merma_porcentaje: f64,
    pub notas: Option<String>,
    pub orden: i32,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct RecetaIngredienteConNombre {
    pub id: i64,
    pub receta_id: i64,
    pub ingrediente_id: Option<i64>,
    pub ingrediente_nombre: Option<String>,
    pub sub_receta_id: Option<i64>,
    pub cantidad: f64,
    pub unidad: String,
    pub merma_porcentaje: f64,
    pub notas: Option<String>,
    pub orden: i32,
}

#[derive(Debug, Deserialize)]
pub struct RecetaIngredienteInput {
    pub receta_id: i64,
    pub ingrediente_id: Option<i64>,
    pub sub_receta_id: Option<i64>,
    pub cantidad: f64,
    pub unidad: String,
    pub merma_porcentaje: Option<f64>,
    pub notas: Option<String>,
    pub orden: Option<i32>,
}

#[tauri::command]
async fn get_receta_ingredientes(receta_id: i64) -> Result<Vec<RecetaIngredienteConNombre>, String> {
    let pool = db::get_pool();
    let rows: Vec<RecetaIngredienteConNombre> = sqlx::query_as(
        "SELECT ri.id, ri.receta_id, ri.ingrediente_id, i.nombre AS ingrediente_nombre, ri.sub_receta_id, CAST(ri.cantidad AS DOUBLE) AS cantidad, ri.unidad, CAST(ri.merma_porcentaje AS DOUBLE) AS merma_porcentaje, ri.notas, ri.orden FROM receta_ingredientes ri LEFT JOIN ingredientes i ON ri.ingrediente_id = i.id WHERE ri.receta_id = ? ORDER BY ri.orden"
    )
    .bind(receta_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
async fn add_receta_ingrediente(input: RecetaIngredienteInput) -> Result<i64, String> {
    let pool = db::get_pool();
    let result = sqlx::query(
        "INSERT INTO receta_ingredientes (receta_id, ingrediente_id, sub_receta_id, cantidad, unidad, merma_porcentaje, notas, orden) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(input.receta_id)
    .bind(input.ingrediente_id)
    .bind(input.sub_receta_id)
    .bind(input.cantidad)
    .bind(&input.unidad)
    .bind(input.merma_porcentaje.unwrap_or(0.0))
    .bind(&input.notas)
    .bind(input.orden.unwrap_or(0))
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(result.last_insert_id() as i64)
}

#[tauri::command]
async fn delete_receta_ingrediente(id: i64) -> Result<(), String> {
    let pool = db::get_pool();
    sqlx::query("DELETE FROM receta_ingredientes WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ========================================
// INICIO
// ========================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|_app| {
            tauri::async_runtime::spawn(async {
                if let Err(e) = db::init_db().await {
                    eprintln!("Error connecting to database: {}", e);
                } else {
                    println!("Database connected successfully!");
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_proveedores,
            create_proveedor,
            update_proveedor,
            delete_proveedor,
            get_ingredientes,
            create_ingrediente,
            update_ingrediente,
            delete_ingrediente,
            get_recetas,
            create_receta,
            update_receta,
            delete_receta,
            get_receta_ingredientes,
            add_receta_ingrediente,
            delete_receta_ingrediente,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
