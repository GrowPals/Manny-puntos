import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkClienteExists, loginWithPin, loginFirstTime, registerPin, resetClientPin } from './auth';
import { supabase } from '@/lib/customSupabaseClient';
import { ERROR_MESSAGES } from '@/constants/errors';

vi.mock('@/lib/customSupabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

describe('Auth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkClienteExists', () => {
    it('should throw error for invalid phone format', async () => {
      await expect(checkClienteExists('123')).rejects.toThrow(ERROR_MESSAGES.AUTH.INVALID_PHONE_FORMAT);
    });

    it('should return client existence data on success', async () => {
      const mockData = { exists: true, has_pin: true, cliente: { id: 1, nombre: 'Test' } };
      supabase.rpc.mockResolvedValue({ data: mockData, error: null });

      const result = await checkClienteExists('1234567890');
      expect(result).toEqual(mockData);
      expect(supabase.rpc).toHaveBeenCalledWith('check_cliente_exists', {
        telefono_input: '1234567890',
      });
    });

    it('should throw error on DB failure', async () => {
      supabase.rpc.mockResolvedValue({ data: null, error: { message: 'DB Error' } });
      await expect(checkClienteExists('1234567890')).rejects.toThrow(ERROR_MESSAGES.AUTH.CONNECTION_ERROR);
    });
  });

  describe('loginWithPin', () => {
    it('should return client data when PIN is valid', async () => {
      const mockClient = { id: 1, nombre: 'Test' };
      supabase.rpc.mockResolvedValue({ data: { success: true, cliente: mockClient }, error: null });

      const result = await loginWithPin('1234567890', '1234');
      expect(result).toEqual(mockClient);
      expect(supabase.rpc).toHaveBeenCalledWith('verify_client_pin_secure', {
        telefono_input: '1234567890',
        pin_input: '1234',
      });
    });

    it('should throw error when RPC fails', async () => {
      supabase.rpc.mockResolvedValue({ data: null, error: { message: 'DB Error' } });
      await expect(loginWithPin('1234567890', '0000')).rejects.toThrow(ERROR_MESSAGES.AUTH.CONNECTION_ERROR);
    });

    it('should throw error when PIN is incorrect', async () => {
      supabase.rpc.mockResolvedValue({ data: { success: false, error: 'Invalid PIN' }, error: null });
      await expect(loginWithPin('1234567890', '0000')).rejects.toThrow('Invalid PIN');
    });

    it('should throw rate limit error when rate limited', async () => {
      supabase.rpc.mockResolvedValue({ data: { success: false, rate_limited: true }, error: null });
      await expect(loginWithPin('1234567890', '0000')).rejects.toThrow('Demasiados intentos');
    });
  });

  describe('loginFirstTime', () => {
    it('should return client with needsOnboarding when client exists without PIN', async () => {
      const mockClient = { id: 1, nombre: 'Test' };
      supabase.rpc.mockResolvedValue({ data: { exists: true, has_pin: false, cliente: mockClient }, error: null });

      const result = await loginFirstTime('1234567890');
      expect(result.needsOnboarding).toBe(true);
      expect(result.id).toBe(1);
    });

    it('should throw error when client not found', async () => {
      supabase.rpc.mockResolvedValue({ data: { exists: false }, error: null });
      await expect(loginFirstTime('1234567890')).rejects.toThrow(ERROR_MESSAGES.AUTH.CLIENT_NOT_FOUND);
    });

    it('should throw error when client already has PIN', async () => {
      supabase.rpc.mockResolvedValue({ data: { exists: true, has_pin: true }, error: null });
      await expect(loginFirstTime('1234567890')).rejects.toThrow('Este cliente ya tiene PIN registrado');
    });
  });

  describe('registerPin', () => {
    it('should return client data on successful registration', async () => {
      const mockClient = { id: 1, nombre: 'Test' };
      supabase.rpc.mockResolvedValue({ data: { success: true, cliente: mockClient }, error: null });

      const result = await registerPin('1234567890', '1234');
      expect(result).toEqual(mockClient);
      expect(supabase.rpc).toHaveBeenCalledWith('register_client_pin_secure', {
        telefono_input: '1234567890',
        pin_input: '1234',
      });
    });

    it('should throw error on RPC failure', async () => {
      supabase.rpc.mockResolvedValue({ data: null, error: { message: 'Error' } });
      await expect(registerPin('1234567890', '1234')).rejects.toThrow(ERROR_MESSAGES.AUTH.CONNECTION_ERROR);
    });

    it('should throw error when registration fails', async () => {
      supabase.rpc.mockResolvedValue({ data: { success: false, error: 'Registration failed' }, error: null });
      await expect(registerPin('1234567890', '1234')).rejects.toThrow('Registration failed');
    });
  });

  describe('resetClientPin', () => {
    it('should return true on successful reset', async () => {
      supabase.rpc.mockResolvedValue({ data: { success: true }, error: null });

      const result = await resetClientPin('uuid-1234');
      expect(result).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('reset_client_pin', {
        cliente_id_input: 'uuid-1234',
      });
    });

    it('should throw error on RPC failure', async () => {
      supabase.rpc.mockResolvedValue({ data: null, error: { message: 'Error' } });
      await expect(resetClientPin('uuid-1234')).rejects.toThrow('Error al resetear PIN');
    });

    it('should throw error when reset fails', async () => {
      supabase.rpc.mockResolvedValue({ data: { success: false, error: 'Reset failed' }, error: null });
      await expect(resetClientPin('uuid-1234')).rejects.toThrow('Reset failed');
    });
  });
});
