# Documentación de Servicios API

La capa de datos de Manny Rewards está modularizada en `src/services/api/`. Cada módulo es responsable de un dominio específico.

## Estructura

```
src/services/api/
├── auth.js         # Autenticación y verificación de PIN
├── clients.js      # Gestión de clientes y puntos
├── products.js     # Catálogo de productos
├── redemptions.js  # Procesamiento de canjes
├── services.js     # Servicios asignados y historial
└── admin.js        # Funciones exclusivas de administrador
```

## Módulos

### `auth.js`
- `login(telefono, pin)`: Autentica al usuario verificando el PIN de forma segura (RPC).
- `verifyPin(telefono, pin)`: Llama a `verify_client_pin` en la base de datos.

### `clients.js`
- `getTodosLosClientes()`: Obtiene lista completa (Admin).
- `crearOActualizarCliente(data)`: Upsert de clientes.
- `asignarPuntosManualmente(telefono, puntos, concepto)`: Suma puntos vía RPC atómico.
- `getClienteHistorial(telefono)`: Obtiene canjes y puntos de un cliente.

### `products.js`
- `getProductosCanje()`: Productos activos para usuarios.
- `crearOActualizarProducto(data)`: Gestión de inventario (Admin).

### `redemptions.js`
- `registrarCanje({ cliente_id, producto_id })`: Procesa un canje atómicamente (verifica saldo, resta puntos, crea registro).
- `getCanjesPendientes()`: Lista canjes por entregar.

### `services.js`
- `getServiciosCliente(id)`: Servicios disponibles para Partners/VIP.
- `canjearServicioAsignado(id)`: Marca un servicio como utilizado.

### `admin.js`
- `exportMannyData()` / `importMannyData()`: Respaldo y restauración de datos JSON.
- `getConfigRecordatorios()`: Configuración de notificaciones automáticas.

## Manejo de Errores
Todos los servicios lanzan objetos `Error` con mensajes descriptivos en español, listos para ser mostrados en la UI (ej. en un `toast`).
