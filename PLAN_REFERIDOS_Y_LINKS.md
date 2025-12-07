# Plan: Sistema de Referidos y Links de Regalo

## Resumen Ejecutivo

Se implementarán dos sistemas complementarios:
1. **Sistema de Referidos**: Permite a clientes existentes invitar amigos y ganar puntos cuando estos se registran y usan servicios
2. **Links de Regalo**: Permite al admin crear links únicos que otorgan beneficios automáticamente al abrirlos

---

## SISTEMA 1: Programa de Referidos

### Mejores Prácticas del Mercado (Fuentes)
- [Viral Loops - Best Practices 2025](https://viral-loops.com/blog/referral-program-best-practices-in-2025/)
- [Referral Rock - Mobile Examples](https://referralrock.com/blog/mobile-referral-program-examples/)
- [Shopify - Proven Ideas](https://www.shopify.com/blog/referral-program-ideas)

**Principios clave identificados:**
1. **Incentivo doble**: Premiar tanto al referidor como al referido
2. **Límites claros**: Tope máximo de puntos para evitar abuso
3. **Condición de activación**: El referido debe completar una acción (primer servicio)
4. **Gamificación**: Mostrar progreso visual
5. **Facilidad de compartir**: Un solo tap para enviar link por WhatsApp

### Diseño Propuesto

#### Reglas del Programa
| Concepto | Valor Sugerido |
|----------|---------------|
| Puntos para el referidor | 100 pts |
| Puntos para el referido | 50 pts |
| Condición de activación | Primer servicio completado del referido |
| Límite mensual por cliente | 500 pts (5 referidos activos) |
| Límite total por cliente | 2,000 pts (20 referidos totales) |

#### Flujo del Usuario

```
┌─────────────────────────────────────────────────────────────┐
│  DASHBOARD DEL CLIENTE                                       │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  🎁 Invita amigos y gana puntos                         │ │
│  │  ───────────────────────────────────────────────────    │ │
│  │  Comparte tu link y gana 100 pts por cada amigo         │ │
│  │  que use los servicios de Manny                         │ │
│  │                                                          │ │
│  │  Tu link: manny.app/r/ABC123                            │ │
│  │                                                          │ │
│  │  [📱 Compartir por WhatsApp]  [📋 Copiar link]          │ │
│  │                                                          │ │
│  │  ── Tu progreso ──────────────────────────────          │ │
│  │  Referidos activos: 3 de 5 este mes                     │ │
│  │  ████████████░░░░░░░░  300/500 pts ganados              │ │
│  │                                                          │ │
│  │  👥 Tus referidos:                                      │ │
│  │  • Juan M. - Activo (100 pts ganados)                   │ │
│  │  • María L. - Pendiente (esperando primer servicio)     │ │
│  │  • Pedro S. - Activo (100 pts ganados)                  │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### Flujo del Referido (Nuevo Cliente)

```
1. Recibe link por WhatsApp: manny.app/r/ABC123
2. Abre el link → Landing page especial
   ┌─────────────────────────────────────────┐
   │  🎉 ¡Tu amigo Juan te invitó!           │
   │                                          │
   │  Únete a Manny Rewards y recibe         │
   │  50 puntos de bienvenida después        │
   │  de tu primer servicio                  │
   │                                          │
   │  [Registrarme con mi teléfono]          │
   └─────────────────────────────────────────┘
3. Se registra con teléfono
4. Sistema guarda referral_code en su perfil
5. Cuando completa primer servicio:
   - Referido recibe 50 pts automáticamente
   - Referidor recibe 100 pts automáticamente
   - Ambos reciben notificación
```

### Modelo de Datos

```sql
-- Nueva tabla: códigos de referido
CREATE TABLE codigos_referido (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  codigo VARCHAR(8) UNIQUE NOT NULL,  -- Ej: "ABC123"
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Nueva tabla: referidos
CREATE TABLE referidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referidor_id UUID NOT NULL REFERENCES clientes(id),
  referido_id UUID NOT NULL REFERENCES clientes(id),
  codigo_usado VARCHAR(8) NOT NULL,
  estado VARCHAR(20) DEFAULT 'pendiente', -- 'pendiente', 'activo', 'expirado'
  puntos_referidor INTEGER DEFAULT 0,
  puntos_referido INTEGER DEFAULT 0,
  fecha_activacion TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(referido_id)  -- Un cliente solo puede ser referido una vez
);

-- Nueva tabla: configuración del programa
CREATE TABLE config_referidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activo BOOLEAN DEFAULT true,
  puntos_referidor INTEGER DEFAULT 100,
  puntos_referido INTEGER DEFAULT 50,
  limite_mensual INTEGER DEFAULT 500,
  limite_total INTEGER DEFAULT 2000,
  dias_expiracion INTEGER DEFAULT 30,  -- Días para que referido haga primer servicio
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Agregar campo a clientes
ALTER TABLE clientes ADD COLUMN referido_por UUID REFERENCES clientes(id);
```

### Componentes Frontend

1. **ReferralCard.jsx** - Tarjeta en dashboard del cliente
2. **ReferralLanding.jsx** - Página para nuevos referidos
3. **ReferralProgress.jsx** - Barra de progreso y lista de referidos
4. **AdminReferidos.jsx** - Panel admin para ver estadísticas

### API Endpoints

```javascript
// services/api/referrals.js
- getOrCreateReferralCode(clienteId)  // Genera código único
- getReferralStats(clienteId)          // Stats del referidor
- applyReferralCode(telefono, codigo)  // Al registrarse con código
- activateReferral(referidoId)         // Cuando completa primer servicio
- getAdminReferralStats()              // Stats globales para admin
```

---

## SISTEMA 2: Links de Regalo

### Mejores Prácticas (Fuentes)
- [Voucherify - Loyalty UX](https://www.voucherify.io/blog/loyalty-programs-ux-and-ui-best-practices)
- [Buybox - Gift Card UX](https://www.buybox.net/en/blog/ux-gift-card-maximize-conversions)

**Principios clave:**
1. **Experiencia "wow"**: Animación de regalo al abrir
2. **Sin fricción**: No requiere login para ver el regalo
3. **Seguridad**: Link de un solo uso
4. **Trazabilidad**: El admin sabe quién abrió qué

### Diseño Propuesto

#### Panel Admin - Crear Link de Regalo

```
┌─────────────────────────────────────────────────────────────┐
│  🎁 Crear Link de Regalo                                     │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  Tipo de regalo:                                             │
│  ○ Servicio/Beneficio personalizado                         │
│  ○ Puntos de bonificación                                   │
│                                                              │
│  Para quién: (opcional)                                      │
│  [Buscar cliente existente...         ] o dejar en blanco   │
│                                                              │
│  Nombre del beneficio:                                       │
│  [Mantenimiento de Jardín Gratis      ]                     │
│                                                              │
│  Descripción:                                                │
│  [Incluye poda, limpieza y fertilización]                   │
│                                                              │
│  Mensaje personalizado:                                      │
│  [¡Gracias por tu preferencia! Aquí tienes un regalo...]   │
│                                                              │
│  Expira en: [7 días ▼]                                      │
│                                                              │
│  [Vista previa]   [Generar Link 🔗]                         │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│  Links creados recientemente:                                │
│  • manny.app/g/XYZ789 - Lavado Premium (Pendiente)          │
│  • manny.app/g/DEF456 - 200 pts extra (Canjeado por María)  │
│  • manny.app/g/GHI123 - Afinación Gratis (Expirado)         │
└─────────────────────────────────────────────────────────────┘
```

#### Experiencia del Receptor

```
Paso 1: Abre link manny.app/g/XYZ789
        ↓
┌─────────────────────────────────────────┐
│                                          │
│         🎁 ← (animación de regalo)       │
│                                          │
│    ¡Tienes un regalo de Manny!          │
│                                          │
│    [Abrir regalo]                        │
│                                          │
└─────────────────────────────────────────┘
        ↓ (click)
┌─────────────────────────────────────────┐
│                                          │
│  ✨ ¡Felicidades! ✨                    │
│                                          │
│  Mantenimiento de Jardín Gratis         │
│  ─────────────────────────────          │
│  Incluye poda, limpieza y fertilización │
│                                          │
│  "¡Gracias por tu preferencia!          │
│   Aquí tienes un regalo especial"       │
│                        - Equipo Manny   │
│                                          │
│  ─────────────────────────────          │
│  Para reclamar tu regalo:               │
│                                          │
│  [📱 Ingresa tu teléfono: __________]   │
│                                          │
│  [Reclamar mi regalo]                   │
│                                          │
│  (Si ya eres cliente, el beneficio      │
│   aparecerá en tu dashboard)            │
│                                          │
└─────────────────────────────────────────┘
        ↓
Si es cliente existente:
  → Servicio se agrega a servicios_asignados
  → Redirige a dashboard con confetti

Si es nuevo:
  → Crea cliente con has_pin=false
  → Agrega servicio a servicios_asignados
  → Redirige a onboarding
```

### Modelo de Datos

```sql
-- Nueva tabla: links de regalo
CREATE TABLE links_regalo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(12) UNIQUE NOT NULL,  -- Ej: "XYZ789ABC"
  tipo VARCHAR(20) NOT NULL,  -- 'servicio', 'puntos'

  -- Para regalos de servicio
  nombre_beneficio TEXT,
  descripcion_beneficio TEXT,

  -- Para regalos de puntos
  puntos_regalo INTEGER,

  -- Común
  mensaje_personalizado TEXT,
  creado_por UUID REFERENCES clientes(id),  -- Admin que lo creó
  destinatario_id UUID REFERENCES clientes(id),  -- Opcional: cliente específico

  -- Estado
  estado VARCHAR(20) DEFAULT 'pendiente',  -- 'pendiente', 'canjeado', 'expirado'
  canjeado_por UUID REFERENCES clientes(id),
  fecha_canje TIMESTAMPTZ,
  fecha_expiracion TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Componentes Frontend

1. **GiftLinkCreator.jsx** - Formulario admin para crear links
2. **GiftLinkList.jsx** - Lista de links creados con estado
3. **GiftLanding.jsx** - Página pública del regalo (animación)
4. **GiftClaim.jsx** - Formulario para reclamar con teléfono

### API Endpoints

```javascript
// services/api/gifts.js
- createGiftLink(data)           // Admin crea link
- getGiftByCode(codigo)          // Info pública del regalo
- claimGift(codigo, telefono)    // Reclamar regalo
- getAdminGiftLinks()            // Lista para admin
- expireOldGifts()               // Cron job
```

---

## Arquitectura Técnica

### Rutas Nuevas

```jsx
// App.jsx - Rutas públicas (sin auth)
<Route path="/r/:codigo" element={<ReferralLanding />} />
<Route path="/g/:codigo" element={<GiftLanding />} />

// Rutas protegidas
<Route path="/mis-referidos" element={<ProtectedRoute><MisReferidos /></ProtectedRoute>} />

// Rutas admin
<Route path="/admin/referidos" element={<ProtectedRoute adminOnly><AdminReferidos /></ProtectedRoute>} />
<Route path="/admin/regalos" element={<ProtectedRoute adminOnly><AdminRegalos /></ProtectedRoute>} />
```

### Generación de Códigos

```javascript
// Códigos cortos y legibles (sin caracteres confusos)
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  // Sin O, 0, I, 1, L

function generateCode(length = 6) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}
```

### Trigger para Activar Referidos

```sql
-- Cuando se registra un servicio, verificar si es primer servicio de un referido
CREATE OR REPLACE FUNCTION activar_referido_primer_servicio()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar si el cliente tiene referido pendiente
  UPDATE referidos
  SET
    estado = 'activo',
    fecha_activacion = now(),
    puntos_referidor = (SELECT puntos_referidor FROM config_referidos WHERE activo = true),
    puntos_referido = (SELECT puntos_referido FROM config_referidos WHERE activo = true)
  WHERE
    referido_id = NEW.cliente_id
    AND estado = 'pendiente';

  -- Si se activó, dar puntos a ambos
  IF FOUND THEN
    -- Dar puntos al referidor
    PERFORM asignar_puntos_atomico(
      (SELECT telefono FROM clientes WHERE id = (SELECT referidor_id FROM referidos WHERE referido_id = NEW.cliente_id)),
      (SELECT puntos_referidor FROM config_referidos WHERE activo = true),
      'Referido activado: ' || (SELECT nombre FROM clientes WHERE id = NEW.cliente_id)
    );

    -- Dar puntos al referido
    PERFORM asignar_puntos_atomico(
      (SELECT telefono FROM clientes WHERE id = NEW.cliente_id),
      (SELECT puntos_referido FROM config_referidos WHERE activo = true),
      'Bono de bienvenida por referido'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_activar_referido
AFTER INSERT ON historial_servicios
FOR EACH ROW
EXECUTE FUNCTION activar_referido_primer_servicio();
```

---

## Plan de Implementación

### Fase 1: Base de Datos (1 migración)
- [ ] Crear tablas: codigos_referido, referidos, config_referidos, links_regalo
- [ ] Agregar campo referido_por a clientes
- [ ] Crear funciones SQL y triggers

### Fase 2: Sistema de Referidos
- [ ] API: referrals.js con todas las funciones
- [ ] ReferralCard.jsx en Dashboard
- [ ] ReferralLanding.jsx (ruta pública /r/:codigo)
- [ ] Integrar con flujo de registro existente
- [ ] AdminReferidos.jsx con stats

### Fase 3: Sistema de Links de Regalo
- [ ] API: gifts.js con todas las funciones
- [ ] GiftLinkCreator.jsx para admin
- [ ] GiftLanding.jsx con animación (ruta pública /g/:codigo)
- [ ] GiftClaim.jsx para reclamar
- [ ] Integrar con servicios_asignados existente

### Fase 4: Pulido
- [ ] Animaciones y transiciones
- [ ] Notificaciones push cuando se activa referido
- [ ] Emails/WhatsApp de confirmación
- [ ] Tests

---

## Decisiones de Diseño Importantes

### ¿Por qué códigos cortos alfanuméricos?
- Más fáciles de compartir verbalmente
- Menos errores de tipeo
- Se ven más "premium" que UUIDs largos

### ¿Por qué activar referido solo con primer servicio?
- Evita fraude (crear cuentas falsas solo por puntos)
- Alinea incentivos con el negocio real
- Práctica estándar en programas de referidos

### ¿Por qué el link de regalo no requiere login para ver?
- Reduce fricción
- El "wow moment" del regalo se da inmediatamente
- El login solo se pide para reclamar

### ¿Por qué límites mensuales y totales?
- Previene abuso del sistema
- Mantiene los costos bajo control
- Práctica recomendada por [Viral Loops](https://viral-loops.com/blog/referral-program-best-practices-in-2025/)

---

## Preguntas para el Usuario

1. **Valores de puntos**: ¿100 pts referidor / 50 pts referido están bien?
2. **Límites**: ¿500 pts/mes y 2000 pts total son apropiados?
3. **Expiración de referidos**: ¿30 días para que el referido haga su primer servicio?
4. **Links de regalo**: ¿Quieres poder dar puntos además de servicios?
5. **Notificaciones**: ¿WhatsApp automático cuando se activa un referido?
