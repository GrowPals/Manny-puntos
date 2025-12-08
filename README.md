# Manny Rewards

Sistema de lealtad y recompensas para clientes de Manny. Aplicación web progresiva (PWA) que permite a los clientes acumular puntos, canjear recompensas, participar en programas de referidos y recibir regalos exclusivos.

## Tecnologías

| Capa | Tecnología |
|------|------------|
| **Frontend** | React 18, Vite 6, Tailwind CSS 3 |
| **Estado** | TanStack Query (server state), React Context (auth/theme) |
| **UI** | Radix UI, Lucide Icons, Framer Motion |
| **Backend** | Supabase (PostgreSQL, Edge Functions, RPC) |
| **Integraciones** | Notion API (CRM, Tickets), Web Push Notifications |
| **Deploy** | Vercel (Frontend), Supabase Cloud (Backend) |

## Estructura del Proyecto

```
manny-rewards/
├── src/
│   ├── components/          # Componentes React
│   │   ├── ui/              # Primitivas UI (Button, Dialog, Input...)
│   │   ├── common/          # Compartidos (ErrorBoundary, LoadingSpinner...)
│   │   ├── features/        # Funcionalidades (ProductCard, CanjeModal...)
│   │   ├── layout/          # Layout (Header, Footer, BottomNav)
│   │   └── admin/           # Componentes exclusivos de admin
│   ├── pages/               # Vistas (lazy-loaded)
│   ├── services/api/        # Capa de datos (módulos por dominio)
│   ├── context/             # React Context (Auth, Theme)
│   ├── hooks/               # Custom hooks
│   ├── lib/                 # Utilidades y configuración de Supabase
│   ├── config/              # Configuración centralizada
│   ├── constants/           # Constantes y mensajes de error
│   └── assets/              # Imágenes y recursos estáticos
├── supabase/
│   ├── functions/           # Edge Functions (Deno)
│   │   ├── _shared/         # Módulo compartido (CORS, Notion API, tipos)
│   │   └── [function-name]/ # Cada función en su directorio
│   └── migrations/          # Migraciones SQL
├── public/                  # Assets estáticos (PWA icons, SW)
├── api/                     # Vercel Edge Functions (meta tags dinámicos)
└── docs/                    # Documentación técnica
```

## Instalación

### Requisitos Previos

- Node.js 18+
- npm 9+
- Cuenta en Supabase (proyecto configurado)
- Cuenta en Notion (bases de datos configuradas)

### Pasos

1. **Clonar el repositorio**
   ```bash
   git clone <repo-url>
   cd manny-rewards
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   ```bash
   cp .env.example .env
   ```
   Editar `.env` con tus credenciales:
   ```env
   # Supabase
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-anon-key

   # Push Notifications (opcional)
   VITE_VAPID_PUBLIC_KEY=tu-vapid-public-key
   ```

4. **Iniciar desarrollo**
   ```bash
   npm run dev
   ```
   La aplicación estará disponible en `http://localhost:3000`

## Scripts Disponibles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Build de producción |
| `npm run preview` | Preview del build de producción |
| `npm run test` | Ejecutar tests |
| `npm run test:watch` | Tests en modo watch |
| `npm run test:coverage` | Tests con reporte de cobertura |

## Arquitectura

### Flujo de Autenticación

El sistema usa autenticación basada en PIN (no OAuth):

1. Cliente ingresa teléfono (10 dígitos, formato mexicano)
2. Si es primera vez: flujo de onboarding para crear PIN
3. Si ya tiene PIN: verificación via RPC seguro (`verify_client_pin_secure`)
4. Sesión almacenada en localStorage, sincronizada con Supabase

### Servicios API (`src/services/api/`)

| Módulo | Responsabilidad |
|--------|-----------------|
| `auth.js` | Login, verificación PIN, registro PIN |
| `clients.js` | CRUD clientes, asignación de puntos |
| `products.js` | Catálogo de productos canjeables |
| `redemptions.js` | Procesamiento de canjes |
| `services.js` | Servicios asignados (Partners/VIP) |
| `referrals.js` | Programa de referidos |
| `gifts.js` | Links de regalo y campañas |
| `notifications.js` | Push notifications |
| `admin.js` | Funciones administrativas |

### Edge Functions (Supabase)

| Función | Trigger | Descripción |
|---------|---------|-------------|
| `notion-contact-webhook` | Webhook Notion | Crea cliente cuando se agrega contacto |
| `notion-ticket-completed` | Webhook Notion | Asigna puntos (5% del monto) al pagar ticket |
| `notion-canje-status-webhook` | Webhook Notion | Sincroniza cambios de estado |
| `sync-cliente-to-notion` | App | Sincroniza cliente a Notion |
| `sync-canje-to-notion` | App | Crea canje en Notion |
| `create-reward-ticket` | App | Crea ticket de recompensa |
| `activate-beneficio` | App | Activa beneficio/canje guardado |
| `send-push-notification` | Interno | Envía notificaciones push |

### Integración con Notion

El sistema mantiene sincronización bidireccional con 3 bases de datos de Notion:

