# Sistema Manny
## Programa de Lealtad

**Versión:** 1.1 (Refinado por Antigravity)
**Fecha:** Diciembre 2025
**Documento Maestro de Arquitectura e Implementación**

---

## Índice

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Visión del Programa](#2-visión-del-programa)
3. [Arquitectura del Sistema](#3-arquitectura-del-sistema)
4. [Bases de Datos en Notion](#4-bases-de-datos-en-notion)
5. [Reglas de Negocio](#5-reglas-de-negocio)
6. [Flujos de Automatización](#6-flujos-de-automatización)
7. [Catálogo de Servicios Canjeables](#7-catálogo-de-servicios-canjeables)
8. [Sistema de Notificaciones](#8-sistema-de-notificaciones)
9. [Experiencia del Cliente (App)](#9-experiencia-del-cliente-app)
10. [Operación del Equipo](#10-operación-del-equipo)
11. [Métricas y KPIs](#11-métricas-y-kpis)
12. [Seguridad y Control](#12-seguridad-y-control)
13. [Guía de Implementación](#13-guía-de-implementación)
14. [Glosario](#14-glosario)

---

## 1. Resumen Ejecutivo

### ¿Qué es el Sistema Manny?

Es un programa de lealtad diseñado para premiar a los clientes de **Manny** por su preferencia. Cada vez que un cliente paga por un servicio, acumula puntos que puede canjear por servicios gratuitos como mantenimientos, revisiones o limpiezas.

### Propuesta de Valor

| Para el Cliente | Para Manny |
|-----------------|------------|
| Gana recompensas por ser cliente | Incrementa retención de clientes |
| Servicios gratuitos por su lealtad | Genera ventas recurrentes |
| Acceso exclusivo si es VIP | Diferenciación vs competencia |
| Todo visible en su app móvil | Datos para decisiones estratégicas |

### Números Clave del Diseño

| Concepto | Valor |
|----------|-------|
| Tasa de acumulación | 5% del monto pagado |
| Niveles de membresía | 2 (Partner y VIP) |
| Expiración de puntos | 12 meses sin actividad |
| Canjes pendientes máximos | 3 simultáneos |

---

## 2. Visión del Programa

### Filosofía

> "Cada peso que un cliente invierte con nosotros, es un paso hacia su próximo servicio gratuito."

El programa Manny no es solo un mecanismo de puntos; es una forma de comunicar al cliente que valoramos su confianza. Queremos que:

1. **Se sienta reconocido** — Su historial y puntos visibles en todo momento
2. **Experimente beneficios tangibles** — Servicios reales, no descuentos abstractos
3. **Aspire a más** — El nivel VIP como meta alcanzable y deseable

### Niveles de Membresía

#### Nivel Partner (Base)

Todo cliente que se registra comienza como **Partner**.

| Beneficio | Descripción |
|-----------|-------------|
| Acumulación de puntos | 5% del monto de cada ticket pagado |
| Canje de servicios | Acceso al catálogo estándar |
| Historial en app | Visualización de puntos y canjes |

#### Nivel VIP

Clientes selectos con historial destacado, designados manualmente.

| Beneficio | Descripción |
|-----------|-------------|
| Acumulación de puntos | 5% (igual que Partner) |
| Servicios exclusivos | Acceso a catálogo completo incluyendo exclusivos VIP |
| Prioridad en agenda | Sus canjes se programan antes |
| Reconocimiento | Distintivo VIP visible en app |
| Atención preferencial | Línea directa / respuesta prioritaria |

**Criterio de asignación:** Manual. El equipo identifica clientes con alto valor (tickets frecuentes, montos significativos, referidos generados) y los promueve a VIP.

*Nota: En una fase futura, se puede automatizar (ejemplo: automáticamente VIP después de acumular 5,000 puntos).*

---

## 3. Arquitectura del Sistema

### Stack Tecnológico (Optimizado)

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTE                                  │
│                     (App Móvil Manny)                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         SUPABASE                                 │
│         Base de datos en tiempo real para la app                │
│    • Autenticación de usuarios                                  │
│    • Puntos y canjes sincronizados                              │
│    • Catálogo de servicios                                      │
│    • Edge Functions (Lógica de Negocio)                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   SUPABASE EDGE FUNCTIONS                        │
│              Motor de automatización (Serverless)               │
│    • Escucha Webhooks de Base de Datos                          │
│    • Cron Jobs para sincronizar desde Notion                    │
│    • Conecta con API de Notion                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          NOTION                                  │
│              Fuente de verdad operativa                         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              BÓVEDA DE DATOS (Privada)                   │   │
│  │  • Base "Contactos" — Datos maestros de clientes        │   │
│  │  • Base "Lealtad" — Puntos y niveles                    │   │
│  │  • Base "Catálogo" — Servicios canjeables               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              WORKSPACE (Equipo)                          │   │
│  │  • Base "Tickets" — Servicios facturados                │   │
│  │  • Base "Canjes" — Solicitudes de canje                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Principios de Diseño

1. **Notion es la fuente de verdad** — Todo dato operativo vive aquí.
2. **Supabase es el espejo para la app** — Réplica optimizada para lectura rápida y autenticación.
3. **Edge Functions reemplazan a n8n** — Mayor control, menor latencia y sin infraestructura externa.
4. **Separación de responsabilidades** — Bóveda (privado/sensible) vs Workspace (operativo/equipo).

### Flujo de Datos General

```
TICKET PAGADO                    CANJE SOLICITADO
     │                                  │
     ▼                                  ▼
[Tickets en Notion]              [App del Cliente]
     │                                  │
     ▼                                  ▼
[Edge Function (Cron)]           [Supabase recibe]
[detecta pago]                          │
     │                                  │
     ▼                                  ▼
[Calcula 5% puntos]              [Edge Function (Webhook)]
     │                                  │
     ▼                                  ▼
[Actualiza Lealtad]              [Crea en Canjes Notion]
     │                                  │
     ▼                                  ▼
[Sync a Supabase]                [Equipo ve y programa]
     │                                  │
     ▼                                  ▼
[Cliente ve en app]              [Técnico ejecuta]
                                        │
                                        ▼
                                 [Marca completado]
                                        │
                                        ▼
                                 [Edge Function actualiza todo]
```

---

## 4. Bases de Datos en Notion

### 4.1 Base: Contactos (Existente en Bóveda)

**ID:** `17ac6cfd-8c1e-8068-8bc0-d32488189164`
**Ubicación:** Bóveda de Datos
**Propósito:** Datos maestros de todos los clientes

Esta base ya existe. Solo se documenta su relación con el sistema Manny.

| Campo | Tipo | Uso en Manny |
|-------|------|--------------|
| Nombre | Title | Identificación |
| Teléfono | Phone | Contacto para canjes |
| Email | Email | Notificaciones |
| Dirección | Text | Ubicación para servicios |
| Tickets | Relation → Tickets | Historial de servicios |

---

### 4.2 Base: Lealtad (Nueva en Bóveda)

**Ubicación:** Bóveda de Datos (junto a Contactos)
**Propósito:** Gestionar membresías, puntos y niveles

#### Campos

| Campo | Tipo | Descripción | Origen |
|-------|------|-------------|--------|
| **Miembro** | Title | Nombre del cliente | Manual / Automático |
| **Contacto** | Relation → Contactos | Vínculo al cliente | Manual |
| **Nivel** | Select | Partner / VIP | Manual |
| **Puntos Ganados** | Rollup | Suma de puntos de tickets asociados | Automático |
| **Puntos Canjeados** | Rollup | Suma de puntos de canjes completados | Automático |
| **Puntos Disponibles** | Formula | Ganados - Canjeados | Automático |
| **Total Canjes** | Rollup | Conteo de canjes realizados | Automático |
| **Último Canje** | Rollup | Fecha del canje más reciente | Automático |
| **Último Ticket** | Rollup | Fecha del último ticket (vía Contacto) | Automático |
| **Fecha Alta** | Date | Cuándo se unió al programa | Automático |
| **Estado** | Select | Activo / Inactivo / Expirado | Manual/Auto |
| **Notas** | Text | Observaciones internas | Manual |

#### Fórmulas

**Puntos Disponibles:**
```
prop("Puntos Ganados") - prop("Puntos Canjeados")
```

#### Vistas

| Vista | Filtro | Ordenamiento | Uso |
|-------|--------|--------------|-----|
| **Todos** | Ninguno | Nombre A→Z | Vista general |
| **VIPs** | Nivel = VIP | Puntos Disponibles ↓ | Clientes premium |
| **Activos** | Último Ticket < 90 días | Puntos Disponibles ↓ | Clientes con actividad reciente |
| **Inactivos** | Último Ticket > 90 días | Último Ticket ↑ | Candidatos a reactivación |
| **Por Expirar** | Último Ticket > 300 días | Último Ticket ↑ | Alerta de expiración próxima |

---

### 4.3 Base: Catálogo (Nueva en Bóveda)

**Ubicación:** Bóveda de Datos
**Propósito:** Administrar servicios canjeables sin tocar código

#### Campos

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| **Servicio** | Title | Nombre del servicio | "Limpieza de paneles" |
| **Puntos** | Number | Costo en puntos | 500 |
| **Descripción** | Text | Texto para mostrar en app | "Limpieza profesional de..." |
| **Categoría** | Select | Tipo de servicio | Mantenimiento / Diagnóstico / Premium |
| **Activo** | Checkbox | ¿Disponible para canje? | ✓ |
| **Solo VIP** | Checkbox | ¿Exclusivo para nivel VIP? | ☐ |
| **Duración Estimada** | Text | Tiempo del servicio | "2-3 horas" |
| **Imagen** | Files | Visual para la app | archivo.jpg |
| **Orden** | Number | Posición en lista de app | 1, 2, 3... |

#### Vistas

| Vista | Filtro | Uso |
|-------|--------|-----|
| **Activos** | Activo = ✓ | Lo que se muestra en app |
| **VIP** | Solo VIP = ✓ | Servicios exclusivos |
| **Todos** | Ninguno | Administración completa |

---

### 4.4 Base: Tickets (Existente en Workspace)

**ID:** `17ac6cfd-8c1e-8162-b724-d4047a7e7635`
**Ubicación:** Workspace del equipo
**Propósito:** Registro de servicios facturados

#### Campos Relevantes para Manny (Agregar si no existen)

| Campo | Tipo | Descripción | Uso en Manny |
|-------|------|-------------|--------------|
| Cliente | Relation → Contactos | Quién recibió el servicio | Vincular puntos |
| Monto | Number | Total facturado | Base para calcular puntos |
| Estado de Pago | Select | Pendiente / Pagado | Trigger para puntos |
| Fecha de Pago | Date | Cuándo se pagó | Registro |
| **Puntos Generados** | Formula | Monto × 0.05 | Cálculo automático |

#### Fórmula: Puntos Generados

```
if(prop("Estado de Pago") == "Pagado", round(prop("Monto") * 0.05), 0)
```

*Esto calcula el 5% solo cuando el ticket está pagado. Un ticket de $1,000 genera 50 puntos.*

---

### 4.5 Base: Canjes (Nueva en Workspace)

**Ubicación:** Workspace del equipo
**Propósito:** Gestionar solicitudes de canje y coordinación con clientes

#### Campos

| Campo | Tipo | Descripción | Origen |
|-------|------|-------------|--------|
| **Canje** | Title | ID o descripción corta | Auto: "Canje #001" |
| **Miembro** | Relation → Lealtad | Quién solicita | Automático |
| **Servicio** | Relation → Catálogo | Qué servicio | Automático (desde app) |
| **Puntos** | Rollup | Puntos del servicio | Automático |
| **Estado** | Select | Pendiente / Programado / Completado / Cancelado | Manual/Auto |
| **Fecha Solicitud** | Date | Cuándo se solicitó | Automático |
| **Fecha Programada** | Date | Cuándo se realizará | Manual |
| **Técnico Asignado** | Person | Quién lo ejecutará | Manual |
| **Teléfono** | Rollup | Teléfono del cliente | Auto (vía Miembro→Contacto) |
| **Dirección** | Rollup | Dirección del cliente | Auto (vía Miembro→Contacto) |
| **Nivel** | Rollup | Partner/VIP del cliente | Auto (vía Miembro) |
| **Notas** | Text | Observaciones | Manual |
| **Motivo Cancelación** | Text | Si se cancela, por qué | Manual |

#### Estados y su Significado

| Estado | Significado | Siguiente Paso |
|--------|-------------|----------------|
| **Pendiente** | Cliente solicitó, esperando contacto | Llamar y agendar |
| **Programado** | Fecha acordada con cliente | Ejecutar en la fecha |
| **Completado** | Servicio realizado | Ninguno (fin del flujo) |
| **Cancelado** | No se realizará | Puntos devueltos |

#### Vistas

| Vista | Filtro | Ordenamiento | Uso |
|-------|--------|--------------|-----|
| **📋 Pendientes** | Estado = Pendiente | Fecha Solicitud ↑ | ¿Qué coordinar? |
| **⭐ VIPs Pendientes** | Estado = Pendiente + Nivel = VIP | Fecha Solicitud ↑ | Prioridad alta |
| **📅 Esta Semana** | Fecha Programada = esta semana | Fecha Programada ↑ | Planificación semanal |
| **📍 Hoy** | Fecha Programada = hoy | Hora ↑ | Ejecución diaria |
| **✅ Completados** | Estado = Completado | Fecha Programada ↓ | Historial exitoso |
| **❌ Cancelados** | Estado = Cancelado | Fecha Solicitud ↓ | Registro de cancelaciones |
| **🔍 Todos** | Ninguno | Fecha Solicitud ↓ | Vista completa |

---

### 4.6 Diagrama de Relaciones

```
┌─────────────────┐
│    CONTACTOS    │
│    (Bóveda)     │
└────────┬────────┘
         │
         │ 1:1
         ▼
┌─────────────────┐         ┌─────────────────┐
│     LEALTAD     │────────▶│    CATÁLOGO     │
│    (Bóveda)     │   N:1   │    (Bóveda)     │
└────────┬────────┘         └─────────────────┘
         │                          ▲
         │ 1:N                      │
         ▼                          │ N:1
┌─────────────────┐                 │
│     CANJES      │─────────────────┘
│   (Workspace)   │
└────────┬────────┘
         │
         │ N:1
         ▼
┌─────────────────┐
│    TICKETS      │
│   (Workspace)   │
└─────────────────┘
```

---

## 5. Reglas de Negocio

### 5.1 Acumulación de Puntos

| Regla | Valor |
|-------|-------|
| Tasa de acumulación | 5% del monto del ticket |
| Redondeo | Al entero más cercano |
| Momento de acumulación | Cuando el ticket cambia a "Pagado" |
| Aplica a | Todos los clientes registrados en el programa |

**Ejemplos:**

| Monto del Ticket | Puntos Generados |
|------------------|------------------|
| $500 | 25 puntos |
| $1,000 | 50 puntos |
| $2,500 | 125 puntos |
| $5,000 | 250 puntos |
| $10,000 | 500 puntos |

### 5.2 Expiración de Puntos

| Regla | Valor |
|-------|-------|
| Política | 12 meses sin actividad |
| Definición de actividad | Ticket pagado O canje realizado |
| Aviso previo | 30 días antes de expirar |
| Acción al expirar | Puntos se reducen a 0, estado cambia a "Expirado" |
| Reactivación | Nueva actividad reinicia el contador de 12 meses |

**Lógica:**
```
SI (Fecha_Hoy - Último_Ticket > 365 días) Y (Fecha_Hoy - Último_Canje > 365 días)
ENTONCES Puntos_Disponibles = 0, Estado = "Expirado"
```

### 5.3 Canje de Puntos

| Regla | Valor |
|-------|-------|
| Mínimo para canjear | Depende del servicio (ver catálogo) |
| Máximo de canjes pendientes | 3 simultáneos |
| Canjes por día | Sin límite |
| Vigencia del canje pendiente | 30 días para programar |

**Validación en app:**
```
SI Puntos_Disponibles >= Puntos_Servicio
   Y Canjes_Pendientes < 3
   Y (Servicio.Solo_VIP = false O Cliente.Nivel = VIP)
ENTONCES Permitir_Canje
SINO Mostrar_Mensaje_Error
```

### 5.4 Cancelación de Canjes

| Escenario | Acción | Puntos |
|-----------|--------|--------|
| Cliente cancela antes de programar | Cancelar | Devolver 100% |
| Cliente cancela después de programar | Cancelar con motivo | Devolver 100% |
| Manny cancela por causa nuestra | Cancelar + notificar | Devolver 100% |
| No-show del cliente | Cancelar | NO devolver (evaluar caso a caso) |

### 5.5 Promoción a VIP

| Criterio | Tipo |
|----------|------|
| Método actual | Manual (decisión del equipo) |
| Candidatos sugeridos | Clientes con >5 tickets O >$50,000 histórico |
| Comunicación | Notificación en app + mensaje personal |

*Fase futura: Automatizar cuando cliente alcance X puntos acumulados históricos.*

---

## 6. Flujos de Automatización (Vía Edge Functions)

### 6.1 Flujo: Acumulación de Puntos

**Trigger:** Edge Function (Cron) detecta Ticket "Pagado" en Notion.

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. TRIGGER: Edge Function (Cron Job) consulta Notion           │
│    Busca Tickets pagados recientemente no procesados           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. OBTENER: Cliente del ticket (Relation → Contactos)          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. BUSCAR: Registro de Lealtad del cliente                     │
│    • Si no existe → Crear nuevo (Nivel = Partner)              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. CALCULAR: Puntos = Monto × 0.05 (redondeado)               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. ACTUALIZAR: Campo "Puntos Generados" del Ticket             │
│    (El Rollup en Lealtad se actualiza automáticamente)         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. SINCRONIZAR: Enviar nuevos puntos a Supabase               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. NOTIFICAR: Push a app "¡Ganaste X puntos!"                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Flujo: Solicitud de Canje (desde App)

**Trigger:** Cliente solicita canje en la app móvil

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. TRIGGER: Cliente toca "Canjear" en app                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. VALIDAR en Supabase:                                        │
│    • ¿Puntos_Disponibles >= Puntos_Servicio? ✓                │
│    • ¿Canjes_Pendientes < 3? ✓                                 │
│    • ¿Servicio disponible para su nivel? ✓                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
               SI VÁLIDO           NO VÁLIDO
                    │                   │
                    ▼                   ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│ 3a. CREAR en Supabase:   │  │ 3b. MOSTRAR error:       │
│     Registro de canje    │  │     "Puntos insuficientes"│
│     Estado = Pendiente   │  │     o "Límite alcanzado" │
└──────────────────────────┘  └──────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. WEBHOOK a Edge Function: Nuevo canje creado                 │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Edge Function CREA en Notion:                               │
│    • Nuevo registro en base "Canjes"                           │
│    • Vincula a Miembro y Servicio                              │
│    • Estado = Pendiente                                        │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. RESERVAR puntos (restar de disponibles temporalmente)       │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. NOTIFICAR: "Tu solicitud fue recibida. Te contactaremos."   │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 Flujo: Programación de Canje

**Trigger:** Equipo actualiza canje de "Pendiente" a "Programado"

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. TRIGGER: Canje.Estado cambia a "Programado"                 │
│    + Canje.Fecha_Programada tiene valor                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. OBTENER: Datos del canje (servicio, fecha, cliente)         │
│    (Vía Edge Function Cron)                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. SINCRONIZAR: Actualizar estado en Supabase                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. NOTIFICAR: "Tu [servicio] está agendado para [fecha]"       │
└─────────────────────────────────────────────────────────────────┘
```

### 6.4 Flujo: Completar Canje

**Trigger:** Técnico marca canje como "Completado"

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. TRIGGER: Canje.Estado cambia a "Completado"                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. CONFIRMAR: Puntos se descuentan definitivamente             │
│    (Ya estaban reservados, ahora es permanente)                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. ACTUALIZAR: Rollup "Puntos Canjeados" en Lealtad            │
│    (Automático por la relación)                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. SINCRONIZAR: Nuevo balance en Supabase                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. NOTIFICAR: "Tu [servicio] fue completado. ¡Gracias!"        │
└─────────────────────────────────────────────────────────────────┘
```

### 6.5 Flujo: Cancelar Canje

**Trigger:** Estado cambia a "Cancelado" (por cliente o por Manny)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. TRIGGER: Canje.Estado cambia a "Cancelado"                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. EVALUAR: ¿Se devuelven puntos?                              │
│    • Si fue por cliente o por Manny → SÍ                       │
│    • Si fue No-show → Evaluar caso a caso                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. DEVOLVER: Puntos reservados regresan a disponibles          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. SINCRONIZAR: Actualizar Supabase                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. NOTIFICAR: "Tu canje fue cancelado. Tus puntos fueron       │
│    devueltos a tu cuenta."                                     │
└─────────────────────────────────────────────────────────────────┘
```

### 6.6 Flujo: Verificación de Expiración (Diario)

**Trigger:** Cron job diario (ej: 6:00 AM) en Edge Function

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. TRIGGER: Ejecución programada diaria                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. CONSULTAR: Todos los registros de Lealtad activos           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. PARA CADA registro:                                         │
│    • Calcular días desde última actividad                      │
│    • Si > 335 días (30 días antes) → Notificar aviso           │
│    • Si > 365 días → Expirar puntos                            │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
    335-364 días         > 365 días           < 335 días
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ NOTIFICAR:      │  │ EXPIRAR:        │  │ IGNORAR:        │
│ "Tus puntos     │  │ Puntos = 0      │  │ Sin acción      │
│ expiran en X    │  │ Estado=Expirado │  │                 │
│ días"           │  │ Notificar       │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### 6.7 Flujo: Sincronización de Catálogo

**Trigger:** Cambio en base Catálogo de Notion (detectado por Cron)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. TRIGGER: Cron Job detecta cambio en base "Catálogo"         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. OBTENER: Todos los servicios con Activo = true              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. SINCRONIZAR: Actualizar tabla de servicios en Supabase      │
│    (La app verá los cambios inmediatamente)                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Catálogo de Servicios Canjeables

### Servicios Propuestos

| Servicio | Puntos | Categoría | Solo VIP | Descripción |
|----------|--------|-----------|----------|-------------|
| **Revisión de Sistema** | 300 | Diagnóstico | No | Inspección visual y reporte de estado de tu sistema solar |
| **Limpieza de Paneles** | 500 | Mantenimiento | No | Limpieza profesional de módulos fotovoltaicos |
| **Diagnóstico Eléctrico** | 750 | Diagnóstico | No | Revisión completa del sistema eléctrico y conexiones |
| **Mantenimiento Preventivo** | 1,000 | Mantenimiento | No | Limpieza + revisión + ajustes menores incluidos |
| **Revisión de Inversor** | 800 | Diagnóstico | No | Diagnóstico del inversor y configuración |
| **Optimización de Sistema** | 1,500 | Premium | Sí | Análisis y ajustes para maximizar generación |
| **Consulta Técnica Premium** | 400 | Premium | Sí | Sesión personalizada con ingeniero senior |
| **Mantenimiento Anual Completo** | 2,000 | Premium | Sí | Paquete completo de mantenimiento anual |

### Equivalencias de Referencia

Para que el cliente entienda el valor:

| Servicio de Ejemplo | Costo Normal | Puntos para Canjear | Tickets Necesarios* |
|---------------------|--------------|---------------------|---------------------|
| Limpieza de Paneles | ~$1,500 | 500 puntos | $10,000 en tickets |
| Mantenimiento Preventivo | ~$3,000 | 1,000 puntos | $20,000 en tickets |
| Mantenimiento Anual | ~$5,000 | 2,000 puntos | $40,000 en tickets |

*A una tasa del 5%, se necesita gastar X pesos para acumular los puntos necesarios.

### Administración del Catálogo

El catálogo se administra directamente en Notion. Para agregar un servicio nuevo:

1. Ir a la base "Catálogo" en la Bóveda
2. Crear nuevo registro
3. Llenar todos los campos (nombre, puntos, descripción, etc.)
4. Marcar "Activo" = ✓
5. Edge Function sincroniza automáticamente a Supabase
6. El servicio aparece en la app

Para desactivar un servicio:
1. Desmarcar "Activo" = ☐
2. El servicio desaparece de la app
3. Canjes pendientes de ese servicio NO se afectan

---

## 8. Sistema de Notificaciones

### Eventos y Mensajes

| Evento | Mensaje | Canal |
|--------|---------|-------|
| **Ganó puntos** | "¡Ganaste {X} puntos! Tu nuevo balance es {Y} puntos." | Push + In-app |
| **Canje solicitado** | "Tu solicitud de {servicio} fue recibida. Te contactaremos pronto para agendar." | Push + In-app |
| **Canje programado** | "Tu {servicio} está agendado para el {fecha}. Te esperamos." | Push + In-app |
| **Canje completado** | "Tu {servicio} fue completado. ¡Gracias por tu preferencia!" | Push + In-app |
| **Canje cancelado** | "Tu canje fue cancelado. Tus {X} puntos fueron devueltos a tu cuenta." | Push + In-app |
| **Subió a VIP** | "¡Felicidades! Ahora eres cliente VIP. Disfruta de beneficios exclusivos." | Push + In-app |
| **Puntos por expirar** | "Tienes {X} puntos que expirarán en {Y} días. ¡Canjéalos antes!" | Push + In-app |
| **Puntos expiraron** | "Tus puntos expiraron por inactividad. ¡Vuelve pronto!" | Push + In-app |

### Configuración Técnica

| Parámetro | Valor Recomendado |
|-----------|-------------------|
| Servicio de Push | Firebase Cloud Messaging (FCM) |
| Hora de notificaciones batch | 10:00 AM (no molestar temprano) |
| Frecuencia de recordatorios | Máximo 1 por semana |
| Opt-out | El usuario puede desactivar en app |

---

## 9. Experiencia del Cliente (App)

### Pantallas Principales

#### 9.1 Home / Dashboard

```
┌─────────────────────────────────────────┐
│  👋 Hola, [Nombre]                      │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │     ⭐ 1,250 PUNTOS             │   │
│  │     Nivel: VIP                  │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ────────────────────────────────────   │
│                                         │
│  📊 Tu Actividad                        │
│  • Último servicio: 15 Nov 2025        │
│  • Puntos este mes: +150               │
│  • Canjes pendientes: 1                │
│                                         │
│  ────────────────────────────────────   │
│                                         │
│  🎁 Canjea tus puntos                   │
│  [Ver catálogo →]                       │
│                                         │
└─────────────────────────────────────────┘
```

#### 9.2 Catálogo de Canjes

```
┌─────────────────────────────────────────┐
│  ← Catálogo                             │
│                                         │
│  Tu balance: 1,250 puntos               │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 🧹 Limpieza de Paneles          │   │
│  │ 500 puntos                      │   │
│  │ [Canjear]                       │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 🔧 Mantenimiento Preventivo     │   │
│  │ 1,000 puntos                    │   │
│  │ [Canjear]                       │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ ⭐ Optimización de Sistema      │   │
│  │ 1,500 puntos  [VIP]             │   │
│  │ [Canjear]                       │   │
│  └─────────────────────────────────┘   │
│                                         │
│  (Servicios con más puntos que el      │
│   balance aparecen deshabilitados)     │
│                                         │
└─────────────────────────────────────────┘
```

#### 9.3 Historial

```
┌─────────────────────────────────────────┐
│  ← Historial                            │
│                                         │
│  📅 Noviembre 2025                      │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ +50 puntos                      │   │
│  │ Ticket #1234 - 28 Nov           │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ -500 puntos                     │   │
│  │ Canje: Limpieza - 15 Nov        │   │
│  │ Estado: ✅ Completado           │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ +100 puntos                     │   │
│  │ Ticket #1198 - 10 Nov           │   │
│  └─────────────────────────────────┘   │
│                                         │
│  📅 Octubre 2025                        │
│  ...                                    │
│                                         │
└─────────────────────────────────────────┘
```

#### 9.4 Mis Canjes

```
┌─────────────────────────────────────────┐
│  ← Mis Canjes                           │
│                                         │
│  🕐 Pendientes                          │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 🔧 Diagnóstico Eléctrico        │   │
│  │ Estado: Programado              │   │
│  │ Fecha: 5 Dic 2025, 10:00 AM     │   │
│  │                                 │   │
│  │ [Cancelar canje]                │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ────────────────────────────────────   │
│                                         │
│  ✅ Completados                         │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 🧹 Limpieza de Paneles          │   │
│  │ Completado: 15 Nov 2025         │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### Flujo de Canje en App

```
[Selecciona servicio]
        │
        ▼
[Pantalla de confirmación]
"¿Canjear Limpieza de Paneles por 500 puntos?"
[Confirmar] [Cancelar]
        │
        ▼ (si confirma)
[Validación...]
        │
        ├─── SI OK ───▶ "¡Listo! Nos pondremos en contacto 
        │                 para agendar tu servicio."
        │
        └─── SI ERROR ─▶ "No tienes puntos suficientes" 
                          o "Alcanzaste el límite de canjes"
```

---

## 10. Operación del Equipo

### 10.1 Roles y Responsabilidades

| Rol | Responsabilidades en Manny |
|-----|---------------------------|
| **Administrador** | Alta de clientes en programa, promoción a VIP, gestión de catálogo, resolución de conflictos |
| **Coordinador** | Contactar clientes con canjes pendientes, programar fechas, asignar técnicos |
| **Técnico** | Ejecutar servicios canjeados, marcar como completado |

### 10.2 Procesos Operativos

#### Proceso: Nuevo Cliente en el Programa

```
1. Cliente paga primer ticket
2. Edge Function detecta que no tiene registro en Lealtad
3. Crea registro automático (Nivel = Partner)
4. Cliente recibe notificación de bienvenida
5. Cliente puede descargar app y ver sus puntos
```

#### Proceso: Gestión Diaria de Canjes

**Por la mañana (Coordinador):**

1. Abrir vista "📋 Pendientes" en base Canjes
2. Revisar si hay VIPs (prioridad)
3. Contactar a cada cliente para agendar
4. Actualizar estado a "Programado" + Fecha + Técnico

**Durante el día (Técnico):**

1. Abrir vista "📍 Hoy" en base Canjes
2. Ejecutar servicios según agenda
3. Al terminar: marcar "Completado"

**Fin de día:**

1. Verificar que todos los de hoy estén completados o con nota
2. Revisar pendientes para mañana

#### Proceso: Promoción a VIP

```
1. Identificar cliente candidato (historial, volumen, relación)
2. Decisión de equipo (reunión semanal)
3. Cambiar Nivel a "VIP" en base Lealtad
4. Edge Function detecta cambio y notifica al cliente
5. Opcionalmente: llamada/mensaje personal de felicitación
```

### 10.3 Checklist de Capacitación para Equipo

- [ ] Entender qué es el programa Manny y sus beneficios
- [ ] Conocer los niveles (Partner y VIP)
- [ ] Saber cómo se acumulan puntos (5% del ticket pagado)
- [ ] Saber usar la vista "Pendientes" en Canjes
- [ ] Saber actualizar estado de canje a "Programado"
- [ ] Saber marcar canje como "Completado"
- [ ] Saber cuándo y cómo cancelar un canje
- [ ] Conocer el catálogo de servicios canjeables
- [ ] Saber cómo escalar una duda o problema

---

## 11. Métricas y KPIs

### Métricas de Programa

| Métrica | Fórmula | Meta | Frecuencia |
|---------|---------|------|------------|
| **Puntos Emitidos** | Suma de puntos de tickets del periodo | - | Mensual |
| **Puntos Canjeados** | Suma de puntos de canjes completados | - | Mensual |
| **Tasa de Canje** | Canjeados / Emitidos × 100 | >30% | Mensual |
| **Clientes Activos** | Con ticket en últimos 90 días | - | Mensual |
| **% Penetración** | Clientes en programa / Total clientes | >80% | Mensual |
| **Canjes Completados** | Conteo de canjes con estado Completado | - | Mensual |
| **Tiempo Promedio de Canje** | Promedio de días entre solicitud y completado | <7 días | Mensual |

### Métricas de Servicio

| Métrica | Fórmula | Meta |
|---------|---------|------|
| **Servicio más canjeado** | Servicio con más canjes | - |
| **Tasa de cancelación** | Cancelados / Total solicitudes | <10% |
| **NPS de canjes** | Encuesta post-servicio | >8 |

### Dashboard Sugerido (Vista en Notion)

Crear una página de dashboard con:

1. **Tarjetas de resumen:**
   - Total clientes en programa
   - Puntos emitidos este mes
   - Canjes completados este mes

2. **Gráfica de evolución:**
   - Puntos emitidos vs canjeados por mes

3. **Top 5:**
   - Clientes con más puntos
   - Servicios más canjeados

---

## 12. Seguridad y Control

### 12.1 Principios de Seguridad

| Principio | Implementación |
|-----------|----------------|
| **Mínimo privilegio** | Equipo no puede editar puntos directamente |
| **Auditoría** | Todo cambio queda registrado en historial |
| **Validación** | App valida antes de permitir canje |
| **Segregación** | Datos sensibles en Bóveda, separados del workspace |

### 12.2 Controles Implementados

| Riesgo | Control |
|--------|---------|
| Modificación manual de puntos | Puntos son Rollups/Fórmulas, no editables |
| Canje fraudulento | Validación en app: puntos >= costo |
| Duplicación de canjes | ID único por canje, validación en Supabase |
| Suplantación de identidad | Autenticación en app (teléfono/email) |

### 12.3 Quién Puede Hacer Qué

| Acción | Admin | Coordinador | Técnico | Edge Function (Sistema) |
|--------|-------|-------------|---------|---------------|
| Ver todos los miembros | ✓ | ✓ | ✓ | ✓ |
| Cambiar nivel a VIP | ✓ | ✗ | ✗ | ✗ |
| Editar puntos | ✗ | ✗ | ✗ | ✓ (automático) |
| Ver canjes pendientes | ✓ | ✓ | ✓ | ✓ |
| Programar canje | ✓ | ✓ | ✗ | ✗ |
| Completar canje | ✓ | ✓ | ✓ | ✗ |
| Cancelar canje | ✓ | ✓ | ✗ | ✗ |
| Editar catálogo | ✓ | ✗ | ✗ | ✗ |

### 12.4 Respaldo y Recuperación

| Elemento | Estrategia |
|----------|------------|
| Notion | Respaldo automático de Notion + exports semanales |
| Supabase | Backups diarios automáticos |
| Edge Functions | Código versionado en Git |

---

## 13. Guía de Implementación

### Fase 1: Configuración de Notion (Semana 1)

#### Día 1-2: Crear Base "Lealtad"

1. Ir a Bóveda de Datos
2. Crear nueva base de datos "Lealtad"
3. Agregar campos según especificación (sección 4.2)
4. Crear relación con Contactos
5. Configurar vistas

**Verificación:** ✓ Base creada con todos los campos

#### Día 3: Crear Base "Catálogo"

1. En Bóveda de Datos, crear base "Catálogo"
2. Agregar campos según especificación (sección 4.3)
3. Cargar servicios iniciales (sección 7)
4. Marcar como Activos los que estarán disponibles

**Verificación:** ✓ Catálogo con al menos 5 servicios activos

#### Día 4-5: Crear Base "Canjes"

1. En Workspace, crear base "Canjes"
2. Agregar campos según especificación (sección 4.5)
3. Crear relación con Lealtad
4. Crear relación con Catálogo
5. Configurar todas las vistas

**Verificación:** ✓ Base lista con vistas operativas

#### Día 5: Actualizar Base "Tickets"

1. Agregar campo "Puntos Generados" (fórmula)
2. Verificar que existe relación con Contactos

**Verificación:** ✓ Tickets calculan puntos automáticamente

### Fase 2: Configuración de Supabase (Semana 2)

#### Día 1-2: Estructura de Tablas

Crear tablas espejo de Notion:

```sql
-- Tabla de miembros
CREATE TABLE members (
  id UUID PRIMARY KEY,
  notion_id TEXT UNIQUE,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  level TEXT DEFAULT 'Partner',
  points_earned INTEGER DEFAULT 0,
  points_redeemed INTEGER DEFAULT 0,
  points_available INTEGER GENERATED ALWAYS AS (points_earned - points_redeemed) STORED,
  last_activity DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de catálogo
CREATE TABLE services (
  id UUID PRIMARY KEY,
  notion_id TEXT UNIQUE,
  name TEXT,
  points INTEGER,
  description TEXT,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  vip_only BOOLEAN DEFAULT false,
  display_order INTEGER,
  image_url TEXT
);

-- Tabla de canjes
CREATE TABLE redemptions (
  id UUID PRIMARY KEY,
  notion_id TEXT UNIQUE,
  member_id UUID REFERENCES members(id),
  service_id UUID REFERENCES services(id),
  points INTEGER,
  status TEXT DEFAULT 'pending',
  requested_at TIMESTAMP DEFAULT NOW(),
  scheduled_at TIMESTAMP,
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  cancellation_reason TEXT
);

-- Tabla de transacciones (historial)
CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  member_id UUID REFERENCES members(id),
  type TEXT, -- 'earn' | 'redeem' | 'expire' | 'refund'
  points INTEGER,
  description TEXT,
  reference_id TEXT, -- ID del ticket o canje
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Verificación:** ✓ Tablas creadas y relacionadas

#### Día 3: Autenticación

1. Configurar auth con teléfono (SMS OTP)
2. Vincular usuarios con tabla members

**Verificación:** ✓ Usuario puede registrarse/iniciar sesión

#### Día 4-5: Row Level Security (RLS)

```sql
-- El usuario solo ve sus propios datos
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data" ON members
  FOR SELECT USING (auth.uid() = id);

-- Similar para redemptions y transactions
```

**Verificación:** ✓ Usuario solo ve su información

### Fase 3: Desarrollo Edge Functions (Semana 3)

#### Funciones a Crear

1. **Acumulación de Puntos**
   - Trigger: Cron Job (consulta Notion)
   - Acciones: Calcular puntos, actualizar Lealtad, sync Supabase, notificar

2. **Nuevo Canje (desde App)**
   - Trigger: Webhook de Supabase (nuevo registro)
   - Acciones: Crear en Notion, reservar puntos, notificar

3. **Actualización de Canje**
   - Trigger: Cron Job (consulta Notion)
   - Acciones: Sync a Supabase, notificar cliente

4. **Sincronización de Catálogo**
   - Trigger: Cron Job (consulta Notion)
   - Acciones: Actualizar Supabase

5. **Verificación de Expiración**
   - Trigger: Cron diario 6:00 AM
   - Acciones: Revisar fechas, notificar/expirar según corresponda

**Verificación:** ✓ Todas las funciones desplegadas y probadas

### Fase 4: Desarrollo App (Semana 4-6)

#### Usando Manny App (proyecto existente)

1. Configurar conexión a Supabase
2. Implementar autenticación
3. Desarrollar pantallas (sección 9)
4. Implementar lógica de canje
5. Integrar notificaciones push (FCM)
6. Testing interno

**Verificación:** ✓ App funcional en dispositivos de prueba

### Fase 5: Piloto (Semana 7-8)

#### Semana 7: Carga Inicial

1. Seleccionar 10-20 clientes para piloto
2. Crear registros en Lealtad
3. Calcular puntos históricos (últimos 6 meses)
4. Invitar a descargar app
5. Monitorear uso

#### Semana 8: Ajustes

1. Recopilar feedback
2. Corregir bugs encontrados
3. Ajustar UX según comentarios
4. Preparar lanzamiento masivo

**Verificación:** ✓ Piloto exitoso sin bugs críticos

### Fase 6: Lanzamiento (Semana 9+)

1. Migración de todos los clientes existentes
2. Comunicación masiva (email, WhatsApp)
3. Capacitación final del equipo
4. Monitoreo intensivo primera semana
5. Iteración continua

---

## 14. Glosario

| Término | Definición |
|---------|------------|
| **Puntos** | Unidad de valor acumulada por el cliente. 1 punto ≈ $0.05 del gasto original |
| **Canje** | Acción de usar puntos para obtener un servicio gratuito |
| **Nivel** | Categoría del cliente en el programa (Partner o VIP) |
| **Catálogo** | Lista de servicios disponibles para canjear |
| **Rollup** | Campo de Notion que calcula valores desde registros relacionados |
| **Webhook** | Mecanismo para que un sistema notifique a otro cuando algo sucede |
| **Supabase** | Plataforma de base de datos en tiempo real (backend de la app) |
| **Edge Functions** | Código que se ejecuta en la nube de Supabase para conectar sistemas |
| **Bóveda** | Área privada de Notion con datos sensibles |
| **Push notification** | Mensaje que aparece en el teléfono aunque la app esté cerrada |
| **FCM** | Firebase Cloud Messaging, servicio de Google para enviar notificaciones |
| **RLS** | Row Level Security, control de acceso a nivel de registro en Supabase |

---

## Anexos

### A. IDs de Referencia en Notion

| Recurso | ID |
|---------|-----|
| Bóveda de Datos | `1c4c6cfd-8c1e-8098-b074-d7d44c719dbc` |
| Base Contactos | `17ac6cfd-8c1e-8068-8bc0-d32488189164` |
| Base Tickets | `17ac6cfd-8c1e-8162-b724-d4047a7e7635` |
| Proyecto Manny | `227c6cfd-8c1e-802b-b620-e08295d9fda9` |

### B. Ejemplo de Cálculo de Puntos

```
Cliente: María García
Ticket: Instalación de sistema solar
Monto: $85,000 MXN
Estado: Pagado

Cálculo:
Puntos = $85,000 × 0.05 = 4,250 puntos

María ahora tiene 4,250 puntos.
Puede canjear:
- 8× Limpieza de Paneles (500 pts c/u) o
- 4× Mantenimiento Preventivo (1,000 pts c/u) o
- 2× Mantenimiento Anual (2,000 pts c/u)
```

### C. Ejemplo de Flujo Completo

```
DÍA 1
09:00 - María paga ticket de $10,000
09:01 - Edge Function detecta pago
09:01 - Calcula 500 puntos
09:01 - Actualiza Lealtad en Notion
09:02 - Sincroniza a Supabase
09:02 - María recibe push: "¡Ganaste 500 puntos!"

DÍA 2
14:00 - María abre app, ve 500 puntos
14:05 - María solicita canje "Limpieza de Paneles" (500 pts)
14:05 - App valida: 500 >= 500 ✓
14:05 - Crea registro en Supabase
14:05 - Webhook a Edge Function
14:06 - Edge Function crea canje en Notion (estado: Pendiente)
14:06 - María recibe: "Solicitud recibida"

DÍA 3
10:00 - Coordinador ve canje pendiente
10:30 - Llama a María, acuerdan fecha: 7 de diciembre
10:35 - Actualiza canje: Programado, Fecha: 7 dic, Técnico: Juan
10:35 - Edge Function detecta cambio
10:36 - Sincroniza a Supabase
10:36 - María recibe: "Tu limpieza está agendada para el 7 de diciembre"

DÍA 7
11:00 - Juan llega a casa de María
12:00 - Juan termina limpieza
12:05 - Juan marca canje como "Completado" en Notion
12:05 - Edge Function detecta cambio
12:06 - Confirma descuento de 500 puntos
12:06 - Sincroniza a Supabase
12:06 - María recibe: "Tu limpieza fue completada. ¡Gracias!"
12:06 - María abre app, ve 0 puntos disponibles
```

---

**Documento preparado por:** Claude (Asistente de IA)
**Refinado por:** Antigravity
**Para:** Manny
**Versión:** 1.1
**Última actualización:** Diciembre 2025

---

*Este documento es la guía maestra del Sistema Manny. Cualquier cambio al sistema debe reflejarse aquí para mantener la documentación actualizada.*
