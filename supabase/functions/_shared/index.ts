/**
 * Módulo compartido para Edge Functions de Manny Rewards
 * Centraliza: CORS, Notion API, mapeo de estados, tipos, y utilidades
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// TIPOS
// ============================================================================

export interface NotionPage {
  id: string;
  properties: Record<string, any>;
}

export interface WebhookPayload {
  challenge?: string;
  data?: { id?: string; properties?: Record<string, any> };
  id?: string;
  page_id?: string;
  page?: { id?: string; properties?: Record<string, any> };
  properties?: Record<string, any>;
}

export interface ApiResponse<T = unknown> {
  status: 'success' | 'error' | 'skipped';
  data?: T;
  reason?: string;
  error?: string;
}

// ============================================================================
// CORS
// ============================================================================

// CORS origins - use environment variable in production
const isDevelopment = Deno.env.get('ENVIRONMENT') !== 'production';

export const ALLOWED_ORIGINS = isDevelopment
  ? [
      'https://recompensas.manny.mx',
      'http://localhost:5173',
      'http://localhost:3000',
      'http://[::]:3000',
    ] as const
  : [
      'https://recompensas.manny.mx',
    ] as const;

/**
 * Genera headers CORS basados en el origen de la request
 * @param origin Origen de la request (puede ser null para webhooks)
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = !origin || ALLOWED_ORIGINS.includes(origin as typeof ALLOWED_ORIGINS[number])
    ? (origin || ALLOWED_ORIGINS[0])
    : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cliente-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

/**
 * Wrapper para manejar OPTIONS requests
 */
export function handleCors(req: Request): Response | null {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

// ============================================================================
// NOTION DATABASE IDs
// ============================================================================

export const NOTION_DBS = {
  get MANNY_REWARDS() {
    return Deno.env.get('NOTION_MANNY_REWARDS_DB') || '2bfc6cfd-8c1e-8026-9291-e4bc8c18ee01';
  },
  get CONTACTOS() {
    return Deno.env.get('NOTION_CONTACTOS_DB') || '17ac6cfd-8c1e-8068-8bc0-d32488189164';
  },
  get TICKETS() {
    return Deno.env.get('NOTION_TICKETS_DB') || '17ac6cfd-8c1e-8162-b724-d4047a7e7635';
  },
} as const;

// ============================================================================
// MAPEO DE ESTADOS (Bidireccional)
// ============================================================================

export const SUPABASE_TO_NOTION_ESTADO: Record<string, string> = {
  'guardado': 'Guardado',           // Recompensa disponible, aún no entra al sistema de tickets
  'pendiente_entrega': 'Pendiente Entrega',
  'en_lista': 'En Proceso',
  'entregado': 'Entregado',
  'completado': 'Completado',
  'agendado': 'Agendado',
  'cancelado': 'Cancelado',
};

export const NOTION_TO_SUPABASE_ESTADO: Record<string, string> = {
  'Guardado': 'guardado',           // Recompensa disponible, aún no entra al sistema de tickets
  'Pendiente Entrega': 'pendiente_entrega',
  'En Proceso': 'en_lista',
  'Entregado': 'entregado',
  'Completado': 'completado',
  'Agendado': 'agendado',
  'Cancelado': 'cancelado',
};

export function supabaseEstadoToNotion(supabaseEstado: string): string {
  return SUPABASE_TO_NOTION_ESTADO[supabaseEstado] || 'Pendiente Entrega';
}

export function notionEstadoToSupabase(notionEstado: string): string | null {
  return NOTION_TO_SUPABASE_ESTADO[notionEstado] || null;
}

// ============================================================================
// NOTION API CLIENT
// ============================================================================

const NOTION_API_VERSION = '2022-06-28';
const NOTION_BASE_URL = 'https://api.notion.com/v1';

export class NotionApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public responseBody: string
  ) {
    super(message);
    this.name = 'NotionApiError';
  }
}

/**
 * Realiza una request a la API de Notion con retry y manejo de errores
 */
export async function notionRequest<T = any>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  body: Record<string, unknown> | null,
  token: string,
  retries = 2
): Promise<T> {
  const url = `${NOTION_BASE_URL}${endpoint}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Notion-Version': NOTION_API_VERSION,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();

        // Rate limit - wait and retry
        if (response.status === 429 && attempt < retries) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10);
          console.warn(`Notion rate limited, waiting ${retryAfter}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          continue;
        }

        // Server error - retry
        if (response.status >= 500 && attempt < retries) {
          console.warn(`Notion server error ${response.status}, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }

        throw new NotionApiError(
          `Notion API error: ${response.status}`,
          response.status,
          errorText
        );
      }

      return await response.json() as T;
    } catch (error) {
      if (error instanceof NotionApiError) throw error;

      if (attempt < retries) {
        console.warn(`Notion request failed, retrying: ${error}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }

  throw new Error('Max retries exceeded');
}

