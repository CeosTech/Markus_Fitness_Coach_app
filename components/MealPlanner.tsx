import React, { useEffect, useRef, useState } from 'react';
import jsPDF from 'jspdf';
import { User, MealPlan, SavedMealPlan } from '../types';
import Loader from './shared/Loader';
import { useTranslation } from '../i18n/LanguageContext';
import { generateMealPlan } from '../services/geminiService';
import {
  buildOptimizedList,
  formatQuantity,
  OptimizedItem
} from '../utils/shoppingOptimizer';

interface MealPlannerProps {
  currentUser: User;
}

interface ShareInfo {
  url: string;
  expiresAt: string;
}

const goalOptions = [
  { value: 'balanced', labelKey: 'mealPlanner.goalOptions.balanced', prompt: 'Balanced nutrition for sustainable energy, muscle recovery, and daily performance.' },
  { value: 'femaleCut', labelKey: 'mealPlanner.goalOptions.weightLossFemale', prompt: 'Female-focused fat loss with hormone support, iron-rich foods, and anti-inflammatory ingredients.' },
  { value: 'maleCut', labelKey: 'mealPlanner.goalOptions.weightLossMale', prompt: 'Male fat-loss programming with high satiety meals and lean protein focus.' },
  { value: 'femaleLean', labelKey: 'mealPlanner.goalOptions.leanMuscleFemale', prompt: 'Female lean muscle building with glute-focused fuel, cycle-aware carbs, and recovery support.' },
  { value: 'maleLean', labelKey: 'mealPlanner.goalOptions.leanMuscleMale', prompt: 'Male lean muscle gain with progressive calories, creatine-friendly meals, and hormone-friendly fats.' },
  { value: 'hormone', labelKey: 'mealPlanner.goalOptions.hormoneSupport', prompt: 'Hormone support with blood-sugar balance, stress-reducing micronutrients, and anti-inflammatory foods.' },
  { value: 'endurance', labelKey: 'mealPlanner.goalOptions.endurance', prompt: 'Endurance-focused fueling with steady carbs, electrolytes, and gut-friendly snacks.' },
  { value: 'postpartum', labelKey: 'mealPlanner.goalOptions.postpartum', prompt: 'Postpartum recovery with high-protein meals, collagen support, and lactation-friendly ingredients.' },
  { value: 'vegan', labelKey: 'mealPlanner.goalOptions.veganPerformance', prompt: 'Vegan performance nutrition with complete amino acids, B12 sources, and iron-conscious pairing.' },
  { value: 'glutenFree', labelKey: 'mealPlanner.goalOptions.glutenFree', prompt: 'Gluten-free lifestyle with gut-friendly grains, fiber diversity, and mineral-rich produce.' }
];

const dietStyleOptions = [
  { value: 'Omnivore', labelKey: 'mealPlanner.dietStyles.omnivore' },
  { value: 'Mediterranean', labelKey: 'mealPlanner.dietStyles.mediterranean' },
  { value: 'Pescatarian', labelKey: 'mealPlanner.dietStyles.pescatarian' },
  { value: 'Vegetarian', labelKey: 'mealPlanner.dietStyles.vegetarian' },
  { value: 'Vegan', labelKey: 'mealPlanner.dietStyles.vegan' },
  { value: 'Paleo', labelKey: 'mealPlanner.dietStyles.paleo' }
];

const mealFrequencyOptions = [3, 4, 5, 6];

const prepModeOptions = [
  { value: 'express' as const, label: 'Mode express (<15 min)' },
  { value: 'batch' as const, label: 'Batch cooking (2-3 prépas/semaine)' }
];

