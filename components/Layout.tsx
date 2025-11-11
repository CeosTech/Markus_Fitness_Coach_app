import React, { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import { ViewType, User } from '../types';
import { useTranslation } from '../i18n/LanguageContext';
import SignOutIcon from './icons/SignOutIcon';
import LanguageSelector from './LanguageSelector';

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  handleSignOut: () => void;
  currentUser: User;
}

const TIP_STORAGE_KEY = 'mealPlannerTipDismissed';

const Layout: React.FC<LayoutProps> = ({ children, currentView, setCurrentView, handleSignOut, currentUser }) => {
  const { t } = useTranslation();
  const [showMealTip, setShowMealTip] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissed = window.localStorage.getItem(TIP_STORAGE_KEY);
    if (!dismissed) {
      setShowMealTip(true);
    }
  }, []);

  const dismissTip = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TIP_STORAGE_KEY, '1');
    }
    setShowMealTip(false);
  };

  const goToMealPlanner = () => {
    setCurrentView('meal');
    dismissTip();
  };

  const openSidebar = () => setIsSidebarOpen(true);
  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans">
      <header className="lg:hidden sticky top-0 z-30 bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <button
          onClick={openSidebar}
          className="inline-flex items-center justify-center rounded-lg border border-gray-700 p-2 text-gray-200 hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-label="Open navigation"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h10" />
          </svg>
        </button>
        <div className="text-center">
          <p className="text-xs uppercase tracking-wide text-gray-500">{t('appName')}</p>
          <p className="text-base font-semibold text-white">{t('sidebar.coach')}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="inline-flex items-center gap-1 text-sm text-gray-200 hover:text-white"
        >
          <SignOutIcon />
        </button>
      </header>

      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="flex-1 bg-black/60" onClick={closeSidebar} />
          <div className="relative h-full w-72 bg-gray-900 border-l border-gray-800 shadow-2xl">
            <Sidebar
              currentView={currentView}
              setCurrentView={setCurrentView}
              handleSignOut={handleSignOut}
              currentUser={currentUser}
              onNavigate={closeSidebar}
            />
          </div>
        </div>
      )}

      <div className="flex lg:h-screen">
        <div className="hidden lg:block lg:w-64 lg:border-r lg:border-gray-800 lg:bg-gray-900">
          <Sidebar
            currentView={currentView}
            setCurrentView={setCurrentView}
            handleSignOut={handleSignOut}
            currentUser={currentUser}
          />
        </div>
        <main className="flex-1 overflow-y-auto overflow-x-hidden lg:p-10">
          <div className="px-4 pt-4 pb-10 sm:px-6 lg:px-0 lg:pt-0">
            <div className="flex justify-end mb-6">
              <div className="w-40 space-y-1 text-right">
                <p className="text-xs uppercase tracking-wide text-gray-500">{t('common.languageLabel')}</p>
                <LanguageSelector />
              </div>
            </div>
            {showMealTip && (
              <div className="mb-4 rounded-2xl border border-indigo-500/40 bg-indigo-900/40 p-4 sm:p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-lg font-semibold text-white">{t('mealPlanner.tipTitle')}</p>
                  <p className="text-sm text-indigo-100">{t('mealPlanner.tipSubtitle')}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={goToMealPlanner}
                    className="px-4 py-2 rounded-lg bg-white/90 text-indigo-900 font-semibold hover:bg-white transition-colors"
                  >
                    {t('mealPlanner.tipCta')}
                  </button>
                  <button
                    onClick={dismissTip}
                    className="px-4 py-2 rounded-lg border border-white/40 text-white hover:bg-white/10 transition-colors"
                  >
                    {t('mealPlanner.tipDismiss')}
                  </button>
                </div>
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
