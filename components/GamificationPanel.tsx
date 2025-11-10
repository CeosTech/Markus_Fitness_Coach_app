import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GamificationStats } from '../types';
import Loader from './shared/Loader';
import { useTranslation } from '../i18n/LanguageContext';

const badgeIds = ['first-analysis', 'consistency', 'weekly-warrior', 'planner', 'goal-crusher'] as const;
type BadgeId = typeof badgeIds[number];

const GamificationPanel: React.FC = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<GamificationStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [badgeToast, setBadgeToast] = useState<{ title: string; description: string } | null>(null);

  const prevBadgesRef = useRef<Map<string, boolean>>(new Map());
  const toastQueueRef = useRef<Array<{ title: string; description: string }>>([]);
  const toastTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    fetch('/api/gamification')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load gamification data');
        return res.json();
      })
      .then(data => {
        if (mounted) {
          setStats(data);
          setError(null);
        }
      })
      .catch(err => mounted && setError(err.message))
      .finally(() => mounted && setIsLoading(false));
    return () => {
      mounted = false;
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const levelProgress = useMemo(() => {
    if (!stats) return 0;
    const previousLevelXp = (stats.level - 1) * 100;
    const nextLevelXp = stats.nextLevelXp;
    const range = nextLevelXp - previousLevelXp;
    const progress = stats.xp - previousLevelXp;
    return Math.min(100, Math.max(0, Math.round((progress / range) * 100)));
  }, [stats]);

  const badges = useMemo(() => {
    const earnedMap = new Map((stats?.badges ?? []).map(b => [b.id, b.earned]));
    return badgeIds.map((id) => ({
      id,
      earned: earnedMap.get(id) || false,
      title: t(`gamification.badges.${id}.title`),
      description: t(`gamification.badges.${id}.description`)
    }));
  }, [stats, t]);

  const streakReminder = useMemo(() => {
    if (!stats || stats.streakDays === 0 || !stats.lastAnalysisDate) return null;
    const todayKey = new Date().toISOString().split('T')[0];
    if (stats.lastAnalysisDate === todayKey) return null;
    return t('gamification.streakReminder');
  }, [stats, t]);

  useEffect(() => {
    if (!stats) return;
    const currentMap = new Map(stats.badges.map(b => [b.id, b.earned]));
    const previous = prevBadgesRef.current;
    const newlyEarned: BadgeId[] = [];

    badgeIds.forEach(id => {
      const nowEarned = currentMap.get(id) || false;
      const wasEarned = previous.get(id) || false;
      if (nowEarned && !wasEarned) {
        newlyEarned.push(id);
      }
    });
    prevBadgesRef.current = currentMap;

    if (newlyEarned.length) {
      newlyEarned.forEach(id => {
        toastQueueRef.current.push({
          title: t(`gamification.badges.${id}.title`),
          description: t(`gamification.badges.${id}.description`)
        });
      });
      if (!badgeToast) {
        const next = toastQueueRef.current.shift() || null;
        setBadgeToast(next);
      }
    }
  }, [stats, badgeToast, t]);

  useEffect(() => {
    if (badgeToast) {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
      toastTimeoutRef.current = window.setTimeout(() => {
        setBadgeToast(null);
      }, 4000);
    } else if (toastQueueRef.current.length > 0) {
      const next = toastQueueRef.current.shift() || null;
      if (next) setBadgeToast(next);
    }
    return () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, [badgeToast]);

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-indigo-300">{t('gamification.levelLabel')}</p>
          <h3 className="text-3xl font-bold text-white">{stats ? stats.level : '--'}</h3>
          <p className="text-gray-400 text-sm">{stats ? t('gamification.xpLabel', { xp: stats.xp }) : t('gamification.loading')}</p>
        </div>
        <div className="w-32">
          <p className="text-xs text-gray-400 mb-1">{t('gamification.progressLabel')}</p>
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div className="bg-indigo-500 h-3 rounded-full" style={{ width: `${levelProgress}%` }} />
          </div>
          {stats && (
            <p className="text-xs text-gray-500 mt-1">
              {stats.xp}/{stats.nextLevelXp} XP
            </p>
          )}
        </div>
      </div>

      {badgeToast && (
        <div className="bg-green-900/40 border border-green-500 text-green-100 p-3 rounded-md text-sm">
          <p className="font-semibold">{t('gamification.badges.toastPrefix', { title: badgeToast.title })}</p>
          <p className="text-xs text-green-200">{badgeToast.description}</p>
        </div>
      )}

      {streakReminder && (
        <div className="bg-yellow-900/30 border border-yellow-500 text-yellow-200 p-3 rounded-md text-sm">
          {streakReminder}
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-6"><Loader /></div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gray-900/60 p-4 rounded-md border border-gray-700">
            <p className="text-xs text-gray-400 uppercase tracking-wide">{t('gamification.weeklySessions')}</p>
            <p className="text-2xl font-bold text-white">{stats.weeklyAnalyses}</p>
          </div>
          <div className="bg-gray-900/60 p-4 rounded-md border border-gray-700">
            <p className="text-xs text-gray-400 uppercase tracking-wide">{t('gamification.streak')}</p>
            <p className="text-2xl font-bold text-white">{stats.streakDays} {t('gamification.days')}</p>
          </div>
          <div className="bg-gray-900/60 p-4 rounded-md border border-gray-700">
            <p className="text-xs text-gray-400 uppercase tracking-wide">{t('gamification.totalSessions')}</p>
            <p className="text-2xl font-bold text-white">{stats.totalAnalyses}</p>
          </div>
        </div>
      )}

      <div>
        <h4 className="text-lg font-semibold text-white mb-3">{t('gamification.badges.title')}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {badges.map(badge => (
            <div
              key={badge.id}
              className={`p-4 rounded-md border ${badge.earned ? 'border-green-400 bg-green-400/10' : 'border-gray-700 bg-gray-900/40'}`}
            >
              <div className="flex items-center justify-between">
                <p className={`text-sm font-semibold ${badge.earned ? 'text-green-300' : 'text-gray-400'}`}>{badge.title}</p>
                {badge.earned ? <span className="text-xs text-green-400">✔</span> : <span className="text-xs text-gray-500">{t('gamification.badges.locked')}</span>}
              </div>
              <p className="text-xs text-gray-400 mt-1">{badge.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GamificationPanel;
