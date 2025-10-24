# 🔧 Manny - Sistema de Puntos y Recompensas

> Aplicación web para gestión de puntos de lealtad y canje de recompensas desarrollada con React + Vite + Supabase.

## 🚀 Características

### Para Clientes
- 🔐 **Autenticación segura** por número de teléfono (10 dígitos)
- 💰 **Dashboard personal** con balance de puntos en tiempo real
- 🎁 **Catálogo interactivo** de productos y servicios canjeables
- 🛒 **Sistema de canje** intuitivo con confirmación
- 📋 **Historial completo** de canjes con estados de entrega
- 📱 **Diseño 100% responsive** optimizado para móviles
- 🌙 **Tema claro/oscuro** automático

### Para Administradores
- 📊 **Dashboard analítico** con métricas en tiempo real
- 👥 **Gestión completa de clientes** (CRUD + asignación de puntos)
- 🎁 **Administración de productos/servicios** con inventario
- 🚚 **Control de entregas** y estados de canjes
- 👨‍💼 **Gestión de administradores** y permisos
- 📈 **Reportes visuales** con gráficos
- 💾 **Importación/Exportación** de datos

## 🛠️ Stack Tecnológico

- **Frontend:** React 18 + Vite + Tailwind CSS
- **UI Components:** Shadcn/ui + Radix UI
- **Routing:** React Router DOM v6 con lazy loading
- **Animaciones:** Framer Motion
- **Iconografía:** Lucide React
- **Gráficos:** Recharts
- **Backend:** Supabase (PostgreSQL + Auth + RLS)
- **Hosting:** Hostinger con edición vía Horizons

## 📦 Instalación y Configuración

### 1. Variables de Entorno
Crear archivo `.env` en la raíz del proyecto:

```env
# Configuración Supabase (DATOS REALES)
VITE_SUPABASE_URL=https://kuftyqupibyjliaukpxn.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1ZnR5cXVwaWJ5amxpYXVrcHhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMzYzNTUsImV4cCI6MjA3NjgxMjM1NX0.A0JbcXOcK6J_EYTSZvfyKybvFRTBUndYc6O084jK3sE

# Configuración de la aplicación
VITE_WHATSAPP_NUMBER=+524624844148
VITE_APP_NAME=Manny Puntos
NODE_ENV=production
```

### 2. Scripts Disponibles

```bash
npm run dev          # Servidor de desarrollo (puerto 3000)
npm run build        # Build optimizado para producción
npm run preview      # Vista previa del build
npm run lint         # Linting del código
```

### 3. Estructura del Proyecto

```
src/
├── components/              # Componentes reutilizables
│   ├── ui/                 # Componentes base (Shadcn/ui)
│   ├── Header.jsx          # Navegación principal
│   ├── Footer.jsx          # Pie de página
│   ├── ProductCard.jsx     # Tarjeta de producto/servicio
│   ├── WhatsAppButton.jsx  # Botón flotante de contacto
│   ├── ThemeToggle.jsx     # Selector de tema
│   └── ErrorBoundary.jsx   # Manejo de errores
├── context/                # Contextos globales
│   ├── AuthContext.jsx     # Autenticación y usuario
│   ├── SupabaseContext.jsx # API calls y lógica de datos
│   └── ThemeContext.jsx    # Tema claro/oscuro
├── pages/                  # Páginas principales (lazy loaded)
│   ├── Login.jsx           # Autenticación por teléfono
│   ├── Dashboard.jsx       # Dashboard del cliente
│   ├── MisCanjes.jsx       # Historial de canjes
│   ├── ConfirmarCanje.jsx  # Confirmación de canje
│   ├── Admin.jsx           # Dashboard administrativo
│   ├── AdminProductos.jsx  # Gestión productos/servicios
│   ├── AdminClientes.jsx   # Gestión de clientes
│   ├── AdminEntregas.jsx   # Gestión de canjes
│   └── AdminGestion.jsx    # Gestión de administradores
└── lib/
    └── customSupabaseClient.js # Cliente Supabase configurado
```

## 👥 Roles y Permisos

