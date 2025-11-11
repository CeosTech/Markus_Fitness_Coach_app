
import React, { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import { ViewType, User } from '../types';
import { useTranslation } from '../i18n/LanguageContext';

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

  return (
    <div className="flex h-screen bg-gray-900 text-gray-200 font-sans">
      <Sidebar 
        currentView={currentView} 
        setCurrentView={setCurrentView} 
        handleSignOut={handleSignOut} 
        currentUser={currentUser}
      />
      <main className="flex-1 p-4 sm:p-6 lg:p-10 overflow-y-auto">
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
      </main>
    </div>
  );
};

export default Layout;
