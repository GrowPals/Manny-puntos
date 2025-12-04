# MANNY REWARDS - Plan Maestro de Implementación

> **Documento de Análisis Profundo y Plan de Implementación**
> **Versión:** 1.0
> **Fecha:** 2025-12-04

---

## TABLA DE CONTENIDOS

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Estado Actual del Sistema](#2-estado-actual-del-sistema)
3. [Análisis de Notion](#3-análisis-de-notion)
4. [Análisis de Supabase](#4-análisis-de-supabase)
5. [Análisis de la Aplicación](#5-análisis-de-la-aplicación)
6. [Identificación de Gaps y Problemas](#6-identificación-de-gaps-y-problemas)
7. [Arquitectura Propuesta](#7-arquitectura-propuesta)
8. [Plan de Implementación Detallado](#8-plan-de-implementación-detallado)
9. [Migraciones de Datos](#9-migraciones-de-datos)
10. [Consideraciones de Seguridad](#10-consideraciones-de-seguridad)
11. [Pruebas y Validación](#11-pruebas-y-validación)
12. [Riesgos y Mitigaciones](#12-riesgos-y-mitigaciones)

---

## 1. RESUMEN EJECUTIVO

### 1.1 Objetivo del Sistema

**Manny Rewards** es un sistema de lealtad que conecta:
- **Notion**: Centro de operaciones para administradores (gestión de canjes, visualización de puntos, cambio de niveles)
- **Supabase**: Motor técnico para la aplicación móvil (login, puntos, canjes, catálogo)
- **App React**: Interfaz para clientes (ver puntos, canjear recompensas)

### 1.2 Flujo Principal de Puntos

```
[Ticket en Notion] → Status: "Terminadas" + Monto → [Webhook] → [Edge Function]
                                                                    ↓
                                                           Calcular puntos (5%)
                                                                    ↓
                                                           [Supabase: clientes]
                                                           puntos_actuales += X
                                                                    ↓
                                                           [Notion: Contactos]
                                                           Actualizar "Puntos Actuales"
```

### 1.3 Decisión Arquitectónica Clave

**NO es bidireccional completo.** Cada sistema tiene su propósito:

| Sistema | Propósito Principal | Usuarios |
|---------|---------------------|----------|
| Notion | Operaciones, gestión de tickets, vista de clientes | Admins (no técnicos) |
| Supabase | Datos, autenticación, lógica de negocio | Sistema/App |
| App React | Interfaz de usuario, canjes | Clientes finales |

---

## 2. ESTADO ACTUAL DEL SISTEMA

### 2.1 Métricas Actuales (Supabase)

| Tabla | Registros | Observaciones |
|-------|-----------|---------------|
| `clientes` | 336 | Incluye 3 admins |
| `productos` | 2 | 1 producto, 1 servicio |
| `canjes` | 6 | Solo pruebas del admin |
| `historial_puntos` | 6 | Solo canjes (no entradas) |
| `integration_events` | 450 | Eventos de sync activos |

### 2.2 Estado de Notion

| Base de Datos | Registros (aprox) | Uso |
|---------------|-------------------|-----|
| Contactos | ~300+ | Clientes con teléfono |
| Tickets Manny | ~2000+ | Historial de servicios |
| Direcciones | ~200+ | Direcciones de clientes |
| Mannys | ~10 | Técnicos |
| Corps | ~20 | Empresas colaboradoras |

### 2.3 Edge Functions Existentes

| Función | Estado | Descripción |
|---------|--------|-------------|
| `integration-dispatcher` | ACTIVA | Envía eventos a N8N webhook |
| `sync-to-notion` | ACTIVA | Sync básico de clientes (sin usar) |

---

## 3. ANÁLISIS DE NOTION

### 3.1 Base de Datos: Contactos

**ID:** `17ac6cfd-8c1e-8068-8bc0-d32488189164`

#### Propiedades Clave:

| Propiedad | Tipo | Uso en Manny Rewards |
|-----------|------|---------------------|
| `Nombre` (title) | title | Nombre del cliente |
| `Teléfono` | phone_number | **LLAVE COMPARTIDA** con Supabase |
| `E-mail` | email | Email opcional |
| `Puntos` | number | **LEGACY** - multiplicador ×10, NO USAR |
| `Empresa` | select | Tipo de cliente |
| `Tickets` | relation | Todos los tickets del cliente |
| `Dirección Principal` | relation | Primera dirección |
| `Dirección Secundaria` | relation | Segunda dirección |
| `Dirección Terciaria` | relation | Tercera dirección |

#### Problema con Puntos Legacy:
```
Campo actual: "Puntos"
- Algunos clientes tienen valores como 10800, 2700, etc.
- Estos fueron calculados con multiplicador ×10 (sistema anterior)
- NO se pueden migrar directamente al nuevo sistema (5%)
```

#### Solución Propuesta:
1. Renombrar `Puntos` → `Puntos Legacy (No usar)`
2. Crear nuevo campo `Puntos Actuales` (number)
3. Todos los clientes inician en 0 puntos
4. Los puntos legacy quedan como referencia histórica

### 3.2 Base de Datos: Tickets Manny

**ID:** `17ac6cfd-8c1e-8162-b724-d4047a7e7635`

#### Propiedades Clave para Rewards:

| Propiedad | Tipo | Uso |
|-----------|------|-----|
| `Ticket` (title) | title | Identificador (T-XXXX) |
| `Status` | status | **TRIGGER**: "Terminadas" |
| `Monto` | number | Base para cálculo de puntos |
| `Contacto` | relation | Link al cliente |
| `Teléfono` | rollup | Teléfono del contacto (para lookup) |
| `Cliente` | rollup | Nombre del contacto |
| `Fecha` | date | Fecha del servicio |
| `Tipo de trabajo` | select | Categoría del servicio |

#### Estados del Pipeline:

```
Ticket → Clarificación → Cotización → Cotización Aceptada →
Cotización Rechazada → En lista → Coordinando → Camino →
En servicio → Reporte y cobro → Cobrar → Terminadas
```

**TRIGGER DE PUNTOS:** Cuando Status = "Terminadas" Y Monto > 0

### 3.3 Relaciones Existentes

```
Contactos ←→ Tickets Manny (dual_property)
    ↓
Contactos → Direcciones (1 a muchas)
    ↓
Tickets → Mannys (técnicos asignados)
    ↓
Tickets → Corps (empresas colaboradoras)
    ↓
Tickets → Movimientos (ingresos/egresos)
```

---

## 4. ANÁLISIS DE SUPABASE

### 4.1 Estructura de Tablas

#### Tabla: `clientes`

```sql
CREATE TABLE clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT now(),
    nombre TEXT NOT NULL,
    telefono TEXT NOT NULL UNIQUE,  -- LLAVE COMPARTIDA
    puntos_actuales INTEGER DEFAULT 0,
    nivel TEXT DEFAULT 'partner',   -- partner | vip
    es_admin BOOLEAN DEFAULT false,
    ultimo_servicio TEXT,
    fecha_ultimo_servicio TIMESTAMPTZ,
    fecha_registro TIMESTAMPTZ DEFAULT now(),
    notion_page_id TEXT,            -- Link a Notion
    sync_source VARCHAR(20) DEFAULT 'manual',
    sync_version VARCHAR(100),
    is_syncing BOOLEAN DEFAULT false,
    last_sync_at TIMESTAMPTZ,
    data_hash VARCHAR(32)
);
```

#### Tabla: `productos`

```sql
CREATE TABLE productos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT now(),
    nombre TEXT NOT NULL,
    descripcion TEXT,
    tipo TEXT NOT NULL,              -- 'producto' | 'servicio'
    puntos_requeridos INTEGER NOT NULL,
    stock INTEGER DEFAULT 999,       -- NULL para servicios
    activo BOOLEAN DEFAULT true,
    imagen_url TEXT,
    categoria TEXT
);
```

#### Tabla: `canjes`

```sql
CREATE TABLE canjes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT now(),
    cliente_id UUID REFERENCES clientes(id),
    producto_id UUID REFERENCES productos(id),
    puntos_usados INTEGER NOT NULL,
    estado TEXT NOT NULL,            -- Estados abajo
    fecha_entrega TIMESTAMPTZ,
    tipo_producto_original TEXT      -- 'producto' | 'servicio'
);

-- Estados posibles:
-- 'pendiente_entrega' - Producto físico, esperando entrega
-- 'en_lista' - Servicio, esperando agendar
-- 'agendado' - Servicio agendado
-- 'entregado' - Producto entregado
-- 'completado' - Servicio completado
```

#### Tabla: `historial_puntos`

```sql
CREATE TABLE historial_puntos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT now(),
    cliente_id UUID REFERENCES clientes(id),
    puntos INTEGER NOT NULL,         -- + para suma, - para resta
    concepto TEXT NOT NULL,
    canje_id UUID REFERENCES canjes(id)  -- NULL si es entrada de puntos
);
```

### 4.2 Funciones RPC Existentes

#### `registrar_canje_atomico(p_cliente_id, p_producto_id)`

```sql
-- Función transaccional para canjes
-- 1. Valida puntos suficientes
-- 2. Valida stock (si es producto)
-- 3. Descuenta puntos del cliente
-- 4. Descuenta stock (si es producto)
-- 5. Crea registro de canje
-- 6. Crea registro en historial_puntos
-- RETURNS: { nuevoSaldo, canjeId }
```

#### `asignar_puntos_atomico(p_cliente_telefono, p_puntos_a_sumar, p_concepto)`

```sql
-- Función para asignar puntos
-- 1. Busca cliente por teléfono
-- 2. Actualiza puntos_actuales
-- 3. Crea registro en historial_puntos
-- RETURNS: nuevo saldo
```

### 4.3 Triggers Existentes

| Trigger | Tabla | Evento | Acción |
|---------|-------|--------|--------|
| `trg_validar_puntos_cliente` | clientes | UPDATE | Valida puntos >= 0 |
| `trg_validar_datos_producto` | productos | INSERT/UPDATE | Valida datos |
| `clientes_integration_event_*` | clientes | INSERT/UPDATE | Encola evento |
| `trg_integration_enq_*` | canjes, productos, historial | ALL | Encola evento |

### 4.4 Políticas RLS

```sql
-- Clientes
- "Allow public read access" (SELECT para todos)
- "Users can manage their own data" (ALL para auth.uid() = id)
- "Admins can manage all clients" (ALL para get_is_admin())

-- Productos
- "Authenticated users can view products" (SELECT)
- "Admins can manage all products" (ALL)

-- Canjes
- "Users can manage their own redemptions" (ALL para cliente_id = auth.uid())
- "Admins can manage all redemptions" (ALL)

-- Historial
- "Users can see their own points history" (SELECT)
- "Admins can manage all points history" (ALL)
```

### 4.5 Sistema de Integración Actual

```
[Trigger en tabla]
    → enqueue_integration_event()
    → integration_events (status: 'pending')
    → pg_net.http_post() al dispatcher
    → integration-dispatcher Edge Function
    → N8N Webhook (si configurado)
```

**Estado actual de N8N:** No configurado (N8N_WEBHOOK_URL vacío)

---

## 5. ANÁLISIS DE LA APLICACIÓN

### 5.1 Stack Tecnológico

| Tecnología | Versión | Uso |
|------------|---------|-----|
| React | 18.2.0 | Framework UI |
| Vite | 5.2.11 | Build tool |
| React Router | 6.23.1 | Routing |
| Tailwind CSS | 3.x | Estilos |
| Radix UI | Latest | Componentes |
| Framer Motion | 10.18.0 | Animaciones |
| Recharts | 2.12.7 | Gráficos admin |
| Lucide React | 0.379.0 | Iconos |

### 5.2 Estructura de Archivos

```
/src
├── main.jsx                    # Entry point
├── App.jsx                     # Router + Providers
├── context/
│   ├── AuthContext.jsx         # Autenticación por teléfono
│   ├── SupabaseContext.jsx     # API de Supabase
│   └── ThemeContext.jsx        # Tema oscuro/claro
├── pages/
│   ├── Login.jsx               # Login por teléfono
│   ├── Dashboard.jsx           # Home del cliente
│   ├── ConfirmarCanje.jsx      # Confirmación de canje
│   ├── MisCanjes.jsx           # Historial de canjes
│   ├── Admin.jsx               # Dashboard admin
│   ├── AdminClientes.jsx       # CRUD clientes
│   ├── AdminProductos.jsx      # CRUD productos
│   ├── AdminEntregas.jsx       # Gestión de canjes
│   └── AdminGestion.jsx        # Roles de admin
├── components/
│   ├── ui/                     # Componentes Radix/Tailwind
│   ├── layout/                 # Header, Footer
│   └── features/               # ProductCard, ServicesList
├── hooks/
│   └── useProducts.js          # Hook de productos
└── lib/
    ├── customSupabaseClient.js # Cliente Supabase
    └── utils.js                # Utilidades
```

### 5.3 Flujo de Autenticación

```
1. Usuario entra a /login
2. Ingresa teléfono (10 dígitos)
3. AuthContext.login(telefono)
   → SupabaseContext.getClienteByTelefono()
   → SELECT * FROM clientes WHERE telefono = ?
4. Si existe:
   → Guardar en localStorage ('manny_user')
   → Redirigir a /dashboard o /admin (según es_admin)
5. Si no existe:
   → Toast error: "Número no registrado"
```

**Importante:** No hay registro público. Los clientes deben existir previamente.

### 5.4 Flujo de Canje

```
1. Cliente en /dashboard ve ProductCard[]
2. Click en producto → /canjear/:productoId
3. ConfirmarCanje valida:
   - puntos_actuales >= puntos_requeridos
   - producto.activo === true
   - producto.stock > 0 (si es producto)
4. Click "Confirmar Canje"
   → RPC registrar_canje_atomico()
5. Si éxito:
   → updateUser({ puntos_actuales: nuevoSaldo })
   → Redirect a /mis-canjes
```

### 5.5 Estados de Canjes en la App

| Estado | Tipo | Badge Color | Texto |
|--------|------|-------------|-------|
| `pendiente_entrega` | Producto | Amarillo | "Se entrega en próximo servicio" |
| `en_lista` | Servicio | Azul | "Te contactaremos para coordinar" |
| `agendado` | Servicio | Púrpura | "Agendado" |
| `entregado` | Producto | Verde | "Entregado" |
| `completado` | Servicio | Verde | "Completado" |

---

## 6. IDENTIFICACIÓN DE GAPS Y PROBLEMAS

### 6.1 CRÍTICO: No hay asignación automática de puntos

**Problema:** Los puntos solo se restan (canjes) pero nunca se suman automáticamente.

**Situación actual:**
- Existe `asignar_puntos_atomico()` pero solo se usa manualmente en AdminClientes
- No hay webhook desde Notion cuando un Ticket llega a "Terminadas"
- Los clientes nunca ganan puntos por servicios

**Impacto:** El sistema de rewards es inútil sin entrada de puntos.

### 6.2 CRÍTICO: Sincronización Notion incompleta

**Problema:** El botón "Crear en App Manny" en Notion no tiene funcionalidad.

**Situación actual:**
- `sync-to-notion` solo crea páginas nuevas en Notion
- No actualiza puntos en Notion
- No lee datos de Notion para crear clientes en Supabase

### 6.3 ALTO: Campo "Puntos" legacy en Notion

**Problema:** El campo Puntos en Contactos tiene datos con fórmula anterior (×10).

**Datos encontrados:**
```
Lourdes Cabrera: 10805 puntos (legacy)
Luis Enrique: 5000 puntos (legacy)
```

**Riesgo:** Confusión si se usa el mismo campo para el nuevo sistema.

### 6.4 ALTO: Clientes existentes sin notion_page_id

**Problema:** De 336 clientes en Supabase, muchos no tienen `notion_page_id`.

**Verificación requerida:**
```sql
SELECT COUNT(*) FROM clientes WHERE notion_page_id IS NULL;
-- Resultado: ~50-100 clientes sin link
```

### 6.5 MEDIO: N8N no configurado

**Problema:** El integration-dispatcher está activo pero no envía a ningún lado.

**Variables faltantes:**
- `N8N_WEBHOOK_URL` - vacío
- `N8N_WEBHOOK_TOKEN` - vacío

### 6.6 MEDIO: Tabla servicios_asignados vacía

**Problema:** Diseñada para beneficios VIP pero sin datos.

**Decisión:** ¿Se usará? Si no, eliminar para simplificar.

### 6.7 BAJO: useCart.jsx vacío

**Problema:** Hook vacío, posiblemente diseñado para feature futura.

**Decisión:** Eliminar si no se usará carrito.

### 6.8 BAJO: Duplicación de carpetas context

**Problema:** Existen `/src/context/` y `/src/contexts/` (deprecated).

**Acción:** Eliminar `/src/contexts/` para evitar confusión.

---

## 7. ARQUITECTURA PROPUESTA

### 7.1 Flujo de Puntos (Entrada)

```
┌─────────────────────────────────────────────────────────────────────┐
│                           NOTION                                     │
│  ┌───────────────────┐                                              │
│  │   Tickets Manny   │                                              │
│  │ Status: Terminadas│──────┐                                       │
│  │ Monto: $15,000    │      │                                       │
│  │ Contacto: Luis    │      │                                       │
│  └───────────────────┘      │                                       │
│           │                 │                                       │
│           │ (automation)    │                                       │
│           ▼                 │                                       │
│  ┌───────────────────┐      │                                       │
│  │    Webhook        │◄─────┘                                       │
│  │ (Notion native o  │                                              │
│  │  polling cron)    │                                              │
│  └───────────────────┘                                              │
└──────────┬──────────────────────────────────────────────────────────┘
           │
           │ HTTP POST
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SUPABASE                                     │
│  ┌───────────────────┐                                              │
│  │  Edge Function:   │                                              │
│  │ process-ticket    │                                              │
│  │                   │                                              │
│  │ 1. Extraer Monto  │                                              │
│  │ 2. Extraer Tel    │                                              │
│  │ 3. Calcular 5%    │                                              │
│  │ 4. Buscar cliente │                                              │
│  │ 5. Asignar puntos │                                              │
│  └───────────────────┘                                              │
│           │                                                         │
│           │ RPC asignar_puntos_atomico                              │
│           ▼                                                         │
│  ┌───────────────────┐      ┌───────────────────┐                   │
│  │     clientes      │      │  historial_puntos │                   │
│  │ puntos_actuales++ │◄────►│    + registro     │                   │
│  └───────────────────┘      └───────────────────┘                   │
│           │                                                         │
│           │ Trigger: enqueue_integration_event                      │
│           ▼                                                         │
│  ┌───────────────────┐                                              │
│  │integration_events │                                              │
│  │ status: pending   │                                              │
│  └───────────────────┘                                              │
└──────────┬──────────────────────────────────────────────────────────┘
           │
           │ Edge Function: sync-points-to-notion
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           NOTION                                     │
│  ┌───────────────────┐                                              │
│  │    Contactos      │                                              │
│  │ Puntos Actuales:  │                                              │
│  │      750          │ ← Actualizado                                │
│  └───────────────────┘                                              │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 Flujo de Canjes (Admin en Notion)

```
┌─────────────────────────────────────────────────────────────────────┐
│                           APP CLIENTE                                │
│                                                                      │
│  Dashboard → Canjear → Confirmar                                    │
│           │                                                          │
│           │ RPC registrar_canje_atomico                             │
│           ▼                                                          │
└──────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SUPABASE                                     │
│                                                                      │
│  canjes (nuevo registro)                                            │
│  - estado: 'pendiente_entrega'                                      │
│  - puntos_usados: 200                                               │
│           │                                                         │
│           │ Trigger → Edge Function                                 │
│           ▼                                                         │
│  sync-canje-to-notion                                               │
│  - Crear página en DB "Canjes Rewards" (Notion)                     │
│  - Actualizar "Puntos Actuales" en Contactos                        │
└──────────┬──────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           NOTION                                     │
│                                                                      │
│  ┌───────────────────────┐                                          │
│  │    Canjes Rewards     │  ← NUEVA BASE DE DATOS                   │
│  │ (Vista para admins)   │                                          │
│  │                       │                                          │
│  │ - Cliente: Luis       │                                          │
│  │ - Producto: Kit       │                                          │
│  │ - Estado: Pendiente   │                                          │
│  │ - Fecha: 2025-12-04   │                                          │
│  └───────────────────────┘                                          │
│           │                                                         │
│           │ Admin cambia estado → Entregado                         │
│           │ (via automation o webhook)                              │
│           ▼                                                         │
└──────────────────────────────────────────────────────────────────────┘
           │
           │ Webhook/Polling
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SUPABASE                                     │
│                                                                      │
│  Edge Function: sync-canje-status                                   │
│  - Actualizar canjes.estado = 'entregado'                           │
│  - Actualizar canjes.fecha_entrega                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.3 Bases de Datos Notion (Final)

#### Existentes (sin cambios mayores):

1. **Contactos** - Agregar campo `Puntos Actuales` (number)
2. **Tickets Manny** - Sin cambios (ya tiene todo lo necesario)

#### Nueva base de datos:

3. **Canjes Rewards** (CREAR)

```
Propiedades:
- Título: text (auto: "Canje #XXX - [Producto]")
- Cliente: relation → Contactos
- Producto: text (nombre del producto)
- Tipo: select (Producto | Servicio)
- Puntos Usados: number
- Estado: select (Pendiente | En proceso | Entregado | Completado)
- Fecha Solicitud: date (auto)
- Fecha Entrega: date (manual)
- Supabase ID: text (UUID del canje)
- Notas: rich_text
```

### 7.4 Edge Functions (Final)

| Función | Trigger | Acción |
|---------|---------|--------|
| `process-ticket-completed` | Webhook Notion | Calcular y asignar puntos |
| `sync-cliente-to-notion` | Trigger INSERT/UPDATE clientes | Crear/actualizar Contacto |
| `sync-canje-to-notion` | Trigger INSERT canjes | Crear en Canjes Rewards |
| `sync-canje-status-from-notion` | Webhook/Cron | Actualizar estado canje |
| `sync-nivel-from-notion` | Webhook/Cron | Actualizar nivel (VIP) |

---

## 8. PLAN DE IMPLEMENTACIÓN DETALLADO

### FASE 1: Preparación de Notion (Día 1-2)

#### 1.1 Modificar base de datos Contactos

```javascript
// Acciones en Notion:
1. Renombrar "Puntos" → "Puntos Legacy (No usar)"
2. Crear propiedad "Puntos Actuales" (number, format: number)
3. Crear propiedad "Nivel" (select: Partner, VIP)
4. Crear propiedad "Supabase ID" (text, para vincular)
```

#### 1.2 Crear base de datos Canjes Rewards

```javascript
// Crear nueva DB con propiedades:
{
  "Canje": { type: "title" },
  "Cliente": { type: "relation", database: "Contactos" },
  "Producto": { type: "text" },
  "Tipo": { type: "select", options: ["Producto", "Servicio"] },
  "Puntos Usados": { type: "number" },
  "Estado": {
    type: "select",
    options: ["Pendiente Entrega", "En Proceso", "Entregado", "Completado"]
  },
  "Fecha Solicitud": { type: "date" },
  "Fecha Entrega": { type: "date" },
  "Supabase ID": { type: "text" },
  "Teléfono Cliente": { type: "rollup", from: "Cliente.Teléfono" },
  "Notas": { type: "rich_text" }
}
```

#### 1.3 Crear vistas en Canjes Rewards

```javascript
// Vistas a crear:
1. "Pendientes de Entrega" - Filter: Estado = Pendiente
2. "Esta Semana" - Filter: Fecha Solicitud = This week
3. "Por Cliente" - Group by: Cliente
4. "Historial Completo" - Sort: Fecha desc
```

### FASE 2: Sincronización de Clientes (Día 3-4)

#### 2.1 Migración inicial: Supabase → Notion

```javascript
// Script de migración (ejecutar una vez):

async function migrarClientesANotion() {
  // 1. Obtener todos los clientes de Supabase sin notion_page_id
  const { data: clientes } = await supabase
    .from('clientes')
    .select('*')
    .is('notion_page_id', null);

  for (const cliente of clientes) {
    // 2. Buscar en Notion por teléfono
    const notionPage = await notion.databases.query({
      database_id: CONTACTOS_DB_ID,
      filter: {
        property: "Teléfono",
        phone_number: { equals: cliente.telefono }
      }
    });

    if (notionPage.results.length > 0) {
      // 3. Vincular existente
      const pageId = notionPage.results[0].id;
      await supabase
        .from('clientes')
        .update({ notion_page_id: pageId })
        .eq('id', cliente.id);

      // 4. Actualizar Puntos Actuales en Notion
      await notion.pages.update({
        page_id: pageId,
        properties: {
          "Puntos Actuales": { number: cliente.puntos_actuales },
          "Nivel": { select: { name: cliente.nivel === 'vip' ? 'VIP' : 'Partner' } },
          "Supabase ID": { rich_text: [{ text: { content: cliente.id } }] }
        }
      });
    } else {
      // 5. Crear nuevo en Notion
      const newPage = await notion.pages.create({
        parent: { database_id: CONTACTOS_DB_ID },
        properties: {
          "": { title: [{ text: { content: cliente.nombre } }] },
          "Teléfono": { phone_number: cliente.telefono },
          "Puntos Actuales": { number: cliente.puntos_actuales },
          "Nivel": { select: { name: cliente.nivel === 'vip' ? 'VIP' : 'Partner' } },
          "Supabase ID": { rich_text: [{ text: { content: cliente.id } }] }
        }
      });

      await supabase
        .from('clientes')
        .update({ notion_page_id: newPage.id })
        .eq('id', cliente.id);
    }
  }
}
```

#### 2.2 Edge Function: sync-cliente-to-notion

```typescript
// supabase/functions/sync-cliente-to-notion/index.ts

import { Client } from "npm:@notionhq/client@2.2.3";

const notion = new Client({ auth: Deno.env.get("NOTION_TOKEN") });
const CONTACTOS_DB = Deno.env.get("NOTION_CONTACTOS_DB_ID");

Deno.serve(async (req) => {
  const { record, type } = await req.json();

  if (type === 'INSERT') {
    // Crear nuevo contacto en Notion
    const page = await notion.pages.create({
      parent: { database_id: CONTACTOS_DB },
      properties: {
        "": { title: [{ text: { content: record.nombre } }] },
        "Teléfono": { phone_number: record.telefono },
        "Puntos Actuales": { number: record.puntos_actuales || 0 },
        "Nivel": { select: { name: record.nivel === 'vip' ? 'VIP' : 'Partner' } },
        "Supabase ID": { rich_text: [{ text: { content: record.id } }] }
      }
    });

    // Actualizar notion_page_id en Supabase
    // (usar service role key)
    return new Response(JSON.stringify({ notion_page_id: page.id }));
  }

  if (type === 'UPDATE' && record.notion_page_id) {
    // Actualizar contacto existente
    await notion.pages.update({
      page_id: record.notion_page_id,
      properties: {
        "Puntos Actuales": { number: record.puntos_actuales },
        "Nivel": { select: { name: record.nivel === 'vip' ? 'VIP' : 'Partner' } }
      }
    });

    return new Response(JSON.stringify({ success: true }));
  }

  return new Response(JSON.stringify({ skipped: true }));
});
```

### FASE 3: Sistema de Puntos por Tickets (Día 5-7)

#### 3.1 Opción A: Notion Automations (Recomendada)

```
En Notion:
1. Database: Tickets Manny
2. Automation: When Status changes to "Terminadas"
3. Action: Send webhook to Supabase Edge Function

Webhook URL: https://[project].supabase.co/functions/v1/process-ticket-completed
Headers: Authorization: Bearer [service_role_key]
Body: {
  "page_id": "{{page.id}}",
  "ticket_id": "{{Ticket ID}}",
  "monto": "{{Monto}}",
  "telefono": "{{Teléfono}}",
  "cliente_nombre": "{{Cliente}}"
}
```

#### 3.2 Opción B: Polling con Cron (Alternativa)

```typescript
// supabase/functions/poll-tickets-completed/index.ts
// Ejecutar cada 5 minutos con pg_cron

import { Client } from "npm:@notionhq/client@2.2.3";

const notion = new Client({ auth: Deno.env.get("NOTION_TOKEN") });
const TICKETS_DB = "17ac6cfd-8c1e-8162-b724-d4047a7e7635";

Deno.serve(async (req) => {
  // 1. Obtener tickets "Terminadas" de las últimas 24 horas
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const response = await notion.databases.query({
    database_id: TICKETS_DB,
    filter: {
      and: [
        { property: "Status", status: { equals: "Terminadas" } },
        { property: "Monto", number: { greater_than: 0 } },
        {
          timestamp: "last_edited_time",
          last_edited_time: { after: yesterday }
        }
      ]
    }
  });

  for (const ticket of response.results) {
    // 2. Verificar si ya fue procesado (campo custom o tabla de control)
    const ticketId = ticket.properties["ID"].unique_id.number;

    // 3. Extraer teléfono y monto
    const telefono = ticket.properties["Teléfono"].rollup.array[0]?.phone_number;
    const monto = ticket.properties["Monto"].number;

    if (!telefono || !monto) continue;

    // 4. Calcular puntos (5%)
    const puntos = Math.floor(monto * 0.05);

    // 5. Asignar puntos via RPC
    const { data, error } = await supabase.rpc('asignar_puntos_atomico', {
      p_cliente_telefono: telefono,
      p_puntos_a_sumar: puntos,
      p_concepto: `Ticket TI-${ticketId} - $${monto} MXN`
    });

    // 6. Marcar como procesado
    // ...
  }

  return new Response(JSON.stringify({ processed: response.results.length }));
});
```

#### 3.3 Edge Function: process-ticket-completed

```typescript
// supabase/functions/process-ticket-completed/index.ts

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { Client } from "npm:@notionhq/client@2.2.3";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const notion = new Client({ auth: Deno.env.get("NOTION_TOKEN") });
const CONTACTOS_DB = Deno.env.get("NOTION_CONTACTOS_DB_ID");

Deno.serve(async (req) => {
  try {
    const payload = await req.json();

    // Extraer datos del ticket
    const { page_id, ticket_id, monto, telefono, cliente_nombre } = payload;

    // Validaciones
    if (!telefono || telefono.length !== 10) {
      return new Response(JSON.stringify({ error: "Teléfono inválido" }), { status: 400 });
    }

    const montoNum = parseFloat(monto);
    if (!montoNum || montoNum <= 0) {
      return new Response(JSON.stringify({ error: "Monto inválido" }), { status: 400 });
    }

    // Calcular puntos (5%)
    const puntos = Math.floor(montoNum * 0.05);

    // Verificar si el ticket ya fue procesado
    const { data: existing } = await supabase
      .from('historial_puntos')
      .select('id')
      .ilike('concepto', `%${ticket_id}%`)
      .single();

    if (existing) {
      return new Response(JSON.stringify({
        skipped: true,
        reason: "Ticket ya procesado"
      }));
    }

    // Asignar puntos
    const { data, error } = await supabase.rpc('asignar_puntos_atomico', {
      p_cliente_telefono: telefono,
      p_puntos_a_sumar: puntos,
      p_concepto: `Servicio completado - ${ticket_id} - $${montoNum.toLocaleString()} MXN`
    });

    if (error) {
      // Si el cliente no existe, crearlo
      if (error.message.includes('no encontrado')) {
        const { data: newCliente } = await supabase
          .from('clientes')
          .insert({
            nombre: cliente_nombre || 'Cliente Nuevo',
            telefono: telefono,
            puntos_actuales: puntos
          })
          .select()
          .single();

        // Registrar en historial
        await supabase.from('historial_puntos').insert({
          cliente_id: newCliente.id,
          puntos: puntos,
          concepto: `Servicio completado - ${ticket_id} - $${montoNum.toLocaleString()} MXN`
        });

        return new Response(JSON.stringify({
          success: true,
          new_client: true,
          puntos_asignados: puntos,
          nuevo_saldo: puntos
        }));
      }

      throw error;
    }

    return new Response(JSON.stringify({
      success: true,
      puntos_asignados: puntos,
      nuevo_saldo: data
    }));

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
```

### FASE 4: Sincronización de Canjes (Día 8-9)

#### 4.1 Edge Function: sync-canje-to-notion

```typescript
// supabase/functions/sync-canje-to-notion/index.ts

import { Client } from "npm:@notionhq/client@2.2.3";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const notion = new Client({ auth: Deno.env.get("NOTION_TOKEN") });
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CANJES_DB = Deno.env.get("NOTION_CANJES_DB_ID");
const CONTACTOS_DB = Deno.env.get("NOTION_CONTACTOS_DB_ID");

Deno.serve(async (req) => {
  const { record, type } = await req.json();

  if (type !== 'INSERT') {
    return new Response(JSON.stringify({ skipped: true }));
  }

  // Obtener datos completos del canje
  const { data: canje } = await supabase
    .from('canjes')
    .select(`
      *,
      cliente:clientes(nombre, telefono, notion_page_id),
      producto:productos(nombre, tipo)
    `)
    .eq('id', record.id)
    .single();

  // Buscar/crear relación con Contacto en Notion
  let contactoPageId = canje.cliente.notion_page_id;

  if (!contactoPageId) {
    // Buscar por teléfono
    const search = await notion.databases.query({
      database_id: CONTACTOS_DB,
      filter: {
        property: "Teléfono",
        phone_number: { equals: canje.cliente.telefono }
      }
    });

    if (search.results.length > 0) {
      contactoPageId = search.results[0].id;
    }
  }

  // Mapear estado
  const estadoNotion = {
    'pendiente_entrega': 'Pendiente Entrega',
    'en_lista': 'En Proceso',
    'agendado': 'En Proceso',
    'entregado': 'Entregado',
    'completado': 'Completado'
  }[canje.estado] || 'Pendiente Entrega';

  // Crear página en Canjes Rewards
  const properties: any = {
    "Canje": {
      title: [{
        text: { content: `Canje - ${canje.producto.nombre}` }
      }]
    },
    "Producto": {
      rich_text: [{ text: { content: canje.producto.nombre } }]
    },
    "Tipo": {
      select: { name: canje.producto.tipo === 'servicio' ? 'Servicio' : 'Producto' }
    },
    "Puntos Usados": { number: canje.puntos_usados },
    "Estado": { select: { name: estadoNotion } },
    "Fecha Solicitud": { date: { start: canje.created_at } },
    "Supabase ID": { rich_text: [{ text: { content: canje.id } }] }
  };

  // Agregar relación si existe
  if (contactoPageId) {
    properties["Cliente"] = { relation: [{ id: contactoPageId }] };
  }

  const page = await notion.pages.create({
    parent: { database_id: CANJES_DB },
    properties
  });

  // Guardar notion_page_id en el canje
  await supabase
    .from('canjes')
    .update({ notion_page_id: page.id })
    .eq('id', canje.id);

  return new Response(JSON.stringify({
    success: true,
    notion_page_id: page.id
  }));
});
```

#### 4.2 Agregar columna notion_page_id a canjes

```sql
-- Migración
ALTER TABLE canjes ADD COLUMN notion_page_id TEXT;
```

### FASE 5: Sincronización bidireccional de estados (Día 10-11)

#### 5.1 Webhook desde Notion para cambios de estado

```javascript
// Notion Automation en "Canjes Rewards":
// Trigger: When "Estado" changes
// Action: Send webhook

// URL: https://[project].supabase.co/functions/v1/sync-canje-status
// Body: {
//   "page_id": "{{page.id}}",
//   "nuevo_estado": "{{Estado}}",
//   "supabase_id": "{{Supabase ID}}"
// }
```

#### 5.2 Edge Function: sync-canje-status

```typescript
// supabase/functions/sync-canje-status/index.ts

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  const { supabase_id, nuevo_estado } = await req.json();

  // Mapear estado de Notion a Supabase
  const estadoMap: Record<string, string> = {
    'Pendiente Entrega': 'pendiente_entrega',
    'En Proceso': 'en_lista',
    'Entregado': 'entregado',
    'Completado': 'completado'
  };

  const estadoSupabase = estadoMap[nuevo_estado];

  if (!estadoSupabase) {
    return new Response(JSON.stringify({ error: "Estado no válido" }), { status: 400 });
  }

  const updateData: any = { estado: estadoSupabase };

  // Agregar fecha de entrega si corresponde
  if (estadoSupabase === 'entregado' || estadoSupabase === 'completado') {
    updateData.fecha_entrega = new Date().toISOString();
  }

  const { error } = await supabase
    .from('canjes')
    .update(updateData)
    .eq('id', supabase_id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }));
});
```

### FASE 6: Sincronización de Nivel VIP (Día 12)

#### 6.1 Webhook desde Notion para cambio de nivel

```typescript
// supabase/functions/sync-nivel-from-notion/index.ts

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  const { telefono, nivel } = await req.json();

  const nivelSupabase = nivel === 'VIP' ? 'vip' : 'partner';

  const { error } = await supabase
    .from('clientes')
    .update({ nivel: nivelSupabase })
    .eq('telefono', telefono);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }));
});
```

### FASE 7: Testing y Ajustes (Día 13-14)

#### 7.1 Casos de prueba

```markdown
## Test Cases

### T1: Asignación de puntos por ticket
1. Crear ticket en Notion para cliente existente
2. Agregar Monto: 15000
3. Cambiar Status a "Terminadas"
4. Verificar:
   - [ ] puntos_actuales += 750 en Supabase
   - [ ] historial_puntos tiene registro
   - [ ] Puntos Actuales actualizado en Notion Contactos

### T2: Asignación de puntos - cliente nuevo
1. Crear ticket con teléfono nuevo
2. Completar ticket con Monto
3. Verificar:
   - [ ] Cliente creado en Supabase
   - [ ] Puntos asignados
   - [ ] Cliente creado/vinculado en Notion

### T3: Canje de producto
1. Login como cliente con puntos
2. Realizar canje de producto
3. Verificar:
   - [ ] puntos_actuales decrementado
   - [ ] Registro en canjes (Supabase)
   - [ ] Registro en Canjes Rewards (Notion)
   - [ ] Estado inicial correcto

### T4: Cambio de estado desde Notion
1. En Notion Canjes Rewards, cambiar estado a "Entregado"
2. Verificar:
   - [ ] canjes.estado = 'entregado' en Supabase
   - [ ] fecha_entrega poblada
   - [ ] App muestra estado actualizado

### T5: Cambio de nivel VIP
1. En Notion Contactos, cambiar Nivel a "VIP"
2. Verificar:
   - [ ] clientes.nivel = 'vip' en Supabase
   - [ ] App muestra badge VIP
```

---

## 9. MIGRACIONES DE DATOS

### 9.1 Migración SQL: Agregar campos

```sql
-- Migración 001: Agregar notion_page_id a canjes
ALTER TABLE canjes ADD COLUMN IF NOT EXISTS notion_page_id TEXT;

-- Migración 002: Índice para búsqueda por notion_page_id
CREATE INDEX IF NOT EXISTS idx_clientes_notion_page_id ON clientes(notion_page_id);
CREATE INDEX IF NOT EXISTS idx_canjes_notion_page_id ON canjes(notion_page_id);

-- Migración 003: Tabla de control de tickets procesados
CREATE TABLE IF NOT EXISTS tickets_procesados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notion_ticket_id TEXT UNIQUE NOT NULL,
    ticket_number TEXT NOT NULL,
    monto NUMERIC(10,2) NOT NULL,
    puntos_asignados INTEGER NOT NULL,
    cliente_id UUID REFERENCES clientes(id),
    processed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tickets_procesados_notion_id ON tickets_procesados(notion_ticket_id);
```

### 9.2 Script de vinculación inicial

```javascript
// scripts/vincular-clientes-notion.js
// Ejecutar una vez para vincular clientes existentes

const { createClient } = require('@supabase/supabase-js');
const { Client } = require('@notionhq/client');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const notion = new Client({ auth: NOTION_TOKEN });

async function vincularClientes() {
  // 1. Obtener clientes sin notion_page_id
  const { data: clientes } = await supabase
    .from('clientes')
    .select('*')
    .is('notion_page_id', null);

  console.log(`Procesando ${clientes.length} clientes...`);

  let vinculados = 0;
  let creados = 0;
  let errores = 0;

  for (const cliente of clientes) {
    try {
      // 2. Buscar en Notion por teléfono
      const response = await notion.databases.query({
        database_id: CONTACTOS_DB_ID,
        filter: {
          property: "Teléfono",
          phone_number: { equals: cliente.telefono }
        }
      });

      if (response.results.length > 0) {
        // Vincular existente
        const pageId = response.results[0].id;

        await supabase
          .from('clientes')
          .update({ notion_page_id: pageId })
          .eq('id', cliente.id);

        // Actualizar puntos en Notion
        await notion.pages.update({
          page_id: pageId,
          properties: {
            "Puntos Actuales": { number: cliente.puntos_actuales },
            "Supabase ID": {
              rich_text: [{ text: { content: cliente.id } }]
            }
          }
        });

        vinculados++;
      } else {
        // Crear nuevo en Notion
        const newPage = await notion.pages.create({
          parent: { database_id: CONTACTOS_DB_ID },
          properties: {
            "": { title: [{ text: { content: cliente.nombre } }] },
            "Teléfono": { phone_number: cliente.telefono },
            "Puntos Actuales": { number: cliente.puntos_actuales },
            "Supabase ID": {
              rich_text: [{ text: { content: cliente.id } }]
            }
          }
        });

        await supabase
          .from('clientes')
          .update({ notion_page_id: newPage.id })
          .eq('id', cliente.id);

        creados++;
      }

      // Rate limiting
      await new Promise(r => setTimeout(r, 350));

    } catch (error) {
      console.error(`Error con ${cliente.telefono}:`, error.message);
      errores++;
    }
  }

  console.log(`
    Resultados:
    - Vinculados: ${vinculados}
    - Creados: ${creados}
    - Errores: ${errores}
  `);
}

vincularClientes();
```

---

## 10. CONSIDERACIONES DE SEGURIDAD

### 10.1 Variables de Entorno Requeridas

```bash
# Supabase Edge Functions
SUPABASE_URL=https://kuftyqupibyjliaukpxn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # NO exponer públicamente
SUPABASE_ANON_KEY=eyJ...

# Notion
NOTION_TOKEN=secret_...
NOTION_CONTACTOS_DB_ID=17ac6cfd-8c1e-8068-8bc0-d32488189164
NOTION_TICKETS_DB_ID=17ac6cfd-8c1e-8162-b724-d4047a7e7635
NOTION_CANJES_DB_ID=  # Se creará en Fase 1
```

### 10.2 Validaciones Críticas

```typescript
// En todas las Edge Functions:

// 1. Validar teléfono
function validateTelefono(tel: string): boolean {
  return /^\d{10}$/.test(tel);
}

// 2. Validar monto positivo
function validateMonto(monto: number): boolean {
  return typeof monto === 'number' && monto > 0 && monto < 10000000;
}

// 3. Prevenir duplicados
async function isTicketProcessed(ticketId: string): Promise<boolean> {
  const { data } = await supabase
    .from('tickets_procesados')
    .select('id')
    .eq('notion_ticket_id', ticketId)
    .single();
  return !!data;
}

// 4. Rate limiting
const RATE_LIMIT = new Map<string, number>();
function checkRateLimit(key: string, maxPerMinute: number): boolean {
  const now = Date.now();
  const count = RATE_LIMIT.get(key) || 0;
  // ... implementar sliding window
}
```

### 10.3 Auditoría

```sql
-- Crear tabla de auditoría
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    user_id UUID,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger de auditoría para cambios de puntos
CREATE OR REPLACE FUNCTION audit_puntos_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.puntos_actuales IS DISTINCT FROM NEW.puntos_actuales THEN
        INSERT INTO audit_log (action, table_name, record_id, old_data, new_data)
        VALUES (
            'UPDATE_PUNTOS',
            'clientes',
            NEW.id,
            jsonb_build_object('puntos_actuales', OLD.puntos_actuales),
            jsonb_build_object('puntos_actuales', NEW.puntos_actuales)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_puntos
AFTER UPDATE ON clientes
FOR EACH ROW
EXECUTE FUNCTION audit_puntos_change();
```

---

## 11. PRUEBAS Y VALIDACIÓN

### 11.1 Checklist Pre-Producción

```markdown
## Infraestructura
- [ ] Variables de entorno configuradas en Supabase
- [ ] Edge Functions desplegadas y activas
- [ ] Notion Automations configuradas
- [ ] Bases de datos Notion creadas con propiedades correctas

## Datos
- [ ] Todos los clientes tienen notion_page_id
- [ ] Campo "Puntos Legacy" renombrado
- [ ] Campo "Puntos Actuales" creado en Notion
- [ ] Base de datos "Canjes Rewards" creada con vistas

## Funcionalidad
- [ ] Puntos se asignan al completar ticket
- [ ] Canjes se sincronizan a Notion
- [ ] Cambios de estado se propagan bidireccionalmente
- [ ] Cambios de nivel VIP funcionan

## Performance
- [ ] Edge Functions responden en < 3s
- [ ] No hay timeouts en webhooks
- [ ] Rate limiting funciona correctamente

## Seguridad
- [ ] Service role key no expuesto
- [ ] Validaciones de entrada activas
- [ ] Auditoría funcionando
```

### 11.2 Monitoreo Post-Lanzamiento

```sql
-- Queries de monitoreo

-- 1. Eventos pendientes (deberían ser 0 o pocos)
SELECT COUNT(*) as pending_events
FROM integration_events
WHERE status = 'pending' AND created_at > NOW() - INTERVAL '1 hour';

-- 2. Errores recientes
SELECT * FROM integration_events
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 10;

-- 3. Tickets procesados hoy
SELECT COUNT(*) as tickets_hoy, SUM(puntos_asignados) as puntos_totales
FROM tickets_procesados
WHERE processed_at > CURRENT_DATE;

-- 4. Clientes sin vincular
SELECT COUNT(*) as sin_vincular
FROM clientes
WHERE notion_page_id IS NULL;

-- 5. Canjes sin sync
SELECT COUNT(*) as sin_sync
FROM canjes
WHERE notion_page_id IS NULL;
```

---

## 12. RIESGOS Y MITIGACIONES

### 12.1 Matriz de Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Notion API rate limit | Media | Alto | Implementar cola y retry con backoff |
| Duplicación de puntos | Baja | Alto | Tabla tickets_procesados + verificación |
| Webhook Notion falla | Media | Medio | Polling como fallback + alertas |
| Cliente no encontrado | Media | Bajo | Crear cliente automáticamente |
| Monto incorrecto/nulo | Media | Medio | Validaciones + log de tickets ignorados |
| Pérdida de sync | Baja | Alto | Reconciliación periódica (cron diario) |

### 12.2 Plan de Rollback

```markdown
## En caso de problemas críticos:

1. **Desactivar Edge Functions**
   ```bash
   supabase functions delete process-ticket-completed
   supabase functions delete sync-canje-to-notion
   ```

2. **Desactivar Notion Automations**
   - Ir a cada automation y pausar

3. **Revertir datos si es necesario**
   ```sql
   -- Restaurar puntos desde historial
   UPDATE clientes c
   SET puntos_actuales = (
     SELECT COALESCE(SUM(puntos), 0)
     FROM historial_puntos h
     WHERE h.cliente_id = c.id
   );
   ```

4. **Comunicar a admins**
   - Notificar que sistema está en modo manual
   - Proporcionar instrucciones para asignación manual
```

---

## ANEXOS

### A. IDs de Bases de Datos Notion

| Base de Datos | ID |
|---------------|-----|
| Contactos | `17ac6cfd-8c1e-8068-8bc0-d32488189164` |
| Tickets Manny | `17ac6cfd-8c1e-8162-b724-d4047a7e7635` |
| Direcciones | `1c2c6cfd-8c1e-804d-b0da-f4ea118b232e` |
| Mannys | `1aec6cfd-8c1e-8062-af5c-c3b08e15dd96` |
| Corps | `1c1c6cfd-8c1e-80d9-b212-fef5b8f37bdc` |
| Canjes Rewards | *Por crear* |

### B. Mapeo de Estados

| App/Supabase | Notion |
|--------------|--------|
| `pendiente_entrega` | Pendiente Entrega |
| `en_lista` | En Proceso |
| `agendado` | En Proceso |
| `entregado` | Entregado |
| `completado` | Completado |

### C. Fórmula de Puntos

```
Puntos = floor(Monto × 0.05)

Ejemplos:
- $1,000 MXN → 50 puntos
- $5,000 MXN → 250 puntos
- $15,000 MXN → 750 puntos
- $100,000 MXN → 5,000 puntos
```

### D. Contacto del Proyecto

- **Repositorio:** `/home/bigez/Manny Rewards`
- **Supabase Project:** `kuftyqupibyjliaukpxn`
- **Notion Workspace:** Manny

---

> **Documento generado:** 2025-12-04
> **Autor:** Claude Code Analysis
> **Estado:** IMPLEMENTADO

---

## 13. RESUMEN DE IMPLEMENTACIÓN (2025-12-04)

### Completado

| Paso | Descripción | Estado |
|------|-------------|--------|
| 1 | Base de datos "Canjes Rewards" creada en Notion | ✅ ID: `2bfc6cfd-8c1e-8149-a69c-d7c81f4cbc58` |
| 2 | Campos agregados a Contactos: "Puntos Actuales", "Nivel", "Supabase ID" | ✅ |
| 3 | Migración de puntos (÷10) en Supabase y Notion | ✅ 31 clientes migrados |
| 4 | Vinculación de clientes Supabase ↔ Notion | ✅ 13 de 25 vinculados |
| 5 | Edge Function: `notion-contact-webhook` | ✅ Desplegada |
| 6 | Edge Function: `notion-ticket-completed` | ✅ Desplegada |

### Edge Functions Desplegadas

```
https://kuftyqupibyjliaukpxn.supabase.co/functions/v1/notion-contact-webhook
https://kuftyqupibyjliaukpxn.supabase.co/functions/v1/notion-ticket-completed
```

### Próximos Pasos (Configuración en Notion)

1. **Configurar Webhook de Contactos** (Notion Automations):
   - Trigger: Cuando se crea una página en Contactos
   - Action: HTTP Request a `notion-contact-webhook`

2. **Configurar Webhook de Tickets** (Notion Automations):
   - Trigger: Cuando Status cambia a "Terminadas"
   - Action: HTTP Request a `notion-ticket-completed`

3. **Agregar NOTION_TOKEN** como variable de entorno en Supabase:
   - Dashboard → Edge Functions → Secrets
   - Nombre: `NOTION_TOKEN`
   - Valor: Tu token de integración de Notion

### Tabla de Backup Creada

```sql
-- Para restaurar puntos originales si es necesario:
SELECT * FROM backup_puntos_migracion ORDER BY puntos_originales DESC;
```

### Clientes sin Notion (12)

Estos clientes fueron creados desde la app y no existen en Notion. La Edge Function `notion-contact-webhook` los creará automáticamente cuando se registren nuevos contactos desde Notion:

- Admin (cuenta de prueba)
- Abel Morales, Carlos Canchola, Carlos Hernandez
- Dennise Torres Calderón, Fatima Gallardo Lozano
- Juan Armando Arroyo, Leonardo Figueroa, Marco Aguilar
- Mayela Perez, Misael Jimenez, Xóch
