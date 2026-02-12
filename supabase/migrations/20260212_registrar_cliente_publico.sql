-- =====================================================
-- REGISTRAR CLIENTE PUBLICO
-- Permite que usuarios anónimos se auto-registren
-- Creado: 2026-02-12
-- =====================================================

DROP FUNCTION IF EXISTS public.registrar_cliente_publico(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.registrar_cliente_publico(
  p_telefono TEXT,
  p_nombre TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Permitir acceso a usuarios anónimos y autenticados
GRANT EXECUTE ON FUNCTION public.registrar_cliente_publico(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.registrar_cliente_publico(TEXT, TEXT) TO authenticated;
