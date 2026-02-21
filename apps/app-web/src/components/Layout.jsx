import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Load persisted collapsed state on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebarCollapsed');
      if (saved != null) {
        setSidebarCollapsed(saved === 'true');
      }
    } catch (e) {
      console.error('localStorage read error:', e);
    }
  }, []);

  // Persist collapsed state
  useEffect(() => {
    try {
      localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed));
    } catch (e) {
      console.error('localStorage write error:', e);
    }
  }, [sidebarCollapsed]);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-background-dark">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header onMenuClick={() => setSidebarOpen(true)} />

        {/* Page Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-background-dark">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
