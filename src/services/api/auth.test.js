import { describe, it, expect, vi, beforeEach } from 'vitest';
import { login, verifyPin, getClienteByTelefono } from './auth';
import { supabase } from '@/lib/customSupabaseClient';
import { ERROR_MESSAGES } from '@/constants/errors';

const mockBuilder = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn(),
};

vi.mock('@/lib/customSupabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => mockBuilder),
  },
}));

describe('Auth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getClienteByTelefono', () => {
    it('should throw error for invalid phone format', async () => {
      await expect(getClienteByTelefono('123')).rejects.toThrow(ERROR_MESSAGES.AUTH.INVALID_PHONE_FORMAT);
    });

    it('should return client data on success', async () => {
      const mockData = { id: 1, nombre: 'Test' };
      mockBuilder.maybeSingle.mockResolvedValue({ data: mockData, error: null });

      const result = await getClienteByTelefono('1234567890');
      expect(result).toEqual(mockData);
    });

    it('should throw error on DB failure', async () => {
        mockBuilder.maybeSingle.mockResolvedValue({ data: null, error: { message: 'DB Error' } });
        await expect(getClienteByTelefono('1234567890')).rejects.toThrow(ERROR_MESSAGES.AUTH.CONNECTION_ERROR);
    });
  });

  describe('verifyPin', () => {
    it('should return client data when PIN is valid', async () => {
      const mockClient = { id: 1, nombre: 'Test' };
      supabase.rpc.mockResolvedValue({ data: mockClient, error: null });

      const result = await verifyPin('1234567890', '1234');
      expect(result).toEqual(mockClient);
      expect(supabase.rpc).toHaveBeenCalledWith('verify_client_pin', {
        telefono_input: '1234567890',
        pin_input: '1234',
      });
    });

    it('should return null when RPC fails', async () => {
      supabase.rpc.mockResolvedValue({ data: null, error: { message: 'Invalid PIN' } });

      const result = await verifyPin('1234567890', '0000');
      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return client when credentials are correct', async () => {
      const mockClient = { id: 1, nombre: 'Test' };
      supabase.rpc.mockResolvedValue({ data: mockClient, error: null });

      const result = await login('1234567890', '1234');
      expect(result).toEqual(mockClient);
    });

    it('should throw error when credentials are incorrect', async () => {
      supabase.rpc.mockResolvedValue({ data: null, error: { message: 'Invalid PIN' } });

      await expect(login('1234567890', '0000')).rejects.toThrow(ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS);
    });
  });
});
