-- =====================================================
-- FIX: canjear_link_regalo para manejar campañas correctamente
-- El bug: verifica destinatario_telefono incluso para campañas
-- y no maneja bien string vacío ""
-- Creado: 2025-12-09
-- =====================================================

DROP FUNCTION IF EXISTS public.canjear_link_regalo(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.canjear_link_regalo(
  p_codigo TEXT,
  p_telefono TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link RECORD;
  v_cliente RECORD;
  v_beneficio_id UUID;
  v_puntos_anteriores INTEGER;
BEGIN
  -- 1. Buscar el link con lock para evitar race conditions
  SELECT * INTO v_link
  FROM links_regalo
  WHERE codigo = UPPER(p_codigo)
  FOR UPDATE;

  IF v_link IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Link no encontrado');
  END IF;

  -- 2. Verificar estado del link
  IF v_link.estado = 'canjeado' AND NOT v_link.es_campana THEN
    RETURN json_build_object('success', false, 'error', 'Este regalo ya fue canjeado');
  END IF;

  IF v_link.estado = 'expirado' THEN
    RETURN json_build_object('success', false, 'error', 'Este regalo ha expirado');
  END IF;

  -- 3. Verificar expiración por fecha
  IF v_link.fecha_expiracion IS NOT NULL AND v_link.fecha_expiracion < NOW() THEN
    UPDATE links_regalo SET estado = 'expirado' WHERE id = v_link.id;
    RETURN json_build_object('success', false, 'error', 'Este regalo ha expirado');
  END IF;

  -- 4. Para campañas, verificar límite de canjes
  IF v_link.es_campana THEN
    IF v_link.max_canjes IS NOT NULL AND v_link.canjes_realizados >= v_link.max_canjes THEN
      RETURN json_build_object('success', false, 'error', 'Esta campaña ha alcanzado el límite de canjes');
    END IF;
  ELSE
    -- 5. Para links individuales, verificar destinatario (solo si tiene uno asignado)
    -- IMPORTANTE: NULL y string vacío "" significan "sin restricción"
    IF v_link.destinatario_telefono IS NOT NULL
       AND v_link.destinatario_telefono != ''
       AND v_link.destinatario_telefono != p_telefono THEN
      RETURN json_build_object('success', false, 'error', 'Este regalo es para un número específico');
    END IF;
  END IF;

  -- 6. Buscar o crear cliente
  SELECT * INTO v_cliente
  FROM clientes
  WHERE telefono = p_telefono;

  IF v_cliente IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Cliente no encontrado. Regístrate primero.');
  END IF;

  -- 7. Para campañas, verificar que el cliente no haya canjeado antes
  IF v_link.es_campana THEN
    IF EXISTS (
      SELECT 1 FROM beneficios_cliente
      WHERE link_regalo_id = v_link.id AND cliente_id = v_cliente.id
    ) THEN
      RETURN json_build_object('success', false, 'error', 'Ya canjeaste este regalo');
    END IF;
  END IF;

  -- 8. Procesar según tipo de regalo
  IF v_link.tipo = 'puntos' AND v_link.puntos_regalo IS NOT NULL THEN
    -- Regalo de puntos
    v_puntos_anteriores := v_cliente.puntos_actuales;

    UPDATE clientes
    SET puntos_actuales = puntos_actuales + v_link.puntos_regalo,
        puntos_historicos = puntos_historicos + v_link.puntos_regalo,
        updated_at = NOW()
    WHERE id = v_cliente.id;

    -- Registrar en historial
    INSERT INTO historial_puntos (
      cliente_id,
      puntos,
      tipo_movimiento,
      descripcion,
      puntos_antes,
      puntos_despues
    ) VALUES (
      v_cliente.id,
      v_link.puntos_regalo,
      'regalo',
      COALESCE(v_link.nombre_campana, v_link.nombre_beneficio, 'Regalo de puntos'),
      v_puntos_anteriores,
      v_puntos_anteriores + v_link.puntos_regalo
    );
  END IF;

  -- 9. Crear registro de beneficio
  INSERT INTO beneficios_cliente (
    cliente_id,
    link_regalo_id,
    nombre_beneficio,
    descripcion_beneficio,
    puntos_otorgados,
    fecha_canje,
    fecha_expiracion,
    estado,
    terminos_condiciones,
    instrucciones_uso
  ) VALUES (
    v_cliente.id,
    v_link.id,
    COALESCE(v_link.nombre_beneficio, v_link.nombre_campana, 'Regalo'),
    v_link.descripcion_beneficio,
    CASE WHEN v_link.tipo = 'puntos' THEN v_link.puntos_regalo ELSE NULL END,
    NOW(),
    CASE
      WHEN v_link.vigencia_beneficio IS NOT NULL
      THEN NOW() + (v_link.vigencia_beneficio || ' days')::INTERVAL
      ELSE NOW() + INTERVAL '365 days'
    END,
    'activo',
    v_link.terminos_condiciones,
    v_link.instrucciones_uso
  )
  RETURNING id INTO v_beneficio_id;

  -- 10. Actualizar link
  IF v_link.es_campana THEN
    UPDATE links_regalo
    SET canjes_realizados = canjes_realizados + 1,
        updated_at = NOW()
    WHERE id = v_link.id;
  ELSE
    UPDATE links_regalo
    SET estado = 'canjeado',
        canjeado_por = v_cliente.id,
        fecha_canje = NOW(),
        updated_at = NOW()
    WHERE id = v_link.id;
  END IF;

  -- 11. Retornar éxito
  RETURN json_build_object(
    'success', true,
    'beneficio_id', v_beneficio_id,
    'cliente_id', v_cliente.id,
    'nombre_cliente', v_cliente.nombre,
    'nombre_beneficio', COALESCE(v_link.nombre_beneficio, v_link.nombre_campana),
    'tipo', v_link.tipo,
    'puntos_otorgados', CASE WHEN v_link.tipo = 'puntos' THEN v_link.puntos_regalo ELSE NULL END,
    'es_campana', v_link.es_campana
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Error al procesar el regalo: ' || SQLERRM);
END;
$$;

-- Permisos
GRANT EXECUTE ON FUNCTION public.canjear_link_regalo(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.canjear_link_regalo(TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.canjear_link_regalo(TEXT, TEXT) IS 'Canjea un link de regalo - soporta campañas y links individuales';
