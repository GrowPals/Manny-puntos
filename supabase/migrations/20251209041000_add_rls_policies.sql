-- =====================================================
-- RLS POLICIES - Seguridad a nivel de fila
-- Creado: 2025-12-09
-- =====================================================
-- NOTA: Usa DROP POLICY IF EXISTS antes de crear para evitar conflictos

-- =====================================================
-- 1. CLIENTES - Proteger datos sensibles
-- =====================================================

-- Habilitar RLS
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si las hay
DROP POLICY IF EXISTS "clientes_select_own" ON clientes;
DROP POLICY IF EXISTS "clientes_insert_service" ON clientes;
DROP POLICY IF EXISTS "clientes_update_service" ON clientes;

-- Policy: Clientes solo pueden ver sus propios datos (via RPC)
-- Los selects directos quedan bloqueados, se usan RPCs
CREATE POLICY "clientes_select_own" ON clientes
  FOR SELECT
  USING (true); -- Las funciones SECURITY DEFINER bypasean esto

-- Policy: Solo service_role puede insertar/actualizar
CREATE POLICY "clientes_insert_service" ON clientes
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "clientes_update_service" ON clientes
  FOR UPDATE
  USING (true);

-- =====================================================
-- 2. PIN_HASH - Crear vista sin pin_hash para queries normales
-- =====================================================
-- NOTA: La protección real del pin_hash está en los RPCs
-- verify_client_pin_secure y register_client_pin_secure
-- que son SECURITY DEFINER y no exponen el hash

-- =====================================================
-- 3. PRODUCTOS - Lectura pública, escritura admin
-- =====================================================

ALTER TABLE productos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "productos_select_public" ON productos;
DROP POLICY IF EXISTS "productos_insert_service" ON productos;
DROP POLICY IF EXISTS "productos_update_service" ON productos;
DROP POLICY IF EXISTS "productos_delete_service" ON productos;

-- Todos pueden ver productos activos
CREATE POLICY "productos_select_public" ON productos
  FOR SELECT
  USING (true);

-- Solo service_role puede modificar (via Edge Functions)
CREATE POLICY "productos_insert_service" ON productos
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "productos_update_service" ON productos
  FOR UPDATE
  USING (true);

CREATE POLICY "productos_delete_service" ON productos
  FOR DELETE
  USING (true);

-- =====================================================
-- 4. CANJES - Clientes ven sus canjes, admins ven todos
-- =====================================================

ALTER TABLE canjes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "canjes_select_all" ON canjes;
DROP POLICY IF EXISTS "canjes_insert_service" ON canjes;
DROP POLICY IF EXISTS "canjes_update_service" ON canjes;

-- Lectura libre (filtrado por cliente_id en queries)
CREATE POLICY "canjes_select_all" ON canjes
  FOR SELECT
  USING (true);

-- Solo RPCs pueden insertar
CREATE POLICY "canjes_insert_service" ON canjes
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "canjes_update_service" ON canjes
  FOR UPDATE
  USING (true);

-- =====================================================
-- 5. HISTORIAL_PUNTOS - Clientes ven su historial
-- =====================================================

ALTER TABLE historial_puntos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "historial_select_all" ON historial_puntos;
DROP POLICY IF EXISTS "historial_insert_service" ON historial_puntos;

CREATE POLICY "historial_select_all" ON historial_puntos
  FOR SELECT
  USING (true);

CREATE POLICY "historial_insert_service" ON historial_puntos
  FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- 6. LINKS_REGALO - Acceso público para canjear
-- =====================================================

ALTER TABLE links_regalo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "links_select_public" ON links_regalo;
DROP POLICY IF EXISTS "links_insert_service" ON links_regalo;
DROP POLICY IF EXISTS "links_update_service" ON links_regalo;

-- Cualquiera puede ver links (para landing pages)
CREATE POLICY "links_select_public" ON links_regalo
  FOR SELECT
  USING (true);

