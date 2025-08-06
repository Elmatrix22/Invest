import { useState, useEffect, Suspense, lazy } from 'react';
import { translations } from './utils/languages';
import { BINANCE_REFERRAL_URL } from './utils/constants';
import { AppHeader } from './components/AppHeader';
import { AppFooter } from './components/AppFooter';
import { SEOHead, generatePageSEO } from './components/SEOHead';
import { generateAllSitemaps } from './utils/sitemapGenerator';
import { LoadingSpinner } from './components/LoadingSpinner';
import { MarketDataService } from './utils/marketDataService';
import { MarketDataInitializer } from './utils/marketDataInitializer';
import { RouteRenderer } from './components/RouteRenderer';
import { ROUTES, RouteType, MAX_INIT_ATTEMPTS } from './utils/appConstants';
import { generateAlternateLanguagesForRoute } from './utils/seoConstants';
import { toast } from "sonner@2.0.3";

// Lazy load remaining components
const AuthModal = lazy(() => import('./components/AuthModal'));
const UserProfile = lazy(() => import('./components/UserProfile'));
const GDPRBanner = lazy(() => import('./components/GDPRBanner'));

export default function App() {
  // Core state
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('preferred-language') || 'en';
    }
    return 'en';
  });
  
  const [currentRoute, setCurrentRoute] = useState<RouteType>(ROUTES.HOME);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [user, setUser] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  });
  
  // Market data state
  const [marketData, setMarketData] = useState({
    prices: {},
    isLoading: true,
    lastUpdate: 0,
    errors: []
  });
  const [isMarketDataReady, setIsMarketDataReady] = useState(false);
  const [marketDataService] = useState(() => MarketDataService.getInstance());
  const [initializationAttempts, setInitializationAttempts] = useState(0);

  // Market data initialization
  useEffect(() => {
    const initializer = new MarketDataInitializer(marketDataService, {
      onUpdateMarketData: setMarketData,
      onSetIsMarketDataReady: setIsMarketDataReady,
      onSetInitializationAttempts: setInitializationAttempts
    });

    // Start initialization
    initializer.initializeMarketData(1, MAX_INIT_ATTEMPTS);

    // Cleanup
    return () => {
      initializer.cleanup();
    };
  }, [marketDataService]);

  // Data updates listener
  useEffect(() => {
    if (!isMarketDataReady) return;

    const initializer = new MarketDataInitializer(marketDataService, {
      onUpdateMarketData: setMarketData,
      onSetIsMarketDataReady: setIsMarketDataReady,
      onSetInitializationAttempts: setInitializationAttempts
    });

    const cleanup = initializer.monitorDataUpdates(marketData);
    return cleanup;
  }, [marketData.lastUpdate, marketData.errors.length, marketDataService, isMarketDataReady]);

  // SEO sitemaps generation
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      try {
        const sitemaps = generateAllSitemaps();
        console.log('SEO Sitemaps generated:', {
          xmlSitemap: sitemaps.mainSitemap.length + ' characters',
          robotsTxt: sitemaps.robotsTxt.length + ' characters',
          newsSitemap: sitemaps.newsSitemap.length + ' characters'
        });
        (window as any).sitemaps = sitemaps;
      } catch (error) {
        console.error('❌ Error generating sitemaps:', error);
      }
    }
  }, []);
  
  // Event handlers
  const handleLanguageChange = (lang: string) => {
    try {
      setCurrentLanguage(lang);
      localStorage.setItem('preferred-language', lang);
    } catch (error) {
      console.error('❌ Error changing language:', error);
    }
  };

  const handleAuthSuccess = (userData: any) => {
    try {
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      setShowAuthModal(false);
      
      toast.success(`🎉 Welcome ${userData.name || 'to the community'}! Your AI signals are now active.`, {
        duration: 5000,
      });
      
      setTimeout(() => {
        setCurrentRoute(ROUTES.SIGNALS);
      }, 1000);
    } catch (error) {
      console.error('❌ Error handling auth success:', error);
      toast.error('Login successful but there was an error saving your data');
    }
  };

  const handleLogout = () => {
    try {
      setUser(null);
      localStorage.removeItem('user');
      setCurrentRoute(ROUTES.HOME);
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('❌ Error during logout:', error);
      toast.error('Logout completed but there was an error');
    }
  };

  const handleRouteChange = (route: RouteType) => {
    try {
      if (route === ROUTES.PROFILE && !user) {
        setShowAuthModal(true);
        toast.info('Please login to access your profile');
        return;
      }
      
      setCurrentRoute(route);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('❌ Error changing route:', error);
    }
  };

  const handleQuickLogin = () => {
    setShowAuthModal(true);
  };

  const t = translations[currentLanguage as keyof typeof translations] || translations.en;

  // Generate SEO data for current route
  const currentSEO = generatePageSEO(currentRoute, {
    alternateLanguages: generateAlternateLanguagesForRoute(currentRoute)
  });

  return (
    <div className="min-h-screen bg-pearl-blue app-isolated force-visible" data-app="invest-free">
      <SEOHead {...currentSEO} />

      {/* Header */}
      <header className="nav-modern">
        <div className="mx-auto max-w-7xl px-2 sm:px-4 lg:px-6 xl:px-8">
          <AppHeader
            currentLanguage={currentLanguage}
            user={user}
            translations={t}
            binanceReferralUrl={BINANCE_REFERRAL_URL}
            currentRoute={currentRoute}
            onLanguageChange={handleLanguageChange}
            onRouteChange={handleRouteChange}
            onShowAuthModal={handleQuickLogin}
            onShowUserProfile={() => setShowUserProfile(true)}
            onLogout={handleLogout}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center bg-pearl-white">
            <div className="text-center">
              <LoadingSpinner size="large" message="Loading your trading platform..." />
              <div className="mt-8 text-warm-slate">
                <p className="text-lg font-medium">Invest-Free.com</p>
                <p className="text-sm">Free AI Trading Platform</p>
                {initializationAttempts > 0 && (
                  <p className="text-xs mt-2">
                    Initializing market data... (attempt {initializationAttempts}/{MAX_INIT_ATTEMPTS})
                  </p>
                )}
              </div>
            </div>
          </div>
        }>
          <RouteRenderer
            currentRoute={currentRoute}
            user={user}
            translations={t}
            binanceReferralUrl={BINANCE_REFERRAL_URL}
            onShowAuthModal={handleQuickLogin}
            onRouteChange={handleRouteChange}
            marketData={marketData}
            isMarketDataReady={isMarketDataReady}
            marketDataService={marketDataService}
            onShowUserProfile={() => setShowUserProfile(true)}
          />
        </Suspense>
      </main>

      {/* Footer - Extra compact size */}
      <footer className="bg-deep-navy text-pearl-white">
        <div className="py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <AppFooter
              translations={t}
              onRouteChange={handleRouteChange}
              onBinanceReferral={() => window.open(BINANCE_REFERRAL_URL, '_blank')}
            />
          </div>
        </div>
      </footer>

      {/* Modals */}
      <Suspense fallback={null}>
        <GDPRBanner translations={t} />
      </Suspense>

      {showAuthModal && (
        <Suspense fallback={null}>
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            onAuthSuccess={handleAuthSuccess}
            translations={t}
            binanceReferralUrl={BINANCE_REFERRAL_URL}
          />
        </Suspense>
      )}

      {user && showUserProfile && (
        <Suspense fallback={null}>
          <UserProfile
            user={user}
            onUpdateUser={(updatedUser) => {
              try {
                setUser(updatedUser);
                localStorage.setItem('user', JSON.stringify(updatedUser));
                toast.success('Profile updated successfully!');
              } catch (error) {
                console.error('❌ Error updating user profile:', error);
                toast.error('Failed to update profile');
              }
            }}
            onClose={() => setShowUserProfile(false)}
            translations={t}
            binanceReferralUrl={BINANCE_REFERRAL_URL}
          />
        </Suspense>
      )}

      {/* Quick Access Button for Mobile */}
      {currentRoute === ROUTES.HOME && !user && (
        <div className="fixed bottom-6 right-6 z-40 md:hidden">
          <button
            onClick={handleQuickLogin}
            className="w-16 h-16 bg-gradient-to-r from-soft-teal to-soft-teal-light hover:from-soft-teal-light hover:to-soft-teal text-white rounded-full shadow-glow-dark hover:shadow-deep transition-all duration-300 flex items-center justify-center animate-pulse-glow"
          >
            <span className="text-2xl">🚀</span>
          </button>
        </div>
      )}
    </div>
  );
}