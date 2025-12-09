# Manny Rewards - Arquitectura Técnica

Sistema de lealtad y recompensas con sincronización bidireccional entre Supabase y Notion.

**Última actualización**: Diciembre 2025

---

## Visión General

```text
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND                                   │
│                     React 18 + Vite (PWA)                           │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  AuthContext (PIN-based auth)  │  ThemeContext  │  QueryClient │ │
│  ├────────────────────────────────────────────────────────────────┤ │
│  │                        React Router v6                          │ │
│  │  Dashboard │ Admin/* │ Login │ /r/:codigo │ /g/:codigo         │ │
│  ├────────────────────────────────────────────────────────────────┤ │
│  │                     Services Layer (API)                        │ │
│  │  auth │ clients │ products │ redemptions │ gifts │ referrals   │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           SUPABASE                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │   PostgreSQL    │  │ Edge Functions  │  │      Storage        │ │
│  │    (Tables)     │  │    (Deno 2)     │  │  (Images/Banners)   │ │
│  │                 │  │                 │  │                     │ │
│  │  clientes       │  │  webhooks       │  │  productos/         │ │
│  │  productos      │  │  sync-*         │  │  regalos/banners/   │ │
│  │  canjes         │  │  notifications  │  │                     │ │
│  │  beneficios     │  │  operations     │  │                     │ │
│  │  referidos      │  │                 │  │                     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────┘ │
│            │                   │                                     │
│            │     RPC Functions │                                     │
│            │  (asignar_puntos, registrar_canje, etc.)               │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            NOTION                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │   Contactos     │  │    Tickets      │  │   Manny Rewards     │ │
│  │   (Clientes)    │  │   (Servicios)   │  │  (Canjes/Puntos)    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────┘ │
│            │                   │                    │                │
│            └───────────────────┴────────────────────┘                │
│                      Notion Automations (Webhooks)                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Stack Tecnológico

| Componente | Tecnología | Versión |
|------------|------------|---------|
| **Frontend** | React | 18.2 |
| **Bundler** | Vite | 6.4 |
| **Estilos** | Tailwind CSS | 3.4 |
| **UI** | Radix UI + Lucide Icons | - |
| **Animaciones** | Framer Motion | 10.18 |
| **Estado Servidor** | TanStack Query | 5.90 |
| **Estado Local** | React Context | - |
| **Backend** | Supabase | 2.30 |
| **Edge Functions** | Deno | 2.x |
| **Base de Datos** | PostgreSQL | 17 |
| **CRM** | Notion API | 2022-06-28 |
| **Deploy Frontend** | Vercel | - |

---

## Base de Datos

### Tablas Principales

| Tabla | Descripción |
|-------|-------------|
| `clientes` | Datos de clientes, puntos, nivel, PIN hasheado |
| `productos` | Catálogo de productos/servicios canjeables |
| `canjes` | Registro de canjes realizados |
| `historial_puntos` | Movimientos de puntos (créditos/débitos) |
| `servicios_asignados` | Beneficios precargados para Partners/VIP |
| `historial_servicios` | Trabajos realizados por Manny |
| `links_regalo` | Links de regalo y campañas |
| `beneficios_cliente` | Beneficios canjeados de links |
| `codigos_referido` | Códigos de referido por cliente |
| `referidos` | Relaciones referidor-referido |
| `config_referidos` | Configuración del programa |
| `push_subscriptions` | Suscripciones Web Push |
| `notification_history` | Historial de notificaciones |
| `ticket_events` | Eventos de webhooks (idempotencia) |
| `sync_queue` | Cola de sincronización |

### Esquemas Principales

#### clientes

```sql
id                UUID PRIMARY KEY
nombre            TEXT NOT NULL
telefono          TEXT UNIQUE NOT NULL
puntos_actuales   INTEGER DEFAULT 0
nivel             TEXT DEFAULT 'partner'  -- 'partner' | 'vip'
es_admin          BOOLEAN DEFAULT false
pin_hash          TEXT                    -- bcrypt hash
notion_page_id    TEXT                    -- Link a Notion Contacto
notion_reward_id  TEXT                    -- Link a Notion Manny Reward
last_sync_at      TIMESTAMP
created_at        TIMESTAMP DEFAULT now()
```

#### canjes

```sql
id                    UUID PRIMARY KEY
cliente_id            UUID REFERENCES clientes
producto_id           UUID REFERENCES productos
puntos_usados         INTEGER NOT NULL
estado                TEXT DEFAULT 'pendiente_entrega'
tipo_producto_original TEXT              -- Backup si se elimina producto
fecha_entrega         TIMESTAMP
notion_page_id        TEXT
notion_ticket_id      TEXT
created_at            TIMESTAMP DEFAULT now()
```

#### links_regalo

```sql
id                    UUID PRIMARY KEY
codigo                TEXT UNIQUE NOT NULL
tipo                  TEXT NOT NULL        -- 'servicio' | 'puntos'
creado_por            UUID REFERENCES clientes
nombre_beneficio      TEXT
descripcion_beneficio TEXT
puntos_regalo         INTEGER
mensaje_personalizado TEXT
destinatario_telefono TEXT
imagen_banner         TEXT
color_tema            TEXT DEFAULT '#E91E63'
estado                TEXT DEFAULT 'pendiente'
fecha_expiracion      TIMESTAMP
es_campana            BOOLEAN DEFAULT false
nombre_campana        TEXT
max_canjes            INTEGER
canjes_realizados     INTEGER DEFAULT 0
veces_visto           INTEGER DEFAULT 0
terminos_condiciones  TEXT
instrucciones_uso     TEXT
vigencia_beneficio    INTEGER DEFAULT 365
created_at            TIMESTAMP DEFAULT now()
```

### Funciones RPC Críticas

#### asignar_puntos_atomico

```sql
asignar_puntos_atomico(
  p_cliente_telefono TEXT,
  p_puntos_a_sumar INTEGER,
  p_concepto TEXT
) RETURNS JSON
```

- Operación atómica para asignar puntos
- Crea registro en `historial_puntos`
- Retorna `{ cliente_id, nuevo_saldo }`

#### registrar_canje_atomico

```sql
registrar_canje_atomico(
  p_cliente_id UUID,
  p_producto_id UUID
) RETURNS JSON
```

- Verifica puntos suficientes
- Verifica stock disponible
- Resta puntos y crea canje atómicamente
- Retorna `{ canjeId, nuevoSaldo }`

#### verify_client_pin_secure

```sql
verify_client_pin_secure(
  telefono_input TEXT,
  pin_input TEXT
) RETURNS JSON
```

- Verificación de PIN con rate limiting
- 5 intentos máximo, bloqueo 5 minutos
- Retorna `{ success, cliente?, error?, rate_limited? }`

#### canjear_link_regalo

```sql
canjear_link_regalo(
  p_codigo TEXT,
  p_telefono TEXT
) RETURNS JSON
```

- Canjeo de regalo con locking
- Previene race conditions en campañas
- Crea cliente si no existe

---

## Flujos de Datos

### 1. Registro de Puntos (Notion → Supabase)

```text
[Notion: Ticket marcado "Pagado"]
         │
         ▼ (Webhook)
