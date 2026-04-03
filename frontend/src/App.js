import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from './components/ui/sonner';
import { Sheet, SheetContent } from './components/ui/sheet';
import {
  House, Wine, CookingPot, Sparkle, DotsThree,
  ForkKnife, Users, SignOut, PlugsConnected, ChartBar, ShoppingCart, CurrencyDollar,
  CaretRight
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

// ── Protected Route ───────────────────────────────────────────────────────────
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <AppSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

const AppSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#060609]">
    <div className="w-8 h-8 border-2 border-[#D4A017] border-t-transparent rounded-full animate-spin" />
  </div>
);

// ── App Layout ────────────────────────────────────────────────────────────────
const AppLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user, isAdmin, api } = useAuth();
  const [showMore, setShowMore] = React.useState(false);

  React.useEffect(() => {
    const handleOnline = () => {
      syncOfflineCounts(api).then(synced => {
        if (synced.bar > 0 || synced.kitchen > 0) {
          console.info(`Synced ${synced.bar + synced.kitchen} offline count(s) to server`);
        }
      }).catch(() => {});
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [api]);

  // Close sheet on route change
  React.useEffect(() => { setShowMore(false); }, [location.pathname]);

  const navItems = [
    { path: '/',        icon: House,      label: 'Home' },
    { path: '/bar',     icon: Wine,       label: 'Bar' },
    { path: '/kitchen', icon: CookingPot, label: 'Kitchen' },
    { path: '/insights',icon: Sparkle,    label: 'AI' },
  ];

  const moreItems = [
    { path: '/menu',         icon: ForkKnife,    label: 'Menu Costing' },
    { path: '/purchases',    icon: ShoppingCart, label: 'Purchases' },
    { path: '/sales',        icon: CurrencyDollar, label: 'Sales' },
    { path: '/reports',      icon: ChartBar,     label: 'Reports' },
    ...(isAdmin ? [{ path: '/users', icon: Users, label: 'Users' }] : []),
    ...(isAdmin ? [{ path: '/integrations', icon: PlugsConnected, label: 'Integrations' }] : []),
  ];

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const isMoreActive = moreItems.some(item => item.path === location.pathname);

  return (
    <div className="min-h-screen bg-deep">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#060609]/90 border-b border-white/[0.04] safe-area-top">
        <div className="flex items-center justify-between px-5 h-12">
          <img src={LOGO_URL} alt="Ops AI" className="h-6 opacity-90" data-testid="app-logo" />
          <div className="flex items-center gap-3">
            <span className="text-[11px] tracking-wide text-white/20 font-light">{user?.name}</span>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-white/20 hover:text-red-400/60 transition-colors touch-target flex items-center justify-center"
              data-testid="logout-btn"
            >
              <SignOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 pt-5 pb-28">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#060609]/96 backdrop-blur-xl border-t border-white/[0.04] safe-area-bottom z-50">
        <div className="flex items-center justify-around py-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`relative flex flex-col items-center gap-0.5 py-2 px-4 min-w-[56px] transition-all duration-200 ${
                  isActive ? 'text-[#D4A017]' : 'text-white/20 hover:text-white/40'
                }`}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-[#D4A017] rounded-full" />
                )}
                <Icon className="w-5 h-5" weight={isActive ? 'fill' : 'regular'} />
                <span className="text-[10px] tracking-wide font-medium">{item.label}</span>
              </button>
            );
          })}

          {/* More Button */}
          <button
            onClick={() => setShowMore(true)}
            className={`relative flex flex-col items-center gap-0.5 py-2 px-4 min-w-[56px] transition-all duration-200 ${
              isMoreActive ? 'text-[#D4A017]' : 'text-white/20 hover:text-white/40'
            }`}
            data-testid="nav-more"
          >
            {isMoreActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-[#D4A017] rounded-full" />
            )}
            <DotsThree className="w-5 h-5" weight={isMoreActive ? 'fill' : 'bold'} />
            <span className="text-[10px] tracking-wide font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* More Menu — Sheet (bottom drawer) */}
      <Sheet open={showMore} onOpenChange={setShowMore}>
        <SheetContent
          side="bottom"
          className="bg-[#0E0E18] border-t border-white/[0.06] rounded-t-2xl px-0 pb-8 pt-3"
          style={{ maxHeight: '80vh' }}
        >
          {/* Handle */}
          <div className="flex justify-center mb-5">
            <div className="w-8 h-1 bg-white/10 rounded-full" />
          </div>

          <p className="text-[11px] uppercase tracking-widest text-white/20 font-semibold px-6 mb-3">
            More
          </p>

          <div className="space-y-0.5">
            {moreItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => { navigate(item.path); setShowMore(false); }}
                  className={`w-full flex items-center justify-between px-6 py-3.5 text-left transition-colors ${
                    isActive
                      ? 'text-[#D4A017] bg-[#D4A017]/5'
                      : 'text-white/60 hover:bg-white/[0.03]'
                  }`}
                  data-testid={`more-${item.label.toLowerCase().replace(/ /g, '-')}`}
                >
                  <div className="flex items-center gap-3.5">
                    <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-[#D4A017]' : 'text-white/25'}`} weight={isActive ? 'fill' : 'regular'} />
                    <span className="text-[14px] font-light tracking-wide">{item.label}</span>
                  </div>
                  <CaretRight className="w-4 h-4 text-white/15" />
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

// ── App Router ────────────────────────────────────────────────────────────────
const AppRouter = () => {
  const { user, loading } = useAuth();
  if (loading) return <AppSpinner />;

  if (user?.role === 'staff') {
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
        <ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>
      } />
      <Route path="/bar" element={
        <ProtectedRoute><AppLayout><BarInventory /></AppLayout></ProtectedRoute>
      } />
      <Route path="/kitchen" element={
        <ProtectedRoute><AppLayout><KitchenInventory /></AppLayout></ProtectedRoute>
      } />
      <Route path="/insights" element={
        <ProtectedRoute><AppLayout><AIInsights /></AppLayout></ProtectedRoute>
      } />
      <Route path="/menu" element={
        <ProtectedRoute><AppLayout><MenuCosting /></AppLayout></ProtectedRoute>
      } />
      <Route path="/import" element={
        <ProtectedRoute><AppLayout><ImportData /></AppLayout></ProtectedRoute>
      } />
      <Route path="/users" element={
        <ProtectedRoute><AppLayout><UserManagement /></AppLayout></ProtectedRoute>
      } />
      <Route path="/purchases" element={
        <ProtectedRoute><AppLayout><PurchaseEntry /></AppLayout></ProtectedRoute>
      } />
      <Route path="/sales" element={
        <ProtectedRoute><AppLayout><SalesEntry /></AppLayout></ProtectedRoute>
      } />
      <Route path="/reports" element={
        <ProtectedRoute><AppLayout><Reports /></AppLayout></ProtectedRoute>
      } />
      <Route path="/integrations" element={
        <ProtectedRoute><AppLayout><Integrations /></AppLayout></ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

// ── Splash Screen ─────────────────────────────────────────────────────────────
const SplashScreen = ({ children }) => {
  const [showSplash, setShowSplash] = React.useState(true);
  const [fadeOut, setFadeOut] = React.useState(false);
  const videoRef = React.useRef(null);

  React.useEffect(() => {
    const video = videoRef.current;
    if (video) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => handleVideoEnd());
      }
    }
  }, []);

  const handleVideoEnd = () => {
    setFadeOut(true);
    setTimeout(() => setShowSplash(false), 800);
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
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
      <button
        onClick={(e) => { e.stopPropagation(); handleSkip(); }}
        className="absolute bottom-8 right-6 text-xs text-white/30 hover:text-white/60 transition-colors"
      >
        Skip
      </button>
    </div>
  );
};

// ── Root ──────────────────────────────────────────────────────────────────────
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
                border: '1px solid rgba(255,255,255,0.06)',
                fontSize: '13px',
                borderRadius: '12px',
              },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </SplashScreen>
  );
}

export default App;
