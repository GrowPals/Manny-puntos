-- =====================================================
-- FIX: registrar_canje_atomico con columnas REALES
-- Verificado el 2025-12-09
-- =====================================================
-- historial_puntos SOLO tiene: id, created_at, cliente_id, puntos, concepto, canje_id
-- NO tiene: tipo_movimiento, descripcion, puntos_antes, puntos_despues
-- =====================================================

DROP FUNCTION IF EXISTS public.registrar_canje_atomico(UUID, UUID);
DROP FUNCTION IF EXISTS public.registrar_canje_atomico(UUID, INTEGER);

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

-- Solo authenticated puede hacer canjes
GRANT EXECUTE ON FUNCTION public.registrar_canje_atomico(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.registrar_canje_atomico(UUID, UUID) IS
'Registra canje de producto descontando puntos atómicamente. VERIFICADO 2025-12-09';
