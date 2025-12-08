# Documentación de Servicios API

La capa de datos de Manny Rewards está modularizada en `src/services/api/`. Cada módulo es responsable de un dominio específico y se comunica con Supabase.

## Índice

- [Estructura](#estructura)
- [Módulo auth.js](#módulo-authjs)
- [Módulo clients.js](#módulo-clientsjs)
- [Módulo products.js](#módulo-productsjs)
- [Módulo redemptions.js](#módulo-redemptionsjs)
- [Módulo services.js](#módulo-servicesjs)
- [Módulo referrals.js](#módulo-referralsjs)
- [Módulo gifts.js](#módulo-giftsjs)
- [Módulo notifications.js](#módulo-notificationsjs)
- [Módulo admin.js](#módulo-adminjs)
- [Manejo de Errores](#manejo-de-errores)
- [Patrones Comunes](#patrones-comunes)

## Estructura

```text
src/services/api/
├── index.js          # Agregador de todos los módulos
├── auth.js           # Autenticación y verificación de PIN
├── clients.js        # Gestión de clientes y puntos
├── products.js       # Catálogo de productos
├── redemptions.js    # Procesamiento de canjes
├── services.js       # Servicios asignados y historial
├── referrals.js      # Programa de referidos
├── gifts.js          # Links de regalo y campañas
├── notifications.js  # Push notifications
├── admin.js          # Funciones administrativas
├── sync.js           # Cola de sincronización
└── config.js         # Configuración global desde BD
```

---

## Módulo auth.js

Maneja la autenticación basada en PIN.

### Funciones

#### `checkClienteExists(telefono)`

Verifica si un cliente existe y si tiene PIN registrado.

- **Parámetros**: `telefono` (string) - Teléfono de 10 dígitos
- **Retorna**: `{ exists: boolean, has_pin: boolean, cliente?: object }`
- **Errores**: `AUTH.INVALID_PHONE_FORMAT`, `AUTH.CONNECTION_ERROR`

#### `loginWithPin(telefono, pin)`

Autentica al usuario verificando el PIN via RPC seguro.

- **Parámetros**:
  - `telefono` (string) - Teléfono de 10 dígitos
  - `pin` (string) - PIN de 4 dígitos
- **Retorna**: Objeto cliente completo
- **Errores**: `AUTH.CONNECTION_ERROR`, `AUTH.INVALID_CREDENTIALS`, rate limiting

#### `loginFirstTime(telefono)`

Login sin PIN para usuarios nuevos (flujo de onboarding).

- **Parámetros**: `telefono` (string)
- **Retorna**: Cliente con `needsOnboarding: true`
- **Errores**: `AUTH.CLIENT_NOT_FOUND`

#### `registerPin(telefono, newPin)`

Registra un nuevo PIN para el cliente (onboarding).

- **Parámetros**:
  - `telefono` (string)
  - `newPin` (string) - PIN de 4 dígitos
- **Retorna**: Cliente actualizado
- **Errores**: `AUTH.CONNECTION_ERROR`

#### `resetClientPin(clienteId)`

Resetea el PIN de un cliente (solo admin).

- **Parámetros**: `clienteId` (UUID)
- **Retorna**: `true` si exitoso
- **Errores**: Error genérico

---

## Módulo clients.js

Gestión de clientes, puntos y sincronización.

### Funciones

#### `getTodosLosClientes({ limit, offset })`

Obtiene lista paginada de clientes.

- **Parámetros**: `{ limit: 100, offset: 0 }` (opcionales)
- **Retorna**: `{ data: Cliente[], count: number, hasMore: boolean }`

#### `crearOActualizarCliente(clienteData)`

Crea o actualiza un cliente (upsert por teléfono).

- **Parámetros**: Objeto con `nombre`, `telefono`, `puntos_actuales`, etc.
- **Retorna**: Cliente creado/actualizado
- **Errores**: `CLIENTS.NAME_REQUIRED`, `CLIENTS.PHONE_REQUIRED`, `CLIENTS.PHONE_EXISTS`

#### `asignarPuntosManualmente(clienteTelefono, puntos, concepto)`

Asigna puntos a un cliente via RPC atómico.

- **Parámetros**:
  - `clienteTelefono` (string)
  - `puntos` (number) - Puede ser negativo
  - `concepto` (string) - Descripción del movimiento
- **Retorna**: `{ cliente_id, nuevo_saldo }`
- **Side effects**: Notifica al cliente si puntos > 0

#### `getClienteHistorial(telefono)`

Obtiene historial de canjes y puntos de un cliente.

- **Parámetros**: `telefono` (string)
- **Retorna**: `{ canjes: [], historialPuntos: [] }`

#### `getClienteDetalleAdmin(clienteId)`

Obtiene detalle completo de un cliente (admin).

- **Parámetros**: `clienteId` (UUID)
- **Retorna**:

```javascript
{
  cliente: {},
  canjes: [],
  historialPuntos: [],
  serviciosAsignados: [],
  historialServicios: [],
  stats: {
    total_servicios,
    total_invertido,
    total_puntos_generados,
    total_canjes,
    puntos_canjeados,
    ultimo_servicio,
    primer_servicio
  }
}
```

#### `cambiarNivelCliente(clienteId, nuevoNivel)`

Cambia el nivel de un cliente (partner/vip).

- **Parámetros**:
  - `clienteId` (UUID)
  - `nuevoNivel` ('partner' | 'vip')
- **Side effects**: Sincroniza con Notion, notifica al cliente

#### `cambiarRolAdmin(clienteId, esAdmin, changedById)`

Otorga o revoca permisos de admin.

- **Parámetros**:
  - `clienteId` (UUID)
  - `esAdmin` (boolean)
  - `changedById` (UUID) - Admin que hace el cambio
- **Side effects**: Registra en `admin_role_logs`

#### `syncToNotion(clienteId)`

Sincroniza cliente a Notion (con fallback a cola).

- **Parámetros**: `clienteId` (UUID)
- **Retorna**: `{ status: 'success' | 'queued' }`

---

## Módulo products.js

Gestión del catálogo de productos canjeables.

### Funciones

#### `getProductosCanje()`

Obtiene productos activos ordenados por puntos.

- **Retorna**: Array de productos activos

#### `getAllProductosAdmin({ limit, offset })`

Obtiene todos los productos (activos e inactivos).

- **Retorna**: `{ data: [], count, hasMore }`

#### `getProductoById(id)`

Obtiene un producto por ID.

- **Parámetros**: `id` (UUID)
- **Retorna**: Producto o `null`

#### `crearOActualizarProducto(productoData)`

Crea o actualiza un producto.

- **Parámetros**: Objeto con `nombre`, `puntos_requeridos`, `tipo`, `stock`, etc.
- **Errores**: `PRODUCTS.NAME_REQUIRED`, `PRODUCTS.POINTS_INVALID`

#### `eliminarProducto(productoId)`

Elimina un producto.

- **Parámetros**: `productoId` (UUID)

#### `subirImagenProducto(file)`

Sube imagen de producto a Supabase Storage.

- **Parámetros**: `file` (File)
- **Retorna**: URL pública de la imagen

---

## Módulo redemptions.js

Procesamiento de canjes de puntos por productos.

### Funciones

#### `getTodosLosCanjes({ limit, offset })`

Obtiene todos los canjes con datos de cliente y producto.

- **Retorna**: `{ data: [], count, hasMore }`

#### `getCanjesPendientes({ limit, offset })`

Obtiene canjes pendientes de entrega.

- **Retorna**: Canjes con estado `pendiente_entrega` o `en_lista`

#### `actualizarEstadoCanje(canjeId, nuevoEstado)`

Actualiza el estado de un canje.

- **Parámetros**:
  - `canjeId` (UUID)
  - `nuevoEstado` ('pendiente_entrega' | 'en_lista' | 'entregado' | 'completado')
- **Side effects**:
  - Notifica al cliente según el nuevo estado
  - Sincroniza con Notion

#### `registrarCanje({ cliente_id, producto_id, cliente_nombre, producto_nombre, puntos_producto })`

Registra un nuevo canje via RPC atómico.

- **Parámetros**: Objeto con IDs y datos para notificaciones
- **Retorna**: `{ nuevoSaldo, canje: { id }, mensaje }`
- **Side effects**:
  - Notifica al cliente
  - Notifica a admins
  - Crea ticket en Notion
- **Errores**: `REDEMPTIONS.INSUFFICIENT_POINTS`, `REDEMPTIONS.OUT_OF_STOCK`

---

## Módulo services.js

Servicios asignados (Partners/VIP) e historial.

### Funciones

#### `getServiciosCliente(clienteId)`

Obtiene servicios asignados a un cliente.

- **Retorna**: Array de servicios

#### `canjearServicioAsignado(servicioId)`

Marca un servicio como canjeado.

- **Parámetros**: `servicioId` (UUID)

#### `crearServicioAsignado(servicioData)`

Crea un nuevo servicio asignado.

- **Parámetros**: `{ cliente_id, nombre, descripcion }`

#### `eliminarServicioAsignado(servicioId)`

Elimina un servicio asignado.

#### `getHistorialServicios(clienteId)`

Obtiene historial de servicios realizados.

#### `getHistorialServiciosStats(clienteId)`

Obtiene estadísticas del historial.

- **Retorna**: `{ total_servicios, total_invertido, total_puntos }`

---

## Módulo referrals.js

Programa de referidos.

### Funciones Cliente

#### `getOrCreateReferralCode(clienteId)`

Obtiene o crea código de referido único.

- **Retorna**: `{ codigo: string }`

#### `getReferralStats(clienteId)`

Obtiene estadísticas de referidos del cliente.

- **Retorna**:

```javascript
{
  codigo,
  referidos_activos,
  referidos_pendientes,
  puntos_ganados,
  puntos_este_mes,
  limite_mensual,
  limite_total
}
```

#### `getMisReferidos(clienteId, { limit, offset })`

Obtiene lista de referidos del cliente.

#### `validateReferralCode(codigo)`

Valida un código de referido.

- **Retorna**: `{ valid: boolean, data: object | null, reason: string | null }`
- **Reasons**: `'not_found'`, `'inactive'`

#### `applyReferralCode(referidoId, codigo)`

Aplica código de referido a un cliente nuevo.

- **Side effects**: Asigna puntos a ambos (referidor y referido)

### Funciones Admin

#### `getAdminReferralStats()`

Estadísticas globales del programa.

#### `getAllReferidos({ limit, offset })`

Todos los referidos del sistema.

#### `getAdminReferralConfig()` / `updateReferralConfig(config)`

Gestión de configuración del programa.

---

## Módulo gifts.js

Links de regalo y campañas.

### Funciones Públicas

#### `getGiftByCode(codigo)`

Obtiene información de un regalo por código.

- **Side effects**: Incrementa contador de vistas
- **Retorna**: Objeto regalo con estado actualizado (expirado/agotado si aplica)

#### `claimGift(codigo, telefono)`

Canjea un link de regalo.

- **Parámetros**:
  - `codigo` (string)
  - `telefono` (string) - Del cliente que canjea
- **Retorna**: `{ success, cliente_id, nombre_beneficio, ... }`
- **Side effects**: Notificaciones a cliente y admins

#### `getMisBeneficios(clienteId)`

Obtiene beneficios activos del cliente.

### Funciones Admin

#### `createGiftLink(options)`

Crea un nuevo link de regalo o campaña.

- **Parámetros**:

```javascript
{
  tipo: 'servicio' | 'puntos',
  creado_por,
  nombre_beneficio,
  descripcion_beneficio,
  puntos_regalo,
  mensaje_personalizado,
  destinatario_telefono,
  dias_expiracion,
  es_campana,
  nombre_campana,
  max_canjes,
  terminos_condiciones,
  instrucciones_uso,
  vigencia_beneficio,
  imagen_banner,
  color_tema
}
```

- **Retorna**: `{ success, codigo, id, url }`

#### `getAllGiftLinks()`

Todos los links de regalo.

#### `getGiftStats()`

Estadísticas de regalos y campañas.

#### `getLinkBeneficiarios(linkId)`

Beneficiarios de un link específico.

#### `marcarBeneficioUsado(beneficioId, adminId, notas)`

Marca un beneficio como usado.

#### `expireGiftLink(linkId)` / `deleteGiftLink(linkId)`

Gestión de links.

#### `activarRecompensa(tipo, id, clienteId)`

Activa un beneficio/canje guardado (crea ticket en Notion).

---

## Módulo notifications.js

Push notifications centralizadas.

### Funciones Base

#### `sendPushToClient(tipo, clienteId, data, url)`

Envía push a un cliente específico.

#### `sendPushToAdmins(tipo, data, url)`

Envía push a todos los admins.

### Triggers (Fire and Forget)

Funciones que disparan notificaciones sin bloquear:

- `notifyClienteCanjeRegistrado(clienteId, productoNombre, puntosUsados)`
- `notifyAdminsNuevoCanje(clienteNombre, productoNombre, puntosUsados)`
- `notifyClienteCanjeListoParaRecoger(clienteId, productoNombre)`
- `notifyClienteCanjeEntregado(clienteId)`
- `notifyClientePuntosRecibidos(clienteId, puntos, concepto, saldoActual)`
- `notifyClienteBeneficioReclamado(clienteId, nombreBeneficio)`
- `notifyAdminsNuevoBeneficio(clienteNombre, beneficioNombre)`
- `notifyClienteNivelCambiado(clienteId, nuevoNivel)`
- `notifyClienteBeneficioUsado(clienteId)`

---

## Módulo admin.js

Funciones administrativas.

### Funciones

#### `exportMannyData()`

Exporta todos los datos a JSON y descarga el archivo.

#### `importMannyData(data)`

Importa datos desde JSON (upsert).

#### `getConfigRecordatorios()` / `actualizarConfigRecordatorios(config)`

Gestión de configuración de recordatorios automáticos.

#### `getTiposServicioRecurrente()` / `actualizarTipoServicioRecurrente(id, updates)`

Gestión de tipos de servicio recurrente.

#### `getDashboardStats()`

Estadísticas del dashboard admin (via RPC).

---

## Manejo de Errores

Todos los servicios siguen el patrón:

```javascript
if (error) {
  logger.error('Descripción del error', { error: error.message, ...context });
  throw new Error(ERROR_MESSAGES.DOMAIN.SPECIFIC_ERROR);
}
```

Los mensajes de error están centralizados en `src/constants/errors.js` y están en español, listos para mostrar en la UI.

---

## Patrones Comunes

### 1. Retry con Backoff

```javascript
import { withRetry } from '@/lib/utils';

const data = await withRetry(
  async () => { /* operación */ },
  { shouldRetry: (error) => !error.isBusinessError }
);
```

### 2. Fire and Forget

```javascript
// Para operaciones no críticas (notificaciones, logs)
notifyClientePuntosRecibidos(clienteId, puntos, concepto, saldoActual);
// No await - no bloquea la respuesta
```

### 3. RPC para Operaciones Atómicas

```javascript
const { data, error } = await supabase.rpc('registrar_canje_atomico', {
  p_cliente_id: cliente_id,
  p_producto_id: producto_id
});
```

### 4. Cola de Sincronización

```javascript
import { enqueueSyncOperation } from './sync';

// Si falla sincronización directa, encolar para retry
await enqueueSyncOperation('sync_cliente', clienteId, { original_error }, 'source');
```

---

**Última actualización**: Diciembre 2025
