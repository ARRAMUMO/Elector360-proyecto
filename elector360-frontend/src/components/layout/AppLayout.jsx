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
    navigate('/login');
  };

  // Menú de navegación
  const menuItems = [
    {
      name: 'Dashboard',
      icon: '📊',
      path: '/dashboard',
      roles: ['ADMIN', 'LIDER']
    },
    {
      name: 'Consultar',
      icon: '🔍',
      path: '/consulta',
      roles: ['ADMIN', 'LIDER']
    },
    {
      name: 'Personas',
      icon: '👥',
      path: '/personas',
      roles: ['ADMIN', 'LIDER']
    },
    {
      name: 'Operaciones Masivas',
      icon: '📤',
      path: '/operaciones-masivas',
      roles: ['ADMIN']
    },
    {
      name: 'Usuarios',
      icon: '⚙️',
      path: '/usuarios',
      roles: ['ADMIN']
    },
    {
      name: 'Mi Perfil',
      icon: '👤',
      path: '/perfil',
      roles: ['ADMIN', 'LIDER']
    },
    // Agregar en menuItems
    {
      name: 'Monitor RPA',
      icon: '🤖',
      path: '/worker-monitor',
      roles: ['ADMIN']
    }
  ];

  // Filtrar menú según rol
  const filteredMenu = menuItems.filter(item => 
    item.roles.includes(user?.rol)
  );

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-white border-r border-gray-200">
        {/* Logo */}
        <div className="h-16 flex items-center justify-center border-b border-gray-200">
          <span className="text-2xl mr-2">🗳️</span>
          <span className="text-xl font-bold text-gray-900">Elector360</span>
        </div>

        {/* Navegación */}
        <nav className="flex-1 overflow-y-auto py-4">
          <div className="px-3 space-y-1">
            {filteredMenu.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-50'
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
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center mb-3">
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center mr-3">
              <span className="text-primary-700 font-bold text-sm">
                {user?.perfil?.nombres?.charAt(0)}{user?.perfil?.apellidos?.charAt(0)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.perfil?.nombres}
              </p>
              <p className="text-xs text-gray-500 truncate">{user?.rol}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            <span className="mr-2">🚪</span>
            Cerrar Sesión
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
          <aside className="fixed inset-y-0 left-0 w-64 bg-white z-50 lg:hidden transform transition-transform duration-300">
            {/* Logo */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
              <div className="flex items-center">
                <span className="text-2xl mr-2">🗳️</span>
                <span className="text-xl font-bold text-gray-900">Elector360</span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Navegación Mobile */}
            <nav className="flex-1 overflow-y-auto py-4">
              <div className="px-3 space-y-1">
                {filteredMenu.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                        isActive
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-gray-700 hover:bg-gray-50'
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
            <div className="p-4 border-t border-gray-200">
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-primary-700 font-bold text-sm">
                    {user?.perfil?.nombres?.charAt(0)}{user?.perfil?.apellidos?.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user?.perfil?.nombres}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user?.rol}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
              >
                <span className="mr-2">🚪</span>
                Cerrar Sesión
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Contenido Principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header Mobile */}
        <header className="lg:hidden h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center">
            <span className="text-xl mr-2">🗳️</span>
            <span className="font-bold text-gray-900">Elector360</span>
          </div>
          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
            <span className="text-primary-700 font-bold text-sm">
              {user?.perfil?.nombres?.charAt(0)}{user?.perfil?.apellidos?.charAt(0)}
            </span>
          </div>
        </header>

        {/* Área de Contenido */}
        <main className="flex-1 overflow-y-auto bg-gray-100">
          <div className="p-4 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default AppLayout;