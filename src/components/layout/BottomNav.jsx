import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Gift, History, Wrench, LogOut, LayoutDashboard, Users, Truck, Package } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

const BottomNav = () => {
    const { user, isAdmin, logout } = useAuth();
    const location = useLocation();

    // Don't show on login page or if no user
    if (!user || location.pathname === '/login') {
        return null;
    }

    // Admin navigation items - most important 4 actions
    const adminNavItems = [
        { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
        { to: '/admin/clientes', icon: Users, label: 'Clientes' },
        { to: '/admin/entregas', icon: Truck, label: 'Canjes' },
        { to: '/admin/productos', icon: Package, label: 'Productos' },
    ];

    // Client navigation items
    const clientNavItems = [
        { to: '/dashboard', icon: Gift, label: 'Recompensas', exact: true },
        { to: '/mis-servicios', icon: Wrench, label: 'Servicios' },
        { to: '/mis-canjes', icon: History, label: 'Historial' },
    ];

    const navItems = isAdmin ? adminNavItems : clientNavItems;
    const gridCols = isAdmin ? 'grid-cols-4' : 'grid-cols-4';

    const isActiveRoute = (to, exact) => {
        if (exact) return location.pathname === to;
        return location.pathname.startsWith(to);
    };

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden">
            <div className="bg-card border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.1)] pb-[env(safe-area-inset-bottom)]">
                <div className={cn("grid h-[68px] max-w-lg mx-auto", gridCols)}>
                    {navItems.map(({ to, icon: Icon, label, exact }) => {
                        const isActive = isActiveRoute(to, exact);
                        return (
                            <NavLink
                                key={to}
                                to={to}
                                className="flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
                            >
                                <div className={cn(
                                    "flex items-center justify-center w-11 h-11 rounded-2xl transition-all duration-200",
                                    isActive
                                        ? "bg-primary text-white shadow-lg shadow-primary/30 scale-105"
                                        : "bg-transparent text-muted-foreground hover:bg-muted"
                                )}>
                                    <Icon className={cn("w-5 h-5", isActive && "w-[22px] h-[22px]")} strokeWidth={isActive ? 2.5 : 2} />
                                </div>
                                <span className={cn(
                                    "text-[11px] font-semibold transition-colors",
                                    isActive ? "text-primary" : "text-muted-foreground"
                                )}>
                                    {label}
                                </span>
                            </NavLink>
                        );
                    })}

                    {/* Logout button - only for clients */}
                    {!isAdmin && (
                        <button
                            onClick={logout}
                            className="flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
                        >
                            <div className="flex items-center justify-center w-11 h-11 rounded-2xl text-muted-foreground transition-all hover:bg-red-500/10 active:bg-red-500/20 active:text-red-500">
                                <LogOut className="w-5 h-5" strokeWidth={2} />
                            </div>
                            <span className="text-[11px] font-semibold text-muted-foreground">
                                Salir
                            </span>
                        </button>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default BottomNav;
