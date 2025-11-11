import React, { useEffect, useState } from 'react';
import { useTranslation } from '../i18n/LanguageContext';
import Loader from './shared/Loader';

type SummaryStats = {
  periodStart: string;
  performance: {
    sessions: number;
    volume: number;
    previousVolume: number;
    volumeDelta: number;
    bestLiftDelta: { exercise: string | null; delta: number };
  };
  nutrition: {
    scans: number;
    avgCalories: number;
    proteinWarnings: number;
    proteinTarget: number;
  };
};

const WeeklySummaryCard: React.FC = () => {
  const { t, language } = useTranslation();
  const [summary, setSummary] = useState('');
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchSummary = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/summary/weekly?lang=${language}`);
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || 'Failed to load summary');
      }
      const data = await res.json();
      setSummary(data.summary || '');
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('weeklySummary.error'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-gray-800 p-6 rounded-xl border border-indigo-600">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase text-indigo-300 tracking-wider">{t('weeklySummary.title')}</p>
          <h3 className="text-2xl font-semibold text-white">{t('weeklySummary.subtitle')}</h3>
        </div>
        <button
          onClick={fetchSummary}
          className="px-4 py-2 text-sm font-semibold rounded-md border border-indigo-500 text-indigo-200 hover:bg-indigo-500/10"
        >
          {t('weeklySummary.refresh')}
        </button>
      </div>
      {isLoading ? (
        <div className="mt-4 flex justify-center"><Loader /></div>
      ) : error ? (
        <p className="mt-4 text-red-400 text-sm">{error}</p>
      ) : (
        <>
          <p className="mt-4 text-gray-100 whitespace-pre-line">{summary}</p>
          {stats && (
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                <p className="text-sm text-gray-400">{t('weeklySummary.performanceHeading')}</p>
                <ul className="mt-2 space-y-1 text-sm text-gray-200">
                  <li>{t('weeklySummary.sessions', { count: stats.performance.sessions })}</li>
                  <li>{t('weeklySummary.volume', { value: stats.performance.volume.toFixed(1) })}</li>
                  <li>{t('weeklySummary.volumeDelta', { value: stats.performance.volumeDelta.toFixed(1) })}</li>
                  {stats.performance.bestLiftDelta.exercise && (
                    <li>{t('weeklySummary.bestLift', { exercise: stats.performance.bestLiftDelta.exercise, delta: stats.performance.bestLiftDelta.delta.toFixed(1) })}</li>
                  )}
                </ul>
              </div>
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                <p className="text-sm text-gray-400">{t('weeklySummary.nutritionHeading')}</p>
                <ul className="mt-2 space-y-1 text-sm text-gray-200">
                  <li>{t('weeklySummary.scans', { count: stats.nutrition.scans })}</li>
                  <li>{t('weeklySummary.avgCalories', { value: stats.nutrition.avgCalories.toFixed(0) })}</li>
                  <li>{t('weeklySummary.proteinWarnings', { count: stats.nutrition.proteinWarnings, target: stats.nutrition.proteinTarget })}</li>
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default WeeklySummaryCard;
