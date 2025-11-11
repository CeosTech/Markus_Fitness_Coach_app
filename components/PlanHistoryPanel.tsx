import React, { useEffect, useState } from 'react';
import { SavedWorkoutPlan } from '../types';
import { useTranslation } from '../i18n/LanguageContext';
import PlanDetailModal from './PlanDetailModal';

interface PlanHistoryPanelProps {
  refreshToken: number;
  onPlanSelect: (plan: SavedWorkoutPlan) => void;
  onPlanDeleted?: (planId: number) => void;
  activePlanId?: number | null;
}

const PlanHistoryPanel: React.FC<PlanHistoryPanelProps> = ({ refreshToken, onPlanSelect, onPlanDeleted, activePlanId }) => {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<SavedWorkoutPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<SavedWorkoutPlan | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [renamingPlanId, setRenamingPlanId] = useState<number | null>(null);

  const fetchPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/plans');
      if (!res.ok) throw new Error('Failed');
      const data: SavedWorkoutPlan[] = await res.json();
      setPlans(data);
    } catch {
      setError(t('planHistory.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, [refreshToken, t]);

  const handleDelete = async (planId: number) => {
    try {
      const res = await fetch(`/api/plans/${planId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      await fetchPlans();
      onPlanDeleted?.(planId);
    } catch {
      setError(t('planHistory.errorDeleting'));
    }
  };

  const startRename = (plan: SavedWorkoutPlan) => {
    setEditingPlanId(plan.id);
    setEditName(plan.planName);
  };

  const cancelRename = () => {
    setEditingPlanId(null);
    setEditName('');
  };

  const submitRename = async (planId: number) => {
    if (!editName.trim()) return;
    setRenamingPlanId(planId);
    setError(null);
    try {
      const res = await fetch(`/api/plans/${planId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planName: editName.trim() })
      });
      if (!res.ok) throw new Error();
      await fetchPlans();
      cancelRename();
    } catch {
      setError(t('planHistory.errorRenaming'));
    } finally {
      setRenamingPlanId(null);
    }
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-semibold text-white">{t('planHistory.title')}</h3>
          <p className="text-sm text-gray-400">{t('planHistory.subtitle')}</p>
        </div>
        {loading && <span className="text-xs text-gray-400">{t('common.loading')}</span>}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!loading && plans.length === 0 && (
        <p className="text-gray-400">{t('planHistory.empty')}</p>
      )}
      <div className="space-y-4">
        {plans.map(plan => (
          <div key={plan.id} className={`border rounded-lg p-4 bg-gray-900/60 ${plan.id === activePlanId ? 'border-indigo-500/60' : 'border-gray-700'}`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                {editingPlanId === plan.id ? (
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-white"
                  />
                ) : (
                  <p className="text-white font-semibold">{plan.planName}</p>
                )}
                <p className="text-sm text-gray-400">{t('planHistory.savedOn', { date: new Date(plan.createdAt).toLocaleDateString() })}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {editingPlanId === plan.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => submitRename(plan.id)}
                      className="px-3 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-gray-600"
                      disabled={renamingPlanId === plan.id}
                    >
                      {renamingPlanId === plan.id ? t('planHistory.renaming') : t('common.save')}
                    </button>
                    <button
                      type="button"
                      onClick={cancelRename}
                      className="px-3 py-2 text-sm rounded-md bg-gray-700 text-white hover:bg-gray-600"
                    >
                      {t('common.cancel')}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onPlanSelect(plan)}
                      className="px-3 py-2 text-sm rounded-md bg-gray-700 text-white hover:bg-gray-600"
                    >
                      {t('planHistory.load')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPlan(plan)}
                      className="px-3 py-2 text-sm rounded-md bg-gray-700 text-white hover:bg-gray-600"
                    >
                      {t('planHistory.view')}
                    </button>
                    <button
                      type="button"
                      onClick={() => startRename(plan)}
                      className="px-3 py-2 text-sm rounded-md bg-slate-600 text-white hover:bg-slate-500"
                    >
                      {t('common.rename')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(plan.id)}
                      className="px-3 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-500"
                    >
                      {t('planHistory.delete')}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {selectedPlan && <PlanDetailModal plan={selectedPlan} onClose={() => setSelectedPlan(null)} />}
    </div>
  );
};

export default PlanHistoryPanel;
