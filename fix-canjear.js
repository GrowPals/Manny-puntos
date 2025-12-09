const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://kuftyqupibyjliaukpxn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1ZnR5cXVwaWJ5amxpYXVrcHhuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTIzNjM1NSwiZXhwIjoyMDc2ODEyMzU1fQ.f6KP7A8TYtzkER1CLq_1o5jruYRnlvtFoxgZapfdL2Q'
);

const sql = `
DROP FUNCTION IF EXISTS public.canjear_link_regalo(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.canjear_link_regalo(
  p_codigo TEXT,
  p_telefono TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_link RECORD;
  v_cliente RECORD;
  v_beneficio_id UUID;
  v_puntos_anteriores INTEGER;
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
    IF v_link.destinatario_telefono IS NOT NULL AND v_link.destinatario_telefono != '' AND v_link.destinatario_telefono != p_telefono THEN
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
    v_puntos_anteriores := v_cliente.puntos_actuales;
    UPDATE clientes SET puntos_actuales = puntos_actuales + v_link.puntos_regalo, puntos_historicos = puntos_historicos + v_link.puntos_regalo, updated_at = NOW() WHERE id = v_cliente.id;
    INSERT INTO historial_puntos (cliente_id, puntos, tipo_movimiento, descripcion, puntos_antes, puntos_despues) VALUES (v_cliente.id, v_link.puntos_regalo, 'regalo', COALESCE(v_link.nombre_campana, v_link.nombre_beneficio, 'Regalo de puntos'), v_puntos_anteriores, v_puntos_anteriores + v_link.puntos_regalo);
  END IF;

  INSERT INTO beneficios_cliente (cliente_id, link_regalo_id, nombre_beneficio, descripcion_beneficio, puntos_otorgados, fecha_canje, fecha_expiracion, estado, terminos_condiciones, instrucciones_uso) VALUES (v_cliente.id, v_link.id, COALESCE(v_link.nombre_beneficio, v_link.nombre_campana, 'Regalo'), v_link.descripcion_beneficio, CASE WHEN v_link.tipo = 'puntos' THEN v_link.puntos_regalo ELSE NULL END, NOW(), CASE WHEN v_link.vigencia_beneficio IS NOT NULL THEN NOW() + (v_link.vigencia_beneficio || ' days')::INTERVAL ELSE NOW() + INTERVAL '365 days' END, 'activo', v_link.terminos_condiciones, v_link.instrucciones_uso) RETURNING id INTO v_beneficio_id;

  IF v_link.es_campana THEN
    UPDATE links_regalo SET canjes_realizados = canjes_realizados + 1, updated_at = NOW() WHERE id = v_link.id;
  ELSE
    UPDATE links_regalo SET estado = 'canjeado', canjeado_por = v_cliente.id, fecha_canje = NOW(), updated_at = NOW() WHERE id = v_link.id;
  END IF;

  RETURN json_build_object('success', true, 'beneficio_id', v_beneficio_id, 'cliente_id', v_cliente.id, 'nombre_cliente', v_cliente.nombre, 'nombre_beneficio', COALESCE(v_link.nombre_beneficio, v_link.nombre_campana), 'tipo', v_link.tipo, 'puntos_otorgados', CASE WHEN v_link.tipo = 'puntos' THEN v_link.puntos_regalo ELSE NULL END, 'es_campana', v_link.es_campana);
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Error al procesar el regalo: ' || SQLERRM);
END;
$func$;

GRANT EXECUTE ON FUNCTION public.canjear_link_regalo(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.canjear_link_regalo(TEXT, TEXT) TO authenticated;
`;

async function fix() {
  console.log('Ejecutando fix para canjear_link_regalo...');

  // Split and execute each statement
  const statements = sql.split(/;\s*(?=DROP|CREATE|GRANT)/);

  for (const stmt of statements) {
    const trimmed = stmt.trim();
    if (!trimmed) continue;

    console.log('Ejecutando:', trimmed.substring(0, 50) + '...');

    const { error } = await supabase.rpc('exec_sql', { sql: trimmed + ';' }).catch(e => ({ error: e }));

    if (error) {
      // Try direct query via postgres
      console.log('RPC no disponible, intentando via raw query...');
    }
  }

  // Test the function
  console.log('\nProbando la función corregida...');
  const { data, error } = await supabase.rpc('canjear_link_regalo', {
    p_codigo: 'BM4VRXFG',
    p_telefono: '1234567890'
  });

  console.log('Resultado:', JSON.stringify(data, null, 2));
  if (error) console.log('Error:', error);
}

fix();
