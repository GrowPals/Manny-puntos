# Manny Rewards - Sistema de Lealtad

Aplicación web para la gestión de puntos y recompensas de clientes VIP y Partners de Manny.

## 🚀 Tecnologías

- **Frontend:** React 18, Vite 5, Tailwind CSS 3
- **Estado:** TanStack Query (Server State), React Context (Auth/Theme)
- **Backend:** Supabase (PostgreSQL, Edge Functions, RPCs)
- **UI:** Radix UI, Lucide Icons, Framer Motion

## 🛠️ Configuración e Instalación

1.  **Clonar el repositorio:**
    ```bash
    git clone <repo-url>
    cd manny-rewards
    ```

2.  **Instalar dependencias:**
    ```bash
    npm install
    ```

3.  **Variables de Entorno:**
    Crear un archivo `.env` en la raíz con:
    ```env
    VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
    VITE_SUPABASE_ANON_KEY=tu-anon-key
    ```

4.  **Correr en desarrollo:**
    ```bash
    npm run dev
    ```

## 🏗️ Arquitectura

### Estructura de Directorios
- `src/services/api/`: Módulos de servicio para interactuar con Supabase (Auth, Clientes, Productos, etc.).
- `src/context/`: Contextos globales (AuthContext, ThemeContext).
- `src/pages/`: Vistas de la aplicación (Lazy loaded).
- `src/components/`: Componentes reutilizables (UI, Features, Layout).

### Seguridad (Audit 2025)
- **Autenticación:** Basada en PIN (hasheado con bcrypt en BD).
- **Verificación:** RPC `verify_client_pin` para validar credenciales sin exponer datos sensibles.
- **Nota:** La aplicación utiliza un sistema de login personalizado. Se recomienda migrar a Supabase Auth para mayor seguridad en el futuro.

## 📝 Scripts Disponibles

- `npm run dev`: Inicia el servidor de desarrollo.
- `npm run build`: Construye la aplicación para producción.
- `npm run preview`: Vista previa del build de producción.

## 🤝 Contribuir
1.  Hacer fork del repositorio.
2.  Crear una rama (`git checkout -b feature/nueva-feature`).
3.  Commit de cambios (`git commit -m 'Add nueva feature'`).
4.  Push a la rama (`git push origin feature/nueva-feature`).
5.  Abrir un Pull Request.
