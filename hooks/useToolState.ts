import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BoxingBellProfile, BoxingPhase, StopwatchLap, ToolState } from '../types';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const MAX_STOPWATCH_MS = 1000 * 60 * 60 * 10;
const MAX_HYDRATION_ML = 20000;
const LAP_LIMIT = 30;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const createLapId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `lap-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const BELL_PATTERNS: Record<
  BoxingBellProfile,
  Record<'start' | 'rest' | 'final', Array<[number, number, number]>>
> = {
  classic: {
    start: [
      [950, 0, 0.9],
      [650, 0.25, 0.9]
    ],
    rest: [[420, 0, 1]],
    final: [
      [550, 0, 1.1],
      [350, 0.35, 1]
    ]
  },
  digital: {
    start: [
      [1200, 0, 0.35],
      [1400, 0.15, 0.35],
      [1600, 0.3, 0.35]
    ],
    rest: [
      [900, 0, 0.2],
      [700, 0.2, 0.4]
    ],
    final: [
      [1600, 0, 0.4],
      [1200, 0.25, 0.4],
      [900, 0.5, 0.5]
    ]
  },
  whistle: {
    start: [
      [1800, 0, 0.6],
      [1100, 0.35, 0.4]
    ],
    rest: [[1000, 0, 0.6]],
    final: [
      [2000, 0, 0.7],
      [1500, 0.3, 0.7]
    ]
  }
};

const defaultToolState: ToolState = {
  hydration: { targetMl: 2500, consumedMl: 0 },
  stopwatch: { elapsedMs: 0, running: false, updatedAt: null, laps: [] },
  boxing: {
    roundLength: 180,
    restLength: 60,
    rounds: 3,
    currentRound: 1,
    phase: 'round',
    timeLeft: 180,
    running: false,
    updatedAt: null,
    warmupLength: 0,
    audioProfile: 'classic',
    volume: 0.7
  }
};

const useToolState = () => {
  const [hydrationTarget, setHydrationTarget] = useState(defaultToolState.hydration.targetMl);
  const [hydrationConsumed, setHydrationConsumed] = useState(defaultToolState.hydration.consumedMl);

  const [stopwatchRunning, setStopwatchRunning] = useState(defaultToolState.stopwatch.running);
  const [stopwatchTime, setStopwatchTime] = useState(defaultToolState.stopwatch.elapsedMs);
  const [stopwatchLaps, setStopwatchLaps] = useState<StopwatchLap[]>(defaultToolState.stopwatch.laps);

  const [roundLength, setRoundLength] = useState(defaultToolState.boxing.roundLength);
  const [restLength, setRestLength] = useState(defaultToolState.boxing.restLength);
  const [rounds, setRounds] = useState(defaultToolState.boxing.rounds);
  const [currentRound, setCurrentRound] = useState(defaultToolState.boxing.currentRound);
  const [boxingPhase, setBoxingPhase] = useState<BoxingPhase>(defaultToolState.boxing.phase);
  const [timeLeft, setTimeLeft] = useState(defaultToolState.boxing.timeLeft);
  const [boxingRunning, setBoxingRunning] = useState(defaultToolState.boxing.running);
  const [warmupLength, setWarmupLength] = useState(defaultToolState.boxing.warmupLength);
  const [boxingAudioProfile, setBoxingAudioProfile] = useState<BoxingBellProfile>(defaultToolState.boxing.audioProfile);
  const [boxingVolume, setBoxingVolume] = useState(defaultToolState.boxing.volume);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const stopwatchIntervalRef = useRef<number | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const pendingSaveRef = useRef<ToolState | null>(null);
  const prevBoxingPhaseRef = useRef<BoxingPhase>(defaultToolState.boxing.phase);

  const playBell = useCallback(
    (type: 'start' | 'rest' | 'final') => {
      if (typeof window === 'undefined' || boxingVolume <= 0) return;
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const profile = BELL_PATTERNS[boxingAudioProfile];
      const strikes = profile[type];
      const baseGain = clamp(boxingVolume, 0.05, 1);
      const startTime = ctx.currentTime;

      strikes.forEach(([frequency, offset, duration]) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, startTime + offset);
        gain.gain.setValueAtTime(0.0001, startTime + offset);
        gain.gain.exponentialRampToValueAtTime(baseGain, startTime + offset + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + offset + duration);
        oscillator.connect(gain).connect(ctx.destination);
        oscillator.start(startTime + offset);
        oscillator.stop(startTime + offset + duration);
      });

      window.setTimeout(() => {
        ctx.close().catch(() => undefined);
      }, 1500);
    },
    [boxingAudioProfile, boxingVolume]
  );

  const buildSnapshot = useCallback(
    (overrides?: Partial<ToolState>): ToolState => ({
      hydration: overrides?.hydration ?? { targetMl: hydrationTarget, consumedMl: hydrationConsumed },
      stopwatch:
        overrides?.stopwatch ??
        {
          elapsedMs: clamp(stopwatchTime, 0, MAX_STOPWATCH_MS),
          running: stopwatchRunning,
          updatedAt: stopwatchRunning ? new Date().toISOString() : null,
          laps: stopwatchLaps
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
          updatedAt: boxingRunning ? new Date().toISOString() : null,
          warmupLength,
          audioProfile: boxingAudioProfile,
          volume: boxingVolume
        }
    }),
    [
      hydrationConsumed,
      hydrationTarget,
      stopwatchLaps,
      stopwatchRunning,
      stopwatchTime,
      roundLength,
      restLength,
      rounds,
      currentRound,
      boxingPhase,
      timeLeft,
      boxingRunning,
      warmupLength,
      boxingAudioProfile,
      boxingVolume
    ]
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
        setStopwatchLaps(state.stopwatch.laps || []);
        setRoundLength(state.boxing.roundLength);
        setRestLength(state.boxing.restLength);
        setRounds(state.boxing.rounds);
        setCurrentRound(state.boxing.currentRound);
        setBoxingPhase(state.boxing.phase);
        setTimeLeft(state.boxing.timeLeft);
        setBoxingRunning(state.boxing.running);
        setWarmupLength(state.boxing.warmupLength ?? 0);
        setBoxingAudioProfile(state.boxing.audioProfile ?? 'classic');
        setBoxingVolume(typeof state.boxing.volume === 'number' ? state.boxing.volume : 0.7);
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

  useEffect(() => {
    if (stopwatchRunning) {
      stopwatchIntervalRef.current = window.setInterval(() => {
        setStopwatchTime(prev => Math.min(prev + 10, MAX_STOPWATCH_MS));
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
      setTimeLeft(prev => Math.max(prev - 1, 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [boxingRunning]);

  useEffect(() => {
    if (!boxingRunning) return;
    if (timeLeft > 0) return;

    if (boxingPhase === 'warmup') {
      setBoxingPhase('round');
      setTimeLeft(roundLength);
      return;
    }

    if (boxingPhase === 'round') {
      if (restLength > 0) {
        setBoxingPhase('rest');
        setTimeLeft(restLength);
      } else {
        setBoxingPhase('rest');
        setTimeLeft(0);
      }
      return;
    }

    if (currentRound >= rounds) {
      setBoxingRunning(false);
      setTimeLeft(0);
      playBell('final');
      return;
    }

    setCurrentRound(prev => prev + 1);
    setBoxingPhase('round');
    setTimeLeft(roundLength);
  }, [timeLeft, boxingPhase, boxingRunning, currentRound, rounds, restLength, roundLength, playBell]);

  useEffect(() => {
    if (!boxingRunning) {
      prevBoxingPhaseRef.current = boxingPhase;
      return;
    }
    if (prevBoxingPhaseRef.current !== boxingPhase) {
      playBell(boxingPhase === 'rest' ? 'rest' : 'start');
      prevBoxingPhaseRef.current = boxingPhase;
    }
  }, [boxingPhase, boxingRunning, playBell]);

  const hydrationProgress = useMemo(() => {
    if (!hydrationTarget) return 0;
    return Math.min(100, Math.round((hydrationConsumed / hydrationTarget) * 100));
  }, [hydrationConsumed, hydrationTarget]);

  const logHydration = (amount = 250) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const next = clamp(hydrationConsumed + amount, 0, MAX_HYDRATION_ML);
    setHydrationConsumed(next);
    queueSave(buildSnapshot({ hydration: { targetMl: hydrationTarget, consumedMl: next } }));
  };

  const resetHydration = () => {
    setHydrationConsumed(0);
    queueSave(buildSnapshot({ hydration: { targetMl: hydrationTarget, consumedMl: 0 } }));
  };

  const changeHydrationTarget = (value: number) => {
    const clamped = clamp(Number(value) || hydrationTarget, 500, MAX_HYDRATION_ML);
    setHydrationTarget(clamped);
    queueSave(buildSnapshot({ hydration: { targetMl: clamped, consumedMl: hydrationConsumed } }));
  };

  const persistStopwatchState = (partial: Partial<ToolState['stopwatch']>) => {
    const snapshot = buildSnapshot({
      stopwatch: {
        elapsedMs: partial.elapsedMs ?? stopwatchTime,
        running: partial.running ?? stopwatchRunning,
        updatedAt:
          'running' in partial
            ? partial.running
              ? new Date().toISOString()
              : null
            : stopwatchRunning
            ? new Date().toISOString()
            : null,
        laps: partial.laps ?? stopwatchLaps
      }
    });
    queueSave(snapshot);
  };

  const startStopwatch = () => {
    if (stopwatchRunning) return;
    setStopwatchRunning(true);
    persistStopwatchState({ running: true, elapsedMs: stopwatchTime });
  };

  const pauseStopwatch = () => {
    if (!stopwatchRunning) return;
    setStopwatchRunning(false);
    persistStopwatchState({ running: false, elapsedMs: stopwatchTime });
  };

  const resetStopwatch = () => {
    setStopwatchRunning(false);
    setStopwatchTime(0);
    setStopwatchLaps([]);
    persistStopwatchState({ running: false, elapsedMs: 0, laps: [] });
  };

  const addLap = () => {
    if (stopwatchTime === 0) return;
    const previousTotal = stopwatchLaps[stopwatchLaps.length - 1]?.totalMs ?? 0;
    const lapMs = Math.max(stopwatchTime - previousTotal, 0);
    if (lapMs === 0) return;
    const newLap: StopwatchLap = {
      id: createLapId(),
      totalMs: stopwatchTime,
      lapMs,
      createdAt: new Date().toISOString()
    };
    const nextLaps = [...stopwatchLaps.slice(-(LAP_LIMIT - 1)), newLap];
    setStopwatchLaps(nextLaps);
    persistStopwatchState({ laps: nextLaps, elapsedMs: stopwatchTime });
  };

  const clearLaps = () => {
    if (!stopwatchLaps.length) return;
    setStopwatchLaps([]);
    persistStopwatchState({ laps: [] });
  };

  const startBoxing = () => {
    if (boxingRunning) return;
    const initialPhase: BoxingPhase = warmupLength > 0 ? 'warmup' : 'round';
    const initialTime = initialPhase === 'warmup' ? warmupLength : roundLength;
    setCurrentRound(1);
    setBoxingPhase(initialPhase);
    setTimeLeft(initialTime);
    setBoxingRunning(true);
    prevBoxingPhaseRef.current = initialPhase;
    playBell('start');
    queueSave(
      buildSnapshot({
        boxing: {
          roundLength,
          restLength,
          rounds,
          currentRound: 1,
          phase: initialPhase,
          timeLeft: initialTime,
          running: true,
          updatedAt: new Date().toISOString(),
          warmupLength,
          audioProfile: boxingAudioProfile,
          volume: boxingVolume
        }
      })
    );
  };

  const pauseBoxing = () => {
    if (!boxingRunning) return;
    setBoxingRunning(false);
    queueSave(
      buildSnapshot({
        boxing: {
          roundLength,
          restLength,
          rounds,
          currentRound,
          phase: boxingPhase,
          timeLeft,
          running: false,
          updatedAt: null,
          warmupLength,
          audioProfile: boxingAudioProfile,
          volume: boxingVolume
        }
      })
    );
  };

  const resetBoxing = () => {
    const initialPhase: BoxingPhase = warmupLength > 0 ? 'warmup' : 'round';
    const initialTime = initialPhase === 'warmup' ? warmupLength : roundLength;
    setBoxingRunning(false);
    setCurrentRound(1);
    setBoxingPhase(initialPhase);
    setTimeLeft(initialTime);
    queueSave(
      buildSnapshot({
        boxing: {
          roundLength,
          restLength,
          rounds,
          currentRound: 1,
          phase: initialPhase,
          timeLeft: initialTime,
          running: false,
          updatedAt: null,
          warmupLength,
          audioProfile: boxingAudioProfile,
          volume: boxingVolume
        }
      })
    );
  };

  const changeRoundLength = (value: number) => {
    const clampedValue = clamp(Number(value) || roundLength, 30, 900);
    setRoundLength(clampedValue);
    if (!boxingRunning && boxingPhase === 'round') {
      setTimeLeft(clampedValue);
    }
    queueSave(
      buildSnapshot({
        boxing: {
          roundLength: clampedValue,
          restLength,
          rounds,
          currentRound,
          phase: boxingPhase,
          timeLeft: boxingPhase === 'round' ? Math.min(timeLeft, clampedValue) : timeLeft,
          running: boxingRunning,
          updatedAt: boxingRunning ? new Date().toISOString() : null,
          warmupLength,
          audioProfile: boxingAudioProfile,
          volume: boxingVolume
        }
      })
    );
  };

  const changeRestLength = (value: number) => {
    const clampedValue = clamp(Number(value) || restLength, 0, 600);
    setRestLength(clampedValue);
    queueSave(
      buildSnapshot({
        boxing: {
          roundLength,
          restLength: clampedValue,
          rounds,
          currentRound,
          phase: boxingPhase,
          timeLeft,
          running: boxingRunning,
          updatedAt: boxingRunning ? new Date().toISOString() : null,
          warmupLength,
          audioProfile: boxingAudioProfile,
          volume: boxingVolume
        }
      })
    );
  };

  const changeRounds = (value: number) => {
    const clampedValue = clamp(Number(value) || rounds, 1, 20);
    setRounds(clampedValue);
    const adjustedCurrent = Math.min(currentRound, clampedValue);
    setCurrentRound(adjustedCurrent);
    queueSave(
      buildSnapshot({
        boxing: {
          roundLength,
          restLength,
          rounds: clampedValue,
          currentRound: adjustedCurrent,
          phase: boxingPhase,
          timeLeft,
          running: boxingRunning,
          updatedAt: boxingRunning ? new Date().toISOString() : null,
          warmupLength,
          audioProfile: boxingAudioProfile,
          volume: boxingVolume
        }
      })
    );
  };

  const changeWarmupLength = (value: number) => {
    const clampedValue = clamp(Number(value) || warmupLength, 0, 600);
    setWarmupLength(clampedValue);
    if (!boxingRunning && boxingPhase === 'warmup') {
      setTimeLeft(clampedValue);
    }
    queueSave(
      buildSnapshot({
        boxing: {
          roundLength,
          restLength,
          rounds,
          currentRound,
          phase: boxingPhase,
          timeLeft: boxingPhase === 'warmup' ? clampedValue : timeLeft,
          running: boxingRunning,
          updatedAt: boxingRunning ? new Date().toISOString() : null,
          warmupLength: clampedValue,
          audioProfile: boxingAudioProfile,
          volume: boxingVolume
        }
      })
    );
  };

  const changeAudioProfile = (profile: BoxingBellProfile) => {
    setBoxingAudioProfile(profile);
    queueSave(
      buildSnapshot({
        boxing: {
          roundLength,
          restLength,
          rounds,
          currentRound,
          phase: boxingPhase,
          timeLeft,
          running: boxingRunning,
          updatedAt: boxingRunning ? new Date().toISOString() : null,
          warmupLength,
          audioProfile: profile,
          volume: boxingVolume
        }
      })
    );
  };

  const changeVolume = (value: number) => {
    const clampedValue = clamp(Number(value) || boxingVolume, 0, 1);
    setBoxingVolume(clampedValue);
    queueSave(
      buildSnapshot({
        boxing: {
          roundLength,
          restLength,
          rounds,
          currentRound,
          phase: boxingPhase,
          timeLeft,
          running: boxingRunning,
          updatedAt: boxingRunning ? new Date().toISOString() : null,
          warmupLength,
          audioProfile: boxingAudioProfile,
          volume: clampedValue
        }
      })
    );
  };

  const applyPreset = (
    preset: { roundLength: number; restLength: number; rounds: number; warmupLength?: number },
    autoStart = true
  ) => {
    const rl = clamp(Number(preset.roundLength) || roundLength, 10, 900);
    const rest = clamp(Number(preset.restLength) || restLength, 0, 600);
    const r = clamp(Number(preset.rounds) || rounds, 1, 20);
    const warm = clamp(Number(preset.warmupLength ?? warmupLength) || 0, 0, 600);
    const initialPhase: BoxingPhase = warm > 0 ? 'warmup' : 'round';
    const initialTime = initialPhase === 'warmup' ? warm : rl;

    setRoundLength(rl);
    setRestLength(rest);
    setRounds(r);
    setWarmupLength(warm);
    setCurrentRound(1);
    setBoxingPhase(initialPhase);
    setTimeLeft(initialTime);
    setBoxingRunning(autoStart);
    prevBoxingPhaseRef.current = initialPhase;

    queueSave(
      buildSnapshot({
        boxing: {
          roundLength: rl,
          restLength: rest,
          rounds: r,
          currentRound: 1,
          phase: initialPhase,
          timeLeft: initialTime,
          running: autoStart,
          updatedAt: autoStart ? new Date().toISOString() : null,
          warmupLength: warm,
          audioProfile: boxingAudioProfile,
          volume: boxingVolume
        }
      })
    );

    if (autoStart) {
      playBell('start');
    }
  };

  return {
    loading,
    loadError,
    saveState,
    hydration: {
      target: hydrationTarget,
      consumed: hydrationConsumed,
      progress: hydrationProgress,
      addGlass: () => logHydration(250),
      logAmount: logHydration,
      reset: resetHydration,
      changeTarget: changeHydrationTarget
    },
    stopwatch: {
      time: stopwatchTime,
      running: stopwatchRunning,
      laps: stopwatchLaps,
      start: startStopwatch,
      pause: pauseStopwatch,
      reset: resetStopwatch,
      addLap,
      clearLaps
    },
    boxing: {
      roundLength,
      restLength,
      rounds,
      currentRound,
      phase: boxingPhase,
      timeLeft,
      running: boxingRunning,
      warmupLength,
      audioProfile: boxingAudioProfile,
      volume: boxingVolume,
      start: startBoxing,
      pause: pauseBoxing,
      reset: resetBoxing,
      changeRoundLength,
      changeRestLength,
      changeRounds,
      changeWarmupLength,
      changeAudioProfile,
      changeVolume,
      applyPreset
    }
  };
};

export default useToolState;
