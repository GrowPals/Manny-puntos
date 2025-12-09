-- =====================================================
-- ALIAS PARA canjear_link_regalo_v3
-- Wrapper que permite que código viejo siga funcionando
-- mientras se despliega el código nuevo
-- Creado: 2025-12-09
-- =====================================================

-- Crear alias v3 que simplemente llama a la función original
CREATE OR REPLACE FUNCTION public.canjear_link_regalo_v3(
  p_codigo TEXT,
  p_telefono TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Simplemente delegar a la función original
  RETURN canjear_link_regalo(p_codigo, p_telefono);
END;
$$;

-- Permisos
GRANT EXECUTE ON FUNCTION public.canjear_link_regalo_v3(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.canjear_link_regalo_v3(TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.canjear_link_regalo_v3(TEXT, TEXT) IS 'Alias para canjear_link_regalo - compatibilidad con código anterior';
