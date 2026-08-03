mod db;

use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use tauri::Manager;

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
    let pool = &db::get_pool();
    let rows: Vec<Proveedor> = sqlx::query_as("SELECT id, nombre, contacto, telefono, email, direccion, notas FROM proveedores ORDER BY nombre")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
async fn create_proveedor(input: ProveedorInput) -> Result<i64, String> {
    let pool = &db::get_pool();
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
    let pool = &db::get_pool();
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
    let pool = &db::get_pool();
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
    let pool = &db::get_pool();
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
    let pool = &db::get_pool();
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
    let pool = &db::get_pool();
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
    let pool = &db::get_pool();
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
    let pool = &db::get_pool();
    let rows: Vec<Receta> = sqlx::query_as("SELECT id, nombre, descripcion, categoria, porciones, tiempo_preparacion, es_base, CAST(precio_venta AS DOUBLE) AS precio_venta, CAST(margen_porcentaje AS DOUBLE) AS margen_porcentaje FROM recetas ORDER BY nombre")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
async fn create_receta(input: RecetaInput) -> Result<i64, String> {
    let pool = &db::get_pool();
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
    let pool = &db::get_pool();
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
    let pool = &db::get_pool();
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
    pub sub_receta_nombre: Option<String>,
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
    let pool = &db::get_pool();
    let rows: Vec<RecetaIngredienteConNombre> = sqlx::query_as(
        "SELECT ri.id, ri.receta_id, ri.ingrediente_id, i.nombre AS ingrediente_nombre, ri.sub_receta_id, sr.nombre AS sub_receta_nombre, CAST(ri.cantidad AS DOUBLE) AS cantidad, ri.unidad, CAST(ri.merma_porcentaje AS DOUBLE) AS merma_porcentaje, ri.notas, ri.orden FROM receta_ingredientes ri LEFT JOIN ingredientes i ON ri.ingrediente_id = i.id LEFT JOIN recetas sr ON ri.sub_receta_id = sr.id WHERE ri.receta_id = ? ORDER BY ri.orden"
    )
    .bind(receta_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
async fn add_receta_ingrediente(input: RecetaIngredienteInput) -> Result<i64, String> {
    let pool = &db::get_pool();
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
    let pool = &db::get_pool();
    sqlx::query("DELETE FROM receta_ingredientes WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ========================================
// RECETAS BASE (es_base = true)
// ========================================

#[tauri::command]
async fn get_recetas_base() -> Result<Vec<Receta>, String> {
    let pool = &db::get_pool();
    let rows: Vec<Receta> = sqlx::query_as("SELECT id, nombre, descripcion, categoria, porciones, tiempo_preparacion, es_base, CAST(precio_venta AS DOUBLE) AS precio_venta, CAST(margen_porcentaje AS DOUBLE) AS margen_porcentaje FROM recetas WHERE es_base = 1 ORDER BY nombre")
        .fetch_all(pool).await.map_err(|e| e.to_string())?;
    Ok(rows)
}

// ========================================
// ALERGENOS DE RECETA
// ========================================

#[tauri::command]
async fn get_receta_alergenos(receta_id: i64) -> Result<Vec<String>, String> {
    let pool = &db::get_pool();
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
    let pool = &db::get_pool();

    let receta: Receta = sqlx::query_as(
        "SELECT id, nombre, descripcion, categoria, porciones, tiempo_preparacion, es_base, CAST(precio_venta AS DOUBLE) AS precio_venta, CAST(margen_porcentaje AS DOUBLE) AS margen_porcentaje FROM recetas WHERE id = ?"
    )
    .bind(receta_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?
    .ok_or("Receta no encontrada".to_string())?;

    // Fetch ALL receta_ingredientes (regular ingredients + sub-recipes)
    let all_ri: Vec<(i64, Option<i64>, Option<i64>, f64, String, f64)> = sqlx::query_as(
        "SELECT ri.id, ri.ingrediente_id, ri.sub_receta_id, CAST(ri.cantidad AS DOUBLE), ri.unidad, CAST(ri.merma_porcentaje AS DOUBLE) FROM receta_ingredientes ri WHERE ri.receta_id = ?"
    )
    .bind(receta_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut ingredientes: Vec<CosteIngrediente> = Vec::new();
    let mut coste_total: f64 = 0.0;

    for ri in all_ri {
        let ingrediente_id = ri.1;
        let sub_receta_id = ri.2;
        let cantidad = ri.3;
        let unidad = ri.4;
        let merma = ri.5;

        if let Some(sub_rid) = sub_receta_id {
            // Sub-recipe: first get name and porciones
            let sub_info: Option<(String, f64)> = sqlx::query_as("SELECT nombre, CAST(porciones AS DOUBLE) FROM recetas WHERE id = ?")
                .bind(sub_rid).fetch_optional(pool).await.map_err(|e| e.to_string())?;

            if let Some((sub_nombre, sub_porciones)) = sub_info {
                // Get cost of all ingredients in the sub-recipe
                let sub_coste_opt: Option<(f64,)> = sqlx::query_as(
                    "SELECT CAST(SUM(ri2.cantidad * COALESCE(ip.precio_por_unidad_base, 0) * (1 + ri2.merma_porcentaje / 100)) AS DOUBLE) FROM receta_ingredientes ri2 LEFT JOIN ingrediente_precios ip ON ri2.ingrediente_id = ip.ingrediente_id AND ip.es_predeterminado = 1 WHERE ri2.receta_id = ?"
                )
                .bind(sub_rid).fetch_optional(pool).await.map_err(|e| e.to_string())?;

                let sub_coste_total = sub_coste_opt.map(|r| r.0).unwrap_or(0.0);
                let prop_coste = if sub_porciones > 0.0 {
                    (cantidad / sub_porciones) * sub_coste_total * (1.0 + merma / 100.0)
                } else {
                    0.0
                };
                coste_total += prop_coste;
                ingredientes.push(CosteIngrediente {
                    ingrediente_nombre: sub_nombre,
                    cantidad,
                    unidad,
                    merma_porcentaje: merma,
                    precio_unitario: None,
                    precio_por_unidad_receta: None,
                    coste: prop_coste,
                });
            }
        } else if let Some(iid) = ingrediente_id {
            // Regular ingredient
            let ing_row: Option<(String, String)> = sqlx::query_as("SELECT nombre, unidad_base FROM ingredientes WHERE id = ?")
                .bind(iid).fetch_optional(pool).await.map_err(|e| e.to_string())?;
            let (nombre, unidad_base) = match ing_row {
                Some(r) => (r.0, r.1),
                None => continue,
            };

            let precio_row: Option<(f64,)> = sqlx::query_as(
                "SELECT CAST(precio_por_unidad_base AS DOUBLE) FROM ingrediente_precios WHERE ingrediente_id = ? AND es_predeterminado = 1 LIMIT 1"
            )
            .bind(iid).fetch_optional(pool).await.map_err(|e| e.to_string())?;

            let precio_unitario = precio_row.map(|r| r.0);

            let cantidad_base = if unidad == unidad_base { cantidad }
            else if (unidad == "kg" && unidad_base == "g") || (unidad == "l" && unidad_base == "ml") { cantidad * 1000.0 }
            else if (unidad == "g" && unidad_base == "kg") || (unidad == "ml" && unidad_base == "l") { cantidad / 1000.0 }
            else { cantidad };

            let coste = if let Some(pu) = precio_unitario {
                cantidad_base * pu * (1.0 + merma / 100.0)
            } else { 0.0 };

            coste_total += coste;

            let precio_por_unidad_receta = precio_unitario.map(|pu| {
                if (unidad == "kg" && unidad_base == "g") || (unidad == "l" && unidad_base == "ml") { pu * 1000.0 }
                else if (unidad == "g" && unidad_base == "kg") || (unidad == "ml" && unidad_base == "l") { pu / 1000.0 }
                else { pu }
            });

            ingredientes.push(CosteIngrediente {
                ingrediente_nombre: nombre,
                cantidad, unidad, merma_porcentaje: merma,
                precio_unitario, precio_por_unidad_receta, coste,
            });
        }
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
    let pool = &db::get_pool();
    let rows: Vec<Menu> = sqlx::query_as("SELECT id, nombre, descripcion, tipo, activo FROM menus ORDER BY nombre")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
async fn create_menu(input: MenuInput) -> Result<i64, String> {
    let pool = &db::get_pool();
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
    let pool = &db::get_pool();
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
    let pool = &db::get_pool();
    sqlx::query("DELETE FROM menus WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_menu_recetas(menu_id: i64) -> Result<Vec<MenuReceta>, String> {
    let pool = &db::get_pool();
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
    let pool = &db::get_pool();
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
    let pool = &db::get_pool();
    sqlx::query("DELETE FROM menu_recetas WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_menu_alergenos(menu_id: i64) -> Result<Vec<String>, String> {
    let pool = &db::get_pool();
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
    let pool = &db::get_pool();
    let rows: Vec<Albaran> = sqlx::query_as(
        "SELECT a.id, a.proveedor_id, p.nombre AS proveedor_nombre, a.numero_albaran, DATE_FORMAT(a.fecha_recepcion, '%Y-%m-%d') AS fecha_recepcion, CAST(a.total AS DOUBLE) AS total, a.notas, a.procesado FROM albaranes a LEFT JOIN proveedores p ON a.proveedor_id = p.id ORDER BY a.fecha_recepcion DESC"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
async fn get_albaran(id: i64) -> Result<Albaran, String> {
    let pool = &db::get_pool();
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
    let pool = &db::get_pool();
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
    let pool = &db::get_pool();
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
    let pool = &db::get_pool();
    sqlx::query("DELETE FROM albaranes WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_albaran_detalles(albaran_id: i64) -> Result<Vec<AlbaranDetalle>, String> {
    let pool = &db::get_pool();
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
    let pool = &db::get_pool();
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
    let pool = &db::get_pool();
    sqlx::query("DELETE FROM albaranes_detalle WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn procesar_albaran(albaran_id: i64) -> Result<(), String> {
    let pool = &db::get_pool();

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
    let pool = &db::get_pool();
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
    let pool = &db::get_pool();
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
    let pool = &db::get_pool();
    sqlx::query("DELETE FROM inventario WHERE ingrediente_id = ?")
        .bind(ingrediente_id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_inventario_movimientos(ingrediente_id: Option<i64>) -> Result<Vec<InventarioMovimiento>, String> {
    let pool = &db::get_pool();
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
    let pool = &db::get_pool();

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
    let pool = &db::get_pool();
    sqlx::query("DELETE FROM inventario_movimientos WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ========================================
// GUARNICIONES
// ========================================

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Guarnicion {
    pub id: i64,
    pub nombre: String,
    pub descripcion: Option<String>,
    pub porciones: i64,
    pub margen_porcentaje: f64,
    pub precio_venta: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct GuarnicionInput {
    pub nombre: String,
    pub descripcion: Option<String>,
    pub porciones: Option<i64>,
    pub margen_porcentaje: Option<f64>,
    pub precio_venta: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct GuarnicionIngrediente {
    pub id: i64,
    pub guarnicion_id: i64,
    pub ingrediente_id: i64,
    pub ingrediente_nombre: Option<String>,
    pub cantidad: f64,
    pub unidad: String,
    pub merma_porcentaje: f64,
}

#[derive(Debug, Deserialize)]
pub struct GuarnicionIngredienteInput {
    pub guarnicion_id: i64,
    pub ingrediente_id: i64,
    pub cantidad: f64,
    pub unidad: String,
    pub merma_porcentaje: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct RecetaGuarnicion {
    pub id: i64,
    pub receta_id: i64,
    pub guarnicion_id: i64,
    pub guarnicion_nombre: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RecetaGuarnicionInput {
    pub receta_id: i64,
    pub guarnicion_id: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CosteGuarnicion {
    pub nombre: String,
    pub coste_total: f64,
    pub porciones: i64,
    pub coste_porcion: f64,
    pub margen_porcentaje: f64,
    pub precio_venta: Option<f64>,
    pub precio_venta_sugerido: f64,
    pub ingredientes: Vec<CosteIngrediente>,
}

// CRUD Guarniciones
#[tauri::command]
async fn get_guarniciones() -> Result<Vec<Guarnicion>, String> {
    let pool = &db::get_pool();
    let rows: Vec<Guarnicion> = sqlx::query_as("SELECT id, nombre, descripcion, porciones, CAST(margen_porcentaje AS DOUBLE) AS margen_porcentaje, CAST(precio_venta AS DOUBLE) AS precio_venta FROM guarniciones ORDER BY nombre")
        .fetch_all(pool).await.map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
async fn create_guarnicion(input: GuarnicionInput) -> Result<i64, String> {
    let pool = &db::get_pool();
    let result = sqlx::query("INSERT INTO guarniciones (nombre, descripcion, porciones, margen_porcentaje, precio_venta) VALUES (?, ?, ?, ?, ?)")
        .bind(&input.nombre).bind(&input.descripcion).bind(input.porciones.unwrap_or(1)).bind(input.margen_porcentaje.unwrap_or(30.0)).bind(input.precio_venta)
        .execute(pool).await.map_err(|e| e.to_string())?;
    Ok(result.last_insert_id() as i64)
}

#[tauri::command]
async fn update_guarnicion(id: i64, input: GuarnicionInput) -> Result<(), String> {
    let pool = &db::get_pool();
    sqlx::query("UPDATE guarniciones SET nombre = ?, descripcion = ?, porciones = ?, margen_porcentaje = ?, precio_venta = ? WHERE id = ?")
        .bind(&input.nombre).bind(&input.descripcion).bind(input.porciones.unwrap_or(1)).bind(input.margen_porcentaje.unwrap_or(30.0)).bind(input.precio_venta).bind(id)
        .execute(pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn delete_guarnicion(id: i64) -> Result<(), String> {
    let pool = &db::get_pool();
    sqlx::query("DELETE FROM guarniciones WHERE id = ?").bind(id)
        .execute(pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

// CRUD Guarnicion Ingredientes
#[tauri::command]
async fn get_guarnicion_ingredientes(guarnicion_id: i64) -> Result<Vec<GuarnicionIngrediente>, String> {
    let pool = &db::get_pool();
    let rows: Vec<GuarnicionIngrediente> = sqlx::query_as(
        "SELECT gi.id, gi.guarnicion_id, gi.ingrediente_id, i.nombre AS ingrediente_nombre, CAST(gi.cantidad AS DOUBLE) AS cantidad, gi.unidad, CAST(gi.merma_porcentaje AS DOUBLE) AS merma_porcentaje FROM guarnicion_ingredientes gi INNER JOIN ingredientes i ON gi.ingrediente_id = i.id WHERE gi.guarnicion_id = ? ORDER BY gi.id"
    ).bind(guarnicion_id).fetch_all(pool).await.map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
async fn add_guarnicion_ingrediente(input: GuarnicionIngredienteInput) -> Result<i64, String> {
    let pool = &db::get_pool();
    let result = sqlx::query("INSERT INTO guarnicion_ingredientes (guarnicion_id, ingrediente_id, cantidad, unidad, merma_porcentaje) VALUES (?, ?, ?, ?, ?)")
        .bind(input.guarnicion_id).bind(input.ingrediente_id).bind(input.cantidad)
        .bind(&input.unidad).bind(input.merma_porcentaje.unwrap_or(0.0))
        .execute(pool).await.map_err(|e| e.to_string())?;
    Ok(result.last_insert_id() as i64)
}

#[tauri::command]
async fn delete_guarnicion_ingrediente(id: i64) -> Result<(), String> {
    let pool = &db::get_pool();
    sqlx::query("DELETE FROM guarnicion_ingredientes WHERE id = ?").bind(id)
        .execute(pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

// CRUD Receta-Guarnicion
#[tauri::command]
async fn get_receta_guarniciones(receta_id: i64) -> Result<Vec<RecetaGuarnicion>, String> {
    let pool = &db::get_pool();
    let rows: Vec<RecetaGuarnicion> = sqlx::query_as(
        "SELECT rg.id, rg.receta_id, rg.guarnicion_id, g.nombre AS guarnicion_nombre FROM receta_guarniciones rg INNER JOIN guarniciones g ON rg.guarnicion_id = g.id WHERE rg.receta_id = ? ORDER BY g.nombre"
    ).bind(receta_id).fetch_all(pool).await.map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
async fn add_receta_guarnicion(input: RecetaGuarnicionInput) -> Result<i64, String> {
    let pool = &db::get_pool();
    let result = sqlx::query("INSERT INTO receta_guarniciones (receta_id, guarnicion_id) VALUES (?, ?)")
        .bind(input.receta_id).bind(input.guarnicion_id)
        .execute(pool).await.map_err(|e| e.to_string())?;
    Ok(result.last_insert_id() as i64)
}

#[tauri::command]
async fn delete_receta_guarnicion(id: i64) -> Result<(), String> {
    let pool = &db::get_pool();
    sqlx::query("DELETE FROM receta_guarniciones WHERE id = ?").bind(id)
        .execute(pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

// Coste de guarnicion
#[tauri::command]
async fn get_guarnicion_coste(guarnicion_id: i64) -> Result<CosteGuarnicion, String> {
    let pool = &db::get_pool();
    let guarnicion: Guarnicion = sqlx::query_as("SELECT id, nombre, descripcion, porciones, CAST(margen_porcentaje AS DOUBLE) AS margen_porcentaje, CAST(precio_venta AS DOUBLE) AS precio_venta FROM guarniciones WHERE id = ?")
        .bind(guarnicion_id).fetch_optional(pool).await.map_err(|e| e.to_string())?
        .ok_or("Guarnición no encontrada".to_string())?;

    let rows: Vec<(String, f64, String, f64, String)> = sqlx::query_as(
        "SELECT i.nombre, CAST(gi.cantidad AS DOUBLE), gi.unidad, CAST(gi.merma_porcentaje AS DOUBLE), i.unidad_base FROM guarnicion_ingredientes gi INNER JOIN ingredientes i ON gi.ingrediente_id = i.id WHERE gi.guarnicion_id = ?"
    ).bind(guarnicion_id).fetch_all(pool).await.map_err(|e| e.to_string())?;

    let mut ingredientes: Vec<CosteIngrediente> = Vec::new();
    let mut coste_total: f64 = 0.0;

    for row in rows {
        let nombre = row.0;
        let cantidad = row.1;
        let unidad = row.2;
        let merma = row.3;
        let unidad_base = row.4;

        let ingrediente_id: Option<i64> = sqlx::query_scalar("SELECT id FROM ingredientes WHERE nombre = ?")
            .bind(&nombre).fetch_optional(pool).await.map_err(|e| e.to_string())?;

        let precio_unitario: Option<f64> = if let Some(iid) = ingrediente_id {
            sqlx::query_scalar("SELECT CAST(precio_por_unidad_base AS DOUBLE) FROM ingrediente_precios WHERE ingrediente_id = ? AND es_predeterminado = 1 LIMIT 1")
                .bind(iid).fetch_optional(pool).await.map_err(|e| e.to_string())?.flatten()
        } else {
            None
        };

        let cantidad_base = if unidad == unidad_base { cantidad }
        else if (unidad == "kg" && unidad_base == "g") || (unidad == "l" && unidad_base == "ml") { cantidad * 1000.0 }
        else if (unidad == "g" && unidad_base == "kg") || (unidad == "ml" && unidad_base == "l") { cantidad / 1000.0 }
        else { cantidad };

        let coste = if let Some(pu) = precio_unitario {
            cantidad_base * pu * (1.0 + merma / 100.0)
        } else { 0.0 };

        coste_total += coste;

        let precio_por_unidad_receta = precio_unitario.map(|pu| {
            if (unidad == "kg" && unidad_base == "g") || (unidad == "l" && unidad_base == "ml") { pu * 1000.0 }
            else if (unidad == "g" && unidad_base == "kg") || (unidad == "ml" && unidad_base == "l") { pu / 1000.0 }
            else { pu }
        });

        ingredientes.push(CosteIngrediente {
            ingrediente_nombre: nombre, cantidad, unidad, merma_porcentaje: merma,
            precio_unitario, precio_por_unidad_receta, coste,
        });
    }

    let margen = guarnicion.margen_porcentaje;
    let precio_venta = guarnicion.precio_venta;
    let porciones = guarnicion.porciones;
    let coste_porcion = if porciones > 0 { coste_total / porciones as f64 } else { coste_total };
    let precio_venta_sugerido = if margen < 100.0 && margen > 0.0 { coste_porcion / (1.0 - margen / 100.0) } else { coste_porcion * 2.0 };

    Ok(CosteGuarnicion { nombre: guarnicion.nombre, coste_total, porciones, coste_porcion, margen_porcentaje: margen, precio_venta, precio_venta_sugerido, ingredientes })
}

// ========================================
// FICHAS TECNICAS
// ========================================

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct FichaTecnica {
    pub id: i64,
    pub receta_id: i64,
    pub receta_nombre: Option<String>,
    pub codigo_interno: Option<String>,
    pub catalogado_en: Option<String>,
    pub fecha: Option<String>,
    pub instrucciones_consumo: Option<String>,
    pub pasos_preparacion: Option<String>,
    pub conservacion: Option<String>,
    pub vida_util: Option<String>,
    pub regeneracion: Option<String>,
    pub fotos: Option<String>,
    pub notas_adicionales: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct FichaTecnicaInput {
    pub receta_id: i64,
    pub codigo_interno: Option<String>,
    pub catalogado_en: Option<String>,
    pub fecha: Option<String>,
    pub instrucciones_consumo: Option<String>,
    pub pasos_preparacion: Option<String>,
    pub conservacion: Option<String>,
    pub vida_util: Option<String>,
    pub regeneracion: Option<String>,
    pub fotos: Option<String>,
    pub notas_adicionales: Option<String>,
}

#[tauri::command]
async fn get_fichas_tecnicas() -> Result<Vec<FichaTecnica>, String> {
    let pool = &db::get_pool();
    let rows: Vec<FichaTecnica> = sqlx::query_as(
        "SELECT ft.id, ft.receta_id, r.nombre AS receta_nombre, ft.codigo_interno, ft.catalogado_en, DATE_FORMAT(ft.fecha, '%Y-%m-%d') AS fecha, ft.instrucciones_consumo, ft.pasos_preparacion, ft.conservacion, ft.vida_util, ft.regeneracion, CAST(ft.fotos AS CHAR) AS fotos, ft.notas_adicionales FROM fichas_tecnicas ft INNER JOIN recetas r ON ft.receta_id = r.id ORDER BY r.nombre"
    ).fetch_all(pool).await.map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
async fn get_ficha_tecnica(receta_id: i64) -> Result<Option<FichaTecnica>, String> {
    let pool = &db::get_pool();
    let row: Option<FichaTecnica> = sqlx::query_as(
        "SELECT ft.id, ft.receta_id, r.nombre AS receta_nombre, ft.codigo_interno, ft.catalogado_en, DATE_FORMAT(ft.fecha, '%Y-%m-%d') AS fecha, ft.instrucciones_consumo, ft.pasos_preparacion, ft.conservacion, ft.vida_util, ft.regeneracion, CAST(ft.fotos AS CHAR) AS fotos, ft.notas_adicionales FROM fichas_tecnicas ft INNER JOIN recetas r ON ft.receta_id = r.id WHERE ft.receta_id = ?"
    ).bind(receta_id).fetch_optional(pool).await.map_err(|e| e.to_string())?;
    Ok(row)
}

#[tauri::command]
async fn create_ficha_tecnica(input: FichaTecnicaInput) -> Result<i64, String> {
    let pool = &db::get_pool();
    let result = sqlx::query("INSERT INTO fichas_tecnicas (receta_id, codigo_interno, catalogado_en, fecha, instrucciones_consumo, pasos_preparacion, conservacion, vida_util, regeneracion, fotos, notas_adicionales) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(input.receta_id).bind(&input.codigo_interno).bind(&input.catalogado_en).bind(&input.fecha).bind(&input.instrucciones_consumo).bind(&input.pasos_preparacion).bind(&input.conservacion).bind(&input.vida_util).bind(&input.regeneracion).bind(&input.fotos).bind(&input.notas_adicionales)
        .execute(pool).await.map_err(|e| e.to_string())?;
    Ok(result.last_insert_id() as i64)
}

#[tauri::command]
async fn update_ficha_tecnica(id: i64, input: FichaTecnicaInput) -> Result<(), String> {
    let pool = &db::get_pool();
    sqlx::query("UPDATE fichas_tecnicas SET codigo_interno = ?, catalogado_en = ?, fecha = ?, instrucciones_consumo = ?, pasos_preparacion = ?, conservacion = ?, vida_util = ?, regeneracion = ?, fotos = ?, notas_adicionales = ? WHERE id = ?")
        .bind(&input.codigo_interno).bind(&input.catalogado_en).bind(&input.fecha).bind(&input.instrucciones_consumo).bind(&input.pasos_preparacion).bind(&input.conservacion).bind(&input.vida_util).bind(&input.regeneracion).bind(&input.fotos).bind(&input.notas_adicionales).bind(id)
        .execute(pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn delete_ficha_tecnica(id: i64) -> Result<(), String> {
    let pool = &db::get_pool();
    sqlx::query("DELETE FROM fichas_tecnicas WHERE id = ?").bind(id)
        .execute(pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

// ========================================
// VENTAS
// ========================================

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Venta {
    pub id: i64,
    pub fecha: String,
    pub plato_nombre: String,
    pub cantidad: i64,
    pub precio_unitario: f64,
    pub total_venta: f64,
}

#[derive(Debug, Deserialize)]
pub struct VentaInput {
    pub fecha: String,
    pub plato_nombre: String,
    pub cantidad: i64,
    pub precio_unitario: f64,
    pub total_venta: f64,
}

#[derive(Debug, Deserialize)]
pub struct VentaCSVRow {
    pub fecha: String,
    pub plato_nombre: String,
    pub cantidad: i64,
    pub precio_unitario: f64,
    pub total_venta: f64,
}

#[tauri::command]
async fn get_ventas(fecha_desde: Option<String>, fecha_hasta: Option<String>) -> Result<Vec<Venta>, String> {
    let pool = &db::get_pool();
    let rows: Vec<Venta> = if let (Some(desde), Some(hasta)) = (&fecha_desde, &fecha_hasta) {
        sqlx::query_as("SELECT id, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, plato_nombre, cantidad, CAST(precio_unitario AS DOUBLE) AS precio_unitario, CAST(total_venta AS DOUBLE) AS total_venta FROM ventas WHERE fecha BETWEEN ? AND ? ORDER BY fecha DESC, plato_nombre")
            .bind(desde).bind(hasta).fetch_all(pool).await.map_err(|e| e.to_string())?
    } else {
        sqlx::query_as("SELECT id, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, plato_nombre, cantidad, CAST(precio_unitario AS DOUBLE) AS precio_unitario, CAST(total_venta AS DOUBLE) AS total_venta FROM ventas ORDER BY fecha DESC, plato_nombre")
            .fetch_all(pool).await.map_err(|e| e.to_string())?
    };
    Ok(rows)
}

#[tauri::command]
async fn import_ventas(rows: Vec<VentaCSVRow>) -> Result<i64, String> {
    let pool = &db::get_pool();
    let mut count: i64 = 0;
    for row in rows {
        sqlx::query("INSERT INTO ventas (fecha, plato_nombre, cantidad, precio_unitario, total_venta) VALUES (?, ?, ?, ?, ?)")
            .bind(&row.fecha).bind(&row.plato_nombre).bind(row.cantidad).bind(row.precio_unitario).bind(row.total_venta)
            .execute(pool).await.map_err(|e| e.to_string())?;
        count += 1;
    }
    Ok(count)
}

#[tauri::command]
async fn delete_venta(id: i64) -> Result<(), String> {
    let pool = &db::get_pool();
    sqlx::query("DELETE FROM ventas WHERE id = ?").bind(id)
        .execute(pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct VentaPorPlato {
    pub plato_nombre: String,
    pub unidades_vendidas: i64,
    pub total_ingresos: f64,
}

#[tauri::command]
async fn get_ventas_por_plato(fecha_desde: Option<String>, fecha_hasta: Option<String>) -> Result<Vec<VentaPorPlato>, String> {
    let pool = &db::get_pool();
    let rows: Vec<VentaPorPlato> = if let (Some(desde), Some(hasta)) = (&fecha_desde, &fecha_hasta) {
        sqlx::query_as("SELECT plato_nombre, SUM(cantidad) AS unidades_vendidas, SUM(total_venta) AS total_ingresos FROM ventas WHERE fecha BETWEEN ? AND ? GROUP BY plato_nombre ORDER BY total_ingresos DESC")
            .bind(desde).bind(hasta).fetch_all(pool).await.map_err(|e| e.to_string())?
    } else {
        sqlx::query_as("SELECT plato_nombre, SUM(cantidad) AS unidades_vendidas, SUM(total_venta) AS total_ingresos FROM ventas GROUP BY plato_nombre ORDER BY total_ingresos DESC")
            .fetch_all(pool).await.map_err(|e| e.to_string())?
    };
    Ok(rows)
}

// ========================================
// MENU ENGINEERING (BCG Matrix)
// ========================================

#[derive(Debug, Serialize, Deserialize)]
pub struct MenuEngineeringItem {
    pub plato_nombre: String,
    pub receta_id: Option<i64>,
    pub unidades_vendidas: i64,
    pub margen_porcentaje: f64,
    pub margen_euros: f64,
    pub coste_porcion: f64,
    pub precio_venta: f64,
    pub categoria: String,
}

#[tauri::command]
async fn get_menu_engineering(fecha_desde: Option<String>, fecha_hasta: Option<String>) -> Result<Vec<MenuEngineeringItem>, String> {
    let pool = &db::get_pool();

    // Get sales per dish
    let ventas: Vec<VentaPorPlato> = if let (Some(desde), Some(hasta)) = (&fecha_desde, &fecha_hasta) {
        sqlx::query_as("SELECT plato_nombre, SUM(cantidad) AS unidades_vendidas, SUM(total_venta) AS total_ingresos FROM ventas WHERE fecha BETWEEN ? AND ? GROUP BY plato_nombre")
            .bind(desde).bind(hasta).fetch_all(pool).await.map_err(|e| e.to_string())?
    } else {
        sqlx::query_as("SELECT plato_nombre, SUM(cantidad) AS unidades_vendidas, SUM(total_venta) AS total_ingresos FROM ventas GROUP BY plato_nombre")
            .fetch_all(pool).await.map_err(|e| e.to_string())?
    };

    if ventas.is_empty() {
        return Ok(vec![]);
    }

    // Calculate median of units sold for BCG cutoff
    let mut units: Vec<i64> = ventas.iter().map(|v| v.unidades_vendidas).collect();
    units.sort();
    let median_units = units[units.len() / 2] as f64;

    // Try to match each dish to a receta to get margin info
    let mut items: Vec<MenuEngineeringItem> = Vec::new();
    for v in &ventas {
        // Try to find matching receta
        let receta: Option<(i64, f64, f64, f64)> = sqlx::query_as(
            "SELECT r.id, CAST(r.precio_venta AS DOUBLE), COALESCE(r.margen_porcentaje, 50.0), 0.0 FROM recetas r WHERE r.nombre = ? LIMIT 1"
        ).bind(&v.plato_nombre).fetch_optional(pool).await.map_err(|e| e.to_string())?;

        let (receta_id, precio_venta, margen_porcentaje, _coste) = receta.unwrap_or((0, 0.0, 50.0, 0.0));

        // Calculate cost from receta if available
        let coste_porcion: f64 = if receta_id > 0 {
            let coste_result: Option<(f64,)> = sqlx::query_as(
                "SELECT CAST(SUM(ri.cantidad * COALESCE(ip.precio_por_unidad_base, 0) * (1 + ri.merma_porcentaje / 100)) / r.porciones AS DOUBLE) AS coste_porcion FROM receta_ingredientes ri LEFT JOIN ingrediente_precios ip ON ri.ingrediente_id = ip.ingrediente_id AND ip.es_predeterminado = 1 INNER JOIN recetas r ON ri.receta_id = r.id WHERE ri.receta_id = ?"
            ).bind(receta_id).fetch_optional(pool).await.map_err(|e| e.to_string())?;
            coste_result.map(|c| c.0).unwrap_or(0.0)
        } else {
            0.0
        };

        let margen_euros = if precio_venta > 0.0 { precio_venta - coste_porcion } else { 0.0 };
        let margen_real = if precio_venta > 0.0 { ((precio_venta - coste_porcion) / precio_venta) * 100.0 } else { margen_porcentaje };

        // BCG classification
        let popularidad_alta = (v.unidades_vendidas as f64) >= median_units;
        let margen_alto = margen_real >= 30.0; // 30% threshold

        let categoria = match (popularidad_alta, margen_alto) {
            (true, true) => "estrella",
            (true, false) => "vaca",
            (false, true) => "enigma",
            (false, false) => "perro",
        };

        items.push(MenuEngineeringItem {
            plato_nombre: v.plato_nombre.clone(),
            receta_id: if receta_id > 0 { Some(receta_id) } else { None },
            unidades_vendidas: v.unidades_vendidas,
            margen_porcentaje: margen_real,
            margen_euros,
            coste_porcion,
            precio_venta,
            categoria: categoria.to_string(),
        });
    }

    Ok(items)
}

// ========================================
// CONTABILIDAD
// ========================================

#[derive(Debug, Serialize, Deserialize)]
pub struct DesglosePlato {
    pub plato_nombre: String,
    pub ingresos: f64,
    pub costes: f64,
    pub margen_bruto: f64,
    pub margen_porcentaje: f64,
    pub unidades_vendidas: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ContabilidadData {
    pub total_ingresos: f64,
    pub total_costes_cogs: f64,
    pub margen_bruto_euros: f64,
    pub margen_bruto_porcentaje: f64,
    pub beneficio_bruto: f64,
    pub beneficio_neto: f64,
    pub num_platos_vendidos: i64,
    pub ticket_medio: f64,
    pub desglose_por_plato: Vec<DesglosePlato>,
}

#[tauri::command]
async fn get_contabilidad(fecha_desde: Option<String>, fecha_hasta: Option<String>) -> Result<ContabilidadData, String> {
    let pool = &db::get_pool();

    let ventas_por_plato: Vec<VentaPorPlato> = if let (Some(desde), Some(hasta)) = (&fecha_desde, &fecha_hasta) {
        sqlx::query_as("SELECT plato_nombre, SUM(cantidad) AS unidades_vendidas, SUM(total_venta) AS total_ingresos FROM ventas WHERE fecha BETWEEN ? AND ? GROUP BY plato_nombre ORDER BY total_ingresos DESC")
            .bind(desde).bind(hasta).fetch_all(pool).await.map_err(|e| e.to_string())?
    } else {
        sqlx::query_as("SELECT plato_nombre, SUM(cantidad) AS unidades_vendidas, SUM(total_venta) AS total_ingresos FROM ventas GROUP BY plato_nombre ORDER BY total_ingresos DESC")
            .fetch_all(pool).await.map_err(|e| e.to_string())?
    };

    let total_tickets: (i64,) = if let (Some(desde), Some(hasta)) = (&fecha_desde, &fecha_hasta) {
        sqlx::query_as("SELECT COUNT(DISTINCT fecha) FROM ventas WHERE fecha BETWEEN ? AND ?")
            .bind(desde).bind(hasta).fetch_one(pool).await.map_err(|e| e.to_string())?
    } else {
        sqlx::query_as("SELECT COUNT(DISTINCT fecha) FROM ventas")
            .fetch_one(pool).await.map_err(|e| e.to_string())?
    };

    let mut total_ingresos: f64 = 0.0;
    let mut total_costes: f64 = 0.0;
    let mut total_unidades: i64 = 0;
    let mut desglose: Vec<DesglosePlato> = Vec::new();

    for v in &ventas_por_plato {
        total_ingresos += v.total_ingresos;
        total_unidades += v.unidades_vendidas;

        // Try to get cost from receta
        let coste_result: Option<(f64,)> = sqlx::query_as(
            "SELECT CAST(SUM(ri.cantidad * COALESCE(ip.precio_por_unidad_base, 0) * (1 + ri.merma_porcentaje / 100)) / r.porciones AS DOUBLE) FROM receta_ingredientes ri LEFT JOIN ingrediente_precios ip ON ri.ingrediente_id = ip.ingrediente_id AND ip.es_predeterminado = 1 INNER JOIN recetas r ON ri.receta_id = r.id WHERE r.nombre = ?"
        ).bind(&v.plato_nombre).fetch_optional(pool).await.map_err(|e| e.to_string())?;

        let coste_porcion = coste_result.map(|t| t.0).unwrap_or(0.0);
        let coste_total_plato = coste_porcion * v.unidades_vendidas as f64;
        total_costes += coste_total_plato;

        let margen = v.total_ingresos - coste_total_plato;
        let margen_pct = if v.total_ingresos > 0.0 { (margen / v.total_ingresos) * 100.0 } else { 0.0 };

        desglose.push(DesglosePlato {
            plato_nombre: v.plato_nombre.clone(),
            ingresos: v.total_ingresos,
            costes: coste_total_plato,
            margen_bruto: margen,
            margen_porcentaje: margen_pct,
            unidades_vendidas: v.unidades_vendidas,
        });
    }

    let margen_bruto = total_ingresos - total_costes;
    let margen_bruto_pct = if total_ingresos > 0.0 { (margen_bruto / total_ingresos) * 100.0 } else { 0.0 };
    let ticket_medio = if total_tickets.0 > 0 { total_ingresos / total_tickets.0 as f64 } else { 0.0 };

    Ok(ContabilidadData {
        total_ingresos,
        total_costes_cogs: total_costes,
        margen_bruto_euros: margen_bruto,
        margen_bruto_porcentaje: margen_bruto_pct,
        beneficio_bruto: margen_bruto,
        beneficio_neto: margen_bruto,
        num_platos_vendidos: total_unidades,
        ticket_medio,
        desglose_por_plato: desglose,
    })
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
    let pool = &db::get_pool();

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
// TRAZABILIDAD - LOTES
// ========================================

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct LoteIngrediente {
    pub id: i64,
    pub ingrediente_id: i64,
    pub ingrediente_nombre: Option<String>,
    pub proveedor_id: i64,
    pub proveedor_nombre: Option<String>,
    pub numero_lote: String,
    pub fecha_recepcion: String,
    pub fecha_caducidad: Option<String>,
    pub cantidad_recibida: f64,
    pub unidad: String,
    pub albaran_id: Option<i64>,
    pub notas: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoteInput {
    pub ingrediente_id: i64,
    pub proveedor_id: i64,
    pub numero_lote: String,
    pub fecha_recepcion: String,
    pub fecha_caducidad: Option<String>,
    pub cantidad_recibida: f64,
    pub unidad: String,
    pub albaran_id: Option<i64>,
    pub notas: Option<String>,
}

#[tauri::command]
async fn get_lotes(fecha_desde: Option<String>, fecha_hasta: Option<String>) -> Result<Vec<LoteIngrediente>, String> {
    let pool = &db::get_pool();
    let rows: Vec<LoteIngrediente> = if let (Some(desde), Some(hasta)) = (&fecha_desde, &fecha_hasta) {
        sqlx::query_as("SELECT l.id, l.ingrediente_id, i.nombre AS ingrediente_nombre, l.proveedor_id, p.nombre AS proveedor_nombre, l.numero_lote, DATE_FORMAT(l.fecha_recepcion, '%Y-%m-%d') AS fecha_recepcion, DATE_FORMAT(l.fecha_caducidad, '%Y-%m-%d') AS fecha_caducidad, CAST(l.cantidad_recibida AS DOUBLE) AS cantidad_recibida, l.unidad, l.albaran_id, l.notas FROM lotes_ingredientes l LEFT JOIN ingredientes i ON l.ingrediente_id = i.id LEFT JOIN proveedores p ON l.proveedor_id = p.id WHERE l.fecha_recepcion BETWEEN ? AND ? ORDER BY l.fecha_recepcion DESC")
            .bind(desde).bind(hasta).fetch_all(pool).await.map_err(|e| e.to_string())?
    } else {
        sqlx::query_as("SELECT l.id, l.ingrediente_id, i.nombre AS ingrediente_nombre, l.proveedor_id, p.nombre AS proveedor_nombre, l.numero_lote, DATE_FORMAT(l.fecha_recepcion, '%Y-%m-%d') AS fecha_recepcion, DATE_FORMAT(l.fecha_caducidad, '%Y-%m-%d') AS fecha_caducidad, CAST(l.cantidad_recibida AS DOUBLE) AS cantidad_recibida, l.unidad, l.albaran_id, l.notas FROM lotes_ingredientes l LEFT JOIN ingredientes i ON l.ingrediente_id = i.id LEFT JOIN proveedores p ON l.proveedor_id = p.id ORDER BY l.fecha_recepcion DESC")
            .fetch_all(pool).await.map_err(|e| e.to_string())?
    };
    Ok(rows)
}

#[tauri::command]
async fn create_lote(input: LoteInput) -> Result<i64, String> {
    let pool = &db::get_pool();
    let result = sqlx::query("INSERT INTO lotes_ingredientes (ingrediente_id, proveedor_id, numero_lote, fecha_recepcion, fecha_caducidad, cantidad_recibida, unidad, albaran_id, notas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(input.ingrediente_id).bind(input.proveedor_id).bind(&input.numero_lote)
        .bind(&input.fecha_recepcion).bind(&input.fecha_caducidad)
        .bind(input.cantidad_recibida).bind(&input.unidad)
        .bind(input.albaran_id).bind(&input.notas)
        .execute(pool).await.map_err(|e| e.to_string())?;
    Ok(result.last_insert_id() as i64)
}

#[tauri::command]
async fn update_lote(id: i64, input: LoteInput) -> Result<(), String> {
    let pool = &db::get_pool();
    sqlx::query("UPDATE lotes_ingredientes SET ingrediente_id = ?, proveedor_id = ?, numero_lote = ?, fecha_recepcion = ?, fecha_caducidad = ?, cantidad_recibida = ?, unidad = ?, albaran_id = ?, notas = ? WHERE id = ?")
        .bind(input.ingrediente_id).bind(input.proveedor_id).bind(&input.numero_lote)
        .bind(&input.fecha_recepcion).bind(&input.fecha_caducidad)
        .bind(input.cantidad_recibida).bind(&input.unidad)
        .bind(input.albaran_id).bind(&input.notas)
        .bind(id).execute(pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn delete_lote(id: i64) -> Result<(), String> {
    let pool = &db::get_pool();
    sqlx::query("DELETE FROM lotes_ingredientes WHERE id = ?").bind(id).execute(pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn generar_numero_lote() -> Result<String, String> {
    let pool = &db::get_pool();
    let today = chrono::Local::now().format("%Y%m%d").to_string();
    let prefix = format!("L-{}-", today);
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM lotes_ingredientes WHERE numero_lote LIKE ?")
        .bind(format!("{}%", prefix))
        .fetch_one(pool).await.map_err(|e| e.to_string())?;
    Ok(format!("{}{:03}", prefix, count + 1))
}

#[tauri::command]
async fn get_lotes_proximos_caducar(dias: i32) -> Result<Vec<LoteIngrediente>, String> {
    let pool = &db::get_pool();
    let rows: Vec<LoteIngrediente> = sqlx::query_as("SELECT l.id, l.ingrediente_id, i.nombre AS ingrediente_nombre, l.proveedor_id, p.nombre AS proveedor_nombre, l.numero_lote, DATE_FORMAT(l.fecha_recepcion, '%Y-%m-%d') AS fecha_recepcion, DATE_FORMAT(l.fecha_caducidad, '%Y-%m-%d') AS fecha_caducidad, CAST(l.cantidad_recibida AS DOUBLE) AS cantidad_recibida, l.unidad, l.albaran_id, l.notas FROM lotes_ingredientes l LEFT JOIN ingredientes i ON l.ingrediente_id = i.id LEFT JOIN proveedores p ON l.proveedor_id = p.id WHERE l.fecha_caducidad IS NOT NULL AND l.fecha_caducidad <= DATE_ADD(CURDATE(), INTERVAL ? DAY) ORDER BY l.fecha_caducidad ASC")
        .bind(dias).fetch_all(pool).await.map_err(|e| e.to_string())?;
    Ok(rows)
}

// ========================================
// TRAZABILIDAD - PRODUCCION
// ========================================

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Produccion {
    pub id: i64,
    pub receta_id: i64,
    pub receta_nombre: Option<String>,
    pub fecha_elaboracion: String,
    pub cantidad_producida: i32,
    pub lote_producto: String,
    pub fecha_caducidad: Option<String>,
    pub responsable: Option<String>,
    pub notas: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProduccionInput {
    pub receta_id: i64,
    pub fecha_elaboracion: String,
    pub cantidad_producida: i32,
    pub lote_producto: String,
    pub fecha_caducidad: Option<String>,
    pub responsable: Option<String>,
    pub notas: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct ProduccionDetalle {
    pub id: i64,
    pub produccion_id: i64,
    pub lote_ingrediente_id: i64,
    pub lote_numero: Option<String>,
    pub ingrediente_nombre: Option<String>,
    pub cantidad_utilizada: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProduccionDetalleInput {
    pub lote_ingrediente_id: i64,
    pub cantidad_utilizada: f64,
}

#[tauri::command]
async fn get_produccion(fecha_desde: Option<String>, fecha_hasta: Option<String>) -> Result<Vec<Produccion>, String> {
    let pool = &db::get_pool();
    let rows: Vec<Produccion> = if let (Some(desde), Some(hasta)) = (&fecha_desde, &fecha_hasta) {
        sqlx::query_as("SELECT pr.id, pr.receta_id, r.nombre AS receta_nombre, DATE_FORMAT(pr.fecha_elaboracion, '%Y-%m-%d %H:%i') AS fecha_elaboracion, pr.cantidad_producida, pr.lote_producto, DATE_FORMAT(pr.fecha_caducidad, '%Y-%m-%d') AS fecha_caducidad, pr.responsable, pr.notas FROM produccion pr LEFT JOIN recetas r ON pr.receta_id = r.id WHERE DATE(pr.fecha_elaboracion) BETWEEN ? AND ? ORDER BY pr.fecha_elaboracion DESC")
            .bind(desde).bind(hasta).fetch_all(pool).await.map_err(|e| e.to_string())?
    } else {
        sqlx::query_as("SELECT pr.id, pr.receta_id, r.nombre AS receta_nombre, DATE_FORMAT(pr.fecha_elaboracion, '%Y-%m-%d %H:%i') AS fecha_elaboracion, pr.cantidad_producida, pr.lote_producto, DATE_FORMAT(pr.fecha_caducidad, '%Y-%m-%d') AS fecha_caducidad, pr.responsable, pr.notas FROM produccion pr LEFT JOIN recetas r ON pr.receta_id = r.id ORDER BY pr.fecha_elaboracion DESC")
            .fetch_all(pool).await.map_err(|e| e.to_string())?
    };
    Ok(rows)
}

#[tauri::command]
async fn create_produccion(input: ProduccionInput, detalles: Vec<ProduccionDetalleInput>) -> Result<i64, String> {
    let pool = &db::get_pool();
    let result = sqlx::query("INSERT INTO produccion (receta_id, fecha_elaboracion, cantidad_producida, lote_producto, fecha_caducidad, responsable, notas) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(input.receta_id).bind(&input.fecha_elaboracion).bind(input.cantidad_producida)
        .bind(&input.lote_producto).bind(&input.fecha_caducidad)
        .bind(&input.responsable).bind(&input.notas)
        .execute(pool).await.map_err(|e| e.to_string())?;
    let produccion_id = result.last_insert_id() as i64;
    for d in &detalles {
        sqlx::query("INSERT INTO produccion_detalle (produccion_id, lote_ingrediente_id, cantidad_utilizada) VALUES (?, ?, ?)")
            .bind(produccion_id).bind(d.lote_ingrediente_id).bind(d.cantidad_utilizada)
            .execute(pool).await.map_err(|e| e.to_string())?;
    }
    Ok(produccion_id)
}

#[tauri::command]
async fn delete_produccion(id: i64) -> Result<(), String> {
    let pool = &db::get_pool();
    sqlx::query("DELETE FROM produccion_detalle WHERE produccion_id = ?").bind(id).execute(pool).await.map_err(|e| e.to_string())?;
    sqlx::query("DELETE FROM produccion WHERE id = ?").bind(id).execute(pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_produccion_detalles(produccion_id: i64) -> Result<Vec<ProduccionDetalle>, String> {
    let pool = &db::get_pool();
    let rows: Vec<ProduccionDetalle> = sqlx::query_as("SELECT pd.id, pd.produccion_id, pd.lote_ingrediente_id, l.numero_lote AS lote_numero, i.nombre AS ingrediente_nombre, CAST(pd.cantidad_utilizada AS DOUBLE) AS cantidad_utilizada FROM produccion_detalle pd LEFT JOIN lotes_ingredientes l ON pd.lote_ingrediente_id = l.id LEFT JOIN ingredientes i ON l.ingrediente_id = i.id WHERE pd.produccion_id = ?")
        .bind(produccion_id).fetch_all(pool).await.map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
async fn generar_lote_produccion() -> Result<String, String> {
    let pool = &db::get_pool();
    let today = chrono::Local::now().format("%Y%m%d").to_string();
    let prefix = format!("P-{}-", today);
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM produccion WHERE lote_producto LIKE ?")
        .bind(format!("{}%", prefix))
        .fetch_one(pool).await.map_err(|e| e.to_string())?;
    Ok(format!("{}{:03}", prefix, count.0 + 1))
}

#[tauri::command]
async fn get_produccion_hoy() -> Result<Vec<Produccion>, String> {
    let pool = &db::get_pool();
    let rows: Vec<Produccion> = sqlx::query_as("SELECT pr.id, pr.receta_id, r.nombre AS receta_nombre, DATE_FORMAT(pr.fecha_elaboracion, '%Y-%m-%d %H:%i') AS fecha_elaboracion, pr.cantidad_producida, pr.lote_producto, DATE_FORMAT(pr.fecha_caducidad, '%Y-%m-%d') AS fecha_caducidad, pr.responsable, pr.notas FROM produccion pr LEFT JOIN recetas r ON pr.receta_id = r.id WHERE DATE(pr.fecha_elaboracion) = CURDATE() ORDER BY pr.fecha_elaboracion DESC")
        .fetch_all(pool).await.map_err(|e| e.to_string())?;
    Ok(rows)
}

// ========================================
// ETIQUETAS
// ========================================

#[derive(Debug, Serialize, Deserialize)]
pub struct EtiquetaData {
    pub produccion_id: i64,
    pub receta_nombre: String,
    pub lote_producto: String,
    pub fecha_elaboracion: String,
    pub fecha_caducidad: Option<String>,
    pub ingredientes: Vec<String>,
    pub alergenos: Vec<String>,
    pub conservacion: Option<String>,
    pub responsable: Option<String>,
}

#[tauri::command]
async fn get_etiqueta_data(produccion_id: i64) -> Result<EtiquetaData, String> {
    let pool = &db::get_pool();

    let prod: Option<Produccion> = sqlx::query_as("SELECT pr.id, pr.receta_id, r.nombre AS receta_nombre, DATE_FORMAT(pr.fecha_elaboracion, '%Y-%m-%d %H:%i') AS fecha_elaboracion, pr.cantidad_producida, pr.lote_producto, DATE_FORMAT(pr.fecha_caducidad, '%Y-%m-%d') AS fecha_caducidad, pr.responsable, pr.notas FROM produccion pr LEFT JOIN recetas r ON pr.receta_id = r.id WHERE pr.id = ?")
        .bind(produccion_id).fetch_optional(pool).await.map_err(|e| e.to_string())?;
    let prod = prod.ok_or("Producción no encontrada")?;

    // Get ingredient names from recipe
    let ingredientes: Vec<(String,)> = sqlx::query_as(
        "SELECT DISTINCT i.nombre FROM receta_ingredientes ri LEFT JOIN ingredientes i ON ri.ingrediente_id = i.id WHERE ri.receta_id = ? AND i.nombre IS NOT NULL"
    ).bind(prod.receta_id).fetch_all(pool).await.map_err(|e| e.to_string())?;

    // Get allergens from recipe ingredients
    let alergenos: Vec<(String,)> = sqlx::query_as(
        "SELECT DISTINCT i.alergenos FROM receta_ingredientes ri LEFT JOIN ingredientes i ON ri.ingrediente_id = i.id WHERE ri.receta_id = ? AND i.alergenos IS NOT NULL AND i.alergenos != '' AND i.alergenos != '[]'"
    ).bind(prod.receta_id).fetch_all(pool).await.map_err(|e| e.to_string())?;

    // Parse allergens from JSON arrays
    let mut all_alergenos: Vec<String> = Vec::new();
    for (alerg_json,) in alergenos {
        if let Ok(arr) = serde_json::from_str::<Vec<String>>(&alerg_json) {
            for a in arr {
                if !all_alergenos.contains(&a) {
                    all_alergenos.push(a);
                }
            }
        }
    }

    // Get conservacion from ficha tecnica
    let conservacion: Option<(Option<String>,)> = sqlx::query_as(
        "SELECT conservacion FROM fichas_tecnicas WHERE receta_id = ?"
    ).bind(prod.receta_id).fetch_optional(pool).await.map_err(|e| e.to_string())?;

    Ok(EtiquetaData {
        produccion_id: prod.id,
        receta_nombre: prod.receta_nombre.unwrap_or_default(),
        lote_producto: prod.lote_producto,
        fecha_elaboracion: prod.fecha_elaboracion,
        fecha_caducidad: prod.fecha_caducidad,
        ingredientes: ingredientes.into_iter().map(|(n,)| n).collect(),
        alergenos: all_alergenos,
        conservacion: conservacion.and_then(|(c,)| c),
        responsable: prod.responsable,
    })
}

// ========================================
// CONFIGURACION
// ========================================

#[tauri::command]
fn get_db_configs() -> Vec<db::DbConfig> {
    db::get_all_configs()
}

#[tauri::command]
fn add_db_config(config: db::DbConfig) -> Vec<db::DbConfig> {
    db::add_config(config)
}

#[tauri::command]
fn update_db_config(config: db::DbConfig) -> Vec<db::DbConfig> {
    db::update_config(config)
}

#[tauri::command]
fn delete_db_config(id: String) -> Vec<db::DbConfig> {
    db::delete_config(&id)
}

#[tauri::command]
fn set_active_db(id: String) -> Vec<db::DbConfig> {
    db::set_active(&id)
}

#[tauri::command]
async fn test_db_connection(config: db::DbConfig) -> Result<String, String> {
    let url = db::build_url_public(&config);
    let pool = sqlx::mysql::MySqlPool::connect(&url)
        .await
        .map_err(|e| format!("Error de conexión: {}", e))?;
    // Test with a simple query
    sqlx::query("SELECT 1")
        .execute(&pool)
        .await
        .map_err(|e| format!("Error en query de prueba: {}", e))?;
    pool.close().await;
    Ok("Conexión exitosa".to_string())
}

#[tauri::command]
async fn activate_and_switch_db(id: String) -> Result<Vec<db::DbConfig>, String> {
    let configs = db::set_active(&id);
    let active = configs.iter().find(|c| c.activa).ok_or("No hay config activa")?;
    db::switch_db(active).await.map_err(|e| e.to_string())?;
    Ok(configs)
}

// ========================================
// IMPRESORAS
// ========================================

#[derive(Serialize, Deserialize)]
struct PrinterInfo {
    name: String,
    is_default: bool,
}

#[tauri::command]
async fn get_printers() -> Result<Vec<PrinterInfo>, String> {
    #[cfg(target_os = "windows")]
    {
        let output = std::process::Command::new("powershell")
            .args(["-Command", "Get-Printer | Select-Object Name, Default | ConvertTo-Json"])
            .output()
            .map_err(|e| e.to_string())?;
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        if stdout.trim().is_empty() {
            return Ok(vec![]);
        }
        let printers: Vec<PrinterInfo> = if stdout.trim().starts_with('[') {
            serde_json::from_str(&stdout).map_err(|e| e.to_string())?
        } else {
            let p: PrinterInfo = serde_json::from_str(&stdout).map_err(|e| e.to_string())?;
            vec![p]
        };
        return Ok(printers);
    }
    #[cfg(target_os = "linux")]
    {
        let output = std::process::Command::new("lpstat")
            .args(["-p"])
            .output()
            .map_err(|e| e.to_string())?;
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let default_output = std::process::Command::new("lpstat")
            .args(["-d"])
            .output()
            .map_err(|e| e.to_string())?;
        let default_str = String::from_utf8_lossy(&default_output.stdout).to_string();
        let default_name = default_str.trim().trim_start_matches("system default destination: ").trim().to_string();
        let mut printers = vec![];
        for line in stdout.lines() {
            if line.starts_with("printer ") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    printers.push(PrinterInfo {
                        name: parts[1].to_string(),
                        is_default: parts[1] == default_name,
                    });
                }
            }
        }
        return Ok(printers);
    }
}

#[tauri::command]
async fn print_pdf_file(path: String, printer_name: Option<String>) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let printer_arg = printer_name.unwrap_or_default();
        let ps_script = if printer_arg.is_empty() {
            format!("Start-Process -FilePath '{}' -Verb Print", path)
        } else {
            format!(
                "Start-Process -FilePath '{}' -Verb PrintTo -ArgumentList '{}'",
                path, printer_arg
            )
        };
        let output = std::process::Command::new("powershell")
            .args(["-Command", &ps_script])
            .output()
            .map_err(|e| e.to_string())?;
        if output.status.success() {
            Ok("Impresión enviada".to_string())
        } else {
            Err(String::from_utf8_lossy(&output.stderr).to_string())
        }
    }
    #[cfg(target_os = "linux")]
    {
        let mut args = vec![];
        if let Some(ref name) = printer_name {
            args.push("-d");
            args.push(name);
        }
        args.push(&path);
        let output = std::process::Command::new("lp")
            .args(&args)
            .output()
            .map_err(|e| e.to_string())?;
        if output.status.success() {
            Ok("Impresión enviada".to_string())
        } else {
            Err(String::from_utf8_lossy(&output.stderr).to_string())
        }
    }
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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let config_dir = app.path().app_config_dir().expect("Failed to get app config dir");
            std::fs::create_dir_all(&config_dir).ok();
            db::init_config_path(config_dir);
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
            get_recetas_base,
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
            get_guarniciones,
            create_guarnicion,
            update_guarnicion,
            delete_guarnicion,
            get_guarnicion_ingredientes,
            add_guarnicion_ingrediente,
            delete_guarnicion_ingrediente,
            get_receta_guarniciones,
            add_receta_guarnicion,
            delete_receta_guarnicion,
            get_guarnicion_coste,
            get_fichas_tecnicas,
            get_ficha_tecnica,
            create_ficha_tecnica,
            update_ficha_tecnica,
            delete_ficha_tecnica,
            get_ventas,
            import_ventas,
            delete_venta,
            get_ventas_por_plato,
            get_menu_engineering,
            get_contabilidad,
            get_recetas_base,
            get_db_configs,
            add_db_config,
            update_db_config,
            delete_db_config,
            set_active_db,
            test_db_connection,
            activate_and_switch_db,
            get_lotes,
            create_lote,
            update_lote,
            delete_lote,
            generar_numero_lote,
            get_lotes_proximos_caducar,
            get_produccion,
            create_produccion,
            delete_produccion,
            get_produccion_detalles,
            generar_lote_produccion,
            get_produccion_hoy,
            get_etiqueta_data,
            get_printers,
            print_pdf_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
