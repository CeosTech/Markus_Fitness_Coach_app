import React, { useEffect, useMemo, useState } from 'react';
import { User, PerformanceLog, PerformanceAnalytics } from '../types';
import Loader from './shared/Loader';
import { useTranslation } from '../i18n/LanguageContext';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface PerformanceTrackerProps {
  currentUser: User;
}

type RangeKey = 'week' | 'month' | 'year';

const DEFAULT_FORM = {
  exercise: '',
  load: '',
  reps: '',
  unit: 'kg' as 'kg' | 'lb',
  rpe: '',
  notes: '',
  performedAt: new Date().toISOString().slice(0, 10)
};

const rangeOptions: RangeKey[] = ['week', 'month', 'year'];

const PerformanceTracker: React.FC<PerformanceTrackerProps> = ({ currentUser }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [logs, setLogs] = useState<PerformanceLog[]>([]);
  const [analytics, setAnalytics] = useState<PerformanceAnalytics | null>(null);
  const [range, setRange] = useState<RangeKey>('month');
  const [exerciseFilter, setExerciseFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const convertLoad = (load: number, unit: string) => (unit === 'lb' ? load * 0.453592 : load);

  const exerciseOptions = useMemo(() => {
    const uniques = Array.from(new Set(logs.map(log => log.exercise))).sort((a, b) => a.localeCompare(b));
    return ['all', ...uniques];
  }, [logs]);

  const filteredLogs = useMemo(
    () => (exerciseFilter === 'all' ? logs : logs.filter(log => log.exercise === exerciseFilter)),
    [logs, exerciseFilter]
  );

  const volumeTotal = useMemo(
    () => filteredLogs.reduce((sum, log) => sum + convertLoad(log.load, log.unit) * log.reps, 0),
    [filteredLogs]
  );

  const chartVolumeData = useMemo(() => {
    const map = new Map<string, number>();
    filteredLogs
      .slice()
      .reverse()
      .forEach(log => {
        const date = new Date(log.performedAt);
        const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const volume = convertLoad(log.load, log.unit) * log.reps;
        map.set(label, (map.get(label) || 0) + volume);
      });
    return Array.from(map.entries()).map(([label, volume]) => ({ label, volume: Number(volume.toFixed(2)) }));
  }, [filteredLogs]);

  const bestExerciseData = useMemo(() => {
    const map = new Map<string, number>();
    filteredLogs.forEach(log => {
      const load = convertLoad(log.load, log.unit);
      if (!map.has(log.exercise) || load > (map.get(log.exercise) || 0)) {
        map.set(log.exercise, load);
      }
    });
    return Array.from(map.entries())
      .map(([exercise, load]) => ({ exercise, load: Number(load.toFixed(2)) }))
      .sort((a, b) => b.load - a.load)
      .slice(0, 6);
  }, [filteredLogs]);

  const fetchData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [logRes, analyticsRes] = await Promise.all([
        fetch(`/api/performance?range=${range}`),
        fetch(`/api/performance/analytics?range=${range}`)
      ]);
      if (!logRes.ok) throw new Error('Failed to load logs');
      if (!analyticsRes.ok) throw new Error('Failed to load analytics');
      const logData = await logRes.json();
      const analyticsData = await analyticsRes.json();
      setLogs(logData.logs || []);
      setAnalytics(analyticsData.analytics || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('performance.errorLoading'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => setForm({ ...DEFAULT_FORM, unit: form.unit });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        exercise: form.exercise.trim(),
        load: Number(form.load),
        reps: Number(form.reps),
        unit: form.unit,
        rpe: form.rpe ? Number(form.rpe) : null,
        notes: form.notes?.trim() || null,
        performedAt: form.performedAt
      };
      const res = await fetch('/api/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Save failed');
      }
      resetForm();
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('performance.errorSaving'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm(t('performance.deleteConfirm'))) return;
    try {
      const res = await fetch(`/api/performance/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setLogs(prev => prev.filter(log => log.id !== id));
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('performance.errorSaving'));
    }
  };

  const translate = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const exerciseFilterLabel = translate('performance.filters.exerciseLabel', 'Exercise');
  const exerciseAllLabel = translate('performance.filters.allExercises', 'All exercises');
  const volumeChartTitle = translate('performance.charts.volumeTitle', 'Volume trend');
  const volumeChartSubtitle = translate('performance.charts.volumeSubtitle', 'Total tonnage per session');
  const bestChartTitle = translate('performance.charts.bestTitle', 'Top loads by lift');
  const bestChartSubtitle = translate('performance.charts.bestSubtitle', 'Heaviest entries this range');
  const chartsNoData = translate('performance.charts.noData', 'No data for the current selection.');
  const emptyFilteredLabel = translate('performance.emptyFiltered', 'No entries match this filter.');

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold text-white">{t('performance.title')}</h2>
        <p className="text-gray-400">{t('performance.subtitle')}</p>
      </div>

      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('performance.exercise')}</label>
            <input
              type="text"
              value={form.exercise}
              onChange={(e) => updateForm('exercise', e.target.value)}
              required
              className="w-full bg-gray-700 border border-gray-600 rounded-md px-4 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('performance.load')}</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.5"
                min="0"
                value={form.load}
                onChange={(e) => updateForm('load', e.target.value)}
                required
                className="flex-1 bg-gray-700 border border-gray-600 rounded-md px-4 py-2 text-white"
              />
              <select
                value={form.unit}
                onChange={(e) => updateForm('unit', e.target.value as 'kg' | 'lb')}
                className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white"
              >
                <option value="kg">kg</option>
                <option value="lb">lb</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('performance.reps')}</label>
            <input
              type="number"
              min="1"
              value={form.reps}
              onChange={(e) => updateForm('reps', e.target.value)}
              required
              className="w-full bg-gray-700 border border-gray-600 rounded-md px-4 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('performance.rpe')}</label>
            <input
              type="number"
              step="0.5"
              min="1"
              max="10"
              value={form.rpe}
              onChange={(e) => updateForm('rpe', e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-md px-4 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('performance.date')}</label>
            <input
              type="date"
              value={form.performedAt}
              onChange={(e) => updateForm('performedAt', e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-md px-4 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('performance.notes')}</label>
            <textarea
              value={form.notes}
              onChange={(e) => updateForm('notes', e.target.value)}
              rows={2}
              className="w-full bg-gray-700 border border-gray-600 rounded-md px-4 py-2 text-white"
            />
          </div>
          <div className="md:col-span-2 lg:col-span-3 flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 disabled:bg-gray-500"
            >
              {saving ? t('performance.saving') : t('performance.saveEntry')}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-6 py-3 bg-gray-700 text-white font-semibold rounded-md hover:bg-gray-600"
            >
              {t('performance.reset')}
            </button>
          </div>
        </form>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-3">
          {rangeOptions.map(option => (
            <button
              key={option}
              onClick={() => setRange(option)}
              className={`px-4 py-2 rounded-full text-sm font-semibold border ${range === option ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-gray-600 text-gray-300'}`}
            >
              {t(`performance.range.${option}`)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-300">
          <label className="text-gray-400">{exerciseFilterLabel}</label>
          <select
            value={exerciseFilter}
            onChange={(e) => setExerciseFilter(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-white"
          >
            {exerciseOptions.map(option => (
              <option key={option} value={option}>
                {option === 'all' ? exerciseAllLabel : option}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>

      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-sm text-gray-400">{t('performance.stats.totalVolume')}</p>
            <p className="text-2xl font-bold text-white">{analytics.totalVolume.toFixed(1)}</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-sm text-gray-400">{t('performance.stats.entries')}</p>
            <p className="text-2xl font-bold text-white">{analytics.totalEntries}</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-sm text-gray-400">{t('performance.stats.bestLift')}</p>
            <p className="text-2xl font-bold text-white">{analytics.bestLoad.toFixed(1)}</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-sm text-gray-400">{t('performance.stats.avgLoad')}</p>
            <p className="text-2xl font-bold text-white">{analytics.averageLoad.toFixed(1)}</p>
          </div>
        </div>
      )}
      {currentUser.subscriptionTier === 'free' && (
        <div className="bg-indigo-900/30 text-indigo-100 text-sm px-4 py-3 rounded-lg border border-indigo-600">
          {t('performance.freeHint')}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-white">{volumeChartTitle}</h3>
            <p className="text-sm text-gray-400">{volumeChartSubtitle}</p>
          </div>
          {chartVolumeData.length === 0 ? (
            <p className="text-sm text-gray-500">{chartsNoData}</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartVolumeData}>
                  <defs>
                    <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="label" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
                  <Area type="monotone" dataKey="volume" stroke="#818cf8" fillOpacity={1} fill="url(#volumeGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-white">{bestChartTitle}</h3>
            <p className="text-sm text-gray-400">{bestChartSubtitle}</p>
          </div>
          {bestExerciseData.length === 0 ? (
            <p className="text-sm text-gray-500">{chartsNoData}</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bestExerciseData} layout="vertical" margin={{ left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" stroke="#9ca3af" />
                  <YAxis dataKey="exercise" type="category" stroke="#9ca3af" width={100} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
                  <Bar dataKey="load" fill="#34d399" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">{t('performance.logTitle')}</h3>
          <span className="text-sm text-gray-400">{t('performance.totalVolumeLabel', { volume: volumeTotal.toFixed(1) })}</span>
        </div>
        {isLoading ? (
          <div className="flex justify-center"><Loader /></div>
        ) : filteredLogs.length === 0 ? (
          <p className="text-gray-400">{exerciseFilter === 'all' ? t('performance.empty') : emptyFilteredLabel}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('performance.table.date')}</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('performance.table.exercise')}</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('performance.table.load')}</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('performance.table.reps')}</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('performance.table.volume')}</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('performance.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredLogs.map(log => (
                  <tr key={log.id}>
                    <td className="px-4 py-2 text-sm text-gray-300">{new Date(log.performedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-sm text-white">{log.exercise}</td>
                    <td className="px-4 py-2 text-sm text-gray-300">{log.load} {log.unit}</td>
                    <td className="px-4 py-2 text-sm text-gray-300">{log.reps}{log.rpe ? ` · RPE ${log.rpe}` : ''}</td>
                    <td className="px-4 py-2 text-sm text-gray-300">{(log.load * log.reps).toFixed(1)}</td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => handleDelete(log.id)}
                        className="text-sm text-red-400 hover:text-red-200"
                      >
                        {t('performance.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PerformanceTracker;
