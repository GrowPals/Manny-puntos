-- =====================================================
-- FUNCIONES RPC FALTANTES PARA MANNY REWARDS
-- Creado: 2025-12-09
-- =====================================================

-- Habilitar extension pgcrypto para bcrypt si no existe
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- ELIMINAR FUNCIONES EXISTENTES PRIMERO
-- =====================================================
DROP FUNCTION IF EXISTS public.check_cliente_exists(TEXT);
DROP FUNCTION IF EXISTS public.verify_client_pin_secure(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.register_client_pin_secure(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.reset_client_pin(UUID);
DROP FUNCTION IF EXISTS public.asignar_puntos_atomico(UUID, INTEGER, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.marcar_beneficio_usado(UUID);
DROP FUNCTION IF EXISTS public.aplicar_codigo_referido_v2(TEXT, UUID);
DROP FUNCTION IF EXISTS public.enqueue_sync_operation(TEXT, TEXT, UUID, JSONB);
DROP FUNCTION IF EXISTS public.log_audit_event(TEXT, JSONB, UUID);

-- =====================================================
-- 1. CHECK_CLIENTE_EXISTS
-- Verificar si un cliente existe y si tiene PIN
-- =====================================================
CREATE OR REPLACE FUNCTION public.check_cliente_exists(telefono_input TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente RECORD;
BEGIN
  SELECT id, nombre, telefono, puntos_actuales, es_admin, nivel,
         has_pin, pin_hash IS NOT NULL as tiene_pin
  INTO v_cliente
  FROM clientes
  WHERE telefono = telefono_input;

  IF v_cliente IS NULL THEN
    RETURN json_build_object(
      'exists', false,
      'has_pin', false
    );
  END IF;

  RETURN json_build_object(
    'exists', true,
    'has_pin', COALESCE(v_cliente.has_pin, v_cliente.tiene_pin, false),
    'cliente', json_build_object(
      'id', v_cliente.id,
      'nombre', v_cliente.nombre,
      'telefono', v_cliente.telefono,
      'puntos_actuales', v_cliente.puntos_actuales,
      'es_admin', v_cliente.es_admin,
      'nivel', v_cliente.nivel
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_cliente_exists(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_cliente_exists(TEXT) TO authenticated;

-- =====================================================
-- 2. VERIFY_CLIENT_PIN_SECURE
-- Verificar PIN con rate limiting
-- =====================================================
CREATE OR REPLACE FUNCTION public.verify_client_pin_secure(
  telefono_input TEXT,
  pin_input TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente RECORD;
  v_attempts INT;
  v_last_attempt TIMESTAMPTZ;
BEGIN
  -- Buscar cliente
  SELECT id, nombre, telefono, puntos_actuales, es_admin, nivel, pin_hash,
         COALESCE(login_attempts, 0) as login_attempts,
         last_login_attempt
  INTO v_cliente
  FROM clientes
  WHERE telefono = telefono_input;

  IF v_cliente IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Cliente no encontrado');
  END IF;

  IF v_cliente.pin_hash IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Cliente no tiene PIN registrado');
  END IF;

  -- Verificar rate limiting (5 intentos, bloqueo 5 minutos)
  IF v_cliente.login_attempts >= 5 AND v_cliente.last_login_attempt > NOW() - INTERVAL '5 minutes' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Demasiados intentos fallidos',
      'rate_limited', true
    );
  END IF;

  -- Verificar PIN con bcrypt
  IF v_cliente.pin_hash = crypt(pin_input, v_cliente.pin_hash) THEN
    -- Login exitoso - resetear intentos
    UPDATE clientes
    SET login_attempts = 0, last_login_attempt = NOW()
    WHERE id = v_cliente.id;

    RETURN json_build_object(
      'success', true,
      'cliente', json_build_object(
        'id', v_cliente.id,
        'nombre', v_cliente.nombre,
        'telefono', v_cliente.telefono,
        'puntos_actuales', v_cliente.puntos_actuales,
        'es_admin', v_cliente.es_admin,
        'nivel', v_cliente.nivel
      )
    );
  ELSE
    -- PIN incorrecto - incrementar intentos
    UPDATE clientes
    SET login_attempts = COALESCE(login_attempts, 0) + 1,
        last_login_attempt = NOW()
    WHERE id = v_cliente.id;

    RETURN json_build_object('success', false, 'error', 'PIN incorrecto');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_client_pin_secure(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_client_pin_secure(TEXT, TEXT) TO authenticated;

-- =====================================================
-- 3. REGISTER_CLIENT_PIN_SECURE
-- Registrar PIN con hash bcrypt
-- =====================================================
CREATE OR REPLACE FUNCTION public.register_client_pin_secure(
  telefono_input TEXT,
  pin_input TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente RECORD;
  v_pin_hash TEXT;
BEGIN
  -- Buscar cliente
  SELECT id, nombre, telefono, puntos_actuales, es_admin, nivel, pin_hash
  INTO v_cliente
  FROM clientes
  WHERE telefono = telefono_input;

  IF v_cliente IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Cliente no encontrado');
  END IF;

  IF v_cliente.pin_hash IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'El cliente ya tiene PIN registrado');
  END IF;

  -- Validar PIN (4-6 digitos)
  IF LENGTH(pin_input) < 4 OR LENGTH(pin_input) > 6 OR pin_input !~ '^[0-9]+$' THEN
    RETURN json_build_object('success', false, 'error', 'PIN debe ser de 4-6 digitos');
  END IF;

  -- Crear hash del PIN
  v_pin_hash := crypt(pin_input, gen_salt('bf'));

  -- Guardar PIN
  UPDATE clientes
  SET pin_hash = v_pin_hash,
      has_pin = true,
      updated_at = NOW()
  WHERE id = v_cliente.id;

  RETURN json_build_object(
    'success', true,
    'cliente', json_build_object(
      'id', v_cliente.id,
      'nombre', v_cliente.nombre,
      'telefono', v_cliente.telefono,
      'puntos_actuales', v_cliente.puntos_actuales,
      'es_admin', v_cliente.es_admin,
      'nivel', v_cliente.nivel
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_client_pin_secure(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.register_client_pin_secure(TEXT, TEXT) TO authenticated;

-- =====================================================
-- 4. RESET_CLIENT_PIN
-- Resetear PIN de un cliente (admin)
-- =====================================================
CREATE OR REPLACE FUNCTION public.reset_client_pin(cliente_id_input UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE clientes
  SET pin_hash = NULL,
      has_pin = false,
      login_attempts = 0,
      updated_at = NOW()
  WHERE id = cliente_id_input;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Cliente no encontrado');
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_client_pin(UUID) TO authenticated;

-- =====================================================
-- 5. ASIGNAR_PUNTOS_ATOMICO
-- Asignar puntos a un cliente de forma atomica
-- =====================================================
CREATE OR REPLACE FUNCTION public.asignar_puntos_atomico(
  p_cliente_id UUID,
  p_puntos INTEGER,
  p_descripcion TEXT DEFAULT 'Puntos asignados',
  p_tipo TEXT DEFAULT 'asignacion'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente RECORD;
  v_nuevos_puntos INTEGER;
BEGIN
  -- Obtener cliente con lock
  SELECT id, puntos_actuales INTO v_cliente
  FROM clientes
  WHERE id = p_cliente_id
  FOR UPDATE;

  IF v_cliente IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Cliente no encontrado');
  END IF;

  v_nuevos_puntos := COALESCE(v_cliente.puntos_actuales, 0) + p_puntos;

  -- Actualizar puntos
  UPDATE clientes
  SET puntos_actuales = v_nuevos_puntos,
      updated_at = NOW()
  WHERE id = p_cliente_id;

  -- Registrar en historial
  INSERT INTO historial_puntos (cliente_id, puntos, tipo, descripcion)
  VALUES (p_cliente_id, p_puntos, p_tipo, p_descripcion);

  RETURN json_build_object(
    'success', true,
    'puntos_anteriores', v_cliente.puntos_actuales,
    'puntos_asignados', p_puntos,
    'puntos_actuales', v_nuevos_puntos
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.asignar_puntos_atomico(UUID, INTEGER, TEXT, TEXT) TO authenticated;

-- =====================================================
-- 6. MARCAR_BENEFICIO_USADO
-- Marcar un beneficio como usado
-- =====================================================
CREATE OR REPLACE FUNCTION public.marcar_beneficio_usado(p_beneficio_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_beneficio RECORD;
BEGIN
  -- Obtener beneficio con lock
  SELECT id, estado, cliente_id, nombre
  INTO v_beneficio
  FROM beneficios_cliente
  WHERE id = p_beneficio_id
  FOR UPDATE;

  IF v_beneficio IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Beneficio no encontrado');
  END IF;

  IF v_beneficio.estado = 'usado' THEN
    RETURN json_build_object('success', false, 'error', 'Este beneficio ya fue usado');
  END IF;

  IF v_beneficio.estado = 'expirado' THEN
    RETURN json_build_object('success', false, 'error', 'Este beneficio ha expirado');
  END IF;

  -- Marcar como usado
  UPDATE beneficios_cliente
  SET estado = 'usado',
      fecha_uso = NOW(),
      updated_at = NOW()
  WHERE id = p_beneficio_id;

  RETURN json_build_object(
    'success', true,
    'beneficio_id', v_beneficio.id,
    'nombre', v_beneficio.nombre
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.marcar_beneficio_usado(UUID) TO authenticated;

-- =====================================================
-- 7. APLICAR_CODIGO_REFERIDO_V2
-- Aplicar codigo de referido
-- =====================================================
CREATE OR REPLACE FUNCTION public.aplicar_codigo_referido_v2(
  p_codigo TEXT,
  p_nuevo_cliente_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referidor RECORD;
  v_nuevo_cliente RECORD;
  v_puntos_referidor INTEGER := 100;
  v_puntos_referido INTEGER := 50;
BEGIN
  -- Buscar codigo de referido
  SELECT cr.*, c.id as referidor_id, c.nombre as referidor_nombre
  INTO v_referidor
  FROM codigos_referido cr
  JOIN clientes c ON cr.cliente_id = c.id
  WHERE cr.codigo = UPPER(p_codigo)
  AND cr.activo = true;

  IF v_referidor IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Codigo de referido no valido');
  END IF;

  -- Verificar que no se auto-refiera
  IF v_referidor.referidor_id = p_nuevo_cliente_id THEN
    RETURN json_build_object('success', false, 'error', 'No puedes usar tu propio codigo');
  END IF;

  -- Verificar que el nuevo cliente no tenga ya un referidor
  SELECT id, referido_por INTO v_nuevo_cliente
  FROM clientes
  WHERE id = p_nuevo_cliente_id;

  IF v_nuevo_cliente IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Cliente no encontrado');
  END IF;

  IF v_nuevo_cliente.referido_por IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Ya tienes un codigo de referido aplicado');
  END IF;

  -- Aplicar referido
  UPDATE clientes
  SET referido_por = v_referidor.referidor_id,
      updated_at = NOW()
  WHERE id = p_nuevo_cliente_id;

  -- Dar puntos al referidor
  UPDATE clientes
  SET puntos_actuales = COALESCE(puntos_actuales, 0) + v_puntos_referidor,
      updated_at = NOW()
  WHERE id = v_referidor.referidor_id;

  INSERT INTO historial_puntos (cliente_id, puntos, tipo, descripcion)
  VALUES (v_referidor.referidor_id, v_puntos_referidor, 'referido', 'Bonificacion por referir un amigo');

  -- Dar puntos al referido
  UPDATE clientes
  SET puntos_actuales = COALESCE(puntos_actuales, 0) + v_puntos_referido,
      updated_at = NOW()
  WHERE id = p_nuevo_cliente_id;

  INSERT INTO historial_puntos (cliente_id, puntos, tipo, descripcion)
  VALUES (p_nuevo_cliente_id, v_puntos_referido, 'referido', 'Bonificacion por usar codigo de referido');

  -- Incrementar contador de usos
  UPDATE codigos_referido
  SET usos = COALESCE(usos, 0) + 1,
      updated_at = NOW()
  WHERE id = v_referidor.id;

  RETURN json_build_object(
    'success', true,
    'puntos_referidor', v_puntos_referidor,
    'puntos_referido', v_puntos_referido,
    'referidor_nombre', v_referidor.referidor_nombre
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.aplicar_codigo_referido_v2(TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.aplicar_codigo_referido_v2(TEXT, UUID) TO authenticated;

-- =====================================================
-- 8. ENQUEUE_SYNC_OPERATION
-- Encolar operacion de sincronizacion
-- =====================================================
CREATE OR REPLACE FUNCTION public.enqueue_sync_operation(
  p_operation TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_payload JSONB DEFAULT '{}'::JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queue_id UUID;
BEGIN
  INSERT INTO sync_queue (operation, entity_type, entity_id, payload, status)
  VALUES (p_operation, p_entity_type, p_entity_id, p_payload, 'pending')
  RETURNING id INTO v_queue_id;

  RETURN json_build_object(
    'success', true,
    'queue_id', v_queue_id
  );
EXCEPTION
  WHEN undefined_table THEN
    -- Si la tabla no existe, simplemente ignorar
    RETURN json_build_object('success', true, 'message', 'Sync queue not configured');
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_sync_operation(TEXT, TEXT, UUID, JSONB) TO authenticated;

-- =====================================================
-- 9. LOG_AUDIT_EVENT
-- Registrar evento de auditoria
-- =====================================================
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_event_type TEXT,
  p_details JSONB DEFAULT '{}'::JSONB,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_log (event_type, details, user_id, created_at)
  VALUES (p_event_type, p_details, p_user_id, NOW());

  RETURN json_build_object('success', true);
EXCEPTION
  WHEN undefined_table THEN
    -- Si la tabla no existe, simplemente ignorar
    RETURN json_build_object('success', true, 'message', 'Audit log not configured');
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_audit_event(TEXT, JSONB, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.log_audit_event(TEXT, JSONB, UUID) TO authenticated;

-- =====================================================
-- AGREGAR COLUMNAS FALTANTES SI NO EXISTEN
-- =====================================================

-- Columnas para rate limiting en clientes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'clientes' AND column_name = 'login_attempts') THEN
    ALTER TABLE clientes ADD COLUMN login_attempts INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'clientes' AND column_name = 'last_login_attempt') THEN
    ALTER TABLE clientes ADD COLUMN last_login_attempt TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'clientes' AND column_name = 'updated_at') THEN
    ALTER TABLE clientes ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Columna fecha_uso en beneficios_cliente
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'beneficios_cliente' AND column_name = 'fecha_uso') THEN
    ALTER TABLE beneficios_cliente ADD COLUMN fecha_uso TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'beneficios_cliente' AND column_name = 'updated_at') THEN
    ALTER TABLE beneficios_cliente ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- =====================================================
-- COMENTARIOS
-- =====================================================
COMMENT ON FUNCTION public.check_cliente_exists(TEXT) IS 'Verifica si un cliente existe por telefono';
COMMENT ON FUNCTION public.verify_client_pin_secure(TEXT, TEXT) IS 'Verifica PIN con rate limiting';
COMMENT ON FUNCTION public.register_client_pin_secure(TEXT, TEXT) IS 'Registra PIN con hash bcrypt';
COMMENT ON FUNCTION public.reset_client_pin(UUID) IS 'Resetea el PIN de un cliente';
COMMENT ON FUNCTION public.asignar_puntos_atomico(UUID, INTEGER, TEXT, TEXT) IS 'Asigna puntos de forma atomica';
COMMENT ON FUNCTION public.marcar_beneficio_usado(UUID) IS 'Marca un beneficio como usado';
COMMENT ON FUNCTION public.aplicar_codigo_referido_v2(TEXT, UUID) IS 'Aplica codigo de referido';
COMMENT ON FUNCTION public.enqueue_sync_operation(TEXT, TEXT, UUID, JSONB) IS 'Encola operacion de sync';
COMMENT ON FUNCTION public.log_audit_event(TEXT, JSONB, UUID) IS 'Registra evento de auditoria';
