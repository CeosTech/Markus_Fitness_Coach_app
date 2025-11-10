import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../i18n/LanguageContext';
import Loader from './shared/Loader';
import { BoxingPhase, ToolState } from '../types';

const formatStopwatch = (ms: number) => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
};

const formatSeconds = (total: number) => {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const defaultToolState: ToolState = {
  hydration: { targetMl: 2500, consumedMl: 0 },
  stopwatch: { elapsedMs: 0, running: false, updatedAt: null },
  boxing: {
    roundLength: 180,
    restLength: 60,
    rounds: 3,
    currentRound: 1,
    phase: 'round',
    timeLeft: 180,
    running: false,
    updatedAt: null
  }
};

const Tools: React.FC = () => {
  const { t } = useTranslation();

  const [hydrationTarget, setHydrationTarget] = useState(defaultToolState.hydration.targetMl);
  const [hydrationConsumed, setHydrationConsumed] = useState(defaultToolState.hydration.consumedMl);
  const hydrationProgress = useMemo(
    () => Math.min(100, Math.round((hydrationConsumed / hydrationTarget) * 100) || 0),
    [hydrationConsumed, hydrationTarget]
  );

  const [stopwatchRunning, setStopwatchRunning] = useState(defaultToolState.stopwatch.running);
  const [stopwatchTime, setStopwatchTime] = useState(defaultToolState.stopwatch.elapsedMs);

  const [roundLength, setRoundLength] = useState(defaultToolState.boxing.roundLength);
  const [restLength, setRestLength] = useState(defaultToolState.boxing.restLength);
  const [rounds, setRounds] = useState(defaultToolState.boxing.rounds);
  const [currentRound, setCurrentRound] = useState(defaultToolState.boxing.currentRound);
  const [boxingPhase, setBoxingPhase] = useState<BoxingPhase>(defaultToolState.boxing.phase);
  const [timeLeft, setTimeLeft] = useState(defaultToolState.boxing.timeLeft);
  const [boxingRunning, setBoxingRunning] = useState(defaultToolState.boxing.running);

  const [ormWeight, setOrmWeight] = useState('');
  const [ormReps, setOrmReps] = useState('');
  const estOneRepMax = useMemo(() => {
    const weight = Number(ormWeight);
    const reps = Number(ormReps);
    if (!weight || !reps) return null;
    return Math.round(weight * (1 + reps / 30));
  }, [ormWeight, ormReps]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const stopwatchIntervalRef = useRef<number | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const pendingSaveRef = useRef<ToolState | null>(null);
  const prevBoxingPhaseRef = useRef<BoxingPhase>(defaultToolState.boxing.phase);

  const playBell = useCallback((type: 'start' | 'rest' | 'final') => {
    if (typeof window === 'undefined') return;
    const AudioContextClass =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const start = ctx.currentTime;
    const strike = (frequency: number, offset: number, duration: number) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, start + offset);
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.6, start + offset + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + duration);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + duration);
    };
    if (type === 'start') {
      strike(950, 0, 0.9);
      strike(650, 0.25, 0.9);
    } else if (type === 'rest') {
      strike(420, 0, 1);
    } else {
      strike(550, 0, 1.1);
      strike(350, 0.35, 1);
    }
    window.setTimeout(() => {
      ctx.close().catch(() => undefined);
    }, 1500);
  }, []);

  useEffect(() => {
    if (stopwatchRunning) {
      stopwatchIntervalRef.current = window.setInterval(() => {
        setStopwatchTime(prev => prev + 10);
      }, 10);
    }
    return () => {
      if (stopwatchIntervalRef.current) {
        window.clearInterval(stopwatchIntervalRef.current);
        stopwatchIntervalRef.current = null;
      }
    };
  }, [stopwatchRunning]);

  useEffect(() => {
    if (!boxingRunning) return;
    const interval = window.setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [boxingRunning]);

  useEffect(() => {
    if (!boxingRunning) return;
    if (timeLeft > 0) return;

    if (boxingPhase === 'round') {
      if (restLength > 0) {
        setBoxingPhase('rest');
        setTimeLeft(restLength);
      } else {
        setBoxingPhase('rest');
        setTimeLeft(0);
      }
    } else {
      if (currentRound >= rounds) {
        setBoxingRunning(false);
        setTimeLeft(0);
        playBell('final');
      } else {
        setCurrentRound(prev => prev + 1);
        setBoxingPhase('round');
        setTimeLeft(roundLength);
      }
    }
  }, [timeLeft, boxingPhase, boxingRunning, currentRound, rounds, restLength, roundLength, playBell]);

  useEffect(() => {
    if (!boxingRunning) {
      prevBoxingPhaseRef.current = boxingPhase;
      return;
    }
    if (prevBoxingPhaseRef.current !== boxingPhase) {
      playBell(boxingPhase === 'round' ? 'start' : 'rest');
      prevBoxingPhaseRef.current = boxingPhase;
    }
  }, [boxingPhase, boxingRunning, playBell]);

  const buildSnapshot = useCallback(
    (overrides?: Partial<ToolState>): ToolState => ({
      hydration: overrides?.hydration ?? { targetMl: hydrationTarget, consumedMl: hydrationConsumed },
      stopwatch:
        overrides?.stopwatch ??
        {
          elapsedMs: stopwatchTime,
          running: stopwatchRunning,
          updatedAt: stopwatchRunning ? new Date().toISOString() : null
        },
      boxing:
        overrides?.boxing ??
        {
          roundLength,
          restLength,
          rounds,
          currentRound,
          phase: boxingPhase,
          timeLeft,
          running: boxingRunning,
          updatedAt: boxingRunning ? new Date().toISOString() : null
        }
    }),
    [hydrationTarget, hydrationConsumed, stopwatchTime, stopwatchRunning, roundLength, restLength, rounds, currentRound, boxingPhase, timeLeft, boxingRunning]
  );

  const queueSave = useCallback(
    (snapshot: ToolState) => {
      if (!isReady) return;
      pendingSaveRef.current = snapshot;
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = window.setTimeout(() => {
        if (!pendingSaveRef.current) return;
        setSaveState('saving');
        fetch('/api/tools/state', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pendingSaveRef.current)
        })
          .then(res => {
            if (!res.ok) throw new Error('Save failed');
            setSaveState('saved');
            setTimeout(() => setSaveState('idle'), 1500);
          })
          .catch(() => setSaveState('error'));
      }, 600);
    },
    [isReady]
  );

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch('/api/tools/state')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load tool state');
        return res.json();
      })
      .then((data: ToolState) => {
        if (!mounted) return;
        const state = data || defaultToolState;
        setHydrationTarget(state.hydration.targetMl);
        setHydrationConsumed(state.hydration.consumedMl);
        setStopwatchTime(state.stopwatch.elapsedMs);
        setStopwatchRunning(state.stopwatch.running);
        setRoundLength(state.boxing.roundLength);
        setRestLength(state.boxing.restLength);
        setRounds(state.boxing.rounds);
        setCurrentRound(state.boxing.currentRound);
        setBoxingPhase(state.boxing.phase);
        setTimeLeft(state.boxing.timeLeft);
        setBoxingRunning(state.boxing.running);
        setLoadError(null);
        setIsReady(true);
      })
      .catch(err => mounted && setLoadError(err.message))
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handleStopwatchStart = () => {
    if (stopwatchRunning) return;
    setStopwatchRunning(true);
    queueSave(buildSnapshot({ stopwatch: { elapsedMs: stopwatchTime, running: true, updatedAt: new Date().toISOString() } }));
  };

  const handleStopwatchPause = () => {
    if (!stopwatchRunning) return;
    setStopwatchRunning(false);
    queueSave(buildSnapshot({ stopwatch: { elapsedMs: stopwatchTime, running: false, updatedAt: null } }));
  };

  const handleStopwatchReset = () => {
    setStopwatchRunning(false);
    setStopwatchTime(0);
    queueSave(buildSnapshot({ stopwatch: { elapsedMs: 0, running: false, updatedAt: null } }));
  };

  const handleBoxingStart = () => {
    const snapshotBoxing = {
      roundLength,
      restLength,
      rounds,
      currentRound: 1,
      phase: 'round' as BoxingPhase,
      timeLeft: roundLength,
      running: true,
      updatedAt: new Date().toISOString()
    };
    setCurrentRound(1);
    setBoxingPhase('round');
    setTimeLeft(roundLength);
    setBoxingRunning(true);
    prevBoxingPhaseRef.current = 'round';
    playBell('start');
    queueSave(buildSnapshot({ boxing: snapshotBoxing }));
  };

  const handleBoxingPause = () => {
    setBoxingRunning(false);
    queueSave(
      buildSnapshot({
        boxing: { roundLength, restLength, rounds, currentRound, phase: boxingPhase, timeLeft, running: false, updatedAt: null }
      })
    );
  };

  const handleBoxingReset = () => {
    setBoxingRunning(false);
    setCurrentRound(1);
    setBoxingPhase('round');
    setTimeLeft(roundLength);
    queueSave(
      buildSnapshot({
        boxing: { roundLength, restLength, rounds, currentRound: 1, phase: 'round', timeLeft: roundLength, running: false, updatedAt: null }
      })
    );
  };

  const handleRoundLengthChange = (value: number) => {
    const clamped = Math.max(30, value);
    const nextTime = boxingRunning && boxingPhase === 'round' ? Math.min(timeLeft, clamped) : clamped;
    setRoundLength(clamped);
    if (!boxingRunning || boxingPhase === 'round') {
      setTimeLeft(nextTime);
    }
    queueSave(
      buildSnapshot({
        boxing: { roundLength: clamped, restLength, rounds, currentRound, phase: boxingPhase, timeLeft: nextTime, running: boxingRunning, updatedAt: boxingRunning ? new Date().toISOString() : null }
      })
    );
  };

  const handleRestLengthChange = (value: number) => {
    const clamped = Math.max(0, value);
    setRestLength(clamped);
    if (!boxingRunning && boxingPhase === 'rest') {
      setTimeLeft(clamped);
    }
    queueSave(
      buildSnapshot({
        boxing: { roundLength, restLength: clamped, rounds, currentRound, phase: boxingPhase, timeLeft, running: boxingRunning, updatedAt: boxingRunning ? new Date().toISOString() : null }
      })
    );
  };

  const handleRoundsChange = (value: number) => {
    const clamped = Math.max(1, value);
    const adjustedCurrent = Math.min(currentRound, clamped);
    setRounds(clamped);
    setCurrentRound(adjustedCurrent);
    queueSave(
      buildSnapshot({
        boxing: { roundLength, restLength, rounds: clamped, currentRound: adjustedCurrent, phase: boxingPhase, timeLeft, running: boxingRunning, updatedAt: boxingRunning ? new Date().toISOString() : null }
      })
    );
  };

  const handleAddGlass = () => {
    const next = Math.min(10000, hydrationConsumed + 250);
    setHydrationConsumed(next);
    queueSave(buildSnapshot({ hydration: { targetMl: hydrationTarget, consumedMl: next } }));
  };

  const handleHydrationReset = () => {
    setHydrationConsumed(0);
    queueSave(buildSnapshot({ hydration: { targetMl: hydrationTarget, consumedMl: 0 } }));
  };

  const handleHydrationTargetChange = (value: number) => {
    const clamped = Math.max(1000, value);
    setHydrationTarget(clamped);
    queueSave(buildSnapshot({ hydration: { targetMl: clamped, consumedMl: hydrationConsumed } }));
  };

  const saveStatusLabel = useMemo(() => {
    if (saveState === 'saving') return t('tools.saveStatus.saving');
    if (saveState === 'saved') return t('tools.saveStatus.saved');
    if (saveState === 'error') return t('tools.saveStatus.error');
    return '';
  }, [saveState, t]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-3xl font-bold text-white">{t('tools.title')}</h2>
          <p className="text-gray-400">{t('tools.subtitle')}</p>
        </div>
        {saveStatusLabel && <span className="text-xs uppercase tracking-wide text-gray-400">{saveStatusLabel}</span>}
      </div>

      {loading ? (
        <div className="bg-gray-800 p-8 rounded-lg flex justify-center">
          <Loader />
        </div>
      ) : loadError ? (
        <div className="bg-red-900/40 border border-red-500 text-red-200 p-4 rounded-lg text-center text-sm">
          {t('tools.loadError')}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col gap-4">
            <div>
              <h3 className="text-xl font-semibold text-white">{t('tools.stopwatch.title')}</h3>
              <p className="text-sm text-gray-400">{t('tools.stopwatch.subtitle')}</p>
            </div>
            <div className="text-center text-4xl font-mono text-indigo-300">{formatStopwatch(stopwatchTime)}</div>
            <div className="flex gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleStopwatchStart}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md disabled:bg-green-900"
                disabled={stopwatchRunning}
              >
                {t('tools.actions.start')}
              </button>
              <button
                type="button"
                onClick={handleStopwatchPause}
                className="flex-1 px-4 py-2 bg-yellow-500 text-black rounded-md"
              >
                {t('tools.actions.pause')}
              </button>
              <button
                type="button"
                onClick={handleStopwatchReset}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-md"
              >
                {t('tools.actions.reset')}
              </button>
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-lg shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-white">{t('tools.boxing.title')}</h3>
                <p className="text-sm text-gray-400">{t('tools.boxing.subtitle')}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-gray-500">{boxingPhase === 'round' ? t('tools.boxing.roundLabel') : t('tools.boxing.restLabel')}</p>
                <p className="text-3xl font-mono text-indigo-400">{formatSeconds(Math.max(0, timeLeft))}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <label className="block text-gray-400 mb-1">{t('tools.boxing.roundLength')}</label>
                <input
                  type="number"
                  min="30"
                  value={roundLength}
                  onChange={(e) => handleRoundLengthChange(Number(e.target.value))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-1">{t('tools.boxing.restLength')}</label>
                <input
                  type="number"
                  min="0"
                  value={restLength}
                  onChange={(e) => handleRestLengthChange(Number(e.target.value))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-1">{t('tools.boxing.rounds')}</label>
                <input
                  type="number"
                  min="1"
                  value={rounds}
                  onChange={(e) => handleRoundsChange(Number(e.target.value))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white"
                />
              </div>
            </div>
            <div className="text-sm text-gray-400">
              {t('tools.boxing.currentRound', { current: currentRound, total: rounds })}
            </div>
            <div className="flex gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleBoxingStart}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md"
              >
                {t('tools.actions.start')}
              </button>
              <button
                type="button"
                onClick={handleBoxingPause}
                className="flex-1 px-4 py-2 bg-yellow-500 text-black rounded-md"
              >
                {t('tools.actions.pause')}
              </button>
              <button
                type="button"
                onClick={handleBoxingReset}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-md"
              >
                {t('tools.actions.reset')}
              </button>
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-lg shadow-lg space-y-6 xl:col-span-2">
            <div>
              <h3 className="text-xl font-semibold text-white">{t('tools.orm.title')}</h3>
              <p className="text-sm text-gray-400">{t('tools.orm.subtitle')}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('tools.orm.weight')}</label>
                <input
                  type="number"
                  min="1"
                  value={ormWeight}
                  onChange={(e) => setOrmWeight(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('tools.orm.reps')}</label>
                <input
                  type="number"
                  min="1"
                  value={ormReps}
                  onChange={(e) => setOrmReps(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white"
                />
              </div>
            </div>
            <div className="bg-gray-900 p-4 rounded-md border border-gray-700 text-center">
              {estOneRepMax ? (
                <p className="text-2xl font-semibold text-indigo-300">{t('tools.orm.result', { value: estOneRepMax })}</p>
              ) : (
                <p className="text-sm text-gray-500">{t('tools.orm.placeholder')}</p>
              )}
            </div>

            <div>
              <h4 className="text-lg font-semibold text-white mb-2">{t('tools.hydration.title')}</h4>
              <p className="text-sm text-gray-400 mb-2">{t('tools.hydration.subtitle')}</p>
              <div className="flex items-center justify-between text-sm text-gray-400">
                <span>{t('tools.hydration.goal', { goal: hydrationTarget })}</span>
                <span>{hydrationProgress}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3 mt-2">
                <div className="bg-cyan-500 h-3 rounded-full" style={{ width: `${hydrationProgress}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <button
                  type="button"
                  onClick={handleAddGlass}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-md"
                >
                  {t('tools.hydration.addGlass')}
                </button>
                <button
                  type="button"
                  onClick={handleHydrationReset}
                  className="px-4 py-2 bg-gray-700 text-white rounded-md"
                >
                  {t('tools.actions.reset')}
                </button>
              </div>
              <div className="mt-3">
                <label className="block text-xs text-gray-400 mb-1">{t('tools.hydration.setGoal')}</label>
                <input
                  type="number"
                  min="1000"
                  value={hydrationTarget}
                  onChange={(e) => handleHydrationTargetChange(Number(e.target.value))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tools;
