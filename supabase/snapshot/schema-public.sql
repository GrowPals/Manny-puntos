


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."activar_referido"("p_referido_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_ref public.referidos%ROWTYPE;
  v_config public.config_referidos%ROWTYPE;
  v_referidor_telefono TEXT;
  v_referido_telefono TEXT;
  v_referido_nombre TEXT;
  v_referidor_id UUID;
  v_puntos_mes_actual INTEGER;
  v_puntos_totales INTEGER;
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  SELECT * INTO v_config FROM public.config_referidos WHERE activo = true LIMIT 1;
  
  IF v_config IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Configuración no encontrada');
  END IF;
  
  SELECT * INTO v_ref
  FROM public.referidos
  WHERE referido_id = p_referido_id AND estado = 'pendiente';
  
  IF v_ref IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No hay referido pendiente');
  END IF;
  
  IF v_ref.fecha_expiracion < now() THEN
    UPDATE public.referidos SET estado = 'expirado' WHERE id = v_ref.id;
    RETURN jsonb_build_object('success', false, 'error', 'El referido ha expirado');
  END IF;
  
  -- Store referidor_id for notification
  v_referidor_id := v_ref.referidor_id;
  
  IF v_config.limite_mensual IS NOT NULL THEN
    SELECT COALESCE(SUM(puntos_referidor), 0) INTO v_puntos_mes_actual
    FROM public.referidos
    WHERE referidor_id = v_referidor_id
      AND estado = 'activo'
      AND fecha_activacion >= date_trunc('month', now());
    
    IF v_puntos_mes_actual >= v_config.limite_mensual THEN
      RETURN jsonb_build_object('success', false, 'error', 'Límite mensual alcanzado');
    END IF;
  END IF;
  
  IF v_config.limite_total IS NOT NULL THEN
    SELECT COALESCE(SUM(puntos_referidor), 0) INTO v_puntos_totales
    FROM public.referidos
    WHERE referidor_id = v_referidor_id AND estado = 'activo';
    
    IF v_puntos_totales >= v_config.limite_total THEN
      RETURN jsonb_build_object('success', false, 'error', 'Límite total alcanzado');
    END IF;
  END IF;
  
  SELECT telefono INTO v_referidor_telefono FROM public.clientes WHERE id = v_referidor_id;
  SELECT telefono, nombre INTO v_referido_telefono, v_referido_nombre FROM public.clientes WHERE id = p_referido_id;
  
  UPDATE public.referidos
  SET 
    estado = 'activo',
    fecha_activacion = now(),
    puntos_referidor = v_config.puntos_referidor,
    puntos_referido = v_config.puntos_referido
  WHERE id = v_ref.id;
  
  PERFORM public.asignar_puntos_atomico(
    v_referidor_telefono,
    v_config.puntos_referidor,
    'Referido activado: ' || v_referido_nombre
  );
  
  PERFORM public.asignar_puntos_atomico(
    v_referido_telefono,
    v_config.puntos_referido,
    'Bono de bienvenida por referido'
  );
  
  -- Send push notification to referidor (fire and forget via pg_net)
  BEGIN
    v_supabase_url := current_setting('app.settings.supabase_url', true);
    v_service_key := current_setting('app.settings.service_role_key', true);
    
    IF v_supabase_url IS NOT NULL AND v_service_key IS NOT NULL THEN
      PERFORM extensions.http_post(
        url := v_supabase_url || '/functions/v1/send-push-notification',
        body := jsonb_build_object(
          'tipo', 'referido_activado',
          'cliente_id', v_referidor_id::text,
          'data', jsonb_build_object(
            'referido', v_referido_nombre,
            'puntos', v_config.puntos_referidor
          ),
          'url', '/mis-referidos'
        )::text,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_key
        )
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Silent fail - don't break the main flow if notification fails
    RAISE NOTICE 'Push notification failed: %', SQLERRM;
  END;
  
  RETURN jsonb_build_object(
    'success', true,
    'puntos_referidor', v_config.puntos_referidor,
    'puntos_referido', v_config.puntos_referido,
    'referidor_id', v_referidor_id
  );
END;
$$;


ALTER FUNCTION "public"."activar_referido"("p_referido_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."aplicar_codigo_referido"("p_codigo" "text", "p_referido_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_referidor_id UUID;
  v_config RECORD;
  v_fecha_exp TIMESTAMP;
BEGIN
  SELECT cliente_id INTO v_referidor_id
  FROM public.codigos_referido
  WHERE codigo = UPPER(TRIM(p_codigo))
    AND activo = TRUE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Código de referido inválido o inactivo'
    );
  END IF;
  
  IF v_referidor_id = p_referido_id THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'No puedes usar tu propio código de referido'
    );
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM public.referidos 
    WHERE referido_id = p_referido_id
    FOR UPDATE
  ) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Ya fuiste referido anteriormente'
    );
  END IF;
  
  SELECT * INTO v_config FROM public.config_referidos LIMIT 1;
  
  v_fecha_exp := NOW() + (COALESCE(v_config.dias_expiracion, 90) || ' days')::INTERVAL;
  
  INSERT INTO public.referidos (
    referidor_id,
    referido_id,
    codigo_usado,
    estado,
    fecha_expiracion
  ) VALUES (
    v_referidor_id,
    p_referido_id,
    UPPER(TRIM(p_codigo)),
    'pendiente',
    v_fecha_exp
  );
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'referidor_id', v_referidor_id,
    'fecha_expiracion', v_fecha_exp
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Ya fuiste referido anteriormente'
    );
END;
$$;


