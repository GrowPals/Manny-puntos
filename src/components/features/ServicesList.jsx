import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Clock, Gift, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSupabaseAPI } from '@/context/SupabaseContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';

const ServicesList = () => {
  const { user } = useAuth();
  const api = useSupabaseAPI();
  const { toast } = useToast();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchServices = async () => {
      if (!user?.telefono) return;
      try {
        // We need to fetch services for this user. 
        // Since we don't have a direct API method for this yet in SupabaseContext, 
        // we'll use the supabase client directly here or add it to context.
        // For consistency, let's assume we'll add 'getMisServiciosAsignados' to SupabaseContext later 
        // or just use a direct query here for now if the context isn't updated yet.
        // Actually, let's use the 'supabase' client from the context if exposed, 
        // but SupabaseContext only exposes 'api'. 
        // I should probably add the method to SupabaseContext first or just use the custom client import here.
        // Let's import the client directly for now to avoid modifying Context again immediately, 
        // but ideally it should be in the Context.
        // Wait, I can't import 'supabase' easily if it's not exported from Context. 
        // I'll import it from the lib.
        
        // Actually, let's just add the method to SupabaseContext in the next step. 
        // For now, I will write this component assuming the API exists or I'll use the lib.
        // I'll use the lib for speed.
        
        // Wait, I can't use the lib if I don't know the path for sure. 
        // I know it is '@/lib/customSupabaseClient'.
        
        // Let's try to fetch using the lib.
        const { supabase } = await import('@/lib/customSupabaseClient');
        
        const { data, error } = await supabase
          .from('servicios_asignados')
          .select('*')
          .eq('cliente_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setServices(data || []);
      } catch (error) {
        console.error("Error fetching services:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, [user]);

  const handleRedeem = (service) => {
    // Logic to redeem. For now, maybe just open WhatsApp?
    // "canjear servicios que nosotros le precarguemos"
    // Let's open WhatsApp with a pre-filled message.
    const message = `Hola, soy ${user.nombre} (Tel: ${user.telefono}). Quiero canjear mi servicio de Partner: ${service.nombre}`;
    const whatsappUrl = `https://wa.me/5214624844148?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  }

  if (services.length === 0) {
    return null; // Don't show anything if no services
  }

  return (
    <div className="mb-8 px-4 md:px-0">
      <div className="flex items-center gap-2 mb-4">
        <Gift className="w-6 h-6 text-purple-500" />
        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-pink-500">
          Mis Beneficios Partner
        </h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((service) => (
          <motion.div 
            key={service.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-pink-500/5 overflow-hidden relative">
              <div className="absolute top-0 right-0 p-2">
                <Badge variant={service.estado === 'canjeado' ? 'secondary' : 'default'} className={service.estado === 'canjeado' ? 'bg-gray-200 text-gray-500' : 'bg-purple-500 hover:bg-purple-600'}>
                  {service.estado === 'canjeado' ? 'Canjeado' : 'Disponible'}
                </Badge>
              </div>
              <CardHeader>
                <CardTitle className="text-lg">{service.nombre}</CardTitle>
                <CardDescription>{service.descripcion || 'Beneficio exclusivo para Partners'}</CardDescription>
              </CardHeader>
              <CardFooter>
                {service.estado !== 'canjeado' ? (
                  <Button 
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg shadow-purple-500/25"
                    onClick={() => handleRedeem(service)}
                  >
                    <Gift className="w-4 h-4 mr-2" />
                    Canjear Ahora
                  </Button>
                ) : (
                  <Button variant="outline" disabled className="w-full">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Canjeado el {new Date(service.fecha_canje).toLocaleDateString()}
                  </Button>
                )}
              </CardFooter>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default ServicesList;
