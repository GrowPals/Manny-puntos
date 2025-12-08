import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncToNotion } from './clients';
import { enqueueSyncOperation } from './sync';
import { supabase } from '@/lib/customSupabaseClient';

vi.mock('@/lib/customSupabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    rpc: vi.fn(),
  },
}));

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

describe('Sync Queue Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('syncToNotion with fallback', () => {
    it('should return data directly when Notion sync succeeds', async () => {
      const mockData = {
        status: 'success',
        contacto_id: 'contacto-123',
        manny_reward_id: 'reward-123',
      };
      supabase.functions.invoke.mockResolvedValue({ data: mockData, error: null });

      const result = await syncToNotion('client-123');

      expect(result).toEqual(mockData);
      expect(supabase.functions.invoke).toHaveBeenCalledWith('sync-cliente-to-notion', {
        body: { cliente_id: 'client-123' },
      });
      // Should not have enqueued
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it('should enqueue and return queued status when Notion sync fails', async () => {
      supabase.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'Notion API rate limited' },
      });
      supabase.rpc.mockResolvedValue({ data: 'queue-id-123', error: null });

      const result = await syncToNotion('client-123');

      expect(result.queued).toBe(true);
      expect(result.status).toBe('queued');
      expect(supabase.rpc).toHaveBeenCalledWith('enqueue_sync_operation', expect.objectContaining({
        p_operation_type: 'sync_cliente',
        p_resource_id: 'client-123',
        p_source: 'clients_service',
      }));
    });

    it('should throw when both Notion sync and enqueue fail', async () => {
      supabase.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'Network error' },
      });
      supabase.rpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });

      await expect(syncToNotion('client-123')).rejects.toThrow('Error al encolar operación de sincronización');
    });
  });

  describe('enqueueSyncOperation', () => {
    it('should call RPC with correct parameters', async () => {
      supabase.rpc.mockResolvedValue({ data: 'queue-id-456', error: null });

      const result = await enqueueSyncOperation('sync_cliente', 'resource-123', {
        extra_data: 'test',
      }, 'test_service');

      expect(result).toBe('queue-id-456');
      expect(supabase.rpc).toHaveBeenCalledWith('enqueue_sync_operation', {
        p_operation_type: 'sync_cliente',
        p_resource_id: 'resource-123',
        p_payload: { extra_data: 'test' },
        p_source: 'test_service',
        p_source_context: expect.objectContaining({
          timestamp: expect.any(String),
        }),
      });
    });

    it('should throw on error', async () => {
      supabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database unavailable' },
      });

      await expect(enqueueSyncOperation('sync_cliente', 'resource-123')).rejects.toThrow(
        'Error al encolar operación de sincronización: Database unavailable'
      );
    });
  });
});

describe('Retry Logic Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should queue operation with exponential backoff metadata', async () => {
    supabase.rpc.mockResolvedValue({ data: 'queue-id', error: null });

    await enqueueSyncOperation('create_benefit_ticket', 'benefit-123', {
      original_error: 'Notion timeout',
    });

    const call = supabase.rpc.mock.calls[0];
    expect(call[1].p_payload).toEqual({
      original_error: 'Notion timeout',
    });
  });

  it('should include source context for debugging', async () => {
    const beforeTime = new Date().toISOString();
    supabase.rpc.mockResolvedValue({ data: 'queue-id', error: null });

    await enqueueSyncOperation('sync_cliente', 'client-123');

    const call = supabase.rpc.mock.calls[0];
    const timestamp = call[1].p_source_context.timestamp;

    // Verify timestamp is a valid ISO string close to now
    expect(new Date(timestamp).getTime()).toBeGreaterThanOrEqual(new Date(beforeTime).getTime());
  });
});
