
import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

const AccesoDenegado = () => {
    return (
        <>
            <Helmet>
                <title>Acceso Denegado - Manny</title>
            </Helmet>
            <div className="min-h-screen flex items-center justify-center text-center p-4 bg-secondary-dark">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="bg-secondary p-10 rounded-3xl shadow-2xl max-w-lg border border-primary-dark"
                >
                    <ShieldAlert className="w-20 h-20 text-primary mx-auto mb-6" />
                    <h1 className="text-4xl mb-4">Acceso Denegado</h1>
                    <p className="text-gray-400 text-lg mb-8">
                        Lo sentimos, esta área es exclusiva para el equipo de administración de Manny.
                    </p>
                    <Link to="/dashboard">
                        <Button variant="investment" size="lg">
                            Volver a mi perfil
                        </Button>
                    </Link>
                </motion.div>
            </div>
        </>
    );
};

export default AccesoDenegado;
