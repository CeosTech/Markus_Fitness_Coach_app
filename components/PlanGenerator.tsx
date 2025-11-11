import React, { useState, useEffect } from 'react';
import { generateWorkoutPlan } from '../services/geminiService';
import jsPDF from 'jspdf';
import QRCode from 'react-qr-code';
// FIX: Imported missing types WorkoutDay and Exercise.
import { WorkoutPlan, AnalysisRecord, User, WorkoutDay, Exercise } from '../types';
import Loader from './shared/Loader';
import UpgradeNotice from './shared/UpgradeNotice';
import { useTranslation } from '../i18n/LanguageContext';

interface PlanGeneratorProps {
    currentUser: User;
}

interface ShareInfo {
    url: string;
    expiresAt: string;
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
    const [savedPlanId, setSavedPlanId] = useState<number | null>(null);
    const [pdfGenerating, setPdfGenerating] = useState(false);
    const [shareState, setShareState] = useState<ShareInfo | null>(null);
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [shareLoading, setShareLoading] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);

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
        setSavedPlanId(null);
        setShareState(null);
        setShareModalOpen(false);
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
            const data = await response.json();
            setIsPlanSaved(true);
            setSavedPlanId(data.id || null);
            setShareState(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred while saving.');
        }
    };

    const handleDownloadPdf = () => {
        if (!plan) return;
        setPdfGenerating(true);
        try {
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            let y = 25;

            const addLines = (text: string, options: { bold?: boolean; size?: number } = {}) => {
                if (options.size) doc.setFontSize(options.size);
                doc.setFont(undefined, options.bold ? 'bold' : 'normal');
                const lines = doc.splitTextToSize(text, pageWidth - 28);
                lines.forEach(line => {
                    if (y > 275) {
                        doc.addPage();
                        y = 20;
                    }
                    doc.text(line, 14, y);
                    y += 8;
                });
            };

            addLines(plan.planName, { bold: true, size: 18 });
            addLines(`${plan.durationWeeks} ${t('planGenerator.weeksLabel') ?? 'weeks'} • ${plan.daysPerWeek} ${t('planGenerator.daysPerWeekLabel') ?? 'days/week'}`, { size: 12 });
            y += 4;

            plan.planDetails
                .slice()
                .sort((a, b) => a.day - b.day)
                .forEach(day => {
                    addLines(`${t('common.day')} ${day.day} – ${day.focus}`, { bold: true, size: 13 });
                    if (!day.exercises.length) {
                        addLines(t('planGenerator.restDay'));
                        y += 2;
                        return;
                    }
                    day.exercises.forEach(ex => {
                        addLines(`${ex.name}${ex.notes ? ` (${ex.notes})` : ''}`);
                        addLines(`${t('planGenerator.tableSets')}: ${ex.sets} | ${t('planGenerator.tableReps')}: ${ex.reps} | ${t('planGenerator.tableRest')}: ${ex.rest}`);
                        y += 2;
                    });
                    y += 4;
                });

            const safeName = plan.planName.replace(/[^a-z0-9\-]+/gi, '-').toLowerCase();
            doc.save(`${safeName || 'workout-plan'}.pdf`);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('planGenerator.errorPlan'));
        } finally {
            setPdfGenerating(false);
        }
    };

    const handleSharePlan = async () => {
        if (!savedPlanId) {
            setError(t('planGenerator.saveBeforeShare'));
            return;
        }
        setShareLoading(true);
        setError('');
        try {
            const response = await fetch(`/api/plans/${savedPlanId}/share`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || t('planGenerator.shareError'));
            setShareState({ url: data.shareUrl, expiresAt: data.expiresAt });
            setShareModalOpen(true);
            setCopySuccess(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('planGenerator.shareError'));
        } finally {
            setShareLoading(false);
        }
    };

    const closeShareModal = () => {
        setShareModalOpen(false);
        setCopySuccess(false);
    };

    const handleCopyShareLink = async () => {
        if (!shareState?.url) return;
        try {
            await navigator.clipboard.writeText(shareState.url);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        } catch (err) {
            setCopySuccess(false);
        }
    };

    const renderPlan = (p: WorkoutPlan) => {
        const shareDisabled = !savedPlanId || shareLoading;
        return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg mt-6 animate-fadeIn">
            <div className="flex flex-col gap-2 mb-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div>
                        <h3 className="text-2xl font-bold text-indigo-300">{p.planName}</h3>
                        <p className="text-gray-400">{t('planGenerator.planSubheader', { durationWeeks: p.durationWeeks, daysPerWeek: p.daysPerWeek })}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={handleSavePlan}
                            disabled={isPlanSaved}
                            className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
                        >
                            {isPlanSaved ? t('planGenerator.planSavedButton') : t('planGenerator.savePlanButton')}
                        </button>
                        <button
                            onClick={handleDownloadPdf}
                            disabled={!plan || pdfGenerating}
                            className="px-4 py-2 text-sm font-semibold text-white bg-gray-700 rounded-md hover:bg-gray-600 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
                        >
                            {pdfGenerating ? t('planGenerator.pdfGenerating') : t('planGenerator.downloadPdf')}
                        </button>
                        <button
                            onClick={handleSharePlan}
                            disabled={shareDisabled}
                            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
                        >
                            {shareLoading ? t('planGenerator.shareLoading') : t('planGenerator.sharePlanButton')}
                        </button>
                    </div>
                </div>
                {!savedPlanId && (
                    <p className="text-xs text-gray-500">{t('planGenerator.shareHint')}</p>
                )}
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
    };
    
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

            {shareModalOpen && shareState && (
                <SharePlanModal
                    link={shareState.url}
                    expiresAt={shareState.expiresAt}
                    onClose={closeShareModal}
                    onCopy={handleCopyShareLink}
                    copySuccess={copySuccess}
                    t={t}
                />
            )}
        </div>
    );
};

interface SharePlanModalProps {
    link: string;
    expiresAt: string;
    onClose: () => void;
    onCopy: () => void;
    copySuccess: boolean;
    t: ReturnType<typeof useTranslation>['t'];
}

const SharePlanModal: React.FC<SharePlanModalProps> = ({ link, expiresAt, onClose, onCopy, copySuccess, t }) => {
    const formatted = new Date(expiresAt).toLocaleString();
    return (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
            <div className="bg-gray-900 w-full max-w-md rounded-2xl border border-gray-700 p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">{t('planGenerator.shareModalTitle')}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
                </div>
                <p className="text-sm text-gray-400">{t('planGenerator.shareModalDescription')}</p>
                <div className="flex justify-center py-4">
                    <div className="bg-white p-3 rounded-2xl">
                        <QRCode value={link} bgColor="#ffffff" fgColor="#0f172a" size={168} />
                    </div>
                </div>
                <div>
                    <p className="text-xs text-gray-500 mb-1">{t('planGenerator.shareModalExpires', { date: formatted })}</p>
                    <div className="flex items-center gap-2">
                        <input value={link} readOnly className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-xs text-white" />
                        <button onClick={onCopy} className="px-3 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
                            {copySuccess ? t('planGenerator.linkCopied') : t('planGenerator.copyLink')}
                        </button>
                    </div>
                </div>
                <div className="flex justify-end pt-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-300 border border-gray-600 rounded-md hover:bg-gray-800">
                        {t('planGenerator.closeModal')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PlanGenerator;
