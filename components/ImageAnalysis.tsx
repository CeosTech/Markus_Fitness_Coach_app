import React, { useState, useEffect } from 'react';
import { analyzeImage } from '../services/geminiService';
import Loader from './shared/Loader';
import { fileToBase64 } from '../utils/file';
import { User } from '../types';
import UpgradeNotice from './shared/UpgradeNotice';
import { useTranslation } from '../i18n/LanguageContext';
import { useCMS } from '../contexts/CMSContext';

interface ImageAnalysisProps {
  currentUser: User;
}

const DEFAULT_FREE_IMAGE_LIMIT = 10;

const ImageAnalysis: React.FC<ImageAnalysisProps> = ({ currentUser }) => {
  const { t, language } = useTranslation();
  const { getValue } = useCMS();
  const freeTierLimit = Number(getValue('limits.freeImageMonthly', DEFAULT_FREE_IMAGE_LIMIT)) || DEFAULT_FREE_IMAGE_LIMIT;
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageBase64, setImageBase64] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState('');
  const [error, setError] = useState('');
  const [notification, setNotification] = useState('');
  const [usageCount, setUsageCount] = useState(0);

  useEffect(() => {
    if (currentUser.subscriptionTier === 'free') {
      fetch('/api/analysis/stats')
        .then(res => res.json())
        .then(data => setUsageCount(data.image || 0))
        .catch(err => console.error("Could not fetch usage stats", err));
    }
  }, [currentUser.subscriptionTier]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setAnalysis('');
      setError('');
      setNotification('');
      try {
        const base64 = await fileToBase64(file);
        setImageBase64(base64);
      } catch (err) {
        setError(t('imageAnalysis.errorReadFile'));
        setImageBase64('');
      }
    }
  };

  const saveAnalysis = async (result: string) => {
    try {
        await fetch('/api/analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'image',
                prompt: prompt,
                result: result,
                imageBase64: imageBase64,
            })
        });
        setNotification(t('imageAnalysis.analysisSaved'));
        if (currentUser.subscriptionTier === 'free') {
          setUsageCount(prev => prev + 1);
        }
        setTimeout(() => setNotification(''), 3000);
    } catch (err) {
        console.error("Failed to save analysis:", err);
        setNotification(t('imageAnalysis.analysisSaveFailed'));
         setTimeout(() => setNotification(''), 3000);
    }
  };

  const handleAnalyze = async () => {
    if (!imageBase64 || !prompt) {
      setError(t('imageAnalysis.errorUploadAndAsk'));
      return;
    }

    setIsLoading(true);
    setAnalysis('');
    setError('');
    setNotification('');

    try {
      const result = await analyzeImage(imageBase64, prompt, language);
      setAnalysis(result);
      await saveAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const isUsageLimitReached = currentUser.subscriptionTier === 'free' && usageCount >= freeTierLimit;

  if (isUsageLimitReached) {
    return <UpgradeNotice 
        featureName={t('sidebar.imageAnalysis')} 
      message={t('imageAnalysis.freeTierUsage', { count: usageCount, limit: freeTierLimit })}
    />;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-white">{t('imageAnalysis.title')}</h2>
      {currentUser.subscriptionTier === 'free' && (
        <div className="bg-blue-900/50 border border-blue-700 text-blue-200 text-center p-2 rounded-lg text-sm">
          {t('imageAnalysis.freeTierUsage', { count: usageCount, limit: freeTierLimit })}
        </div>
      )}
       {notification && <div className="bg-green-600/50 border border-green-500 text-white text-center p-2 rounded-lg">{notification}</div>}
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg space-y-4">
        <div>
          <label htmlFor="image-upload" className="block text-sm font-medium text-gray-300 mb-2">
            {t('imageAnalysis.uploadLabel')}
          </label>
          <input
            id="image-upload"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-500 file:text-white hover:file:bg-indigo-600"
          />
        </div>

        {imageBase64 && (
          <div className="flex flex-col md:flex-row gap-4 items-start">
            <img src={`data:${imageFile?.type};base64,${imageBase64}`} alt="Preview" className="w-full md:w-1/3 rounded-lg object-contain" />
            <div className="flex-1 space-y-4">
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={t('imageAnalysis.promptPlaceholder')}
                    rows={4}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-4 py-2 text-white placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button
                    onClick={handleAnalyze}
                    disabled={isLoading}
                    className="w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 disabled:bg-gray-500 transition-colors"
                >
                    {t('imageAnalysis.analyzeButton')}
                </button>
            </div>
          </div>
        )}
      </div>

      {(isLoading || error || analysis) && (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          {isLoading && <div className="flex flex-col items-center"><Loader /><p className="mt-2 text-indigo-300">{t('imageAnalysis.analyzingImage')}</p></div>}
          {error && !isLoading && <p className="text-red-400">{error}</p>}
          {analysis && (
            <div>
              <h3 className="text-xl font-semibold mb-3 text-indigo-300">{t('imageAnalysis.analysisResultHeader')}</h3>
              <pre className="whitespace-pre-wrap bg-gray-900 p-4 rounded-md text-gray-300 font-mono text-sm">{analysis}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ImageAnalysis;
