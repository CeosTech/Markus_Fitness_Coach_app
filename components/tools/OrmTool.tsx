import React, { useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/LanguageContext';
import ToolPageLayout from './ToolPageLayout';

interface OrmToolProps {
  onBack: () => void;
}

const OrmTool: React.FC<OrmToolProps> = ({ onBack }) => {
  const { t } = useTranslation();
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');

  const estimate = useMemo(() => {
    const w = Number(weight);
    const r = Number(reps);
    if (!w || !r) return null;
    return Math.round(w * (1 + r / 30));
  }, [weight, reps]);

  const breakdown = useMemo(() => {
    if (!estimate) return [];
    const percentages = [0.95, 0.9, 0.85, 0.8, 0.75, 0.7];
    return percentages.map(pct => ({
      pct: Math.round(pct * 100),
      load: Math.round(estimate * pct)
    }));
  }, [estimate]);

  return (
    <ToolPageLayout
      title={t('tools.orm.title')}
      subtitle={t('tools.orm.subtitle')}
      accentClass="bg-gradient-to-br from-emerald-900/80 via-slate-900/70 to-gray-900/80"
      hero={<span role="img" aria-label="strength">🏋️</span>}
      eyebrow={t('tools.orm.eyebrow')}
      onBack={onBack}
    >
      <div className="rounded-3xl bg-black/40 border border-white/5 p-6 sm:p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-white/70 mb-1">{t('tools.orm.weight')}</label>
            <input
              type="number"
              min="1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-white/70 mb-1">{t('tools.orm.reps')}</label>
            <input
              type="number"
              min="1"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-3 py-2 text-white"
            />
          </div>
        </div>
        <div className="rounded-3xl bg-gradient-to-r from-emerald-500/30 via-slate-900/60 to-gray-900/60 border border-white/5 p-6 text-center">
          {estimate ? (
            <>
              <p className="text-xs uppercase tracking-[0.4em] text-white/70 mb-3">{t('tools.orm.estimatedLabel')}</p>
              <p className="text-6xl font-extrabold text-white drop-shadow-2xl">{t('tools.orm.result', { value: estimate })}</p>
              <p className="text-sm text-white/70 mt-3">{t('tools.orm.tip')}</p>
            </>
          ) : (
            <p className="text-sm text-white/60">{t('tools.orm.placeholder')}</p>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-white/5 bg-black/40 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{t('tools.orm.breakdownTitle')}</h3>
          <span className="text-xs text-white/60">{t('tools.orm.breakdownSubtitle')}</span>
        </div>
        {breakdown.length === 0 ? (
          <p className="text-sm text-white/60">{t('tools.orm.breakdownPlaceholder')}</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {breakdown.map(item => (
              <div key={item.pct} className="rounded-2xl bg-white/5 border border-white/10 p-3">
                <p className="text-xs uppercase tracking-wide text-white/60">{item.pct}%</p>
                <p className="text-2xl font-semibold text-white">{item.load} kg</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </ToolPageLayout>
  );
};

export default OrmTool;
