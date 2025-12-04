# Manny VIP - Sistema de Recompensas y Lealtad

![Manny VIP Banner](https://i.ibb.co/LDLWZhkj/Recurso-1.png)

**Manny VIP** es una plataforma de lealtad progresiva (PWA) diseñada para premiar a los clientes de Manny por sus servicios de mantenimiento. Los usuarios acumulan puntos, canjean recompensas y acceden a beneficios exclusivos según su nivel (Partner o VIP).

## 🚀 Características Principales

-   **Sistema de Puntos**: Acumulación y canje de puntos por productos reales.
-   **Niveles de Usuario**:
    -   **Partner**: Nivel base con acceso a servicios precargados y beneficios estándar.
    -   **VIP**: Nivel exclusivo con multiplicadores de puntos y acceso premium (próximamente).
-   **PWA (Progressive Web App)**: Instalable en dispositivos móviles, con soporte offline y carga rápida.
-   **Catálogo en Tiempo Real**: Productos y servicios gestionados desde Supabase.
-   **Integración con WhatsApp**: Flujo de canje directo y personalizado.

## 🛠️ Stack Tecnológico

-   **Frontend**: React 18, Vite 5.
-   **Estilos**: Tailwind CSS, Shadcn/ui, Framer Motion (animaciones).
-   **Backend / Base de Datos**: Supabase (PostgreSQL, Auth, Storage).
-   **Iconos**: Lucide React.
-   **Despliegue**: Vercel (recomendado).

## 📂 Estructura del Proyecto

```
src/
├── components/         # Componentes reutilizables
│   ├── ui/             # Primitivas de diseño (Botones, Cards, Inputs)
│   └── ...             # Componentes de funcionalidad (Header, ServicesList)
├── context/            # Estados globales (Auth, Supabase)
├── lib/                # Utilidades y clientes (Supabase Client)
├── pages/              # Vistas principales (Dashboard, Login, Admin)
└── main.jsx            # Punto de entrada
```

## ⚡ Instalación y Configuración

1.  **Clonar el repositorio**:
    ```bash
    git clone <url-del-repo>
    cd Manny-VIP
    ```

2.  **Instalar dependencias**:
    ```bash
    npm install
    ```

3.  **Configurar variables de entorno**:
    Crea un archivo `.env` en la raíz con tus credenciales de Supabase:
    ```env
    VITE_SUPABASE_URL=tu_url_de_supabase
    VITE_SUPABASE_ANON_KEY=tu_anon_key_de_supabase
    ```

4.  **Correr en desarrollo**:
    ```bash
    npm run dev
    ```

5.  **Construir para producción**:
    ```bash
    npm run build
    ```

## 🔐 Seguridad y Roles

El sistema utiliza un flujo de autenticación personalizado basado en número de teléfono.
-   **Tabla `clientes`**: Almacena la información del usuario y su rol (`nivel`).
-   **RLS (Row Level Security)**: Políticas configuradas en Supabase para proteger los datos.

## 📱 PWA

La aplicación está configurada como una PWA.
-   **Manifest**: `vite.config.js` y `manifest.webmanifest`.
-   **Service Worker**: Generado automáticamente por `vite-plugin-pwa` para caché y soporte offline.

---

Desarrollado con ❤️ para Manny.