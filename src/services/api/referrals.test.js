import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getOrCreateReferralCode,
  getReferralStats,
  validateReferralCode,
  applyReferralCode,
  getReferralConfig,
} from './referrals';
import { supabase } from '@/lib/customSupabaseClient';
import { ERROR_MESSAGES } from '@/constants/errors';

vi.mock('@/lib/customSupabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock('@/lib/utils', () => ({
  withRetry: vi.fn((fn) => fn()),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    audit: vi.fn(),
    referralApplied: vi.fn(),
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
  order: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn(),
  single: vi.fn(),
};

describe('Referrals Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.from.mockReturnValue(mockBuilder);
  });

  describe('getOrCreateReferralCode', () => {
    it('should return referral code data', async () => {
      const mockCode = { codigo: 'ABC123', cliente_id: 'client-123' };
      supabase.rpc.mockResolvedValue({ data: [mockCode], error: null });

      const result = await getOrCreateReferralCode('client-123');

      expect(result).toEqual(mockCode);
      expect(supabase.rpc).toHaveBeenCalledWith('get_or_create_referral_code', {
        p_cliente_id: 'client-123',
      });
    });

    it('should throw error on RPC failure', async () => {
      supabase.rpc.mockResolvedValue({ data: null, error: { message: 'Error' } });

      await expect(getOrCreateReferralCode('client-123')).rejects.toThrow(
        ERROR_MESSAGES.REFERRALS.CODE_ERROR
      );
    });
  });

  describe('validateReferralCode', () => {
    it('should return valid=true with code data when valid', async () => {
      const mockData = {
        codigo: 'TESTCODE',
        activo: true,
        cliente: { id: 'client-123', nombre: 'Test User' },
      };
      mockBuilder.maybeSingle.mockResolvedValue({ data: mockData, error: null });

      const result = await validateReferralCode('testcode');

      expect(result.valid).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(result.reason).toBeNull();
      expect(mockBuilder.eq).toHaveBeenCalledWith('codigo', 'TESTCODE');
    });

    it('should return valid=false with reason not_found for non-existent code', async () => {
      mockBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });

      const result = await validateReferralCode('INVALID');

      expect(result.valid).toBe(false);
      expect(result.data).toBeNull();
      expect(result.reason).toBe('not_found');
    });

    it('should return valid=false with reason inactive for inactive code', async () => {
      const mockData = {
        codigo: 'TESTCODE',
        activo: false,
        cliente: { id: 'client-123', nombre: 'Test User' },
      };
      mockBuilder.maybeSingle.mockResolvedValue({ data: mockData, error: null });

      const result = await validateReferralCode('TESTCODE');

      expect(result.valid).toBe(false);
      expect(result.data).toBeNull();
      expect(result.reason).toBe('inactive');
    });

    it('should throw error on database error', async () => {
      mockBuilder.maybeSingle.mockResolvedValue({ data: null, error: { message: 'DB Error' } });

      await expect(validateReferralCode('TESTCODE')).rejects.toThrow('Error al validar código');
    });
  });

  describe('applyReferralCode', () => {
    it('should throw error for invalid code format', async () => {
      await expect(applyReferralCode('client-123', 'ABC')).rejects.toThrow(
        ERROR_MESSAGES.REFERRALS.INVALID_CODE
      );
    });

    it('should return success data on valid application', async () => {
      const mockResult = { success: true, puntos_referido: 50 };
      supabase.rpc.mockResolvedValue({ data: mockResult, error: null });

      const result = await applyReferralCode('client-123', 'VALIDCODE');

      expect(result).toEqual(mockResult);
      expect(supabase.rpc).toHaveBeenCalledWith('aplicar_codigo_referido_v2', {
        p_referido_id: 'client-123',
        p_codigo: 'VALIDCODE',
      });
    });

    it('should throw business error with isBusinessError flag', async () => {
      supabase.rpc.mockResolvedValue({
        data: { success: false, error: 'Código ya utilizado' },
        error: null,
      });

      try {
        await applyReferralCode('client-123', 'USEDCODE');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.message).toBe('Código ya utilizado');
        expect(error.isBusinessError).toBe(true);
      }
    });

    it('should throw generic error on RPC failure', async () => {
      supabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(applyReferralCode('client-123', 'VALIDCODE')).rejects.toThrow(
        ERROR_MESSAGES.REFERRALS.APPLY_ERROR
      );
    });
  });

  describe('getReferralConfig', () => {
    it('should return config on success', async () => {
      const mockConfig = {
        activo: true,
        puntos_referidor: 100,
        puntos_referido: 50,
        limite_mensual: 1000,
      };
      mockBuilder.maybeSingle.mockResolvedValue({ data: mockConfig, error: null });

      const result = await getReferralConfig();

      expect(result).toEqual(mockConfig);
      expect(mockBuilder.eq).toHaveBeenCalledWith('activo', true);
    });

    it('should throw error on database error', async () => {
      mockBuilder.maybeSingle.mockResolvedValue({ data: null, error: { message: 'Error' } });

      await expect(getReferralConfig()).rejects.toThrow('Error al cargar configuración');
    });
  });

  describe('getReferralStats', () => {
    it('should calculate stats correctly', async () => {
      // Mock getOrCreateReferralCode
      supabase.rpc
        .mockResolvedValueOnce({ data: [{ codigo: 'MYCODE' }], error: null });

      // Mock referidos query
      const mockReferidos = [
        { estado: 'activo', puntos_referidor: 100, created_at: new Date().toISOString() },
        { estado: 'activo', puntos_referidor: 100, created_at: new Date().toISOString() },
        { estado: 'pendiente', puntos_referidor: 0, created_at: new Date().toISOString() },
      ];

      // Create chainable mock that handles both referidos and config_referidos queries
      const createChainableMock = () => {
        const chain = {
          select: vi.fn(() => chain),
          eq: vi.fn((field, value) => {
            if (field === 'referidor_id') {
              // Return resolved data for referidos query
              return Promise.resolve({ data: mockReferidos, error: null });
            }
            // For config query, return chain to continue
            return chain;
          }),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { activo: true, limite_mensual: 1000, limite_total: 10000 },
            error: null
          }),
        };
        return chain;
      };

      supabase.from.mockImplementation(() => createChainableMock());

      const result = await getReferralStats('client-123');

      expect(result.codigo).toBe('MYCODE');
      expect(result.referidos_activos).toBe(2);
      expect(result.referidos_pendientes).toBe(1);
      expect(result.puntos_ganados).toBe(200);
    });
  });
});
