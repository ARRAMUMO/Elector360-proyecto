// src/components/layout/AppLayout.jsx

import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import authService from '../../services/authService';

function AppLayout() {
  const navigate = useNavigate();
  const user = authService.getStoredUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await authService.logout();
    window.location.href = '/login';
  };

  // Menu de navegacion
  const menuItems = [
    {
      name: 'Dashboard',
      icon: '📊',
      path: '/dashboard',
      roles: ['ADMIN', 'COORDINADOR', 'LIDER']
    },
    {
      name: 'Consultar',
      icon: '🔍',
      path: '/consulta',
      roles: ['ADMIN', 'COORDINADOR', 'LIDER']
    },
    {
      name: 'Personas',
      icon: '👥',
      path: '/personas',
      roles: ['ADMIN', 'COORDINADOR', 'LIDER']
    },
    {
      name: 'Mesas de Votacion',
      icon: '🗳️',
      path: '/mesas',
      roles: ['ADMIN', 'COORDINADOR', 'LIDER']
    },
    {
      name: 'Operaciones Masivas',
      icon: '📤',
      path: '/operaciones-masivas',
      roles: ['ADMIN', 'COORDINADOR']
    },
    {
      name: 'Usuarios',
      icon: '⚙️',
      path: '/usuarios',
      roles: ['ADMIN', 'COORDINADOR']
    },
    {
      name: 'Campanas',
      icon: '🏛️',
      path: '/campanas',
      roles: ['ADMIN']
    },
    {
      name: 'Mi Perfil',
      icon: '👤',
      path: '/perfil',
      roles: ['ADMIN', 'COORDINADOR', 'LIDER']
    },
    {
      name: 'Monitor RPA',
      icon: '🤖',
      path: '/worker-monitor',
      roles: ['ADMIN']
    }
  ];

  // Filtrar menu segun rol
  const filteredMenu = menuItems.filter(item =>
    item.roles.includes(user?.rol)
  );

  return (
    <div className="flex h-screen bg-gradient-to-br from-emerald-50 via-teal-50/50 to-cyan-50">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-gradient-to-b from-white to-emerald-50/60 border-r border-emerald-100">
        {/* Logo */}
        <div className="h-16 flex items-center justify-center border-b border-emerald-100">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center mr-2 shadow-sm shadow-emerald-200">
            <span className="text-lg">🗳️</span>
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-emerald-700 to-teal-600 bg-clip-text text-transparent">Elector360</span>
        </div>

        {/* Navegacion */}
        <nav className="flex-1 overflow-y-auto py-4">
          <div className="px-3 space-y-1">
            {filteredMenu.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-100 to-teal-50 text-emerald-800 shadow-sm border border-emerald-200/60'
                      : 'text-gray-600 hover:bg-emerald-50/70 hover:text-emerald-700'
                  }`
                }
              >
                <span className="text-xl mr-3">{item.icon}</span>
                {item.name}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Usuario y Logout */}
        <div className="p-4 border-t border-emerald-100">
          <div className="flex items-center mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-200 to-teal-200 rounded-full flex items-center justify-center mr-3">
              <span className="text-emerald-800 font-bold text-sm">
                {user?.perfil?.nombres?.charAt(0)}{user?.perfil?.apellidos?.charAt(0)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.perfil?.nombres}
              </p>
              <p className="text-xs text-emerald-600 truncate">{user?.rol}</p>
              {user?.campana?.nombre && (
                <p className="text-xs text-teal-500 truncate">{user.campana.nombre}</p>
              )}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors shadow-sm"
          >
            <span className="mr-2">🚪</span>
            Cerrar Sesion
          </button>
        </div>
      </aside>

      {/* Sidebar Mobile (Overlay) */}
      {sidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          ></div>

          {/* Sidebar */}
          <aside className="fixed inset-y-0 left-0 w-64 bg-gradient-to-b from-white to-emerald-50/60 z-50 lg:hidden transform transition-transform duration-300 shadow-xl">
            {/* Logo */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-emerald-100">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center mr-2 shadow-sm shadow-emerald-200">
                  <span className="text-lg">🗳️</span>
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-emerald-700 to-teal-600 bg-clip-text text-transparent">Elector360</span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-lg hover:bg-emerald-50"
              >
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Navegacion Mobile */}
            <nav className="flex-1 overflow-y-auto py-4">
              <div className="px-3 space-y-1">
                {filteredMenu.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all ${
                        isActive
                          ? 'bg-gradient-to-r from-emerald-100 to-teal-50 text-emerald-800 shadow-sm border border-emerald-200/60'
                          : 'text-gray-600 hover:bg-emerald-50/70 hover:text-emerald-700'
                      }`
                    }
                  >
                    <span className="text-xl mr-3">{item.icon}</span>
                    {item.name}
                  </NavLink>
                ))}
              </div>
            </nav>

            {/* Usuario Mobile */}
            <div className="p-4 border-t border-emerald-100">
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-200 to-teal-200 rounded-full flex items-center justify-center mr-3">
                  <span className="text-emerald-800 font-bold text-sm">
                    {user?.perfil?.nombres?.charAt(0)}{user?.perfil?.apellidos?.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user?.perfil?.nombres}
                  </p>
                  <p className="text-xs text-emerald-600 truncate">{user?.rol}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors shadow-sm"
              >
                <span className="mr-2">🚪</span>
                Cerrar Sesion
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Contenido Principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header Mobile */}
        <header className="lg:hidden h-16 bg-white/80 backdrop-blur-sm border-b border-emerald-100 flex items-center justify-between px-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-emerald-50"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center">
            <span className="text-xl mr-2">🗳️</span>
            <span className="font-bold bg-gradient-to-r from-emerald-700 to-teal-600 bg-clip-text text-transparent">Elector360</span>
          </div>
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-200 to-teal-200 rounded-full flex items-center justify-center">
            <span className="text-emerald-800 font-bold text-sm">
              {user?.perfil?.nombres?.charAt(0)}{user?.perfil?.apellidos?.charAt(0)}
            </span>
          </div>
        </header>

        {/* Area de Contenido */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
