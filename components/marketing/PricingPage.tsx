import React, { useState } from 'react';
import { MarketingPage, User } from '../../types';
import { useTranslation } from '../../i18n/LanguageContext';

interface PricingPageProps {
    setPage: (page: MarketingPage) => void;
    onAuthSuccess: (user: User) => void;
}

const PricingCard: React.FC<{
    plan: string;
    price: string;
    features: string[];
    tier: 'free' | 'pro' | 'elite';
    isPopular?: boolean;
    popularText: string;
    buttonText: string;
    onClick: (tier: 'free' | 'pro' | 'elite') => void;
}> = ({ plan, price, features, tier, isPopular = false, popularText, buttonText, onClick }) => (
    <div className={`relative border rounded-lg p-8 text-center transition-all duration-300 transform hover:-translate-y-2 ${isPopular ? 'bg-gray-800 border-blue-500 shadow-2xl' : 'bg-gray-800/50 border-gray-700'}`}>
        {isPopular && <div className="absolute top-0 -translate-y-1/2 left-1/2 -translate-x-1/2 px-3 py-1 text-sm text-white bg-blue-600 rounded-full font-semibold">{popularText}</div>}
        <h3 className="text-2xl font-bold text-white">{plan}</h3>
        <p className="mt-4 text-4xl font-extrabold text-white">{price}<span className="text-base font-medium text-gray-400">/mo</span></p>
        <ul className="mt-8 space-y-4 text-gray-300">
            {features.map(feature => <li key={feature}>- {feature} -</li>)}
        </ul>
        <button onClick={() => onClick(tier)} className={`w-full mt-10 py-3 px-6 font-semibold rounded-lg transition-colors ${isPopular ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-700 text-white hover:bg-gray-600'}`}>
            {buttonText}
        </button>
    </div>
);

const PricingPage: React.FC<PricingPageProps> = ({ setPage, onAuthSuccess }) => {
  const [error, setError] = useState('');
  const { t, translations } = useTranslation();

  const handleChoosePlan = async (tier: 'free' | 'pro' | 'elite') => {
      // In a real app, this would redirect to a Stripe checkout.
      // Here, we'll check if the user is logged in. If not, we send them to signup.
      // If they are logged in, we'll simulate the upgrade.
      const authCheckResponse = await fetch('/api/auth/check');
      const authData = await authCheckResponse.json();

      if (!authData.isAuthenticated) {
          setPage('signup');
          return;
      }
      
      try {
        const response = await fetch('/api/upgrade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tier }),
        });
        const data = await response.json();
        if(response.ok) {
            onAuthSuccess(data.user);
        } else {
            setError(data.message || 'Upgrade failed.');
        }
      } catch (err) {
          setError('A network error occurred.');
      }
  };


  return (
    <div className="bg-gray-900 pt-20">
       <div className="text-center pt-16 pb-12 px-4">
        <h1 className="text-5xl font-extrabold text-white text-glow fade-in">{t('pricingPage.title')}</h1>
        <p className="mt-4 text-xl text-gray-400 max-w-3xl mx-auto fade-in fade-in-delay-1">{t('pricingPage.subtitle')}</p>
        {error && <p className="mt-4 text-red-400">{error}</p>}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="fade-in">
                <PricingCard 
                    plan={t('pricingPage.plan1Name')}
                    price={t('pricingPage.plan1Price')}
                    tier="free"
                    features={translations.pricingPage.plan1Features}
                    onClick={handleChoosePlan}
                    buttonText={t('pricingPage.choosePlanButton')}
                    popularText={t('pricingPage.popular')}
                />
            </div>
            <div className="fade-in fade-in-delay-1">
                <PricingCard 
                    plan={t('pricingPage.plan2Name')}
                    price={t('pricingPage.plan2Price')}
                    tier="pro"
                    features={translations.pricingPage.plan2Features}
                    isPopular
                    onClick={handleChoosePlan}
                    buttonText={t('pricingPage.choosePlanButton')}
                    popularText={t('pricingPage.popular')}
                />
            </div>
            <div className="fade-in fade-in-delay-2">
                <PricingCard 
                    plan={t('pricingPage.plan3Name')}
                    price={t('pricingPage.plan3Price')}
                    tier="elite"
                    features={translations.pricingPage.plan3Features}
                    onClick={handleChoosePlan}
                    buttonText={t('pricingPage.choosePlanButton')}
                    popularText={t('pricingPage.popular')}
                />
            </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;