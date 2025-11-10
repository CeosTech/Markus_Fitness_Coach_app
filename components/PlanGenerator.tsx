import React, { useState, useEffect } from 'react';
import { generateWorkoutPlan } from '../services/geminiService';
// FIX: Imported missing types WorkoutDay and Exercise.
import { WorkoutPlan, AnalysisRecord, User, WorkoutDay, Exercise } from '../types';
import Loader from './shared/Loader';
import UpgradeNotice from './shared/UpgradeNotice';
import { useTranslation } from '../i18n/LanguageContext';

interface PlanGeneratorProps {
    currentUser: User;
}

const PlanGenerator: React.FC<PlanGeneratorProps> = ({ currentUser }) => {
    const { t, language } = useTranslation();
    const [goal, setGoal] = useState('Muscle Gain');
    const [level, setLevel] = useState('Intermediate');
    const [equipment, setEquipment] = useState('Full Gym Access');
    const [useHistory, setUseHistory] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [plan, setPlan] = useState<WorkoutPlan | null>(null);
    const [analysisHistory, setAnalysisHistory] = useState<AnalysisRecord[] | null>(null);
    const [isPlanSaved, setIsPlanSaved] = useState(false);

    useEffect(() => {
        if(useHistory && !analysisHistory) {
            fetch('/api/analysis')
                .then(res => res.json())
                .then(data => setAnalysisHistory(data))
                .catch(() => setError(t('planGenerator.errorHistory')));
        }
    }, [useHistory, analysisHistory, t]);

    const handleGeneratePlan = async () => {
        setIsLoading(true);
        setError('');
        setPlan(null);
        setIsPlanSaved(false);
        try {
            const historyToUse = useHistory ? analysisHistory : undefined;
            const generatedPlan = await generateWorkoutPlan(goal, level, equipment, language, historyToUse ?? undefined);
            setPlan(generatedPlan);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('planGenerator.errorPlan'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleSavePlan = async () => {
        if (!plan) return;
        try {
            const response = await fetch('/api/plans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planName: plan.planName, planData: plan }),
            });
            if (!response.ok) throw new Error('Failed to save plan.');
            setIsPlanSaved(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred while saving.');
        }
    };

    const renderPlan = (p: WorkoutPlan) => (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg mt-6 animate-fadeIn">
            <div className="flex justify-between items-start mb-2">
                <div>
                    <h3 className="text-2xl font-bold text-indigo-300">{p.planName}</h3>
                    <p className="text-gray-400 mb-4">{t('planGenerator.planSubheader', { durationWeeks: p.durationWeeks, daysPerWeek: p.daysPerWeek })}</p>
                </div>
                <button
                    onClick={handleSavePlan}
                    disabled={isPlanSaved}
                    className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
                >
                    {isPlanSaved ? t('planGenerator.planSavedButton') : t('planGenerator.savePlanButton')}
                </button>
            </div>
            <div className="space-y-6">
                {p.planDetails.sort((a,b) => a.day - b.day).map((day: WorkoutDay) => (
                    <div key={day.day} className="bg-gray-900 p-4 rounded-md border border-gray-700">
                        <h4 className="font-semibold text-white text-lg">{t('common.day')} {day.day}: <span className="text-indigo-400">{day.focus}</span></h4>
                        {day.exercises.length > 0 ? (
                             <div className="mt-4 overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-700">
                                    <thead className="bg-gray-800">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">{t('planGenerator.tableExercise')}</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">{t('planGenerator.tableSets')}</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">{t('planGenerator.tableReps')}</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">{t('planGenerator.tableRest')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-gray-900 divide-y divide-gray-700">
                                        {day.exercises.map((ex: Exercise, i: number) => (
                                            <tr key={i}>
                                                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-white">{ex.name} {ex.notes && <span className="text-xs text-gray-400">({ex.notes})</span>}</td>
                                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300">{ex.sets}</td>
                                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300">{ex.reps}</td>
                                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300">{ex.rest}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="mt-3 text-gray-400">{t('planGenerator.restDay')}</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
    
    const FormSelect: React.FC<{ label: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; options: string[] }> = ({ label, value, onChange, options }) => (
        <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
            <select value={value} onChange={onChange} className="w-full bg-gray-700 border border-gray-600 rounded-md px-4 py-2 text-white focus:ring-indigo-500 focus:border-indigo-500">
                {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
        </div>
    );

    if (currentUser.subscriptionTier === 'free') {
        return <UpgradeNotice featureName={t('planGenerator.title')} />;
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-white">{t('planGenerator.title')}</h2>

            <div className="bg-gray-800 p-6 rounded-lg shadow-lg space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormSelect label={t('planGenerator.goalLabel')} value={goal} onChange={(e) => setGoal(e.target.value)} options={['Muscle Gain', 'Fat Loss', 'General Fitness', 'Strength Increase', 'Endurance']} />
                    <FormSelect label={t('planGenerator.levelLabel')} value={level} onChange={(e) => setLevel(e.target.value)} options={['Beginner', 'Intermediate', 'Advanced']} />
                    <FormSelect label={t('planGenerator.equipmentLabel')} value={equipment} onChange={(e) => setEquipment(e.target.value)} options={['Full Gym Access', 'Dumbbells Only', 'Bodyweight Only', 'Kettlebells & Bands']} />
                </div>
                <div className="flex items-center space-x-3 pt-2">
                    <input type="checkbox" id="use-history" checked={useHistory} onChange={(e) => setUseHistory(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <label htmlFor="use-history" className="text-sm font-medium text-gray-300">
                        {t('planGenerator.useHistoryLabel')}
                    </label>
                </div>
                 <button
                    onClick={handleGeneratePlan}
                    disabled={isLoading}
                    className="w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 disabled:bg-gray-500 transition-colors"
                >
                    {isLoading ? t('planGenerator.loadingButton') : t('planGenerator.generateButton')}
                </button>
            </div>

            {(isLoading || error || plan) && (
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                    {isLoading && <div className="flex flex-col items-center"><Loader /><p className="mt-2 text-indigo-300">{t('planGenerator.loadingMessage')}</p></div>}
                    {error && !isLoading && <p className="text-red-400">{error}</p>}
                    {plan && !isLoading && renderPlan(plan)}
                </div>
            )}
        </div>
    );
};

export default PlanGenerator;