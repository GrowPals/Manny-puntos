
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, Truck, Coins, Info, Shield } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';

const Header = () => {
  const { user, isAdmin } = useAuth();
  const location = useLocation();

  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <header className="bg-white/95 shadow-md sticky top-0 z-50 backdrop-blur-lg">
      <nav className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <Link to={isAdmin ? '/admin' : '/dashboard'} className="flex items-center gap-2 group">
            <img src="https://i.ibb.co/LDLWZhkj/Recurso-1.png" alt="Manny Logo" className="h-10 w-auto transition-transform duration-300 group-hover:scale-105" />
          </Link>

          <div className="flex items-center gap-2">
            {isAdmin ? (
              <>
                <Link to="/admin">
                  <Button variant={isActive('/admin') && location.pathname === '/admin' ? "investment" : "ghost"} className="btn-nav">
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Dashboard
                  </Button>
                </Link>
                <Link to="/admin/productos">
                   <Button variant={isActive('/admin/productos') ? "investment" : "ghost"} className="btn-nav">
                    <Package className="w-4 h-4 mr-2" />
                    Productos
                  </Button>
                </Link>
                <Link to="/admin/entregas">
                   <Button variant={isActive('/admin/entregas') ? "investment" : "ghost"} className="btn-nav">
                    <Truck className="w-4 h-4 mr-2" />
                    Entregas
                  </Button>
                </Link>
              </>
            ) : user && (
               <Link to="/sobre-manny">
                  <Button variant="ghost" className="btn-nav">
                      <Info className="w-4 h-4 mr-2" />
                      Sobre Manny
                  </Button>
              </Link>
            )}
            
            {user && (
              <>
                {isAdmin && (
                  <Link to="/dashboard">
                     <Button variant="outline" className="btn-nav">
                         <Shield className="w-4 h-4 mr-2" />
                         Ver como Cliente
                     </Button>
                  </Link>
                )}
                <div className="px-4 py-2 bg-manny-gradient text-white rounded-xl font-bold flex items-center gap-2 shadow-lg animate-glow">
                    <Coins className="w-5 h-5" />
                    {user.puntos_actuales} pts
                </div>
              </>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Header;
