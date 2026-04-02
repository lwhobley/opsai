import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from './components/ui/sonner';
import { 
  House, Wine, CookingPot, Sparkle, DotsThree, 
  ForkKnife, Users, FileArrowUp, SignOut, Gear, PlugsConnected, ChartBar
} from '@phosphor-icons/react';

// Pages
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import BarInventory from './pages/BarInventory';
import KitchenInventory from './pages/KitchenInventory';
import AIInsights from './pages/AIInsights';
import MenuCosting from './pages/MenuCosting';
import ImportData from './pages/ImportData';
import UserManagement from './pages/UserManagement';
import Integrations from './pages/Integrations';
import Reports from './pages/Reports';
import StaffCountMode from './pages/StaffCountMode';

import './App.css';

const LOGO_URL = 'https://customer-assets.emergentagent.com/job_cost-control-ai/artifacts/usjulrm9_IMG_2004.png';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A12]">
        <div className="animate-spin w-8 h-8 border-2 border-[#D4A017] border-t-transparent rounded-full" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// Layout with Navigation
const AppLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user, isAdmin, isManager } = useAuth();
  const [showMore, setShowMore] = React.useState(false);

  const navItems = [
    { path: '/', icon: House, label: 'Home' },
    { path: '/bar', icon: Wine, label: 'Bar' },
    { path: '/kitchen', icon: CookingPot, label: 'Kitchen' },
    { path: '/insights', icon: Sparkle, label: 'AI' },
  ];

  const moreItems = [
    { path: '/menu', icon: ForkKnife, label: 'Menu Costing' },
    ...(isManager ? [{ path: '/import', icon: FileArrowUp, label: 'Import Data' }] : []),
    ...(isAdmin ? [{ path: '/users', icon: Users, label: 'Users' }] : []),
    { path: '/reports', icon: ChartBar, label: 'Reports' },
    ...(isAdmin ? [{ path: '/integrations', icon: PlugsConnected, label: 'Integrations' }] : []),
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#0A0A12]">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0A0A12]/80 border-b border-white/5 safe-area-top">
        <div className="flex items-center justify-between p-4">
          <img src={LOGO_URL} alt="Ops AI" className="h-8" data-testid="app-logo" />
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#8E8E9F]">{user?.name}</span>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-[#8E8E9F] hover:text-[#D62828] transition-colors"
              data-testid="logout-btn"
            >
              <SignOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 pb-24">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0A0A12]/95 backdrop-blur-xl border-t border-white/5 safe-area-bottom z-50">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-1 p-2 min-w-[64px] transition-colors ${
                  isActive ? 'text-[#D4A017]' : 'text-[#5A5A70]'
                }`}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <Icon className="w-6 h-6" weight={isActive ? 'fill' : 'regular'} />
                <span className="text-xs">{item.label}</span>
              </button>
            );
          })}
          
          {/* More Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMore(!showMore)}
              className={`flex flex-col items-center gap-1 p-2 min-w-[64px] transition-colors ${
                showMore ? 'text-[#D4A017]' : 'text-[#5A5A70]'
              }`}
              data-testid="nav-more"
            >
              <DotsThree className="w-6 h-6" weight="bold" />
              <span className="text-xs">More</span>
            </button>

            {showMore && (
              <>
                <div 
                  className="fixed inset-0" 
                  onClick={() => setShowMore(false)}
                />
                <div className="absolute bottom-full right-0 mb-2 w-48 bg-[#1A1A2E] border border-[#2B2B4A] rounded-xl overflow-hidden shadow-xl">
                  {moreItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.path}
                        onClick={() => {
                          navigate(item.path);
                          setShowMore(false);
                        }}
                        className="w-full flex items-center gap-3 p-4 text-left text-[#F5F5F0] hover:bg-[#252540] transition-colors"
                        data-testid={`more-${item.label.toLowerCase().replace(' ', '-')}`}
                      >
                        <Icon className="w-5 h-5 text-[#D4A017]" />
                        <span className="text-sm">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </nav>
    </div>
  );
};

// Main App Router
const AppRouter = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A12]">
        <div className="animate-spin w-8 h-8 border-2 border-[#D4A017] border-t-transparent rounded-full" />
      </div>
    );
  }

  // Staff users get a simplified count-only experience
  if (user && user.role === 'staff') {
    return (
      <Routes>
        <Route path="*" element={<StaffCountMode />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      
      <Route path="/" element={
        <ProtectedRoute>
          <AppLayout><Dashboard /></AppLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/bar" element={
        <ProtectedRoute>
          <AppLayout><BarInventory /></AppLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/kitchen" element={
        <ProtectedRoute>
          <AppLayout><KitchenInventory /></AppLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/insights" element={
        <ProtectedRoute>
          <AppLayout><AIInsights /></AppLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/menu" element={
        <ProtectedRoute>
          <AppLayout><MenuCosting /></AppLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/import" element={
        <ProtectedRoute>
          <AppLayout><ImportData /></AppLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/users" element={
        <ProtectedRoute>
          <AppLayout><UserManagement /></AppLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/reports" element={
        <ProtectedRoute>
          <AppLayout><Reports /></AppLayout>
        </ProtectedRoute>
      } />

      <Route path="/integrations" element={
        <ProtectedRoute>
          <AppLayout><Integrations /></AppLayout>
        </ProtectedRoute>
      } />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
        <Toaster 
          position="top-center" 
          toastOptions={{
            style: {
              background: '#1A1A2E',
              color: '#F5F5F0',
              border: '1px solid rgba(255,255,255,0.05)',
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