ALTER FUNCTION "public"."aplicar_codigo_referido"("p_codigo" "text", "p_referido_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."aplicar_codigo_referido_v2"("p_codigo" "text", "p_nuevo_cliente_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."aplicar_codigo_referido_v2"("p_codigo" "text", "p_nuevo_cliente_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."aplicar_codigo_referido_v2"("p_codigo" "text", "p_nuevo_cliente_id" "uuid") IS 'Aplica codigo de referido';



CREATE OR REPLACE FUNCTION "public"."aplicar_codigo_referido_v2"("p_referido_id" "uuid", "p_codigo" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_codigo_record RECORD;
  v_referido RECORD;
  v_config RECORD;
  v_puntos_referidor INTEGER;
  v_puntos_referido INTEGER;
BEGIN
  SELECT cr.*, c.id as cliente_id, c.nombre as cliente_nombre
  INTO v_codigo_record
  FROM codigos_referido cr
  JOIN clientes c ON cr.cliente_id = c.id
  WHERE cr.codigo = UPPER(p_codigo) AND cr.activo = true
  FOR UPDATE;

  IF v_codigo_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Código de referido no válido o inactivo');
  END IF;

  IF v_codigo_record.cliente_id = p_referido_id THEN
    RETURN json_build_object('success', false, 'error', 'No puedes usar tu propio código');
  END IF;

  SELECT * INTO v_referido FROM clientes WHERE id = p_referido_id;
  IF v_referido IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Cliente referido no encontrado');
  END IF;

  IF EXISTS (SELECT 1 FROM referidos WHERE referido_id = p_referido_id) THEN
    RETURN json_build_object('success', false, 'error', 'Ya tienes un código de referido aplicado');
  END IF;

  SELECT * INTO v_config FROM config_referidos WHERE activo = true LIMIT 1;
  v_puntos_referidor := COALESCE(v_config.puntos_referidor, 100);
  v_puntos_referido := COALESCE(v_config.puntos_referido, 50);

  INSERT INTO referidos (referidor_id, referido_id, codigo_usado, estado, puntos_referidor, puntos_referido)
  VALUES (v_codigo_record.cliente_id, p_referido_id, UPPER(p_codigo), 'activo', v_puntos_referidor, v_puntos_referido);

  UPDATE clientes SET puntos_actuales = puntos_actuales + v_puntos_referidor, puntos_historicos = puntos_historicos + v_puntos_referidor WHERE id = v_codigo_record.cliente_id;
  UPDATE clientes SET puntos_actuales = puntos_actuales + v_puntos_referido, puntos_historicos = puntos_historicos + v_puntos_referido WHERE id = p_referido_id;
  UPDATE codigos_referido SET usos = usos + 1 WHERE id = v_codigo_record.id;

  RETURN json_build_object('success', true, 'puntos_ganados', v_puntos_referido, 'referidor_nombre', v_codigo_record.cliente_nombre);
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Error al aplicar código: ' || SQLERRM);
END;
$$;


ALTER FUNCTION "public"."aplicar_codigo_referido_v2"("p_referido_id" "uuid", "p_codigo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."asignar_puntos_atomico"("p_cliente_telefono" "text", "p_puntos_a_sumar" integer, "p_concepto" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_cliente_id UUID;
    v_nuevo_saldo INT;
BEGIN
    -- Buscar y lockear el cliente para prevenir race conditions
    SELECT id INTO v_cliente_id 
    FROM clientes 
    WHERE telefono = p_cliente_telefono
    FOR UPDATE;

    IF v_cliente_id IS NULL THEN
        RAISE EXCEPTION 'Cliente con teléfono % no encontrado.', p_cliente_telefono;
    END IF;

    -- Actualizar los puntos del cliente
    UPDATE clientes
    SET puntos_actuales = puntos_actuales + p_puntos_a_sumar
    WHERE id = v_cliente_id
    RETURNING puntos_actuales INTO v_nuevo_saldo;

    -- Insertar el registro en el historial
    INSERT INTO historial_puntos (cliente_id, puntos, concepto)
    VALUES (v_cliente_id, p_puntos_a_sumar, p_concepto);

    RETURN v_nuevo_saldo;
END;
$$;


ALTER FUNCTION "public"."asignar_puntos_atomico"("p_cliente_telefono" "text", "p_puntos_a_sumar" integer, "p_concepto" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."asignar_puntos_atomico"("p_cliente_telefono" "text", "p_puntos_a_sumar" integer, "p_concepto" "text") IS 'Asigna puntos a un cliente de forma atómica con FOR UPDATE para prevenir race conditions';



CREATE OR REPLACE FUNCTION "public"."asignar_puntos_atomico"("p_cliente_id" "uuid", "p_puntos" integer, "p_descripcion" "text" DEFAULT 'Puntos asignados'::"text", "p_tipo" "text" DEFAULT 'asignacion'::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."asignar_puntos_atomico"("p_cliente_id" "uuid", "p_puntos" integer, "p_descripcion" "text", "p_tipo" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."asignar_puntos_atomico"("p_cliente_id" "uuid", "p_puntos" integer, "p_descripcion" "text", "p_tipo" "text") IS 'Asigna puntos de forma atomica';



CREATE OR REPLACE FUNCTION "public"."canjear_link_regalo"("p_codigo" "text", "p_telefono" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_link RECORD;
  v_cliente RECORD;
  v_beneficio_id UUID;
BEGIN
  SELECT * INTO v_link FROM links_regalo WHERE codigo = UPPER(p_codigo) FOR UPDATE;

  IF v_link IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Link no encontrado');
  END IF;

  IF v_link.estado = 'canjeado' AND NOT v_link.es_campana THEN
    RETURN json_build_object('success', false, 'error', 'Este regalo ya fue canjeado');
  END IF;

  IF v_link.estado = 'expirado' THEN
    RETURN json_build_object('success', false, 'error', 'Este regalo ha expirado');
  END IF;

  IF v_link.fecha_expiracion IS NOT NULL AND v_link.fecha_expiracion < NOW() THEN
    UPDATE links_regalo SET estado = 'expirado' WHERE id = v_link.id;
    RETURN json_build_object('success', false, 'error', 'Este regalo ha expirado');
  END IF;

  IF v_link.es_campana THEN
    IF v_link.max_canjes IS NOT NULL AND v_link.canjes_realizados >= v_link.max_canjes THEN
      RETURN json_build_object('success', false, 'error', 'Esta campaña ha alcanzado el límite de canjes');
    END IF;
  ELSE
    IF v_link.destinatario_telefono IS NOT NULL
       AND v_link.destinatario_telefono != ''
       AND v_link.destinatario_telefono != p_telefono THEN
      RETURN json_build_object('success', false, 'error', 'Este regalo es para un número específico');
    END IF;
  END IF;

  SELECT * INTO v_cliente FROM clientes WHERE telefono = p_telefono;

  IF v_cliente IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Cliente no encontrado. Regístrate primero.');
  END IF;

  IF v_link.es_campana THEN
    IF EXISTS (SELECT 1 FROM beneficios_cliente WHERE link_regalo_id = v_link.id AND cliente_id = v_cliente.id) THEN
      RETURN json_build_object('success', false, 'error', 'Ya canjeaste este regalo');
    END IF;
  END IF;

  IF v_link.tipo = 'puntos' AND v_link.puntos_regalo IS NOT NULL THEN
    UPDATE clientes SET puntos_actuales = puntos_actuales + v_link.puntos_regalo, updated_at = NOW() WHERE id = v_cliente.id;
    INSERT INTO historial_puntos (cliente_id, puntos, concepto) VALUES (v_cliente.id, v_link.puntos_regalo, COALESCE(v_link.nombre_campana, v_link.nombre_beneficio, 'Regalo de puntos'));
  END IF;

  INSERT INTO beneficios_cliente (cliente_id, link_regalo_id, tipo, nombre, descripcion, terminos, instrucciones, puntos_otorgados, estado, fecha_canje, fecha_expiracion)
  VALUES (v_cliente.id, v_link.id, v_link.tipo, COALESCE(v_link.nombre_beneficio, v_link.nombre_campana, 'Regalo'), v_link.descripcion_beneficio, v_link.terminos_condiciones, v_link.instrucciones_uso, CASE WHEN v_link.tipo = 'puntos' THEN v_link.puntos_regalo ELSE NULL END, 'activo', NOW(), CASE WHEN v_link.vigencia_beneficio IS NOT NULL THEN NOW() + (v_link.vigencia_beneficio || ' days')::INTERVAL ELSE NOW() + INTERVAL '365 days' END)
  RETURNING id INTO v_beneficio_id;

  IF v_link.es_campana THEN
    UPDATE links_regalo SET canjes_realizados = canjes_realizados + 1 WHERE id = v_link.id;
  ELSE
    UPDATE links_regalo SET estado = 'canjeado', canjeado_por = v_cliente.id, fecha_canje = NOW() WHERE id = v_link.id;
  END IF;

  RETURN json_build_object('success', true, 'beneficio_id', v_beneficio_id, 'cliente_id', v_cliente.id, 'nombre_cliente', v_cliente.nombre, 'nombre_beneficio', COALESCE(v_link.nombre_beneficio, v_link.nombre_campana), 'tipo', v_link.tipo, 'puntos_otorgados', CASE WHEN v_link.tipo = 'puntos' THEN v_link.puntos_regalo ELSE NULL END, 'es_campana', v_link.es_campana);

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Error al procesar el regalo: ' || SQLERRM);
END;
$$;


ALTER FUNCTION "public"."canjear_link_regalo"("p_codigo" "text", "p_telefono" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."canjear_link_regalo_v3"("p_codigo" "text", "p_telefono" "text") RETURNS json
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ SELECT public.canjear_link_regalo(p_codigo, p_telefono); $$;


ALTER FUNCTION "public"."canjear_link_regalo_v3"("p_codigo" "text", "p_telefono" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_cliente_exists"("telefono_input" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."check_cliente_exists"("telefono_input" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_cliente_exists"("telefono_input" "text") IS 'Verifica si un cliente existe por telefono';



CREATE OR REPLACE FUNCTION "public"."check_pin_rate_limit"("p_telefono" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  attempt_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO attempt_count
  FROM public.pin_attempts
  WHERE telefono = p_telefono
    AND attempted_at > NOW() - INTERVAL '5 minutes'
    AND success = FALSE;
  
  RETURN attempt_count < 5;
END;
$$;


ALTER FUNCTION "public"."check_pin_rate_limit"("p_telefono" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_sync_queue"("p_days_to_keep" integer DEFAULT 7) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.sync_queue
  WHERE status = 'completed'
    AND completed_at < now() - (p_days_to_keep || ' days')::interval;
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  RETURN v_deleted;
END;
$$;


ALTER FUNCTION "public"."cleanup_sync_queue"("p_days_to_keep" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cliente_notificado_este_mes"("p_cliente_id" "uuid", "p_tipo_trabajo" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.recordatorios_enviados
        WHERE cliente_id = p_cliente_id
          AND tipo_trabajo = p_tipo_trabajo
          AND enviado_at >= date_trunc('month', now())
    );
END;
$$;


ALTER FUNCTION "public"."cliente_notificado_este_mes"("p_cliente_id" "uuid", "p_tipo_trabajo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clientes_before_update_normalize_source"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Solo cuando cambian campos relevantes (excluye notion_page_id)
  IF (OLD.nombre IS DISTINCT FROM NEW.nombre)
     OR (OLD.telefono IS DISTINCT FROM NEW.telefono)
     OR (OLD.puntos_actuales IS DISTINCT FROM NEW.puntos_actuales)
  THEN
    IF COALESCE(OLD.sync_source, '') = 'notion' THEN
      NEW.sync_source := 'manual';
      NEW.last_sync_at := NOW();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."clientes_before_update_normalize_source"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_sync_operation"("p_queue_id" "uuid", "p_success" boolean, "p_error" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_current record;
  v_next_retry timestamptz;
  v_new_status text;
  v_error_history jsonb;
BEGIN
  SELECT * INTO v_current
  FROM public.sync_queue
  WHERE id = p_queue_id
  FOR UPDATE;
  
  IF v_current IS NULL THEN
    RETURN;
  END IF;
  
  IF p_success THEN
    -- Éxito: marcar como completado
    UPDATE public.sync_queue
    SET status = 'completed',
        completed_at = now(),
        updated_at = now()
    WHERE id = p_queue_id;
  ELSE
    -- Fallo: calcular siguiente retry con backoff exponencial
    -- Delays: 30s, 1m, 2m, 4m, 8m (max 5 retries)
    IF v_current.retry_count >= v_current.max_retries THEN
      v_new_status := 'dead_letter';
      v_next_retry := NULL;
    ELSE
      v_new_status := 'failed';
      v_next_retry := now() + (power(2, v_current.retry_count) * interval '30 seconds');
    END IF;
    
    -- Agregar error al historial
    v_error_history := COALESCE(v_current.error_history, '[]'::jsonb);
    v_error_history := v_error_history || jsonb_build_object(
      'error', p_error,
      'retry_count', v_current.retry_count,
      'timestamp', now()
    );
    
    UPDATE public.sync_queue
    SET status = v_new_status,
        retry_count = v_current.retry_count + 1,
        next_retry_at = v_next_retry,
        last_error = p_error,
        error_history = v_error_history,
        updated_at = now()
    WHERE id = p_queue_id;
  END IF;
END;
$$;


ALTER FUNCTION "public"."complete_sync_operation"("p_queue_id" "uuid", "p_success" boolean, "p_error" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."complete_sync_operation"("p_queue_id" "uuid", "p_success" boolean, "p_error" "text") IS 'Marca una operación como completada o fallida con retry automático.';



CREATE OR REPLACE FUNCTION "public"."crear_link_regalo"("p_tipo" character varying, "p_creado_por" "uuid", "p_nombre_beneficio" "text" DEFAULT NULL::"text", "p_descripcion_beneficio" "text" DEFAULT NULL::"text", "p_puntos_regalo" integer DEFAULT NULL::integer, "p_mensaje" "text" DEFAULT NULL::"text", "p_destinatario_telefono" character varying DEFAULT NULL::character varying, "p_dias_expiracion" integer DEFAULT 30) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  v_codigo VARCHAR(12);
  v_link_id UUID;
  v_fecha_exp TIMESTAMPTZ;
BEGIN
  IF p_tipo NOT IN ('servicio', 'puntos') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tipo inválido');
  END IF;
  
  IF p_tipo = 'servicio' AND (p_nombre_beneficio IS NULL OR p_nombre_beneficio = '') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nombre del beneficio requerido');
  END IF;
  
  IF p_tipo = 'puntos' AND (p_puntos_regalo IS NULL OR p_puntos_regalo <= 0) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Puntos inválidos');
  END IF;
  
  v_codigo := public.generar_codigo_unico(8, 'links_regalo', 'codigo');
  v_fecha_exp := now() + (p_dias_expiracion || ' days')::interval;
  
  INSERT INTO public.links_regalo (
    codigo, tipo, nombre_beneficio, descripcion_beneficio,
    puntos_regalo, mensaje_personalizado, creado_por,
    destinatario_telefono, fecha_expiracion
  ) VALUES (
    v_codigo, p_tipo, p_nombre_beneficio, p_descripcion_beneficio,
    p_puntos_regalo, p_mensaje, p_creado_por,
    p_destinatario_telefono, v_fecha_exp
  )
  RETURNING id INTO v_link_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'id', v_link_id,
    'codigo', v_codigo,
    'fecha_expiracion', v_fecha_exp
  );
END;
$$;


ALTER FUNCTION "public"."crear_link_regalo"("p_tipo" character varying, "p_creado_por" "uuid", "p_nombre_beneficio" "text", "p_descripcion_beneficio" "text", "p_puntos_regalo" integer, "p_mensaje" "text", "p_destinatario_telefono" character varying, "p_dias_expiracion" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dequeue_sync_operation"() RETURNS TABLE("queue_id" "uuid", "operation_type" "text", "resource_id" "uuid", "payload" "jsonb", "retry_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_item record;
BEGIN
  -- Obtener y lockear el siguiente item listo para procesar
  SELECT sq.id, sq.operation_type, sq.resource_id, sq.payload, sq.retry_count
  INTO v_item
  FROM public.sync_queue sq
  WHERE sq.status IN ('pending', 'failed')
    AND (sq.next_retry_at IS NULL OR sq.next_retry_at <= now())
  ORDER BY sq.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
  
  IF v_item IS NULL THEN
    RETURN;
  END IF;
  
  -- Marcar como procesando
  UPDATE public.sync_queue
  SET status = 'processing',
      updated_at = now()
  WHERE id = v_item.id;
  
  queue_id := v_item.id;
  operation_type := v_item.operation_type;
  resource_id := v_item.resource_id;
  payload := v_item.payload;
  retry_count := v_item.retry_count;
  
  RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."dequeue_sync_operation"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."dequeue_sync_operation"() IS 'Obtiene y lockea el siguiente item de la cola para procesamiento.';



CREATE OR REPLACE FUNCTION "public"."enqueue_sync_operation"("p_operation" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_payload" "jsonb" DEFAULT '{}'::"jsonb") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Intentar insertar en sync_queue si existe con estructura esperada
  BEGIN
    INSERT INTO sync_queue (tipo_operacion, tipo_entidad, entidad_id, payload, estado)
    VALUES (p_operation, p_entity_type, p_entity_id, p_payload, 'pendiente')
    ON CONFLICT DO NOTHING;

    RETURN json_build_object('success', true);
  EXCEPTION
    WHEN undefined_column THEN
      -- Si las columnas son diferentes, intentar con nombres alternativos
      BEGIN
        INSERT INTO sync_queue (operation_type, entity_type, entity_id, payload, status)
        VALUES (p_operation, p_entity_type, p_entity_id, p_payload, 'pending')
        ON CONFLICT DO NOTHING;

        RETURN json_build_object('success', true);
      EXCEPTION
        WHEN OTHERS THEN
          -- Si falla de cualquier forma, retornar éxito silencioso
          RETURN json_build_object('success', true, 'message', 'Sync queue operation skipped');
      END;
    WHEN undefined_table THEN
      RETURN json_build_object('success', true, 'message', 'Sync queue not configured');
    WHEN OTHERS THEN
      RETURN json_build_object('success', true, 'message', 'Sync queue operation skipped');
  END;
END;
$$;


ALTER FUNCTION "public"."enqueue_sync_operation"("p_operation" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_payload" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."enqueue_sync_operation"("p_operation" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_payload" "jsonb") IS 'Encola operacion de sync - robusta';



CREATE OR REPLACE FUNCTION "public"."enqueue_sync_operation"("p_operation_type" "text", "p_resource_id" "uuid", "p_payload" "jsonb" DEFAULT '{}'::"jsonb", "p_source" "text" DEFAULT 'app'::"text", "p_source_context" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_queue_id uuid;
  v_next_retry timestamptz;
BEGIN
  -- Primera retry inmediata (o en 5 segundos)
  v_next_retry := now() + interval '5 seconds';
  
  INSERT INTO public.sync_queue (
    operation_type,
    resource_id,
    payload,
    status,
    next_retry_at,
    source,
    source_context
  ) VALUES (
    p_operation_type,
    p_resource_id,
    p_payload,
    'pending',
    v_next_retry,
    p_source,
    p_source_context
  )
  RETURNING id INTO v_queue_id;
  
  RETURN v_queue_id;
END;
$$;


ALTER FUNCTION "public"."enqueue_sync_operation"("p_operation_type" "text", "p_resource_id" "uuid", "p_payload" "jsonb", "p_source" "text", "p_source_context" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."enqueue_sync_operation"("p_operation_type" "text", "p_resource_id" "uuid", "p_payload" "jsonb", "p_source" "text", "p_source_context" "jsonb") IS 'Encola una operación de sincronización para procesamiento asíncrono.';



CREATE OR REPLACE FUNCTION "public"."expire_old_gift_links"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_expired_count INTEGER;
  v_agotado_count INTEGER;
BEGIN
  -- 1. Marcar como expirados los links cuya fecha pasó
  UPDATE public.links_regalo
  SET estado = 'expirado'
  WHERE estado = 'pendiente'
    AND fecha_expiracion IS NOT NULL
    AND fecha_expiracion < NOW();
  
  GET DIAGNOSTICS v_expired_count = ROW_COUNT;
  
  -- 2. Marcar como agotados las campañas que alcanzaron su límite
  UPDATE public.links_regalo
  SET estado = 'agotado'
  WHERE estado = 'pendiente'
    AND es_campana = true
    AND max_canjes > 0
    AND canjes_realizados >= max_canjes;
  
  GET DIAGNOSTICS v_agotado_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'expired_count', v_expired_count,
    'agotado_count', v_agotado_count,
    'executed_at', NOW()
  );
END;
$$;


ALTER FUNCTION "public"."expire_old_gift_links"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."expire_old_gift_links"() IS 'Expira automáticamente links de regalo vencidos y marca campañas agotadas';



CREATE OR REPLACE FUNCTION "public"."generar_codigo_unico"("longitud" integer, "tabla" "text", "columna" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $_$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  codigo TEXT := '';
  i INTEGER;
  existe BOOLEAN := true;
BEGIN
  WHILE existe LOOP
    codigo := '';
    FOR i IN 1..longitud LOOP
      codigo := codigo || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE %I = $1)', tabla, columna)
    INTO existe
    USING codigo;
  END LOOP;
  
  RETURN codigo;
END;
$_$;


ALTER FUNCTION "public"."generar_codigo_unico"("longitud" integer, "tabla" "text", "columna" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_beneficios_cliente"("p_cliente_id" "uuid") RETURNS TABLE("id" "uuid", "tipo" character varying, "nombre" "text", "descripcion" "text", "terminos" "text", "instrucciones" "text", "estado" character varying, "fecha_canje" timestamp with time zone, "fecha_expiracion" timestamp with time zone, "dias_restantes" integer, "imagen_url" "text", "color_tema" character varying, "notion_ticket_id" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Auto-expirar beneficios vencidos
  UPDATE public.beneficios_cliente bc
  SET estado = 'expirado'
  WHERE bc.cliente_id = p_cliente_id
    AND bc.estado = 'activo'
    AND bc.fecha_expiracion < now();
  
  RETURN QUERY
  SELECT 
    bc.id,
    bc.tipo,
    bc.nombre,
    bc.descripcion,
    bc.terminos,
    bc.instrucciones,
    bc.estado,
    bc.fecha_canje,
    bc.fecha_expiracion,
    GREATEST(0, EXTRACT(DAY FROM bc.fecha_expiracion - now())::INTEGER) as dias_restantes,
    lr.imagen_banner as imagen_url,
    lr.color_tema,
    bc.notion_ticket_id
  FROM public.beneficios_cliente bc
  JOIN public.links_regalo lr ON bc.link_regalo_id = lr.id
  WHERE bc.cliente_id = p_cliente_id
  ORDER BY 
    CASE bc.estado 
      WHEN 'activo' THEN 1 
      WHEN 'usado' THEN 2 
      ELSE 3 
    END,
    bc.fecha_canje DESC;
END;
$$;


ALTER FUNCTION "public"."get_beneficios_cliente"("p_cliente_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."clientes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "nombre" "text" NOT NULL,
    "telefono" "text" NOT NULL,
    "puntos_actuales" integer DEFAULT 0,
    "es_admin" boolean DEFAULT false,
    "ultimo_servicio" "text",
    "fecha_ultimo_servicio" timestamp with time zone,
    "fecha_registro" timestamp with time zone DEFAULT "now"(),
    "last_sync_at" timestamp with time zone,
    "notion_page_id" "text",
    "nivel" "text" DEFAULT 'partner'::"text",
    "sync_source" "text" DEFAULT 'manual'::"text",
    "pin" "text",
    "has_pin" boolean DEFAULT false,
    "referido_por" "uuid",
    "notion_reward_id" "text",
    "pin_hash" "text",
    "login_attempts" integer DEFAULT 0,
    "last_login_attempt" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "clientes_nivel_check" CHECK (("nivel" = ANY (ARRAY['partner'::"text", 'vip'::"text"]))),
    CONSTRAINT "clientes_puntos_actuales_check" CHECK (("puntos_actuales" >= 0))
);


ALTER TABLE "public"."clientes" OWNER TO "postgres";


COMMENT ON TABLE "public"."clientes" IS 'Clientes del programa Manny Rewards. Login por teléfono.';



COMMENT ON COLUMN "public"."clientes"."puntos_actuales" IS 'Puntos disponibles para canjear';



COMMENT ON COLUMN "public"."clientes"."notion_page_id" IS 'ID de página en Notion Contactos (para sincronización)';



COMMENT ON COLUMN "public"."clientes"."nivel" IS 'Nivel del cliente: partner o vip';



COMMENT ON COLUMN "public"."clientes"."sync_source" IS 'Origen de la última sincronización: manual, notion, api';



COMMENT ON COLUMN "public"."clientes"."pin" IS '4-digit security PIN for login. Users register their own PIN during onboarding.';



CREATE OR REPLACE FUNCTION "public"."get_cliente_por_telefono"("p_telefono" "text") RETURNS SETOF "public"."clientes"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT *
  FROM public.clientes
  WHERE telefono = p_telefono;
$$;


ALTER FUNCTION "public"."get_cliente_por_telefono"("p_telefono" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_config"("p_clave" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_valor JSONB;
BEGIN
    SELECT valor INTO v_valor FROM config_global WHERE clave = p_clave;
    RETURN v_valor;
END;
$$;


ALTER FUNCTION "public"."get_config"("p_clave" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_cliente_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  cliente_id_str TEXT;
BEGIN
  -- Leer el header custom 'x-cliente-id'
  cliente_id_str := current_setting('request.headers', true)::json->>'x-cliente-id';
  
  IF cliente_id_str IS NULL OR cliente_id_str = '' THEN
    RETURN NULL;
  END IF;
  
  -- Validar que sea un UUID válido
  BEGIN
    RETURN cliente_id_str::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$;


ALTER FUNCTION "public"."get_current_cliente_id"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_current_cliente_id"() IS 'Obtiene el cliente_id del header x-cliente-id para auth custom';



CREATE OR REPLACE FUNCTION "public"."get_current_is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  current_id uuid;
  is_admin_flag boolean;
BEGIN
  current_id := public.get_current_cliente_id();
  
  IF current_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  SELECT es_admin INTO is_admin_flag
  FROM public.clientes
  WHERE id = current_id;
  
  RETURN COALESCE(is_admin_flag, FALSE);
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."get_current_is_admin"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_current_is_admin"() IS 'Verifica si el cliente actual es administrador';



CREATE OR REPLACE FUNCTION "public"."get_current_user_id"() RETURNS "text"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT current_setting('request.jwt.claims', true)::json->>'sub';
$$;


ALTER FUNCTION "public"."get_current_user_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_dashboard_stats"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result JSON;
  inicio_mes_actual TIMESTAMPTZ;
  hace_6_meses TIMESTAMPTZ;
BEGIN
  inicio_mes_actual := date_trunc('month', CURRENT_TIMESTAMP);
  hace_6_meses := date_trunc('month', CURRENT_TIMESTAMP - INTERVAL '5 months');

  WITH
  -- Clientes activos (no admins)
  clientes_activos AS (
    SELECT id, puntos_actuales, nivel, created_at
    FROM clientes
    WHERE es_admin = false OR es_admin IS NULL
  ),
  -- Resumen de clientes
  resumen_clientes AS (
    SELECT
      COUNT(*) AS total_clientes,
      COALESCE(SUM(puntos_actuales), 0) AS total_puntos,
      COUNT(*) FILTER (WHERE created_at >= inicio_mes_actual) AS clientes_nuevos_mes,
      COUNT(*) FILTER (WHERE nivel = 'normal' OR nivel IS NULL) AS nivel_normal,
      COUNT(*) FILTER (WHERE nivel = 'partner') AS nivel_partner,
      COUNT(*) FILTER (WHERE nivel = 'vip') AS nivel_vip
    FROM clientes_activos
  ),
  -- Estadísticas de canjes
  canjes_stats AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE estado IN ('pendiente_entrega', 'en_lista')) AS pendientes,
      COUNT(*) FILTER (WHERE estado = 'entregado') AS entregados,
      COALESCE(SUM(puntos_usados), 0) AS puntos_canjeados
    FROM canjes
  ),
  -- Canjes por tipo de producto
  canjes_por_tipo AS (
    SELECT
      COALESCE(p.tipo, 'Otro') AS tipo,
      COUNT(*) AS cantidad
    FROM canjes c
    LEFT JOIN productos p ON c.producto_id = p.id
    GROUP BY COALESCE(p.tipo, 'Otro')
  ),
  -- Total ingresos y servicios
  resumen_servicios AS (
    SELECT
      COALESCE(SUM(monto), 0) AS total_ingresos,
      COUNT(*) AS total_servicios
    FROM historial_servicios
  ),
  -- Servicios por mes (últimos 6 meses)
  servicios_por_mes AS (
    SELECT
      to_char(date_trunc('month', fecha_servicio), 'Mon YY') AS mes,
      date_trunc('month', fecha_servicio) AS mes_order,
      COUNT(*) AS servicios,
      COALESCE(SUM(monto), 0) AS ingresos,
      COALESCE(SUM(puntos_generados), 0) AS puntos
    FROM historial_servicios
    WHERE fecha_servicio >= hace_6_meses
    GROUP BY date_trunc('month', fecha_servicio)
    ORDER BY mes_order
  ),
  -- Servicios por tipo de trabajo
  servicios_por_tipo AS (
    SELECT
      COALESCE(tipo_trabajo, 'Sin categoría') AS tipo,
      COUNT(*) AS cantidad
    FROM historial_servicios
    GROUP BY COALESCE(tipo_trabajo, 'Sin categoría')
  ),
  -- Productos activos
  productos_activos AS (
    SELECT COUNT(*) AS total FROM productos WHERE activo = true
  )
  SELECT json_build_object(
    'resumen', (
      SELECT json_build_object(
        'totalClientes', rc.total_clientes,
        'totalPuntos', rc.total_puntos,
        'clientesNuevosMes', rc.clientes_nuevos_mes,
        'totalIngresos', rs.total_ingresos,
        'totalServicios', rs.total_servicios
      )
      FROM resumen_clientes rc, resumen_servicios rs
    ),
    'niveles', (
      SELECT json_build_object(
        'normal', rc.nivel_normal,
        'partner', rc.nivel_partner,
        'vip', rc.nivel_vip
      )
      FROM resumen_clientes rc
    ),
    'canjesStats', (
      SELECT json_build_object(
        'total', cs.total,
        'pendientes', cs.pendientes,
        'entregados', cs.entregados,
        'puntosCanjeados', cs.puntos_canjeados
      )
      FROM canjes_stats cs
    ),
    'canjesPorTipo', (SELECT COALESCE(json_agg(json_build_object('tipo', tipo, 'cantidad', cantidad)), '[]'::json) FROM canjes_por_tipo),
    'serviciosPorMes', (SELECT COALESCE(json_agg(json_build_object('mes', mes, 'servicios', servicios, 'ingresos', ingresos, 'puntos', puntos) ORDER BY mes_order), '[]'::json) FROM servicios_por_mes),
    'serviciosPorTipo', (SELECT COALESCE(json_agg(json_build_object('tipo', tipo, 'cantidad', cantidad)), '[]'::json) FROM servicios_por_tipo),
    'productosActivos', (SELECT total FROM productos_activos)
  ) INTO result;

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_dashboard_stats"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_dashboard_stats"() IS 'Calcula estadísticas del dashboard admin - debe ejecutarse en servidor, no en browser';



CREATE OR REPLACE FUNCTION "public"."get_gift_analytics_summary"("p_desde" "date" DEFAULT NULL::"date", "p_hasta" "date" DEFAULT NULL::"date") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'periodo', jsonb_build_object(
      'desde', COALESCE(p_desde, (SELECT MIN(created_at)::date FROM public.links_regalo)),
      'hasta', COALESCE(p_hasta, CURRENT_DATE)
    ),
    'totales', jsonb_build_object(
      'links_creados', COUNT(*),
      'campanas', COUNT(*) FILTER (WHERE es_campana = true),
      'links_individuales', COUNT(*) FILTER (WHERE es_campana = false OR es_campana IS NULL),
      'total_vistas', COALESCE(SUM(veces_visto), 0),
      'total_canjes', COALESCE(SUM(canjes_realizados), 0),
      'tasa_conversion_global', CASE 
        WHEN SUM(veces_visto) > 0 THEN ROUND((SUM(canjes_realizados)::numeric / SUM(veces_visto)) * 100, 2)
        ELSE 0 
      END
    ),
    'por_estado', jsonb_build_object(
      'pendientes', COUNT(*) FILTER (WHERE estado = 'pendiente'),
      'canjeados', COUNT(*) FILTER (WHERE estado = 'canjeado'),
      'expirados', COUNT(*) FILTER (WHERE estado = 'expirado'),
      'agotados', COUNT(*) FILTER (WHERE estado = 'agotado')
    ),
    'por_tipo', jsonb_build_object(
      'servicios', COUNT(*) FILTER (WHERE tipo = 'servicio'),
      'puntos', COUNT(*) FILTER (WHERE tipo = 'puntos'),
      'puntos_totales_regalados', COALESCE(SUM(puntos_regalo) FILTER (WHERE tipo = 'puntos' AND estado IN ('canjeado', 'agotado')), 0)
    ),
    'beneficios', jsonb_build_object(
      'activos', (SELECT COUNT(*) FROM public.beneficios_cliente WHERE estado = 'activo'),
      'usados', (SELECT COUNT(*) FROM public.beneficios_cliente WHERE estado = 'usado'),
      'expirados', (SELECT COUNT(*) FROM public.beneficios_cliente WHERE estado = 'expirado')
    )
  ) INTO v_result
  FROM public.links_regalo
  WHERE (p_desde IS NULL OR created_at::date >= p_desde)
    AND (p_hasta IS NULL OR created_at::date <= p_hasta);
  
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_gift_analytics_summary"("p_desde" "date", "p_hasta" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_historial_stats"("p_cliente_id" "uuid") RETURNS TABLE("total_servicios" bigint, "total_invertido" numeric, "total_puntos" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT,
        COALESCE(SUM(CASE WHEN monto > 0 THEN monto ELSE 0 END), 0)::NUMERIC,
        COALESCE(SUM(CASE WHEN puntos_generados > 0 THEN puntos_generados ELSE 0 END), 0)::BIGINT
    FROM public.historial_servicios
    WHERE cliente_id = p_cliente_id;
END;
$$;


ALTER FUNCTION "public"."get_historial_stats"("p_cliente_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  is_admin_flag BOOLEAN;
BEGIN
  -- This is the most reliable way to check for admin status.
  -- It checks the 'es_admin' flag in the database for the currently authenticated user.
  SELECT es_admin INTO is_admin_flag
  FROM public.clientes
  WHERE id = auth.uid()
  LIMIT 1;

  RETURN COALESCE(is_admin_flag, FALSE);
EXCEPTION
  WHEN OTHERS THEN
    -- If any error occurs (like the user not being in the clientes table yet),
    -- safely default to NOT being an admin.
    RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."get_is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_referral_code"("p_cliente_id" "uuid") RETURNS TABLE("codigo" character varying, "es_nuevo" boolean)
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  v_codigo VARCHAR(8);
  v_es_nuevo BOOLEAN := false;
BEGIN
  SELECT cr.codigo INTO v_codigo
  FROM public.codigos_referido cr
  WHERE cr.cliente_id = p_cliente_id AND cr.activo = true;
  
  IF v_codigo IS NULL THEN
    v_codigo := public.generar_codigo_unico(6, 'codigos_referido', 'codigo');
    
    INSERT INTO public.codigos_referido (cliente_id, codigo)
    VALUES (p_cliente_id, v_codigo);
    
    v_es_nuevo := true;
  END IF;
  
  RETURN QUERY SELECT v_codigo, v_es_nuevo;
END;
$$;


ALTER FUNCTION "public"."get_or_create_referral_code"("p_cliente_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_referral_stats"("p_cliente_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  v_codigo VARCHAR(8);
  v_total_referidos INTEGER;
  v_referidos_activos INTEGER;
  v_referidos_pendientes INTEGER;
  v_puntos_ganados INTEGER;
  v_puntos_mes INTEGER;
  v_config public.config_referidos%ROWTYPE;
BEGIN
  SELECT codigo INTO v_codigo FROM public.codigos_referido WHERE cliente_id = p_cliente_id;
  
  IF v_codigo IS NULL THEN
    SELECT codigo INTO v_codigo FROM public.get_or_create_referral_code(p_cliente_id);
  END IF;
  
  SELECT * INTO v_config FROM public.config_referidos WHERE activo = true LIMIT 1;
  
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE estado = 'activo'),
    COUNT(*) FILTER (WHERE estado = 'pendiente'),
    COALESCE(SUM(puntos_referidor) FILTER (WHERE estado = 'activo'), 0),
    COALESCE(SUM(puntos_referidor) FILTER (WHERE estado = 'activo' AND fecha_activacion >= date_trunc('month', now())), 0)
  INTO v_total_referidos, v_referidos_activos, v_referidos_pendientes, v_puntos_ganados, v_puntos_mes
  FROM public.referidos
  WHERE referidor_id = p_cliente_id;
  
  RETURN jsonb_build_object(
    'codigo', v_codigo,
    'total_referidos', v_total_referidos,
    'referidos_activos', v_referidos_activos,
    'referidos_pendientes', v_referidos_pendientes,
    'puntos_ganados', v_puntos_ganados,
    'puntos_este_mes', v_puntos_mes,
    'limite_mensual', v_config.limite_mensual,
    'limite_total', v_config.limite_total,
    'puntos_por_referido', v_config.puntos_referidor,
    'programa_activo', v_config.activo
  );
END;
$$;


ALTER FUNCTION "public"."get_referral_stats"("p_cliente_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_ultimo_servicio_recurrente"("p_cliente_id" "uuid", "p_tipo_trabajo" "text") RETURNS TABLE("servicio_id" "uuid", "fecha_servicio" timestamp with time zone, "dias_transcurridos" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        hs.id,
        hs.fecha_servicio,
        EXTRACT(DAY FROM (now() - hs.fecha_servicio))::INTEGER
    FROM public.historial_servicios hs
    WHERE hs.cliente_id = p_cliente_id
      AND hs.tipo_trabajo = p_tipo_trabajo
    ORDER BY hs.fecha_servicio DESC
    LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_ultimo_servicio_recurrente"("p_cliente_id" "uuid", "p_tipo_trabajo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hash_pin"("pin" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  RETURN extensions.crypt(pin, extensions.gen_salt('bf', 8));
END;
$$;


ALTER FUNCTION "public"."hash_pin"("pin" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."incrementar_vistas_link"("p_codigo" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  UPDATE public.links_regalo
  SET 
    veces_visto = COALESCE(veces_visto, 0) + 1,
    ultima_vista = NOW()
  WHERE codigo = UPPER(p_codigo);
END;
$$;


ALTER FUNCTION "public"."incrementar_vistas_link"("p_codigo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invoke_process_sync_queue"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_pending_count integer;
BEGIN
  -- Check if there are pending items to avoid unnecessary calls
  SELECT COUNT(*) INTO v_pending_count
  FROM public.sync_queue
  WHERE status = 'pending'
    AND (next_retry_at IS NULL OR next_retry_at <= now());
  
  IF v_pending_count > 0 THEN
    -- Call the edge function via HTTP
    PERFORM extensions.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/process-sync-queue',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('batch_size', 10)
    );
    
    RAISE NOTICE 'Invoked process-sync-queue for % pending items', v_pending_count;
  END IF;
END;
$$;


ALTER FUNCTION "public"."invoke_process_sync_queue"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."invoke_process_sync_queue"() IS 'Invokes the process-sync-queue edge function to process pending sync operations. Called by pg_cron every minute.';



CREATE OR REPLACE FUNCTION "public"."is_current_user_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT COALESCE(
    -- First try: Check via JWT claims (Supabase Auth)
    (SELECT es_admin FROM clientes WHERE id::text = (current_setting('request.jwt.claims', true)::json->>'sub') LIMIT 1),
    -- Second try: Check via x-cliente-id header (custom auth)
    (SELECT es_admin FROM clientes WHERE id::text = (current_setting('request.headers', true)::json->>'x-cliente-id') LIMIT 1),
    false
  );
$$;


ALTER FUNCTION "public"."is_current_user_admin"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_current_user_admin"() IS 'Checks if current user is admin via JWT or x-cliente-id header';



CREATE OR REPLACE FUNCTION "public"."is_own_or_admin"("check_cliente_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  current_id uuid;
BEGIN
  current_id := public.get_current_cliente_id();
  
  IF current_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Es el mismo cliente o es admin
  RETURN current_id = check_cliente_id OR public.get_current_is_admin();
END;
$$;


ALTER FUNCTION "public"."is_own_or_admin"("check_cliente_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_own_or_admin"("check_cliente_id" "uuid") IS 'Verifica si el cliente_id es el propio o si es admin';



CREATE OR REPLACE FUNCTION "public"."log_audit_event"("p_event_type" "text", "p_details" "jsonb" DEFAULT '{}'::"jsonb", "p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Intentar insertar en audit_log si existe
  BEGIN
    INSERT INTO audit_log (tipo_evento, detalles, cliente_id, created_at)
    VALUES (p_event_type, p_details, p_user_id, NOW());

    RETURN json_build_object('success', true);
  EXCEPTION
    WHEN undefined_column THEN
      -- Intentar con nombres de columna alternativos
      BEGIN
        INSERT INTO audit_log (event_type, details, user_id, created_at)
        VALUES (p_event_type, p_details, p_user_id, NOW());

        RETURN json_build_object('success', true);
      EXCEPTION
        WHEN OTHERS THEN
          RETURN json_build_object('success', true, 'message', 'Audit log skipped');
      END;
    WHEN undefined_table THEN
      RETURN json_build_object('success', true, 'message', 'Audit log not configured');
    WHEN OTHERS THEN
      RETURN json_build_object('success', true, 'message', 'Audit log skipped');
  END;
END;
$$;


ALTER FUNCTION "public"."log_audit_event"("p_event_type" "text", "p_details" "jsonb", "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."log_audit_event"("p_event_type" "text", "p_details" "jsonb", "p_user_id" "uuid") IS 'Registra evento de auditoria - robusta';



CREATE OR REPLACE FUNCTION "public"."log_audit_event"("p_event_type" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_action" "text", "p_details" "jsonb" DEFAULT '{}'::"jsonb", "p_cliente_id" "uuid" DEFAULT NULL::"uuid", "p_success" boolean DEFAULT true, "p_error_message" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO public.audit_log (
    event_type,
    entity_type,
    entity_id,
    action,
    details,
    cliente_id,
    success,
    error_message
  ) VALUES (
    p_event_type,
    p_entity_type,
    p_entity_id,
    p_action,
    p_details,
    p_cliente_id,
    p_success,
    p_error_message
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;


ALTER FUNCTION "public"."log_audit_event"("p_event_type" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_action" "text", "p_details" "jsonb", "p_cliente_id" "uuid", "p_success" boolean, "p_error_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."marcar_beneficio_usado"("p_beneficio_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."marcar_beneficio_usado"("p_beneficio_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."marcar_beneficio_usado"("p_beneficio_id" "uuid") IS 'Marca un beneficio como usado';



CREATE OR REPLACE FUNCTION "public"."marcar_beneficio_usado"("p_beneficio_id" "uuid", "p_admin_id" "uuid", "p_notas" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_beneficio public.beneficios_cliente%ROWTYPE;
BEGIN
  SELECT * INTO v_beneficio
  FROM public.beneficios_cliente
  WHERE id = p_beneficio_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Beneficio no encontrado');
  END IF;
  
  IF v_beneficio.estado != 'activo' THEN
    RETURN jsonb_build_object('success', false, 'error', 'El beneficio no está activo (estado: ' || v_beneficio.estado || ')');
  END IF;
  
  UPDATE public.beneficios_cliente
  SET estado = 'usado',
      fecha_uso = now(),
      verificado_por = p_admin_id,
      notas_uso = p_notas
  WHERE id = p_beneficio_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Beneficio marcado como usado');
END;
$$;


ALTER FUNCTION "public"."marcar_beneficio_usado"("p_beneficio_id" "uuid", "p_admin_id" "uuid", "p_notas" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."obtener_estadisticas_dashboard"() RETURNS json
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
SELECT json_build_object(
    'total_clientes', (SELECT COUNT(*) FROM clientes WHERE es_admin = false OR es_admin IS NULL),
    'puntos_totales', (SELECT COALESCE(SUM(puntos_actuales), 0) FROM clientes),
    'productos_activos', (SELECT COUNT(*) FROM productos WHERE activo = true),
    'canjes_pendientes', (SELECT COUNT(*) FROM canjes WHERE estado = 'pendiente_entrega' OR estado = 'en_lista')
);
$$;


ALTER FUNCTION "public"."obtener_estadisticas_dashboard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_pin_attempt"("p_telefono" "text", "p_success" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  INSERT INTO public.pin_attempts (telefono, success)
  VALUES (p_telefono, p_success);
  
  DELETE FROM public.pin_attempts 
  WHERE attempted_at < NOW() - INTERVAL '1 hour';
END;
$$;


ALTER FUNCTION "public"."record_pin_attempt"("p_telefono" "text", "p_success" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."register_client_pin"("telefono_input" "text", "new_pin" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
DECLARE
  found_client public.clientes%ROWTYPE;
BEGIN
  IF LENGTH(new_pin) != 4 OR new_pin !~ '^[0-9]+$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'El PIN debe ser de 4 dígitos numéricos');
  END IF;

  SELECT * INTO found_client FROM public.clientes WHERE telefono = telefono_input;
  
  IF found_client IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cliente no encontrado');
  END IF;

  UPDATE public.clientes 
  SET pin = extensions.crypt(new_pin, extensions.gen_salt('bf')), has_pin = TRUE
  WHERE telefono = telefono_input;

  RETURN jsonb_build_object(
    'success', true,
    'cliente', to_jsonb(found_client) - 'pin'
  );
END;
$_$;


ALTER FUNCTION "public"."register_client_pin"("telefono_input" "text", "new_pin" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."register_client_pin_secure"("telefono_input" "text", "pin_input" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $_$
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

  -- Crear hash del PIN usando extensions.crypt y extensions.gen_salt
  v_pin_hash := extensions.crypt(pin_input, extensions.gen_salt('bf'));

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
$_$;


ALTER FUNCTION "public"."register_client_pin_secure"("telefono_input" "text", "pin_input" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."register_client_pin_secure"("telefono_input" "text", "pin_input" "text") IS 'Registra PIN con hash bcrypt - usa extensions.crypt';



CREATE OR REPLACE FUNCTION "public"."registrar_canje_atomico"("p_cliente_id" "uuid", "p_producto_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cliente RECORD;
  v_producto RECORD;
  v_canje_id UUID;
BEGIN
  -- Obtener cliente con lock para evitar race conditions
  SELECT * INTO v_cliente
  FROM clientes
  WHERE id = p_cliente_id
  FOR UPDATE;

  IF v_cliente IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Cliente no encontrado');
  END IF;

  -- Obtener producto con lock
  SELECT * INTO v_producto
  FROM productos
  WHERE id = p_producto_id
  FOR UPDATE;

  IF v_producto IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Producto no encontrado');
  END IF;

  IF NOT v_producto.activo THEN
    RETURN json_build_object('success', false, 'error', 'Producto no disponible');
  END IF;

  -- Verificar stock (si aplica)
  IF v_producto.stock IS NOT NULL AND v_producto.stock <= 0 THEN
    RAISE EXCEPTION 'Producto agotado';
  END IF;

  -- Verificar puntos suficientes
  IF v_cliente.puntos_actuales < v_producto.puntos_requeridos THEN
    RAISE EXCEPTION 'Puntos insuficientes';
  END IF;

  -- Descontar puntos del cliente
  UPDATE clientes
  SET puntos_actuales = puntos_actuales - v_producto.puntos_requeridos,
      updated_at = NOW()
  WHERE id = p_cliente_id;

  -- Descontar stock si aplica
  IF v_producto.stock IS NOT NULL THEN
    UPDATE productos
    SET stock = stock - 1
    WHERE id = p_producto_id;
  END IF;

  -- Crear registro de canje
  INSERT INTO canjes (
    cliente_id,
    producto_id,
    puntos_usados,
    estado,
    tipo_producto_original
  ) VALUES (
    p_cliente_id,
    p_producto_id,
    v_producto.puntos_requeridos,
    'pendiente_entrega',
    v_producto.tipo
  )
  RETURNING id INTO v_canje_id;

  -- Registrar en historial usando columnas REALES
  INSERT INTO historial_puntos (
    cliente_id,
    puntos,
    concepto,
    canje_id
  ) VALUES (
    p_cliente_id,
    -v_producto.puntos_requeridos,
    'Canje: ' || v_producto.nombre,
    v_canje_id
  );

  RETURN json_build_object(
    'success', true,
    'canjeId', v_canje_id,
    'nuevoSaldo', v_cliente.puntos_actuales - v_producto.puntos_requeridos,
    'puntos_canjeados', v_producto.puntos_requeridos
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;


ALTER FUNCTION "public"."registrar_canje_atomico"("p_cliente_id" "uuid", "p_producto_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."registrar_canje_atomico"("p_cliente_id" "uuid", "p_producto_id" "uuid") IS 'Registra canje de producto descontando puntos atómicamente. VERIFICADO 2025-12-09';



CREATE OR REPLACE FUNCTION "public"."registrar_cliente_publico"("p_telefono" "text", "p_nombre" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_telefono TEXT;
  v_nombre TEXT;
  v_cliente RECORD;
BEGIN
  -- Limpiar inputs
  v_telefono := trim(p_telefono);
  v_nombre := trim(p_nombre);

  -- Validar teléfono: exactamente 10 dígitos
  IF v_telefono !~ '^\d{10}$' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'El teléfono debe tener exactamente 10 dígitos numéricos.'
    );
  END IF;

  -- Validar nombre: entre 3 y 100 caracteres
  IF length(v_nombre) < 3 OR length(v_nombre) > 100 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'El nombre debe tener entre 3 y 100 caracteres.'
    );
  END IF;

  -- Verificar que el teléfono no exista
  IF EXISTS (SELECT 1 FROM clientes WHERE telefono = v_telefono) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Este número ya está registrado.'
    );
  END IF;

  -- Crear cliente
  INSERT INTO clientes (nombre, telefono, puntos_actuales, es_admin, nivel)
  VALUES (v_nombre, v_telefono, 0, false, 'partner')
  RETURNING id, nombre, telefono, puntos_actuales, es_admin, nivel
  INTO v_cliente;

  RETURN json_build_object(
    'success', true,
    'cliente_nuevo', true,
    'cliente', json_build_object(
      'id', v_cliente.id,
      'nombre', v_cliente.nombre,
      'telefono', v_cliente.telefono,
      'puntos_actuales', v_cliente.puntos_actuales,
      'es_admin', v_cliente.es_admin,
      'nivel', v_cliente.nivel
    )
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Este número ya está registrado.'
    );
END;
$_$;


ALTER FUNCTION "public"."registrar_cliente_publico"("p_telefono" "text", "p_nombre" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_client_pin"("cliente_id_input" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."reset_client_pin"("cliente_id_input" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reset_client_pin"("cliente_id_input" "uuid") IS 'Resetea el PIN de un cliente';



CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_new_cliente_to_notion"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  response_status INT;
BEGIN
  IF NEW.notion_page_id IS NULL THEN
    PERFORM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/sync-cliente-to-notion',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
      ),
      body := jsonb_build_object(
        'cliente_id', NEW.id,
        'telefono', NEW.telefono,
        'nombre', NEW.nombre
      )
    );
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to sync cliente to Notion: %', SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_new_cliente_to_notion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_activar_referido_primer_servicio"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  v_es_primer_servicio BOOLEAN;
  v_resultado JSONB;
BEGIN
  SELECT NOT EXISTS(
    SELECT 1 FROM public.historial_servicios
    WHERE cliente_id = NEW.cliente_id
      AND id != NEW.id
  ) INTO v_es_primer_servicio;
  
  IF v_es_primer_servicio THEN
    v_resultado := public.activar_referido(NEW.cliente_id);
    
    IF (v_resultado->>'success')::boolean THEN
      RAISE NOTICE 'Referido activado para cliente %: %', NEW.cliente_id, v_resultado;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_activar_referido_primer_servicio"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_config_global_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_config_global_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validar_datos_producto"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF NEW.nombre IS NULL OR TRIM(NEW.nombre) = '' THEN
        RAISE EXCEPTION 'El nombre del producto no puede estar vacío.';
    END IF;
    IF NEW.puntos_requeridos IS NULL OR NEW.puntos_requeridos <= 0 THEN
        RAISE EXCEPTION 'Los puntos requeridos deben ser un número positivo.';
    END IF;
    IF NEW.tipo = 'producto' AND (NEW.stock IS NULL OR NEW.stock < 0) THEN
        RAISE EXCEPTION 'El stock para un producto físico no puede ser negativo.';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validar_datos_producto"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validar_puntos_cliente"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF NEW.puntos_actuales < 0 THEN
        RAISE EXCEPTION 'Los puntos de un cliente no pueden ser negativos. Intento de poner % puntos.', NEW.puntos_actuales;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validar_puntos_cliente"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_client_pin"("telefono_input" "text", "pin_input" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  found_client public.clientes%ROWTYPE;
BEGIN
  SELECT * INTO found_client
  FROM public.clientes
  WHERE telefono = telefono_input;

  IF found_client IS NULL THEN
    RETURN NULL;
  END IF;

  IF found_client.pin = extensions.crypt(pin_input, found_client.pin) THEN
    RETURN to_jsonb(found_client) - 'pin';
  ELSE
    RETURN NULL;
  END IF;
END;
$$;


ALTER FUNCTION "public"."verify_client_pin"("telefono_input" "text", "pin_input" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_client_pin_secure"("telefono_input" "text", "pin_input" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  v_cliente RECORD;
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

  -- Verificar PIN con bcrypt (usando extensions.crypt)
  IF v_cliente.pin_hash = extensions.crypt(pin_input, v_cliente.pin_hash) THEN
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


ALTER FUNCTION "public"."verify_client_pin_secure"("telefono_input" "text", "pin_input" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."verify_client_pin_secure"("telefono_input" "text", "pin_input" "text") IS 'Verifica PIN con rate limiting - usa extensions.crypt';



CREATE OR REPLACE FUNCTION "public"."verify_pin_hash"("pin" "text", "hash" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF hash IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN extensions.crypt(pin, hash) = hash;
END;
$$;


ALTER FUNCTION "public"."verify_pin_hash"("pin" "text", "hash" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_role_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "changed_by_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "admin_role_logs_action_check" CHECK (("action" = ANY (ARRAY['granted'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."admin_role_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "action" "text" NOT NULL,
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "cliente_id" "uuid",
    "ip_address" "text",
    "user_agent" "text",
    "success" boolean DEFAULT true NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."audit_log" IS 'Log de auditoría para operaciones críticas del sistema.';



CREATE TABLE IF NOT EXISTS "public"."beneficios_cliente" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "link_regalo_id" "uuid" NOT NULL,
    "tipo" character varying(20) NOT NULL,
    "nombre" "text" NOT NULL,
    "descripcion" "text",
    "terminos" "text",
    "instrucciones" "text",
    "puntos_otorgados" integer DEFAULT 0,
    "estado" character varying(20) DEFAULT 'activo'::character varying,
    "fecha_canje" timestamp with time zone DEFAULT "now"(),
    "fecha_uso" timestamp with time zone,
    "fecha_expiracion" timestamp with time zone,
    "notas_uso" "text",
    "verificado_por" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "notion_ticket_id" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "beneficios_cliente_estado_check" CHECK ((("estado")::"text" = ANY ((ARRAY['activo'::character varying, 'usado'::character varying, 'expirado'::character varying, 'cancelado'::character varying])::"text"[])))
);


ALTER TABLE "public"."beneficios_cliente" OWNER TO "postgres";


COMMENT ON COLUMN "public"."beneficios_cliente"."notion_ticket_id" IS 'ID de página en Notion Tickets Manny (para cierre automático cuando ticket se completa)';



CREATE TABLE IF NOT EXISTS "public"."canjes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "cliente_id" "uuid",
    "producto_id" "uuid",
    "puntos_usados" integer NOT NULL,
    "estado" "text" NOT NULL,
    "fecha_entrega" timestamp with time zone,
    "tipo_producto_original" "text",
    "notion_page_id" "text",
    "notion_ticket_id" "text",
    "notion_reward_id" "text",
    CONSTRAINT "canjes_estado_check" CHECK (("estado" = ANY (ARRAY['guardado'::"text", 'pendiente_entrega'::"text", 'en_lista'::"text", 'agendado'::"text", 'entregado'::"text", 'completado'::"text", 'cancelado'::"text"])))
);


ALTER TABLE "public"."canjes" OWNER TO "postgres";


COMMENT ON TABLE "public"."canjes" IS 'Registro de canjes realizados por clientes';



COMMENT ON COLUMN "public"."canjes"."estado" IS 'Estados posibles: guardado (recompensa disponible), pendiente_entrega, en_lista, entregado, completado, agendado, cancelado';



COMMENT ON COLUMN "public"."canjes"."notion_page_id" IS 'ID de página en Notion Manny Rewards DB (registro de puntos/canjes)';



COMMENT ON COLUMN "public"."canjes"."notion_ticket_id" IS 'ID de página en Notion Tickets Manny (para cierre automático cuando ticket se completa)';



CREATE TABLE IF NOT EXISTS "public"."codigos_referido" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "codigo" character varying(8) NOT NULL,
    "activo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."codigos_referido" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."config_global" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clave" "text" NOT NULL,
    "valor" "jsonb" NOT NULL,
    "descripcion" "text",
    "categoria" "text" DEFAULT 'general'::"text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."config_global" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."config_recordatorios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activo" boolean DEFAULT true,
    "max_notificaciones_mes" integer DEFAULT 1,
    "titulo_default" "text" DEFAULT '¿Tiempo de dar mantenimiento?'::"text",
    "mensaje_default" "text" DEFAULT 'Han pasado {dias} días desde tu último servicio de {tipo}. El mantenimiento regular ayuda a prolongar la vida útil de tus equipos.'::"text",
    "hora_envio" integer DEFAULT 10,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."config_recordatorios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."config_referidos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activo" boolean DEFAULT true,
    "puntos_referidor" integer DEFAULT 100,
    "puntos_referido" integer DEFAULT 50,
    "limite_mensual" integer DEFAULT 1000,
    "limite_total" integer DEFAULT 10000,
    "max_referidos_mes" integer DEFAULT 10,
    "dias_expiracion" integer DEFAULT 90,
    "mensaje_compartir" "text" DEFAULT '¡Únete a Manny Rewards! Usa mi link y ambos ganamos puntos cuando contrates tu primer servicio.'::"text",
    "titulo_landing" "text" DEFAULT '¡Tu amigo te invitó!'::"text",
    "subtitulo_landing" "text" DEFAULT 'Únete a Manny Rewards y recibe puntos de bienvenida después de tu primer servicio'::"text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."config_referidos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."links_regalo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo" character varying(12) NOT NULL,
    "tipo" character varying(20) NOT NULL,
    "nombre_beneficio" "text",
    "descripcion_beneficio" "text",
    "puntos_regalo" integer,
    "mensaje_personalizado" "text",
    "imagen_url" "text",
    "creado_por" "uuid",
    "destinatario_telefono" character varying(15),
    "estado" character varying(20) DEFAULT 'pendiente'::character varying,
    "canjeado_por" "uuid",
    "fecha_canje" timestamp with time zone,
    "fecha_expiracion" timestamp with time zone,
    "veces_visto" integer DEFAULT 0,
    "ultima_vista" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "es_campana" boolean DEFAULT false,
    "nombre_campana" "text",
    "max_canjes" integer DEFAULT 1,
    "canjes_realizados" integer DEFAULT 0,
    "terminos_condiciones" "text",
    "instrucciones_uso" "text",
    "vigencia_beneficio" integer DEFAULT 365,
    "requiere_verificacion" boolean DEFAULT false,
    "imagen_banner" "text",
    "color_tema" character varying(7) DEFAULT '#E91E63'::character varying,
    CONSTRAINT "links_regalo_estado_check" CHECK ((("estado")::"text" = ANY (ARRAY['pendiente'::"text", 'canjeado'::"text", 'expirado'::"text", 'agotado'::"text"]))),
    CONSTRAINT "links_regalo_tipo_check" CHECK ((("tipo")::"text" = ANY ((ARRAY['servicio'::character varying, 'puntos'::character varying])::"text"[])))
);


ALTER TABLE "public"."links_regalo" OWNER TO "postgres";


COMMENT ON COLUMN "public"."links_regalo"."es_campana" IS 'Si es true, el link puede ser usado por múltiples personas';



COMMENT ON COLUMN "public"."links_regalo"."nombre_campana" IS 'Nombre interno de la campaña (ej: Navidad 2024)';



COMMENT ON COLUMN "public"."links_regalo"."max_canjes" IS 'Máximo número de personas que pueden canjear (NULL = ilimitado)';



COMMENT ON COLUMN "public"."links_regalo"."canjes_realizados" IS 'Contador de canjes realizados';



COMMENT ON COLUMN "public"."links_regalo"."terminos_condiciones" IS 'Texto con términos y condiciones/cláusulas del beneficio';



COMMENT ON COLUMN "public"."links_regalo"."instrucciones_uso" IS 'Instrucciones de cómo usar el beneficio';



COMMENT ON COLUMN "public"."links_regalo"."vigencia_beneficio" IS 'Días que tiene el cliente para USAR el beneficio después de canjearlo';



COMMENT ON COLUMN "public"."links_regalo"."requiere_verificacion" IS 'Si el admin debe verificar manualmente antes de entregar';



COMMENT ON COLUMN "public"."links_regalo"."imagen_banner" IS 'URL de imagen decorativa/banner para la landing';



COMMENT ON COLUMN "public"."links_regalo"."color_tema" IS 'Color hex para personalizar la landing';



CREATE OR REPLACE VIEW "public"."gift_analytics" WITH ("security_invoker"='true') AS
 SELECT "lr"."id",
    "lr"."codigo",
    "lr"."nombre_campana",
    "lr"."es_campana",
    "lr"."tipo",
    "lr"."puntos_regalo",
    "lr"."nombre_beneficio",
    "lr"."descripcion_beneficio",
    "lr"."estado",
    "lr"."max_canjes",
    "lr"."canjes_realizados",
    "lr"."veces_visto" AS "vistas",
    "lr"."created_at" AS "fecha_creacion",
    "lr"."fecha_expiracion",
        CASE
            WHEN ("lr"."veces_visto" > 0) THEN "round"(((("lr"."canjes_realizados")::numeric / ("lr"."veces_visto")::numeric) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS "tasa_conversion",
        CASE
            WHEN ("lr"."es_campana" AND ("lr"."max_canjes" > 0)) THEN "round"(((("lr"."canjes_realizados")::numeric / ("lr"."max_canjes")::numeric) * (100)::numeric), 2)
            ELSE NULL::numeric
        END AS "porcentaje_agotamiento",
    "creador"."nombre" AS "creador_nombre",
    ( SELECT "count"(*) AS "count"
           FROM "public"."beneficios_cliente" "bc"
          WHERE (("bc"."link_regalo_id" = "lr"."id") AND (("bc"."estado")::"text" = 'activo'::"text"))) AS "beneficios_activos",
    ( SELECT "count"(*) AS "count"
           FROM "public"."beneficios_cliente" "bc"
          WHERE (("bc"."link_regalo_id" = "lr"."id") AND (("bc"."estado")::"text" = 'usado'::"text"))) AS "beneficios_usados"
   FROM ("public"."links_regalo" "lr"
     LEFT JOIN "public"."clientes" "creador" ON (("creador"."id" = "lr"."creado_por")));


ALTER VIEW "public"."gift_analytics" OWNER TO "postgres";


COMMENT ON VIEW "public"."gift_analytics" IS 'Vista de analytics de regalos con SECURITY INVOKER para respetar RLS';



CREATE TABLE IF NOT EXISTS "public"."historial_puntos" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "cliente_id" "uuid",
    "puntos" integer NOT NULL,
    "concepto" "text" NOT NULL,
    "canje_id" "uuid"
);


ALTER TABLE "public"."historial_puntos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."historial_servicios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cliente_id" "uuid",
    "notion_ticket_id" "text" NOT NULL,
    "ticket_number" "text" NOT NULL,
    "tipo_trabajo" "text",
    "titulo" "text",
    "descripcion" "text",
    "monto" numeric(10,2),
    "puntos_generados" integer,
    "fecha_servicio" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."historial_servicios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cliente_id" "uuid",
    "tipo" "text" NOT NULL,
    "titulo" "text" NOT NULL,
    "mensaje" "text" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb",
    "sent_at" timestamp with time zone DEFAULT "now"(),
    "success" boolean DEFAULT true,
    "error_message" "text"
);


ALTER TABLE "public"."notification_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pin_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "telefono" "text" NOT NULL,
    "ip_address" "text",
    "attempted_at" timestamp without time zone DEFAULT "now"(),
    "success" boolean DEFAULT false
);


ALTER TABLE "public"."pin_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."productos" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "nombre" "text" NOT NULL,
    "descripcion" "text",
    "tipo" "text" NOT NULL,
    "puntos_requeridos" integer NOT NULL,
    "stock" integer DEFAULT 999,
    "activo" boolean DEFAULT true,
    "imagen_url" "text",
    "categoria" "text",
    CONSTRAINT "productos_puntos_requeridos_check" CHECK (("puntos_requeridos" > 0)),
    CONSTRAINT "productos_stock_check" CHECK (("stock" >= 0)),
    CONSTRAINT "productos_tipo_check" CHECK (("tipo" = ANY (ARRAY['producto'::"text", 'servicio'::"text"])))
);


ALTER TABLE "public"."productos" OWNER TO "postgres";


COMMENT ON TABLE "public"."productos" IS 'Catálogo de productos/servicios canjeables por puntos';



CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cliente_id" "uuid",
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "is_admin" boolean DEFAULT false,
    "device_info" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."recompensas_disponibles" WITH ("security_invoker"='true') AS
 SELECT "c"."id",
    "c"."cliente_id",
    "c"."producto_id",
    "c"."puntos_usados",
    "c"."created_at",
    "p"."nombre" AS "producto_nombre",
    "p"."descripcion" AS "producto_descripcion",
    "p"."tipo" AS "producto_tipo",
    "p"."imagen_url" AS "producto_imagen"
   FROM ("public"."canjes" "c"
     JOIN "public"."productos" "p" ON (("c"."producto_id" = "p"."id")))
  WHERE ("c"."estado" = 'guardado'::"text")
  ORDER BY "c"."created_at" DESC;


ALTER VIEW "public"."recompensas_disponibles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recordatorios_enviados" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cliente_id" "uuid",
    "tipo_trabajo" "text" NOT NULL,
    "servicio_id" "uuid",
    "enviado_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."recordatorios_enviados" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."referidos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "referidor_id" "uuid" NOT NULL,
    "referido_id" "uuid" NOT NULL,
    "codigo_usado" character varying(8) NOT NULL,
    "estado" character varying(20) DEFAULT 'pendiente'::character varying,
    "puntos_referidor" integer DEFAULT 0,
    "puntos_referido" integer DEFAULT 0,
    "fecha_activacion" timestamp with time zone,
    "fecha_expiracion" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "referidos_estado_check" CHECK ((("estado")::"text" = ANY ((ARRAY['pendiente'::character varying, 'activo'::character varying, 'expirado'::character varying, 'cancelado'::character varying])::"text"[])))
);


ALTER TABLE "public"."referidos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."servicios_asignados" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cliente_id" "uuid",
    "nombre" "text" NOT NULL,
    "descripcion" "text",
    "estado" "text" DEFAULT 'disponible'::"text",
    "fecha_asignacion" timestamp with time zone DEFAULT "now"(),
    "fecha_canje" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "servicios_asignados_estado_check" CHECK (("estado" = ANY (ARRAY['disponible'::"text", 'canjeado'::"text"])))
);


ALTER TABLE "public"."servicios_asignados" OWNER TO "postgres";


COMMENT ON TABLE "public"."servicios_asignados" IS 'Servicios/beneficios precargados para clientes Partner que pueden canjear';



CREATE OR REPLACE VIEW "public"."stats_campanas" AS
SELECT
    NULL::"uuid" AS "id",
    NULL::character varying(12) AS "codigo",
    NULL::"text" AS "nombre_campana",
    NULL::character varying(20) AS "tipo",
    NULL::boolean AS "es_campana",
    NULL::integer AS "max_canjes",
    NULL::integer AS "canjes_realizados",
    NULL::integer AS "veces_visto",
    NULL::character varying(20) AS "estado",
    NULL::timestamp with time zone AS "created_at",
    NULL::timestamp with time zone AS "fecha_expiracion",
    NULL::bigint AS "total_beneficiarios",
    NULL::bigint AS "total_puntos_otorgados";


ALTER VIEW "public"."stats_campanas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sync_failures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sync_type" "text" NOT NULL,
    "resource_id" "uuid" NOT NULL,
    "error_message" "text",
    "retry_count" integer DEFAULT 0,
    "last_retry_at" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "resolved_at" timestamp without time zone
);


ALTER TABLE "public"."sync_failures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sync_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "operation_type" "text" NOT NULL,
    "resource_id" "uuid" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "retry_count" integer DEFAULT 0 NOT NULL,
    "max_retries" integer DEFAULT 5 NOT NULL,
    "next_retry_at" timestamp with time zone,
    "last_error" "text",
    "error_history" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "source" "text" DEFAULT 'app'::"text",
    "source_context" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "sync_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text", 'dead_letter'::"text"])))
);


ALTER TABLE "public"."sync_queue" OWNER TO "postgres";


COMMENT ON TABLE "public"."sync_queue" IS 'Cola de operaciones de sincronización con Notion. Permite reintentos con backoff exponencial.';



CREATE OR REPLACE VIEW "public"."sync_queue_stats" WITH ("security_invoker"='true') AS
 SELECT "status",
    "operation_type",
    "count"(*) AS "count",
    "min"("created_at") AS "oldest",
    "max"("created_at") AS "newest",
    ("avg"("retry_count"))::numeric(10,2) AS "avg_retries"
   FROM "public"."sync_queue"
  WHERE ("created_at" > ("now"() - '7 days'::interval))
  GROUP BY "status", "operation_type"
  ORDER BY "status", "operation_type";


ALTER VIEW "public"."sync_queue_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ticket_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source" "text" DEFAULT 'notion'::"text" NOT NULL,
    "source_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "payload" "jsonb",
    "status" "text" DEFAULT 'processed'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ticket_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tipos_servicio_recurrente" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tipo_trabajo" "text" NOT NULL,
    "dias_recordatorio" integer DEFAULT 180 NOT NULL,
    "activo" boolean DEFAULT true,
    "mensaje_personalizado" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tipos_servicio_recurrente" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."webhook_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "webhook_type" "text" NOT NULL,
    "source_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "processed_at" timestamp without time zone DEFAULT "now"(),
    "payload" "jsonb"
);


ALTER TABLE "public"."webhook_events" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_role_logs"
    ADD CONSTRAINT "admin_role_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."beneficios_cliente"
    ADD CONSTRAINT "beneficios_cliente_cliente_id_link_regalo_id_key" UNIQUE ("cliente_id", "link_regalo_id");



ALTER TABLE ONLY "public"."beneficios_cliente"
    ADD CONSTRAINT "beneficios_cliente_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."canjes"
    ADD CONSTRAINT "canjes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_telefono_key" UNIQUE ("telefono");



ALTER TABLE ONLY "public"."codigos_referido"
    ADD CONSTRAINT "codigos_referido_cliente_id_key" UNIQUE ("cliente_id");



ALTER TABLE ONLY "public"."codigos_referido"
    ADD CONSTRAINT "codigos_referido_codigo_key" UNIQUE ("codigo");



ALTER TABLE ONLY "public"."codigos_referido"
    ADD CONSTRAINT "codigos_referido_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."config_global"
    ADD CONSTRAINT "config_global_clave_key" UNIQUE ("clave");



ALTER TABLE ONLY "public"."config_global"
    ADD CONSTRAINT "config_global_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."config_recordatorios"
    ADD CONSTRAINT "config_recordatorios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."config_referidos"
    ADD CONSTRAINT "config_referidos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historial_puntos"
    ADD CONSTRAINT "historial_puntos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historial_servicios"
    ADD CONSTRAINT "historial_servicios_notion_ticket_id_key" UNIQUE ("notion_ticket_id");



ALTER TABLE ONLY "public"."historial_servicios"
    ADD CONSTRAINT "historial_servicios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."links_regalo"
    ADD CONSTRAINT "links_regalo_codigo_key" UNIQUE ("codigo");



ALTER TABLE ONLY "public"."links_regalo"
    ADD CONSTRAINT "links_regalo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_history"
    ADD CONSTRAINT "notification_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pin_attempts"
    ADD CONSTRAINT "pin_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos"
    ADD CONSTRAINT "productos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_endpoint_key" UNIQUE ("endpoint");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recordatorios_enviados"
    ADD CONSTRAINT "recordatorios_enviados_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referidos"
    ADD CONSTRAINT "referidos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referidos"
    ADD CONSTRAINT "referidos_referido_id_key" UNIQUE ("referido_id");



ALTER TABLE ONLY "public"."servicios_asignados"
    ADD CONSTRAINT "servicios_asignados_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sync_failures"
    ADD CONSTRAINT "sync_failures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sync_queue"
    ADD CONSTRAINT "sync_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ticket_events"
    ADD CONSTRAINT "ticket_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tipos_servicio_recurrente"
    ADD CONSTRAINT "tipos_servicio_recurrente_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tipos_servicio_recurrente"
    ADD CONSTRAINT "tipos_servicio_recurrente_tipo_trabajo_key" UNIQUE ("tipo_trabajo");



ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "webhook_events_webhook_type_source_id_event_type_key" UNIQUE ("webhook_type", "source_id", "event_type");



CREATE INDEX "idx_admin_role_logs_changed_by" ON "public"."admin_role_logs" USING "btree" ("changed_by_id");



CREATE INDEX "idx_admin_role_logs_cliente" ON "public"."admin_role_logs" USING "btree" ("cliente_id");



CREATE INDEX "idx_audit_log_cliente" ON "public"."audit_log" USING "btree" ("cliente_id") WHERE ("cliente_id" IS NOT NULL);



CREATE INDEX "idx_beneficios_cliente_cliente" ON "public"."beneficios_cliente" USING "btree" ("cliente_id");



CREATE INDEX "idx_beneficios_cliente_estado" ON "public"."beneficios_cliente" USING "btree" ("estado");



CREATE INDEX "idx_beneficios_cliente_link" ON "public"."beneficios_cliente" USING "btree" ("link_regalo_id");



CREATE INDEX "idx_beneficios_cliente_verificado_por" ON "public"."beneficios_cliente" USING "btree" ("verificado_por");



COMMENT ON INDEX "public"."idx_beneficios_cliente_verificado_por" IS 'FK index - keep for CASCADE DELETE performance';



CREATE INDEX "idx_canjes_cliente_id" ON "public"."canjes" USING "btree" ("cliente_id");



CREATE INDEX "idx_canjes_estado" ON "public"."canjes" USING "btree" ("estado");



CREATE INDEX "idx_canjes_producto_id" ON "public"."canjes" USING "btree" ("producto_id");



COMMENT ON INDEX "public"."idx_canjes_producto_id" IS 'Índice para FK canjes_producto_id_fkey - mejora performance de JOINs';



CREATE INDEX "idx_clientes_nivel_nombre" ON "public"."clientes" USING "btree" ("nivel", "nombre");



CREATE INDEX "idx_clientes_notion_page_id" ON "public"."clientes" USING "btree" ("notion_page_id");



CREATE UNIQUE INDEX "idx_clientes_notion_page_id_unique" ON "public"."clientes" USING "btree" (NULLIF("notion_page_id", ''::"text"));



CREATE INDEX "idx_clientes_referido_por" ON "public"."clientes" USING "btree" ("referido_por");



COMMENT ON INDEX "public"."idx_clientes_referido_por" IS 'FK index - keep for CASCADE DELETE performance';



CREATE INDEX "idx_clientes_telefono" ON "public"."clientes" USING "btree" ("telefono");



CREATE INDEX "idx_codigos_referido_codigo" ON "public"."codigos_referido" USING "btree" ("codigo");



CREATE INDEX "idx_historial_cliente" ON "public"."historial_servicios" USING "btree" ("cliente_id");



CREATE INDEX "idx_historial_fecha" ON "public"."historial_servicios" USING "btree" ("fecha_servicio" DESC);



CREATE INDEX "idx_historial_puntos_canje_id" ON "public"."historial_puntos" USING "btree" ("canje_id");



CREATE INDEX "idx_historial_puntos_cliente_id" ON "public"."historial_puntos" USING "btree" ("cliente_id");



CREATE INDEX "idx_historial_tipo" ON "public"."historial_servicios" USING "btree" ("tipo_trabajo") WHERE ("tipo_trabajo" IS NOT NULL);



CREATE INDEX "idx_links_regalo_canjeado_por" ON "public"."links_regalo" USING "btree" ("canjeado_por");



COMMENT ON INDEX "public"."idx_links_regalo_canjeado_por" IS 'FK index - keep for CASCADE DELETE performance';



CREATE INDEX "idx_links_regalo_creado_por" ON "public"."links_regalo" USING "btree" ("creado_por");



COMMENT ON INDEX "public"."idx_links_regalo_creado_por" IS 'FK index - keep for CASCADE DELETE performance';



CREATE INDEX "idx_links_regalo_estado" ON "public"."links_regalo" USING "btree" ("estado");



CREATE INDEX "idx_notification_history_cliente_id" ON "public"."notification_history" USING "btree" ("cliente_id");



CREATE INDEX "idx_pin_attempts_telefono_time" ON "public"."pin_attempts" USING "btree" ("telefono", "attempted_at" DESC);



CREATE INDEX "idx_push_subscriptions_admin" ON "public"."push_subscriptions" USING "btree" ("is_admin") WHERE ("is_admin" = true);



CREATE INDEX "idx_push_subscriptions_cliente" ON "public"."push_subscriptions" USING "btree" ("cliente_id");



CREATE INDEX "idx_recordatorios_cliente_mes" ON "public"."recordatorios_enviados" USING "btree" ("cliente_id", "enviado_at" DESC);



CREATE INDEX "idx_recordatorios_servicio_id" ON "public"."recordatorios_enviados" USING "btree" ("servicio_id");



COMMENT ON INDEX "public"."idx_recordatorios_servicio_id" IS 'Índice para FK recordatorios_enviados_servicio_id_fkey';



CREATE INDEX "idx_referidos_estado" ON "public"."referidos" USING "btree" ("estado");



CREATE INDEX "idx_referidos_referidor" ON "public"."referidos" USING "btree" ("referidor_id");



CREATE INDEX "idx_servicios_asignados_cliente" ON "public"."servicios_asignados" USING "btree" ("cliente_id");



CREATE INDEX "idx_sync_queue_status_next_retry" ON "public"."sync_queue" USING "btree" ("status", "next_retry_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'failed'::"text"]));



CREATE UNIQUE INDEX "idx_ticket_events_unique" ON "public"."ticket_events" USING "btree" ("source", "source_id", "event_type");



CREATE OR REPLACE VIEW "public"."stats_campanas" WITH ("security_invoker"='true') AS
 SELECT "lr"."id",
    "lr"."codigo",
    "lr"."nombre_campana",
    "lr"."tipo",
    "lr"."es_campana",
    "lr"."max_canjes",
    "lr"."canjes_realizados",
    "lr"."veces_visto",
    "lr"."estado",
    "lr"."created_at",
    "lr"."fecha_expiracion",
    "count"("bc"."id") AS "total_beneficiarios",
    COALESCE("sum"("bc"."puntos_otorgados"), (0)::bigint) AS "total_puntos_otorgados"
   FROM ("public"."links_regalo" "lr"
     LEFT JOIN "public"."beneficios_cliente" "bc" ON (("bc"."link_regalo_id" = "lr"."id")))
  WHERE ("lr"."es_campana" = true)
  GROUP BY "lr"."id";



CREATE OR REPLACE TRIGGER "clientes_before_update_normalize_source" BEFORE UPDATE OF "nombre", "telefono", "puntos_actuales" ON "public"."clientes" FOR EACH ROW EXECUTE FUNCTION "public"."clientes_before_update_normalize_source"();



CREATE OR REPLACE TRIGGER "config_global_updated_at" BEFORE UPDATE ON "public"."config_global" FOR EACH ROW EXECUTE FUNCTION "public"."update_config_global_updated_at"();



CREATE OR REPLACE TRIGGER "on_sync_queue_insert" AFTER INSERT ON "public"."sync_queue" FOR EACH ROW EXECUTE FUNCTION "supabase_functions"."http_request"('https://kuftyqupibyjliaukpxn.supabase.co/functions/v1/process-sync-queue', 'POST', '{"Content-Type":"application/json","x-webhook-source":"database"}', '{}', '5000');



CREATE OR REPLACE TRIGGER "trg_validar_datos_producto" BEFORE INSERT OR UPDATE ON "public"."productos" FOR EACH ROW EXECUTE FUNCTION "public"."validar_datos_producto"();



CREATE OR REPLACE TRIGGER "trg_validar_puntos_cliente" BEFORE UPDATE OF "puntos_actuales" ON "public"."clientes" FOR EACH ROW EXECUTE FUNCTION "public"."validar_puntos_cliente"();



CREATE OR REPLACE TRIGGER "trigger_referido_primer_servicio" AFTER INSERT ON "public"."historial_servicios" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_activar_referido_primer_servicio"();



ALTER TABLE ONLY "public"."admin_role_logs"
    ADD CONSTRAINT "admin_role_logs_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_role_logs"
    ADD CONSTRAINT "admin_role_logs_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."beneficios_cliente"
    ADD CONSTRAINT "beneficios_cliente_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."beneficios_cliente"
    ADD CONSTRAINT "beneficios_cliente_link_regalo_id_fkey" FOREIGN KEY ("link_regalo_id") REFERENCES "public"."links_regalo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."beneficios_cliente"
    ADD CONSTRAINT "beneficios_cliente_verificado_por_fkey" FOREIGN KEY ("verificado_por") REFERENCES "public"."clientes"("id");



ALTER TABLE ONLY "public"."canjes"
    ADD CONSTRAINT "canjes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."canjes"
    ADD CONSTRAINT "canjes_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_referido_por_fkey" FOREIGN KEY ("referido_por") REFERENCES "public"."clientes"("id");



ALTER TABLE ONLY "public"."codigos_referido"
    ADD CONSTRAINT "codigos_referido_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."historial_puntos"
    ADD CONSTRAINT "historial_puntos_canje_id_fkey" FOREIGN KEY ("canje_id") REFERENCES "public"."canjes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."historial_puntos"
    ADD CONSTRAINT "historial_puntos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."historial_servicios"
    ADD CONSTRAINT "historial_servicios_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."links_regalo"
    ADD CONSTRAINT "links_regalo_canjeado_por_fkey" FOREIGN KEY ("canjeado_por") REFERENCES "public"."clientes"("id");



ALTER TABLE ONLY "public"."links_regalo"
    ADD CONSTRAINT "links_regalo_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."clientes"("id");



ALTER TABLE ONLY "public"."notification_history"
    ADD CONSTRAINT "notification_history_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recordatorios_enviados"
    ADD CONSTRAINT "recordatorios_enviados_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recordatorios_enviados"
    ADD CONSTRAINT "recordatorios_enviados_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "public"."historial_servicios"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."referidos"
    ADD CONSTRAINT "referidos_referido_id_fkey" FOREIGN KEY ("referido_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."referidos"
    ADD CONSTRAINT "referidos_referidor_id_fkey" FOREIGN KEY ("referidor_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."servicios_asignados"
    ADD CONSTRAINT "servicios_asignados_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can insert role logs" ON "public"."admin_role_logs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."clientes"
  WHERE (("clientes"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("clientes"."es_admin" = true)))));



CREATE POLICY "Admins can view role logs" ON "public"."admin_role_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."clientes"
  WHERE (("clientes"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("clientes"."es_admin" = true)))));



ALTER TABLE "public"."admin_role_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_log_insert_service" ON "public"."audit_log" FOR INSERT WITH CHECK ((( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text"));



CREATE POLICY "audit_log_select_admin" ON "public"."audit_log" FOR SELECT USING (("public"."get_current_is_admin"() OR (( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text")));



ALTER TABLE "public"."beneficios_cliente" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "beneficios_cliente_insert_service" ON "public"."beneficios_cliente" FOR INSERT WITH CHECK ((( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text"));



CREATE POLICY "beneficios_cliente_select_own_or_admin" ON "public"."beneficios_cliente" FOR SELECT USING ("public"."is_own_or_admin"("cliente_id"));



CREATE POLICY "beneficios_cliente_update_admin_or_service" ON "public"."beneficios_cliente" FOR UPDATE USING (("public"."get_current_is_admin"() OR (( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text")));



CREATE POLICY "beneficios_insert_service" ON "public"."beneficios_cliente" FOR INSERT WITH CHECK (true);



CREATE POLICY "beneficios_select_all" ON "public"."beneficios_cliente" FOR SELECT USING (true);



CREATE POLICY "beneficios_update_service" ON "public"."beneficios_cliente" FOR UPDATE USING (true);



ALTER TABLE "public"."canjes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "canjes_delete_service_role" ON "public"."canjes" FOR DELETE USING ((( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text"));



CREATE POLICY "canjes_insert_own_or_service" ON "public"."canjes" FOR INSERT WITH CHECK (((( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text") OR ("cliente_id" = ( SELECT "public"."get_current_cliente_id"() AS "get_current_cliente_id"))));



CREATE POLICY "canjes_insert_service" ON "public"."canjes" FOR INSERT WITH CHECK (true);



CREATE POLICY "canjes_select_all" ON "public"."canjes" FOR SELECT USING (true);



CREATE POLICY "canjes_select_own_or_admin" ON "public"."canjes" FOR SELECT USING ("public"."is_own_or_admin"("cliente_id"));



CREATE POLICY "canjes_update_admin_only" ON "public"."canjes" FOR UPDATE USING ("public"."get_current_is_admin"()) WITH CHECK ("public"."get_current_is_admin"());



CREATE POLICY "canjes_update_service" ON "public"."canjes" FOR UPDATE USING (true);



ALTER TABLE "public"."clientes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clientes_delete_service_role" ON "public"."clientes" FOR DELETE USING ((( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text"));



CREATE POLICY "clientes_insert_allowed" ON "public"."clientes" FOR INSERT WITH CHECK (((( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text") OR (( SELECT "public"."get_current_cliente_id"() AS "get_current_cliente_id") IS NULL) OR (( SELECT "public"."get_current_is_admin"() AS "get_current_is_admin") = true)));



CREATE POLICY "clientes_insert_service" ON "public"."clientes" FOR INSERT WITH CHECK (true);



CREATE POLICY "clientes_select_own" ON "public"."clientes" FOR SELECT USING (true);



COMMENT ON POLICY "clientes_select_own" ON "public"."clientes" IS 'Permite lectura, pin_hash protegido por selects específicos';



CREATE POLICY "clientes_select_own_or_admin" ON "public"."clientes" FOR SELECT USING ((("public"."get_current_cliente_id"() IS NULL) OR "public"."is_own_or_admin"("id")));



CREATE POLICY "clientes_update_own_or_admin" ON "public"."clientes" FOR UPDATE USING ("public"."is_own_or_admin"("id")) WITH CHECK ("public"."is_own_or_admin"("id"));



CREATE POLICY "clientes_update_service" ON "public"."clientes" FOR UPDATE USING (true);



CREATE POLICY "codigos_modify_service" ON "public"."codigos_referido" USING (true);



ALTER TABLE "public"."codigos_referido" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "codigos_referido_insert_own" ON "public"."codigos_referido" FOR INSERT WITH CHECK ((("cliente_id" = ( SELECT "public"."get_current_cliente_id"() AS "get_current_cliente_id")) OR (( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text")));



CREATE POLICY "codigos_referido_select_all" ON "public"."codigos_referido" FOR SELECT USING (true);



CREATE POLICY "codigos_referido_update_own_or_admin" ON "public"."codigos_referido" FOR UPDATE USING ("public"."is_own_or_admin"("cliente_id"));



CREATE POLICY "codigos_select_all" ON "public"."codigos_referido" FOR SELECT USING (true);



ALTER TABLE "public"."config_global" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "config_global_modify_admin" ON "public"."config_global" TO "authenticated" USING ("public"."get_current_is_admin"()) WITH CHECK ("public"."get_current_is_admin"());



CREATE POLICY "config_global_select_authenticated" ON "public"."config_global" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."config_recordatorios" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "config_recordatorios_delete_admin" ON "public"."config_recordatorios" FOR DELETE USING ("public"."get_current_is_admin"());



CREATE POLICY "config_recordatorios_insert_admin" ON "public"."config_recordatorios" FOR INSERT WITH CHECK ("public"."get_current_is_admin"());



CREATE POLICY "config_recordatorios_select_all" ON "public"."config_recordatorios" FOR SELECT USING (true);



CREATE POLICY "config_recordatorios_update_admin" ON "public"."config_recordatorios" FOR UPDATE USING ("public"."get_current_is_admin"());



ALTER TABLE "public"."config_referidos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "config_referidos_delete_admin" ON "public"."config_referidos" FOR DELETE USING ("public"."get_current_is_admin"());



CREATE POLICY "config_referidos_insert_admin" ON "public"."config_referidos" FOR INSERT WITH CHECK ("public"."get_current_is_admin"());



CREATE POLICY "config_referidos_modify" ON "public"."config_referidos" USING (true);



CREATE POLICY "config_referidos_select" ON "public"."config_referidos" FOR SELECT USING (true);



CREATE POLICY "config_referidos_select_all" ON "public"."config_referidos" FOR SELECT USING (true);



CREATE POLICY "config_referidos_update_admin" ON "public"."config_referidos" FOR UPDATE USING ("public"."get_current_is_admin"());



CREATE POLICY "hist_servicios_modify" ON "public"."historial_servicios" USING (true);



CREATE POLICY "hist_servicios_select" ON "public"."historial_servicios" FOR SELECT USING (true);



CREATE POLICY "historial_insert_service" ON "public"."historial_puntos" FOR INSERT WITH CHECK (true);



ALTER TABLE "public"."historial_puntos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "historial_puntos_delete_service" ON "public"."historial_puntos" FOR DELETE USING ((( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text"));



CREATE POLICY "historial_puntos_insert_service" ON "public"."historial_puntos" FOR INSERT WITH CHECK ((( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text"));



CREATE POLICY "historial_puntos_select_own_or_admin" ON "public"."historial_puntos" FOR SELECT USING ("public"."is_own_or_admin"("cliente_id"));



CREATE POLICY "historial_puntos_update_service" ON "public"."historial_puntos" FOR UPDATE USING ((( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text"));



CREATE POLICY "historial_select_all" ON "public"."historial_puntos" FOR SELECT USING (true);



ALTER TABLE "public"."historial_servicios" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "historial_servicios_insert_service" ON "public"."historial_servicios" FOR INSERT WITH CHECK ((( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text"));



CREATE POLICY "historial_servicios_select_own_or_admin" ON "public"."historial_servicios" FOR SELECT USING ("public"."is_own_or_admin"("cliente_id"));



CREATE POLICY "historial_servicios_update_service" ON "public"."historial_servicios" FOR UPDATE USING ((( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text"));



CREATE POLICY "links_insert_service" ON "public"."links_regalo" FOR INSERT WITH CHECK (true);



ALTER TABLE "public"."links_regalo" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "links_regalo_delete_admin" ON "public"."links_regalo" FOR DELETE USING ("public"."get_current_is_admin"());



CREATE POLICY "links_regalo_insert_admin" ON "public"."links_regalo" FOR INSERT WITH CHECK ("public"."get_current_is_admin"());



CREATE POLICY "links_regalo_select_all" ON "public"."links_regalo" FOR SELECT USING (true);



CREATE POLICY "links_regalo_update_admin_or_service" ON "public"."links_regalo" FOR UPDATE USING (("public"."get_current_is_admin"() OR (( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text")));



CREATE POLICY "links_select_public" ON "public"."links_regalo" FOR SELECT USING (true);



CREATE POLICY "links_update_service" ON "public"."links_regalo" FOR UPDATE USING (true);



ALTER TABLE "public"."notification_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notification_history_insert_service" ON "public"."notification_history" FOR INSERT WITH CHECK ((( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text"));



CREATE POLICY "notification_history_select_own_or_admin" ON "public"."notification_history" FOR SELECT USING ("public"."is_own_or_admin"("cliente_id"));



ALTER TABLE "public"."pin_attempts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pin_attempts_service_only" ON "public"."pin_attempts" USING ((( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text")) WITH CHECK ((( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text"));



ALTER TABLE "public"."productos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "productos_delete_admin" ON "public"."productos" FOR DELETE USING ("public"."get_current_is_admin"());



CREATE POLICY "productos_delete_service" ON "public"."productos" FOR DELETE USING (true);



CREATE POLICY "productos_insert_admin" ON "public"."productos" FOR INSERT WITH CHECK ("public"."get_current_is_admin"());



CREATE POLICY "productos_insert_service" ON "public"."productos" FOR INSERT WITH CHECK (true);



CREATE POLICY "productos_select_all" ON "public"."productos" FOR SELECT USING (true);



CREATE POLICY "productos_select_public" ON "public"."productos" FOR SELECT USING (true);



CREATE POLICY "productos_update_admin" ON "public"."productos" FOR UPDATE USING ("public"."get_current_is_admin"()) WITH CHECK ("public"."get_current_is_admin"());



CREATE POLICY "productos_update_service" ON "public"."productos" FOR UPDATE USING (true);



CREATE POLICY "push_subs_all" ON "public"."push_subscriptions" USING (true);



ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "push_subscriptions_delete_own" ON "public"."push_subscriptions" FOR DELETE USING ((("cliente_id" = ( SELECT "public"."get_current_cliente_id"() AS "get_current_cliente_id")) OR (( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text")));



CREATE POLICY "push_subscriptions_insert_own" ON "public"."push_subscriptions" FOR INSERT WITH CHECK ((("cliente_id" = ( SELECT "public"."get_current_cliente_id"() AS "get_current_cliente_id")) OR (( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text")));



CREATE POLICY "push_subscriptions_select_for_sync" ON "public"."push_subscriptions" FOR SELECT USING ((("cliente_id" = ( SELECT "public"."get_current_cliente_id"() AS "get_current_cliente_id")) OR "public"."is_own_or_admin"("cliente_id") OR (( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text") OR (( SELECT "public"."get_current_cliente_id"() AS "get_current_cliente_id") IS NOT NULL)));



CREATE POLICY "push_subscriptions_update_for_sync" ON "public"."push_subscriptions" FOR UPDATE USING ((("cliente_id" = ( SELECT "public"."get_current_cliente_id"() AS "get_current_cliente_id")) OR (( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text") OR (( SELECT "public"."get_current_cliente_id"() AS "get_current_cliente_id") IS NOT NULL))) WITH CHECK ((("cliente_id" = ( SELECT "public"."get_current_cliente_id"() AS "get_current_cliente_id")) OR (( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text")));



ALTER TABLE "public"."recordatorios_enviados" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recordatorios_enviados_delete_service" ON "public"."recordatorios_enviados" FOR DELETE USING ((( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text"));



CREATE POLICY "recordatorios_enviados_insert_service" ON "public"."recordatorios_enviados" FOR INSERT WITH CHECK ((( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text"));



CREATE POLICY "recordatorios_enviados_select" ON "public"."recordatorios_enviados" FOR SELECT USING (("public"."get_current_is_admin"() OR (( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text")));



CREATE POLICY "recordatorios_enviados_update_service" ON "public"."recordatorios_enviados" FOR UPDATE USING ((( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text"));



ALTER TABLE "public"."referidos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "referidos_insert_service" ON "public"."referidos" FOR INSERT WITH CHECK (true);



CREATE POLICY "referidos_select_all" ON "public"."referidos" FOR SELECT USING (true);



CREATE POLICY "referidos_select_own_or_admin" ON "public"."referidos" FOR SELECT USING ((("referidor_id" = "public"."get_current_cliente_id"()) OR ("referido_id" = "public"."get_current_cliente_id"()) OR "public"."get_current_is_admin"()));



CREATE POLICY "referidos_update_service" ON "public"."referidos" FOR UPDATE USING (true);



ALTER TABLE "public"."servicios_asignados" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "servicios_asignados_delete_admin" ON "public"."servicios_asignados" FOR DELETE USING ("public"."get_current_is_admin"());



CREATE POLICY "servicios_asignados_insert_admin" ON "public"."servicios_asignados" FOR INSERT WITH CHECK (("public"."get_current_is_admin"() OR (( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text")));



CREATE POLICY "servicios_asignados_select_own_or_admin" ON "public"."servicios_asignados" FOR SELECT USING ("public"."is_own_or_admin"("cliente_id"));



CREATE POLICY "servicios_asignados_update_admin" ON "public"."servicios_asignados" FOR UPDATE USING (("public"."get_current_is_admin"() OR (( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text")));



CREATE POLICY "servicios_modify_service" ON "public"."servicios_asignados" USING (true);



CREATE POLICY "servicios_select_all" ON "public"."servicios_asignados" FOR SELECT USING (true);



ALTER TABLE "public"."sync_failures" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sync_failures_delete_service" ON "public"."sync_failures" FOR DELETE USING ((( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text"));



CREATE POLICY "sync_failures_insert_service" ON "public"."sync_failures" FOR INSERT WITH CHECK ((( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text"));



CREATE POLICY "sync_failures_select" ON "public"."sync_failures" FOR SELECT USING (("public"."get_current_is_admin"() OR (( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text")));



CREATE POLICY "sync_failures_update_service" ON "public"."sync_failures" FOR UPDATE USING ((( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text"));



ALTER TABLE "public"."sync_queue" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sync_queue_delete_service" ON "public"."sync_queue" FOR DELETE USING ((( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text"));



CREATE POLICY "sync_queue_insert_service" ON "public"."sync_queue" FOR INSERT WITH CHECK ((( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text"));



CREATE POLICY "sync_queue_select" ON "public"."sync_queue" FOR SELECT USING (("public"."get_current_is_admin"() OR (( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text")));



CREATE POLICY "sync_queue_update_service" ON "public"."sync_queue" FOR UPDATE USING ((( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text"));



ALTER TABLE "public"."ticket_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ticket_events_delete_service" ON "public"."ticket_events" FOR DELETE USING ((( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text"));



CREATE POLICY "ticket_events_insert_service" ON "public"."ticket_events" FOR INSERT WITH CHECK ((( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text"));



CREATE POLICY "ticket_events_select" ON "public"."ticket_events" FOR SELECT USING (("public"."get_current_is_admin"() OR (( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text")));



CREATE POLICY "ticket_events_update_service" ON "public"."ticket_events" FOR UPDATE USING ((( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text"));



CREATE POLICY "tipos_servicio_delete_admin" ON "public"."tipos_servicio_recurrente" FOR DELETE USING ("public"."get_current_is_admin"());



CREATE POLICY "tipos_servicio_insert_admin" ON "public"."tipos_servicio_recurrente" FOR INSERT WITH CHECK ("public"."get_current_is_admin"());



ALTER TABLE "public"."tipos_servicio_recurrente" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tipos_servicio_select_all" ON "public"."tipos_servicio_recurrente" FOR SELECT USING (true);



CREATE POLICY "tipos_servicio_update_admin" ON "public"."tipos_servicio_recurrente" FOR UPDATE USING ("public"."get_current_is_admin"());



ALTER TABLE "public"."webhook_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "webhook_events_insert_service" ON "public"."webhook_events" FOR INSERT WITH CHECK ((( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text"));



CREATE POLICY "webhook_events_select_admin" ON "public"."webhook_events" FOR SELECT USING (("public"."get_current_is_admin"() OR (( SELECT "current_setting"('role'::"text", true) AS "current_setting") = 'service_role'::"text")));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."activar_referido"("p_referido_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."activar_referido"("p_referido_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."activar_referido"("p_referido_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."aplicar_codigo_referido"("p_codigo" "text", "p_referido_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."aplicar_codigo_referido"("p_codigo" "text", "p_referido_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."aplicar_codigo_referido"("p_codigo" "text", "p_referido_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."aplicar_codigo_referido_v2"("p_codigo" "text", "p_nuevo_cliente_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."aplicar_codigo_referido_v2"("p_codigo" "text", "p_nuevo_cliente_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."aplicar_codigo_referido_v2"("p_codigo" "text", "p_nuevo_cliente_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."aplicar_codigo_referido_v2"("p_referido_id" "uuid", "p_codigo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."aplicar_codigo_referido_v2"("p_referido_id" "uuid", "p_codigo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."aplicar_codigo_referido_v2"("p_referido_id" "uuid", "p_codigo" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."asignar_puntos_atomico"("p_cliente_telefono" "text", "p_puntos_a_sumar" integer, "p_concepto" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."asignar_puntos_atomico"("p_cliente_telefono" "text", "p_puntos_a_sumar" integer, "p_concepto" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."asignar_puntos_atomico"("p_cliente_telefono" "text", "p_puntos_a_sumar" integer, "p_concepto" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."asignar_puntos_atomico"("p_cliente_id" "uuid", "p_puntos" integer, "p_descripcion" "text", "p_tipo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."asignar_puntos_atomico"("p_cliente_id" "uuid", "p_puntos" integer, "p_descripcion" "text", "p_tipo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."asignar_puntos_atomico"("p_cliente_id" "uuid", "p_puntos" integer, "p_descripcion" "text", "p_tipo" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."canjear_link_regalo"("p_codigo" "text", "p_telefono" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."canjear_link_regalo"("p_codigo" "text", "p_telefono" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."canjear_link_regalo"("p_codigo" "text", "p_telefono" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."canjear_link_regalo_v3"("p_codigo" "text", "p_telefono" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."canjear_link_regalo_v3"("p_codigo" "text", "p_telefono" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."canjear_link_regalo_v3"("p_codigo" "text", "p_telefono" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_cliente_exists"("telefono_input" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_cliente_exists"("telefono_input" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_cliente_exists"("telefono_input" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_pin_rate_limit"("p_telefono" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_pin_rate_limit"("p_telefono" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_pin_rate_limit"("p_telefono" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_sync_queue"("p_days_to_keep" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_sync_queue"("p_days_to_keep" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_sync_queue"("p_days_to_keep" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cliente_notificado_este_mes"("p_cliente_id" "uuid", "p_tipo_trabajo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cliente_notificado_este_mes"("p_cliente_id" "uuid", "p_tipo_trabajo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cliente_notificado_este_mes"("p_cliente_id" "uuid", "p_tipo_trabajo" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."clientes_before_update_normalize_source"() TO "anon";
GRANT ALL ON FUNCTION "public"."clientes_before_update_normalize_source"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."clientes_before_update_normalize_source"() TO "service_role";



GRANT ALL ON FUNCTION "public"."complete_sync_operation"("p_queue_id" "uuid", "p_success" boolean, "p_error" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."complete_sync_operation"("p_queue_id" "uuid", "p_success" boolean, "p_error" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_sync_operation"("p_queue_id" "uuid", "p_success" boolean, "p_error" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."crear_link_regalo"("p_tipo" character varying, "p_creado_por" "uuid", "p_nombre_beneficio" "text", "p_descripcion_beneficio" "text", "p_puntos_regalo" integer, "p_mensaje" "text", "p_destinatario_telefono" character varying, "p_dias_expiracion" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."crear_link_regalo"("p_tipo" character varying, "p_creado_por" "uuid", "p_nombre_beneficio" "text", "p_descripcion_beneficio" "text", "p_puntos_regalo" integer, "p_mensaje" "text", "p_destinatario_telefono" character varying, "p_dias_expiracion" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."crear_link_regalo"("p_tipo" character varying, "p_creado_por" "uuid", "p_nombre_beneficio" "text", "p_descripcion_beneficio" "text", "p_puntos_regalo" integer, "p_mensaje" "text", "p_destinatario_telefono" character varying, "p_dias_expiracion" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."dequeue_sync_operation"() TO "anon";
GRANT ALL ON FUNCTION "public"."dequeue_sync_operation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."dequeue_sync_operation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_sync_operation"("p_operation" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_sync_operation"("p_operation" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_sync_operation"("p_operation" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_sync_operation"("p_operation_type" "text", "p_resource_id" "uuid", "p_payload" "jsonb", "p_source" "text", "p_source_context" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_sync_operation"("p_operation_type" "text", "p_resource_id" "uuid", "p_payload" "jsonb", "p_source" "text", "p_source_context" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_sync_operation"("p_operation_type" "text", "p_resource_id" "uuid", "p_payload" "jsonb", "p_source" "text", "p_source_context" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."expire_old_gift_links"() TO "anon";
GRANT ALL ON FUNCTION "public"."expire_old_gift_links"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."expire_old_gift_links"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generar_codigo_unico"("longitud" integer, "tabla" "text", "columna" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generar_codigo_unico"("longitud" integer, "tabla" "text", "columna" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generar_codigo_unico"("longitud" integer, "tabla" "text", "columna" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_beneficios_cliente"("p_cliente_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_beneficios_cliente"("p_cliente_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_beneficios_cliente"("p_cliente_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."clientes" TO "anon";
GRANT ALL ON TABLE "public"."clientes" TO "authenticated";
GRANT ALL ON TABLE "public"."clientes" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_cliente_por_telefono"("p_telefono" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_cliente_por_telefono"("p_telefono" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_cliente_por_telefono"("p_telefono" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_config"("p_clave" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_config"("p_clave" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_config"("p_clave" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_cliente_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_cliente_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_cliente_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_user_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_user_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_dashboard_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_dashboard_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_dashboard_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_gift_analytics_summary"("p_desde" "date", "p_hasta" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_gift_analytics_summary"("p_desde" "date", "p_hasta" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_gift_analytics_summary"("p_desde" "date", "p_hasta" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_historial_stats"("p_cliente_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_historial_stats"("p_cliente_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_historial_stats"("p_cliente_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_referral_code"("p_cliente_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_referral_code"("p_cliente_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_referral_code"("p_cliente_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_referral_stats"("p_cliente_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_referral_stats"("p_cliente_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_referral_stats"("p_cliente_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_ultimo_servicio_recurrente"("p_cliente_id" "uuid", "p_tipo_trabajo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_ultimo_servicio_recurrente"("p_cliente_id" "uuid", "p_tipo_trabajo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_ultimo_servicio_recurrente"("p_cliente_id" "uuid", "p_tipo_trabajo" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hash_pin"("pin" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hash_pin"("pin" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hash_pin"("pin" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."incrementar_vistas_link"("p_codigo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."incrementar_vistas_link"("p_codigo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."incrementar_vistas_link"("p_codigo" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."invoke_process_sync_queue"() TO "anon";
GRANT ALL ON FUNCTION "public"."invoke_process_sync_queue"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."invoke_process_sync_queue"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_current_user_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_current_user_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_current_user_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_own_or_admin"("check_cliente_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_own_or_admin"("check_cliente_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_own_or_admin"("check_cliente_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_audit_event"("p_event_type" "text", "p_details" "jsonb", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."log_audit_event"("p_event_type" "text", "p_details" "jsonb", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_audit_event"("p_event_type" "text", "p_details" "jsonb", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_audit_event"("p_event_type" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_action" "text", "p_details" "jsonb", "p_cliente_id" "uuid", "p_success" boolean, "p_error_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."log_audit_event"("p_event_type" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_action" "text", "p_details" "jsonb", "p_cliente_id" "uuid", "p_success" boolean, "p_error_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_audit_event"("p_event_type" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_action" "text", "p_details" "jsonb", "p_cliente_id" "uuid", "p_success" boolean, "p_error_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."marcar_beneficio_usado"("p_beneficio_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."marcar_beneficio_usado"("p_beneficio_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."marcar_beneficio_usado"("p_beneficio_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."marcar_beneficio_usado"("p_beneficio_id" "uuid", "p_admin_id" "uuid", "p_notas" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."marcar_beneficio_usado"("p_beneficio_id" "uuid", "p_admin_id" "uuid", "p_notas" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."marcar_beneficio_usado"("p_beneficio_id" "uuid", "p_admin_id" "uuid", "p_notas" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."obtener_estadisticas_dashboard"() TO "anon";
GRANT ALL ON FUNCTION "public"."obtener_estadisticas_dashboard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."obtener_estadisticas_dashboard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."record_pin_attempt"("p_telefono" "text", "p_success" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."record_pin_attempt"("p_telefono" "text", "p_success" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_pin_attempt"("p_telefono" "text", "p_success" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."register_client_pin"("telefono_input" "text", "new_pin" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."register_client_pin"("telefono_input" "text", "new_pin" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."register_client_pin"("telefono_input" "text", "new_pin" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."register_client_pin_secure"("telefono_input" "text", "pin_input" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."register_client_pin_secure"("telefono_input" "text", "pin_input" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."register_client_pin_secure"("telefono_input" "text", "pin_input" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."registrar_canje_atomico"("p_cliente_id" "uuid", "p_producto_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."registrar_canje_atomico"("p_cliente_id" "uuid", "p_producto_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_canje_atomico"("p_cliente_id" "uuid", "p_producto_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."registrar_cliente_publico"("p_telefono" "text", "p_nombre" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."registrar_cliente_publico"("p_telefono" "text", "p_nombre" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_cliente_publico"("p_telefono" "text", "p_nombre" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_client_pin"("cliente_id_input" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reset_client_pin"("cliente_id_input" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_client_pin"("cliente_id_input" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_new_cliente_to_notion"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_new_cliente_to_notion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_new_cliente_to_notion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_activar_referido_primer_servicio"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_activar_referido_primer_servicio"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_activar_referido_primer_servicio"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_config_global_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_config_global_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_config_global_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validar_datos_producto"() TO "anon";
GRANT ALL ON FUNCTION "public"."validar_datos_producto"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validar_datos_producto"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validar_puntos_cliente"() TO "anon";
GRANT ALL ON FUNCTION "public"."validar_puntos_cliente"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validar_puntos_cliente"() TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_client_pin"("telefono_input" "text", "pin_input" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_client_pin"("telefono_input" "text", "pin_input" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_client_pin"("telefono_input" "text", "pin_input" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_client_pin_secure"("telefono_input" "text", "pin_input" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_client_pin_secure"("telefono_input" "text", "pin_input" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_client_pin_secure"("telefono_input" "text", "pin_input" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_pin_hash"("pin" "text", "hash" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_pin_hash"("pin" "text", "hash" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_pin_hash"("pin" "text", "hash" "text") TO "service_role";



GRANT ALL ON TABLE "public"."admin_role_logs" TO "anon";
GRANT ALL ON TABLE "public"."admin_role_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_role_logs" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."beneficios_cliente" TO "anon";
GRANT ALL ON TABLE "public"."beneficios_cliente" TO "authenticated";
GRANT ALL ON TABLE "public"."beneficios_cliente" TO "service_role";



GRANT ALL ON TABLE "public"."canjes" TO "anon";
GRANT ALL ON TABLE "public"."canjes" TO "authenticated";
GRANT ALL ON TABLE "public"."canjes" TO "service_role";



GRANT ALL ON TABLE "public"."codigos_referido" TO "anon";
GRANT ALL ON TABLE "public"."codigos_referido" TO "authenticated";
GRANT ALL ON TABLE "public"."codigos_referido" TO "service_role";



GRANT ALL ON TABLE "public"."config_global" TO "anon";
GRANT ALL ON TABLE "public"."config_global" TO "authenticated";
GRANT ALL ON TABLE "public"."config_global" TO "service_role";



GRANT ALL ON TABLE "public"."config_recordatorios" TO "anon";
GRANT ALL ON TABLE "public"."config_recordatorios" TO "authenticated";
GRANT ALL ON TABLE "public"."config_recordatorios" TO "service_role";



GRANT ALL ON TABLE "public"."config_referidos" TO "anon";
GRANT ALL ON TABLE "public"."config_referidos" TO "authenticated";
GRANT ALL ON TABLE "public"."config_referidos" TO "service_role";



GRANT ALL ON TABLE "public"."links_regalo" TO "anon";
GRANT ALL ON TABLE "public"."links_regalo" TO "authenticated";
GRANT ALL ON TABLE "public"."links_regalo" TO "service_role";



GRANT ALL ON TABLE "public"."gift_analytics" TO "anon";
GRANT ALL ON TABLE "public"."gift_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."gift_analytics" TO "service_role";



GRANT ALL ON TABLE "public"."historial_puntos" TO "anon";
GRANT ALL ON TABLE "public"."historial_puntos" TO "authenticated";
GRANT ALL ON TABLE "public"."historial_puntos" TO "service_role";



GRANT ALL ON TABLE "public"."historial_servicios" TO "anon";
GRANT ALL ON TABLE "public"."historial_servicios" TO "authenticated";
GRANT ALL ON TABLE "public"."historial_servicios" TO "service_role";



GRANT ALL ON TABLE "public"."notification_history" TO "anon";
GRANT ALL ON TABLE "public"."notification_history" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_history" TO "service_role";



GRANT ALL ON TABLE "public"."pin_attempts" TO "anon";
GRANT ALL ON TABLE "public"."pin_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."pin_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."productos" TO "anon";
GRANT ALL ON TABLE "public"."productos" TO "authenticated";
GRANT ALL ON TABLE "public"."productos" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."recompensas_disponibles" TO "anon";
GRANT ALL ON TABLE "public"."recompensas_disponibles" TO "authenticated";
GRANT ALL ON TABLE "public"."recompensas_disponibles" TO "service_role";



GRANT ALL ON TABLE "public"."recordatorios_enviados" TO "anon";
GRANT ALL ON TABLE "public"."recordatorios_enviados" TO "authenticated";
GRANT ALL ON TABLE "public"."recordatorios_enviados" TO "service_role";



GRANT ALL ON TABLE "public"."referidos" TO "anon";
GRANT ALL ON TABLE "public"."referidos" TO "authenticated";
GRANT ALL ON TABLE "public"."referidos" TO "service_role";



GRANT ALL ON TABLE "public"."servicios_asignados" TO "anon";
GRANT ALL ON TABLE "public"."servicios_asignados" TO "authenticated";
GRANT ALL ON TABLE "public"."servicios_asignados" TO "service_role";



GRANT ALL ON TABLE "public"."stats_campanas" TO "anon";
GRANT ALL ON TABLE "public"."stats_campanas" TO "authenticated";
GRANT ALL ON TABLE "public"."stats_campanas" TO "service_role";



GRANT ALL ON TABLE "public"."sync_failures" TO "anon";
GRANT ALL ON TABLE "public"."sync_failures" TO "authenticated";
GRANT ALL ON TABLE "public"."sync_failures" TO "service_role";



GRANT ALL ON TABLE "public"."sync_queue" TO "anon";
GRANT ALL ON TABLE "public"."sync_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."sync_queue" TO "service_role";



GRANT ALL ON TABLE "public"."sync_queue_stats" TO "anon";
GRANT ALL ON TABLE "public"."sync_queue_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."sync_queue_stats" TO "service_role";



GRANT ALL ON TABLE "public"."ticket_events" TO "anon";
GRANT ALL ON TABLE "public"."ticket_events" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_events" TO "service_role";



GRANT ALL ON TABLE "public"."tipos_servicio_recurrente" TO "anon";
GRANT ALL ON TABLE "public"."tipos_servicio_recurrente" TO "authenticated";
GRANT ALL ON TABLE "public"."tipos_servicio_recurrente" TO "service_role";



GRANT ALL ON TABLE "public"."webhook_events" TO "anon";
GRANT ALL ON TABLE "public"."webhook_events" TO "authenticated";
GRANT ALL ON TABLE "public"."webhook_events" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







