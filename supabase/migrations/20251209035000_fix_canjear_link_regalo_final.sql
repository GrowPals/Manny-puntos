-- =====================================================
-- FIX FINAL: canjear_link_regalo con columnas VERIFICADAS
-- Verificado contra API real el 2025-12-09
-- =====================================================
-- COLUMNAS VERIFICADAS:
-- historial_puntos: id, created_at, cliente_id, puntos, concepto, canje_id
--                   (NO tiene: tipo_movimiento, descripcion, puntos_antes, puntos_despues)
-- beneficios_cliente: nombre, descripcion, terminos, instrucciones (NO *_beneficio, *_condiciones, *_uso)
-- links_regalo: NO tiene updated_at
-- clientes: NO tiene puntos_historicos, SI tiene updated_at
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
BEGIN
  -- 1. Buscar el link con lock para evitar race conditions
  SELECT * INTO v_link
  FROM links_regalo
  WHERE codigo = UPPER(p_codigo)
  FOR UPDATE;

  IF v_link IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Link no encontrado');
  END IF;

  -- 2. Verificar estado del link (solo para no-campañas)
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

  -- 4. Lógica específica para campañas vs links individuales
  IF v_link.es_campana THEN
    -- Para campañas: verificar límite de canjes
    IF v_link.max_canjes IS NOT NULL AND v_link.canjes_realizados >= v_link.max_canjes THEN
      RETURN json_build_object('success', false, 'error', 'Esta campaña ha alcanzado el límite de canjes');
    END IF;
    -- Las campañas NO verifican destinatario_telefono
  ELSE
    -- Para links individuales: verificar destinatario si está especificado
    IF v_link.destinatario_telefono IS NOT NULL
       AND v_link.destinatario_telefono != ''
       AND v_link.destinatario_telefono != p_telefono THEN
      RETURN json_build_object('success', false, 'error', 'Este regalo es para un número específico');
    END IF;
  END IF;

  -- 5. Buscar cliente
  SELECT * INTO v_cliente
  FROM clientes
  WHERE telefono = p_telefono;

  IF v_cliente IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Cliente no encontrado. Regístrate primero.');
  END IF;

  -- 6. Para campañas, verificar que el cliente no haya canjeado antes
  IF v_link.es_campana THEN
    IF EXISTS (
      SELECT 1 FROM beneficios_cliente
      WHERE link_regalo_id = v_link.id AND cliente_id = v_cliente.id
    ) THEN
      RETURN json_build_object('success', false, 'error', 'Ya canjeaste este regalo');
    END IF;
  END IF;

  -- 7. Procesar regalo de puntos (si aplica)
  IF v_link.tipo = 'puntos' AND v_link.puntos_regalo IS NOT NULL THEN
    UPDATE clientes
    SET puntos_actuales = puntos_actuales + v_link.puntos_regalo,
        updated_at = NOW()
    WHERE id = v_cliente.id;

    -- Registrar en historial_puntos (usando columnas reales)
    INSERT INTO historial_puntos (
      cliente_id,
      puntos,
      concepto
    ) VALUES (
      v_cliente.id,
      v_link.puntos_regalo,
      COALESCE(v_link.nombre_campana, v_link.nombre_beneficio, 'Regalo de puntos')
    );
  END IF;

  -- 8. Crear registro de beneficio (usando columnas reales de beneficios_cliente)
  INSERT INTO beneficios_cliente (
    cliente_id,
    link_regalo_id,
    tipo,
    nombre,
    descripcion,
    terminos,
    instrucciones,
    puntos_otorgados,
    estado,
    fecha_canje,
    fecha_expiracion
  ) VALUES (
    v_cliente.id,
    v_link.id,
    v_link.tipo,
    COALESCE(v_link.nombre_beneficio, v_link.nombre_campana, 'Regalo'),
    v_link.descripcion_beneficio,
    v_link.terminos_condiciones,
    v_link.instrucciones_uso,
    CASE WHEN v_link.tipo = 'puntos' THEN v_link.puntos_regalo ELSE NULL END,
    'activo',
    NOW(),
    CASE
      WHEN v_link.vigencia_beneficio IS NOT NULL
      THEN NOW() + (v_link.vigencia_beneficio || ' days')::INTERVAL
      ELSE NOW() + INTERVAL '365 days'
    END
  )
  RETURNING id INTO v_beneficio_id;

  -- 9. Actualizar link (sin updated_at porque links_regalo no lo tiene)
  IF v_link.es_campana THEN
    UPDATE links_regalo
    SET canjes_realizados = canjes_realizados + 1
    WHERE id = v_link.id;
  ELSE
    UPDATE links_regalo
    SET estado = 'canjeado',
        canjeado_por = v_cliente.id,
        fecha_canje = NOW()
    WHERE id = v_link.id;
  END IF;

  -- 10. Retornar éxito
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

-- Alias v3 para compatibilidad
DROP FUNCTION IF EXISTS public.canjear_link_regalo_v3(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.canjear_link_regalo_v3(
  p_codigo TEXT,
  p_telefono TEXT
)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.canjear_link_regalo(p_codigo, p_telefono);
$$;

GRANT EXECUTE ON FUNCTION public.canjear_link_regalo_v3(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.canjear_link_regalo_v3(TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.canjear_link_regalo(TEXT, TEXT) IS 'Canjea link de regalo - VERIFICADO 2025-12-09';
COMMENT ON FUNCTION public.canjear_link_regalo_v3(TEXT, TEXT) IS 'Alias de canjear_link_regalo para compatibilidad';
