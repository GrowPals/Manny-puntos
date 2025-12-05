# Manny Rewards - Arquitectura Técnica
## Sistema Consolidado - Diciembre 2025

---

## Resumen del Sistema

Manny Rewards es un sistema de lealtad que integra:
- **Frontend**: React + Vite (PWA)
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Operaciones**: Notion (Gestión de contactos, tickets y rewards)

---

## Tablas en Supabase

### Tablas Principales

| Tabla | Propósito |
|-------|-----------|
| `clientes` | Datos de clientes, puntos, nivel (partner/vip) |
| `productos` | Catálogo de productos/servicios canjeables |
| `canjes` | Registro de canjes realizados |
| `historial_puntos` | Log de movimientos de puntos |
| `ticket_events` | Eventos de webhooks de Notion |
| `push_subscriptions` | Suscripciones de notificaciones push |
| `notification_history` | Historial de notificaciones enviadas |
| `servicios_asignados` | Beneficios precargados para Partners |

### Esquema: clientes

```sql
id UUID PRIMARY KEY
nombre TEXT
telefono TEXT UNIQUE
puntos_actuales INTEGER
nivel TEXT ('partner' | 'vip')
es_admin BOOLEAN
notion_page_id TEXT  -- Vinculación con Notion
last_sync_at TIMESTAMP
created_at TIMESTAMP
```

### Esquema: productos

```sql
id UUID PRIMARY KEY
nombre TEXT
descripcion TEXT
puntos_requeridos INTEGER
tipo TEXT ('producto' | 'servicio')
activo BOOLEAN
stock INTEGER
imagen_url TEXT
created_at TIMESTAMP
```

### Esquema: canjes

```sql
id UUID PRIMARY KEY
cliente_id UUID REFERENCES clientes
producto_id UUID REFERENCES productos
puntos_usados INTEGER
estado TEXT ('pendiente_entrega' | 'en_lista' | 'entregado' | 'completado')
fecha_entrega TIMESTAMP
notion_page_id TEXT  -- Vinculación con Notion
created_at TIMESTAMP
```

---

## Edge Functions Desplegadas

### Funciones Esenciales (8)

| Función | Propósito | Trigger |
|---------|-----------|---------|
| `notion-contact-webhook` | Crear cliente cuando se agrega contacto en Notion | Webhook Notion |
| `notion-ticket-completed` | Asignar puntos cuando ticket se marca pagado + notificar | Webhook Notion |
| `notion-canje-status-webhook` | Recibir cambios de estado de canje desde Notion | Webhook Notion |
| `notion-cliente-sync` | Sincronizar nivel/puntos desde Notion a Supabase | Webhook Notion |
| `sync-canje-to-notion` | Crear canje en Manny Rewards DB de Notion | Llamada desde app |
| `update-canje-status-notion` | Sincronizar cambio de estado a Notion | Llamada desde app |
| `update-cliente-nivel` | Cambiar nivel y registrar en Notion | Llamada desde app |
| `send-push-notification` | Enviar notificaciones push a clientes/admins | Llamada interna |

### IDs de Bases de Datos en Notion

```
Contactos:     17ac6cfd-8c1e-8068-8bc0-d32488189164
Tickets:       17ac6cfd-8c1e-8162-b724-d4047a7e7635
Manny Rewards: 2bfc6cfd-8c1e-8026-9291-e4bc8c18ee01
```

---

## Flujos de Datos

### 1. Nuevo Contacto en Notion → Cliente en Supabase

```
[Notion Contactos]
    ↓ (Notion Automation webhook)
[notion-contact-webhook]
    ↓
[Supabase clientes] (nuevo registro con nivel='partner')
```

### 2. Ticket Pagado → Puntos al Cliente

```
[Notion Tickets: estado="Pagado"]
    ↓ (Notion Automation webhook)
[notion-ticket-completed]
    ↓ (calcula 5% del monto)
[asignar_puntos_atomico RPC]
    ↓
[clientes.puntos_actuales actualizado]
[historial_puntos: nuevo registro]
[Notion Manny Rewards: entrada "Puntos Ganados"]
```

### 3. Cliente Canjea desde App

```
[App: cliente solicita canje]
    ↓
[registrar_canje_atomico RPC]
    ↓
[canjes: nuevo registro estado='pendiente_entrega']
[clientes.puntos_actuales restados]
    ↓
[sync-canje-to-notion]
    ↓
[Notion Manny Rewards: entrada "Canje"]
```

### 4. Admin Cambia Estado de Canje

```
[App Admin: cambiar estado canje]
    ↓
[Supabase canjes UPDATE]
    ↓
[update-canje-status-notion]
    ↓
[Notion Manny Rewards: estado actualizado]
```

### 5. Admin Cambia Nivel de Cliente (desde App)

```
[App Admin: cambiar nivel]
    ↓
[update-cliente-nivel]
    ↓
[Supabase clientes.nivel actualizado]
[Notion Manny Rewards: entrada "Cambio de nivel"]
```

### 6. Administrativo Cambia Nivel/Puntos (desde Notion)