- **Contactos**: Clientes y sus datos básicos
- **Tickets**: Servicios realizados (fuente de puntos)
- **Manny Rewards**: Canjes, beneficios, cambios de nivel

## Módulos Principales

### Dashboard (`/dashboard`)
Vista principal del cliente con:
- Saldo de puntos actual
- Productos disponibles para canjear
- Beneficios activos
- Historial de actividad

### Panel de Admin (`/admin/*`)
Gestión completa del sistema:
- `/admin` - Dashboard con estadísticas
- `/admin/clientes` - Gestión de clientes
- `/admin/productos` - Catálogo de productos
- `/admin/entregas` - Canjes pendientes de entrega
- `/admin/referidos` - Programa de referidos
- `/admin/regalos` - Links de regalo y campañas

### Programa de Referidos (`/mis-referidos`, `/r/:codigo`)
- Cada cliente tiene código único
- Puntos para referidor y referido al activarse
- Landing page pública para compartir

### Links de Regalo (`/g/:codigo`)
- Regalos individuales o campañas masivas
- Beneficios de servicio o puntos
- QR codes para compartir

## Configuración

### Configuración Centralizada (`src/config/index.js`)

```javascript
// Contacto
CONTACT_CONFIG.WHATSAPP_MAIN      // WhatsApp de soporte
CONTACT_CONFIG.WHATSAPP_SERVICES  // WhatsApp para servicios

// API
API_CONFIG.TIMEOUT                // Timeout de requests (30s)
API_CONFIG.RETRY_ATTEMPTS         // Reintentos (3)

// Cache (React Query)
CACHE_CONFIG.STALE_TIME           // 15 minutos
CACHE_CONFIG.PRODUCTS_STALE_TIME  // 1 hora (productos cambian poco)

// Validación
VALIDATION.PHONE.LENGTH           // 10 dígitos
VALIDATION.PIN.LENGTH             // 4 dígitos

// Reglas de negocio
BUSINESS_RULES.POINTS_PERCENTAGE  // 5% de servicios
```

### Variables de Entorno

#### Frontend (`.env`)
```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
VITE_VAPID_PUBLIC_KEY=xxx
```

#### Supabase Edge Functions (Dashboard)
```env
SUPABASE_URL=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
NOTION_TOKEN=xxx
NOTION_MANNY_REWARDS_DB=xxx
NOTION_CONTACTOS_DB=xxx
NOTION_TICKETS_DB=xxx
VAPID_PUBLIC_KEY=xxx
VAPID_PRIVATE_KEY=xxx
```

## Seguridad

### Autenticación
- PIN hasheado con bcrypt en la base de datos
- Verificación via RPC (`verify_client_pin_secure`) sin exponer datos
- Rate limiting: 5 intentos, bloqueo de 5 minutos

### Row Level Security (RLS)
- Clientes solo ven sus propios datos
- Admins tienen acceso completo
- Productos y configuración son públicos de lectura

### Edge Functions
- Webhooks de Notion usan `--no-verify-jwt` (URLs secretas)
- Funciones internas verifican autenticación via header `x-cliente-id`

## Convenciones de Código

### Nomenclatura
- **Componentes**: PascalCase (`ProductCard.jsx`)
- **Hooks**: camelCase con prefijo `use` (`useProducts.js`)
- **Servicios**: camelCase (`clients.js`)
- **Constantes**: SCREAMING_SNAKE_CASE (`ERROR_MESSAGES`)

### Estructura de Componentes
```jsx
// 1. Imports
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

// 2. Componente
export default function ComponentName({ prop1, prop2 }) {
  // Estado local
  // Hooks custom
  // Handlers
  // Render
}
```

### Manejo de Errores
- Servicios lanzan `Error` con mensajes en español
- Mensajes centralizados en `src/constants/errors.js`
- UI muestra errores via toast (`useToast`)

## Testing

```bash
# Ejecutar todos los tests
npm run test

# Tests en modo watch
npm run test:watch

# Cobertura
npm run test:coverage
```

Los tests usan Vitest + Testing Library. Archivos de test junto a los módulos (`*.test.js`).

## Deploy

### Frontend (Vercel)

1. Conectar repositorio a Vercel
2. Configurar variables de entorno
3. Build automático en push a `main`

### Edge Functions (Supabase)

```bash
# Deploy una función específica
supabase functions deploy nombre-funcion

# Deploy todas
supabase functions deploy
```

## Documentación Adicional

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - Arquitectura detallada
- [API_SERVICES.md](docs/API_SERVICES.md) - Documentación de servicios
- [EDGE_FUNCTIONS.md](docs/EDGE_FUNCTIONS.md) - Edge Functions de Supabase

## Contribuir

1. Crear branch desde `main` (`git checkout -b feature/nueva-feature`)
2. Hacer commits descriptivos
3. Ejecutar tests antes de PR
4. Crear Pull Request con descripción clara

## Licencia

Proyecto privado - Todos los derechos reservados.

---

**Última actualización**: Diciembre 2025