### Cliente Regular (`es_admin: false`)
**Acceso a:**
- `/dashboard` - Dashboard personal con puntos
- `/mis-canjes` - Historial de canjes realizados
- `/canjear/:id` - Confirmación de canje
- `/sobre-manny` - Información de la empresa

### Administrador (`es_admin: true`)
**Acceso adicional a:**
- `/admin` - Dashboard con métricas del sistema
- `/admin/productos` - CRUD de productos y servicios
- `/admin/clientes` - Gestión de clientes y puntos
- `/admin/entregas` - Control de estados de canjes
- `/admin/gestion` - Gestión de permisos de admin

## 🔄 Flujos Principales

### Autenticación
1. Usuario ingresa teléfono de 10 dígitos
2. Sistema valida formato y busca en Supabase
3. Si existe: login automático con redirección según rol
4. Si no existe: mensaje de error "Número no registrado"

### Canje de Recompensas
1. Cliente ve catálogo en Dashboard
2. Selecciona producto/servicio disponible
3. Verifica puntos suficientes
4. Confirma canje → descuenta puntos → crea registro
5. Administrador gestiona estado de entrega

### Gestión Administrativa
1. Admin ve métricas en dashboard principal
2. Gestiona catálogo: crear/editar productos y servicios
3. Administra clientes: ver datos y asignar puntos
4. Controla entregas: cambiar estados de canjes
5. Gestiona permisos: promover/degradar administradores

## 🗄️ Base de Datos (Supabase)

### Tablas Principales

**clientes**
- `id` (UUID) - Identificador único
- `nombre` (VARCHAR) - Nombre completo
- `telefono` (VARCHAR) - Teléfono único de 10 dígitos
- `puntos_actuales` (INTEGER) - Balance actual de puntos
- `es_admin` (BOOLEAN) - Permisos de administrador

**productos**
- `id` (UUID) - Identificador único
- `nombre` (VARCHAR) - Nombre del producto/servicio
- `tipo` (VARCHAR) - 'producto' o 'servicio'
- `puntos_requeridos` (INTEGER) - Costo en puntos
- `stock` (INTEGER) - Inventario (NULL para servicios)
- `activo` (BOOLEAN) - Disponibilidad

**canjes**
- `id` (UUID) - Identificador único
- `cliente_id` (UUID) - Referencia al cliente
- `producto_id` (UUID) - Referencia al producto
- `puntos_usados` (INTEGER) - Puntos gastados
- `estado` (VARCHAR) - Estado de entrega
- `fecha` (TIMESTAMP) - Fecha del canje

### Usuario Administrador por Defecto
```sql
INSERT INTO clientes (nombre, telefono, puntos_actuales, es_admin) 
VALUES ('Admin Principal', '4624844148', 1000, true);
```

## 🎨 Branding y Diseño

### Paleta de Colores Manny
```css
/* Colores principales */
--color-primary: #e91e63;          /* Rosa principal Manny */
--color-primary-vibrant: #ff1f6d;  /* Rosa vibrante */
--color-primary-dark: #ad1457;     /* Rosa oscuro */

/* Colores secundarios */
--color-secondary: #1e293b;        /* Gris azulado */
--color-secondary-dark: #0f172a;   /* Fondo modo oscuro */

/* Colores de acción */
--color-accent: #10b981;           /* Verde éxito */
--color-whatsapp: #25D366;         /* Verde WhatsApp */
```

### Tipografía y Estilo
- **Font:** Inter (Google Fonts)
- **Headings:** Uppercase + tracking-tight + font-black
- **Theme:** Modo oscuro por defecto con toggle
- **Animaciones:** Framer Motion para transiciones suaves

## 🌐 Deployment en Hostinger

### Proceso de Build
```bash
# 1. Instalar dependencias
npm install

# 2. Crear build de producción
npm run build

# 3. Subir contenido de la carpeta dist/ a Hostinger
```

### Configuración en Hostinger
1. **Panel de Control:** Acceder a File Manager
2. **Upload:** Subir contenido de `dist/` a directorio raíz
3. **Variables:** Configurar en panel de hosting:
   - `VITE_SUPABASE_URL=https://kuftyqupibyjliaukpxn.supabase.co`
   - `VITE_SUPABASE_ANON_KEY=[tu-key-aquí]`