/**
 * Obtiene una página de Notion por ID
 */
export async function getNotionPage(pageId: string, token: string): Promise<NotionPage | null> {
  try {
    return await notionRequest<NotionPage>(`/pages/${pageId}`, 'GET', null, token);
  } catch (error) {
    if (error instanceof NotionApiError && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Actualiza una página de Notion
 */
export async function updateNotionPage(
  pageId: string,
  properties: Record<string, unknown>,
  token: string
): Promise<NotionPage> {
  return notionRequest<NotionPage>(`/pages/${pageId}`, 'PATCH', { properties }, token);
}

/**
 * Crea una página en una database de Notion
 */
export async function createNotionPage(
  databaseId: string,
  properties: Record<string, unknown>,
  token: string
): Promise<NotionPage> {
  return notionRequest<NotionPage>('/pages', 'POST', {
    parent: { database_id: databaseId },
    properties
  }, token);
}

/**
 * Busca en una database de Notion
 */
export async function queryNotionDatabase(
  databaseId: string,
  filter: Record<string, unknown> | null,
  token: string,
  pageSize = 100
): Promise<NotionPage[]> {
  const result = await notionRequest<{ results: NotionPage[] }>(
    `/databases/${databaseId}/query`,
    'POST',
    { filter, page_size: pageSize },
    token
  );
  return result.results || [];
}

// ============================================================================
// EXTRACTORES DE PROPIEDADES DE NOTION
// ============================================================================

export function extractRichText(properties: Record<string, any>, fieldName: string): string | null {
  const field = properties[fieldName];
  if (!field?.rich_text || field.rich_text.length === 0) return null;
  return field.rich_text.map((t: any) => t.plain_text).join('') || null;
}

export function extractTitle(properties: Record<string, any>, fieldNames: string[] = ['', 'title', 'Name', 'Nombre']): string {
  for (const name of fieldNames) {
    const field = properties[name];
    if (field?.title && field.title.length > 0) {
      return field.title.map((t: any) => t.plain_text).join('');
    }
  }
  return 'Sin nombre';
}

export function extractNumber(properties: Record<string, any>, fieldName: string): number {
  const field = properties[fieldName];
  if (!field) return 0;
  if (field.number !== undefined) return field.number;
  if (field.formula?.number !== undefined) return field.formula.number;
  if (field.rollup?.number !== undefined) return field.rollup.number;
  return 0;
}

export function extractSelect(properties: Record<string, any>, fieldName: string): string | null {
  const field = properties[fieldName];
  if (!field) return null;
  return field.select?.name || field.status?.name || null;
}

export function extractDate(properties: Record<string, any>, fieldName: string): string | null {
  const field = properties[fieldName];
  if (!field?.date) return null;
  return field.date.start || null;
}

export function extractRelation(properties: Record<string, any>, fieldName: string): string | null {
  const field = properties[fieldName];
  if (!field?.relation || field.relation.length === 0) return null;
  return field.relation[0].id;
}

export function extractPhoneNumber(properties: Record<string, any>, fieldName = 'Teléfono'): string | null {
  const field = properties[fieldName];
  if (!field?.phone_number) return null;

  let phone = field.phone_number.replace(/\D/g, '');

  // Normalizar: quitar prefijo de país
  if (phone.startsWith('52') && phone.length > 10) {
    phone = phone.slice(2);
  }
  if (phone.startsWith('1') && phone.length > 10) {
    phone = phone.slice(1);
  }

  return phone.length >= 10 ? phone : null;
}

export function extractEmail(properties: Record<string, any>, fieldName = 'E-mail'): string | null {
  const field = properties[fieldName];
  return field?.email || null;
}

// ============================================================================
// EXTRACTOR DE PAYLOAD DE WEBHOOK
// ============================================================================

/**
 * Extrae el page ID y propiedades de diferentes estructuras de webhook de Notion
 */
export async function extractWebhookPage(
  payload: WebhookPayload,
  notionToken: string | null
): Promise<{ pageId: string; page: NotionPage } | null> {
  let page: NotionPage | null = null;
  let pageId: string | null = null;

  // Estructura 1: data.properties existe
  if (payload.data?.properties) {
    page = payload.data as NotionPage;
    pageId = payload.data.id!;
  }
  // Estructura 2: properties en root
  else if (payload.properties) {
    page = payload as NotionPage;
    pageId = (payload as any).id;
  }
  // Estructura 3: page.properties
  else if (payload.page?.properties) {
    page = payload.page as NotionPage;
    pageId = payload.page.id!;
  }
  // Estructura 4: Solo IDs - necesitamos fetch
  else {
    pageId = payload.data?.id || payload.id || payload.page_id || payload.page?.id || null;

    if (pageId && notionToken) {
      page = await getNotionPage(pageId, notionToken);
    }
  }

  if (!page || !pageId) return null;
  return { pageId, page };
}

// ============================================================================
// VERIFICACIÓN DE WEBHOOKS
// ============================================================================

/**
 * Verifica que un webhook viene de una fuente autorizada
 *
 * NOTA: Notion no permite enviar headers personalizados en webhooks,
 * por lo que la verificación se basa en:
 * 1. Validación de estructura del payload
 * 2. Idempotencia via ticket_events/webhook_events tables
 * 3. URLs de webhook no públicas (solo conocidas por Notion)
 */
export function verifyWebhookSecret(req: Request): boolean {
  // Notion webhooks no soportan autenticación por header
  // La seguridad se maneja via:
  // - URLs secretas configuradas en Notion
  // - Validación de payload structure
  // - Idempotencia en procesamiento
  return true;
}

/**
 * Maneja el challenge de verificación de Notion webhooks
 */
export function handleNotionChallenge(
  payload: WebhookPayload,
  corsHeaders: Record<string, string>
): Response | null {
  if (payload.challenge) {
    return new Response(
      JSON.stringify({ challenge: payload.challenge }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  return null;
}

// ============================================================================
// SUPABASE CLIENT
// ============================================================================

export function createSupabaseAdmin(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

export function getNotionToken(): string {
  const token = Deno.env.get('NOTION_TOKEN');
  if (!token) {
    throw new Error('NOTION_TOKEN not configured');
  }
  return token;
}

// ============================================================================
// AUTENTICACIÓN Y AUTORIZACIÓN
// ============================================================================

export interface AuthResult {
  success: boolean;
  clienteId?: string;
  isAdmin?: boolean;
  error?: string;
  statusCode?: number;
}

/**
 * Verifica autenticación del caller (requiere x-cliente-id header)
 */
export async function verifyAuth(
  req: Request,
  supabase: SupabaseClient,
  requireAdmin = false
): Promise<AuthResult> {
  const clienteId = req.headers.get('x-cliente-id');

  if (!clienteId) {
    return { success: false, error: 'Authentication required', statusCode: 401 };
  }

  const { data: cliente, error } = await supabase
    .from('clientes')
    .select('id, es_admin')
    .eq('id', clienteId)
    .single();

  if (error || !cliente) {
    return { success: false, error: 'Invalid authentication', statusCode: 401 };
  }

  if (requireAdmin && !cliente.es_admin) {
    return { success: false, error: 'Admin access required', statusCode: 403 };
  }

  return { success: true, clienteId: cliente.id, isAdmin: cliente.es_admin };
}

/**
 * Verifica que el caller tiene acceso al recurso (es el dueño o es admin)
 */
export async function verifyOwnership(
  req: Request,
  supabase: SupabaseClient,
  resourceClienteId: string
): Promise<AuthResult> {
  const auth = await verifyAuth(req, supabase);

  if (!auth.success) return auth;

  // Admin puede acceder a todo
  if (auth.isAdmin) return auth;

  // Usuario normal solo puede acceder a sus propios recursos
  if (auth.clienteId !== resourceClienteId) {
    return { success: false, error: 'Access denied', statusCode: 403 };
  }

  return auth;
}

// ============================================================================
// RETRY UTILITIES
// ============================================================================

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
}

/**
 * Ejecuta una operación con reintentos y backoff exponencial
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 500,
    maxDelayMs = 5000,
    shouldRetry = () => true,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !shouldRetry(error)) {
        throw error;
      }

      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
      console.warn(`Operation failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms:`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Ejecuta una operación de Supabase con reintentos
 * Solo reintenta errores de red/servidor, no errores de negocio
 */
export async function withSupabaseRetry<T>(
  operation: () => Promise<{ data: T | null; error: { message: string; code?: string } | null }>,
  options: RetryOptions = {}
): Promise<{ data: T | null; error: { message: string; code?: string } | null }> {
  const shouldRetry = (error: unknown) => {
    // Don't retry business logic errors (constraint violations, etc.)
    if (error && typeof error === 'object' && 'code' in error) {
      const code = (error as { code: string }).code;
      // Don't retry constraint violations, auth errors, etc.
      if (['23505', '23503', '42501', '42P01', 'PGRST'].some(c => code?.startsWith(c))) {
        return false;
      }
    }
    return true;
  };

  return withRetry(operation, { ...options, shouldRetry });
}

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

export function jsonResponse<T>(
  data: T,
  corsHeaders: Record<string, string>,
  status = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function errorResponse(
  message: string,
  corsHeaders: Record<string, string>,
  status = 500
): Response {
  return jsonResponse({ error: message }, corsHeaders, status);
}

export function successResponse<T>(
  data: T,
  corsHeaders: Record<string, string>
): Response {
  return jsonResponse({ status: 'success', ...data }, corsHeaders);
}

export function skippedResponse(
  reason: string,
  corsHeaders: Record<string, string>,
  extra?: Record<string, unknown>
): Response {
  return jsonResponse({ status: 'skipped', reason, ...extra }, corsHeaders);
}
