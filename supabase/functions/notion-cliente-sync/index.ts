import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ID de la base de datos Manny Rewards en Notion
const MANNY_REWARDS_DATABASE_ID = '2bfc6cfd-8c1e-8026-9291-e4bc8c18ee01';

interface NotionPage {
  id: string;
  properties: {
    [key: string]: any;
  };
}

/**
 * Extrae el nivel del cliente desde las propiedades de Notion
 * Busca en el campo "Nivel" que es un select
 */
function extractNivel(properties: any): string | null {
  const nivelField = properties['Nivel'];
  if (!nivelField || !nivelField.select) return null;

  const nivelNotion = nivelField.select.name?.toLowerCase();

  // Mapear valores de Notion a Supabase
  if (nivelNotion === 'vip') return 'vip';
  if (nivelNotion === 'partner') return 'partner';

  return null;
}

/**
 * Extrae los puntos desde las propiedades de Notion
 * Busca en el campo "Puntos" que es un number
 */
function extractPuntos(properties: any): number | null {
  const puntosField = properties['Puntos'];
  if (!puntosField) return null;

  // Puede ser number directo o estar en formula/rollup
  if (typeof puntosField.number === 'number') {
    return puntosField.number;
  }
  if (puntosField.formula?.number !== undefined) {
    return puntosField.formula.number;
  }
  if (puntosField.rollup?.number !== undefined) {
    return puntosField.rollup.number;
  }

  return null;
}

/**
 * Extrae el teléfono para identificar al cliente
 */
function extractTelefono(properties: any): string | null {
  // Buscar en varios campos posibles
  const phoneField = properties['Teléfono'] || properties['Telefono'] || properties['Phone'];

  if (phoneField?.phone_number) {
    let phone = phoneField.phone_number.replace(/\D/g, '');
    // Normalizar: quitar prefijo 52 si existe
    if (phone.startsWith('52') && phone.length > 10) {
      phone = phone.slice(2);
    }
    if (phone.startsWith('1') && phone.length > 10) {
      phone = phone.slice(1);
    }
    return phone.length >= 10 ? phone : null;
  }

  // También buscar en rich_text
  if (phoneField?.rich_text?.[0]?.plain_text) {
    let phone = phoneField.rich_text[0].plain_text.replace(/\D/g, '');
    if (phone.startsWith('52') && phone.length > 10) {
      phone = phone.slice(2);
    }
    if (phone.startsWith('1') && phone.length > 10) {
      phone = phone.slice(1);
    }
    return phone.length >= 10 ? phone : null;
  }

  return null;
}

/**
 * Extrae el Supabase ID si está almacenado en Notion
 */
function extractSupabaseId(properties: any): string | null {
  const supabaseIdField = properties['Supabase ID'] || properties['supabase_id'];

  if (supabaseIdField?.rich_text?.[0]?.plain_text) {
    return supabaseIdField.rich_text[0].plain_text;
  }

  return null;
}

/**
 * Busca el cliente en la relación "Cliente" de Manny Rewards
 * y obtiene su teléfono de la base de Contactos
 */
async function getClienteFromRelation(
  properties: any,
  notionToken: string
): Promise<{ telefono: string | null; notionPageId: string | null }> {
  const clienteField = properties['Cliente'];

  if (!clienteField?.relation?.[0]?.id) {
    return { telefono: null, notionPageId: null };
  }

  const clienteNotionId = clienteField.relation[0].id;

  // Obtener la página del cliente en Contactos
  const response = await fetch(`https://api.notion.com/v1/pages/${clienteNotionId}`, {
    headers: {
      'Authorization': `Bearer ${notionToken}`,
      'Notion-Version': '2022-06-28',
    },
  });

  if (!response.ok) {
    console.error('Failed to fetch cliente from Notion:', await response.text());
    return { telefono: null, notionPageId: clienteNotionId };
  }

  const clientePage = await response.json();
  const telefono = extractTelefono(clientePage.properties);

  return { telefono, notionPageId: clienteNotionId };
}

/**
 * Obtiene la página completa de Notion si solo tenemos el ID
 */
async function getPageFromNotion(pageId: string, notionToken: string): Promise<NotionPage | null> {
  const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    headers: {
      'Authorization': `Bearer ${notionToken}`,
      'Notion-Version': '2022-06-28',
    },
  });

  if (!response.ok) {
    console.error('Failed to fetch page from Notion:', await response.text());
    return null;
  }

  return await response.json();
}

/**
 * Determina el tipo de registro en Manny Rewards
 */
