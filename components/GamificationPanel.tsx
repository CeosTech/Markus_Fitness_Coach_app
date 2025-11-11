import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GamificationStats } from '../types';
import Loader from './shared/Loader';
import { useTranslation } from '../i18n/LanguageContext';

const badgeGroups = [
  {
    id: 'foundations',
    icon: '🏅',
    accent: 'from-amber-500/40 via-amber-500/10 to-transparent',
    badges: ['first-analysis', 'form-apprentice', 'form-elite']
  },
  {
    id: 'consistency',
    icon: '🔥',
    accent: 'from-orange-500/40 via-orange-500/10 to-transparent',
    badges: ['consistency', 'streak-warrior', 'weekly-warrior', 'weekly-legend']
  },
  {
    id: 'strategy',
    icon: '📐',
    accent: 'from-sky-500/40 via-sky-500/10 to-transparent',
    badges: ['planner', 'program-architect']
  },
  {
    id: 'mindset',
    icon: '💪',
    accent: 'from-emerald-500/40 via-emerald-500/10 to-transparent',
    badges: ['goal-crusher', 'goal-champion', 'xp-hustler']
  }
] as const;

const allBadgeIds = badgeGroups.flatMap(group => group.badges);

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

  const badgeLookup = useMemo(() => {
    const earnedMap = new Map((stats?.badges ?? []).map(b => [b.id, b.earned]));
    const meta = new Map<string, { earned: boolean; title: string; description: string }>();
    allBadgeIds.forEach((id) => {
      meta.set(id, {
        earned: earnedMap.get(id) || false,
        title: t(`gamification.badges.${id}.title`),
        description: t(`gamification.badges.${id}.description`)
      });
    });
    return meta;
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
    const newlyEarned: string[] = [];

    allBadgeIds.forEach(id => {
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
          <MetricCard
            label={t('gamification.weeklySessions')}
            value={stats.weeklyAnalyses.toString()}
            accent="from-purple-500/20 via-purple-500/5 to-transparent"
          />
          <MetricCard
            label={t('gamification.streak')}
            value={`${stats.streakDays} ${t('gamification.days')}`}
            accent="from-pink-500/20 via-pink-500/5 to-transparent"
          />
          <MetricCard
            label={t('gamification.totalSessions')}
            value={stats.totalAnalyses.toString()}
            accent="from-sky-500/20 via-sky-500/5 to-transparent"
          />
        </div>
      )}

      <div className="space-y-4">
        {badgeGroups.map((group) => (
          <section key={group.id} className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
            <header className="flex items-center gap-3 mb-3">
              <div className={`h-12 w-12 rounded-full bg-gradient-to-br ${group.accent} flex items-center justify-center text-2xl`}>
                {group.icon}
              </div>
              <div>
                <p className="text-sm uppercase tracking-wide text-gray-400">{t(`gamification.badgeGroups.${group.id}.title`)}</p>
                <p className="text-xs text-gray-500">{t(`gamification.badgeGroups.${group.id}.description`)}</p>
              </div>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {group.badges.map((badgeId) => {
                const meta = badgeLookup.get(badgeId);
                if (!meta) return null;
                return (
                  <BadgeCard
                    key={badgeId}
                    title={meta.title}
                    description={meta.description}
                    earned={meta.earned}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

const MetricCard: React.FC<{ label: string; value: string; accent: string }> = ({ label, value, accent }) => (
  <div className={`bg-gray-900/70 p-4 rounded-xl border border-gray-700 relative overflow-hidden`}>
    <div className={`absolute inset-0 bg-gradient-to-br ${accent} opacity-60 pointer-events-none`} />
    <div className="relative">
      <p className="text-xs text-gray-300 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
    </div>
  </div>
);

const BadgeCard: React.FC<{ title: string; description: string; earned: boolean }> = ({ title, description, earned }) => (
  <div className={`p-4 rounded-lg border transition ${earned ? 'border-emerald-500/80 bg-emerald-500/10 shadow-lg shadow-emerald-900/30' : 'border-gray-700 bg-gray-800/60'}`}>
    <div className="flex items-center justify-between mb-2">
      <p className={`text-sm font-semibold ${earned ? 'text-emerald-200' : 'text-gray-300'}`}>{title}</p>
      {earned ? (
        <span className="text-xs text-emerald-300 tracking-wide uppercase">Unlocked</span>
      ) : (
        <span className="text-xs text-gray-500">{'⌛'}</span>
      )}
    </div>
    <p className="text-xs text-gray-400">{description}</p>
  </div>
);

export default GamificationPanel;
