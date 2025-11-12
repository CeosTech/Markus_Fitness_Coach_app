import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/LanguageContext';
import Loader from '../shared/Loader';
import ToolPageLayout from './ToolPageLayout';
import { MobilityRoutine, SavedMobilityRoutine } from '../../types';

interface MobilityCoachProps {
  onBack: () => void;
}

type TimerState = {
  isActive: boolean;
  isPaused: boolean;
  currentIndex: number;
  timeLeft: number;
};

const focusOptions = ['hips', 'ankles', 'thoracic', 'shoulders', 'hamstrings', 'glutes', 'core', 'wrists'];
const intensityOptions: Array<'low' | 'moderate' | 'high'> = ['low', 'moderate', 'high'];

const MobilityCoach: React.FC<MobilityCoachProps> = ({ onBack }) => {
  const { t, language } = useTranslation();
  const [upcomingSession, setUpcomingSession] = useState('');
  const [intensity, setIntensity] = useState<'low' | 'moderate' | 'high'>('moderate');
  const [selectedFocusAreas, setSelectedFocusAreas] = useState<string[]>(['hips', 'thoracic']);
  const [equipment, setEquipment] = useState('');
  const [timeAvailable, setTimeAvailable] = useState(12);
  const [notes, setNotes] = useState('');

  const [routine, setRoutine] = useState<MobilityRoutine | null>(null);
  const [history, setHistory] = useState<SavedMobilityRoutine[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [timerState, setTimerState] = useState<TimerState>({ isActive: false, isPaused: false, currentIndex: 0, timeLeft: 0 });

  const flattenedDrills = useMemo(() => {
    if (!routine) return [];
    const drills: Array<{
      sectionIndex: number;
      sectionTitle: string;
      drillIndex: number;
      name: string;
      durationSeconds: number;
      focus: string;
      cues: string[];
    }> = [];
    routine.sections.forEach((section, sectionIndex) => {
      section.drills.forEach((drill, drillIndex) => {
        drills.push({
          sectionIndex,
          sectionTitle: section.title,
          drillIndex,
          name: drill.name,
          durationSeconds: drill.durationSeconds,
          focus: drill.focus,
          cues: drill.cues
        });
      });
    });
    return drills;
  }, [routine]);

  useEffect(() => {
    let ignore = false;
    const loadHistory = async () => {
      setLoadingHistory(true);
      try {
        const res = await fetch('/api/mobility');
        if (!res.ok) throw new Error('Failed to load routines.');
        const data: SavedMobilityRoutine[] = await res.json();
        if (!ignore) setHistory(data);
      } catch (err) {
        if (!ignore) setHistory([]);
      } finally {
        if (!ignore) setLoadingHistory(false);
      }
    };
    loadHistory();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!timerState.isActive || timerState.isPaused) return;
    if (!flattenedDrills.length) return;
    const interval = window.setInterval(() => {
      setTimerState(prev => {
        if (!prev.isActive || prev.isPaused) return prev;
        if (prev.timeLeft > 1) {
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        }
        const nextIndex = prev.currentIndex + 1;
        if (nextIndex >= flattenedDrills.length) {
          return { isActive: false, isPaused: false, currentIndex: prev.currentIndex, timeLeft: 0 };
        }
        return {
          ...prev,
          currentIndex: nextIndex,
          timeLeft: Math.max(flattenedDrills[nextIndex].durationSeconds, 5)
        };
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timerState.isActive, timerState.isPaused, flattenedDrills]);

  const toggleFocusArea = (area: string) => {
    setSelectedFocusAreas(prev => (prev.includes(area) ? prev.filter(item => item !== area) : [...prev, area]));
  };

  const handleGenerate = async () => {
    if (!upcomingSession.trim()) {
      setError(t('mobilityCoach.errors.sessionRequired'));
      return;
    }
    setIsGenerating(true);
    setError(null);
    setTimerState({ isActive: false, isPaused: false, currentIndex: 0, timeLeft: 0 });
    try {
      const response = await fetch('/api/mobility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upcomingSession,
          intensity,
          focusAreas: selectedFocusAreas,
          equipment,
          timeAvailableMinutes: timeAvailable,
          notes,
          language
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Failed to generate routine.');
      }
      setRoutine(data.routine);
      if (data.savedRoutine) {
        setHistory(prev => [data.savedRoutine, ...prev].slice(0, 20));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mobilityCoach.errors.general'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLoadRoutine = (saved: SavedMobilityRoutine) => {
    setRoutine(saved);
    setSelectedFocusAreas(saved.inputs?.focusAreas || []);
    setIntensity((saved.inputs?.intensity as ('low' | 'moderate' | 'high')) || 'moderate');
    setUpcomingSession(saved.inputs?.upcomingSession || '');
    setEquipment(saved.inputs?.equipment || '');
    setTimeAvailable(saved.inputs?.timeAvailableMinutes || 12);
    setNotes(saved.inputs?.notes || '');
    setTimerState({ isActive: false, isPaused: false, currentIndex: 0, timeLeft: 0 });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startTimer = () => {
    if (!flattenedDrills.length) return;
    setTimerState({
      isActive: true,
      isPaused: false,
      currentIndex: 0,
      timeLeft: Math.max(flattenedDrills[0].durationSeconds, 5)
    });
  };

  const toggleTimerPause = () => {
    setTimerState(prev => ({ ...prev, isPaused: !prev.isPaused }));
  };

  const resetTimer = () => {
    setTimerState({ isActive: false, isPaused: false, currentIndex: 0, timeLeft: 0 });
  };

  const skipDrill = (direction: 1 | -1) => {
    if (!flattenedDrills.length) return;
    setTimerState(prev => {
      let nextIndex = prev.currentIndex + direction;
      nextIndex = Math.max(0, Math.min(flattenedDrills.length - 1, nextIndex));
      return {
        ...prev,
        currentIndex: nextIndex,
        timeLeft: Math.max(flattenedDrills[nextIndex].durationSeconds, 5),
        isActive: true,
        isPaused: false
      };
    });
  };

  return (
    <ToolPageLayout
      title={t('mobilityCoach.title')}
      subtitle={t('mobilityCoach.subtitle')}
      accentClass="bg-gradient-to-br from-teal-900/80 via-cyan-900/60 to-gray-900/80"
      hero={<span role="img" aria-label="mobility">🧘</span>}
      eyebrow={t('mobilityCoach.eyebrow')}
      onBack={onBack}
    >
      <div className="rounded-3xl bg-black/40 border border-white/5 p-6 sm:p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-white/70 mb-1">{t('mobilityCoach.form.sessionLabel')}</label>
            <input
              type="text"
              value={upcomingSession}
              onChange={(e) => setUpcomingSession(e.target.value)}
              placeholder={t('mobilityCoach.form.sessionPlaceholder')}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-white/70 mb-1">{t('mobilityCoach.form.equipmentLabel')}</label>
            <input
              type="text"
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              placeholder={t('mobilityCoach.form.equipmentPlaceholder')}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-2 text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-white/70 mb-2">{t('mobilityCoach.form.focusLabel')}</label>
          <div className="flex flex-wrap gap-2">
            {focusOptions.map(option => (
              <button
                type="button"
                key={option}
                onClick={() => toggleFocusArea(option)}
                className={`px-3 py-1.5 rounded-full text-sm border ${
                  selectedFocusAreas.includes(option)
                    ? 'bg-cyan-500/80 text-white border-cyan-400'
                    : 'bg-white/5 text-white/70 border-white/15 hover:border-white/40'
                }`}
              >
                {t(`mobilityCoach.focus.${option}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-white/70 mb-2">{t('mobilityCoach.form.intensityLabel')}</label>
            <div className="flex gap-2">
              {intensityOptions.map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setIntensity(option)}
                  className={`flex-1 px-3 py-2 rounded-2xl border text-sm ${
                    intensity === option ? 'bg-emerald-500/80 text-white border-emerald-400' : 'bg-white/5 text-white/70 border-white/10'
                  }`}
                >
                  {t(`mobilityCoach.intensity.${option}`)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-white/70 mb-2">{t('mobilityCoach.form.timeLabel', { minutes: timeAvailable })}</label>
            <input
              type="range"
              min="6"
              max="25"
              value={timeAvailable}
              onChange={(e) => setTimeAvailable(Number(e.target.value))}
              className="w-full accent-cyan-300"
            />
          </div>
          <div>
            <label className="block text-sm text-white/70 mb-1">{t('mobilityCoach.form.notesLabel')}</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('mobilityCoach.form.notesPlaceholder')}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-2 text-white"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-300">{error}</p>}

        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full px-4 py-3 rounded-2xl font-semibold bg-gradient-to-r from-cyan-400 to-blue-500 text-gray-900 shadow-lg disabled:opacity-50"
        >
          {isGenerating ? t('mobilityCoach.form.generating') : t('mobilityCoach.form.generateButton')}
        </button>
      </div>

      {isGenerating && (
        <div className="rounded-3xl bg-black/40 border border-white/5 p-8 flex justify-center">
          <Loader />
        </div>
      )}

      {routine && !isGenerating && (
        <div className="space-y-6">
          <div className="rounded-3xl bg-black/40 border border-white/5 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-semibold text-white">{routine.routineName}</h3>
              <span className="text-sm text-white/70">{t('mobilityCoach.summary.totalTime', { minutes: Math.round(routine.totalDurationSeconds / 60) })}</span>
            </div>
            {routine.notes && <p className="text-sm text-white/70">{routine.notes}</p>}
            <div className="space-y-4">
              {routine.sections.map((section, index) => (
                <div key={`${section.title}-${index}`} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-semibold text-white">{section.title}</p>
                    <span className="text-sm text-white/60">{Math.round(section.totalDurationSeconds / 60)} min</span>
                  </div>
                  {section.description && <p className="text-sm text-white/70">{section.description}</p>}
                  <div className="space-y-2">
                    {section.drills.map((drill, drillIndex) => (
                      <div key={`${drill.name}-${drillIndex}`} className="rounded-xl bg-black/30 border border-white/5 p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-white font-medium">{drill.name}</p>
                          <span className="text-xs text-white/60">{drill.durationSeconds}s</span>
                        </div>
                        <p className="text-xs text-white/60 mt-1">{drill.focus}</p>
                        <ul className="text-xs text-white/70 mt-2 list-disc list-inside space-y-1">
                          {drill.cues.map((cue, cueIndex) => (
                            <li key={`${cue}-${cueIndex}`}>{cue}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {routine.recommendations && routine.recommendations.length > 0 && (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-3 text-sm text-white/80">
                <p className="font-semibold mb-2">{t('mobilityCoach.summary.recommendations')}</p>
                <ul className="list-disc list-inside space-y-1">
                  {routine.recommendations.map((tip, idx) => (
                    <li key={`${tip}-${idx}`}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {flattenedDrills.length > 0 && (
            <div className="rounded-3xl bg-black/40 border border-white/5 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/60">{t('mobilityCoach.timer.currentDrill')}</p>
                  {timerState.isActive ? (
                    <p className="text-2xl font-semibold text-white">{flattenedDrills[timerState.currentIndex]?.name}</p>
                  ) : (
                    <p className="text-2xl font-semibold text-white/70">{t('mobilityCoach.timer.idle')}</p>
                  )}
                </div>
                <p className="text-4xl font-mono text-white">{timerState.isActive ? `${timerState.timeLeft}s` : '--'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!timerState.isActive ? (
                  <button onClick={startTimer} className="px-4 py-2 rounded-xl bg-emerald-500/80 text-white font-semibold">
                    {t('mobilityCoach.timer.start')}
                  </button>
                ) : (
                  <>
                    <button onClick={toggleTimerPause} className="px-4 py-2 rounded-xl bg-yellow-400/80 text-gray-900 font-semibold">
                      {timerState.isPaused ? t('mobilityCoach.timer.resume') : t('mobilityCoach.timer.pause')}
                    </button>
                    <button onClick={() => skipDrill(-1)} className="px-4 py-2 rounded-xl bg-white/10 text-white border border-white/15">
                      {t('mobilityCoach.timer.prev')}
                    </button>
                    <button onClick={() => skipDrill(1)} className="px-4 py-2 rounded-xl bg-white/10 text-white border border-white/15">
                      {t('mobilityCoach.timer.next')}
                    </button>
                    <button onClick={resetTimer} className="px-4 py-2 rounded-xl bg-white/10 text-white border border-white/15">
                      {t('mobilityCoach.timer.reset')}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="rounded-3xl bg-black/35 border border-white/5 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{t('mobilityCoach.history.title')}</h3>
          {loadingHistory && <span className="text-xs text-white/60">{t('common.loading')}</span>}
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-white/60">{t('mobilityCoach.history.empty')}</p>
        ) : (
          <div className="space-y-3">
            {history.map(saved => (
              <div key={saved.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-white font-semibold">{saved.routineName}</p>
                  <p className="text-xs text-white/60">{new Date(saved.createdAt).toLocaleString()}</p>
                  <p className="text-xs text-white/60">
                    {t('mobilityCoach.history.focusPreview', { focus: (saved.inputs?.focusAreas || []).slice(0, 3).join(', ') || t('mobilityCoach.history.generalFocus') })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleLoadRoutine(saved)}
                  className="px-4 py-2 rounded-xl bg-white/10 text-white border border-white/15 hover:bg-white/20 transition text-sm"
                >
                  {t('mobilityCoach.history.loadButton')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </ToolPageLayout>
  );
};

export default MobilityCoach;
