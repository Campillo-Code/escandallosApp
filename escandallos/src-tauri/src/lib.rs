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
    pub precio: Option<f64>,
    pub proveedor_nombre: Option<String>,
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
    pub precio_venta: Option<f64>,
    pub margen_porcentaje: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct RecetaInput {
    pub nombre: String,
    pub descripcion: Option<String>,
    pub categoria: Option<String>,
    pub porciones: Option<i32>,
    pub tiempo_preparacion: Option<i32>,
    pub es_base: Option<bool>,
    pub precio_venta: Option<f64>,
    pub margen_porcentaje: Option<f64>,
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
    let rows: Vec<Ingrediente> = sqlx::query_as(
        "SELECT i.id, i.nombre, i.unidad_base, i.categoria, i.alergenos, CAST(ip.precio_por_unidad_base AS DOUBLE) AS precio, p.nombre AS proveedor_nombre FROM ingredientes i LEFT JOIN ingrediente_precios ip ON i.id = ip.ingrediente_id AND ip.es_predeterminado = 1 LEFT JOIN proveedores p ON ip.proveedor_id = p.id ORDER BY i.nombre"
    )
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
    let rows: Vec<Receta> = sqlx::query_as("SELECT id, nombre, descripcion, categoria, porciones, tiempo_preparacion, es_base, CAST(precio_venta AS DOUBLE) AS precio_venta, CAST(margen_porcentaje AS DOUBLE) AS margen_porcentaje FROM recetas ORDER BY nombre")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
async fn create_receta(input: RecetaInput) -> Result<i64, String> {
    let pool = db::get_pool();
    let result = sqlx::query(
        "INSERT INTO recetas (nombre, descripcion, categoria, porciones, tiempo_preparacion, es_base, precio_venta, margen_porcentaje) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&input.nombre)
    .bind(&input.descripcion)
    .bind(&input.categoria)
    .bind(input.porciones.unwrap_or(1))
    .bind(input.tiempo_preparacion)
    .bind(input.es_base.unwrap_or(false))
    .bind(input.precio_venta)
    .bind(input.margen_porcentaje)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(result.last_insert_id() as i64)
}

#[tauri::command]
async fn update_receta(id: i64, input: RecetaInput) -> Result<(), String> {
    let pool = db::get_pool();
    sqlx::query(
        "UPDATE recetas SET nombre = ?, descripcion = ?, categoria = ?, porciones = ?, tiempo_preparacion = ?, es_base = ?, precio_venta = ?, margen_porcentaje = ? WHERE id = ?"
    )
    .bind(&input.nombre)
    .bind(&input.descripcion)
    .bind(&input.categoria)
    .bind(input.porciones.unwrap_or(1))
    .bind(input.tiempo_preparacion)
    .bind(input.es_base.unwrap_or(false))
    .bind(input.precio_venta)
    .bind(input.margen_porcentaje)
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
// ALERGENOS DE RECETA
// ========================================

#[tauri::command]
async fn get_receta_alergenos(receta_id: i64) -> Result<Vec<String>, String> {
    let pool = db::get_pool();
    let rows: Vec<(Option<String>,)> = sqlx::query_as(
        "SELECT DISTINCT i.alergenos FROM receta_ingredientes ri INNER JOIN ingredientes i ON ri.ingrediente_id = i.id WHERE ri.receta_id = ? AND i.alergenos IS NOT NULL AND i.alergenos != '' AND i.alergenos != '[]'"
    )
    .bind(receta_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut alergenos: Vec<String> = Vec::new();
    for row in rows {
        if let Some(json) = &row.0 {
            if let Ok(parsed) = serde_json::from_str::<Vec<String>>(json) {
                for a in parsed {
                    if !alergenos.contains(&a) {
                        alergenos.push(a);
                    }
                }
            }
        }
    }
    alergenos.sort();
    Ok(alergenos)
}

// ========================================
// CALCULO DE COSTES
// ========================================

#[derive(Debug, Serialize, Deserialize)]
pub struct CosteIngrediente {
    pub ingrediente_nombre: String,
    pub cantidad: f64,
    pub unidad: String,
    pub merma_porcentaje: f64,
    pub precio_unitario: Option<f64>,
    pub precio_por_unidad_receta: Option<f64>,
    pub coste: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CosteReceta {
    pub coste_total: f64,
    pub coste_porcion: f64,
    pub precio_venta: Option<f64>,
    pub food_cost_pct: Option<f64>,
    pub margen_porcentaje: Option<f64>,
    pub margen_real_pct: Option<f64>,
    pub precio_venta_sugerido: f64,
    pub ingredientes: Vec<CosteIngrediente>,
}

#[tauri::command]
async fn get_receta_coste(receta_id: i64) -> Result<CosteReceta, String> {
    let pool = db::get_pool();

    let receta: Receta = sqlx::query_as(
        "SELECT id, nombre, descripcion, categoria, porciones, tiempo_preparacion, es_base, CAST(precio_venta AS DOUBLE) AS precio_venta, CAST(margen_porcentaje AS DOUBLE) AS margen_porcentaje FROM recetas WHERE id = ?"
    )
    .bind(receta_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?
    .ok_or("Receta no encontrada".to_string())?;

    let rows: Vec<(i64, Option<i64>, String, f64, String, f64, String)> = sqlx::query_as(
        "SELECT ri.ingrediente_id, ri.ingrediente_id, i.nombre, CAST(ri.cantidad AS DOUBLE), ri.unidad, CAST(ri.merma_porcentaje AS DOUBLE), i.unidad_base FROM receta_ingredientes ri INNER JOIN ingredientes i ON ri.ingrediente_id = i.id WHERE ri.receta_id = ?"
    )
    .bind(receta_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut ingredientes: Vec<CosteIngrediente> = Vec::new();
    let mut coste_total: f64 = 0.0;

    for row in rows {
        let ingrediente_id = row.0;
        let nombre = row.2;
        let cantidad = row.3;
        let unidad = row.4;
        let merma = row.5;
        let unidad_base = row.6;

        let precio_row: Option<(f64,)> = sqlx::query_as(
            "SELECT CAST(precio_por_unidad_base AS DOUBLE) FROM ingrediente_precios WHERE ingrediente_id = ? AND es_predeterminado = 1 LIMIT 1"
        )
        .bind(ingrediente_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| e.to_string())?;

        let precio_unitario = precio_row.map(|r| r.0);

        // Convert quantity to base unit
        let cantidad_base = if unidad == unidad_base {
            cantidad
        } else if (unidad == "kg" && unidad_base == "g") || (unidad == "l" && unidad_base == "ml") {
            cantidad * 1000.0
        } else if (unidad == "g" && unidad_base == "kg") || (unidad == "ml" && unidad_base == "l") {
            cantidad / 1000.0
        } else {
            cantidad
        };

        let coste = if let Some(pu) = precio_unitario {
            let coste_base = cantidad_base * pu;
            coste_base * (1.0 + merma / 100.0)
        } else {
            0.0
        };

        coste_total += coste;

        // Calculate price per recipe unit (not base unit)
        let precio_por_unidad_receta = precio_unitario.map(|pu| {
            if (unidad == "kg" && unidad_base == "g") || (unidad == "l" && unidad_base == "ml") {
                pu * 1000.0
            } else if (unidad == "g" && unidad_base == "kg") || (unidad == "ml" && unidad_base == "l") {
                pu / 1000.0
            } else {
                pu
            }
        });

        ingredientes.push(CosteIngrediente {
            ingrediente_nombre: nombre,
            cantidad,
            unidad,
            merma_porcentaje: merma,
            precio_unitario,
            precio_por_unidad_receta,
            coste,
        });
    }

    let porciones = receta.porciones as f64;
    let coste_porcion = if porciones > 0.0 { coste_total / porciones } else { coste_total };

    let food_cost_pct = receta.precio_venta.map(|pv| {
        if pv > 0.0 { (coste_porcion / pv) * 100.0 } else { 0.0 }
    });

    let margen_real_pct = receta.precio_venta.map(|pv| {
        if pv > 0.0 { ((pv - coste_porcion) / pv) * 100.0 } else { 0.0 }
    });

    let precio_venta_sugerido = if let Some(margen) = receta.margen_porcentaje {
        if margen < 100.0 && margen >= 0.0 {
            coste_porcion / (1.0 - margen / 100.0)
        } else {
            coste_porcion * 2.0
        }
    } else {
        coste_porcion * 2.0
    };

    Ok(CosteReceta {
        coste_total,
        coste_porcion,
        precio_venta: receta.precio_venta,
        food_cost_pct,
        margen_porcentaje: receta.margen_porcentaje,
        margen_real_pct,
        precio_venta_sugerido,
        ingredientes,
    })
}

// ========================================
// MENUS
// ========================================

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Menu {
    pub id: i64,
    pub nombre: String,
    pub descripcion: Option<String>,
    pub tipo: Option<String>,
    pub activo: bool,
}

#[derive(Debug, Deserialize)]
pub struct MenuInput {
    pub nombre: String,
    pub descripcion: Option<String>,
    pub tipo: Option<String>,
    pub activo: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct MenuReceta {
    pub id: i64,
    pub menu_id: i64,
    pub receta_id: i64,
    pub receta_nombre: Option<String>,
    pub precio_venta: Option<f64>,
    pub orden: i32,
}

#[derive(Debug, Deserialize)]
pub struct MenuRecetaInput {
    pub menu_id: i64,
    pub receta_id: i64,
    pub precio_venta: Option<f64>,
    pub orden: Option<i32>,
}

#[tauri::command]
async fn get_menus() -> Result<Vec<Menu>, String> {
    let pool = db::get_pool();
    let rows: Vec<Menu> = sqlx::query_as("SELECT id, nombre, descripcion, tipo, activo FROM menus ORDER BY nombre")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
async fn create_menu(input: MenuInput) -> Result<i64, String> {
    let pool = db::get_pool();
    let result = sqlx::query(
        "INSERT INTO menus (nombre, descripcion, tipo, activo) VALUES (?, ?, ?, ?)"
    )
    .bind(&input.nombre)
    .bind(&input.descripcion)
    .bind(&input.tipo)
    .bind(input.activo.unwrap_or(true))
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(result.last_insert_id() as i64)
}

#[tauri::command]
async fn update_menu(id: i64, input: MenuInput) -> Result<(), String> {
    let pool = db::get_pool();
    sqlx::query(
        "UPDATE menus SET nombre = ?, descripcion = ?, tipo = ?, activo = ? WHERE id = ?"
    )
    .bind(&input.nombre)
    .bind(&input.descripcion)
    .bind(&input.tipo)
    .bind(input.activo.unwrap_or(true))
    .bind(id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn delete_menu(id: i64) -> Result<(), String> {
    let pool = db::get_pool();
    sqlx::query("DELETE FROM menus WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_menu_recetas(menu_id: i64) -> Result<Vec<MenuReceta>, String> {
    let pool = db::get_pool();
    let rows: Vec<MenuReceta> = sqlx::query_as(
        "SELECT mr.id, mr.menu_id, mr.receta_id, r.nombre AS receta_nombre, CAST(mr.precio_venta AS DOUBLE) AS precio_venta, mr.orden FROM menu_recetas mr INNER JOIN recetas r ON mr.receta_id = r.id WHERE mr.menu_id = ? ORDER BY mr.orden"
    )
    .bind(menu_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
async fn add_menu_receta(input: MenuRecetaInput) -> Result<i64, String> {
    let pool = db::get_pool();
    let result = sqlx::query(
        "INSERT INTO menu_recetas (menu_id, receta_id, precio_venta, orden) VALUES (?, ?, ?, ?)"
    )
    .bind(input.menu_id)
    .bind(input.receta_id)
    .bind(input.precio_venta)
    .bind(input.orden.unwrap_or(0))
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(result.last_insert_id() as i64)
}

#[tauri::command]
async fn delete_menu_receta(id: i64) -> Result<(), String> {
    let pool = db::get_pool();
    sqlx::query("DELETE FROM menu_recetas WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_menu_alergenos(menu_id: i64) -> Result<Vec<String>, String> {
    let pool = db::get_pool();
    let rows: Vec<(Option<String>,)> = sqlx::query_as(
        "SELECT DISTINCT i.alergenos FROM menu_recetas mr INNER JOIN receta_ingredientes ri ON mr.receta_id = ri.receta_id INNER JOIN ingredientes i ON ri.ingrediente_id = i.id WHERE mr.menu_id = ? AND i.alergenos IS NOT NULL AND i.alergenos != '' AND i.alergenos != '[]'"
    )
    .bind(menu_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut alergenos: Vec<String> = Vec::new();
    for row in rows {
        if let Some(json) = &row.0 {
            if let Ok(parsed) = serde_json::from_str::<Vec<String>>(json) {
                for a in parsed {
                    if !alergenos.contains(&a) {
                        alergenos.push(a);
                    }
                }
            }
        }
    }
    alergenos.sort();
    Ok(alergenos)
}

// ========================================
// ALBARANES
// ========================================

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Albaran {
    pub id: i64,
    pub proveedor_id: i64,
    pub proveedor_nombre: Option<String>,
    pub numero_albaran: Option<String>,
    pub fecha_recepcion: String,
    pub total: Option<f64>,
    pub notas: Option<String>,
    pub procesado: bool,
}

#[derive(Debug, Deserialize)]
pub struct AlbaranInput {
    pub proveedor_id: i64,
    pub numero_albaran: Option<String>,
    pub fecha_recepcion: String,
    pub total: Option<f64>,
    pub notas: Option<String>,
    pub procesado: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct AlbaranDetalle {
    pub id: i64,
    pub albaran_id: i64,
    pub ingrediente_id: i64,
    pub ingrediente_nombre: Option<String>,
    pub cantidad: f64,
    pub unidad: String,
    pub precio_unitario: f64,
    pub subtotal: Option<f64>,
    pub precio_anterior: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct AlbaranDetalleInput {
    pub albaran_id: i64,
    pub ingrediente_id: i64,
    pub cantidad: f64,
    pub unidad: String,
    pub precio_unitario: f64,
    pub subtotal: Option<f64>,
}

#[tauri::command]
async fn get_albaranes() -> Result<Vec<Albaran>, String> {
    let pool = db::get_pool();
    let rows: Vec<Albaran> = sqlx::query_as(
        "SELECT a.id, a.proveedor_id, p.nombre AS proveedor_nombre, a.numero_albaran, DATE_FORMAT(a.fecha_recepcion, '%Y-%m-%d') AS fecha_recepcion, CAST(a.total AS DOUBLE) AS total, a.notas, a.procesado FROM albaranes a INNER JOIN proveedores p ON a.proveedor_id = p.id ORDER BY a.fecha_recepcion DESC"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
async fn get_albaran(id: i64) -> Result<Albaran, String> {
    let pool = db::get_pool();
    let row: Albaran = sqlx::query_as(
        "SELECT a.id, a.proveedor_id, p.nombre AS proveedor_nombre, a.numero_albaran, DATE_FORMAT(a.fecha_recepcion, '%Y-%m-%d') AS fecha_recepcion, CAST(a.total AS DOUBLE) AS total, a.notas, a.procesado FROM albaranes a INNER JOIN proveedores p ON a.proveedor_id = p.id WHERE a.id = ?"
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "Albarán no encontrado".to_string())?;
    Ok(row)
}

#[tauri::command]
async fn create_albaran(input: AlbaranInput) -> Result<i64, String> {
    let pool = db::get_pool();
    let result = sqlx::query(
        "INSERT INTO albaranes (proveedor_id, numero_albaran, fecha_recepcion, total, notas, procesado) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(input.proveedor_id)
    .bind(&input.numero_albaran)
    .bind(&input.fecha_recepcion)
    .bind(input.total)
    .bind(&input.notas)
    .bind(input.procesado.unwrap_or(false))
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(result.last_insert_id() as i64)
}

#[tauri::command]
async fn update_albaran(id: i64, input: AlbaranInput) -> Result<(), String> {
    let pool = db::get_pool();
    sqlx::query(
        "UPDATE albaranes SET proveedor_id = ?, numero_albaran = ?, fecha_recepcion = ?, total = ?, notas = ?, procesado = ? WHERE id = ?"
    )
    .bind(input.proveedor_id)
    .bind(&input.numero_albaran)
    .bind(&input.fecha_recepcion)
    .bind(input.total)
    .bind(&input.notas)
    .bind(input.procesado.unwrap_or(false))
    .bind(id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn delete_albaran(id: i64) -> Result<(), String> {
    let pool = db::get_pool();
    sqlx::query("DELETE FROM albaranes WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_albaran_detalles(albaran_id: i64) -> Result<Vec<AlbaranDetalle>, String> {
    let pool = db::get_pool();
    let rows: Vec<AlbaranDetalle> = sqlx::query_as(
        "SELECT ad.id, ad.albaran_id, ad.ingrediente_id, i.nombre AS ingrediente_nombre, CAST(ad.cantidad AS DOUBLE) AS cantidad, ad.unidad, CAST(ad.precio_unitario AS DOUBLE) AS precio_unitario, CAST(ad.subtotal AS DOUBLE) AS subtotal, CAST(ad.precio_anterior AS DOUBLE) AS precio_anterior FROM albaranes_detalle ad INNER JOIN ingredientes i ON ad.ingrediente_id = i.id WHERE ad.albaran_id = ? ORDER BY ad.id"
    )
    .bind(albaran_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
async fn add_albaran_detalle(input: AlbaranDetalleInput) -> Result<i64, String> {
    let pool = db::get_pool();
    let result = sqlx::query(
        "INSERT INTO albaranes_detalle (albaran_id, ingrediente_id, cantidad, unidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(input.albaran_id)
    .bind(input.ingrediente_id)
    .bind(input.cantidad)
    .bind(&input.unidad)
    .bind(input.precio_unitario)
    .bind(input.subtotal)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(result.last_insert_id() as i64)
}

#[tauri::command]
async fn delete_albaran_detalle(id: i64) -> Result<(), String> {
    let pool = db::get_pool();
    sqlx::query("DELETE FROM albaranes_detalle WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn procesar_albaran(albaran_id: i64) -> Result<(), String> {
    let pool = db::get_pool();

    let proveedor_id: i64 = sqlx::query_scalar("SELECT proveedor_id FROM albaranes WHERE id = ?")
        .bind(albaran_id)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;

    let detalles: Vec<AlbaranDetalle> = sqlx::query_as(
        "SELECT ad.id, ad.albaran_id, ad.ingrediente_id, i.nombre AS ingrediente_nombre, CAST(ad.cantidad AS DOUBLE) AS cantidad, ad.unidad, CAST(ad.precio_unitario AS DOUBLE) AS precio_unitario, CAST(ad.subtotal AS DOUBLE) AS subtotal, CAST(ad.precio_anterior AS DOUBLE) AS precio_anterior FROM albaranes_detalle ad INNER JOIN ingredientes i ON ad.ingrediente_id = i.id WHERE ad.albaran_id = ?"
    )
    .bind(albaran_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    for detalle in &detalles {
        // Update price
        let current_price: Option<f64> = sqlx::query_scalar(
            "SELECT CAST(precio_por_unidad_base AS DOUBLE) FROM ingrediente_precios WHERE ingrediente_id = ? AND es_predeterminado = 1 LIMIT 1"
        )
        .bind(detalle.ingrediente_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| e.to_string())?
        .flatten();

        if let Some(_prev_price) = current_price {
            sqlx::query(
                "UPDATE ingrediente_precios SET precio_por_unidad_base = ?, unidad = ?, fecha_actualizacion = CURRENT_TIMESTAMP WHERE ingrediente_id = ? AND es_predeterminado = 1"
            )
            .bind(detalle.precio_unitario)
            .bind(&detalle.unidad)
            .bind(detalle.ingrediente_id)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
        } else {
            sqlx::query(
                "INSERT INTO ingrediente_precios (ingrediente_id, proveedor_id, precio, cantidad, unidad, precio_por_unidad_base, es_predeterminado) VALUES (?, ?, ?, 1, ?, ?, 1)"
            )
            .bind(detalle.ingrediente_id)
            .bind(proveedor_id)
            .bind(detalle.precio_unitario)
            .bind(&detalle.unidad)
            .bind(detalle.precio_unitario)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
        }

        // Update inventory stock
        let unidad_base: Option<String> = sqlx::query_scalar("SELECT unidad_base FROM ingredientes WHERE id = ?")
            .bind(detalle.ingrediente_id)
            .fetch_one(pool)
            .await
            .map_err(|e| e.to_string())?;

        // Convert quantity to base unit
        let cantidad_base = if let Some(ref ub) = unidad_base {
            if (detalle.unidad == "kg" && ub == "g") || (detalle.unidad == "l" && ub == "ml") {
                detalle.cantidad * 1000.0
            } else if (detalle.unidad == "g" && ub == "kg") || (detalle.unidad == "ml" && ub == "l") {
                detalle.cantidad / 1000.0
            } else {
                detalle.cantidad
            }
        } else {
            detalle.cantidad
        };

        // Upsert inventory
        let existing_inv: Option<(i64,)> = sqlx::query_as("SELECT id FROM inventario WHERE ingrediente_id = ?")
            .bind(detalle.ingrediente_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| e.to_string())?;

        if let Some((inv_id,)) = existing_inv {
            sqlx::query("UPDATE inventario SET stock_actual = stock_actual + ?, ultima_actualizacion = CURRENT_TIMESTAMP WHERE id = ?")
                .bind(cantidad_base)
                .bind(inv_id)
                .execute(pool)
                .await
                .map_err(|e| e.to_string())?;
        } else {
            sqlx::query("INSERT INTO inventario (ingrediente_id, stock_actual, stock_minimo, unidad) VALUES (?, ?, 0, ?)")
                .bind(detalle.ingrediente_id)
                .bind(cantidad_base)
                .bind(unidad_base.as_deref().unwrap_or("ud"))
                .execute(pool)
                .await
                .map_err(|e| e.to_string())?;
        }

        // Record movement
        sqlx::query("INSERT INTO inventario_movimientos (ingrediente_id, tipo, cantidad, referencia, albaran_id, notas) VALUES (?, 'entrada', ?, ?, ?, 'Entrada por albarán')")
            .bind(detalle.ingrediente_id)
            .bind(cantidad_base)
            .bind(format!("Albarán #{}", albaran_id))
            .bind(albaran_id)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }

    sqlx::query("UPDATE albaranes SET procesado = 1 WHERE id = ?")
        .bind(albaran_id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ========================================
// INVENTARIO
// ========================================

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Inventario {
    pub id: i64,
    pub ingrediente_id: i64,
    pub ingrediente_nombre: Option<String>,
    pub unidad_base: Option<String>,
    pub stock_actual: f64,
    pub stock_minimo: f64,
    pub unidad: String,
    pub ubicacion: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct InventarioInput {
    pub ingrediente_id: i64,
    pub stock_actual: f64,
    pub stock_minimo: f64,
    pub unidad: String,
    pub ubicacion: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct InventarioMovimiento {
    pub id: i64,
    pub ingrediente_id: i64,
    pub ingrediente_nombre: Option<String>,
    pub tipo: String,
    pub cantidad: f64,
    pub referencia: Option<String>,
    pub albaran_id: Option<i64>,
    pub receta_id: Option<i64>,
    pub notas: Option<String>,
    pub fecha: String,
}

#[derive(Debug, Deserialize)]
pub struct InventarioMovimientoInput {
    pub ingrediente_id: i64,
    pub tipo: String,
    pub cantidad: f64,
    pub referencia: Option<String>,
    pub albaran_id: Option<i64>,
    pub receta_id: Option<i64>,
    pub notas: Option<String>,
}

#[tauri::command]
async fn get_inventario() -> Result<Vec<Inventario>, String> {
    let pool = db::get_pool();
    let rows: Vec<Inventario> = sqlx::query_as(
        "SELECT inv.id, inv.ingrediente_id, i.nombre AS ingrediente_nombre, i.unidad_base, CAST(inv.stock_actual AS DOUBLE) AS stock_actual, CAST(inv.stock_minimo AS DOUBLE) AS stock_minimo, inv.unidad, inv.ubicacion FROM inventario inv INNER JOIN ingredientes i ON inv.ingrediente_id = i.id ORDER BY i.nombre"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
async fn upsert_inventario(input: InventarioInput) -> Result<i64, String> {
    let pool = db::get_pool();
    let existing: Option<(i64,)> = sqlx::query_as("SELECT id FROM inventario WHERE ingrediente_id = ?")
        .bind(input.ingrediente_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| e.to_string())?;

    if let Some((id,)) = existing {
        sqlx::query("UPDATE inventario SET stock_actual = ?, stock_minimo = ?, unidad = ?, ubicacion = ?, ultima_actualizacion = CURRENT_TIMESTAMP WHERE id = ?")
            .bind(input.stock_actual)
            .bind(input.stock_minimo)
            .bind(&input.unidad)
            .bind(&input.ubicacion)
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(id)
    } else {
        let result = sqlx::query("INSERT INTO inventario (ingrediente_id, stock_actual, stock_minimo, unidad, ubicacion) VALUES (?, ?, ?, ?, ?)")
            .bind(input.ingrediente_id)
            .bind(input.stock_actual)
            .bind(input.stock_minimo)
            .bind(&input.unidad)
            .bind(&input.ubicacion)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(result.last_insert_id() as i64)
    }
}

#[tauri::command]
async fn delete_inventario(ingrediente_id: i64) -> Result<(), String> {
    let pool = db::get_pool();
    sqlx::query("DELETE FROM inventario WHERE ingrediente_id = ?")
        .bind(ingrediente_id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_inventario_movimientos(ingrediente_id: Option<i64>) -> Result<Vec<InventarioMovimiento>, String> {
    let pool = db::get_pool();
    let rows: Vec<InventarioMovimiento> = if let Some(iid) = ingrediente_id {
        sqlx::query_as(
            "SELECT m.id, m.ingrediente_id, i.nombre AS ingrediente_nombre, m.tipo, CAST(m.cantidad AS DOUBLE) AS cantidad, m.referencia, m.albaran_id, m.receta_id, m.notas, DATE_FORMAT(m.fecha, '%Y-%m-%d %H:%i') AS fecha FROM inventario_movimientos m INNER JOIN ingredientes i ON m.ingrediente_id = i.id WHERE m.ingrediente_id = ? ORDER BY m.fecha DESC"
        )
        .bind(iid)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?
    } else {
        sqlx::query_as(
            "SELECT m.id, m.ingrediente_id, i.nombre AS ingrediente_nombre, m.tipo, CAST(m.cantidad AS DOUBLE) AS cantidad, m.referencia, m.albaran_id, m.receta_id, m.notas, DATE_FORMAT(m.fecha, '%Y-%m-%d %H:%i') AS fecha FROM inventario_movimientos m INNER JOIN ingredientes i ON m.ingrediente_id = i.id ORDER BY m.fecha DESC LIMIT 100"
        )
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?
    };
    Ok(rows)
}

#[tauri::command]
async fn add_inventario_movimiento(input: InventarioMovimientoInput) -> Result<i64, String> {
    let pool = db::get_pool();

    // Insert movement
    let result = sqlx::query(
        "INSERT INTO inventario_movimientos (ingrediente_id, tipo, cantidad, referencia, albaran_id, receta_id, notas) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(input.ingrediente_id)
    .bind(&input.tipo)
    .bind(input.cantidad)
    .bind(&input.referencia)
    .bind(input.albaran_id)
    .bind(input.receta_id)
    .bind(&input.notas)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // Update stock
    let delta = match input.tipo.as_str() {
        "entrada" => input.cantidad,
        "salida" | "merma" => -input.cantidad,
        "ajuste" => input.cantidad, // For ajuste, cantidad is the new absolute value
        _ => 0.0,
    };

    if input.tipo == "ajuste" {
        sqlx::query("UPDATE inventario SET stock_actual = ?, ultima_actualizacion = CURRENT_TIMESTAMP WHERE ingrediente_id = ?")
            .bind(input.cantidad)
            .bind(input.ingrediente_id)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    } else {
        sqlx::query("UPDATE inventario SET stock_actual = stock_actual + ?, ultima_actualizacion = CURRENT_TIMESTAMP WHERE ingrediente_id = ?")
            .bind(delta)
            .bind(input.ingrediente_id)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(result.last_insert_id() as i64)
}

#[tauri::command]
async fn delete_inventario_movimiento(id: i64) -> Result<(), String> {
    let pool = db::get_pool();
    sqlx::query("DELETE FROM inventario_movimientos WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ========================================
// DASHBOARD
// ========================================

#[derive(Debug, Serialize, Deserialize)]
pub struct DashboardData {
    pub total_recetas: i64,
    pub total_ingredientes: i64,
    pub total_proveedores: i64,
    pub food_cost_medio: Option<f64>,
    pub receta_mas_rentable: Option<String>,
    pub ingrediente_mas_caro: Option<String>,
    pub alertas_stock_bajo: Vec<String>,
    pub ultimos_albaranes: Vec<String>,
}

#[tauri::command]
async fn get_dashboard_data() -> Result<DashboardData, String> {
    let pool = db::get_pool();

    let total_recetas: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM recetas")
        .fetch_one(pool).await.map_err(|e| e.to_string())?;

    let total_ingredientes: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM ingredientes")
        .fetch_one(pool).await.map_err(|e| e.to_string())?;

    let total_proveedores: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM proveedores")
        .fetch_one(pool).await.map_err(|e| e.to_string())?;

    // Average food cost across all recipes with prices
    let food_cost_medio: Option<f64> = sqlx::query_scalar(
        "SELECT CAST(AVG(CASE WHEN precio_venta > 0 THEN (coste.porce / precio_venta) * 100 END) AS DOUBLE) FROM (SELECT r.id, r.precio_venta, CAST(SUM(ri.cantidad * COALESCE(ip.precio_por_unidad_base, 0) * (1 + ri.merma_porcentaje / 100)) AS DOUBLE) AS porce FROM recetas r INNER JOIN receta_ingredientes ri ON r.id = ri.receta_id LEFT JOIN ingrediente_precios ip ON ri.ingrediente_id = ip.ingrediente_id AND ip.es_predeterminado = 1 GROUP BY r.id) AS coste"
    )
    .fetch_optional(pool).await.map_err(|e| e.to_string())?.flatten();

    // Most profitable recipe (lowest food cost %)
    let receta_mas_rentable: Option<String> = sqlx::query_scalar(
        "SELECT r.nombre FROM recetas r INNER JOIN (SELECT ri.receta_id, SUM(ri.cantidad * COALESCE(ip.precio_por_unidad_base, 0) * (1 + ri.merma_porcentaje / 100)) AS coste FROM receta_ingredientes ri LEFT JOIN ingrediente_precios ip ON ri.ingrediente_id = ip.ingrediente_id AND ip.es_predeterminado = 1 GROUP BY ri.receta_id) AS c ON r.id = c.receta_id WHERE r.precio_venta > 0 ORDER BY (c.coste / r.precio_venta) ASC LIMIT 1"
    )
    .fetch_optional(pool).await.map_err(|e| e.to_string())?;

    // Most expensive ingredient (by price per base unit)
    let ingrediente_mas_caro: Option<String> = sqlx::query_scalar(
        "SELECT i.nombre FROM ingredientes i INNER JOIN ingrediente_precios ip ON i.id = ip.ingrediente_id AND ip.es_predeterminado = 1 ORDER BY ip.precio_por_unidad_base DESC LIMIT 1"
    )
    .fetch_optional(pool).await.map_err(|e| e.to_string())?;

    // Low stock alerts
    let alertas_rows: Vec<(String,)> = sqlx::query_as(
        "SELECT CONCAT(i.nombre, ' (', inv.stock_actual, ' ', inv.unidad, ')') FROM inventario inv INNER JOIN ingredientes i ON inv.ingrediente_id = i.id WHERE inv.stock_actual <= inv.stock_minimo"
    )
    .fetch_all(pool).await.map_err(|e| e.to_string())?;
    let alertas_stock_bajo: Vec<String> = alertas_rows.into_iter().map(|r| r.0).collect();

    // Recent albaranes
    let albaranes_rows: Vec<(String,)> = sqlx::query_as(
        "SELECT CONCAT('#', a.id, ' - ', p.nombre, ' (', DATE_FORMAT(a.fecha_recepcion, '%d/%m/%y'), ')') FROM albaranes a INNER JOIN proveedores p ON a.proveedor_id = p.id ORDER BY a.fecha_recepcion DESC LIMIT 5"
    )
    .fetch_all(pool).await.map_err(|e| e.to_string())?;
    let ultimos_albaranes: Vec<String> = albaranes_rows.into_iter().map(|r| r.0).collect();

    Ok(DashboardData {
        total_recetas: total_recetas.0,
        total_ingredientes: total_ingredientes.0,
        total_proveedores: total_proveedores.0,
        food_cost_medio,
        receta_mas_rentable,
        ingrediente_mas_caro,
        alertas_stock_bajo,
        ultimos_albaranes,
    })
}

// ========================================
// INICIO
// ========================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
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
            get_receta_alergenos,
            get_receta_coste,
            get_menus,
            create_menu,
            update_menu,
            delete_menu,
            get_menu_recetas,
            add_menu_receta,
            delete_menu_receta,
            get_menu_alergenos,
            get_albaranes,
            get_albaran,
            create_albaran,
            update_albaran,
            delete_albaran,
            get_albaran_detalles,
            add_albaran_detalle,
            delete_albaran_detalle,
            procesar_albaran,
            get_inventario,
            upsert_inventario,
            delete_inventario,
            get_inventario_movimientos,
            add_inventario_movimiento,
            delete_inventario_movimiento,
            get_dashboard_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