```text
[Notion: cambiar nivel o puntos en Contactos/Manny Rewards]
    ↓ (Notion Automation webhook)
[notion-cliente-sync]
    ↓
[Supabase clientes.nivel y/o puntos_actuales actualizado]
```

---

## Funciones RPC en Supabase

### asignar_puntos_atomico

```sql
asignar_puntos_atomico(
  p_cliente_telefono TEXT,
  p_puntos_a_sumar INTEGER,
  p_concepto TEXT
) RETURNS JSON
```

- Busca cliente por teléfono
- Actualiza puntos_actuales atómicamente
- Crea registro en historial_puntos
- Retorna { clienteId, nuevoSaldo }

### registrar_canje_atomico

```sql
registrar_canje_atomico(
  p_cliente_id UUID,
  p_producto_id UUID
) RETURNS JSON
```

- Verifica puntos suficientes
- Verifica stock disponible
- Resta puntos atómicamente
- Crea registro de canje
- Actualiza stock del producto
- Retorna { canjeId, nuevoSaldo }

---

## Frontend: SupabaseContext API

### Métodos Disponibles

```javascript
// Clientes
getClienteByTelefono(telefono)
getTodosLosClientes()
crearOActualizarCliente(clienteData)
asignarPuntosManualmente(telefono, puntos, concepto)
cambiarRolAdmin(clienteId, esAdmin)
cambiarNivelCliente(clienteId, nuevoNivel)  // Sincroniza con Notion

// Productos
getProductosCanje()
getAllProductosAdmin()
getProductoById(id)
crearOActualizarProducto(productoData)
eliminarProducto(productoId)

// Canjes
getTodosLosCanjes()
getCanjesPendientes()
getClienteHistorial(telefono)
registrarCanje({ cliente_id, producto_id })  // Sincroniza con Notion
actualizarEstadoCanje(canjeId, nuevoEstado)  // Sincroniza con Notion

// Utilidades
exportMannyData()
importMannyData(data)
```

---

## Seguridad

### Row Level Security (RLS)

Todas las tablas tienen RLS habilitado:
- `clientes`: Lectura pública, escritura restringida
- `productos`: Lectura pública, admin puede modificar
- `canjes`: Usuarios ven sus propios canjes, admins ven todos
- `historial_puntos`: Usuarios ven su propio historial
- `ticket_events`: Solo admins pueden ver

### Edge Functions

Todas las funciones webhook usan `--no-verify-jwt` para recibir llamadas de Notion.
Las funciones internas verifican autenticación via Supabase client.

### Variables de Entorno Requeridas

```
# Supabase (automáticas en Edge Functions)
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY

# Notion
NOTION_TOKEN

# Push Notifications
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
```

### Variables Frontend (.env)

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_VAPID_PUBLIC_KEY
```

---

## Mapeo de Estados Supabase ↔ Notion

| Supabase | Notion |
|----------|--------|
| pendiente_entrega | Pendiente Entrega |
| en_lista | En Proceso |
| agendado | En Proceso |
| entregado | Entregado |
| completado | Completado |

---

## Estructura de Proyecto

```
manny-rewards/
├── src/
│   ├── components/
│   │   ├── ui/                    # Primitivas (Button, Card, Dialog...)
│   │   ├── common/                # ErrorBoundary, SEOHelmet
│   │   ├── features/              # ServicesList, WhatsAppButton
│   │   └── layout/                # Header, Footer
│   ├── context/
│   │   ├── AuthContext.jsx        # Autenticación por teléfono
│   │   ├── SupabaseContext.jsx    # API principal
│   │   └── ThemeContext.jsx       # Tema claro/oscuro
│   ├── hooks/
│   │   ├── usePushNotifications.jsx
│   │   └── useProducts.js
│   ├── lib/
│   │   └── customSupabaseClient.js
│   └── pages/                     # Dashboard, Admin, Login...
├── public/
│   ├── icons/
│   │   ├── isotipo.svg            # Icono PWA
│   │   └── logo.svg               # Logo completo
│   └── sw-custom.js               # Service Worker push handlers
├── supabase/
│   └── functions/
│       ├── notion-contact-webhook/
│       ├── notion-ticket-completed/
│       ├── notion-canje-status-webhook/
│       ├── notion-cliente-sync/
│       ├── sync-canje-to-notion/
│       ├── update-canje-status-notion/
│       ├── update-cliente-nivel/
│       └── send-push-notification/
└── docs/
    ├── ARCHITECTURE.md            # Este archivo
    ├── MANNY_SYSTEM.md            # Documentación de negocio
    └── PLAN_MAESTRO_MANNY_REWARDS.md
```

---

## Notas de Implementación

1. **Sincronización bidireccional**:
   - Notion → Supabase: Via webhooks (notion-contact-webhook, notion-ticket-completed)
   - Supabase → Notion: Via llamadas explícitas (sync-canje-to-notion, update-*)

2. **Patrón fire-and-forget**: Las sincronizaciones a Notion no bloquean la respuesta al usuario

3. **Idempotencia**: Las funciones verifican `notion_page_id` para evitar duplicados

4. **Normalización de teléfonos**: Se eliminan prefijos 52 y 1, se validan 10 dígitos

---

**Última actualización**: Diciembre 2025
