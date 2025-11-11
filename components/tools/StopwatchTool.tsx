import React, { useMemo } from 'react';
import { useTranslation } from '../../i18n/LanguageContext';
import useToolState from '../../hooks/useToolState';
import Loader from '../shared/Loader';
import ToolPageLayout from './ToolPageLayout';

const formatTime = (ms: number) => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
};

interface StopwatchToolProps {
  onBack: () => void;
}

const StopwatchTool: React.FC<StopwatchToolProps> = ({ onBack }) => {
  const { t } = useTranslation();
  const { loading, loadError, saveState, stopwatch } = useToolState();

  const saveStatusLabel = useMemo(() => {
    if (saveState === 'saving') return t('tools.saveStatus.saving');
    if (saveState === 'saved') return t('tools.saveStatus.saved');
    if (saveState === 'error') return t('tools.saveStatus.error');
    return '';
  }, [saveState, t]);

  const lapStats = useMemo(() => {
    if (!stopwatch.laps.length) {
      return { best: null as number | null, average: null as number | null };
    }
    const lapTimes = stopwatch.laps.map(lap => lap.lapMs);
    const best = Math.min(...lapTimes);
    const avg = lapTimes.reduce((sum, lap) => sum + lap, 0) / lapTimes.length;
    return { best, average: avg };
  }, [stopwatch.laps]);

  const lapRows = [...stopwatch.laps].reverse();

  return (
    <ToolPageLayout
      title={t('tools.stopwatch.title')}
      subtitle={t('tools.stopwatch.subtitle')}
      eyebrow={t('tools.stopwatch.eyebrow')}
      accentClass="bg-gradient-to-br from-indigo-900/80 via-slate-900/70 to-gray-900/80"
      hero={<span role="img" aria-label="chronometer">⏱️</span>}
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
          <div className="rounded-3xl bg-black/40 border border-white/5 p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className={`text-xs uppercase tracking-[0.4em] ${stopwatch.running ? 'text-emerald-300' : 'text-yellow-200'}`}>
                {stopwatch.running ? t('tools.stopwatch.statusRunning') : t('tools.stopwatch.statusPaused')}
              </span>
              <span className="text-sm text-white/70">{new Date().toLocaleTimeString()}</span>
            </div>
            <div className="text-center text-6xl sm:text-7xl font-mono text-white tracking-tight drop-shadow-2xl">{formatTime(stopwatch.time)}</div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <button
                type="button"
                onClick={stopwatch.start}
                className="col-span-2 px-4 py-3 rounded-2xl text-white font-semibold bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={stopwatch.running}
              >
                {t('tools.actions.start')}
              </button>
              <button
                type="button"
                onClick={stopwatch.pause}
                className="col-span-2 px-4 py-3 rounded-2xl font-semibold bg-yellow-400/90 text-gray-900 shadow-lg"
              >
                {t('tools.actions.pause')}
              </button>
              <button
                type="button"
                onClick={stopwatch.reset}
                className="px-4 py-3 rounded-2xl font-semibold bg-white/10 text-white border border-white/10 hover:bg-white/20 transition"
              >
                {t('tools.actions.reset')}
              </button>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={stopwatch.addLap}
                disabled={!stopwatch.running}
                className="flex-1 min-w-[140px] px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-500/70 text-white hover:bg-indigo-500 transition disabled:opacity-40"
              >
                {t('tools.stopwatch.addLap')}
              </button>
              <button
                type="button"
                onClick={stopwatch.clearLaps}
                disabled={!stopwatch.laps.length}
                className="flex-1 min-w-[140px] px-4 py-2 rounded-xl text-sm font-semibold bg-white/10 text-white border border-white/10 hover:bg-white/20 transition disabled:opacity-40"
              >
                {t('tools.stopwatch.clearLaps')}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-white/60">{t('tools.stopwatch.stats.totalLaps')}</p>
              <p className="text-3xl font-semibold text-white mt-1">{stopwatch.laps.length}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-white/60">{t('tools.stopwatch.stats.bestLap')}</p>
              <p className="text-3xl font-semibold text-white mt-1">{lapStats.best ? formatTime(lapStats.best) : '—'}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wide text-white/60">{t('tools.stopwatch.stats.avgLap')}</p>
              <p className="text-3xl font-semibold text-white mt-1">{lapStats.average ? formatTime(lapStats.average) : '—'}</p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/5 bg-black/30 backdrop-blur p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">{t('tools.stopwatch.lapsHeading')}</h3>
              <span className="text-xs text-white/60">{t('tools.stopwatch.lapCount', { count: stopwatch.laps.length })}</span>
            </div>
            {lapRows.length === 0 ? (
              <p className="text-sm text-white/60">{t('tools.stopwatch.emptyLaps')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-white/80">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-white/50">
                      <th className="py-2 pr-4 text-left">{t('tools.stopwatch.lapLabel')}</th>
                      <th className="py-2 pr-4 text-left">{t('tools.stopwatch.lapTime')}</th>
                      <th className="py-2 text-left">{t('tools.stopwatch.totalTime')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {lapRows.map((lap, index) => {
                      const lapNumber = lapRows.length - index;
                      const isBest = lapStats.best !== null && lap.lapMs === lapStats.best;
                      return (
                        <tr key={lap.id} className="hover:bg-white/5">
                          <td className="py-2 pr-4 font-semibold text-white">
                            {t('tools.stopwatch.lapName', { index: lapNumber })}
                            {isBest && <span className="ml-2 text-xs text-emerald-300">{t('tools.stopwatch.bestBadge')}</span>}
                          </td>
                          <td className="py-2 pr-4 font-mono">{formatTime(lap.lapMs)}</td>
                          <td className="py-2 font-mono text-white/70">{formatTime(lap.totalMs)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </ToolPageLayout>
  );
};

export default StopwatchTool;
