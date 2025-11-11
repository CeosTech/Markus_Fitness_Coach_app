import React, { useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/LanguageContext';
import useToolState from '../../hooks/useToolState';
import Loader from '../shared/Loader';
import ToolPageLayout from './ToolPageLayout';

interface HydrationToolProps {
  onBack: () => void;
}

const HydrationTool: React.FC<HydrationToolProps> = ({ onBack }) => {
  const { t } = useTranslation();
  const { loading, loadError, saveState, hydration } = useToolState();

  const [customAmount, setCustomAmount] = useState(350);

  const saveStatusLabel = useMemo(() => {
    if (saveState === 'saving') return t('tools.saveStatus.saving');
    if (saveState === 'saved') return t('tools.saveStatus.saved');
    if (saveState === 'error') return t('tools.saveStatus.error');
    return '';
  }, [saveState, t]);

  const remaining = Math.max(hydration.target - hydration.consumed, 0);
  const quickAdds = [150, 250, 500];

  const handleCustomLog = () => {
    if (!Number.isFinite(customAmount) || customAmount <= 0) return;
    hydration.logAmount(customAmount);
  };

  return (
    <ToolPageLayout
      title={t('tools.hydration.title')}
      subtitle={t('tools.hydration.subtitle')}
      accentClass="bg-gradient-to-br from-cyan-900/80 via-blue-900/60 to-gray-900/80"
      hero={<span role="img" aria-label="water drop">💧</span>}
      eyebrow={t('tools.hydration.eyebrow')}
      onBack={onBack}
      saveStatusLabel={saveStatusLabel}
    >
      {loading ? (
        <div className="bg-gray-900/60 p-8 rounded-2xl border border-white/5 flex justify-center">
          <Loader />
        </div>
      ) : loadError ? (
        <div className="bg-red-900/40 border border-red-500/60 text-red-100 p-4 rounded-2xl text-center text-sm">
          {t('tools.loadError')}
        </div>
      ) : (
        <>
          <div className="rounded-3xl bg-gradient-to-r from-cyan-500/30 via-blue-900/40 to-gray-900/40 border border-white/5 p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between text-sm text-white/80">
              <span>{t('tools.hydration.goal', { goal: hydration.target })}</span>
              <span>{hydration.progress}%</span>
            </div>
            <div className="relative h-4 bg-white/10 rounded-full overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-300 via-cyan-400 to-blue-300 rounded-full transition-all duration-300" style={{ width: `${hydration.progress}%` }} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-white/80">
              <div className="rounded-2xl bg-white/10 border border-white/10 p-3">
                <p className="text-xs uppercase tracking-wide text-white/60">{t('tools.hydration.stats.consumed')}</p>
                <p className="text-2xl font-semibold">{hydration.consumed} ml</p>
              </div>
              <div className="rounded-2xl bg-white/10 border border-white/10 p-3">
                <p className="text-xs uppercase tracking-wide text-white/60">{t('tools.hydration.stats.remaining')}</p>
                <p className="text-2xl font-semibold">{remaining} ml</p>
              </div>
              <div className="rounded-2xl bg-white/10 border border-white/10 p-3">
                <p className="text-xs uppercase tracking-wide text-white/60">{t('tools.hydration.stats.target')}</p>
                <p className="text-2xl font-semibold">{hydration.target} ml</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={hydration.addGlass} className="px-4 py-3 rounded-2xl bg-cyan-500/80 text-white font-semibold shadow-lg">
                {t('tools.hydration.addGlass')}
              </button>
              <button type="button" onClick={hydration.reset} className="px-4 py-3 rounded-2xl bg-white/10 text-white border border-white/10 hover:bg-white/20 transition font-semibold">
                {t('tools.actions.reset')}
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/5 bg-black/40 p-5 space-y-5">
            <div>
              <p className="text-sm text-white/70 mb-3">{t('tools.hydration.quickAddsSubtitle')}</p>
              <div className="grid grid-cols-3 gap-3">
                {quickAdds.map(amount => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => hydration.logAmount(amount)}
                    className="rounded-2xl bg-white/10 border border-white/10 py-3 text-white font-semibold hover:bg-white/20 transition"
                  >
                    {t('tools.hydration.quickAddButton', { amount })}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
              <div className="sm:col-span-4">
                <label className="block text-xs uppercase tracking-wide text-white/60 mb-1">{t('tools.hydration.customLabel')}</label>
                <input
                  type="number"
                  min="50"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <button
                type="button"
                onClick={handleCustomLog}
                className="sm:col-span-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-400 text-gray-900 font-semibold shadow-lg mt-5 sm:mt-7"
              >
                {t('tools.hydration.logButton')}
              </button>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-white/60 mb-1">{t('tools.hydration.setGoal')}</label>
              <input
                type="number"
                min="1000"
                value={hydration.target}
                onChange={(e) => hydration.changeTarget(Number(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white"
              />
            </div>
          </div>
        </>
      )}
    </ToolPageLayout>
  );
};

export default HydrationTool;