### Edición con Horizons
- **Desarrollo:** Usar IA de Horizons para modificar código
- **Testing:** `npm run dev` para probar cambios
- **Deploy:** `npm run build` y subir dist/ actualizado

## 🔧 Troubleshooting

### Errores Comunes

**Error: "Cannot resolve module customSupabaseClient"**
```bash
# Verificar que existe src/lib/customSupabaseClient.js
# Crear si no existe con configuración de Supabase
```

**Error: Variables CSS no funcionan**
```css
/* Verificar en src/index.css que estén definidas: */
:root {
  --color-primary: #e91e63;
  --color-secondary-dark: #0f172a;
  /* ... otras variables */
}
```

**Error: "Número no registrado"**
```sql
-- Verificar que el cliente existe en Supabase:
SELECT * FROM clientes WHERE telefono = 'tu_numero';

-- Crear cliente si no existe:
INSERT INTO clientes (nombre, telefono, puntos_actuales, es_admin) 
VALUES ('Tu Nombre', 'tu_numero', 100, false);
```

**Error de conexión a Supabase**
- Verificar URL y clave en variables de entorno
- Confirmar que el proyecto Supabase esté activo
- Revisar políticas RLS si hay errores de permisos

### Debug Mode
```javascript
// Activar logs en desarrollo
if (import.meta.env.DEV) {
  console.log('Usuario actual:', user);
  console.log('Productos:', productos);
  console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
}
```

## 📊 Performance y Optimizaciones

### Optimizaciones Implementadas
- ✅ **Lazy loading** de páginas con React.lazy()
- ✅ **Code splitting** automático con Vite
- ✅ **React.memo** en componentes pesados
- ✅ **useCallback/useMemo** para optimizar re-renders
- ✅ **Bundle splitting** para vendors y features

### Métricas Objetivo
- **Build size:** < 1MB
- **First Load:** < 3 segundos
- **Lighthouse Score:** > 85

## 🔒 Seguridad

### Medidas de Seguridad
- **Row Level Security (RLS)** habilitado en Supabase
- **Validación de inputs** en frontend y backend
- **Autenticación sin contraseñas** por teléfono
- **Variables de entorno** para credenciales sensibles
- **Sanitización** automática de React para prevenir XSS

### Configuración RLS Recomendada
```sql
-- Habilitar RLS en todas las tablas
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE canjes ENABLE ROW LEVEL SECURITY;

-- Política de ejemplo para productos públicos
CREATE POLICY "Productos públicos" ON productos
  FOR SELECT USING (activo = true);
```

## 📞 Soporte y Contacto

- **WhatsApp:** [+52 462 484 4148](https://wa.me/524624844148)
- **Desarrollo:** Via Horizons IA de Hostinger
- **Hosting:** Panel de control Hostinger

## 📈 Roadmap y Futuras Mejoras

### Próximas Funcionalidades
- [ ] Notificaciones push para canjes
- [ ] Sistema de categorías avanzado
- [ ] Integración con pasarelas de pago
- [ ] Dashboard de analytics avanzado
- [ ] API REST para integraciones externas

### Mantenimiento
- **Updates:** Revisar dependencias mensualmente
- **Backup:** Exportar datos de Supabase regularmente
- **Monitoring:** Revisar métricas de performance
- **Security:** Actualizar tokens y credenciales según sea necesario

---

## 🎯 Resumen Técnico

**Manny** es una aplicación web moderna y escalable para gestión de programas de lealtad. Construida con React 18 y Vite para máximo performance, integrada con Supabase para backend robusto, y diseñada con Tailwind CSS para UI consistente y responsive.

La aplicación maneja dos tipos de usuarios (clientes y administradores) con flujos específicos para cada rol, sistema de puntos flexible, catálogo de productos y servicios configurable, y panel administrativo completo para gestión del sistema.

**Tecnologías clave:** React, Vite, Supabase, Tailwind CSS, Framer Motion  
**Hosting:** Hostinger con desarrollo via Horizons IA  
**Base de datos:** PostgreSQL con Row Level Security  

---

*Desarrollado para Manny © 2024 - Sistema de Puntos y Recompensas*