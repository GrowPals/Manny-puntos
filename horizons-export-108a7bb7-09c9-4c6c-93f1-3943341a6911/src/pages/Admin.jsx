
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Users, TrendingUp, Gift, Truck } from 'lucide-react';
import { useNotionAPI } from '@/context/NotionAPIContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const AdminMetricCard = ({ icon, title, value, color, gradient }) => (
    <div className={`card p-6 ${gradient}`}>
        <div className="flex items-center gap-4 mb-2">
            <div className={`w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center`}>
                {React.cloneElement(icon, { className: `w-6 h-6 text-white` })}
            </div>
            <span className="text-white/80 font-medium">{title}</span>
        </div>
        <p className="text-4xl font-black text-white">{value}</p>
    </div>
);

const Admin = () => {
    const { getTodosLosClientes, getProductosCanje, getCanjesPendientes } = useNotionAPI();
    const [metrics, setMetrics] = useState({
        clientes: 0,
        puntos: 0,
        productos: 0,
        canjes: 0,
    });
    const [entregas, setEntregas] = useState([]);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const [clientesData, productosData, canjesData] = await Promise.all([
                    getTodosLosClientes(),
                    getProductosCanje(),
                    getCanjesPendientes(),
                ]);

                const totalPoints = clientesData.reduce((sum, c) => sum + c.puntos_actuales, 0);

                setMetrics({
                    clientes: clientesData.length,
                    puntos: totalPoints,
                    productos: productosData.filter(p => p.activo).length,
                    canjes: canjesData.length,
                });
                setEntregas(canjesData.slice(0, 5));
            } catch (error) {
                console.error("Failed to fetch admin dashboard data", error);
            }
        };
        fetchDashboardData();
    }, [getTodosLosClientes, getProductosCanje, getCanjesPendientes]);

    return (
        <>
            <Helmet>
                <title>Panel Admin - Manny</title>
                <meta name="description" content="Dashboard de administración del sistema de recompensas Manny" />
            </Helmet>

            <div className="min-h-screen flex flex-col">
                <Header />
                <main className="flex-1 container mx-auto px-4 py-8">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                        <h1 className="text-3xl md:text-4xl">Dashboard de Admin</h1>
                        <p className="text-gray-400 mt-1">Resumen del sistema de recompensas.</p>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <AdminMetricCard icon={<Users />} title="Clientes Activos" value={metrics.clientes} gradient="bg-gradient-to-br from-blue-500 to-blue-700" />
                        <AdminMetricCard icon={<TrendingUp />} title="Puntos Totales" value={metrics.puntos.toLocaleString('es-MX')} gradient="bg-gradient-to-br from-green-500 to-green-700" />
                        <AdminMetricCard icon={<Gift />} title="Productos Activos" value={metrics.productos} gradient="bg-gradient-to-br from-purple-500 to-purple-700" />
                        <AdminMetricCard icon={<Truck />} title="Entregas Pendientes" value={metrics.canjes} gradient="bg-manny-gradient" />
                    </div>

                    <div className="bg-secondary rounded-3xl shadow-xl p-6 md:p-8">
                        <h2 className="text-2xl mb-6">Últimas Entregas Pendientes</h2>
                        <div className="space-y-4">
                            {entregas.length > 0 ? entregas.map((entrega) => (
                                <div key={entrega.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 bg-secondary-light rounded-xl hover:bg-secondary-light/80 transition-colors">
                                    <div>
                                        <p className="font-bold text-white">{entrega.producto_nombre}</p>
                                        <p className="text-sm text-gray-400">Para: <span className="font-medium text-gray-300">{entrega.cliente_nombre}</span> ({entrega.cliente_telefono})</p>
                                    </div>
                                    <div className="text-sm text-gray-500">
                                        Solicitado el {new Date(entrega.fecha).toLocaleDateString('es-MX')}
                                    </div>
                                </div>
                            )) : (
                                <p className="text-center text-gray-500 py-8">¡No hay entregas pendientes!</p>
                            )}
                        </div>
                    </div>
                </main>
                <Footer />
            </div>
        </>
    );
};

export default Admin;
