import React, { useMemo, useState } from 'react';
import { User } from '../types';
import { useTranslation } from '../i18n/LanguageContext';

type Tier = 'free' | 'pro' | 'elite';

interface SubscriptionManagerProps {
  currentUser: User;
  onSubscriptionChange: (user: User) => void;
}

const tierOrder: Tier[] = ['free', 'pro', 'elite'];

const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({ currentUser, onSubscriptionChange }) => {
  const { t } = useTranslation();
  const [loadingTier, setLoadingTier] = useState<Tier | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const tiers = useMemo(() => {
    return tierOrder.map((tier) => ({
      tier,
      name: t(`subscription.tiers.${tier}.name`),
      price: t(`subscription.tiers.${tier}.price`),
      description: t(`subscription.tiers.${tier}.description`),
      features: [
        t(`subscription.tiers.${tier}.feature1`),
        t(`subscription.tiers.${tier}.feature2`),
        t(`subscription.tiers.${tier}.feature3`),
      ],
    }));
  }, [t]);

  const handleChangeTier = async (targetTier: Tier) => {
    if (targetTier === currentUser.subscriptionTier || loadingTier) return;
    setLoadingTier(targetTier);
    setToast(null);
    try {
      const response = await fetch('/api/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: targetTier }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || t('subscription.error'));
      }
      if (data?.user) {
        onSubscriptionChange(data.user);
      }
      setToast({ type: 'success', message: data?.message || t('subscription.updated') });
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : t('subscription.error') });
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-white">{t('subscription.title')}</h2>
        <p className="text-gray-400">{t('subscription.subtitle')}</p>
      </div>

      {toast && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            toast.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              : 'border-red-500/40 bg-red-500/10 text-red-200'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {tiers.map((plan) => {
          const isCurrent = plan.tier === currentUser.subscriptionTier;
          const isProcessing = loadingTier === plan.tier;
          return (
            <div
              key={plan.tier}
              className={`rounded-2xl border bg-gray-900/60 p-5 shadow-xl ${
                isCurrent ? 'border-indigo-500/70' : 'border-gray-800'
              }`}
            >
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-sm uppercase tracking-wide text-gray-400">{t('subscription.planLabel')}</p>
                  <h3 className="text-2xl font-semibold text-white">{plan.name}</h3>
                </div>
                {isCurrent && (
                  <span className="rounded-full bg-indigo-600/20 px-3 py-1 text-xs font-semibold text-indigo-200">
                    {t('subscription.currentBadge')}
                  </span>
                )}
              </div>
              <p className="mt-4 text-3xl font-bold text-white">{plan.price}</p>
              <p className="mt-2 text-sm text-gray-400">{plan.description}</p>
              <ul className="mt-4 space-y-2 text-sm text-gray-300">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-400" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                className={`mt-6 w-full rounded-lg px-4 py-2 text-sm font-medium transition ${
                  isCurrent
                    ? 'bg-gray-800 text-gray-400 cursor-default'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                } ${isProcessing ? 'opacity-60 cursor-progress' : ''}`}
                disabled={isCurrent || isProcessing}
                onClick={() => handleChangeTier(plan.tier)}
              >
                {isCurrent
                  ? t('subscription.currentPlan')
                  : isProcessing
                  ? t('subscription.updating')
                  : t('subscription.switchButton', { tier: plan.name })}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SubscriptionManager;