[notion-ticket-completed]
         │
         ├── Verifica idempotencia
         ├── Busca/crea Manny Reward
         ├── Calcula puntos (5% del monto)
         │
         ▼
[asignar_puntos_atomico RPC]
         │
         ├── Actualiza clientes.puntos_actuales
         ├── Crea historial_puntos
         │
         ▼
[send-push-notification]
         │
         └── Notifica al cliente
```

### 2. Canje de Producto (App → Notion)

```text
[Cliente solicita canje]
         │
         ▼
[registrar_canje_atomico RPC]
         │
         ├── Verifica puntos y stock
         ├── Crea registro en canjes
         ├── Resta puntos
         │
         ▼
[sync-canje-to-notion]
         │
         ├── Crea entrada en Manny Rewards DB
         └── Enlaza ticket al canje
         │
         ▼
[Notificaciones]
         │
         ├── Push al cliente
         └── Push a admins
```

### 3. Canje de Regalo (Landing → App)

```text
[Usuario visita /g/:codigo]
         │
         ▼
[getGiftByCode]
         │
         ├── Incrementa vistas
         ├── Verifica expiración/límites
         │
         ▼
[Usuario ingresa teléfono]
         │
         ▼
[canjear_link_regalo_v3 RPC]
         │
         ├── Verifica elegibilidad
         ├── Crea cliente si no existe
         ├── Crea beneficio_cliente
         ├── Incrementa canjes_realizados
         │
         ▼
