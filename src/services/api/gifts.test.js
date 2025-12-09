import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getGiftByCode, claimGift, createBenefitTicket } from './gifts';
import { enqueueSyncOperation } from './sync';
import { supabase } from '@/lib/customSupabaseClient';
import { ERROR_MESSAGES } from '@/constants/errors';

// Mock supabase
vi.mock('@/lib/customSupabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    functions: {
      invoke: vi.fn(),
    },
  },
}));

// Mock utils - withRetry and callEdgeFunction
vi.mock('@/lib/utils', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    withRetry: vi.fn((fn) => fn()),
    callEdgeFunction: vi.fn(async (supabase, functionName, body) => {
      const { data, error } = await supabase.functions.invoke(functionName, { body });
      if (error) throw error;
      return data;
    }),
  };
});

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    audit: vi.fn(),
    giftClaimed: vi.fn(),
    giftClaimFailed: vi.fn(),
    syncQueued: vi.fn(),
    syncFailed: vi.fn(),
  },
  LogLevel: {
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
  },
  EventType: {
    LOGIN_SUCCESS: 'auth.login_success',
    LOGIN_FAILED: 'auth.login_failed',
    LOGOUT: 'auth.logout',
    PIN_REGISTERED: 'auth.pin_registered',
    GIFT_VIEWED: 'gift.viewed',
    GIFT_CLAIMED: 'gift.claimed',
    GIFT_CLAIM_FAILED: 'gift.claim_failed',
    REFERRAL_APPLIED: 'referral.applied',
    REFERRAL_FAILED: 'referral.failed',
    SYNC_QUEUED: 'sync.queued',
    SYNC_COMPLETED: 'sync.completed',
    SYNC_FAILED: 'sync.failed',
    REDEMPTION_SUCCESS: 'redemption.success',
    REDEMPTION_FAILED: 'redemption.failed',
  },
}));

const mockBuilder = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn(),
};

describe('Gifts Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.from.mockReturnValue(mockBuilder);
  });

  describe('getGiftByCode', () => {
    it('should return gift data on valid code', async () => {
      const mockGift = {
        id: 'gift-123',
        codigo: 'TESTCODE',
        tipo: 'servicio',
        nombre_beneficio: 'Test Service',
        estado: 'pendiente',
      };
      supabase.rpc.mockResolvedValue({ data: null, error: null });
      mockBuilder.maybeSingle.mockResolvedValue({ data: mockGift, error: null });

      const result = await getGiftByCode('testcode');

      expect(result).toEqual(mockGift);
      expect(supabase.rpc).toHaveBeenCalledWith('incrementar_vistas_link', {
        p_codigo: 'TESTCODE',
      });
    });

    it('should return null for non-existent code', async () => {
      supabase.rpc.mockResolvedValue({ data: null, error: null });
      mockBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });

      const result = await getGiftByCode('NONEXISTENT');

      expect(result).toBeNull();
    });

    it('should mark as expired if fecha_expiracion is past', async () => {
      const mockGift = {
        id: 'gift-123',
        codigo: 'EXPIRED',
        estado: 'pendiente',
        fecha_expiracion: '2020-01-01T00:00:00Z',
      };
      supabase.rpc.mockResolvedValue({ data: null, error: null });
      mockBuilder.maybeSingle.mockResolvedValue({ data: mockGift, error: null });

      const result = await getGiftByCode('EXPIRED');

      expect(result.estado).toBe('expirado');
    });

    it('should mark campaign as agotado when max_canjes reached', async () => {
      const mockGift = {
        id: 'gift-123',
        codigo: 'CAMPAIGN',
        estado: 'pendiente',
        es_campana: true,
        max_canjes: 10,
        canjes_realizados: 10,
      };
      supabase.rpc.mockResolvedValue({ data: null, error: null });
      mockBuilder.maybeSingle.mockResolvedValue({ data: mockGift, error: null });

      const result = await getGiftByCode('CAMPAIGN');

      expect(result.estado).toBe('agotado');
    });
  });

  describe('claimGift', () => {
    it('should throw error for invalid code format', async () => {
      await expect(claimGift('ABC', '1234567890')).rejects.toThrow(
        ERROR_MESSAGES.GIFTS.INVALID_CODE
      );
    });

    it('should throw error for invalid phone', async () => {
      await expect(claimGift('VALIDCODE', '123')).rejects.toThrow(
        ERROR_MESSAGES.GIFTS.INVALID_PHONE
      );
    });

    it('should return success data on valid claim', async () => {
      const mockResult = {
        success: true,
        cliente_id: 'client-123',
        beneficio_id: 'benefit-123',
        cliente_nuevo: false,
      };
      supabase.rpc.mockResolvedValue({ data: mockResult, error: null });

      const result = await claimGift('VALIDCODE', '1234567890');

      expect(result).toEqual(mockResult);
      expect(supabase.rpc).toHaveBeenCalledWith('canjear_link_regalo', {
        p_codigo: 'VALIDCODE',
        p_telefono: '1234567890',
      });
    });

    it('should throw business error when claim fails', async () => {
      supabase.rpc.mockResolvedValue({
        data: { success: false, error: 'Este regalo ya fue canjeado' },
        error: null,
      });

      await expect(claimGift('VALIDCODE', '1234567890')).rejects.toThrow(
        'Este regalo ya fue canjeado'
      );
    });

    it('should throw generic error on RPC failure', async () => {
      supabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(claimGift('VALIDCODE', '1234567890')).rejects.toThrow(
        ERROR_MESSAGES.GIFTS.CLAIM_ERROR
      );
    });
  });

  describe('createBenefitTicket', () => {
    it('should return data on successful ticket creation', async () => {
      const mockData = { status: 'success', notion_id: 'notion-123' };
      supabase.functions.invoke.mockResolvedValue({ data: mockData, error: null });

      const result = await createBenefitTicket('benefit-123');

      expect(result).toEqual(mockData);
      expect(supabase.functions.invoke).toHaveBeenCalledWith('create-reward-ticket', {
        body: { tipo: 'beneficio', id: 'benefit-123' },
      });
    });

    it('should queue for retry and return queued status on failure', async () => {
      supabase.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'Notion API error' },
      });
      supabase.rpc.mockResolvedValue({ data: 'queue-id', error: null });

      const result = await createBenefitTicket('benefit-123');

      expect(result.queued).toBe(true);
      expect(result.status).toBe('queued');
      expect(supabase.rpc).toHaveBeenCalledWith('enqueue_sync_operation', expect.objectContaining({
        p_operation_type: 'create_benefit_ticket',
        p_resource_id: 'benefit-123',
      }));
    });
  });

  describe('enqueueSyncOperation (from sync module)', () => {
    it('should enqueue operation successfully', async () => {
      supabase.rpc.mockResolvedValue({ data: 'queue-id-123', error: null });

      const result = await enqueueSyncOperation('sync_cliente', 'client-123', { test: true }, 'test_source');

      expect(result).toBe('queue-id-123');
      expect(supabase.rpc).toHaveBeenCalledWith('enqueue_sync_operation', {
        p_operation_type: 'sync_cliente',
        p_resource_id: 'client-123',
        p_payload: { test: true },
        p_source: 'test_source',
        p_source_context: expect.objectContaining({ timestamp: expect.any(String) }),
      });
    });

    it('should throw on enqueue failure', async () => {
      supabase.rpc.mockResolvedValue({ data: null, error: { message: 'RPC error' } });

      await expect(
        enqueueSyncOperation('sync_cliente', 'client-123', {}, 'test_source')
      ).rejects.toThrow('Error al encolar operación de sincronización: RPC error');
    });
  });
});
