
import React, { useState, useEffect, useMemo } from 'react';
import { User, AnalysisRecord, Goal, SavedWorkoutPlan } from '../types';
import Loader from './shared/Loader';
import { renderMarkdown } from '../utils/markdown';
import VideoIcon from './icons/VideoIcon';
import ImageIcon from './icons/ImageIcon';
import { useTranslation } from '../i18n/LanguageContext';
import PlanIcon from './icons/PlanIcon';
import PlanDetailModal from './PlanDetailModal';
import Replay3DModal from './Replay3DModal';
import GamificationPanel from './GamificationPanel';
import WeeklySummaryCard from './WeeklySummaryCard';

interface ProfilePageProps {
  currentUser: User;
  onProfileUpdate: (user: User) => void;
}

const StatCard: React.FC<{ title: string; value: string | number }> = ({ title, value }) => (
    <div className="bg-gray-800 p-4 rounded-lg shadow-md text-center">
        <p className="text-sm text-gray-400">{title}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
    </div>
);

const AnalysisDetailModal: React.FC<{ analysis: AnalysisRecord; onClose: () => void, onOpen3D: () => void }> = ({ analysis, onClose, onOpen3D }) => {
    const { t } = useTranslation();
    return (
        <div 
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div 
                className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">{t('profile.modalTitle')}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
                </div>
                <div className="p-6 overflow-y-auto">
                    {analysis.type === 'image' && analysis.imageBase64 && (
                        <img 
                            src={`data:image/jpeg;base64,${analysis.imageBase64}`} 
                            alt="Analyzed content" 
                            className="rounded-lg mb-4 w-full max-w-sm mx-auto"
                        />
                    )}
                    <div className="mb-4">
                        <p className="text-sm text-gray-400">{t('profile.modalType')}</p>
                        <p className="text-white font-semibold capitalize">{analysis.type}</p>
                    </div>
                     <div className="mb-4">
                        <p className="text-sm text-gray-400">{t('profile.modalDate')}</p>
                        <p className="text-white font-semibold">{new Date(analysis.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="mb-4">
                        <p className="text-sm text-gray-400">{t('profile.modalInput')}</p>
                        <p className="text-white font-semibold bg-gray-700 p-2 rounded-md">{analysis.exerciseName || analysis.prompt}</p>
                    </div>
                    {analysis.type === 'video' && analysis.poseDataJson && (
                        <div className="my-4">
                            <button onClick={onOpen3D} className="w-full py-2 px-4 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors">
                                {t('profile.view3DReplay')}
                            </button>
                        </div>
                    )}
                     <div>
                        <p className="text-sm text-gray-400 mb-2">{t('profile.modalFeedback')}</p>
                        <div className="bg-gray-900 p-4 rounded-md border border-gray-700">
                           {renderMarkdown(analysis.result)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const GoalsManager: React.FC = () => {
    const { t } = useTranslation();
    const [goals, setGoals] = useState<Goal[]>([]);
    const [newGoalText, setNewGoalText] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetch('/api/goals')
            .then(res => res.json())
            .then(data => {
                setGoals(data);
                setIsLoading(false);
            })
            .catch(console.error);
    }, []);

    const addGoal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newGoalText.trim()) return;
        const response = await fetch('/api/goals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: newGoalText }),
        });
        const newGoal = await response.json();
        setGoals([newGoal, ...goals]);
        setNewGoalText('');
    };

    const toggleGoal = async (goal: Goal) => {
        const updatedGoal = { ...goal, completed: !goal.completed };
        setGoals(goals.map(g => g.id === goal.id ? updatedGoal : g));
        await fetch(`/api/goals/${goal.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: updatedGoal.completed }),
        });
    };

    const deleteGoal = async (id: number) => {
        setGoals(goals.filter(g => g.id !== id));
        await fetch(`/api/goals/${id}`, { method: 'DELETE' });
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-bold text-white mb-4">{t('profile.goalsTitle')}</h3>
            <form onSubmit={addGoal} className="flex gap-2 mb-4">
                <input
                    type="text"
                    value={newGoalText}
                    onChange={e => setNewGoalText(e.target.value)}
                    placeholder={t('profile.goalPlaceholder')}
                    className="flex-1 bg-gray-700 border border-gray-600 rounded-md px-4 py-2 text-white"
                />
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700">{t('common.add')}</button>
            </form>
            {isLoading ? <Loader /> : (
                <ul className="space-y-2">
                    {goals.map(goal => (
                        <li key={goal.id} className="flex items-center justify-between bg-gray-700/50 p-3 rounded-md">
                            <div className="flex items-center gap-3">
                                <input type="checkbox" checked={goal.completed} onChange={() => toggleGoal(goal)} className="h-5 w-5 rounded accent-indigo-500" />
                                <span className={goal.completed ? 'line-through text-gray-400' : 'text-white'}>{goal.text}</span>
                            </div>
                            <button onClick={() => deleteGoal(goal.id)} className="text-red-500 hover:text-red-400 text-xs">{t('common.delete')}</button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

const ProfilePage: React.FC<ProfilePageProps> = ({ currentUser, onProfileUpdate }) => {
  const { t } = useTranslation();
  const [history, setHistory] = useState<AnalysisRecord[]>([]);
  const [savedPlans, setSavedPlans] = useState<SavedWorkoutPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisRecord | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<SavedWorkoutPlan | null>(null);
  const [show3DReplay, setShow3DReplay] = useState(false);
  const [profileForm, setProfileForm] = useState({
      firstName: currentUser.firstName ?? '',
      birthDate: currentUser.birthDate ?? '',
      heightCm: currentUser.heightCm ? String(currentUser.heightCm) : '',
      weightKg: currentUser.weightKg ? String(currentUser.weightKg) : '',
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
      setProfileForm({
          firstName: currentUser.firstName ?? '',
          birthDate: currentUser.birthDate ?? '',
          heightCm: currentUser.heightCm ? String(currentUser.heightCm) : '',
          weightKg: currentUser.weightKg ? String(currentUser.weightKg) : '',
      });
  }, [currentUser]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [historyRes, plansRes] = await Promise.all([
            fetch('/api/analysis'),
            fetch('/api/plans')
        ]);
        if (!historyRes.ok) throw new Error('Failed to fetch analysis history.');
        if (!plansRes.ok) throw new Error('Failed to fetch saved plans.');
        
        const historyData = await historyRes.json();
        const plansData = await plansRes.json();

        setHistory(historyData);
        setSavedPlans(plansData);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);
  
  const stats = useMemo(() => {
      const videoCount = history.filter(item => item.type === 'video').length;
      const imageCount = history.filter(item => item.type === 'image').length;
      return { total: history.length, video: videoCount, image: imageCount };
  }, [history]);

  const handleDeletePlan = async (planId: number) => {
      setSavedPlans(savedPlans.filter(p => p.id !== planId));
      await fetch(`/api/plans/${planId}`, { method: 'DELETE' });
  };
  
  const handleOpen3DReplay = () => {
      if (selectedAnalysis?.poseDataJson) {
        setShow3DReplay(true);
      }
  };

  const handleProfileChange = (field: 'firstName' | 'birthDate' | 'heightCm' | 'weightKg') => (e: React.ChangeEvent<HTMLInputElement>) => {
      setProfileForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleProfileSave = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSavingProfile(true);
      setProfileMessage(null);
      setProfileError(null);

      try {
          const response = await fetch('/api/profile', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  firstName: profileForm.firstName,
                  birthDate: profileForm.birthDate,
                  heightCm: Number(profileForm.heightCm),
                  weightKg: Number(profileForm.weightKg)
              })
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || 'Failed to update profile');
          onProfileUpdate(data.user);
          setProfileMessage(t('profile.profileSaved'));
      } catch (err) {
          setProfileError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
          setIsSavingProfile(false);
      }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="bg-gray-800/50 p-6 rounded-lg shadow-lg flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center">
                <span className="text-3xl font-bold text-white">{(currentUser.firstName || currentUser.email).charAt(0).toUpperCase()}</span>
            </div>
            <div>
                <h2 className="text-2xl font-bold text-white">{currentUser.firstName || t('profile.title')}</h2>
                <p className="text-indigo-300">{currentUser.email}</p>
            </div>
          </div>
          <div className="text-right">
              <p className="text-sm text-gray-400">{t('profile.subscriptionLabel')}</p>
              <p className="font-bold text-lg text-yellow-400 capitalize">{currentUser.subscriptionTier}</p>
          </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title={t('profile.totalAnalyses')} value={stats.total} />
        <StatCard title={t('profile.videoAnalyses')} value={stats.video} />
        <StatCard title={t('profile.imageAnalyses')} value={stats.image} />
      </div>

      {['pro', 'elite'].includes(currentUser.subscriptionTier) ? (
        <WeeklySummaryCard />
      ) : (
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 text-sm text-gray-300">
          {t('weeklySummary.locked')}
        </div>
      )}

      <GamificationPanel />

      <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
        <h3 className="text-xl font-bold text-white mb-2">{t('profile.personalInfoTitle')}</h3>
        <p className="text-sm text-gray-400 mb-4">{t('profile.personalInfoDescription')}</p>
        <form className="space-y-4" onSubmit={handleProfileSave}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1" htmlFor="profile-first-name">{t('profile.firstNameLabel')}</label>
                    <input
                        id="profile-first-name"
                        type="text"
                        value={profileForm.firstName}
                        onChange={handleProfileChange('firstName')}
                        required
                        className="w-full bg-gray-700 border border-gray-600 rounded-md px-4 py-2 text-white"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1" htmlFor="profile-birth-date">{t('profile.birthDateLabel')}</label>
                    <input
                        id="profile-birth-date"
                        type="date"
                        value={profileForm.birthDate}
                        onChange={handleProfileChange('birthDate')}
                        required
                        className="w-full bg-gray-700 border border-gray-600 rounded-md px-4 py-2 text-white"
                    />
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1" htmlFor="profile-height">{t('profile.heightLabel')} <span className="text-gray-500">({t('profile.heightUnit')})</span></label>
                    <input
                        id="profile-height"
                        type="number"
                        min="0"
                        value={profileForm.heightCm}
                        onChange={handleProfileChange('heightCm')}
                        required
                        className="w-full bg-gray-700 border border-gray-600 rounded-md px-4 py-2 text-white"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1" htmlFor="profile-weight">{t('profile.weightLabel')} <span className="text-gray-500">({t('profile.weightUnit')})</span></label>
                    <input
                        id="profile-weight"
                        type="number"
                        min="0"
                        value={profileForm.weightKg}
                        onChange={handleProfileChange('weightKg')}
                        required
                        className="w-full bg-gray-700 border border-gray-600 rounded-md px-4 py-2 text-white"
                    />
                </div>
            </div>
            {profileError && <p className="text-sm text-red-400">{profileError}</p>}
            {profileMessage && <p className="text-sm text-green-400">{profileMessage}</p>}
            <button
                type="submit"
                disabled={isSavingProfile}
                className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 disabled:bg-gray-600"
            >
                {isSavingProfile ? t('profile.profileSavingButton') : t('profile.profileSaveButton')}
            </button>
        </form>
      </div>

      <GoalsManager />

      <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
        <h3 className="text-xl font-bold text-white mb-4">{t('profile.plansTitle')}</h3>
         {isLoading ? <div className="flex justify-center"><Loader /></div>
         : error ? <p className="text-red-400 text-center">{error}</p>
         : savedPlans.length === 0 ? <p className="text-gray-400 text-center py-4">{t('profile.noPlans')}</p>
         : (
            <div className="space-y-3">
                {savedPlans.map(plan => (
                    <div key={plan.id} className="w-full bg-gray-700/50 p-4 rounded-lg flex items-center space-x-4">
                       <div className="flex-shrink-0 text-indigo-400"><PlanIcon /></div>
                        <div className="flex-1">
                            <p className="font-semibold text-white truncate">{plan.planName}</p>
                            <p className="text-xs text-gray-400">{t('profile.planSavedOn')} {new Date(plan.createdAt).toLocaleDateString()}</p>
                        </div>
                        <button onClick={() => setSelectedPlan(plan)} className="text-xs font-semibold text-indigo-300 hover:underline">{t('common.viewDetails')}</button>
                        <button onClick={() => handleDeletePlan(plan.id)} className="text-xs text-red-500 hover:text-red-400">&times;</button>
                    </div>
                ))}
            </div>
         )}
      </div>

      <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
        <h3 className="text-xl font-bold text-white mb-4">{t('profile.historyTitle')}</h3>
        {isLoading ? <div className="flex justify-center"><Loader /></div>
        : error ? <p className="text-red-400 text-center">{error}</p>
        : history.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
                {t('profile.noHistory')}
            </p>
        )
        : (
            <div className="space-y-3">
                {history.map(item => (
                    <button 
                        key={item.id} 
                        onClick={() => setSelectedAnalysis(item)}
                        className="w-full text-left bg-gray-700/50 hover:bg-gray-700 p-4 rounded-lg transition-colors flex items-center space-x-4"
                    >
                       <div className="flex-shrink-0 text-indigo-400">
                            {item.type === 'video' ? <VideoIcon /> : <ImageIcon />}
                        </div>
                        <div className="flex-1">
                            <p className="font-semibold text-white truncate">{item.exerciseName || item.prompt}</p>
                            <p className="text-xs text-gray-400">{new Date(item.createdAt).toLocaleString()}</p>
                        </div>
                        <span className="text-xs font-semibold text-indigo-300">{t('common.viewDetails')} &rarr;</span>
                    </button>
                ))}
            </div>
        )}
      </div>

      {selectedAnalysis && !show3DReplay && (
          <AnalysisDetailModal 
            analysis={selectedAnalysis} 
            onClose={() => setSelectedAnalysis(null)} 
            onOpen3D={handleOpen3DReplay}
          />
      )}
      {selectedPlan && <PlanDetailModal plan={selectedPlan} onClose={() => setSelectedPlan(null)} />}
      {show3DReplay && selectedAnalysis?.poseDataJson && (
        <Replay3DModal
            poseDataJson={selectedAnalysis.poseDataJson}
            onClose={() => setShow3DReplay(false)}
        />
      )}
    </div>
  );
};

export default ProfilePage;
