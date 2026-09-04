mod db;

use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Row};
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
    pub precio: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Receta {
    pub id: i64,
    pub nombre: String,
    pub descripcion: Option<String>,
    pub elaboracion: Option<String>,
    pub conservacion: Option<String>,
    pub regeneracion: Option<String>,
    pub vida_util: Option<String>,
    pub categoria: Option<String>,
    pub porciones: i32,
    pub tiempo_preparacion: Option<i32>,
    pub es_base: bool,
    pub precio_venta: Option<f64>,
    pub margen_porcentaje: Option<f64>,
    pub peso_por_racion: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct RecetaInput {
    pub nombre: String,
    pub descripcion: Option<String>,
    pub elaboracion: Option<String>,
    pub conservacion: Option<String>,
    pub regeneracion: Option<String>,
    pub vida_util: Option<String>,
    pub categoria: Option<String>,
    pub porciones: Option<i32>,
    pub tiempo_preparacion: Option<i32>,
    pub es_base: Option<bool>,
    pub precio_venta: Option<f64>,
    pub margen_porcentaje: Option<f64>,
    pub peso_por_racion: Option<f64>,
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
    let rows = sqlx::query(
        "SELECT i.id, i.nombre, i.unidad_base, i.categoria, i.alergenos, CAST(ip.precio_por_unidad_base AS DOUBLE) AS precio, p.nombre AS proveedor_nombre FROM ingredientes i LEFT JOIN ingrediente_precios ip ON i.id = ip.ingrediente_id AND ip.es_predeterminado = 1 LEFT JOIN proveedores p ON ip.proveedor_id = p.id ORDER BY i.nombre"
    )
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;
    let result: Vec<Ingrediente> = rows.iter().map(|r| {
        Ingrediente {
            id: r.try_get("id").unwrap_or_default(),
            nombre: r.try_get("nombre").unwrap_or_default(),
            unidad_base: r.try_get("unidad_base").unwrap_or_default(),
            categoria: r.try_get("categoria").ok().flatten(),
            alergenos: r.try_get("alergenos").ok().flatten(),
            precio: r.try_get::<f64, _>("precio").ok(),
            proveedor_nombre: r.try_get("proveedor_nombre").ok().flatten(),
        }
    }).collect();
    Ok(result)
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
    let ingrediente_id = result.last_insert_id() as i64;

    if let Some(precio) = input.precio {
        if precio > 0.0 {
            let existing: Option<(i64,)> = sqlx::query_as(
                "SELECT id FROM ingrediente_precios WHERE ingrediente_id = ? AND es_predeterminado = 1 LIMIT 1"
            ).bind(ingrediente_id).fetch_optional(pool).await.ok().flatten();
            if let Some((prec_id,)) = existing {
                sqlx::query("UPDATE ingrediente_precios SET precio_por_unidad_base = ? WHERE id = ?")
                    .bind(precio).bind(prec_id).execute(pool).await.ok();
            } else {
                sqlx::query(
                    "INSERT INTO ingrediente_precios (ingrediente_id, proveedor_id, precio, cantidad, unidad, precio_por_unidad_base, es_predeterminado) SELECT ?, id, ?, 1, ?, ?, 1 FROM proveedores LIMIT 1"
                ).bind(ingrediente_id).bind(precio).bind(&input.unidad_base).bind(precio).execute(pool).await.ok();
            }
        }
    }

    Ok(ingrediente_id)
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

    if let Some(precio) = input.precio {
        if precio > 0.0 {
            let existing: Option<(i64,)> = sqlx::query_as(
                "SELECT id FROM ingrediente_precios WHERE ingrediente_id = ? AND es_predeterminado = 1 LIMIT 1"
            ).bind(id).fetch_optional(pool).await.ok().flatten();
            if let Some((prec_id,)) = existing {
                sqlx::query("UPDATE ingrediente_precios SET precio_por_unidad_base = ? WHERE id = ?")
                    .bind(precio).bind(prec_id).execute(pool).await.ok();
            } else {
                sqlx::query(
                    "INSERT INTO ingrediente_precios (ingrediente_id, proveedor_id, precio, cantidad, unidad, precio_por_unidad_base, es_predeterminado) SELECT ?, id, ?, 1, ?, ?, 1 FROM proveedores LIMIT 1"
                ).bind(id).bind(precio).bind(&input.unidad_base).bind(precio).execute(pool).await.ok();
            }
        }
    }

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
    let sql = "SELECT id, nombre, descripcion, elaboracion, conservacion, regeneracion, vida_util, categoria, porciones, tiempo_preparacion, es_base, CAST(precio_venta AS DOUBLE) AS precio_venta, CAST(margen_porcentaje AS DOUBLE) AS margen_porcentaje, CAST(peso_por_racion AS DOUBLE) AS peso_por_racion FROM recetas ORDER BY nombre";
    let rows = sqlx::query(sql).fetch_all(pool).await.map_err(|e| e.to_string())?;
    let result: Vec<Receta> = rows.iter().map(|r| {
        Receta {
            id: r.try_get("id").unwrap_or_default(),
            nombre: r.try_get("nombre").unwrap_or_default(),
            descripcion: r.try_get("descripcion").ok().flatten(),
            elaboracion: r.try_get("elaboracion").ok().flatten(),
            conservacion: r.try_get("conservacion").ok().flatten(),
            regeneracion: r.try_get("regeneracion").ok().flatten(),
            vida_util: r.try_get("vida_util").ok().flatten(),
            categoria: r.try_get("categoria").ok().flatten(),
            porciones: r.try_get("porciones").unwrap_or_default(),
            tiempo_preparacion: r.try_get("tiempo_preparacion").ok().flatten(),
            es_base: r.try_get("es_base").unwrap_or_default(),
            precio_venta: r.try_get::<Option<f64>, _>("precio_venta").ok().flatten(),
            margen_porcentaje: r.try_get::<Option<f64>, _>("margen_porcentaje").ok().flatten(),
            peso_por_racion: r.try_get::<Option<f64>, _>("peso_por_racion").ok().flatten(),
        }
    }).collect();
    Ok(result)
}

#[tauri::command]
async fn create_receta(input: RecetaInput) -> Result<i64, String> {
    let pool = &db::get_pool();
    let result = sqlx::query(
        "INSERT INTO recetas (nombre, descripcion, elaboracion, conservacion, regeneracion, vida_util, categoria, porciones, tiempo_preparacion, es_base, precio_venta, margen_porcentaje, peso_por_racion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&input.nombre)
    .bind(&input.descripcion)
    .bind(&input.elaboracion)
    .bind(&input.conservacion)
    .bind(&input.regeneracion)
    .bind(&input.vida_util)
    .bind(&input.categoria)
    .bind(input.porciones.unwrap_or(1))
    .bind(input.tiempo_preparacion)
    .bind(input.es_base.unwrap_or(false))
    .bind(input.precio_venta)
    .bind(input.margen_porcentaje)
    .bind(input.peso_por_racion)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(result.last_insert_id() as i64)
}

#[tauri::command]
async fn update_receta(id: i64, input: RecetaInput) -> Result<(), String> {
    let pool = &db::get_pool();
    sqlx::query(
        "UPDATE recetas SET nombre = ?, descripcion = ?, elaboracion = ?, conservacion = ?, regeneracion = ?, vida_util = ?, categoria = ?, porciones = ?, tiempo_preparacion = ?, es_base = ?, precio_venta = ?, margen_porcentaje = ?, peso_por_racion = ? WHERE id = ?"
    )
    .bind(&input.nombre)
    .bind(&input.descripcion)
    .bind(&input.elaboracion)
    .bind(&input.conservacion)
    .bind(&input.regeneracion)
    .bind(&input.vida_util)
    .bind(&input.categoria)
    .bind(input.porciones.unwrap_or(1))
    .bind(input.tiempo_preparacion)
    .bind(input.es_base.unwrap_or(false))
    .bind(input.precio_venta)
    .bind(input.margen_porcentaje)
    .bind(input.peso_por_racion)
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

#[derive(Debug, Deserialize)]
pub struct IngredienteRecalculo {
    pub receta_ingrediente_id: i64,
    pub nueva_cantidad: f64,
}

#[tauri::command]
async fn update_receta_completa(receta_id: i64, nuevas_porciones: i32, ingredientes: Vec<IngredienteRecalculo>) -> Result<(), String> {
    let pool = &db::get_pool();
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query("UPDATE recetas SET porciones = ? WHERE id = ?")
        .bind(nuevas_porciones)
        .bind(receta_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    for ing in &ingredientes {
        if ing.nueva_cantidad <= 0.0 {
            return Err(format!("Cantidad inválida para ingrediente {}: {}", ing.receta_ingrediente_id, ing.nueva_cantidad));
        }
        let result = sqlx::query("UPDATE receta_ingredientes SET cantidad = ? WHERE id = ? AND receta_id = ?")
            .bind(ing.nueva_cantidad)
            .bind(ing.receta_ingrediente_id)
            .bind(receta_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
        if result.rows_affected() == 0 {
            eprintln!("WARNING: No se actualizó ingrediente id={} para receta_id={}", ing.receta_ingrediente_id, receta_id);
        }
    }

    tx.commit().await.map_err(|e| e.to_string())?;
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
    pub orden: Option<i32>,
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
    let sql = "SELECT ri.id, ri.receta_id, ri.ingrediente_id, i.nombre AS ingrediente_nombre, ri.sub_receta_id, sr.nombre AS sub_receta_nombre, CAST(ri.cantidad AS DOUBLE) AS cantidad, ri.unidad, CAST(ri.merma_porcentaje AS DOUBLE) AS merma_porcentaje, ri.notas, ri.orden FROM receta_ingredientes ri LEFT JOIN ingredientes i ON ri.ingrediente_id = i.id LEFT JOIN recetas sr ON ri.sub_receta_id = sr.id WHERE ri.receta_id = ? ORDER BY ri.orden";
    let rows = sqlx::query(sql).bind(receta_id).fetch_all(pool).await.map_err(|e| e.to_string())?;
    let result: Vec<RecetaIngredienteConNombre> = rows.iter().map(|r| {
        RecetaIngredienteConNombre {
            id: r.try_get("id").unwrap_or_default(),
            receta_id: r.try_get("receta_id").unwrap_or_default(),
            ingrediente_id: r.try_get("ingrediente_id").ok().flatten(),
            ingrediente_nombre: r.try_get("ingrediente_nombre").ok().flatten(),
            sub_receta_id: r.try_get("sub_receta_id").ok().flatten(),
            sub_receta_nombre: r.try_get("sub_receta_nombre").ok().flatten(),
            cantidad: r.try_get::<f64, _>("cantidad").unwrap_or(0.0),
            unidad: r.try_get("unidad").unwrap_or_default(),
            merma_porcentaje: r.try_get::<f64, _>("merma_porcentaje").unwrap_or(0.0),
            notas: r.try_get("notas").ok().flatten(),
            orden: r.try_get("orden").ok().flatten(),
        }
    }).collect();
    Ok(result)
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
    let new_id = result.last_insert_id() as i64;
    Ok(new_id)
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
    let sql = "SELECT id, nombre, descripcion, elaboracion, conservacion, regeneracion, vida_util, categoria, porciones, tiempo_preparacion, es_base, CAST(precio_venta AS DOUBLE) AS precio_venta, CAST(margen_porcentaje AS DOUBLE) AS margen_porcentaje, CAST(peso_por_racion AS DOUBLE) AS peso_por_racion FROM recetas WHERE es_base = 1 ORDER BY nombre";
    let rows = sqlx::query(sql).fetch_all(pool).await.map_err(|e| e.to_string())?;
    let result: Vec<Receta> = rows.iter().map(|r| {
        Receta {
            id: r.try_get("id").unwrap_or_default(),
            nombre: r.try_get("nombre").unwrap_or_default(),
            descripcion: r.try_get("descripcion").ok().flatten(),
            elaboracion: r.try_get("elaboracion").ok().flatten(),
            conservacion: r.try_get("conservacion").ok().flatten(),
            regeneracion: r.try_get("regeneracion").ok().flatten(),
            vida_util: r.try_get("vida_util").ok().flatten(),
            categoria: r.try_get("categoria").ok().flatten(),
            porciones: r.try_get("porciones").unwrap_or_default(),
            tiempo_preparacion: r.try_get("tiempo_preparacion").ok().flatten(),
            es_base: r.try_get("es_base").unwrap_or_default(),
            precio_venta: r.try_get::<Option<f64>, _>("precio_venta").ok().flatten(),
            margen_porcentaje: r.try_get::<Option<f64>, _>("margen_porcentaje").ok().flatten(),
            peso_por_racion: r.try_get::<Option<f64>, _>("peso_por_racion").ok().flatten(),
        }
    }).collect();
    Ok(result)
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

    let receta = sqlx::query(
        "SELECT id, nombre, descripcion, elaboracion, conservacion, regeneracion, vida_util, categoria, porciones, tiempo_preparacion, es_base, CAST(precio_venta AS DOUBLE) AS precio_venta, CAST(margen_porcentaje AS DOUBLE) AS margen_porcentaje, CAST(peso_por_racion AS DOUBLE) AS peso_por_racion FROM recetas WHERE id = ?"
    )
    .bind(receta_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?
    .ok_or("Receta no encontrada".to_string())?;

    let receta = Receta {
        id: receta.try_get("id").unwrap_or_default(),
        nombre: receta.try_get("nombre").unwrap_or_default(),
        descripcion: receta.try_get("descripcion").ok().flatten(),
        elaboracion: receta.try_get("elaboracion").ok().flatten(),
        conservacion: receta.try_get("conservacion").ok().flatten(),
        regeneracion: receta.try_get("regeneracion").ok().flatten(),
        vida_util: receta.try_get("vida_util").ok().flatten(),
        categoria: receta.try_get("categoria").ok().flatten(),
        porciones: receta.try_get("porciones").unwrap_or_default(),
        tiempo_preparacion: receta.try_get("tiempo_preparacion").ok().flatten(),
        es_base: receta.try_get("es_base").unwrap_or_default(),
        precio_venta: receta.try_get::<Option<f64>, _>("precio_venta").ok().flatten(),
        margen_porcentaje: receta.try_get::<Option<f64>, _>("margen_porcentaje").ok().flatten(),
        peso_por_racion: receta.try_get::<Option<f64>, _>("peso_por_racion").ok().flatten(),
    };

    // Fetch ALL receta_ingredientes (regular ingredients + sub-recipes)
    let all_ri_rows = sqlx::query(
        "SELECT ri.id, ri.ingrediente_id, ri.sub_receta_id, CAST(ri.cantidad AS DOUBLE) AS cantidad, ri.unidad, CAST(ri.merma_porcentaje AS DOUBLE) AS merma_porcentaje FROM receta_ingredientes ri WHERE ri.receta_id = ?"
    )
    .bind(receta_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let all_ri: Vec<(i64, Option<i64>, Option<i64>, f64, String, f64)> = all_ri_rows.iter().map(|r| {
        (
            r.try_get("id").unwrap_or_default(),
            r.try_get("ingrediente_id").ok().flatten(),
            r.try_get("sub_receta_id").ok().flatten(),
            r.try_get::<f64, _>("cantidad").unwrap_or(0.0),
            r.try_get("unidad").unwrap_or_default(),
            r.try_get::<f64, _>("merma_porcentaje").unwrap_or(0.0),
        )
    }).collect();

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
            let sub_info: Option<(String, f64)> = {
                let sql = "SELECT nombre, CAST(porciones AS DOUBLE) FROM recetas WHERE id = ?";
                let row = sqlx::query(sql).bind(sub_rid).fetch_optional(pool).await.map_err(|e| e.to_string())?;
                row.map(|r| {
                    (r.try_get::<String, _>("nombre").unwrap_or_default(),
                     r.try_get::<f64, _>("porciones").unwrap_or(0.0))
                })
            };

            if let Some((sub_nombre, sub_porciones)) = sub_info {
                // Get cost of all ingredients in the sub-recipe
                let sub_coste_opt: Option<f64> = sqlx::query(
                    "SELECT CAST(SUM(ri2.cantidad * COALESCE(ip.precio_por_unidad_base, 0) * (1 + ri2.merma_porcentaje / 100)) AS DOUBLE) FROM receta_ingredientes ri2 LEFT JOIN ingrediente_precios ip ON ri2.ingrediente_id = ip.ingrediente_id AND ip.es_predeterminado = 1 WHERE ri2.receta_id = ?"
                )
                .bind(sub_rid).fetch_optional(pool).await.map_err(|e| e.to_string())?
                .and_then(|r| r.try_get::<f64, _>(0).ok());

                let sub_coste_total = sub_coste_opt.unwrap_or(0.0);
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

            let precio_row: Option<f64> = sqlx::query(
                "SELECT CAST(precio_por_unidad_base AS DOUBLE) FROM ingrediente_precios WHERE ingrediente_id = ? AND es_predeterminado = 1 LIMIT 1"
            )
            .bind(iid).fetch_optional(pool).await.map_err(|e| e.to_string())?
            .and_then(|r| r.try_get::<f64, _>(0).ok());

            let precio_unitario = precio_row;

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
    let sql = "SELECT mr.id, mr.menu_id, mr.receta_id, r.nombre AS receta_nombre, CAST(mr.precio_venta AS DOUBLE) AS precio_venta, mr.orden FROM menu_recetas mr INNER JOIN recetas r ON mr.receta_id = r.id WHERE mr.menu_id = ? ORDER BY mr.orden";
    let rows = sqlx::query(sql).bind(menu_id).fetch_all(pool).await.map_err(|e| e.to_string())?;
    let result: Vec<MenuReceta> = rows.iter().map(|r| {
        MenuReceta {
            id: r.try_get("id").unwrap_or_default(),
            menu_id: r.try_get("menu_id").unwrap_or_default(),
            receta_id: r.try_get("receta_id").unwrap_or_default(),
            receta_nombre: r.try_get("receta_nombre").ok().flatten(),
            precio_venta: r.try_get::<Option<f64>, _>("precio_venta").ok().flatten(),
            orden: r.try_get("orden").unwrap_or_default(),
        }
    }).collect();
    Ok(result)
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
    let sql = "SELECT a.id, a.proveedor_id, p.nombre AS proveedor_nombre, a.numero_albaran, DATE_FORMAT(a.fecha_recepcion, '%Y-%m-%d') AS fecha_recepcion, CAST(a.total AS DOUBLE) AS total, a.notas, a.procesado FROM albaranes a LEFT JOIN proveedores p ON a.proveedor_id = p.id ORDER BY a.fecha_recepcion DESC";
    let rows = sqlx::query(sql).fetch_all(pool).await.map_err(|e| e.to_string())?;
    let result: Vec<Albaran> = rows.iter().map(|r| {
        Albaran {
            id: r.try_get("id").unwrap_or_default(),
            proveedor_id: r.try_get("proveedor_id").unwrap_or_default(),
            proveedor_nombre: r.try_get("proveedor_nombre").ok().flatten(),
            numero_albaran: r.try_get("numero_albaran").ok().flatten(),
            fecha_recepcion: r.try_get("fecha_recepcion").unwrap_or_default(),
            total: r.try_get::<Option<f64>, _>("total").ok().flatten(),
            notas: r.try_get("notas").ok().flatten(),
            procesado: r.try_get("procesado").unwrap_or_default(),
        }
    }).collect();
    Ok(result)
}

#[tauri::command]
async fn get_albaran(id: i64) -> Result<Albaran, String> {
    let pool = &db::get_pool();
    let row = sqlx::query(
        "SELECT a.id, a.proveedor_id, p.nombre AS proveedor_nombre, a.numero_albaran, DATE_FORMAT(a.fecha_recepcion, '%Y-%m-%d') AS fecha_recepcion, CAST(a.total AS DOUBLE) AS total, a.notas, a.procesado FROM albaranes a INNER JOIN proveedores p ON a.proveedor_id = p.id WHERE a.id = ?"
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "Albarán no encontrado".to_string())?;
    let result = Albaran {
        id: row.try_get("id").unwrap_or_default(),
        proveedor_id: row.try_get("proveedor_id").unwrap_or_default(),
        proveedor_nombre: row.try_get("proveedor_nombre").ok().flatten(),
        numero_albaran: row.try_get("numero_albaran").ok().flatten(),
        fecha_recepcion: row.try_get("fecha_recepcion").unwrap_or_default(),
        total: row.try_get::<Option<f64>, _>("total").ok().flatten(),
        notas: row.try_get("notas").ok().flatten(),
        procesado: row.try_get("procesado").unwrap_or_default(),
    };
    Ok(result)
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
    let sql = "SELECT ad.id, ad.albaran_id, ad.ingrediente_id, i.nombre AS ingrediente_nombre, CAST(ad.cantidad AS DOUBLE) AS cantidad, ad.unidad, CAST(ad.precio_unitario AS DOUBLE) AS precio_unitario, CAST(ad.subtotal AS DOUBLE) AS subtotal, CAST(ad.precio_anterior AS DOUBLE) AS precio_anterior FROM albaranes_detalle ad INNER JOIN ingredientes i ON ad.ingrediente_id = i.id WHERE ad.albaran_id = ? ORDER BY ad.id";
    let rows = sqlx::query(sql).bind(albaran_id).fetch_all(pool).await.map_err(|e| e.to_string())?;
    let result: Vec<AlbaranDetalle> = rows.iter().map(|r| {
        AlbaranDetalle {
            id: r.try_get("id").unwrap_or_default(),
            albaran_id: r.try_get("albaran_id").unwrap_or_default(),
            ingrediente_id: r.try_get("ingrediente_id").unwrap_or_default(),
            ingrediente_nombre: r.try_get("ingrediente_nombre").ok().flatten(),
            cantidad: r.try_get::<f64, _>("cantidad").unwrap_or(0.0),
            unidad: r.try_get("unidad").unwrap_or_default(),
            precio_unitario: r.try_get::<f64, _>("precio_unitario").unwrap_or(0.0),
            subtotal: r.try_get::<Option<f64>, _>("subtotal").ok().flatten(),
            precio_anterior: r.try_get::<Option<f64>, _>("precio_anterior").ok().flatten(),
        }
    }).collect();
    Ok(result)
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

    let detalles_rows = sqlx::query(
        "SELECT ad.id, ad.albaran_id, ad.ingrediente_id, i.nombre AS ingrediente_nombre, CAST(ad.cantidad AS DOUBLE) AS cantidad, ad.unidad, CAST(ad.precio_unitario AS DOUBLE) AS precio_unitario, CAST(ad.subtotal AS DOUBLE) AS subtotal, CAST(ad.precio_anterior AS DOUBLE) AS precio_anterior FROM albaranes_detalle ad INNER JOIN ingredientes i ON ad.ingrediente_id = i.id WHERE ad.albaran_id = ?"
    )
    .bind(albaran_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let detalles: Vec<AlbaranDetalle> = detalles_rows.iter().map(|r| {
        AlbaranDetalle {
            id: r.try_get("id").unwrap_or_default(),
            albaran_id: r.try_get("albaran_id").unwrap_or_default(),
            ingrediente_id: r.try_get("ingrediente_id").unwrap_or_default(),
            ingrediente_nombre: r.try_get("ingrediente_nombre").ok().flatten(),
            cantidad: r.try_get::<f64, _>("cantidad").unwrap_or(0.0),
            unidad: r.try_get("unidad").unwrap_or_default(),
            precio_unitario: r.try_get::<f64, _>("precio_unitario").unwrap_or(0.0),
            subtotal: r.try_get::<Option<f64>, _>("subtotal").ok().flatten(),
            precio_anterior: r.try_get::<Option<f64>, _>("precio_anterior").ok().flatten(),
        }
    }).collect();

    for detalle in &detalles {
        // Update price
        let current_price: Option<f64> = sqlx::query(
            "SELECT CAST(precio_por_unidad_base AS DOUBLE) FROM ingrediente_precios WHERE ingrediente_id = ? AND es_predeterminado = 1 LIMIT 1"
        )
        .bind(detalle.ingrediente_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| e.to_string())?
        .and_then(|r| r.try_get::<f64, _>(0).ok());

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
    let sql = "SELECT inv.id, inv.ingrediente_id, i.nombre AS ingrediente_nombre, i.unidad_base, CAST(inv.stock_actual AS DOUBLE) AS stock_actual, CAST(inv.stock_minimo AS DOUBLE) AS stock_minimo, inv.unidad, inv.ubicacion FROM inventario inv INNER JOIN ingredientes i ON inv.ingrediente_id = i.id ORDER BY i.nombre";
    let rows = sqlx::query(sql).fetch_all(pool).await.map_err(|e| e.to_string())?;
    let result: Vec<Inventario> = rows.iter().map(|r| {
        Inventario {
            id: r.try_get("id").unwrap_or_default(),
            ingrediente_id: r.try_get("ingrediente_id").unwrap_or_default(),
            ingrediente_nombre: r.try_get("ingrediente_nombre").ok().flatten(),
            unidad_base: r.try_get("unidad_base").ok().flatten(),
            stock_actual: r.try_get::<f64, _>("stock_actual").unwrap_or(0.0),
            stock_minimo: r.try_get::<f64, _>("stock_minimo").unwrap_or(0.0),
            unidad: r.try_get("unidad").unwrap_or_default(),
            ubicacion: r.try_get("ubicacion").ok().flatten(),
        }
    }).collect();
    Ok(result)
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
    let sql_with = "SELECT m.id, m.ingrediente_id, i.nombre AS ingrediente_nombre, m.tipo, CAST(m.cantidad AS DOUBLE) AS cantidad, m.referencia, m.albaran_id, m.receta_id, m.notas, DATE_FORMAT(m.fecha, '%Y-%m-%d %H:%i') AS fecha FROM inventario_movimientos m INNER JOIN ingredientes i ON m.ingrediente_id = i.id WHERE m.ingrediente_id = ? ORDER BY m.fecha DESC";
    let sql_all = "SELECT m.id, m.ingrediente_id, i.nombre AS ingrediente_nombre, m.tipo, CAST(m.cantidad AS DOUBLE) AS cantidad, m.referencia, m.albaran_id, m.receta_id, m.notas, DATE_FORMAT(m.fecha, '%Y-%m-%d %H:%i') AS fecha FROM inventario_movimientos m INNER JOIN ingredientes i ON m.ingrediente_id = i.id ORDER BY m.fecha DESC LIMIT 100";
    let rows = if let Some(iid) = ingrediente_id {
        sqlx::query(sql_with).bind(iid).fetch_all(pool).await.map_err(|e| e.to_string())?
    } else {
        sqlx::query(sql_all).fetch_all(pool).await.map_err(|e| e.to_string())?
    };
    let result: Vec<InventarioMovimiento> = rows.iter().map(|r| {
        InventarioMovimiento {
            id: r.try_get("id").unwrap_or_default(),
            ingrediente_id: r.try_get("ingrediente_id").unwrap_or_default(),
            ingrediente_nombre: r.try_get("ingrediente_nombre").ok().flatten(),
            tipo: r.try_get("tipo").unwrap_or_default(),
            cantidad: r.try_get::<f64, _>("cantidad").unwrap_or(0.0),
            referencia: r.try_get("referencia").ok().flatten(),
            albaran_id: r.try_get("albaran_id").ok().flatten(),
            receta_id: r.try_get("receta_id").ok().flatten(),
            notas: r.try_get("notas").ok().flatten(),
            fecha: r.try_get("fecha").unwrap_or_default(),
        }
    }).collect();
    Ok(result)
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
    let sql = "SELECT id, nombre, descripcion, porciones, CAST(margen_porcentaje AS DOUBLE) AS margen_porcentaje, CAST(precio_venta AS DOUBLE) AS precio_venta FROM guarniciones ORDER BY nombre";
    let rows = sqlx::query(sql).fetch_all(pool).await.map_err(|e| e.to_string())?;
    let result: Vec<Guarnicion> = rows.iter().map(|r| {
        Guarnicion {
            id: r.try_get("id").unwrap_or_default(),
            nombre: r.try_get("nombre").unwrap_or_default(),
            descripcion: r.try_get("descripcion").ok().flatten(),
            porciones: r.try_get("porciones").unwrap_or_default(),
            margen_porcentaje: r.try_get::<f64, _>("margen_porcentaje").unwrap_or(0.0),
            precio_venta: r.try_get::<Option<f64>, _>("precio_venta").ok().flatten(),
        }
    }).collect();
    Ok(result)
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
    let sql = "SELECT gi.id, gi.guarnicion_id, gi.ingrediente_id, i.nombre AS ingrediente_nombre, CAST(gi.cantidad AS DOUBLE) AS cantidad, gi.unidad, CAST(gi.merma_porcentaje AS DOUBLE) AS merma_porcentaje FROM guarnicion_ingredientes gi INNER JOIN ingredientes i ON gi.ingrediente_id = i.id WHERE gi.guarnicion_id = ? ORDER BY gi.id";
    let rows = sqlx::query(sql).bind(guarnicion_id).fetch_all(pool).await.map_err(|e| e.to_string())?;
    let result: Vec<GuarnicionIngrediente> = rows.iter().map(|r| {
        GuarnicionIngrediente {
            id: r.try_get("id").unwrap_or_default(),
            guarnicion_id: r.try_get("guarnicion_id").unwrap_or_default(),
            ingrediente_id: r.try_get("ingrediente_id").unwrap_or_default(),
            ingrediente_nombre: r.try_get("ingrediente_nombre").ok().flatten(),
            cantidad: r.try_get::<f64, _>("cantidad").unwrap_or(0.0),
            unidad: r.try_get("unidad").unwrap_or_default(),
            merma_porcentaje: r.try_get::<f64, _>("merma_porcentaje").unwrap_or(0.0),
        }
    }).collect();
    Ok(result)
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
    let guarnicion: Guarnicion = {
        let sql = "SELECT id, nombre, descripcion, porciones, CAST(margen_porcentaje AS DOUBLE) AS margen_porcentaje, CAST(precio_venta AS DOUBLE) AS precio_venta FROM guarniciones WHERE id = ?";
        let row = sqlx::query(sql).bind(guarnicion_id).fetch_optional(pool).await.map_err(|e| e.to_string())?
            .ok_or("Guarnición no encontrada".to_string())?;
        Guarnicion {
            id: row.try_get("id").unwrap_or_default(),
            nombre: row.try_get("nombre").unwrap_or_default(),
            descripcion: row.try_get("descripcion").ok().flatten(),
            porciones: row.try_get("porciones").unwrap_or_default(),
            margen_porcentaje: row.try_get::<f64, _>("margen_porcentaje").unwrap_or(0.0),
            precio_venta: row.try_get::<Option<f64>, _>("precio_venta").ok().flatten(),
        }
    };

    let rows_sql = "SELECT i.nombre, CAST(gi.cantidad AS DOUBLE), gi.unidad, CAST(gi.merma_porcentaje AS DOUBLE), i.unidad_base FROM guarnicion_ingredientes gi INNER JOIN ingredientes i ON gi.ingrediente_id = i.id WHERE gi.guarnicion_id = ?";
    let ri_rows = sqlx::query(rows_sql).bind(guarnicion_id).fetch_all(pool).await.map_err(|e| e.to_string())?;

    let mut ingredientes: Vec<CosteIngrediente> = Vec::new();
    let mut coste_total: f64 = 0.0;

    for row in ri_rows {
        let nombre: String = row.try_get(0).unwrap_or_default();
        let cantidad: f64 = row.try_get::<f64, _>(1).unwrap_or(0.0);
        let unidad: String = row.try_get(2).unwrap_or_default();
        let merma: f64 = row.try_get::<f64, _>(3).unwrap_or(0.0);
        let unidad_base: String = row.try_get(4).unwrap_or_default();

        let ingrediente_id: Option<i64> = sqlx::query_scalar("SELECT id FROM ingredientes WHERE nombre = ?")
            .bind(&nombre).fetch_optional(pool).await.map_err(|e| e.to_string())?;

        let precio_unitario: Option<f64> = if let Some(iid) = ingrediente_id {
            sqlx::query("SELECT CAST(precio_por_unidad_base AS DOUBLE) FROM ingrediente_precios WHERE ingrediente_id = ? AND es_predeterminado = 1 LIMIT 1")
                .bind(iid).fetch_optional(pool).await.map_err(|e| e.to_string())?
                .and_then(|r| r.try_get::<f64, _>(0).ok())
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
    pub descripcion: Option<String>,
    pub pasos_preparacion: Option<String>,
    pub conservacion: Option<String>,
    pub vida_util: Option<String>,
    pub fotos: Option<String>,
    pub notas_adicionales: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct FichaTecnicaInput {
    pub receta_id: i64,
    pub codigo_interno: Option<String>,
    pub catalogado_en: Option<String>,
    pub fecha: Option<String>,
    pub descripcion: Option<String>,
    pub pasos_preparacion: Option<String>,
    pub conservacion: Option<String>,
    pub vida_util: Option<String>,
    pub fotos: Option<String>,
    pub notas_adicionales: Option<String>,
}

#[tauri::command]
async fn get_fichas_tecnicas() -> Result<Vec<FichaTecnica>, String> {
    let pool = &db::get_pool();
    let rows: Vec<FichaTecnica> = sqlx::query_as(
        "SELECT ft.id, ft.receta_id, r.nombre AS receta_nombre, ft.codigo_interno, ft.catalogado_en, DATE_FORMAT(ft.fecha, '%Y-%m-%d') AS fecha, ft.descripcion, ft.pasos_preparacion, ft.conservacion, ft.vida_util, CAST(ft.fotos AS CHAR) AS fotos, ft.notas_adicionales FROM fichas_tecnicas ft INNER JOIN recetas r ON ft.receta_id = r.id ORDER BY r.nombre"
    ).fetch_all(pool).await.map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
async fn get_ficha_tecnica(receta_id: i64) -> Result<Option<FichaTecnica>, String> {
    let pool = &db::get_pool();
    let row: Option<FichaTecnica> = sqlx::query_as(
        "SELECT ft.id, ft.receta_id, r.nombre AS receta_nombre, ft.codigo_interno, ft.catalogado_en, DATE_FORMAT(ft.fecha, '%Y-%m-%d') AS fecha, ft.descripcion, ft.pasos_preparacion, ft.conservacion, ft.vida_util, CAST(ft.fotos AS CHAR) AS fotos, ft.notas_adicionales FROM fichas_tecnicas ft INNER JOIN recetas r ON ft.receta_id = r.id WHERE ft.receta_id = ?"
    ).bind(receta_id).fetch_optional(pool).await.map_err(|e| e.to_string())?;
    Ok(row)
}

#[tauri::command]
async fn create_ficha_tecnica(input: FichaTecnicaInput) -> Result<i64, String> {
    let pool = &db::get_pool();
    let result = sqlx::query("INSERT INTO fichas_tecnicas (receta_id, codigo_interno, catalogado_en, fecha, descripcion, pasos_preparacion, conservacion, vida_util, fotos, notas_adicionales) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(input.receta_id).bind(&input.codigo_interno).bind(&input.catalogado_en).bind(&input.fecha).bind(&input.descripcion).bind(&input.pasos_preparacion).bind(&input.conservacion).bind(&input.vida_util).bind(&input.fotos).bind(&input.notas_adicionales)
        .execute(pool).await.map_err(|e| e.to_string())?;
    Ok(result.last_insert_id() as i64)
}

#[tauri::command]
async fn update_ficha_tecnica(id: i64, input: FichaTecnicaInput) -> Result<(), String> {
    let pool = &db::get_pool();
    sqlx::query("UPDATE fichas_tecnicas SET codigo_interno = ?, catalogado_en = ?, fecha = ?, descripcion = ?, pasos_preparacion = ?, conservacion = ?, vida_util = ?, fotos = ?, notas_adicionales = ? WHERE id = ?")
        .bind(&input.codigo_interno).bind(&input.catalogado_en).bind(&input.fecha).bind(&input.descripcion).bind(&input.pasos_preparacion).bind(&input.conservacion).bind(&input.vida_util).bind(&input.fotos).bind(&input.notas_adicionales).bind(id)
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
// FICHAS RECETA
// ========================================

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct FichaReceta {
    pub id: i64,
    pub receta_id: i64,
    pub receta_nombre: Option<String>,
    pub catalogado_en: Option<String>,
    pub fecha: Option<String>,
    pub fotos: Option<String>,
    pub notas_adicionales: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct FichaRecetaInput {
    pub receta_id: i64,
    pub catalogado_en: Option<String>,
    pub fecha: Option<String>,
    pub fotos: Option<String>,
    pub notas_adicionales: Option<String>,
}

#[tauri::command]
async fn get_fichas_receta() -> Result<Vec<FichaReceta>, String> {
    let pool = &db::get_pool();
    let rows: Vec<FichaReceta> = sqlx::query_as(
        "SELECT fr.id, fr.receta_id, r.nombre AS receta_nombre, fr.catalogado_en, DATE_FORMAT(fr.fecha, '%Y-%m-%d') AS fecha, CAST(fr.fotos AS CHAR) AS fotos, fr.notas_adicionales FROM fichas_receta fr INNER JOIN recetas r ON fr.receta_id = r.id ORDER BY r.nombre"
    ).fetch_all(pool).await.map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
async fn create_ficha_receta(input: FichaRecetaInput) -> Result<i64, String> {
    let pool = &db::get_pool();
    let result = sqlx::query("INSERT INTO fichas_receta (receta_id, catalogado_en, fecha, fotos, notas_adicionales) VALUES (?, ?, ?, ?, ?)")
        .bind(input.receta_id).bind(&input.catalogado_en).bind(&input.fecha).bind(&input.fotos).bind(&input.notas_adicionales)
        .execute(pool).await.map_err(|e| e.to_string())?;
    Ok(result.last_insert_id() as i64)
}

#[tauri::command]
async fn update_ficha_receta(id: i64, input: FichaRecetaInput) -> Result<(), String> {
    let pool = &db::get_pool();
    sqlx::query("UPDATE fichas_receta SET catalogado_en = ?, fecha = ?, fotos = ?, notas_adicionales = ? WHERE id = ?")
        .bind(&input.catalogado_en).bind(&input.fecha).bind(&input.fotos).bind(&input.notas_adicionales).bind(id)
        .execute(pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn delete_ficha_receta(id: i64) -> Result<(), String> {
    let pool = &db::get_pool();
    sqlx::query("DELETE FROM fichas_receta WHERE id = ?").bind(id)
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
    let sql = if let (Some(_), Some(_)) = (&fecha_desde, &fecha_hasta) {
        "SELECT id, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, plato_nombre, cantidad, CAST(precio_unitario AS DOUBLE) AS precio_unitario, CAST(total_venta AS DOUBLE) AS total_venta FROM ventas WHERE fecha BETWEEN ? AND ? ORDER BY fecha DESC, plato_nombre"
    } else {
        "SELECT id, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, plato_nombre, cantidad, CAST(precio_unitario AS DOUBLE) AS precio_unitario, CAST(total_venta AS DOUBLE) AS total_venta FROM ventas ORDER BY fecha DESC, plato_nombre"
    };
    let mut q = sqlx::query(sql);
    if let (Some(desde), Some(hasta)) = (&fecha_desde, &fecha_hasta) {
        q = q.bind(desde).bind(hasta);
    }
    let rows = q.fetch_all(pool).await.map_err(|e| e.to_string())?;
    let result: Vec<Venta> = rows.iter().map(|r| {
        Venta {
            id: r.try_get("id").unwrap_or_default(),
            fecha: r.try_get("fecha").unwrap_or_default(),
            plato_nombre: r.try_get("plato_nombre").unwrap_or_default(),
            cantidad: r.try_get("cantidad").unwrap_or_default(),
            precio_unitario: r.try_get::<f64, _>("precio_unitario").unwrap_or(0.0),
            total_venta: r.try_get::<f64, _>("total_venta").unwrap_or(0.0),
        }
    }).collect();
    Ok(result)
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
    let sql = if let (Some(_), Some(_)) = (&fecha_desde, &fecha_hasta) {
        "SELECT plato_nombre, CAST(SUM(cantidad) AS SIGNED) AS unidades_vendidas, CAST(SUM(total_venta) AS DOUBLE) AS total_ingresos FROM ventas WHERE fecha BETWEEN ? AND ? GROUP BY plato_nombre ORDER BY total_ingresos DESC"
    } else {
        "SELECT plato_nombre, CAST(SUM(cantidad) AS SIGNED) AS unidades_vendidas, CAST(SUM(total_venta) AS DOUBLE) AS total_ingresos FROM ventas GROUP BY plato_nombre ORDER BY total_ingresos DESC"
    };
    let mut q = sqlx::query(sql);
    if let (Some(desde), Some(hasta)) = (&fecha_desde, &fecha_hasta) {
        q = q.bind(desde).bind(hasta);
    }
    let rows = q.fetch_all(pool).await.map_err(|e| e.to_string())?;
    let result: Vec<VentaPorPlato> = rows.iter().map(|r| {
        VentaPorPlato {
            plato_nombre: r.try_get("plato_nombre").unwrap_or_default(),
            unidades_vendidas: r.try_get("unidades_vendidas").unwrap_or_default(),
            total_ingresos: r.try_get::<f64, _>("total_ingresos").unwrap_or(0.0),
        }
    }).collect();
    Ok(result)
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
    let sql = if let (Some(_), Some(_)) = (&fecha_desde, &fecha_hasta) {
        "SELECT plato_nombre, CAST(SUM(cantidad) AS SIGNED) AS unidades_vendidas, CAST(SUM(total_venta) AS DOUBLE) AS total_ingresos FROM ventas WHERE fecha BETWEEN ? AND ? GROUP BY plato_nombre"
    } else {
        "SELECT plato_nombre, CAST(SUM(cantidad) AS SIGNED) AS unidades_vendidas, CAST(SUM(total_venta) AS DOUBLE) AS total_ingresos FROM ventas GROUP BY plato_nombre"
    };
    let mut q = sqlx::query(sql);
    if let (Some(desde), Some(hasta)) = (&fecha_desde, &fecha_hasta) {
        q = q.bind(desde).bind(hasta);
    }
    let rows = q.fetch_all(pool).await.map_err(|e| e.to_string())?;
    let ventas: Vec<VentaPorPlato> = rows.iter().map(|r| {
        VentaPorPlato {
            plato_nombre: r.try_get("plato_nombre").unwrap_or_default(),
            unidades_vendidas: r.try_get("unidades_vendidas").unwrap_or_default(),
            total_ingresos: r.try_get::<f64, _>("total_ingresos").unwrap_or(0.0),
        }
    }).collect();

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
        let receta = sqlx::query(
            "SELECT r.id, CAST(r.precio_venta AS DOUBLE), COALESCE(r.margen_porcentaje, 50.0), 0.0 FROM recetas r WHERE r.nombre = SUBSTRING_INDEX(?, ' - ', -1) LIMIT 1"
        ).bind(&v.plato_nombre).fetch_optional(pool).await.map_err(|e| e.to_string())?;

        let (receta_id, precio_venta, margen_porcentaje, _coste) = match receta {
            Some(r) => (
                r.try_get("id").unwrap_or(0i64),
                r.try_get::<f64, _>(1).unwrap_or(0.0),
                r.try_get::<f64, _>(2).unwrap_or(50.0),
                r.try_get::<f64, _>(3).unwrap_or(0.0),
            ),
            None => (0, 0.0, 50.0, 0.0),
        };

        // Calculate cost from receta if available
        let coste_porcion: f64 = if receta_id > 0 {
            let coste_result = sqlx::query(
                "SELECT COALESCE(CAST(SUM(ri.cantidad * COALESCE(ip.precio_por_unidad_base, 0) * (1 + ri.merma_porcentaje / 100)) / ANY_VALUE(r.porciones) AS DOUBLE), 0) AS coste_porcion FROM receta_ingredientes ri LEFT JOIN ingrediente_precios ip ON ri.ingrediente_id = ip.ingrediente_id AND ip.es_predeterminado = 1 INNER JOIN recetas r ON ri.receta_id = r.id WHERE ri.receta_id = ?"
            ).bind(receta_id).fetch_optional(pool).await.map_err(|e| e.to_string())?;
            coste_result.and_then(|r| r.try_get::<f64, _>(0).ok()).unwrap_or(0.0)
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

    let sql = if let (Some(_), Some(_)) = (&fecha_desde, &fecha_hasta) {
        "SELECT plato_nombre, CAST(SUM(cantidad) AS SIGNED) AS unidades_vendidas, CAST(SUM(total_venta) AS DOUBLE) AS total_ingresos FROM ventas WHERE fecha BETWEEN ? AND ? GROUP BY plato_nombre ORDER BY total_ingresos DESC"
    } else {
        "SELECT plato_nombre, CAST(SUM(cantidad) AS SIGNED) AS unidades_vendidas, CAST(SUM(total_venta) AS DOUBLE) AS total_ingresos FROM ventas GROUP BY plato_nombre ORDER BY total_ingresos DESC"
    };
    let mut q = sqlx::query(sql);
    if let (Some(desde), Some(hasta)) = (&fecha_desde, &fecha_hasta) {
        q = q.bind(desde).bind(hasta);
    }
    let rows = q.fetch_all(pool).await.map_err(|e| e.to_string())?;
    let ventas_por_plato: Vec<VentaPorPlato> = rows.iter().map(|r| {
        VentaPorPlato {
            plato_nombre: r.try_get("plato_nombre").unwrap_or_default(),
            unidades_vendidas: r.try_get("unidades_vendidas").unwrap_or_default(),
            total_ingresos: r.try_get::<f64, _>("total_ingresos").unwrap_or(0.0),
        }
    }).collect();

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
        let coste_result = sqlx::query(
            "SELECT COALESCE(CAST(SUM(ri.cantidad * COALESCE(ip.precio_por_unidad_base, 0) * (1 + ri.merma_porcentaje / 100)) / ANY_VALUE(r.porciones) AS DOUBLE), 0) FROM receta_ingredientes ri LEFT JOIN ingrediente_precios ip ON ri.ingrediente_id = ip.ingrediente_id AND ip.es_predeterminado = 1 INNER JOIN recetas r ON ri.receta_id = r.id WHERE r.nombre = SUBSTRING_INDEX(?, ' - ', -1)"
        ).bind(&v.plato_nombre).fetch_optional(pool).await.map_err(|e| e.to_string())?;

        let coste_porcion = coste_result.and_then(|r| r.try_get::<f64, _>(0).ok()).unwrap_or(0.0);
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
    let food_cost_medio: Option<f64> = sqlx::query(
        "SELECT CAST(AVG(CASE WHEN precio_venta > 0 THEN (coste.porce / precio_venta) * 100 END) AS DOUBLE) FROM (SELECT r.id, r.precio_venta, CAST(SUM(ri.cantidad * COALESCE(ip.precio_por_unidad_base, 0) * (1 + ri.merma_porcentaje / 100)) AS DOUBLE) AS porce FROM recetas r INNER JOIN receta_ingredientes ri ON r.id = ri.receta_id LEFT JOIN ingrediente_precios ip ON ri.ingrediente_id = ip.ingrediente_id AND ip.es_predeterminado = 1 GROUP BY r.id) AS coste"
    )
    .fetch_optional(pool).await.map_err(|e| e.to_string())?
    .and_then(|r| r.try_get::<f64, _>(0).ok());

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
    let sql_with_dates = "SELECT l.id, l.ingrediente_id, i.nombre AS ingrediente_nombre, l.proveedor_id, p.nombre AS proveedor_nombre, l.numero_lote, DATE_FORMAT(l.fecha_recepcion, '%Y-%m-%d') AS fecha_recepcion, DATE_FORMAT(l.fecha_caducidad, '%Y-%m-%d') AS fecha_caducidad, CAST(l.cantidad_recibida AS DOUBLE) AS cantidad_recibida, l.unidad, l.albaran_id, l.notas FROM lotes_ingredientes l LEFT JOIN ingredientes i ON l.ingrediente_id = i.id LEFT JOIN proveedores p ON l.proveedor_id = p.id WHERE l.fecha_recepcion BETWEEN ? AND ? ORDER BY l.fecha_recepcion DESC";
    let sql_no_dates = "SELECT l.id, l.ingrediente_id, i.nombre AS ingrediente_nombre, l.proveedor_id, p.nombre AS proveedor_nombre, l.numero_lote, DATE_FORMAT(l.fecha_recepcion, '%Y-%m-%d') AS fecha_recepcion, DATE_FORMAT(l.fecha_caducidad, '%Y-%m-%d') AS fecha_caducidad, CAST(l.cantidad_recibida AS DOUBLE) AS cantidad_recibida, l.unidad, l.albaran_id, l.notas FROM lotes_ingredientes l LEFT JOIN ingredientes i ON l.ingrediente_id = i.id LEFT JOIN proveedores p ON l.proveedor_id = p.id ORDER BY l.fecha_recepcion DESC";
    let rows = if let (Some(desde), Some(hasta)) = (&fecha_desde, &fecha_hasta) {
        sqlx::query(sql_with_dates).bind(desde).bind(hasta).fetch_all(pool).await.map_err(|e| e.to_string())?
    } else {
        sqlx::query(sql_no_dates).fetch_all(pool).await.map_err(|e| e.to_string())?
    };
    let result: Vec<LoteIngrediente> = rows.iter().map(|r| {
        LoteIngrediente {
            id: r.try_get("id").unwrap_or_default(),
            ingrediente_id: r.try_get("ingrediente_id").unwrap_or_default(),
            ingrediente_nombre: r.try_get("ingrediente_nombre").ok().flatten(),
            proveedor_id: r.try_get("proveedor_id").unwrap_or_default(),
            proveedor_nombre: r.try_get("proveedor_nombre").ok().flatten(),
            numero_lote: r.try_get("numero_lote").unwrap_or_default(),
            fecha_recepcion: r.try_get("fecha_recepcion").unwrap_or_default(),
            fecha_caducidad: r.try_get("fecha_caducidad").ok().flatten(),
            cantidad_recibida: r.try_get::<f64, _>("cantidad_recibida").unwrap_or(0.0),
            unidad: r.try_get("unidad").unwrap_or_default(),
            albaran_id: r.try_get("albaran_id").ok().flatten(),
            notas: r.try_get("notas").ok().flatten(),
        }
    }).collect();
    Ok(result)
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
    let sql = "SELECT l.id, l.ingrediente_id, i.nombre AS ingrediente_nombre, l.proveedor_id, p.nombre AS proveedor_nombre, l.numero_lote, DATE_FORMAT(l.fecha_recepcion, '%Y-%m-%d') AS fecha_recepcion, DATE_FORMAT(l.fecha_caducidad, '%Y-%m-%d') AS fecha_caducidad, CAST(l.cantidad_recibida AS DOUBLE) AS cantidad_recibida, l.unidad, l.albaran_id, l.notas FROM lotes_ingredientes l LEFT JOIN ingredientes i ON l.ingrediente_id = i.id LEFT JOIN proveedores p ON l.proveedor_id = p.id WHERE l.fecha_caducidad IS NOT NULL AND l.fecha_caducidad <= DATE_ADD(CURDATE(), INTERVAL ? DAY) ORDER BY l.fecha_caducidad ASC";
    let rows = sqlx::query(sql).bind(dias).fetch_all(pool).await.map_err(|e| e.to_string())?;
    let result: Vec<LoteIngrediente> = rows.iter().map(|r| {
        LoteIngrediente {
            id: r.try_get("id").unwrap_or_default(),
            ingrediente_id: r.try_get("ingrediente_id").unwrap_or_default(),
            ingrediente_nombre: r.try_get("ingrediente_nombre").ok().flatten(),
            proveedor_id: r.try_get("proveedor_id").unwrap_or_default(),
            proveedor_nombre: r.try_get("proveedor_nombre").ok().flatten(),
            numero_lote: r.try_get("numero_lote").unwrap_or_default(),
            fecha_recepcion: r.try_get("fecha_recepcion").unwrap_or_default(),
            fecha_caducidad: r.try_get("fecha_caducidad").ok().flatten(),
            cantidad_recibida: r.try_get::<f64, _>("cantidad_recibida").unwrap_or(0.0),
            unidad: r.try_get("unidad").unwrap_or_default(),
            albaran_id: r.try_get("albaran_id").ok().flatten(),
            notas: r.try_get("notas").ok().flatten(),
        }
    }).collect();
    Ok(result)
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
    let sql = "SELECT pd.id, pd.produccion_id, pd.lote_ingrediente_id, l.numero_lote AS lote_numero, i.nombre AS ingrediente_nombre, CAST(pd.cantidad_utilizada AS DOUBLE) AS cantidad_utilizada FROM produccion_detalle pd LEFT JOIN lotes_ingredientes l ON pd.lote_ingrediente_id = l.id LEFT JOIN ingredientes i ON l.ingrediente_id = i.id WHERE pd.produccion_id = ?";
    let rows = sqlx::query(sql).bind(produccion_id).fetch_all(pool).await.map_err(|e| e.to_string())?;
    let result: Vec<ProduccionDetalle> = rows.iter().map(|r| {
        ProduccionDetalle {
            id: r.try_get("id").unwrap_or_default(),
            produccion_id: r.try_get("produccion_id").unwrap_or_default(),
            lote_ingrediente_id: r.try_get("lote_ingrediente_id").unwrap_or_default(),
            lote_numero: r.try_get("lote_numero").ok().flatten(),
            ingrediente_nombre: r.try_get("ingrediente_nombre").ok().flatten(),
            cantidad_utilizada: r.try_get::<f64, _>("cantidad_utilizada").unwrap_or(0.0),
        }
    }).collect();
    Ok(result)
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
    println!("[DB] test_db_connection: Probando {}@{}:{}/{}", config.usuario, config.host, config.puerto, config.base_datos);
    let pool = sqlx::mysql::MySqlPool::connect(&url)
        .await
        .map_err(|e| {
            let msg = format!("Error de conexión: {}", e);
            println!("[DB] test_db_connection ERROR: {}", msg);
            msg
        })?;
    sqlx::query("SELECT 1")
        .execute(&pool)
        .await
        .map_err(|e| format!("Error en query de prueba: {}", e))?;
    pool.close().await;
    println!("[DB] test_db_connection: OK");
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
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let output = std::process::Command::new("powershell")
            .args(["-Command", "Get-Printer | Select-Object Name, Default | ConvertTo-Json"])
            .creation_flags(CREATE_NO_WINDOW)
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
// CAJA - SISTEMA DE VENTAS POR CATEGORÍA
// ========================================

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct CajaCategoria {
    pub id: i64,
    pub nombre: String,
    pub precio: f64,
    pub plus: f64,
    pub orden: i32,
    pub activa: bool,
}

#[derive(Debug, Deserialize)]
pub struct CajaCategoriaInput {
    pub nombre: String,
    pub precio: f64,
    pub plus: f64,
    pub orden: Option<i32>,
    pub activa: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct PlatoCaja {
    pub id: i64,
    pub categoria_id: i64,
    pub receta_id: Option<i64>,
    pub nombre: String,
    pub plus: f64,
    pub activo: bool,
    pub foto: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PlatoCajaInput {
    pub categoria_id: i64,
    pub receta_id: Option<i64>,
    pub nombre: String,
    pub plus: Option<f64>,
    pub activo: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CajaTicketItem {
    pub categoria: String,
    pub descripcion: String,
    pub cantidad: i64,
    pub precio_unitario: f64,
    pub subtotal: f64,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct CajaTicket {
    pub id: i64,
    pub fecha: String,
    pub hora: String,
    pub total: f64,
    pub items: String,
    pub notas: Option<String>,
    pub metodo_pago: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CajaTicketInput {
    pub items: Vec<CajaTicketItem>,
    pub total: f64,
    pub notas: Option<String>,
    pub metodo_pago: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CajaResumen {
    pub total_vendido: f64,
    pub num_tickets: i64,
    pub ticket_medio: f64,
    pub por_categoria: Vec<CajaCategoriaResumen>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct CajaCategoriaResumen {
    pub categoria: String,
    pub total: f64,
    pub cantidad: i64,
}

#[tauri::command]
async fn get_caja_categorias() -> Result<Vec<CajaCategoria>, String> {
    let pool = &db::get_pool();
    let sql = "SELECT id, nombre, CAST(precio AS DOUBLE) AS precio, CAST(plus AS DOUBLE) AS plus, orden, activa FROM caja_categorias ORDER BY orden, nombre";
    let rows = sqlx::query(sql).fetch_all(pool).await.map_err(|e| e.to_string())?;
    let result: Vec<CajaCategoria> = rows.iter().map(|r| {
        CajaCategoria {
            id: r.try_get("id").unwrap_or_default(),
            nombre: r.try_get("nombre").unwrap_or_default(),
            precio: r.try_get::<f64, _>("precio").unwrap_or(0.0),
            plus: r.try_get::<f64, _>("plus").unwrap_or(0.0),
            orden: r.try_get("orden").unwrap_or_default(),
            activa: r.try_get("activa").unwrap_or_default(),
        }
    }).collect();
    Ok(result)
}

#[tauri::command]
async fn create_categoria_caja(input: CajaCategoriaInput) -> Result<i64, String> {
    let pool = &db::get_pool();
    let max_orden: (Option<i32>,) = sqlx::query_as("SELECT MAX(orden) FROM caja_categorias")
        .fetch_one(pool).await.map_err(|e| e.to_string())?;
    let orden = input.orden.unwrap_or(max_orden.0.unwrap_or(0) + 1);
    let result = sqlx::query(
        "INSERT INTO caja_categorias (nombre, precio, plus, orden, activa) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(&input.nombre).bind(input.precio).bind(input.plus)
    .bind(orden).bind(input.activa.unwrap_or(true))
    .execute(pool).await.map_err(|e| e.to_string())?;
    Ok(result.last_insert_id() as i64)
}

#[tauri::command]
async fn update_categoria_caja(id: i64, input: CajaCategoriaInput) -> Result<(), String> {
    let pool = &db::get_pool();
    sqlx::query(
        "UPDATE caja_categorias SET nombre = ?, precio = ?, plus = ?, orden = ?, activa = ? WHERE id = ?"
    )
    .bind(&input.nombre).bind(input.precio).bind(input.plus)
    .bind(input.orden.unwrap_or(0)).bind(input.activa.unwrap_or(true))
    .bind(id)
    .execute(pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn delete_categoria_caja(id: i64) -> Result<(), String> {
    let pool = &db::get_pool();
    sqlx::query("DELETE FROM caja_categorias WHERE id = ?").bind(id)
        .execute(pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_caja_tickets(fecha_desde: Option<String>, fecha_hasta: Option<String>) -> Result<Vec<CajaTicket>, String> {
    let pool = &db::get_pool();
    let sql = if let (Some(_), Some(_)) = (&fecha_desde, &fecha_hasta) {
        "SELECT id, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, CAST(hora AS CHAR) AS hora, CAST(total AS DOUBLE) AS total, CAST(items AS CHAR) AS items, notas, metodo_pago FROM caja_tickets WHERE fecha BETWEEN ? AND ? ORDER BY fecha DESC, hora DESC"
    } else {
        "SELECT id, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, CAST(hora AS CHAR) AS hora, CAST(total AS DOUBLE) AS total, CAST(items AS CHAR) AS items, notas, metodo_pago FROM caja_tickets ORDER BY fecha DESC, hora DESC"
    };
    let mut q = sqlx::query(sql);
    if let (Some(desde), Some(hasta)) = (&fecha_desde, &fecha_hasta) {
        q = q.bind(desde).bind(hasta);
    }
    let rows = q.fetch_all(pool).await.map_err(|e| e.to_string())?;
    let result: Vec<CajaTicket> = rows.iter().map(|r| {
        CajaTicket {
            id: r.try_get("id").unwrap_or_default(),
            fecha: r.try_get("fecha").unwrap_or_default(),
            hora: r.try_get("hora").unwrap_or_default(),
            total: r.try_get::<f64, _>("total").unwrap_or(0.0),
            items: r.try_get("items").unwrap_or_default(),
            notas: r.try_get("notas").ok().flatten(),
            metodo_pago: r.try_get("metodo_pago").ok().flatten(),
        }
    }).collect();
    Ok(result)
}

#[tauri::command]
async fn get_caja_tickets_con_ventas(fecha_desde: Option<String>, fecha_hasta: Option<String>) -> Result<Vec<CajaTicket>, String> {
    let pool = &db::get_pool();
    let sql = if let (Some(_), Some(_)) = (&fecha_desde, &fecha_hasta) {
        "SELECT t.id, DATE_FORMAT(t.fecha, '%Y-%m-%d') AS fecha, CAST(t.hora AS CHAR) AS hora, CAST(t.total AS DOUBLE) AS total, CAST(t.items AS CHAR) AS items, t.notas, t.metodo_pago FROM caja_tickets t WHERE t.fecha BETWEEN ? AND ? AND EXISTS (SELECT 1 FROM ventas v WHERE v.ticket_id = t.id) ORDER BY fecha DESC, hora DESC"
    } else {
        "SELECT t.id, DATE_FORMAT(t.fecha, '%Y-%m-%d') AS fecha, CAST(t.hora AS CHAR) AS hora, CAST(t.total AS DOUBLE) AS total, CAST(t.items AS CHAR) AS items, t.notas, t.metodo_pago FROM caja_tickets t WHERE EXISTS (SELECT 1 FROM ventas v WHERE v.ticket_id = t.id) ORDER BY fecha DESC, hora DESC"
    };
    let mut q = sqlx::query(sql);
    if let (Some(desde), Some(hasta)) = (&fecha_desde, &fecha_hasta) {
        q = q.bind(desde).bind(hasta);
    }
    let rows = q.fetch_all(pool).await.map_err(|e| e.to_string())?;
    let result: Vec<CajaTicket> = rows.iter().map(|r| {
        CajaTicket {
            id: r.try_get("id").unwrap_or_default(),
            fecha: r.try_get("fecha").unwrap_or_default(),
            hora: r.try_get("hora").unwrap_or_default(),
            total: r.try_get::<f64, _>("total").unwrap_or(0.0),
            items: r.try_get("items").unwrap_or_default(),
            notas: r.try_get("notas").ok().flatten(),
            metodo_pago: r.try_get("metodo_pago").ok().flatten(),
        }
    }).collect();
    Ok(result)
}

#[tauri::command]
async fn create_caja_ticket(input: CajaTicketInput) -> Result<i64, String> {
    let pool = &db::get_pool();
    let now = chrono::Local::now();
    let fecha = now.format("%Y-%m-%d").to_string();
    let hora = now.format("%H:%M:%S").to_string();
    let items_json = serde_json::to_string(&input.items).map_err(|e| e.to_string())?;

    let result = sqlx::query(
        "INSERT INTO caja_tickets (fecha, hora, total, items, notas, metodo_pago) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&fecha).bind(&hora).bind(input.total)
    .bind(&items_json).bind(&input.notas).bind(input.metodo_pago.as_deref().unwrap_or("efectivo"))
    .execute(pool).await.map_err(|e| e.to_string())?;
    let ticket_id = result.last_insert_id() as i64;

    for item in &input.items {
        let plato = format!("{} - {}", item.categoria, item.descripcion);
        sqlx::query(
            "INSERT INTO ventas (ticket_id, fecha, plato_nombre, cantidad, precio_unitario, total_venta) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(ticket_id).bind(&fecha).bind(&plato).bind(item.cantidad)
        .bind(item.precio_unitario).bind(item.subtotal)
        .execute(pool).await.map_err(|e| e.to_string())?;
    }

    Ok(ticket_id)
}

#[tauri::command]
async fn delete_caja_ticket(id: i64) -> Result<(), String> {
    let pool = &db::get_pool();
    // Delete all linked ventas first
    sqlx::query("DELETE FROM ventas WHERE ticket_id = ?")
        .bind(id).execute(pool).await.map_err(|e| e.to_string())?;
    // Also delete any orphaned ventas from old tickets (no ticket_id) by matching
    let sql = "SELECT id, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, CAST(hora AS CHAR) AS hora, CAST(total AS DOUBLE) AS total, CAST(items AS CHAR) AS items, notas, metodo_pago FROM caja_tickets WHERE id = ?";
    let ticket: Option<CajaTicket> = sqlx::query(sql).bind(id).fetch_optional(pool).await.map_err(|e| e.to_string())?.map(|r| {
        CajaTicket {
            id: r.try_get("id").unwrap_or_default(),
            fecha: r.try_get("fecha").unwrap_or_default(),
            hora: r.try_get("hora").unwrap_or_default(),
            total: r.try_get::<f64, _>("total").unwrap_or(0.0),
            items: r.try_get("items").unwrap_or_default(),
            notas: r.try_get("notas").ok().flatten(),
            metodo_pago: r.try_get("metodo_pago").ok().flatten(),
        }
    });
    if let Some(t) = ticket {
        let items: Vec<CajaTicketItem> = serde_json::from_str(&t.items).unwrap_or_default();
        for item in &items {
            let plato = format!("{} - {}", item.categoria, item.descripcion);
            sqlx::query("DELETE FROM ventas WHERE fecha = ? AND plato_nombre = ? AND cantidad = ? AND precio_unitario = ? AND (ticket_id IS NULL OR ticket_id != ?) LIMIT 1")
                .bind(&t.fecha).bind(&plato).bind(item.cantidad).bind(item.precio_unitario).bind(id)
                .execute(pool).await.ok();
        }
    }
    sqlx::query("DELETE FROM caja_tickets WHERE id = ?").bind(id)
        .execute(pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_caja_resumen(fecha: Option<String>) -> Result<CajaResumen, String> {
    let pool = &db::get_pool();
    let target_date = fecha.unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d").to_string());

    let stats_row = sqlx::query("SELECT COALESCE(SUM(total), 0) + 0.0 AS total_sum, COUNT(*) AS cnt FROM caja_tickets WHERE fecha = ?")
        .bind(&target_date).fetch_one(pool).await.map_err(|e| e.to_string())?;
    let total_sum: f64 = stats_row.try_get::<f64, _>("total_sum").unwrap_or(0.0);
    let cnt: i64 = stats_row.try_get("cnt").unwrap_or(0);
    let ticket_medio = if cnt > 0 { total_sum / cnt as f64 } else { 0.0 };

    let cat_rows = sqlx::query(
        "SELECT sub.categoria, CAST(SUM(sub.subtotal) AS DOUBLE) AS total, CAST(SUM(sub.cantidad) AS SIGNED) AS cantidad
         FROM (
             SELECT CAST(JSON_UNQUOTE(JSON_EXTRACT(item, '$.categoria')) AS CHAR) AS categoria,
                    CAST(JSON_UNQUOTE(JSON_EXTRACT(item, '$.cantidad')) AS UNSIGNED) AS cantidad,
                    CAST(JSON_UNQUOTE(JSON_EXTRACT(item, '$.subtotal')) AS DOUBLE) AS subtotal
             FROM caja_tickets t,
             JSON_TABLE(t.items, '$[*]' COLUMNS (item JSON PATH '$')) AS jt
             WHERE t.fecha = ?
         ) AS sub
         GROUP BY sub.categoria"
    ).bind(&target_date).fetch_all(pool).await.map_err(|e| e.to_string())?;
    let por_categoria: Vec<CajaCategoriaResumen> = cat_rows.iter().map(|r| {
        CajaCategoriaResumen {
            categoria: r.try_get("categoria").unwrap_or_default(),
            total: r.try_get::<f64, _>("total").unwrap_or(0.0),
            cantidad: r.try_get("cantidad").unwrap_or_default(),
        }
    }).collect();

    Ok(CajaResumen {
        total_vendido: total_sum,
        num_tickets: cnt,
        ticket_medio,
        por_categoria,
    })
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct RecetaBasic {
    pub id: i64,
    pub nombre: String,
    pub categoria: Option<String>,
}

#[tauri::command]
async fn get_recetas_basic() -> Result<Vec<RecetaBasic>, String> {
    let pool = &db::get_pool();
    let rows: Vec<RecetaBasic> = sqlx::query_as(
        "SELECT id, nombre, categoria FROM recetas ORDER BY categoria, nombre"
    ).fetch_all(pool).await.map_err(|e| e.to_string())?;
    Ok(rows)
}

// ========================================
// CAJA - PLATOS
// ========================================

#[tauri::command]
async fn get_platos_caja(categoria_id: Option<i64>) -> Result<Vec<PlatoCaja>, String> {
    let pool = &db::get_pool();
    let base_sql = "SELECT cp.id, cp.categoria_id, cp.receta_id, cp.nombre, CAST(cp.plus AS DOUBLE) AS plus, cp.activo, CAST(fr.fotos AS CHAR) AS foto FROM caja_platos cp LEFT JOIN fichas_receta fr ON cp.receta_id = fr.receta_id";
    let rows: Vec<PlatoCaja> = if let Some(cat_id) = categoria_id {
        sqlx::query_as(
            &format!("{} WHERE cp.categoria_id = ? AND cp.activo = 1 ORDER BY cp.nombre", base_sql)
        ).bind(cat_id).fetch_all(pool).await.map_err(|e| e.to_string())?
    } else {
        sqlx::query_as(
            &format!("{} WHERE cp.activo = 1 ORDER BY cp.categoria_id, cp.nombre", base_sql)
        ).fetch_all(pool).await.map_err(|e| e.to_string())?
    };
    Ok(rows)
}

#[tauri::command]
async fn create_plato_caja(input: PlatoCajaInput) -> Result<i64, String> {
    let pool = &db::get_pool();
    let result = sqlx::query(
        "INSERT INTO caja_platos (categoria_id, receta_id, nombre, plus, activo) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(input.categoria_id).bind(input.receta_id).bind(&input.nombre).bind(input.plus.unwrap_or(0.0)).bind(input.activo.unwrap_or(true))
    .execute(pool).await.map_err(|e| e.to_string())?;
    Ok(result.last_insert_id() as i64)
}

#[tauri::command]
async fn update_plato_caja(id: i64, input: PlatoCajaInput) -> Result<(), String> {
    let pool = &db::get_pool();
    sqlx::query(
        "UPDATE caja_platos SET categoria_id = ?, receta_id = ?, nombre = ?, plus = ?, activo = ? WHERE id = ?"
    )
    .bind(input.categoria_id).bind(input.receta_id).bind(&input.nombre).bind(input.plus.unwrap_or(0.0)).bind(input.activo.unwrap_or(true))
    .bind(id)
    .execute(pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn delete_plato_caja(id: i64) -> Result<(), String> {
    let pool = &db::get_pool();
    sqlx::query("DELETE FROM caja_platos WHERE id = ?").bind(id)
        .execute(pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

// ========================================
// WHATSAPP PEDIDOS
// ========================================

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct WhatsappPedido {
    pub id: i64,
    pub telefono: String,
    pub nombre_cliente: Option<String>,
    pub items: String,
    pub total: f64,
    pub notas: Option<String>,
    pub tipo: String,
    pub estado: String,
    pub motivo_cancelacion: Option<String>,
    pub fecha_entrega: Option<String>,
    pub created_at: String,
}

#[tauri::command]
async fn get_whatsapp_pedidos(estado: Option<String>) -> Result<Vec<WhatsappPedido>, String> {
    let pool = &db::get_pool();
    let base_sql = "SELECT id, telefono, nombre_cliente, CAST(items AS CHAR) AS items, CAST(total AS DOUBLE) AS total, notas, tipo, estado, motivo_cancelacion, DATE_FORMAT(fecha_entrega, '%Y-%m-%d') AS fecha_entrega, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS created_at FROM whatsapp_pedidos";
    let sql = match &estado {
        Some(_) => format!("{} WHERE estado = ? ORDER BY created_at DESC", base_sql),
        None => format!("{} ORDER BY created_at DESC", base_sql),
    };
    let rows = if let Some(ref e) = estado {
        sqlx::query(&sql).bind(e).fetch_all(pool).await.map_err(|e| e.to_string())?
    } else {
        sqlx::query(&sql).fetch_all(pool).await.map_err(|e| e.to_string())?
    };
    let result: Vec<WhatsappPedido> = rows.iter().map(|r| {
        WhatsappPedido {
            id: r.try_get("id").unwrap_or_default(),
            telefono: r.try_get("telefono").unwrap_or_default(),
            nombre_cliente: r.try_get("nombre_cliente").ok().flatten(),
            items: r.try_get("items").unwrap_or_default(),
            total: r.try_get::<f64, _>("total").unwrap_or(0.0),
            notas: r.try_get("notas").ok().flatten(),
            tipo: r.try_get("tipo").unwrap_or("pedido".to_string()),
            estado: r.try_get("estado").unwrap_or("pendiente".to_string()),
            motivo_cancelacion: r.try_get("motivo_cancelacion").ok().flatten(),
            fecha_entrega: r.try_get("fecha_entrega").ok().flatten(),
            created_at: r.try_get("created_at").unwrap_or_default(),
        }
    }).collect();
    Ok(result)
}

#[tauri::command]
async fn update_whatsapp_pedido_estado(id: i64, estado: String, motivo: Option<String>) -> Result<(), String> {
    let pool = &db::get_pool();
    sqlx::query("UPDATE whatsapp_pedidos SET estado = ?, motivo_cancelacion = ? WHERE id = ?")
        .bind(&estado).bind(&motivo).bind(id)
        .execute(pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_whatsapp_pedidos_nuevos() -> Result<Vec<WhatsappPedido>, String> {
    let pool = &db::get_pool();
    let rows = sqlx::query(
        "SELECT id, telefono, nombre_cliente, CAST(items AS CHAR) AS items, CAST(total AS DOUBLE) AS total, notas, tipo, estado, motivo_cancelacion, DATE_FORMAT(fecha_entrega, '%Y-%m-%d') AS fecha_entrega, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS created_at FROM whatsapp_pedidos WHERE estado = 'pendiente' ORDER BY created_at DESC"
    ).fetch_all(pool).await.map_err(|e| e.to_string())?;
    let result: Vec<WhatsappPedido> = rows.iter().map(|r| {
        WhatsappPedido {
            id: r.try_get("id").unwrap_or_default(),
            telefono: r.try_get("telefono").unwrap_or_default(),
            nombre_cliente: r.try_get("nombre_cliente").ok().flatten(),
            items: r.try_get("items").unwrap_or_default(),
            total: r.try_get::<f64, _>("total").unwrap_or(0.0),
            notas: r.try_get("notas").ok().flatten(),
            tipo: r.try_get("tipo").unwrap_or("pedido".to_string()),
            estado: r.try_get("estado").unwrap_or("pendiente".to_string()),
            motivo_cancelacion: r.try_get("motivo_cancelacion").ok().flatten(),
            fecha_entrega: r.try_get("fecha_entrega").ok().flatten(),
            created_at: r.try_get("created_at").unwrap_or_default(),
        }
    }).collect();
    Ok(result)
}

// ========================================
// MENU DEL DIA
// ========================================

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct MenuDelDia {
    pub id: i64,
    pub fecha: String,
    pub primero_id: Option<i64>,
    pub segundo_id: Option<i64>,
    pub postre_id: Option<i64>,
    pub precio_base: f64,
}

#[derive(Debug, Deserialize)]
pub struct MenuDelDiaInput {
    pub fecha: String,
    pub primero_id: Option<i64>,
    pub segundo_id: Option<i64>,
    pub postre_id: Option<i64>,
    pub precio_base: f64,
}

#[tauri::command]
async fn get_menu_del_dia(fecha: Option<String>) -> Result<Vec<MenuDelDia>, String> {
    let pool = &db::get_pool();
    let f = fecha.unwrap_or_else(|| {
        let now = chrono::Local::now();
        now.format("%Y-%m-%d").to_string()
    });
    let rows: Vec<MenuDelDia> = sqlx::query_as(
        "SELECT id, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, primero_id, segundo_id, postre_id, CAST(precio_base AS DOUBLE) AS precio_base FROM menu_del_dia WHERE fecha = ?"
    ).bind(&f).fetch_all(pool).await.map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
async fn get_menu_del_dia_hoy() -> Result<Option<MenuDelDia>, String> {
    let pool = &db::get_pool();
    let now = chrono::Local::now();
    let f = now.format("%Y-%m-%d").to_string();
    let row: Option<MenuDelDia> = sqlx::query_as(
        "SELECT id, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, primero_id, segundo_id, postre_id, CAST(precio_base AS DOUBLE) AS precio_base FROM menu_del_dia WHERE fecha = ?"
    ).bind(&f).fetch_optional(pool).await.map_err(|e| e.to_string())?;
    Ok(row)
}

#[tauri::command]
async fn save_menu_del_dia(input: MenuDelDiaInput) -> Result<i64, String> {
    let pool = &db::get_pool();
    let existing: Option<(i64,)> = sqlx::query_as("SELECT id FROM menu_del_dia WHERE fecha = ?")
        .bind(&input.fecha).fetch_optional(pool).await.map_err(|e| e.to_string())?;
    if let Some((id,)) = existing {
        sqlx::query("UPDATE menu_del_dia SET primero_id = ?, segundo_id = ?, postre_id = ?, precio_base = ? WHERE id = ?")
            .bind(input.primero_id).bind(input.segundo_id).bind(input.postre_id).bind(input.precio_base).bind(id)
            .execute(pool).await.map_err(|e| e.to_string())?;
        Ok(id)
    } else {
        let result = sqlx::query("INSERT INTO menu_del_dia (fecha, primero_id, segundo_id, postre_id, precio_base) VALUES (?, ?, ?, ?, ?)")
            .bind(&input.fecha).bind(input.primero_id).bind(input.segundo_id).bind(input.postre_id).bind(input.precio_base)
            .execute(pool).await.map_err(|e| e.to_string())?;
        Ok(result.last_insert_id() as i64)
    }
}

#[tauri::command]
async fn delete_menu_del_dia(id: i64) -> Result<(), String> {
    let pool = &db::get_pool();
    sqlx::query("DELETE FROM menu_del_dia WHERE id = ?").bind(id)
        .execute(pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

// ========================================
// DESPIECES
// ========================================

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Despiece {
    pub id: i64,
    pub nombre: String,
    pub ingrediente_entrada_id: i64,
    pub ingrediente_entrada_nombre: Option<String>,
    pub cantidad_entrada: f64,
    pub unidad_entrada: String,
    pub notas: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DespieceInput {
    pub nombre: String,
    pub ingrediente_entrada_id: i64,
    pub cantidad_entrada: f64,
    pub unidad_entrada: String,
    pub notas: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct DespieceSalida {
    pub id: i64,
    pub despiece_id: i64,
    pub ingrediente_id: i64,
    pub ingrediente_nombre: Option<String>,
    pub porcentaje: Option<f64>,
    pub cantidad: Option<f64>,
    pub unidad: String,
    pub notas: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DespieceSalidaInput {
    pub ingrediente_id: i64,
    pub porcentaje: Option<f64>,
    pub cantidad: Option<f64>,
    pub unidad: String,
    pub notas: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DespieceCompletoInput {
    pub despiece: DespieceInput,
    pub salidas: Vec<DespieceSalidaInput>,
}

#[tauri::command]
async fn get_despieces() -> Result<Vec<Despiece>, String> {
    let pool = &db::get_pool();
    let sql = "SELECT d.id, d.nombre, d.ingrediente_entrada_id, i.nombre AS ingrediente_entrada_nombre, CAST(d.cantidad_entrada AS DOUBLE) AS cantidad_entrada, d.unidad_entrada, d.notas FROM despieces d LEFT JOIN ingredientes i ON d.ingrediente_entrada_id = i.id ORDER BY d.nombre";
    let rows = sqlx::query(sql).fetch_all(pool).await.map_err(|e| e.to_string())?;
    let result: Vec<Despiece> = rows.iter().map(|r| {
        Despiece {
            id: r.try_get("id").unwrap_or_default(),
            nombre: r.try_get("nombre").unwrap_or_default(),
            ingrediente_entrada_id: r.try_get("ingrediente_entrada_id").unwrap_or_default(),
            ingrediente_entrada_nombre: r.try_get("ingrediente_entrada_nombre").ok().flatten(),
            cantidad_entrada: r.try_get::<f64, _>("cantidad_entrada").unwrap_or(1.0),
            unidad_entrada: r.try_get("unidad_entrada").unwrap_or_default(),
            notas: r.try_get("notas").ok().flatten(),
        }
    }).collect();
    Ok(result)
}

#[tauri::command]
async fn get_despiece_salidas(despiece_id: i64) -> Result<Vec<DespieceSalida>, String> {
    let pool = &db::get_pool();
    let sql = "SELECT ds.id, ds.despiece_id, ds.ingrediente_id, i.nombre AS ingrediente_nombre, CAST(ds.porcentaje AS DOUBLE) AS porcentaje, CAST(ds.cantidad AS DOUBLE) AS cantidad, ds.unidad, ds.notas FROM despiece_salidas ds LEFT JOIN ingredientes i ON ds.ingrediente_id = i.id WHERE ds.despiece_id = ? ORDER BY ds.id";
    let rows = sqlx::query(sql).bind(despiece_id).fetch_all(pool).await.map_err(|e| e.to_string())?;
    let result: Vec<DespieceSalida> = rows.iter().map(|r| {
        DespieceSalida {
            id: r.try_get("id").unwrap_or_default(),
            despiece_id: r.try_get("despiece_id").unwrap_or_default(),
            ingrediente_id: r.try_get("ingrediente_id").unwrap_or_default(),
            ingrediente_nombre: r.try_get("ingrediente_nombre").ok().flatten(),
            porcentaje: r.try_get::<Option<f64>, _>("porcentaje").ok().flatten(),
            cantidad: r.try_get::<Option<f64>, _>("cantidad").ok().flatten(),
            unidad: r.try_get("unidad").unwrap_or_default(),
            notas: r.try_get("notas").ok().flatten(),
        }
    }).collect();
    Ok(result)
}

#[tauri::command]
async fn create_despiece(input: DespieceCompletoInput) -> Result<i64, String> {
    let pool = &db::get_pool();
    let result = sqlx::query(
        "INSERT INTO despieces (nombre, ingrediente_entrada_id, cantidad_entrada, unidad_entrada, notas) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(&input.despiece.nombre)
    .bind(input.despiece.ingrediente_entrada_id)
    .bind(input.despiece.cantidad_entrada)
    .bind(&input.despiece.unidad_entrada)
    .bind(&input.despiece.notas)
    .execute(pool).await.map_err(|e| e.to_string())?;
    let despiece_id = result.last_insert_id() as i64;

    for salida in &input.salidas {
        sqlx::query(
            "INSERT INTO despiece_salidas (despiece_id, ingrediente_id, porcentaje, cantidad, unidad, notas) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(despiece_id)
        .bind(salida.ingrediente_id)
        .bind(salida.porcentaje)
        .bind(salida.cantidad)
        .bind(&salida.unidad)
        .bind(&salida.notas)
        .execute(pool).await.map_err(|e| e.to_string())?;
    }

    Ok(despiece_id)
}

#[tauri::command]
async fn update_despiece(id: i64, input: DespieceCompletoInput) -> Result<(), String> {
    let pool = &db::get_pool();
    sqlx::query(
        "UPDATE despieces SET nombre = ?, ingrediente_entrada_id = ?, cantidad_entrada = ?, unidad_entrada = ?, notas = ? WHERE id = ?"
    )
    .bind(&input.despiece.nombre)
    .bind(input.despiece.ingrediente_entrada_id)
    .bind(input.despiece.cantidad_entrada)
    .bind(&input.despiece.unidad_entrada)
    .bind(&input.despiece.notas)
    .bind(id)
    .execute(pool).await.map_err(|e| e.to_string())?;

    // Delete old salidas and re-insert
    sqlx::query("DELETE FROM despiece_salidas WHERE despiece_id = ?").bind(id)
        .execute(pool).await.map_err(|e| e.to_string())?;

    for salida in &input.salidas {
        sqlx::query(
            "INSERT INTO despiece_salidas (despiece_id, ingrediente_id, porcentaje, cantidad, unidad, notas) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(id)
        .bind(salida.ingrediente_id)
        .bind(salida.porcentaje)
        .bind(salida.cantidad)
        .bind(&salida.unidad)
        .bind(&salida.notas)
        .execute(pool).await.map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
async fn delete_despiece(id: i64) -> Result<(), String> {
    let pool = &db::get_pool();
    sqlx::query("DELETE FROM despiece_salidas WHERE despiece_id = ?").bind(id)
        .execute(pool).await.map_err(|e| e.to_string())?;
    sqlx::query("DELETE FROM despieces WHERE id = ?").bind(id)
        .execute(pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn execute_despiece(despiece_id: i64) -> Result<String, String> {
    let pool = &db::get_pool();

    // Get despiece definition
    let despiece_row = sqlx::query(
        "SELECT id, nombre, ingrediente_entrada_id, CAST(cantidad_entrada AS DOUBLE) AS cantidad_entrada, unidad_entrada FROM despieces WHERE id = ?"
    ).bind(despiece_id).fetch_optional(pool).await.map_err(|e| e.to_string())?
        .ok_or("Despiece no encontrado".to_string())?;

    let nombre_despiece: String = despiece_row.try_get("nombre").map_err(|e| e.to_string())?;
    let ingrediente_entrada_id: i64 = despiece_row.try_get("ingrediente_entrada_id").map_err(|e| e.to_string())?;
    let cantidad_entrada: f64 = despiece_row.try_get::<f64, _>("cantidad_entrada").map_err(|e| e.to_string())?;
    let _unidad_entrada: String = despiece_row.try_get("unidad_entrada").map_err(|e| e.to_string())?;

    // Get input ingredient price for cost distribution
    let precio_row = sqlx::query(
        "SELECT CAST(precio_por_unidad_base AS DOUBLE) FROM ingrediente_precios WHERE ingrediente_id = ? AND es_predeterminado = 1 LIMIT 1"
    ).bind(ingrediente_entrada_id).fetch_optional(pool).await.map_err(|e| e.to_string())?;
    let precio_unitario: f64 = precio_row.and_then(|r| r.try_get::<f64, _>(0).ok()).unwrap_or(0.0);
    let _coste_total = cantidad_entrada * precio_unitario;

    // Get output pieces
    let salidas_rows = sqlx::query(
        "SELECT ds.id, ds.ingrediente_id, CAST(ds.porcentaje AS DOUBLE) AS porcentaje, CAST(ds.cantidad AS DOUBLE) AS cantidad, ds.unidad FROM despiece_salidas ds WHERE ds.despiece_id = ?"
    ).bind(despiece_id).fetch_all(pool).await.map_err(|e| e.to_string())?;

    if salidas_rows.is_empty() {
        return Err("El despiece no tiene salidas definidas".to_string());
    }

    // Calculate output quantities
    let mut _total_porcentaje: f64 = 0.0;
    let mut salidas_calculadas: Vec<(i64, f64, String)> = Vec::new();

    for salida in &salidas_rows {
        let ingrediente_id: i64 = salida.try_get("ingrediente_id").map_err(|e| e.to_string())?;
        let unidad: String = salida.try_get("unidad").map_err(|e| e.to_string())?;
        let cantidad_salida: f64;

        if let Some(pct) = salida.try_get::<Option<f64>, _>("porcentaje").map_err(|e| e.to_string())? {
            // Percentage-based: calculate from input
            let pct_val = pct / 100.0;
            _total_porcentaje += pct;
            // Convert to same unit as input for calculation
            cantidad_salida = cantidad_entrada * pct_val;
        } else if let Some(cant) = salida.try_get::<Option<f64>, _>("cantidad").map_err(|e| e.to_string())? {
            // Fixed amount
            cantidad_salida = cant;
        } else {
            return Err(format!("Salida {} no tiene porcentaje ni cantidad definida", ingrediente_id));
        }

        salidas_calculadas.push((ingrediente_id, cantidad_salida, unidad));
    }

    // Deduct input ingredient from inventory
    let existing_inv: Option<(i64, f64)> = sqlx::query(
        "SELECT id, CAST(stock_actual AS DOUBLE) FROM inventario WHERE ingrediente_id = ?"
    ).bind(ingrediente_entrada_id).fetch_optional(pool).await.map_err(|e| e.to_string())?
        .map(|r| {
            (r.try_get::<i64, _>("id").unwrap_or(0),
             r.try_get::<f64, _>("stock_actual").unwrap_or(0.0))
        });

    if let Some((inv_id, stock_actual)) = existing_inv {
        let new_stock = (stock_actual - cantidad_entrada).max(0.0);
        sqlx::query("UPDATE inventario SET stock_actual = ?, ultima_actualizacion = CURRENT_TIMESTAMP WHERE id = ?")
            .bind(new_stock).bind(inv_id).execute(pool).await.map_err(|e| e.to_string())?;
    } else {
        return Err("No hay stock del ingrediente de entrada en inventario".to_string());
    }

    // Record input movement
    sqlx::query(
        "INSERT INTO inventario_movimientos (ingrediente_id, tipo, cantidad, referencia, notas) VALUES (?, 'salida', ?, ?, ?)"
    ).bind(ingrediente_entrada_id)
     .bind(cantidad_entrada)
     .bind(format!("Despiece #{}", despiece_id))
     .bind(format!("Despiece: {}", nombre_despiece))
     .execute(pool).await.map_err(|e| e.to_string())?;

    // Add output pieces to inventory
    for (ingrediente_id, cantidad_salida, unidad) in &salidas_calculadas {
        let existing_out: Option<(i64, f64)> = sqlx::query(
            "SELECT id, CAST(stock_actual AS DOUBLE) FROM inventario WHERE ingrediente_id = ?"
        ).bind(ingrediente_id).fetch_optional(pool).await.map_err(|e| e.to_string())?
            .map(|r| {
                (r.try_get::<i64, _>("id").unwrap_or(0),
                 r.try_get::<f64, _>("stock_actual").unwrap_or(0.0))
            });

        if let Some((inv_id, stock_actual)) = existing_out {
            let new_stock = stock_actual + cantidad_salida;
            sqlx::query("UPDATE inventario SET stock_actual = ?, ultima_actualizacion = CURRENT_TIMESTAMP WHERE id = ?")
                .bind(new_stock).bind(inv_id).execute(pool).await.map_err(|e| e.to_string())?;
        } else {
            sqlx::query(
                "INSERT INTO inventario (ingrediente_id, stock_actual, stock_minimo, unidad) VALUES (?, ?, 0, ?)"
            ).bind(ingrediente_id).bind(cantidad_salida).bind(unidad)
             .execute(pool).await.map_err(|e| e.to_string())?;
        }

        // Record output movement
        sqlx::query(
            "INSERT INTO inventario_movimientos (ingrediente_id, tipo, cantidad, referencia, notas) VALUES (?, 'entrada', ?, ?, ?)"
        ).bind(ingrediente_id)
         .bind(cantidad_salida)
         .bind(format!("Despiece #{}", despiece_id))
         .bind(format!("Salida de despiece"))
         .execute(pool).await.map_err(|e| e.to_string())?;
    }

    Ok(format!("Despiece ejecutado: {} → {} salidas", cantidad_entrada, salidas_calculadas.len()))
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
                // Reintentar conexión hasta 3 veces
                for attempt in 1..=3 {
                    match db::init_db().await {
                        Ok(()) => {
                            println!("Database connected successfully on attempt {}", attempt);
                            break;
                        }
                        Err(e) => {
                            eprintln!("Attempt {}/3 - Error connecting to database: {}", attempt, e);
                            if attempt < 3 {
                                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                            }
                        }
                    }
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
            update_receta_completa,
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
            get_fichas_receta,
            create_ficha_receta,
            update_ficha_receta,
            delete_ficha_receta,
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
            get_caja_categorias,
            create_categoria_caja,
            update_categoria_caja,
            delete_categoria_caja,
            get_caja_tickets,
            get_caja_tickets_con_ventas,
            create_caja_ticket,
            delete_caja_ticket,
            get_caja_resumen,
            get_platos_caja,
            create_plato_caja,
            update_plato_caja,
            delete_plato_caja,
            get_whatsapp_pedidos,
            update_whatsapp_pedido_estado,
            get_whatsapp_pedidos_nuevos,
            get_menu_del_dia,
            get_menu_del_dia_hoy,
            save_menu_del_dia,
            delete_menu_del_dia,
            get_recetas_basic,
            get_despieces,
            get_despiece_salidas,
            create_despiece,
            update_despiece,
            delete_despiece,
            execute_despiece,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
