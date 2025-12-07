import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getProductosCanje, crearOActualizarProducto, eliminarProducto } from './products';
import { supabase } from '@/lib/customSupabaseClient';
import { ERROR_MESSAGES } from '@/constants/errors';

const mockBuilder = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn(),
  upsert: vi.fn().mockReturnThis(),
  single: vi.fn(),
  delete: vi.fn().mockReturnThis(),
};

vi.mock('@/lib/customSupabaseClient', () => ({
  supabase: {
    from: vi.fn(() => mockBuilder),
  },
}));

describe('Products Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getProductosCanje', () => {
    it('should return active products ordered by points', async () => {
      const mockData = [{ id: 1, nombre: 'Prize' }];
      mockBuilder.order.mockResolvedValue({ data: mockData, error: null });

      const result = await getProductosCanje();
      expect(result).toEqual(mockData);
    });

    it('should throw error on failure', async () => {
      mockBuilder.order.mockResolvedValue({ data: null, error: { message: 'Error' } });
      await expect(getProductosCanje()).rejects.toThrow(ERROR_MESSAGES.PRODUCTS.LOAD_REDEMPTION_ERROR);
    });
  });

  describe('crearOActualizarProducto', () => {
    it('should throw error for invalid data', async () => {
      await expect(crearOActualizarProducto({ nombre: '' })).rejects.toThrow(ERROR_MESSAGES.PRODUCTS.NAME_REQUIRED);
      await expect(crearOActualizarProducto({ nombre: 'Test', puntos_requeridos: 0 })).rejects.toThrow(ERROR_MESSAGES.PRODUCTS.POINTS_INVALID);
    });

    it('should create product on success', async () => {
      const mockProduct = { id: 1, nombre: 'Test', puntos_requeridos: 100 };
      mockBuilder.single.mockResolvedValue({ data: mockProduct, error: null });

      const result = await crearOActualizarProducto(mockProduct);
      expect(result).toEqual(mockProduct);
    });
  });

  describe('eliminarProducto', () => {
    it('should delete product on success', async () => {
      mockBuilder.eq.mockResolvedValue({ error: null });
      const result = await eliminarProducto(1);
      expect(result).toBe(true);
    });

    it('should throw error on failure', async () => {
      mockBuilder.eq.mockResolvedValue({ error: { message: 'Error' } });
      await expect(eliminarProducto(1)).rejects.toThrow(ERROR_MESSAGES.PRODUCTS.DELETE_ERROR);
    });
  });
});
