import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Gift, History, Wrench, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

const BottomNav = () => {
    const { user, isAdmin, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    // Don't show for admin users or on login page
    if (isAdmin || !user || location.pathname === '/login') {
        return null;
    }

    const navItems = [
        { to: '/dashboard', icon: Gift, label: 'Recompensas' },
        { to: '/mis-servicios', icon: Wrench, label: 'Servicios' },
        { to: '/mis-canjes', icon: History, label: 'Historial' },
    ];

    const handleLogout = () => {
        logout();
        navigate('/login', { replace: true });
    };

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
            {/* Main nav container */}
            <div className="bg-card border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.08)] pb-[env(safe-area-inset-bottom)]">
                <div className="grid grid-cols-4 h-[68px] max-w-md mx-auto">
                    {navItems.map(({ to, icon: Icon, label }) => {
                        const isActive = location.pathname === to;
                        return (
                            <NavLink
                                key={to}
                                to={to}
                                className="flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
                            >
                                <div className={cn(
                                    "flex items-center justify-center w-11 h-11 rounded-2xl transition-all duration-200",
                                    isActive
                                        ? "bg-primary text-white shadow-lg shadow-primary/30"
                                        : "bg-transparent text-muted-foreground"
                                )}>
                                    <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                                </div>
                                <span className={cn(
                                    "text-[10px] font-semibold transition-colors",
                                    isActive ? "text-primary" : "text-muted-foreground"
                                )}>
                                    {label}
                                </span>
                            </NavLink>
                        );
                    })}

                    {/* Logout button */}
                    <button
                        onClick={handleLogout}
                        className="flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
                    >
                        <div className="flex items-center justify-center w-11 h-11 rounded-2xl text-muted-foreground transition-colors active:bg-red-500/10 active:text-red-500">
                            <LogOut className="w-5 h-5" strokeWidth={2} />
                        </div>
                        <span className="text-[10px] font-semibold text-muted-foreground">
                            Salir
                        </span>
                    </button>
                </div>
            </div>
        </nav>
    );
};

export default BottomNav;
