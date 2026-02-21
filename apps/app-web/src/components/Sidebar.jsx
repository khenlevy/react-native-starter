import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  Activity,
  X,
  TrendingUp,
  Zap,
  BarChart3,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const Sidebar = ({
  isOpen,
  onClose,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const location = useLocation();

  const menuItems = [
    {
      name: 'Dashboard',
      href: '/',
      icon: Home,
    },
    {
      name: 'Large Cap',
      href: '/large-cap',
      icon: TrendingUp,
    },
    {
      name: 'Heat Map',
      href: '/heatmap',
      icon: BarChart3,
    },
    {
      name: 'Jobs',
      href: '/jobs',
      icon: Activity,
    },
    {
      name: 'EODHD',
      href: '/eodhd-usage',
      icon: Zap,
    },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
        fixed inset-y-0 left-0 z-50 bg-white dark:bg-surface-dark shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isCollapsed ? 'w-16' : 'w-64'} transition-all flex flex-col
      `}
      >
        <div
          className={`flex items-center justify-between h-16 border-b border-gray-200 dark:border-gray-700 ${
            isCollapsed ? 'px-4' : 'px-6'
          }`}
        >
          {!isCollapsed && (
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Stocks Dashboard
            </h1>
          )}
          <div className="flex items-center">
            <button
              onClick={onClose}
              className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <nav className="mt-6 flex-1">
          <div className={`${isCollapsed ? 'px-2' : 'px-3'}`}>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  title={isCollapsed ? item.name : undefined}
                  className={`
                    sidebar-item ${isActive ? 'active' : ''} ${
                    isCollapsed ? 'justify-center' : ''
                  }
                  `}
                  onClick={onClose}
                >
                  <Icon size={20} className={isCollapsed ? '' : 'mr-3'} />
                  {!isCollapsed && <span>{item.name}</span>}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Collapse/Expand toggle at bottom right */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex p-2 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ml-auto"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight size={20} />
            ) : (
              <ChevronLeft size={20} />
            )}
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
