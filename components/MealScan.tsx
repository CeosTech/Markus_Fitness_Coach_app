import React, { useEffect, useState } from 'react';
import { User, MealScanRecord } from '../types';
import { fileToBase64 } from '../utils/file';
import Loader from './shared/Loader';
import UpgradeNotice from './shared/UpgradeNotice';
import { useTranslation } from '../i18n/LanguageContext';

interface MealScanProps {
  currentUser: User;
}

interface ScanStats {
  used: number;
  limit: number | null;
}

const MealScan: React.FC<MealScanProps> = ({ currentUser }) => {
  const { t, language } = useTranslation();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageBase64, setImageBase64] = useState('');
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState<MealScanRecord | null>(null);
  const [history, setHistory] = useState<MealScanRecord[]>([]);
  const [stats, setStats] = useState<ScanStats>({ used: 0, limit: null });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const tier = currentUser.subscriptionTier;
  const isLocked = tier === 'free';

  useEffect(() => {
    if (!isLocked) {
      refreshStats();
      refreshHistory();
    }
  }, [isLocked]);

  const refreshStats = async () => {
    try {
      const res = await fetch('/api/meal-scans/stats');
      if (!res.ok) throw new Error('Failed to load stats');
      const data = await res.json();
      setStats({ used: data.used || 0, limit: typeof data.limit === 'number' ? data.limit : null });
    } catch (err) {
      console.error(err);
    }
  };

  const refreshHistory = async () => {
    setIsHistoryLoading(true);
    try {
      const res = await fetch('/api/meal-scans?limit=5');
      if (!res.ok) throw new Error('Failed to load history');
      const data = await res.json();
      setHistory(data.scans || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setSuccess('');
    setResult(null);
    try {
      const base64 = await fileToBase64(file);
      setImageFile(file);
      setImageBase64(base64);
    } catch (err) {
      console.error(err);
      setError(t('mealScan.errorReading'));
    }
  };

  const resetForm = () => {
    setImageFile(null);
    setImageBase64('');
    setNotes('');
    setResult(null);
    setError('');
  };

  const handleScan = async () => {
    if (!imageBase64) {
      setError(t('mealScan.errorNoImage'));
      return;
    }
    if (stats.limit !== null && stats.used >= stats.limit) {
      setError(t('mealScan.limitReached'));
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/meal-scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          notes,
          language
        })
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || 'Scan failed');
      }
      const data = await res.json();
      const scan: MealScanRecord = data.scan;
      setResult(scan);
      setSuccess(t('mealScan.scanComplete'));
      setHistory((prev) => [scan, ...prev].slice(0, 5));
      setStats((prev) => ({ ...prev, used: prev.used + 1 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mealScan.errorGeneral'));
    } finally {
      setIsLoading(false);
    }
  };

  if (isLocked) {
    return (
      <UpgradeNotice
        featureName={t('mealScan.title')}
        message={t('mealScan.upgradeMessage')}
      />
    );
  }

  const limitInfo =
    stats.limit !== null
      ? t('mealScan.limitLabel', { used: stats.used, limit: stats.limit })
      : null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold text-white">{t('mealScan.title')}</h2>
        <p className="text-gray-400">{t('mealScan.subtitle')}</p>
      </div>

      {limitInfo && (
        <div className="bg-indigo-900/40 border border-indigo-600 text-indigo-100 px-4 py-3 rounded-lg text-sm">
          {limitInfo}
        </div>
      )}

      {error && <p className="text-red-400">{error}</p>}
      {success && <p className="text-emerald-400">{success}</p>}

      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">{t('mealScan.uploadLabel')}</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-500 file:text-white hover:file:bg-indigo-600"
          />
        </div>

        {imageFile && (
          <div className="flex flex-col lg:flex-row gap-4">
            <img
              src={`data:${imageFile.type};base64,${imageBase64}`}
              alt="Meal preview"
              className="rounded-lg w-full lg:w-1/3 object-cover border border-gray-700"
            />
            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">{t('mealScan.notesLabel')}</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder={t('mealScan.notesPlaceholder')}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md px-4 py-2 text-white placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleScan}
                  disabled={isLoading}
                  className="flex-1 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 disabled:bg-gray-500 transition-colors"
                >
                  {isLoading ? t('mealScan.scanning') : t('mealScan.scanButton')}
                </button>
                <button
                  onClick={resetForm}
                  className="px-6 py-3 bg-gray-700 text-white font-semibold rounded-md hover:bg-gray-600 transition-colors"
                >
                  {t('mealScan.resetButton')}
                </button>
              </div>
            </div>
          </div>
        )}
        <p className="text-xs text-gray-400">{t('mealScan.disclaimer')}</p>
      </div>

      {(isLoading || result) && (
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          {isLoading && (
            <div className="flex flex-col items-center">
              <Loader />
              <p className="mt-2 text-indigo-300">{t('mealScan.scanning')}</p>
            </div>
          )}
          {!isLoading && result && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="text-sm text-gray-400">{t('mealScan.confidenceLabel')}</p>
                  <p className="text-xl font-semibold text-white capitalize">{result.confidence}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400">{t('mealScan.totalCaloriesLabel')}</p>
                  <p className="text-2xl font-bold text-white">{result.totalCalories} kcal</p>
                  {result.caloriesRange && (
                    <p className="text-xs text-gray-400">
                      {t('mealScan.calorieRangeLabel', { min: result.caloriesRange.min, max: result.caloriesRange.max })}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                  <p className="text-sm text-gray-400">{t('mealScan.macros.protein')}</p>
                  <p className="text-2xl font-semibold text-white">{result.macros.proteinGrams}g</p>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                  <p className="text-sm text-gray-400">{t('mealScan.macros.carbs')}</p>
                  <p className="text-2xl font-semibold text-white">{result.macros.carbsGrams}g</p>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                  <p className="text-sm text-gray-400">{t('mealScan.macros.fats')}</p>
                  <p className="text-2xl font-semibold text-white">{result.macros.fatGrams}g</p>
                </div>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-white">{t('mealScan.ingredientsTitle')}</h4>
                <div className="mt-2 space-y-2">
                  {result.ingredients.map((ingredient, idx) => (
                    <div key={`${ingredient.name}-${idx}`} className="bg-gray-900 border border-gray-700 rounded-lg p-3">
                      <p className="text-white font-medium">{ingredient.name}</p>
                      <p className="text-sm text-gray-400">{ingredient.estimatedPortion}</p>
                      {ingredient.macroRole && <p className="text-xs text-indigo-300 mt-1">{ingredient.macroRole}</p>}
                    </div>
                  ))}
                </div>
              </div>

              {result.recommendations && (
                <div>
                  <h4 className="text-lg font-semibold text-white">{t('mealScan.recommendationsTitle')}</h4>
                  <p className="text-gray-300">{result.recommendations}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">{t('mealScan.historyTitle')}</h3>
          {isHistoryLoading && <span className="text-sm text-gray-400">{t('common.loading')}</span>}
        </div>
        {!history.length && !isHistoryLoading && (
          <p className="text-gray-400">{t('mealScan.historyEmpty')}</p>
        )}
        <div className="space-y-4">
          {history.map((scan) => (
            <div key={scan.id} className="bg-gray-900 border border-gray-700 rounded-lg p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <p className="text-sm text-gray-400">{new Date(scan.createdAt).toLocaleString()}</p>
                  <p className="text-lg font-semibold text-white">{scan.totalCalories} kcal</p>
                </div>
                {scan.userNotes && <p className="text-sm text-gray-300">{t('mealScan.userNotes', { notes: scan.userNotes })}</p>}
              </div>
              <div className="mt-2 text-sm text-gray-400">
                {t('mealScan.historySummary', {
                  protein: scan.macros.proteinGrams,
                  carbs: scan.macros.carbsGrams,
                  fat: scan.macros.fatGrams
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MealScan;
