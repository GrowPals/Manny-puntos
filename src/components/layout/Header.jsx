import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate, NavLink as RouterNavLink } from 'react-router-dom';
import { LayoutDashboard, Package, Truck, Coins, Shield, Users, Menu, X, Gift, History, LogOut, ShieldCheck, Bell, Wrench } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { cn } from '@/lib/utils';
import MannyLogo from '@/assets/images/manny-logo.svg';

const NavLink = React.memo(({ to, children, onClick, end = false, compact = false }) => {
    return (
        <RouterNavLink
            to={to}
            end={end}
            onClick={onClick}
            className={({ isActive }) => cn(
                "flex items-center justify-start rounded-lg transition-all duration-200 font-medium whitespace-nowrap",
                compact
                    ? "text-sm h-9 px-3"
                    : "text-base h-12 px-4",
                isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
        >
            {children}
        </RouterNavLink>
    );
});


const Header = () => {
    const { user, isAdmin, logout } = useAuth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 768) {
                setIsMenuOpen(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const body = document.querySelector('body');
        if (isMenuOpen) {
            body.style.overflow = 'hidden';
        } else {
            body.style.overflow = 'auto';
        }
        return () => {
            body.style.overflow = 'auto';
        };
    }, [isMenuOpen]);

    useEffect(() => {
        setIsMenuOpen(false);
    }, [location.pathname]);

    const handleLogout = useCallback(() => {
        logout();
        navigate('/login', { replace: true });
    }, [logout, navigate]);
    
    const toggleMenu = useCallback(() => setIsMenuOpen(prev => !prev), []);

    // Desktop admin links - compact version for header
    const AdminNavLinksDesktop = () => (
        <>
            <NavLink to="/admin" end compact><LayoutDashboard className="w-4 h-4 mr-1.5" />Dashboard</NavLink>
            <NavLink to="/admin/productos" compact><Package className="w-4 h-4 mr-1.5" />Productos</NavLink>
            <NavLink to="/admin/clientes" compact><Users className="w-4 h-4 mr-1.5" />Clientes</NavLink>
            <NavLink to="/admin/entregas" compact><Truck className="w-4 h-4 mr-1.5" />Canjes</NavLink>
            <NavLink to="/admin/recordatorios" compact><Bell className="w-4 h-4 mr-1.5" />Recordatorios</NavLink>
            <div className="w-px h-6 bg-border mx-1" />
            <NavLink to="/dashboard" end compact><Shield className="w-4 h-4 mr-1.5" />Cliente</NavLink>
        </>
    );

    // Mobile admin links - full version for drawer
    const AdminNavLinksMobile = ({ onClick }) => (
        <>
            <NavLink to="/admin" end onClick={onClick}><LayoutDashboard className="w-5 h-5 mr-3" />Dashboard</NavLink>
            <NavLink to="/admin/productos" onClick={onClick}><Package className="w-5 h-5 mr-3" />Recompensas</NavLink>
            <NavLink to="/admin/clientes" onClick={onClick}><Users className="w-5 h-5 mr-3" />Clientes</NavLink>
            <NavLink to="/admin/entregas" onClick={onClick}><Truck className="w-5 h-5 mr-3" />Canjes</NavLink>
            <NavLink to="/admin/recordatorios" onClick={onClick}><Bell className="w-5 h-5 mr-3" />Recordatorios</NavLink>
            <NavLink to="/admin/gestion" onClick={onClick}><ShieldCheck className="w-5 h-5 mr-3" />Admins</NavLink>
            <hr className="my-2 border-border" />
            <NavLink to="/dashboard" end onClick={onClick}><Shield className="w-5 h-5 mr-3" />Vista Cliente</NavLink>
        </>
    );

    const ClientNavLinks = ({ onClick, compact = false }) => (
        <>
            <NavLink to="/dashboard" end onClick={onClick} compact={compact}><Gift className={cn(compact ? "w-4 h-4 mr-1.5" : "w-5 h-5 mr-3")} />Canjear</NavLink>
            <NavLink to="/mis-servicios" onClick={onClick} compact={compact}><Wrench className={cn(compact ? "w-4 h-4 mr-1.5" : "w-5 h-5 mr-3")} />Servicios</NavLink>
            <NavLink to="/mis-canjes" onClick={onClick} compact={compact}><History className={cn(compact ? "w-4 h-4 mr-1.5" : "w-5 h-5 mr-3")} />Canjes</NavLink>
        </>
    );

    const backdropVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
        exit: { opacity: 0 }
    };
    
    const menuVariants = {
        hidden: { x: '100%' },
        visible: { x: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } },
        exit: { x: '100%', transition: { duration: 0.2 } }
    };

    return (
        <header className="bg-card shadow-sm sticky top-0 z-50 border-b border-border">
            <nav className="container mx-auto px-4 h-14">
                <div className="flex items-center justify-between h-full gap-4">
                    <Link to={isAdmin ? '/admin' : '/dashboard'} className="flex items-center group flex-shrink-0" aria-label="Ir a la página principal">
                        <img src={MannyLogo} alt="Manny Logo" className="h-10 w-auto transition-transform duration-300 group-hover:scale-105" />
                    </Link>

                    <div className="hidden lg:flex items-center gap-1">
                        {isAdmin ? <AdminNavLinksDesktop /> : (user && <ClientNavLinks compact />)}
                    </div>

                    <div className="flex items-center gap-2">
                        {user && (
                            <div className={cn(
                                "px-3 py-1.5 bg-primary/10 text-primary rounded-lg font-semibold flex items-center gap-1.5 text-sm",
                                isAdmin && "hidden lg:flex"
                            )}>
                                <Coins className="w-4 h-4" />
                                {user.puntos_actuales?.toLocaleString('es-MX')}
                            </div>
                        )}
                        <ThemeToggle />
                        {user && (
                            <Button variant="ghost" size="icon" onClick={handleLogout} className="hidden lg:flex h-9 w-9" aria-label="Cerrar sesión">
                                <LogOut className="w-5 h-5" />
                            </Button>
                        )}
                        {/* Hamburger menu on mobile/tablet */}
                        {user && (
                            <div className="lg:hidden">
                                <Button variant="ghost" size="icon" onClick={toggleMenu} className="h-9 w-9" aria-label="Abrir menú">
                                    <Menu className="w-5 h-5" />
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </nav>

            <AnimatePresence>
                {isMenuOpen && user && (
                    <>
                        <motion.div
                            variants={backdropVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            onClick={toggleMenu}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99] md:hidden"
                            aria-hidden="true"
                        />
                        <motion.div 
                            variants={menuVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="fixed top-0 right-0 h-dvh w-[85%] max-w-sm bg-card z-[100] p-6 flex flex-col shadow-2xl md:hidden border-l border-border"
                            role="dialog"
                            aria-modal="true"
                        >
                            <div className="flex justify-between items-center mb-8">
                                <img src={MannyLogo} alt="Manny Logo" className="h-16 w-auto" />
                                <Button variant="ghost" size="icon" onClick={toggleMenu} aria-label="Cerrar menú" className="h-12 w-12">
                                    <X className="w-6 h-6" />
                                </Button>
                            </div>
                            <div className="flex flex-col gap-2 flex-1">
                                {user && (
                                    <div className="p-4 bg-primary/10 text-foreground rounded-xl font-bold flex items-center gap-3 mb-6">
                                        <Coins className="w-6 h-6 text-primary" />
                                        <span className="text-xl">{user.puntos_actuales?.toLocaleString('es-MX')} Puntos</span>
                                    </div>
                                )}
                                {isAdmin ? <AdminNavLinksMobile onClick={toggleMenu} /> : <ClientNavLinks onClick={toggleMenu} />}
                            </div>
                            <Button variant="destructive" size="lg" onClick={handleLogout} className="mt-auto h-14 text-base">
                                <LogOut className="w-5 h-5 mr-3" /> Cerrar Sesión
                            </Button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </header>
    );
};

export default Header;