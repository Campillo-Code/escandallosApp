# Plan de Ejecución — App de Escandallos

## Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Framework desktop | Tauri 2 |
| Frontend | React 19 + Vite |
| TypeScript | TypeScript 5.x |
| Estilos | Tailwind CSS 4.x |
| Base de datos | MySQL 8.0 (192.168.1.151) |
| Conexión DB | mysql2 (via Tauri commands) |
| Gráficos | Recharts |
| PDF | jsPDF + jspdf-autotable |
| Excel | xlsx (SheetJS) |
| Formularios | React Hook Form + Zod |
| Rutas | React Router v7 |
| Íconos | Lucide React |

---

## Modelo de base de datos

### Proveedores
```sql
CREATE TABLE proveedores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    contacto VARCHAR(255),
    telefono VARCHAR(50),
    email VARCHAR(255),
    direccion TEXT,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Ingredientes
```sql
CREATE TABLE ingredientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    unidad_base VARCHAR(20) NOT NULL, -- kg, l, ud
    categoria VARCHAR(100),
    alergenos TEXT, -- JSON: ["gluten","lactosa",...]
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Precios de ingredientes por proveedor
```sql
CREATE TABLE ingrediente_precios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ingrediente_id INT NOT NULL,
    proveedor_id INT NOT NULL,
    precio DECIMAL(10,4) NOT NULL,
    cantidad DECIMAL(10,3) NOT NULL,
    unidad VARCHAR(20) NOT NULL,
    precio_por_unidad_base DECIMAL(10,4),
    es_predeterminado BOOLEAN DEFAULT FALSE,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ingrediente_id) REFERENCES ingredientes(id) ON DELETE CASCADE,
    FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE CASCADE
);
```

### Histórico de precios
```sql
CREATE TABLE ingrediente_historico_precios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ingrediente_id INT NOT NULL,
    proveedor_id INT NOT NULL,
    precio_anterior DECIMAL(10,4),
    precio_nuevo DECIMAL(10,4),
    fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ingrediente_id) REFERENCES ingredientes(id) ON DELETE CASCADE,
    FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE CASCADE
);
```

