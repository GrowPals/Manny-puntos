import { describe, it, expect, vi, beforeEach } from 'vitest';
import { crearOActualizarCliente, getTodosLosClientes } from './clients';
import { supabase } from '@/lib/customSupabaseClient';
import { ERROR_MESSAGES } from '@/constants/errors';

const mockBuilder = {
  select: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  single: vi.fn(),
};

vi.mock('@/lib/customSupabaseClient', () => ({
  supabase: {
    from: vi.fn(() => mockBuilder),
  },
}));

describe('Clients Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTodosLosClientes', () => {
    it('should return clients list on success', async () => {
      const mockData = [{ id: 1, nombre: 'Test' }];
      mockBuilder.range.mockResolvedValue({ data: mockData, error: null, count: 1 });

      const result = await getTodosLosClientes();
      expect(result.data).toEqual(mockData);
      expect(result.count).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('should throw error on DB failure', async () => {
      mockBuilder.range.mockResolvedValue({ data: null, error: { message: 'DB Error' }, count: null });
      await expect(getTodosLosClientes()).rejects.toThrow(ERROR_MESSAGES.CLIENTS.LOAD_ERROR);
    });
  });

  describe('crearOActualizarCliente', () => {
    it('should throw error if name is missing or too short', async () => {
      await expect(crearOActualizarCliente({ nombre: 'Jo', telefono: '1234567890' })).rejects.toThrow(ERROR_MESSAGES.CLIENTS.NAME_REQUIRED);
    });

    it('should throw error if phone is invalid', async () => {
      await expect(crearOActualizarCliente({ nombre: 'John', telefono: '123' })).rejects.toThrow(ERROR_MESSAGES.CLIENTS.PHONE_REQUIRED);
    });

    it('should create client on success', async () => {
      const mockClient = { id: 1, nombre: 'John', telefono: '1234567890' };
      mockBuilder.single.mockResolvedValue({ data: mockClient, error: null });

      const result = await crearOActualizarCliente(mockClient);
      expect(result).toEqual(mockClient);
    });

    it('should throw error if phone already exists', async () => {
      mockBuilder.single.mockResolvedValue({ data: null, error: { code: '23505' } });
      await expect(crearOActualizarCliente({ nombre: 'John', telefono: '1234567890' })).rejects.toThrow(ERROR_MESSAGES.CLIENTS.PHONE_EXISTS);
    });
  });
});
