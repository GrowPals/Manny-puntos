# Edge Functions de Supabase

Documentación de las Edge Functions desplegadas en Supabase para Manny Rewards.

## Índice

- [Visión General](#visión-general)
- [Módulo Compartido (_shared)](#módulo-compartido-_shared)
- [Webhooks de Notion](#webhooks-de-notion)
- [Funciones de Sincronización](#funciones-de-sincronización)
- [Funciones de Operaciones](#funciones-de-operaciones)
- [Notificaciones](#notificaciones)
- [Variables de Entorno](#variables-de-entorno)
- [Despliegue](#despliegue)

---

## Visión General

Las Edge Functions están escritas en TypeScript y corren en Deno 2. Se organizan en:

| Categoría | Funciones | JWT |
|-----------|-----------|-----|
| **Webhooks** | notion-contact-webhook, notion-ticket-completed, notion-canje-status-webhook | No |
| **Sincronización** | sync-cliente-to-notion, sync-canje-to-notion, update-canje-status-notion, notion-cliente-sync | Sí |
| **Operaciones** | create-reward-ticket, activate-beneficio, update-cliente-nivel, update-reward-points | Sí |
| **Batch** | sync-all-points, sync-all-rewards, process-sync-queue | Sí |
| **Notificaciones** | send-push-notification | Sí |

### Estructura de Directorios

```text
supabase/functions/
├── _shared/                      # Módulo compartido
│   ├── index.ts                  # Utilidades, CORS, Notion API, tipos
│   └── notion-estado-mapping.ts  # Mapeo de estados Supabase ↔ Notion
├── notion-contact-webhook/       # Webhook: nuevo contacto
├── notion-ticket-completed/      # Webhook: ticket pagado
├── notion-canje-status-webhook/  # Webhook: cambio estado canje
├── sync-cliente-to-notion/       # Sync: cliente → Notion
├── sync-canje-to-notion/         # Sync: canje → Notion
├── update-canje-status-notion/   # Sync: estado canje → Notion
├── notion-cliente-sync/          # Sync: Notion → cliente
├── create-reward-ticket/         # Op: crear ticket de recompensa
├── activate-beneficio/           # Op: activar beneficio guardado
├── update-cliente-nivel/         # Op: cambiar nivel cliente
├── update-reward-points/         # Op: actualizar puntos
├── sync-all-points/              # Batch: sincronizar puntos
├── sync-all-rewards/             # Batch: sincronizar rewards
├── process-sync-queue/           # Batch: procesar cola
└── send-push-notification/       # Notificaciones push
```

---

## Módulo Compartido (_shared)

El archivo `_shared/index.ts` exporta utilidades comunes:

### CORS

```typescript
handleCors(req)        // Maneja preflight OPTIONS
getCorsHeaders(origin) // Headers CORS para origen permitido
```

### Supabase

```typescript
createSupabaseAdmin()  // Cliente con service role key
```

### Notion API

```typescript
getNotionToken()                     // Token desde env
getNotionPage(pageId, token)         // GET página
queryNotionDatabase(dbId, filter, token, limit)
createNotionPage(dbId, properties, token)
updateNotionPage(pageId, properties, token)
notionRequest(endpoint, options)     // Request base
```

### Extractores de Propiedades

```typescript
extractTitle(properties)             // Campo title
extractPhoneNumber(properties)       // Teléfono normalizado
extractEmail(properties)             // Email
extractNumber(properties, field)     // Número
extractRelation(properties, field)   // Primera relación
extractRichText(properties, field)   // Texto rico
extractWebhookPage(payload, token)   // Página del webhook
```

### Webhooks

```typescript
handleNotionChallenge(payload, headers)  // Responde challenge de verificación
verifyWebhookSecret(req)                 // Verifica header X-Notion-Webhook-Secret
```

### Autenticación

```typescript
verifyAuth(req, supabase)  // Verifica x-cliente-id header
// Retorna: { success, clienteId?, isAdmin?, error?, statusCode? }
```

### Utilidades

```typescript
withRetry(fn, options)          // Retry con exponential backoff
safeParseJson(req, headers)     // Parse JSON seguro
```

### Respuestas

```typescript
errorResponse(message, headers, status)
successResponse(data, headers)
skippedResponse(reason, headers)
jsonResponse(data, headers)
```

### Constantes

```typescript
NOTION_DBS = {
  CONTACTOS: '17ac6cfd-8c1e-8068-8bc0-d32488189164',
  TICKETS: '17ac6cfd-8c1e-8162-b724-d4047a7e7635',
  MANNY_REWARDS: '2bfc6cfd-8c1e-8026-9291-e4bc8c18ee01'
}
```

---

## Webhooks de Notion

### notion-contact-webhook

**Trigger**: Notion Automation cuando se crea/actualiza un Contacto.

**Flujo**:

1. Verifica webhook secret
2. Extrae teléfono, nombre, email del contacto
3. Verifica idempotencia (debounce 5 minutos)
4. Busca o crea cliente en Supabase
5. Busca o crea Manny Reward en Notion
6. Registra evento en `ticket_events`

**Entrada** (Webhook Payload):

```json
{
  "type": "page_updated",
  "data": { "id": "notion-page-id" }
}
```

**Salida**:

```json
{
  "status": "created|linked|exists",
  "cliente_id": "uuid",
  "nombre": "string",
  "telefono": "string",
  "manny_reward_id": "notion-page-id"
}
```

---

### notion-ticket-completed

**Trigger**: Notion Automation cuando un Ticket se marca como "Pagado".

**Flujo**:

1. Verifica webhook secret
2. Extrae ticket: nombre, monto, contacto, es_manny_reward
3. Verifica idempotencia (ticket_events)
4. Busca o crea Manny Reward con lock
5. Calcula puntos (5% del monto)
6. Actualiza puntos en Notion
7. Busca o crea cliente en Supabase
8. Asigna puntos via RPC (si no es Manny Reward)
9. Envía push notification
10. Si es Manny Reward: marca beneficio/canje como usado

**Lógica de Puntos**:

- Si `es_manny_reward = false`: Cliente gana 5% del monto como puntos
- Si `es_manny_reward = true`: No acumula puntos (es uso de recompensa)

---

### notion-canje-status-webhook

**Trigger**: Notion Automation cuando cambia el estado de un canje en Manny Rewards DB.

**Flujo**:

1. Verifica webhook secret
2. Extrae estado actual del canje
3. Mapea estado Notion → Supabase
4. Actualiza estado en tabla `canjes`
5. Notifica al cliente si aplica

---

## Funciones de Sincronización

### sync-cliente-to-notion

**Trigger**: Llamada desde frontend al crear/actualizar cliente.

**Flujo**:

1. Verifica autenticación (x-cliente-id)
2. Obtiene cliente de Supabase
3. Busca Contacto existente en Notion por teléfono
4. Crea o actualiza Contacto
5. Busca o crea Manny Reward
6. Actualiza `notion_page_id` en cliente

---

### sync-canje-to-notion

**Trigger**: Llamada después de registrar un canje.

**Payload**:

```json
{
  "canje_id": "uuid",
  "cliente_id": "uuid",
  "producto_nombre": "string",
  "puntos_usados": 100
}
```

**Flujo**:

1. Obtiene datos del canje y cliente
2. Busca Manny Reward del cliente
3. Crea entrada en Manny Rewards DB tipo "Canje"
4. Actualiza `notion_page_id` en canje

---

### update-canje-status-notion

**Trigger**: Llamada al cambiar estado de canje desde admin.

**Payload**:

```json
{
  "canje_id": "uuid",
  "nuevo_estado": "pendiente_entrega|en_lista|entregado|completado"
}
```

**Mapeo de Estados**:

| Supabase | Notion |
|----------|--------|
| pendiente_entrega | Pendiente Entrega |
| en_lista | En Proceso |
| agendado | En Proceso |
| entregado | Entregado |
| completado | Completado |

---

### notion-cliente-sync

**Trigger**: Webhook cuando se actualizan datos del cliente en Notion.

**Flujo**:

1. Detecta cambios en nivel o puntos
2. Actualiza cliente en Supabase
3. Registra en historial si cambiaron puntos

---

## Funciones de Operaciones

### create-reward-ticket

**Trigger**: Llamada al crear canje o reclamar beneficio.

**Payload**:

```json
{
  "tipo": "canje|beneficio",
  "id": "uuid"
}
```

**Flujo**:

1. Obtiene datos del canje/beneficio
2. Crea ticket en Notion Tickets DB
3. Asocia ticket al canje/beneficio
4. Estado inicial: "Guardado"

---

### activate-beneficio

**Trigger**: Llamada cuando cliente quiere usar beneficio.

**Payload**:

```json
{
  "tipo": "beneficio",
  "id": "uuid"
}
```

**Flujo**:

1. Verifica autenticación y ownership
2. Verifica que beneficio esté "activo"
3. Actualiza ticket en Notion: "Guardado" → "Ticket"
4. El ticket entrará al flujo normal de trabajo

**Nota**: Los canjes de productos entran directo al flujo, no usan esta función.

---

### update-cliente-nivel

**Trigger**: Llamada desde admin al cambiar nivel.

**Payload**:

```json
{
  "cliente_id": "uuid",
  "nuevo_nivel": "partner|vip"
}
```

**Flujo**:

1. Actualiza nivel en Supabase
2. Crea entrada en Manny Rewards DB: "Cambio de nivel"
3. Actualiza nivel en Manny Reward
4. Dispara notificación push

---

### update-reward-points

**Trigger**: Llamada para sincronizar puntos manualmente.

**Flujo**:

1. Obtiene cliente por ID o teléfono
2. Actualiza puntos en Manny Reward de Notion
3. Retorna nuevo saldo

---

## Notificaciones

### send-push-notification

**Trigger**: Llamada interna desde otras funciones o frontend.

**Autenticación**:

- Requiere header `x-cliente-id`
- Usuarios solo pueden enviarse a sí mismos
- Admins pueden enviar a cualquiera o a todos los admins

**Payload**:

```json
{
  "tipo": "puntos_recibidos",
  "cliente_id": "uuid",           // Para un cliente específico
  "to_admins": false,             // O true para todos los admins
  "data": { "puntos": 100 },      // Variables para el template
  "url": "/dashboard"             // URL al hacer clic
}
```

**Tipos Disponibles**:

| Tipo | Destino | Template |
|------|---------|----------|
| `bienvenida` | Cliente | ¡Bienvenido a Manny Rewards! |
| `puntos_recibidos` | Cliente | ¡Ganaste {puntos} puntos! |
| `canje_listo` | Cliente | ¡Tu {producto} está listo! |
| `canje_completado` | Cliente | Canje entregado |
| `beneficio_reclamado` | Cliente | ¡Beneficio activado! |
| `beneficio_usado` | Cliente | Beneficio utilizado |
| `nivel_cambiado` | Cliente | ¡Subiste a nivel {nivel}! |
| `referido_activado` | Cliente | ¡Tu referido fue activado! |
| `nuevo_canje` | Admins | Nuevo canje: {producto} |
| `nuevo_beneficio` | Admins | Nuevo beneficio reclamado |
| `resumen_diario` | Admins | Resumen del día |

**Flujo**:

1. Valida autenticación y permisos
2. Obtiene template según tipo
3. Reemplaza placeholders con data
4. Busca suscripciones push del destino
5. Envía via Web Push API (VAPID)
6. Registra en `notification_history`
7. Elimina suscripciones inválidas

---

## Variables de Entorno

Configuradas en Supabase Dashboard → Edge Functions → Secrets:

```env
# Automáticas (no configurar)
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY

# Notion
NOTION_TOKEN=secret_xxx

# Push Notifications
VAPID_PUBLIC_KEY=BKxxx...
VAPID_PRIVATE_KEY=xxx...

# Webhook (opcional, para verificación)
NOTION_WEBHOOK_SECRET=xxx
```

---

## Despliegue

### Deploy Individual

```bash
supabase functions deploy notion-contact-webhook --no-verify-jwt
supabase functions deploy send-push-notification
```

### Deploy Todas

```bash
supabase functions deploy
```

### Verificar Logs

```bash
supabase functions logs notion-ticket-completed --tail
```

### Configuración JWT

En `supabase/config.toml`:

```toml
[functions.notion-contact-webhook]
verify_jwt = false

[functions.notion-ticket-completed]
verify_jwt = false

[functions.notion-canje-status-webhook]
verify_jwt = false
```

Las demás funciones requieren JWT o autenticación via header `x-cliente-id`.

---

## Patrones de Código

### Idempotencia

```typescript
// Prevenir procesamiento duplicado
const { data: existingEvent } = await supabase
  .from('ticket_events')
  .select('id')
  .eq('source_id', ticketId)
  .single();

if (existingEvent) {
  return skippedResponse('already processed', corsHeaders);
}
```

### Locking para Race Conditions

```typescript
// Adquirir lock
const { error: lockError } = await supabase
  .from('ticket_events')
  .insert({
    source: 'lock',
    source_id: `reward_creation_${contactoId}`,
    event_type: 'reward_creation_lock'
  });

if (lockError?.code === '23505') {
  // Lock existe, esperar y reintentar
  await new Promise(r => setTimeout(r, 2000));
}

try {
  // Operación crítica
} finally {
  // Liberar lock
  await supabase.from('ticket_events').delete().eq('source_id', lockKey);
}
```

### Fire and Forget con Fallback

```typescript
// Operación secundaria que no debe bloquear
withRetry(async () => {
  await updateNotionPage(pageId, data, token);
}, { maxAttempts: 2 }).catch(async (e) => {
  // Si falla, encolar para retry posterior
  await supabase.from('sync_queue').insert({
    operation: 'update_notion',
    entity_id: pageId,
    payload: data,
    status: 'pending'
  });
});
```

---

**Última actualización**: Diciembre 2025
