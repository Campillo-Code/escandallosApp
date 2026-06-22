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
    }

    sqlx::query("UPDATE albaranes SET procesado = 1 WHERE id = ?")
        .bind(albaran_id)
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
            get_receta_alergenos,
            get_receta_coste,
            get_menus,
            create_menu,
            update_menu,
            delete_menu,
            get_menu_recetas,
            add_menu_receta,
            delete_menu_receta,
            get_albaranes,
            get_albaran,
            create_albaran,
            update_albaran,
            delete_albaran,
            get_albaran_detalles,
            add_albaran_detalle,
            delete_albaran_detalle,
            procesar_albaran,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