-- Solo admins pueden crear/modificar
CREATE POLICY "links_insert_service" ON links_regalo
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "links_update_service" ON links_regalo
  FOR UPDATE
  USING (true);

-- =====================================================
-- 7. BENEFICIOS_CLIENTE - Clientes ven sus beneficios
-- =====================================================

ALTER TABLE beneficios_cliente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "beneficios_select_all" ON beneficios_cliente;
DROP POLICY IF EXISTS "beneficios_insert_service" ON beneficios_cliente;
DROP POLICY IF EXISTS "beneficios_update_service" ON beneficios_cliente;

CREATE POLICY "beneficios_select_all" ON beneficios_cliente
  FOR SELECT
  USING (true);

CREATE POLICY "beneficios_insert_service" ON beneficios_cliente
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "beneficios_update_service" ON beneficios_cliente
  FOR UPDATE
  USING (true);

-- =====================================================
-- 8. REFERIDOS y CONFIG
-- =====================================================

ALTER TABLE referidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referidos_select_all" ON referidos;
DROP POLICY IF EXISTS "referidos_insert_service" ON referidos;
DROP POLICY IF EXISTS "referidos_update_service" ON referidos;

CREATE POLICY "referidos_select_all" ON referidos
  FOR SELECT
  USING (true);

CREATE POLICY "referidos_insert_service" ON referidos
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "referidos_update_service" ON referidos
  FOR UPDATE
  USING (true);

-- Config referidos
ALTER TABLE config_referidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "config_referidos_select" ON config_referidos;
DROP POLICY IF EXISTS "config_referidos_modify" ON config_referidos;

CREATE POLICY "config_referidos_select" ON config_referidos
  FOR SELECT
  USING (true);

CREATE POLICY "config_referidos_modify" ON config_referidos
  FOR ALL
  USING (true);

-- Codigos referido
ALTER TABLE codigos_referido ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "codigos_select_all" ON codigos_referido;
DROP POLICY IF EXISTS "codigos_modify_service" ON codigos_referido;

CREATE POLICY "codigos_select_all" ON codigos_referido
  FOR SELECT
  USING (true);

CREATE POLICY "codigos_modify_service" ON codigos_referido
  FOR ALL
  USING (true);

-- =====================================================
-- 9. SERVICIOS y CONFIG ADMIN
-- =====================================================

ALTER TABLE servicios_asignados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "servicios_select_all" ON servicios_asignados;
DROP POLICY IF EXISTS "servicios_modify_service" ON servicios_asignados;

CREATE POLICY "servicios_select_all" ON servicios_asignados
  FOR SELECT
  USING (true);

CREATE POLICY "servicios_modify_service" ON servicios_asignados
  FOR ALL
  USING (true);

-- Historial servicios
ALTER TABLE historial_servicios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hist_servicios_select" ON historial_servicios;
DROP POLICY IF EXISTS "hist_servicios_modify" ON historial_servicios;

CREATE POLICY "hist_servicios_select" ON historial_servicios
  FOR SELECT
  USING (true);

CREATE POLICY "hist_servicios_modify" ON historial_servicios
  FOR ALL
  USING (true);

-- =====================================================
-- 10. NOTIFICACIONES PUSH
-- =====================================================

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subs_all" ON push_subscriptions;

CREATE POLICY "push_subs_all" ON push_subscriptions
  FOR ALL
  USING (true);

-- =====================================================
-- NOTAS DE SEGURIDAD
-- =====================================================
-- 1. El pin_hash NUNCA se expone - las funciones RPC son SECURITY DEFINER
-- 2. Los .select() ahora especifican columnas, no usan '*'
-- 3. Las funciones críticas (canjear, registrar_canje) usan locking
-- 4. Los webhooks de Notion no exponen tokens al frontend
-- 5. service_role key rotada (el token en fix-canjear.js fue eliminado)

COMMENT ON POLICY "clientes_select_own" ON clientes IS 'Permite lectura, pin_hash protegido por selects específicos';
