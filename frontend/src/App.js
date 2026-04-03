import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from './components/ui/sonner';
import { 
  House, Wine, CookingPot, Sparkle, DotsThree, 
  ForkKnife, Users, FileArrowUp, SignOut, PlugsConnected, ChartBar, ShoppingCart, CurrencyDollar
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
import PurchaseEntry from './pages/PurchaseEntry';
import SalesEntry from './pages/SalesEntry';

import './App.css';
import { syncOfflineCounts } from './utils/offlineStorage';

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
  const { logout, user, isAdmin, isManager, api } = useAuth();
  const [showMore, setShowMore] = React.useState(false);

  // Sync offline counts whenever we come back online
  React.useEffect(() => {
    const handleOnline = () => {
      syncOfflineCounts(api).then(synced => {
        if (synced.bar > 0 || synced.kitchen > 0) {
          const total = synced.bar + synced.kitchen;
          console.info(`Synced ${total} offline count(s) to server`);
        }
      }).catch(() => {});
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [api]);

  const navItems = [
    { path: '/', icon: House, label: 'Home' },
    { path: '/bar', icon: Wine, label: 'Bar' },
    { path: '/kitchen', icon: CookingPot, label: 'Kitchen' },
    { path: '/insights', icon: Sparkle, label: 'AI' },
  ];

  const moreItems = [
    { path: '/menu', icon: ForkKnife, label: 'Menu Costing' },
    // ImportData route kept for backwards compat but removed from nav (use Scan Receipt in Purchases)
    ...(isAdmin ? [{ path: '/users', icon: Users, label: 'Users' }] : []),
    { path: '/purchases', icon: ShoppingCart, label: 'Purchases' },
    { path: '/sales', icon: CurrencyDollar, label: 'Sales' },
    { path: '/reports', icon: ChartBar, label: 'Reports' },
    ...(isAdmin ? [{ path: '/integrations', icon: PlugsConnected, label: 'Integrations' }] : []),
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#060609]">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#060609]/90 border-b border-white/[0.04] safe-area-top">
        <div className="flex items-center justify-between px-5 py-3">
          <img src={LOGO_URL} alt="Ops AI" className="h-7 opacity-90" data-testid="app-logo" />
          <div className="flex items-center gap-3">
            <span className="text-xs tracking-wide text-white/25 font-light">{user?.name}</span>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-white/20 hover:text-red-400/70 transition-colors"
              data-testid="logout-btn"
            >
              <SignOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 pb-24">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#060609]/95 backdrop-blur-xl border-t border-white/[0.04] safe-area-bottom z-50">
        <div className="flex items-center justify-around py-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-0.5 p-2 min-w-[56px] transition-all duration-200 ${
                  isActive ? 'text-[#C8A53C]' : 'text-white/20'
                }`}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <Icon className="w-5 h-5" weight={isActive ? 'fill' : 'regular'} />
                <span className="text-[10px] tracking-wide">{item.label}</span>
              </button>
            );
          })}
          
          {/* More Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMore(!showMore)}
              className={`flex flex-col items-center gap-0.5 p-2 min-w-[56px] transition-all duration-200 ${
                showMore ? 'text-[#C8A53C]' : 'text-white/20'
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
                <div className="absolute bottom-full right-0 mb-2 w-48 bg-[#0E0E18] border border-white/[0.06] rounded-xl overflow-hidden shadow-2xl">
                  {moreItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.path}
                        onClick={() => {
                          navigate(item.path);
                          setShowMore(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-left text-white/70 hover:bg-white/[0.03] transition-colors border-b border-white/[0.03] last:border-0"
                        data-testid={`more-${item.label.toLowerCase().replace(' ', '-')}`}
                      >
                        <Icon className="w-4 h-4 text-[#C8A53C]/60" />
                        <span className="text-[13px] font-light tracking-wide">{item.label}</span>
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
      
      <Route path="/purchases" element={
        <ProtectedRoute>
          <AppLayout><PurchaseEntry /></AppLayout>
        </ProtectedRoute>
      } />

      <Route path="/sales" element={
        <ProtectedRoute>
          <AppLayout><SalesEntry /></AppLayout>
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

// Splash Screen — plays intro video once, then reveals the app
const SplashScreen = ({ children }) => {
  const [showSplash, setShowSplash] = React.useState(true);
  const [fadeOut, setFadeOut] = React.useState(false);
  const videoRef = React.useRef(null);

  React.useEffect(() => {
    // Force play on mobile — some browsers need this
    const video = videoRef.current;
    if (video) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Autoplay blocked — skip to app
          handleVideoEnd();
        });
      }
    }
  }, []);

  const handleVideoEnd = () => {
    setFadeOut(true);
    setTimeout(() => {
      setShowSplash(false);
    }, 800);
  };

  const handleSkip = () => {
    if (videoRef.current) videoRef.current.pause();
    handleVideoEnd();
  };

  if (!showSplash) return children;

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-black flex items-center justify-center transition-opacity duration-700 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
      style={{ overflow: 'hidden' }}
      onClick={handleSkip}
    >
      <video
        ref={videoRef}
        src="/splash.mp4"
        autoPlay
        muted
        playsInline
        onEnded={handleVideoEnd}
        onError={handleSkip}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
      />
      <button
        onClick={(e) => { e.stopPropagation(); handleSkip(); }}
        className="absolute bottom-8 right-6 text-xs text-white/40 hover:text-white/70 transition-colors"
      >
        Skip
      </button>
    </div>
  );
};

function App() {
  return (
    <SplashScreen>
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
    </SplashScreen>
  );
}

export default App;
