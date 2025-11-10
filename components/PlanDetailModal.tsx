import React from 'react';
import { SavedWorkoutPlan, WorkoutDay, Exercise } from '../types';
import { useTranslation } from '../i18n/LanguageContext';

interface PlanDetailModalProps {
    plan: SavedWorkoutPlan;
    onClose: () => void;
}

const PlanDetailModal: React.FC<PlanDetailModalProps> = ({ plan, onClose }) => {
    const { t } = useTranslation();

    return (
        <div 
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div 
                className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-white">{plan.planName}</h3>
                        <p className="text-xs text-gray-400">{t('planGenerator.planSubheader', { durationWeeks: plan.durationWeeks, daysPerWeek: plan.daysPerWeek })}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
                </div>
                <div className="p-6 overflow-y-auto space-y-6">
                    {plan.planDetails.sort((a, b) => a.day - b.day).map((day: WorkoutDay) => (
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
        </div>
    );
};

export default PlanDetailModal;