# Manny Rewards - Sistema de Lealtad

Sistema de recompensas PWA para clientes de Manny. Acumula puntos por servicios de mantenimiento y canjea por productos reales.

## Características

- **Sistema de Puntos**: 5% del monto de cada servicio se convierte en puntos
- **Niveles**: Partner (base) y VIP (premium)
- **PWA**: Instalable en móviles con notificaciones push
- **Integración Notion**: Sincronización bidireccional automática
- **Panel Admin**: Gestión completa de clientes, productos y canjes

## Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | React 18, Vite 5, Tailwind CSS |
| UI | Shadcn/ui, Framer Motion, Lucide Icons |
| Backend | Supabase (PostgreSQL + Edge Functions) |
| Operaciones | Notion (Contactos, Tickets, Rewards) |
| PWA | VitePWA + Web Push API |

## Instalación

```bash
# Clonar e instalar
git clone <repo-url>
cd manny-rewards
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Desarrollo
npm run dev

# Build producción
npm run build
```

## Variables de Entorno

```env
# Frontend (.env)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_VAPID_PUBLIC_KEY=BNi...

# Supabase Secrets (configurar en dashboard)
NOTION_TOKEN=secret_xxx
VAPID_PUBLIC_KEY=BNi...
VAPID_PRIVATE_KEY=WZT...
```

## Estructura del Proyecto

```
manny-rewards/
├── src/
│   ├── components/      # Componentes React
│   │   ├── ui/          # Primitivas (Button, Card, etc.)
│   │   ├── common/      # ErrorBoundary, SEOHelmet
│   │   ├── features/    # ServicesList, WhatsAppButton
│   │   └── layout/      # Header, Footer
│   ├── context/         # AuthContext, SupabaseContext
│   ├── hooks/           # usePushNotifications, useProducts
│   ├── pages/           # Dashboard, Admin, Login, etc.
│   └── lib/             # Supabase client
├── supabase/
│   └── functions/       # 8 Edge Functions
├── public/
│   └── icons/           # isotipo.svg, logo.svg
└── docs/                # Documentación técnica
```

## Edge Functions

| Función | Propósito |
|---------|-----------|
| `notion-contact-webhook` | Nuevo contacto → Cliente |
| `notion-ticket-completed` | Ticket pagado → Puntos |
| `notion-canje-status-webhook` | Estado canje desde Notion |
| `notion-cliente-sync` | Sync nivel/puntos desde Notion |
| `sync-canje-to-notion` | Canje → Notion |
| `update-canje-status-notion` | Estado canje → Notion |
| `update-cliente-nivel` | Cambio nivel → Notion |
| `send-push-notification` | Notificaciones push |

## Base de Datos

| Tabla | Descripción |
|-------|-------------|
| `clientes` | Usuarios, puntos, nivel, admin |
| `productos` | Catálogo canjeable |
| `canjes` | Registro de canjes |
| `historial_puntos` | Movimientos de puntos |
| `push_subscriptions` | Suscripciones push |
| `notification_history` | Log de notificaciones |
| `servicios_asignados` | Beneficios Partner |
| `ticket_events` | Eventos webhooks |

## Deploy en Vercel

### Opción 1: CLI
```bash
npm i -g vercel
vercel --prod
```

### Opción 2: GitHub
1. Conecta tu repo en [vercel.com/new](https://vercel.com/new)
2. Framework: Vite (se detecta automáticamente)
3. Build Command: `npm run build`
4. Output Directory: `dist`

### Variables de Entorno en Vercel
Configurar en Settings → Environment Variables:
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_VAPID_PUBLIC_KEY
```

### Configuración Incluida
El archivo `vercel.json` ya incluye:
- SPA rewrites para React Router
- Headers de Service Worker para PWA
- Cache optimizado para assets
- Headers de seguridad

## Documentación

- [Arquitectura Técnica](docs/ARCHITECTURE.md)
- [Sistema de Negocio](docs/MANNY_SYSTEM.md)
- [Plan Maestro](docs/PLAN_MAESTRO_MANNY_REWARDS.md)

---

Desarrollado para Manny