function extractTipo(properties: any): string | null {
  const tipoField = properties['Tipo'];
  if (!tipoField?.select?.name) return null;
  return tipoField.select.name;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const notionToken = Deno.env.get('NOTION_TOKEN');

    if (!notionToken) {
      return new Response(JSON.stringify({ error: 'NOTION_TOKEN not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log('Cliente sync webhook received:', JSON.stringify(payload, null, 2));

    // Notion webhook verification
    if (payload.challenge) {
      return new Response(JSON.stringify({ challenge: payload.challenge }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extraer página de diferentes estructuras de payload
    let page: NotionPage | null = null;
    let notionPageId: string | null = null;

    if (payload.data?.properties) {
      page = payload.data;
      notionPageId = page.id;
    } else if (payload.properties) {
      page = payload;
      notionPageId = page.id;
    } else {
      // Notion Automations envía solo el page_id
      notionPageId = payload.data?.id || payload.id || payload.page_id || payload.page?.id;

      if (notionPageId) {
        console.log('Fetching page from Notion API:', notionPageId);
        page = await getPageFromNotion(notionPageId, notionToken);
        if (!page) {
          return new Response(JSON.stringify({
            status: 'error',
            reason: 'failed to fetch page from Notion'
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else {
        return new Response(JSON.stringify({
          status: 'error',
          reason: 'no page data in payload'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const properties = page!.properties;

    if (!properties) {
      console.log('No properties found in payload');
      return new Response(JSON.stringify({ status: 'skipped', reason: 'no properties' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Detectar el tipo de registro para saber cómo procesarlo
    const tipo = extractTipo(properties);
    console.log('Tipo de registro:', tipo);

    // Extraer datos del registro
    const nivel = extractNivel(properties);
    const puntos = extractPuntos(properties);

    // Intentar obtener el cliente de diferentes formas
    let telefono = extractTelefono(properties);
    let clienteNotionPageId: string | null = null;

    // Si no hay teléfono directo, buscar en la relación Cliente
    if (!telefono) {
      const clienteData = await getClienteFromRelation(properties, notionToken);
      telefono = clienteData.telefono;
      clienteNotionPageId = clienteData.notionPageId;
    }

    // También intentar con Supabase ID
    const supabaseId = extractSupabaseId(properties);

    console.log('Datos extraídos:', { tipo, nivel, puntos, telefono, supabaseId, clienteNotionPageId });

    // Necesitamos al menos teléfono o supabaseId para identificar al cliente
    if (!telefono && !supabaseId) {
      console.log('No se pudo identificar al cliente');
      return new Response(JSON.stringify({
        status: 'skipped',
        reason: 'no client identifier (telefono or supabase_id)'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar cliente en Supabase
    let cliente;
    if (supabaseId) {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, telefono, nivel, puntos_actuales, notion_page_id')
        .eq('id', supabaseId)
        .single();

      if (!error && data) {
        cliente = data;
      }
    }

    if (!cliente && telefono) {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, telefono, nivel, puntos_actuales, notion_page_id')
        .eq('telefono', telefono)
        .single();

      if (!error && data) {
        cliente = data;
      }
    }

    if (!cliente) {
      console.log('Cliente no encontrado en Supabase');
      return new Response(JSON.stringify({
        status: 'skipped',
        reason: 'client not found in Supabase'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Preparar actualizaciones
    const updates: Record<string, any> = {
      last_sync_at: new Date().toISOString()
    };
    const changes: string[] = [];

    // Actualizar nivel si cambió
    if (nivel && nivel !== cliente.nivel) {
      updates.nivel = nivel;
      changes.push(`nivel: ${cliente.nivel} → ${nivel}`);
    }

    // Actualizar puntos si se especificaron y son diferentes
    // Solo actualizar si el tipo es "Puntos Ganados" o "Ajuste Manual" o similar
    // para evitar sobrescribir con rollups incorrectos
    if (puntos !== null && tipo && ['Puntos Ganados', 'Ajuste Manual', 'Bonificación'].includes(tipo)) {
      // Si es un registro de puntos, sumamos los puntos al cliente
      // (esto se maneja diferente - los puntos en Manny Rewards son transacciones)
      console.log('Registro de transacción de puntos detectado, no se actualiza balance directo');
    } else if (puntos !== null && Math.abs(puntos - cliente.puntos_actuales) > 0) {
      // Actualización directa de puntos (desde Contactos u otra fuente)
      updates.puntos_actuales = puntos;
      changes.push(`puntos: ${cliente.puntos_actuales} → ${puntos}`);
    }

    // Actualizar notion_page_id si no lo tiene
    if (clienteNotionPageId && !cliente.notion_page_id) {
      updates.notion_page_id = clienteNotionPageId;
      changes.push(`linked to Notion page ${clienteNotionPageId}`);
    }

    // Si hay cambios, actualizar
    if (changes.length > 0) {
      const { error: updateError } = await supabase
        .from('clientes')
        .update(updates)
        .eq('id', cliente.id);

      if (updateError) {
        throw updateError;
      }

      console.log(`Cliente ${cliente.id} actualizado:`, changes.join(', '));

      return new Response(JSON.stringify({
        status: 'updated',
        cliente_id: cliente.id,
        changes: changes
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('No changes detected');
    return new Response(JSON.stringify({
      status: 'no_changes',
      cliente_id: cliente.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing cliente sync webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
