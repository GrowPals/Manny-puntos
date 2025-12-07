import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

export const useProducts = () => {
  const { data: productos = [], isLoading: loading, error } = useQuery({
    queryKey: ['productos'],
    queryFn: api.products.getProductosCanje,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return { productos, loading, error };
};
