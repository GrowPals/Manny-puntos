import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getServiciosCliente, canjearServicioAsignado } from './services';
import { supabase } from '@/lib/customSupabaseClient';
import { ERROR_MESSAGES } from '@/constants/errors';

const mockBuilder = {
  select: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  single: vi.fn(),
};

vi.mock('@/lib/customSupabaseClient', () => ({
  supabase: {
    from: vi.fn(() => mockBuilder),
  },
}));

describe('Services Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getServiciosCliente', () => {
    it('should return services list', async () => {
      const mockData = [{ id: 1, nombre: 'Service' }];
      mockBuilder.order.mockResolvedValue({ data: mockData, error: null });

      const result = await getServiciosCliente(1);
      expect(result).toEqual(mockData);
    });

    it('should throw error on failure', async () => {
      mockBuilder.order.mockResolvedValue({ data: null, error: { message: 'Error' } });
      await expect(getServiciosCliente(1)).rejects.toThrow(ERROR_MESSAGES.SERVICES.LOAD_ERROR);
    });
  });

  describe('canjearServicioAsignado', () => {
    it('should redeem service on success', async () => {
      const mockService = { id: 1, estado: 'canjeado' };
      mockBuilder.single.mockResolvedValue({ data: mockService, error: null });

      const result = await canjearServicioAsignado(1);
      expect(result).toEqual(mockService);
    });

    it('should throw error on failure', async () => {
      mockBuilder.single.mockResolvedValue({ data: null, error: { message: 'Error' } });
      await expect(canjearServicioAsignado(1)).rejects.toThrow(ERROR_MESSAGES.SERVICES.REDEEM_ERROR);
    });
  });
});
