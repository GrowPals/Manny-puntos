#!/bin/bash

echo "=========================================="
echo "AUDITORÍA FINAL - FUNCIONES RPC"
echo "=========================================="

# IMPORTANTE: Configurar estas variables antes de ejecutar
# export SUPABASE_SERVICE_ROLE_KEY="tu-service-role-key"
# export SUPABASE_URL="https://tu-proyecto.supabase.co"

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "ERROR: SUPABASE_SERVICE_ROLE_KEY no está configurada"
  echo "Ejecuta: export SUPABASE_SERVICE_ROLE_KEY='tu-key'"
  exit 1
fi

if [ -z "$SUPABASE_URL" ]; then
  echo "ERROR: SUPABASE_URL no está configurada"
  echo "Ejecuta: export SUPABASE_URL='https://tu-proyecto.supabase.co'"
  exit 1
fi

API_KEY="$SUPABASE_SERVICE_ROLE_KEY"
BASE="$SUPABASE_URL/rest/v1/rpc"

test_fn() {
  name="$1"
  data="$2"
  result=$(curl -s "$BASE/$name" -H "apikey: $API_KEY" -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" -d "$data" 2>&1)

  if echo "$result" | grep -q "PGRST202"; then
    echo "❌ $name - NO EXISTE"
  else
    echo "✅ $name - OK"
  fi
}

echo ""
echo "=== AUTENTICACIÓN (auth.js) ==="
test_fn "check_cliente_exists" '{"telefono_input":"0"}'
test_fn "verify_client_pin_secure" '{"telefono_input":"0","pin_input":"0"}'
test_fn "register_client_pin_secure" '{"telefono_input":"0","pin_input":"0"}'
test_fn "reset_client_pin" '{"cliente_id_input":"00000000-0000-0000-0000-000000000000"}'

echo ""
echo "=== REGALOS (gifts.js) ==="
test_fn "incrementar_vistas_link" '{"p_codigo":"X"}'
test_fn "canjear_link_regalo" '{"p_codigo":"X","p_telefono":"0"}'
test_fn "get_beneficios_cliente" '{"p_cliente_id":"00000000-0000-0000-0000-000000000000"}'
test_fn "marcar_beneficio_usado" '{"p_beneficio_id":"00000000-0000-0000-0000-000000000000"}'
test_fn "get_gift_analytics_summary" '{}'
test_fn "expire_old_gift_links" '{}'

echo ""
echo "=== CLIENTES (clients.js) ==="
test_fn "asignar_puntos_atomico" '{"p_cliente_id":"00000000-0000-0000-0000-000000000000","p_puntos":0,"p_tipo":"x","p_descripcion":"x"}'

echo ""
echo "=== REFERIDOS (referrals.js) ==="
test_fn "get_or_create_referral_code" '{"p_cliente_id":"00000000-0000-0000-0000-000000000000"}'
test_fn "aplicar_codigo_referido_v2" '{"p_referido_id":"00000000-0000-0000-0000-000000000000","p_codigo":"X"}'

echo ""
echo "=== ADMIN (admin.js) ==="
test_fn "get_dashboard_stats" '{}'

echo ""
echo "=== CANJES (redemptions.js) ==="
test_fn "registrar_canje_atomico" '{"p_cliente_id":"00000000-0000-0000-0000-000000000000","p_producto_id":"00000000-0000-0000-0000-000000000000"}'

echo ""
echo "=== SERVICIOS (services.js) ==="
test_fn "get_historial_stats" '{"p_cliente_id":"00000000-0000-0000-0000-000000000000"}'

echo ""
echo "=== SYNC/LOG ==="
test_fn "enqueue_sync_operation" '{"p_operation":"x","p_entity_type":"x","p_entity_id":"00000000-0000-0000-0000-000000000000"}'
test_fn "log_audit_event" '{"p_event_type":"x"}'

echo ""
echo "=========================================="