### Recetas
```sql
CREATE TABLE recetas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    categoria VARCHAR(100),
    porciones INT DEFAULT 1,
    tiempo_preparacion INT,
    foto_url VARCHAR(500),
    es_base BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Ingredientes de receta
```sql
CREATE TABLE receta_ingredientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    receta_id INT NOT NULL,
    ingrediente_id INT,
    sub_receta_id INT,
    cantidad DECIMAL(10,3) NOT NULL,
    unidad VARCHAR(20) NOT NULL,
    merma_porcentaje DECIMAL(5,2) DEFAULT 0,
    notas TEXT,
    orden INT DEFAULT 0,
    FOREIGN KEY (receta_id) REFERENCES recetas(id) ON DELETE CASCADE,
    FOREIGN KEY (ingrediente_id) REFERENCES ingredientes(id) ON DELETE SET NULL,
    FOREIGN KEY (sub_receta_id) REFERENCES recetas(id) ON DELETE SET NULL
);
```

### Menús
```sql
CREATE TABLE menus (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    tipo VARCHAR(50),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Recetas en menú
```sql
CREATE TABLE menu_recetas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    menu_id INT NOT NULL,
    receta_id INT NOT NULL,
    precio_venta DECIMAL(10,2),
    orden INT DEFAULT 0,
    FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE,
    FOREIGN KEY (receta_id) REFERENCES recetas(id) ON DELETE CASCADE
);
```

### Albaranes
```sql
CREATE TABLE albaranes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    proveedor_id INT NOT NULL,
    numero_albaran VARCHAR(100),
    fecha_recepcion DATE NOT NULL,
    total DECIMAL(10,2),
    notas TEXT,
    procesado BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE CASCADE
);
```

### Detalle de albarán
```sql
CREATE TABLE albaranes_detalle (
    id INT AUTO_INCREMENT PRIMARY KEY,
    albaran_id INT NOT NULL,
    ingrediente_id INT NOT NULL,
    cantidad DECIMAL(10,3) NOT NULL,
    unidad VARCHAR(20) NOT NULL,
    precio_unitario DECIMAL(10,4) NOT NULL,
    subtotal DECIMAL(10,2),
    precio_anterior DECIMAL(10,4),
    FOREIGN KEY (albaran_id) REFERENCES albaranes(id) ON DELETE CASCADE,
    FOREIGN KEY (ingrediente_id) REFERENCES ingredientes(id) ON DELETE CASCADE
);
```

### Inventario / Stock
```sql
CREATE TABLE inventario (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ingrediente_id INT NOT NULL UNIQUE,
    stock_actual DECIMAL(10,3) DEFAULT 0,
    stock_minimo DECIMAL(10,3) DEFAULT 0,
    unidad VARCHAR(20) NOT NULL,
    ubicacion VARCHAR(100),
    ultima_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ingrediente_id) REFERENCES ingredientes(id) ON DELETE CASCADE
);
```

### Movimientos de inventario
```sql
CREATE TABLE inventario_movimientos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ingrediente_id INT NOT NULL,
    tipo ENUM('entrada', 'salida', 'merma', 'ajuste') NOT NULL,
    cantidad DECIMAL(10,3) NOT NULL,
    referencia VARCHAR(255),
    albaran_id INT,
    receta_id INT,
    notas TEXT,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ingrediente_id) REFERENCES ingredientes(id) ON DELETE CASCADE,
    FOREIGN KEY (albaran_id) REFERENCES albaranes(id) ON DELETE SET NULL,
    FOREIGN KEY (receta_id) REFERENCES recetas(id) ON DELETE SET NULL
);
```

### Usuarios
```sql
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol ENUM('admin', 'editor', 'visor') DEFAULT 'editor',
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Configuración
```sql
CREATE TABLE configuracion (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clave VARCHAR(100) UNIQUE NOT NULL,
    valor TEXT,
    descripcion TEXT
);

INSERT INTO configuracion (clave, valor, descripcion) VALUES
('margen_default', '30', 'Margen de beneficio por defecto (%)'),
('food_cost_objetivo', '30', 'Food cost objetivo (%)'),
('moneda', 'EUR', 'Moneda por defecto'),
('alerta_merma', '10', 'Umbral de alerta de merma (%)');
```

---

## Funcionalidades por módulo

### Módulo 1: Ingredientes
- CRUD completo
- Conversor de unidades (kg↔g, l↔ml)
- Mermas por ingrediente (% de pérdida)
- Alertas de subida de precio
- Histórico de precios por proveedor

### Módulo 2: Proveedores
- CRUD completo
- Asociar ingredientes con precios
- Comparar precios entre proveedores
- Contacto y notas

### Módulo 3: Recetas
- CRUD con ingredientes y cantidades
- Sub-recetas (salsas, masas, preparados base)
- Escalar recetas (4 → 400 raciones)
- Categorías y fotos
- Tiempo de preparación

### Módulo 4: Cálculo de Costes
- Coste por ingrediente automático
- Coste total por receta
- Food cost % (coste / precio venta)
- Semáforo: verde (<30%), amarillo (30-35%), rojo (>35%)
- Recálculo automático al cambiar precios
- Coste con mermas incluidas

### Módulo 5: Margen y Precio
- Configurar margen por receta
- Simulador "qué pasaría si"
- Sugerencia de precio según food cost objetivo
- Comparar margen real vs objetivo

### Módulo 6: Menús
- Crear menús combinando recetas
- Carta, menú del día, banquetes
- Precio por receta en menú
- Escalar todo el menú

### Módulo 7: Albaranes
- Registrar albarán de proveedor
- Asociar línea de detalle (ingrediente, cantidad, precio)
- Auto-actualización de precios al confirmar
- Guarda precio anterior para histórico
- Marca entradas en inventario automáticamente

### Módulo 8: Inventario
- Stock actual por ingrediente
- Stock mínimo con alertas
- Movimientos: entrada, salida, merma, ajuste
- Entrada automática al registrar albarán
- Ubicación (nevera, almacén, etc.)

### Módulo 9: Dashboard
- KPIs: food cost medio, receta más rentable, ingrediente más caro
- Gráficos de evolución de costes
- Menú Engineering (matriz BCG)
- Ranking de recetas por rentabilidad
- Alertas de stock bajo y precios subidos

### Módulo 10: Exportar
- PDF por receta (ficha técnica)
- PDF de escandallo completo
- PDF de menú
- Excel de ingredientes/recetas
- Informes de food cost mensual

### Módulo 11: Alérgenos
- Marcar alérgenos por ingrediente (14 UE)
- Matriz de alérgenos por receta
- Exportar información de alérgenos

---

## Flujo de albarán

1. Crear albarán → seleccionar proveedor
2. Agregar líneas: ingrediente × cantidad × precio
3. Al confirmar:
   a. Se guarda el precio anterior
   b. Se actualiza ingrediente_precios con el nuevo precio
   c. Se registra en ingrediente_historico_precios
   d. Se actualiza stock en inventario
   e. Se recalculan TODAS las recetas que usan ese ingrediente
   f. Se registra el movimiento en inventario_movimientos
4. Si el precio subió >10% → alerta visual

---

## Estructura del proyecto

```
escandallosApp/
├── docs/
│   └── plan-ejecucion.md
├── escandallos/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── ui/
│   │   │   ├── charts/
│   │   │   └── forms/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── ingredientes/
│   │   │   ├── proveedores/
│   │   │   ├── recetas/
│   │   │   ├── menus/
│   │   │   ├── albaranes/
│   │   │   ├── inventario/
│   │   │   └── reportes/
│   │   ├── lib/
│   │   │   ├── db.ts
│   │   │   ├── ingredientes.ts
│   │   │   ├── proveedores.ts
│   │   │   ├── recetas.ts
│   │   │   ├── menus.ts
│   │   │   ├── albaranes.ts
│   │   │   ├── inventario.ts
│   │   │   ├── historico.ts
│   │   │   ├── costes.ts
│   │   │   ├── alergenos.ts
│   │   │   └── pdf.ts
│   │   ├── hooks/
│   │   ├── types/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── src-tauri/
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── lib.rs
│   │   │   ├── commands/
│   │   │   └── db.rs
│   │   ├── Cargo.toml
│   │   └── tauri.conf.json
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

---

## Orden de desarrollo por fases

| Fase | Módulo | Estado |
|------|--------|--------|
| 0 | Configurar proyecto (Tauri + React + MySQL) | Pendiente |
| 1 | CRUD Proveedores | Pendiente |
| 2 | CRUD Ingredientes + conversor unidades | Pendiente |
| 3 | CRUD Recetas + ingredientes asociados | Pendiente |
| 4 | Cálculo de costes + food cost % | Pendiente |
| 5 | Margen y precio de venta | Pendiente |
| 6 | Alérgenos | Pendiente |
| 7 | CRUD Menús | Pendiente |
| 8 | Albaranes + auto-update de precios | Pendiente |
| 9 | Inventario + movimientos | Pendiente |
| 10 | Dashboard + gráficos | Pendiente |
| 11 | Exportar PDF + Excel | Pendiente |
| 12 | Pulir UI + tests | Pendiente |

---

## Notas

- Servidor MySQL: 192.168.1.151 (usuario: campillo)
- La app se ejecuta en Windows
- Dos usuarios (propietario y hermana)
- Uso local en la misma red
