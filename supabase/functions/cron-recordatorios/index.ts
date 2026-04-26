import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
// Número de WhatsApp de Manny (para el botón en la notificación)
const MANNY_WHATSAPP = '5214625905222';
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('=== CRON RECORDATORIOS - INICIO ===');
    console.log('Fecha/Hora:', new Date().toISOString());
    // 1. Verificar si el sistema está activo
    const { data: configData } = await supabase.from('config_recordatorios').select('*').single();
    const config = configData || {
      activo: false,
      max_notificaciones_mes: 1,
      titulo_default: '¿Es hora de dar mantenimiento?',
      mensaje_default: 'Hola {nombre}, han pasado {dias} días desde tu último {servicio}. ¿Te ayudamos a agendar tu próximo servicio?',
      hora_envio: 10
    };
    if (!config.activo) {
      console.log('Sistema de recordatorios DESACTIVADO');
      return new Response(JSON.stringify({
        success: true,
        status: 'disabled',
        message: 'Sistema de recordatorios desactivado'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // 2. Obtener tipos de servicio recurrentes activos
    const { data: tiposRecurrentes } = await supabase.from('tipos_servicio_recurrente').select('*').eq('activo', true);
    if (!tiposRecurrentes || tiposRecurrentes.length === 0) {
      console.log('No hay tipos de servicio configurados');
      return new Response(JSON.stringify({
        success: true,
        status: 'no_config',
        message: 'No hay tipos de servicio configurados'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log(`Tipos de servicio activos: ${tiposRecurrentes.length}`);
    // 3. Para cada tipo de servicio, buscar clientes que necesitan recordatorio
    const recordatoriosEnviados = [];
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    for (const tipo of tiposRecurrentes){
      console.log(`\n--- Procesando: ${tipo.tipo_trabajo} (${tipo.dias_recordatorio} días) ---`);
      // Calcular fecha límite
      const fechaLimite = new Date();
      fechaLimite.setDate(fechaLimite.getDate() - tipo.dias_recordatorio);
      // Buscar servicios que cumplen el criterio
      const { data: historialData } = await supabase.from('historial_servicios').select(`
          id,
          cliente_id,
          tipo_trabajo,
          fecha_servicio
        `).eq('tipo_trabajo', tipo.tipo_trabajo).lte('fecha_servicio', fechaLimite.toISOString()).order('fecha_servicio', {
        ascending: false
      });
      if (!historialData || historialData.length === 0) {
        console.log(`No hay clientes que requieran recordatorio para ${tipo.tipo_trabajo}`);
        continue;
      }
      // Agrupar por cliente y tomar el más reciente
      const clientesUnicos = new Map();
      for (const registro of historialData){
        if (!clientesUnicos.has(registro.cliente_id)) {
          clientesUnicos.set(registro.cliente_id, registro);
        }
      }
      console.log(`Clientes potenciales para ${tipo.tipo_trabajo}: ${clientesUnicos.size}`);
      // Procesar cada cliente
      for (const [clienteId, registro] of clientesUnicos){
        const diasDesdeServicio = Math.floor((Date.now() - new Date(registro.fecha_servicio).getTime()) / (1000 * 60 * 60 * 24));
        // Verificar si ya se envió recordatorio este mes para este tipo
        const { data: recordatorioExistente } = await supabase.from('recordatorios_enviados').select('id').eq('cliente_id', clienteId).eq('tipo_trabajo', tipo.tipo_trabajo).gte('enviado_at', inicioMes.toISOString());
        if (recordatorioExistente && recordatorioExistente.length >= config.max_notificaciones_mes) {
          console.log(`Cliente ${clienteId} ya recibió máx recordatorios este mes para ${tipo.tipo_trabajo}`);
          continue;
        }
        // Obtener nombre del cliente
        const { data: clienteData } = await supabase.from('clientes').select('nombre').eq('id', clienteId).single();
        const clienteNombre = clienteData?.nombre || 'Cliente';
        const primerNombre = clienteNombre.split(' ')[0];
        // Preparar mensaje
        const mensaje = (tipo.mensaje_personalizado || config.mensaje_default).replace('{nombre}', primerNombre).replace('{servicio}', tipo.tipo_trabajo.toLowerCase()).replace('{tipo}', tipo.tipo_trabajo.toLowerCase()).replace('{dias}', String(diasDesdeServicio));
        // Crear mensaje para WhatsApp
        const mensajeWhatsApp = encodeURIComponent(`¡Hola! Soy ${primerNombre}. Me gustaría agendar un servicio de ${tipo.tipo_trabajo.toLowerCase()}.`);
        // Enviar push notification
        try {
          const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({
              tipo: 'recordatorio_servicio',
              cliente_id: clienteId,
              data: {
                nombre: primerNombre,
                servicio: tipo.tipo_trabajo,
                dias: diasDesdeServicio,
                titulo: config.titulo_default,
                mensaje: mensaje,
                whatsapp_url: `https://wa.me/${MANNY_WHATSAPP}?text=${mensajeWhatsApp}`
              },
              url: '/dashboard'
            })
          });
          const pushResult = await pushResponse.json();
          const success = pushResponse.ok && pushResult.sent > 0;
          console.log(`Push a ${primerNombre}: ${success ? 'ENVIADO' : 'FALLIDO (sin suscripción)'} `);
          // Registrar recordatorio enviado solo si tuvo éxito
          if (success) {
            await supabase.from('recordatorios_enviados').insert({
              cliente_id: clienteId,
              tipo_trabajo: tipo.tipo_trabajo,
              servicio_id: registro.id || null
            });
          }
          recordatoriosEnviados.push({
            cliente_id: clienteId,
            cliente_nombre: clienteNombre,
            tipo_trabajo: tipo.tipo_trabajo,
            dias_desde_servicio: diasDesdeServicio,
            success
          });
        } catch (pushError) {
          console.error(`Error enviando push a ${clienteId}:`, pushError);
          recordatoriosEnviados.push({
            cliente_id: clienteId,
            cliente_nombre: clienteNombre,
            tipo_trabajo: tipo.tipo_trabajo,
            dias_desde_servicio: diasDesdeServicio,
            success: false
          });
        }
      }
    }
    const exitosos = recordatoriosEnviados.filter((r)=>r.success).length;
    console.log(`\n=== CRON RECORDATORIOS - FIN ===`);
    console.log(`Total enviados: ${exitosos}/${recordatoriosEnviados.length}`);
    return new Response(JSON.stringify({
      success: true,
      status: 'completed',
      enviados: exitosos,
      total: recordatoriosEnviados.length,
      detalles: recordatoriosEnviados
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error en cron-recordatorios:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