[create-reward-ticket] (si tipo=servicio)
         │
         └── Crea ticket en Notion estado "Guardado"
```

### 4. Programa de Referidos

```text
[Referidor comparte código]
         │
         ▼
[Referido llega a /r/:codigo]
         │
         └── Código guardado en localStorage
         │
         ▼
[Referido hace onboarding]
         │
         ▼
[aplicar_codigo_referido_v2 RPC]
         │
         ├── Crea relación en referidos
         ├── Estado: pendiente
         │
         ▼
[Referido paga primer servicio]
         │
         ▼
[Notion Automation activa referido]
         │
         ├── Cambia estado: activo
         ├── Asigna puntos a referidor
         └── Asigna puntos a referido
```

---

## Autenticación

### Flujo de Login

```text
[Cliente ingresa teléfono]
         │
         ▼
[checkClienteExists RPC]
         │
         ├── exists: false → Error "No registrado"
         │
         ├── has_pin: false → Flujo Onboarding
         │   └── [registerPin → crear PIN]
         │
         └── has_pin: true → Solicitar PIN
             │
             ▼
         [verify_client_pin_secure RPC]
             │
             ├── success: false + rate_limited → Esperar 5 min
             ├── success: false → Error "PIN incorrecto"
             └── success: true → Login exitoso
                 │
                 ▼
             [Guardar en localStorage + contexto]
