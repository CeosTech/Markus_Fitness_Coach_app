import React, { useMemo } from 'react';
import { useTranslation } from '../../i18n/LanguageContext';
import useToolState from '../../hooks/useToolState';
import Loader from '../shared/Loader';
import ToolPageLayout from './ToolPageLayout';

const formatSeconds = (total: number) => {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

interface BoxingToolProps {
  onBack: () => void;
}

const audioOptions: Array<{ id: 'classic' | 'digital' | 'whistle'; titleKey: string; descKey: string }> = [
  { id: 'classic', titleKey: 'tools.boxing.audioProfiles.classic.title', descKey: 'tools.boxing.audioProfiles.classic.desc' },
  { id: 'digital', titleKey: 'tools.boxing.audioProfiles.digital.title', descKey: 'tools.boxing.audioProfiles.digital.desc' },
  { id: 'whistle', titleKey: 'tools.boxing.audioProfiles.whistle.title', descKey: 'tools.boxing.audioProfiles.whistle.desc' }
];

const presets = [
  {
    id: 'tabata',
    titleKey: 'tools.boxing.presets.tabata.title',
    descKey: 'tools.boxing.presets.tabata.desc',
    config: { roundLength: 20, restLength: 10, rounds: 8, warmupLength: 0 }
  },
  {
    id: 'boxing3',
    titleKey: 'tools.boxing.presets.boxing3.title',
    descKey: 'tools.boxing.presets.boxing3.desc',
    config: { roundLength: 180, restLength: 60, rounds: 3, warmupLength: 60 }
  },
  {
    id: 'hiit30',
    titleKey: 'tools.boxing.presets.hiit.title',
    descKey: 'tools.boxing.presets.hiit.desc',
    config: { roundLength: 30, restLength: 15, rounds: 12, warmupLength: 30 }
  }
];

const BoxingTool: React.FC<BoxingToolProps> = ({ onBack }) => {
  const { t } = useTranslation();
  const { loading, loadError, saveState, boxing } = useToolState();

  const saveStatusLabel = useMemo(() => {
    if (saveState === 'saving') return t('tools.saveStatus.saving');
    if (saveState === 'saved') return t('tools.saveStatus.saved');
    if (saveState === 'error') return t('tools.saveStatus.error');
    return '';
  }, [saveState, t]);

  const phaseLabel =
    boxing.phase === 'warmup' ? t('tools.boxing.warmupLabel') : boxing.phase === 'round' ? t('tools.boxing.roundLabel') : t('tools.boxing.restLabel');
  const phaseMax =
    boxing.phase === 'warmup'
      ? boxing.warmupLength || 1
      : boxing.phase === 'round'
      ? boxing.roundLength || 1
      : boxing.restLength || 1;
  const phaseProgress = Math.max(0, Math.min(100, Math.round((boxing.timeLeft / phaseMax) * 100)));

  return (
    <ToolPageLayout
      title={t('tools.boxing.title')}
      subtitle={t('tools.boxing.subtitle')}
      eyebrow={t('tools.boxing.eyebrow')}
      accentClass="bg-gradient-to-br from-rose-900/80 via-slate-900/70 to-gray-900/80"
      hero={<span role="img" aria-label="boxing bell">🥊</span>}
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
          <div className="rounded-3xl bg-gradient-to-r from-rose-500/30 via-slate-900/40 to-gray-900/60 border border-white/5 p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-white/70">{phaseLabel}</p>
                <p className="text-6xl sm:text-7xl font-mono text-white drop-shadow-xl">{formatSeconds(Math.max(0, boxing.timeLeft))}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-white/60">{t('tools.boxing.currentRound', { current: boxing.currentRound, total: boxing.rounds })}</p>
                <p className="text-base text-white/80">{t('tools.boxing.nextPhase', { phase: boxing.phase === 'round' ? t('tools.boxing.restLabel') : t('tools.boxing.roundLabel') })}</p>
              </div>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-white to-rose-200 rounded-full transition-all duration-300" style={{ width: `${phaseProgress}%` }} />
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={boxing.start}
                className="flex-1 min-w-[140px] px-4 py-3 rounded-2xl text-sm font-semibold bg-emerald-500/80 text-white shadow-lg"
              >
                {t('tools.actions.start')}
              </button>
              <button
                type="button"
                onClick={boxing.pause}
                className="flex-1 min-w-[140px] px-4 py-3 rounded-2xl text-sm font-semibold bg-yellow-400/90 text-gray-900 shadow-lg"
              >
                {t('tools.actions.pause')}
              </button>
              <button
                type="button"
                onClick={boxing.reset}
                className="flex-1 min-w-[140px] px-4 py-3 rounded-2xl text-sm font-semibold bg-white/15 text-white border border-white/10 hover:bg-white/25 transition"
              >
                {t('tools.actions.reset')}
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/5 bg-black/35 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">{t('tools.boxing.presetsTitle')}</h3>
              <span className="text-xs text-white/60">{t('tools.boxing.presetsSubtitle')}</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {presets.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => boxing.applyPreset(preset.config, true)}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left hover:border-white/40 transition flex flex-col gap-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{t(preset.titleKey)}</p>
                    <p className="text-xs text-white/60 mt-1">{t(preset.descKey)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] text-white/70">
                    <span className="px-2 py-1 rounded-full bg-white/10 border border-white/10">
                      {t('tools.boxing.roundLength')}: {preset.config.roundLength}s
                    </span>
                    <span className="px-2 py-1 rounded-full bg-white/10 border border-white/10">
                      {t('tools.boxing.restLength')}: {preset.config.restLength}s
                    </span>
                    <span className="px-2 py-1 rounded-full bg-white/10 border border-white/10">
                      {t('tools.boxing.rounds')}: {preset.config.rounds}
                    </span>
                  </div>
                  <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-emerald-400/80 text-gray-900 text-xs font-semibold self-start">
                    {t('tools.boxing.startPreset')}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-3xl border border-white/5 bg-black/40 p-5 space-y-5">
              <h3 className="text-lg font-semibold text-white">{t('tools.boxing.timingTitle')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="block text-white/70 mb-1">{t('tools.boxing.roundLength')}</label>
                  <input
                    type="number"
                    min="30"
                    value={boxing.roundLength}
                    onChange={(e) => boxing.changeRoundLength(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-white/70 mb-1">{t('tools.boxing.restLength')}</label>
                  <input
                    type="number"
                    min="0"
                    value={boxing.restLength}
                    onChange={(e) => boxing.changeRestLength(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-white/70 mb-1">{t('tools.boxing.rounds')}</label>
                  <input
                    type="number"
                    min="1"
                    value={boxing.rounds}
                    onChange={(e) => boxing.changeRounds(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-white/70 mb-1">{t('tools.boxing.warmupLabel')}</label>
                  <input
                    type="number"
                    min="0"
                    value={boxing.warmupLength}
                    onChange={(e) => boxing.changeWarmupLength(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white"
                  />
                  <p className="text-xs text-white/50 mt-1">{t('tools.boxing.warmupHelper')}</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/5 bg-black/40 p-5 space-y-5">
              <h3 className="text-lg font-semibold text-white">{t('tools.boxing.audioTitle')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {audioOptions.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => boxing.changeAudioProfile(option.id)}
                    className={`rounded-2xl border px-3 py-3 text-left transition ${
                      boxing.audioProfile === option.id
                        ? 'border-white/60 bg-white/20 text-white'
                        : 'border-white/10 bg-white/5 text-white/70 hover:border-white/30'
                    }`}
                  >
                    <p className="text-sm font-semibold">{t(option.titleKey)}</p>
                    <p className="text-xs text-white/60 mt-1">{t(option.descKey)}</p>
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-white/70 text-sm mb-2">{t('tools.boxing.volumeLabel', { value: Math.round(boxing.volume * 100) })}</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={boxing.volume}
                  onChange={(e) => boxing.changeVolume(Number(e.target.value))}
                  className="w-full accent-rose-300"
                />
              </div>
            </div>
          </div>
        </>
      )}
    </ToolPageLayout>
  );
};

export default BoxingTool;
