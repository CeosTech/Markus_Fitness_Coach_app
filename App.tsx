import React, { useState, useEffect, useCallback } from 'react';
import { ViewType, MarketingPage, User } from './types';
import Layout from './components/Layout';
import VideoAnalysis from './components/VideoAnalysis';
import ImageAnalysis from './components/ImageAnalysis';
import Chatbot from './components/Chatbot';
import LiveCoach from './components/LiveCoach';
import ProfilePage from './components/ProfilePage';
import PlanGenerator from './components/PlanGenerator';
import Tools from './components/Tools';
import AdminDashboard from './components/AdminDashboard';
import SubscriptionManager from './components/SubscriptionManager';
import SignInForm from './components/auth/SignInForm';
import SignUpForm from './components/auth/SignUpForm';
import Loader from './components/shared/Loader';
import MarketingLayout from './components/marketing/MarketingLayout';
import HomePage from './components/marketing/HomePage';
import FeaturesPage from './components/marketing/FeaturesPage';
import PricingPage from './components/marketing/PricingPage';
import AboutPage from './components/marketing/AboutPage';
import CareersPage from './components/marketing/CareersPage';
import PrivacyPolicyPage from './components/marketing/PrivacyPolicyPage';
import TermsOfServicePage from './components/marketing/TermsOfServicePage';


const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewType>('video');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [marketingPage, setMarketingPage] = useState<MarketingPage>('home');
  const [isLoading, setIsLoading] = useState(true);

  const checkAuthStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/check');
      if (response.ok) {
        const data = await response.json();
        setIsAuthenticated(data.isAuthenticated);
        if (data.isAuthenticated) {
          setCurrentUser(data.user);
        }
      } else {
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);
  
  const handleAuthSuccess = (user: User) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    setMarketingPage('home'); 
  };
  
  const handleSignOut = async () => {
    try {
      await fetch('/api/signout', { method: 'POST' });
    } catch (error) {
      console.error('Sign out failed:', error);
    } finally {
      setIsAuthenticated(false);
      setCurrentUser(null);
      setMarketingPage('home');
    }
  };

  const renderAppContent = () => {
    if (!currentUser) return <Loader />;
    switch (currentView) {
      case 'video': return <VideoAnalysis currentUser={currentUser} />;
      case 'image': return <ImageAnalysis currentUser={currentUser} />;
      case 'chat': return <Chatbot />;
      case 'live': return <LiveCoach currentUser={currentUser} />;
      case 'plan': return <PlanGenerator currentUser={currentUser} />;
      case 'profile': return <ProfilePage currentUser={currentUser} onProfileUpdate={setCurrentUser} />;
      case 'subscription': return <SubscriptionManager currentUser={currentUser} onSubscriptionChange={setCurrentUser} />;
      case 'tools': return <Tools />;
      case 'admin': return <AdminDashboard />;
      default: return <VideoAnalysis currentUser={currentUser} />;
    }
  };

  const renderMarketingContent = () => {
    switch(marketingPage) {
      case 'features': return <FeaturesPage />;
      case 'pricing': return <PricingPage setPage={setMarketingPage} onAuthSuccess={handleAuthSuccess} />;
      case 'signin': return <SignInForm onAuthSuccess={handleAuthSuccess} onSwitchView={() => setMarketingPage('signup')} />;
      case 'signup': return <SignUpForm onAuthSuccess={handleAuthSuccess} onSwitchView={() => setMarketingPage('signin')} />;
      case 'about': return <AboutPage />;
      case 'careers': return <CareersPage />;
      case 'privacy': return <PrivacyPolicyPage />;
      case 'terms': return <TermsOfServicePage />;
      case 'home':
      default:
        return <HomePage setPage={setMarketingPage} />;
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <Loader />
      </div>
    );
  }

  if (!isAuthenticated || !currentUser) {
    return (
        <MarketingLayout activePage={marketingPage} setPage={setMarketingPage}>
            {renderMarketingContent()}
        </MarketingLayout>
    );
  }

  return (
    <Layout 
      currentView={currentView} 
      setCurrentView={setCurrentView}
      handleSignOut={handleSignOut}
      currentUser={currentUser}
    >
      {renderAppContent()}
    </Layout>
  );
};

export default App;