```

### Seguridad

- **PIN**: 4 dígitos, hasheado con bcrypt
- **Rate Limiting**: 5 intentos, bloqueo 5 minutos
- **RLS**: Clientes solo ven sus propios datos
- **Edge Functions**: Verifican `x-cliente-id` header
- **Webhooks**: Verifican `X-Notion-Webhook-Secret`

---

## Integración con Notion

### Bases de Datos

| BD | ID | Propósito |
|----|-------|-----------|
| Contactos | `17ac6cfd-8c1e-8068-8bc0-d32488189164` | Clientes, datos de contacto |
| Tickets | `17ac6cfd-8c1e-8162-b724-d4047a7e7635` | Servicios realizados |
| Manny Rewards | `2bfc6cfd-8c1e-8026-9291-e4bc8c18ee01` | Canjes, puntos, beneficios |

### Sincronización

| Dirección | Trigger | Función |
|-----------|---------|---------|
| Notion → Supabase | Webhook nuevo contacto | notion-contact-webhook |
| Notion → Supabase | Webhook ticket pagado | notion-ticket-completed |
| Notion → Supabase | Webhook cambio estado | notion-canje-status-webhook |
| Supabase → Notion | Canje creado | sync-canje-to-notion |
| Supabase → Notion | Estado cambiado | update-canje-status-notion |
| Supabase → Notion | Nivel cambiado | update-cliente-nivel |

### Mapeo de Estados

| Supabase | Notion |
|----------|--------|
| pendiente_entrega | Pendiente Entrega |
| en_lista | En Proceso |
| agendado | En Proceso |
| entregado | Entregado |
| completado | Completado |

---

## Frontend

### Estructura de Rutas

| Ruta | Componente | Acceso |
|------|------------|--------|
| `/` | Login | Público |
| `/dashboard` | Dashboard | Cliente |
| `/mis-canjes` | MisCanjes | Cliente |
| `/mis-servicios` | MisServicios | Cliente |
| `/mis-referidos` | MisReferidos | Cliente |
| `/confirmar-canje/:id` | ConfirmarCanje | Cliente |
| `/r/:codigo` | ReferralLanding | Público |
| `/g/:codigo`, `/gift/:codigo` | GiftLanding | Público |
| `/admin` | Admin | Admin |
| `/admin/clientes` | AdminClientes | Admin |
| `/admin/clientes/:id` | AdminClienteDetalle | Admin |
| `/admin/productos` | AdminProductos | Admin |
| `/admin/entregas` | AdminEntregas | Admin |
| `/admin/referidos` | AdminReferidos | Admin |
| `/admin/regalos` | AdminRegalos | Admin |
| `/admin/gestion` | AdminGestion | Admin |
| `/admin/recordatorios` | AdminRecordatorios | Admin |

### Contextos

- **AuthContext**: Usuario actual, login/logout, onboarding, pending referral
- **ThemeContext**: Tema claro/oscuro, persistido en localStorage

### Hooks Personalizados

| Hook | Propósito |
|------|-----------|
| `useProducts` | Productos con React Query |
| `useNetworkStatus` | Detectar conexión |
| `useOfflineData` | Datos en IndexedDB |
| `usePushNotifications` | Gestión de push |
| `useWhatsAppShare` | Compartir por WhatsApp |

---

## PWA

### Configuración

- **Manifest**: `public/manifest.json`
- **Service Worker**: Generado por Vite PWA Plugin
- **Cache Strategy**: NetworkFirst para API, CacheFirst para assets

### Características

- Instalable en móviles
- Funciona offline (datos en IndexedDB)
- Push notifications
- Icono y splash screen personalizados

---

## Variables de Entorno

### Frontend (.env)

```text
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
VITE_VAPID_PUBLIC_KEY=xxx
```

### Supabase Edge Functions (Dashboard)

```text
SUPABASE_URL=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
NOTION_TOKEN=xxx
NOTION_MANNY_REWARDS_DB=xxx
NOTION_CONTACTOS_DB=xxx
NOTION_TICKETS_DB=xxx
VAPID_PUBLIC_KEY=xxx
VAPID_PRIVATE_KEY=xxx
```

---

## Patrones de Código

### Retry con Backoff

```javascript
const data = await withRetry(
  async () => supabase.rpc('operacion_critica', params),
  {
    maxAttempts: 3,
    shouldRetry: (error) => !error.isBusinessError
  }
);
```

### Fire and Forget

```javascript
// No bloquea la respuesta
notifyClientePuntosRecibidos(clienteId, puntos, concepto);
```

### Idempotencia en Webhooks

```typescript
const { data: existingEvent } = await supabase
  .from('ticket_events')
  .select('id')
  .eq('source_id', ticketId)
  .single();

if (existingEvent) {
  return skippedResponse('already processed', headers);
}
```

### Locking para Race Conditions

```typescript
const { error: lockError } = await supabase
  .from('ticket_events')
  .insert({ source: 'lock', source_id: lockKey });

if (lockError?.code === '23505') {
  // Lock existe, esperar
  await new Promise(r => setTimeout(r, 2000));
}
```

---

## Documentación Relacionada

- [API_SERVICES.md](API_SERVICES.md) - Documentación de servicios frontend
- [EDGE_FUNCTIONS.md](EDGE_FUNCTIONS.md) - Edge Functions de Supabase

---

## Notas de Implementación

1. **Sincronización bidireccional**: Notion ↔ Supabase via webhooks y llamadas explícitas
2. **Patrón fire-and-forget**: Sincronizaciones a Notion no bloquean respuesta
3. **Idempotencia**: Webhooks usan `ticket_events` para prevenir duplicados
4. **Cola de Reintentos**: Fallos de Notion se encolan en `sync_queue`
5. **Normalización**: Teléfonos siempre 10 dígitos sin prefijo
6. **Transacciones**: Operaciones críticas usan RPCs atómicos
