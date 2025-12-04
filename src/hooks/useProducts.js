import { useState, useEffect } from 'react';
import { useSupabaseAPI } from '@/context/SupabaseContext';

export const useProducts = () => {
  const api = useSupabaseAPI();
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProductos = async () => {
      setLoading(true);
      try {
        const prods = await api.getProductosCanje();
        setProductos(prods);
      } catch (err) {
        console.error("Error fetching productos", err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    if (api) {
      fetchProductos();
    } else {
      setLoading(false);
    }
  }, [api]);

  return { productos, loading, error };
};
