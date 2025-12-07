import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTodosLosCanjes, registrarCanje } from './redemptions';
import { supabase } from '@/lib/customSupabaseClient';
import { ERROR_MESSAGES } from '@/constants/errors';

const mockBuilder = {
  select: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
};

vi.mock('@/lib/customSupabaseClient', () => ({
  supabase: {
    from: vi.fn(() => mockBuilder),
    rpc: vi.fn(),
    functions: {
      invoke: vi.fn(),
    },
  },
}));

describe('Redemptions Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTodosLosCanjes', () => {
    it('should return mapped redemptions', async () => {
      const mockData = [{ 
        id: 1, 
        created_at: '2023-01-01', 
        clientes: { nombre: 'John', telefono: '123' },
        productos: { nombre: 'Prize', tipo: 'fisico' }
      }];
      mockBuilder.order.mockResolvedValue({ data: mockData, error: null });

      const result = await getTodosLosCanjes();
      expect(result[0].cliente_nombre).toBe('John');
      expect(result[0].producto_nombre).toBe('Prize');
    });

    it('should throw error on failure', async () => {
      mockBuilder.order.mockResolvedValue({ data: null, error: { message: 'Error' } });
      await expect(getTodosLosCanjes()).rejects.toThrow(ERROR_MESSAGES.REDEMPTIONS.LOAD_ERROR);
    });
  });

  describe('registrarCanje', () => {
    it('should register redemption and invoke notification', async () => {
      const mockResponse = { canjeId: 1, nuevoSaldo: 50 };
      supabase.rpc.mockResolvedValue({ data: mockResponse, error: null });
      supabase.functions.invoke.mockResolvedValue({ data: {}, error: null });

      const result = await registrarCanje({ cliente_id: 1, producto_id: 1 });
      expect(result.canje.id).toBe(1);
      expect(supabase.functions.invoke).toHaveBeenCalledWith('sync-canje-to-notion', expect.any(Object));
    });

    it('should throw specific error for insufficient points', async () => {
      supabase.rpc.mockResolvedValue({ data: null, error: { message: 'Puntos insuficientes' } });
      await expect(registrarCanje({ cliente_id: 1, producto_id: 1 })).rejects.toThrow(ERROR_MESSAGES.REDEMPTIONS.INSUFFICIENT_POINTS);
    });
  });
});
