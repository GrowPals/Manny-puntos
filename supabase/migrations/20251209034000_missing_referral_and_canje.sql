-- =====================================================
-- FUNCIONES FALTANTES: aplicar_codigo_referido_v2 y registrar_canje_atomico
-- Creado: 2025-12-09
-- =====================================================

-- =====================================================
-- 1. APLICAR_CODIGO_REFERIDO_V2
-- Aplica un código de referido a un cliente nuevo
-- Parámetros: p_referido_id (UUID del cliente nuevo), p_codigo (código de referido)
-- =====================================================

CREATE OR REPLACE FUNCTION public.aplicar_codigo_referido_v2(
  p_referido_id UUID,
  p_codigo TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_codigo_record RECORD;
  v_referido RECORD;
  v_config RECORD;
  v_puntos_referidor INTEGER;
  v_puntos_referido INTEGER;
BEGIN
  -- Buscar código de referido con lock
  SELECT cr.*, c.id as cliente_id, c.nombre as cliente_nombre
  INTO v_codigo_record
  FROM codigos_referido cr
  JOIN clientes c ON cr.cliente_id = c.id
  WHERE cr.codigo = UPPER(p_codigo) AND cr.activo = true
  FOR UPDATE;

  IF v_codigo_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Código de referido no válido o inactivo');
  END IF;

  -- Verificar que no se auto-refiera
  IF v_codigo_record.cliente_id = p_referido_id THEN
    RETURN json_build_object('success', false, 'error', 'No puedes usar tu propio código');
  END IF;

  -- Verificar que el referido existe
  SELECT * INTO v_referido FROM clientes WHERE id = p_referido_id;
  IF v_referido IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Cliente referido no encontrado');
  END IF;

  -- Verificar que no tenga ya un referidor
  IF EXISTS (SELECT 1 FROM referidos WHERE referido_id = p_referido_id) THEN
    RETURN json_build_object('success', false, 'error', 'Ya tienes un código de referido aplicado');
  END IF;

  -- Obtener configuración
  SELECT * INTO v_config FROM config_referidos WHERE activo = true LIMIT 1;
  v_puntos_referidor := COALESCE(v_config.puntos_referidor, 100);
  v_puntos_referido := COALESCE(v_config.puntos_referido, 50);

  -- Crear registro de referido
  INSERT INTO referidos (referidor_id, referido_id, codigo_usado, estado, puntos_referidor, puntos_referido)
  VALUES (v_codigo_record.cliente_id, p_referido_id, UPPER(p_codigo), 'activo', v_puntos_referidor, v_puntos_referido);

  -- Dar puntos al referidor
  UPDATE clientes
  SET puntos_actuales = puntos_actuales + v_puntos_referidor,
      puntos_historicos = puntos_historicos + v_puntos_referidor
  WHERE id = v_codigo_record.cliente_id;

  -- Dar puntos al referido
  UPDATE clientes
  SET puntos_actuales = puntos_actuales + v_puntos_referido,
      puntos_historicos = puntos_historicos + v_puntos_referido
  WHERE id = p_referido_id;

  -- Incrementar uso del código
  UPDATE codigos_referido SET usos = usos + 1 WHERE id = v_codigo_record.id;

  RETURN json_build_object(
    'success', true,
    'puntos_ganados', v_puntos_referido,
    'referidor_nombre', v_codigo_record.cliente_nombre
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Error al aplicar código: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.aplicar_codigo_referido_v2(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.aplicar_codigo_referido_v2(UUID, TEXT) TO authenticated;

-- =====================================================
-- 2. REGISTRAR_CANJE_ATOMICO
-- Registra un canje de producto con puntos de forma atómica
-- Parámetros: p_cliente_id (UUID), p_producto_id (UUID)
-- =====================================================

CREATE OR REPLACE FUNCTION public.registrar_canje_atomico(
  p_cliente_id UUID,
  p_producto_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente RECORD;
  v_producto RECORD;
  v_canje_id UUID;
BEGIN
  -- Obtener cliente con lock
  SELECT * INTO v_cliente FROM clientes WHERE id = p_cliente_id FOR UPDATE;

  IF v_cliente IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Cliente no encontrado');
  END IF;

  -- Obtener producto con lock
  SELECT * INTO v_producto FROM productos WHERE id = p_producto_id FOR UPDATE;

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

  -- Descontar puntos
  UPDATE clientes
  SET puntos_actuales = puntos_actuales - v_producto.puntos_requeridos,
      updated_at = NOW()
  WHERE id = p_cliente_id;

  -- Descontar stock si aplica
  IF v_producto.stock IS NOT NULL THEN
    UPDATE productos SET stock = stock - 1 WHERE id = p_producto_id;
  END IF;

  -- Crear registro de canje
  INSERT INTO canjes (
    cliente_id,
    producto_id,
    puntos_canjeados,
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

  -- Registrar en historial
  INSERT INTO historial_puntos (
    cliente_id,
    puntos,
    tipo_movimiento,
    descripcion,
    puntos_antes,
    puntos_despues
  ) VALUES (
    p_cliente_id,
    -v_producto.puntos_requeridos,
    'canje',
    'Canje: ' || v_producto.nombre,
    v_cliente.puntos_actuales,
    v_cliente.puntos_actuales - v_producto.puntos_requeridos
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

GRANT EXECUTE ON FUNCTION public.registrar_canje_atomico(UUID, UUID) TO authenticated;

-- Comentarios
COMMENT ON FUNCTION public.aplicar_codigo_referido_v2(UUID, TEXT) IS 'Aplica código de referido con puntos para ambas partes';
COMMENT ON FUNCTION public.registrar_canje_atomico(UUID, UUID) IS 'Registra canje de producto descontando puntos atómicamente';