const MealPlanner: React.FC<MealPlannerProps> = ({ currentUser }) => {
  const { t, language } = useTranslation();
  const [goal, setGoal] = useState(goalOptions[0].value);
  const [calories, setCalories] = useState(2000);
  const [mealFrequency, setMealFrequency] = useState(4);
  const [dietStyle, setDietStyle] = useState(dietStyleOptions[0].value);
  const [allergies, setAllergies] = useState('');
  const [preferences, setPreferences] = useState('');
  const [prepMode, setPrepMode] = useState<'express' | 'batch'>('express');
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedPlans, setSavedPlans] = useState<SavedMealPlan[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [shareInfo, setShareInfo] = useState<Record<number, ShareInfo>>({});
  const [shareLoadingId, setShareLoadingId] = useState<number | null>(null);
  const [copiedPlanId, setCopiedPlanId] = useState<number | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [activePlanId, setActivePlanId] = useState<number | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);
  const [editPlanName, setEditPlanName] = useState('');
  const [renamingPlanId, setRenamingPlanId] = useState<number | null>(null);
  const [optimizedItems, setOptimizedItems] = useState<OptimizedItem[] | null>(null);
  const [budgetEstimate, setBudgetEstimate] = useState<number | null>(null);
  const [optimizeError, setOptimizeError] = useState('');
  const isCaloriesValid = Number.isFinite(calories) && calories >= 1200 && calories <= 4000;
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchSavedPlans(controller.signal);
    return () => controller.abort();
  }, [currentUser.id]);

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(''), 2500);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const fetchSavedPlans = async (signal?: AbortSignal) => {
    if (!isMountedRef.current) return;
    setLoadingSaved(true);
    setLoadError('');
    try {
      const response = await fetch('/api/meal-plans', { signal });
      if (!response.ok) throw new Error(t('mealPlanner.errorLoading'));
      const data: SavedMealPlan[] = await response.json();
      if (signal?.aborted || !isMountedRef.current) return;
      setSavedPlans(data);
    } catch (err) {
      if (signal?.aborted) return;
      console.error(err);
      if (!isMountedRef.current) return;
      setLoadError(err instanceof Error ? err.message : t('mealPlanner.errorLoading'));
    } finally {
      if (signal?.aborted || !isMountedRef.current) return;
      setLoadingSaved(false);
    }
  };

  const handleGenerate = async () => {
    if (!isCaloriesValid) {
      setError(t('mealPlanner.errorCaloriesRange'));
      setSuccessMessage('');
      return;
    }
    setIsLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      const allergyList = allergies.split(',').map(a => a.trim()).filter(Boolean);
      const selectedGoal = goalOptions.find(option => option.value === goal) ?? goalOptions[0];
      const selectedDietStyle = dietStyleOptions.find(option => option.value === dietStyle) ?? dietStyleOptions[0];
      const mealPlan = await generateMealPlan({
        goal: selectedGoal.prompt,
        calories: Math.max(1200, Math.min(4000, calories)),
        mealFrequency,
        dietStyle: selectedDietStyle.value,
        allergies: allergyList,
        preferences,
        language,
        sex: currentUser.sex || 'male',
        prepMode
      });
      if (!isMountedRef.current) return;
      setPlan(mealPlan);
      setSuccessMessage('');
      setEditingPlanId(null);
      setEditPlanName('');
      setOptimizedItems(null);
      setBudgetEstimate(null);
      setOptimizeError('');
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : t('mealPlanner.errorGenerating'));
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handleSavePlan = async () => {
    if (!plan) return;
    setIsSavingPlan(true);
    setError('');
    const isUpdating = Boolean(activePlanId);
    try {
      const response = await fetch(isUpdating ? `/api/meal-plans/${activePlanId}` : '/api/meal-plans', {
        method: isUpdating ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planName: plan.planName, planData: plan })
      });
      if (!response.ok) throw new Error(isUpdating ? t('mealPlanner.errorUpdating') : t('mealPlanner.errorSaving'));
      if (isUpdating) {
        await response.json().catch(() => ({}));
      } else {
        const data = await response.json();
        if (isMountedRef.current) {
          setActivePlanId(data.id ?? null);
        }
      }
      await fetchSavedPlans();
      if (isMountedRef.current) {
        setSuccessMessage(isUpdating ? t('mealPlanner.planUpdated') : t('mealPlanner.planSaved'));
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : isUpdating ? t('mealPlanner.errorUpdating') : t('mealPlanner.errorSaving'));
      }
    } finally {
      if (isMountedRef.current) {
        setIsSavingPlan(false);
      }
    }
  };

  const handleLoadSavedPlan = (savedPlan: SavedMealPlan) => {
    const { id, createdAt, ...rest } = savedPlan;
    setPlan(rest);
    setActivePlanId(id);
    setEditingPlanId(null);
    setEditPlanName('');
    setError('');
    setOptimizedItems(null);
    setBudgetEstimate(null);
    setOptimizeError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeletePlan = async (planId: number) => {
    try {
      const response = await fetch(`/api/meal-plans/${planId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(t('mealPlanner.errorDeleting'));
      if (!isMountedRef.current) return;
      setShareInfo(prev => {
        const clone = { ...prev };
        delete clone[planId];
        return clone;
      });
      await fetchSavedPlans();
      if (!isMountedRef.current) return;
      if (activePlanId === planId) {
        setActivePlanId(null);
        setPlan(null);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : t('mealPlanner.errorDeleting'));
      }
    }
  };

  const handleSharePlan = async (planId: number) => {
    setShareLoadingId(planId);
    setError('');
    try {
      const response = await fetch(`/api/meal-plans/${planId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error(t('mealPlanner.errorSharing'));
      const data = await response.json();
      if (!isMountedRef.current) return;
      setShareInfo(prev => ({ ...prev, [planId]: { url: data.shareUrl, expiresAt: data.expiresAt } }));
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : t('mealPlanner.errorSharing'));
      }
    } finally {
      if (isMountedRef.current) {
        setShareLoadingId(null);
      }
    }
  };

  const copyShareLink = async (planId: number) => {
    const info = shareInfo[planId];
    if (!info) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(info.url);
        setCopiedPlanId(planId);
        setTimeout(() => setCopiedPlanId(null), 2000);
        return;
      }
      throw new Error('Clipboard API not available');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = info.url;
      textarea.style.position = 'fixed';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        document.execCommand('copy');
        setCopiedPlanId(planId);
        setTimeout(() => setCopiedPlanId(null), 2000);
      } finally {
        document.body.removeChild(textarea);
      }
    }
  };

  const startRenamePlan = (plan: SavedMealPlan) => {
    setEditingPlanId(plan.id);
    setEditPlanName(plan.planName);
  };

  const cancelRenamePlan = () => {
    setEditingPlanId(null);
    setEditPlanName('');
  };

  const submitRenamePlan = async (planId: number) => {
    if (!editPlanName.trim()) return;
    setRenamingPlanId(planId);
    setError('');
    try {
      const response = await fetch(`/api/meal-plans/${planId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planName: editPlanName.trim() })
      });
      if (!response.ok) throw new Error(t('mealPlanner.errorUpdating'));
      await fetchSavedPlans();
      if (!isMountedRef.current) return;
      if (planId === activePlanId && plan) {
        setPlan(prev => (prev ? { ...prev, planName: editPlanName.trim() } : prev));
      }
      cancelRenamePlan();
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : t('mealPlanner.errorUpdating'));
      }
    } finally {
      if (isMountedRef.current) {
        setRenamingPlanId(null);
      }
    }
  };

  const handleDownloadPdf = () => {
    if (!plan) return;
    setPdfGenerating(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 20;

      const writeLines = (text: string, options: { bold?: boolean; size?: number } = {}) => {
        if (options.size) doc.setFontSize(options.size);
        const fontStyle = options.bold ? 'bold' : 'normal';
        doc.setFont('helvetica', fontStyle);
        const lines = doc.splitTextToSize(text, pageWidth - 24);
        lines.forEach(line => {
          if (y > 280) {
            doc.addPage();
            y = 20;
          }
          doc.text(line, 12, y);
          y += 7;
        });
        y += 3;
      };

      writeLines(plan.planName, { bold: true, size: 18 });
      writeLines(t('mealPlanner.planSummary', { calories: plan.caloriesPerDay, meals: plan.mealFrequency }), { size: 12 });

      plan.days.forEach(day => {
        writeLines(day.day, { bold: true, size: 14 });
        if (day.summary) writeLines(day.summary, { size: 11 });
        day.meals.forEach(meal => {
          writeLines(`${meal.name} • ${meal.calories} kcal`, { bold: true, size: 12 });
          writeLines(meal.description, { size: 11 });
          if (meal.macros) writeLines(meal.macros, { size: 10 });
          if (meal.recipeTips) writeLines(meal.recipeTips, { size: 10 });
        });
        y += 4;
      });

      const shoppingList = plan.shoppingList?.length ? plan.shoppingList : plan.groceryTips;
      if (shoppingList && shoppingList.length) {
        writeLines(t('mealPlanner.shoppingListTitle'), { bold: true, size: 14 });
        shoppingList.forEach(item => writeLines(`• ${item}`, { size: 11 }));
      }

      doc.save(`${plan.planName.replace(/\s+/g, '_')}.pdf`);
    } finally {
      setPdfGenerating(false);
    }
  };

  const getShoppingList = () => {
    if (!plan) return [];
    if (plan.shoppingList && plan.shoppingList.length) return plan.shoppingList;
    if (plan.groceryTips && plan.groceryTips.length) return plan.groceryTips;
    return [];
  };

  const handleOptimizeShopping = () => {
    const list = getShoppingList();
    if (!list.length) {
      setOptimizeError(t('mealPlanner.optimizeNoList'));
      setOptimizedItems(null);
      setBudgetEstimate(null);
      return;
    }
    try {
      const { aggregated, totalCost } = buildOptimizedList(list);
      setOptimizedItems(aggregated);
      setBudgetEstimate(Number(totalCost.toFixed(2)));
      setOptimizeError('');
    } catch (err) {
      console.error(err);
      setOptimizedItems(null);
      setBudgetEstimate(null);
      setOptimizeError(t('mealPlanner.optimizeError'));
    }
  };

  const exportOptimizedList = (format: 'json' | 'csv') => {
    if (!optimizedItems || !optimizedItems.length) return;
    const payload = optimizedItems.map(item => ({
      name: item.name,
      category: item.category,
      quantity: Number(item.quantity.toFixed(2)),
      unit: item.unit ?? 'unit',
      estimatedCost: Number(item.estimatedCost.toFixed(2)),
      suggestions: item.suggestions
    }));

    let blob: Blob;
    let filename = `shopping-optimized.${format}`;
    if (format === 'json') {
      blob = new Blob([JSON.stringify({ items: payload, budget: budgetEstimate ?? undefined }, null, 2)], { type: 'application/json' });
    } else {
      const escapeCsv = (value: string | number) => {
        const stringValue = String(value ?? '');
        const escaped = stringValue.replace(/"/g, '""');
        return `"${escaped}"`;
      };
      const header = 'name,category,quantity,unit,estimatedCost,suggestions';
      const rows = payload.map(row => {
        const values = [
          row.name,
          row.category,
          row.quantity,
          row.unit,
          row.estimatedCost,
          row.suggestions.join('; ')
        ];
        return values.map(escapeCsv).join(',');
      });
      blob = new Blob([`${header}\n${rows.join('\n')}`], { type: 'text/csv' });
      filename = 'shopping-optimized.csv';
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const shoppingDataAvailable = getShoppingList().length > 0;
  const shoppingListItems = getShoppingList();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold text-white">{t('mealPlanner.title')}</h2>
        <p className="text-gray-400">{t('mealPlanner.subtitle')}</p>
      </div>

      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('mealPlanner.goalLabel')}</label>
            <select value={goal} onChange={(e) => setGoal(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-4 py-2 text-white focus:ring-indigo-500 focus:border-indigo-500">
              {goalOptions.map(option => <option key={option.value} value={option.value}>{t(option.labelKey)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('mealPlanner.caloriesLabel')}</label>
            <input
              type="number"
              min={1200}
              max={4000}
              value={calories}
              onChange={(e) => setCalories(Number(e.target.value))}
              className="w-full bg-gray-700 border border-gray-600 rounded-md px-4 py-2 text-white focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('mealPlanner.mealFrequencyLabel')}</label>
            <select value={mealFrequency} onChange={(e) => setMealFrequency(Number(e.target.value))} className="w-full bg-gray-700 border border-gray-600 rounded-md px-4 py-2 text-white focus:ring-indigo-500 focus:border-indigo-500">
              {mealFrequencyOptions.map(freq => <option key={freq} value={freq}>{t('mealPlanner.mealFrequencyOption', { count: freq })}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('mealPlanner.dietStyleLabel')}</label>
            <select value={dietStyle} onChange={(e) => setDietStyle(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-4 py-2 text-white focus:ring-indigo-500 focus:border-indigo-500">
              {dietStyleOptions.map(option => <option key={option.value} value={option.value}>{t(option.labelKey)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Mode de préparation</label>
            <select
              value={prepMode}
              onChange={(e) => setPrepMode(e.target.value as 'express' | 'batch')}
              className="w-full bg-gray-700 border border-gray-600 rounded-md px-4 py-2 text-white focus:ring-indigo-500 focus:border-indigo-500"
            >
              {prepModeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">{t('mealPlanner.allergiesLabel')}</label>
          <input
            type="text"
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
            placeholder={t('mealPlanner.allergiesPlaceholder')}
            className="w-full bg-gray-700 border border-gray-600 rounded-md px-4 py-2 text-white focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">{t('mealPlanner.preferencesLabel')}</label>
          <textarea
            value={preferences}
            onChange={(e) => setPreferences(e.target.value)}
            rows={4}
            placeholder={t('mealPlanner.preferencesPlaceholder')}
            className="w-full bg-gray-700 border border-gray-600 rounded-md px-4 py-2 text-white focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={handleGenerate}
            disabled={isLoading || !isCaloriesValid}
            className="flex-1 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 disabled:bg-gray-500 transition-colors"
          >
            {isLoading ? t('mealPlanner.loadingButton') : t('mealPlanner.generateButton')}
          </button>
          {plan && (
            <button
              onClick={handleSavePlan}
              disabled={isSavingPlan}
              className="flex-1 px-6 py-3 bg-emerald-600 text-white font-semibold rounded-md hover:bg-emerald-700 disabled:bg-gray-500 transition-colors"
            >
              {isSavingPlan
                ? activePlanId
                  ? t('mealPlanner.updatingButton')
                  : t('mealPlanner.savingButton')
                : activePlanId
                ? t('mealPlanner.updateButton')
                : t('mealPlanner.saveButton')}
            </button>
          )}
          {plan && (
            <button
              onClick={handleDownloadPdf}
              disabled={pdfGenerating}
              className="flex-1 px-6 py-3 bg-gray-700 text-white font-semibold rounded-md hover:bg-gray-600 disabled:bg-gray-500 transition-colors"
            >
              {pdfGenerating ? t('mealPlanner.pdfGenerating') : t('mealPlanner.downloadPdf')}
            </button>
          )}
        </div>
        {successMessage && <p className="text-sm text-emerald-300">{successMessage}</p>}
      </div>

      {(isLoading || error || plan) && (
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          {isLoading && (
            <div className="flex flex-col items-center"><Loader /><p className="mt-2 text-indigo-300">{t('mealPlanner.loadingMessage')}</p></div>
          )}
          {error && !isLoading && <p className="text-red-400">{error}</p>}
          {plan && !isLoading && (
            <div className="space-y-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-white">{plan.planName}</h3>
                  <p className="text-gray-400">{t('mealPlanner.planSummary', { calories: plan.caloriesPerDay, meals: plan.mealFrequency })}</p>
                </div>
                {plan.groceryTips && plan.groceryTips.length > 0 && (
                  <div className="mt-3 md:mt-0">
                    <p className="text-xs uppercase text-gray-400 tracking-wide">{t('mealPlanner.groceryTips')}</p>
                    <ul className="text-sm text-gray-300 list-disc list-inside">
                      {plan.groceryTips.map(tip => <li key={tip}>{tip}</li>)}
                    </ul>
                  </div>
                )}
              </div>
              {shoppingDataAvailable && (
                <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 space-y-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <h4 className="text-lg font-semibold text-white">{t('mealPlanner.shoppingListTitle')}</h4>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={handleOptimizeShopping}
                        className="px-3 py-2 text-sm rounded-md bg-amber-500 text-white hover:bg-amber-600"
                      >
                        Optimiser le panier
                      </button>
                      {optimizedItems && optimizedItems.length > 0 && (
                        <>
                          <button
                            onClick={() => exportOptimizedList('json')}
                            className="px-3 py-2 text-sm rounded-md bg-gray-700 text-white hover:bg-gray-600"
                          >
                            Export JSON
                          </button>
                          <button
                            onClick={() => exportOptimizedList('csv')}
                            className="px-3 py-2 text-sm rounded-md bg-gray-700 text-white hover:bg-gray-600"
                          >
                            Export CSV
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <ul className="space-y-1 list-disc list-inside text-gray-200">
                    {shoppingListItems.map((item, idx) => (
                      <li key={`${item}-${idx}`}>{item}</li>
                    ))}
                  </ul>
                  {optimizeError && <p className="text-sm text-red-400">{optimizeError}</p>}
                  {budgetEstimate !== null && (
                    <p className="text-sm text-emerald-300">Budget estimé : ~{budgetEstimate.toFixed(2)} €</p>
                  )}
                  {optimizedItems && optimizedItems.length > 0 && (
                    <div className="space-y-2">
                      {Array.from(
                        optimizedItems.reduce((acc, item) => {
                          if (!acc.has(item.category)) acc.set(item.category, []);
                          acc.get(item.category)!.push(item);
                          return acc;
                        }, new Map<string, OptimizedItem[]>())
                      ).map(([category, items]) => (
                        <div key={category} className="rounded-md border border-gray-700 p-3 bg-gray-800/60">
                          <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">{category}</p>
                          <div className="space-y-1">
                            {items.map(item => (
                              <div key={item.name} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                <span className="text-sm text-white">
                                  {item.name} — {formatQuantity(item.quantity, item.unit)}
                                </span>
                                <span className="text-xs text-gray-300">~{item.estimatedCost.toFixed(2)} €</span>
                              </div>
                            ))}
                          </div>
                          {items.some(i => i.suggestions.length) && (
                            <p className="text-xs text-amber-200 mt-2">
                              Suggestions: {Array.from(new Set(items.flatMap(i => i.suggestions))).join(' · ')}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {plan.days.map(day => (
                <div key={day.day} className="bg-gray-900 rounded-lg border border-gray-700 p-4">
                  <h4 className="text-lg font-semibold text-indigo-300">{day.day}</h4>
                  {day.summary && <p className="text-sm text-gray-400 mb-3">{day.summary}</p>}
                  <div className="space-y-3">
                    {day.meals.map((meal, idx) => (
                      <div key={`${day.day}-${idx}`} className="bg-gray-800/60 rounded-md border border-gray-700 p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-white font-medium">{meal.name}</p>
                          <span className="text-xs text-gray-400">{meal.calories} kcal</span>
                        </div>
                        <p className="text-sm text-gray-300 mt-1">{meal.description}</p>
                        {meal.macros && <p className="text-xs text-gray-400 mt-1">{meal.macros}</p>}
                        {meal.recipeTips && <p className="text-xs text-emerald-300 mt-1">{meal.recipeTips}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-semibold text-white">{t('mealPlanner.savedPlansTitle')}</h3>
          {loadingSaved && <span className="text-sm text-gray-400">{t('common.loading')}</span>}
        </div>
        {loadError && <p className="text-sm text-red-400 mb-2">{loadError}</p>}
        {savedPlans.length === 0 && !loadingSaved && !loadError && (
          <p className="text-gray-400">{t('mealPlanner.noSavedPlans')}</p>
        )}
        <div className="space-y-4">
          {savedPlans.map(savedPlan => (
            <div key={savedPlan.id} className="border border-gray-700 rounded-lg p-4 bg-gray-900/60">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex-1">
                  {editingPlanId === savedPlan.id ? (
                    <input
                      value={editPlanName}
                      onChange={(e) => setEditPlanName(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-white"
                    />
                  ) : (
                    <p className="text-white font-semibold">{savedPlan.planName}</p>
                  )}
                  <p className="text-sm text-gray-400">{t('mealPlanner.savedOn', { date: new Date(savedPlan.createdAt).toLocaleDateString() })}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {editingPlanId === savedPlan.id ? (
                    <>
                      <button
                        onClick={() => submitRenamePlan(savedPlan.id)}
                        disabled={renamingPlanId === savedPlan.id}
                        className="px-3 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-600"
                      >
                        {renamingPlanId === savedPlan.id ? t('mealPlanner.renaming') : t('common.save')}
                      </button>
                      <button
                        onClick={cancelRenamePlan}
                        className="px-3 py-2 text-sm rounded-md bg-gray-700 text-white hover:bg-gray-600"
                      >
                        {t('common.cancel')}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleLoadSavedPlan(savedPlan)}
                        className="px-3 py-2 text-sm rounded-md bg-gray-700 text-white hover:bg-gray-600"
                      >
                        {t('mealPlanner.loadButton')}
                      </button>
                      <button
                        onClick={() => handleSharePlan(savedPlan.id)}
                        disabled={shareLoadingId === savedPlan.id}
                        className="px-3 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-600"
                      >
                        {shareLoadingId === savedPlan.id ? t('mealPlanner.shareLoading') : t('mealPlanner.shareButton')}
                      </button>
                      <button
                        onClick={() => startRenamePlan(savedPlan)}
                        className="px-3 py-2 text-sm rounded-md bg-slate-600 text-white hover:bg-slate-500"
                      >
                        {t('common.rename')}
                      </button>
                      <button
                        onClick={() => handleDeletePlan(savedPlan.id)}
                        className="px-3 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700"
                      >
                        {t('mealPlanner.deleteButton')}
                      </button>
                    </>
                  )}
                </div>
              </div>
              {shareInfo[savedPlan.id] && (
                <div className="mt-3 space-y-2 rounded-md border border-indigo-500/40 bg-indigo-900/30 p-3">
                  <p className="text-sm text-indigo-200">{t('mealPlanner.shareLinkLabel')}</p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      readOnly
                      value={shareInfo[savedPlan.id].url}
                      className="flex-1 rounded-md border border-indigo-500/50 bg-transparent px-3 py-2 text-sm text-white"
                    />
                    <button
                      onClick={() => copyShareLink(savedPlan.id)}
                      className="px-3 py-2 text-sm rounded-md bg-white/90 text-indigo-900 font-semibold hover:bg-white"
                    >
                      {copiedPlanId === savedPlan.id ? t('mealPlanner.shareCopied') : t('mealPlanner.copyLink')}
                    </button>
                  </div>
                  <p className="text-xs text-indigo-200">{t('mealPlanner.shareExpires', { date: new Date(shareInfo[savedPlan.id].expiresAt).toLocaleDateString() })}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MealPlanner;
