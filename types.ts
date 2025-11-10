
export type ViewType = 'video' | 'image' | 'chat' | 'live' | 'profile' | 'plan' | 'tools' | 'subscription' | 'admin';

export type Language = 'en' | 'fr' | 'es';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export type MarketingPage = 'home' | 'features' | 'pricing' | 'signin' | 'signup' | 'about' | 'careers' | 'privacy' | 'terms';

export interface Goal {
  id: number;
  text: string;
  completed: boolean;
}

export interface User {
  id: number;
  email: string;
  subscriptionTier: 'free' | 'pro' | 'elite';
  isAdmin?: boolean;
  firstName?: string | null;
  birthDate?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  goals?: Goal[];
}

export interface AnalysisRecord {
  id: number;
  userId: number;
  type: 'video' | 'image';
  exerciseName?: string;
  prompt?: string;
  result: string;
  imageBase64?: string;
  createdAt: string;
  poseDataJson?: string;
}

// Types for Pose Detection
export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface PoseResult {
  worldLandmarks: Landmark[] | null;
  imageLandmarks: Landmark[] | null;
}

export interface FrameData {
  imageData: string; // base64
  poseResult: PoseResult;
  width: number;
  height: number;
}

// Types for Workout Plan
export interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  notes?: string;
}

export interface WorkoutDay {
  day: number;
  focus: string;
  exercises: Exercise[];
}

export interface WorkoutPlan {
  planName: string;
  durationWeeks: number;
  daysPerWeek: number;
  planDetails: WorkoutDay[];
}

export interface SavedWorkoutPlan extends WorkoutPlan {
  id: number;
  createdAt: string;
}

export interface HydrationState {
  targetMl: number;
  consumedMl: number;
}

export interface StopwatchState {
  elapsedMs: number;
  running: boolean;
  updatedAt: string | null;
}

export type BoxingPhase = 'round' | 'rest';

export interface BoxingState {
  roundLength: number;
  restLength: number;
  rounds: number;
  currentRound: number;
  phase: BoxingPhase;
  timeLeft: number;
  running: boolean;
  updatedAt: string | null;
}

export interface ToolState {
  hydration: HydrationState;
  stopwatch: StopwatchState;
  boxing: BoxingState;
}

export interface GamificationBadge {
  id: string;
  earned: boolean;
}

export interface GamificationStats {
  totalAnalyses: number;
  weeklyAnalyses: number;
  streakDays: number;
  xp: number;
  level: number;
  nextLevelXp: number;
  plansCreated: number;
  goalsCompleted: number;
  lastAnalysisDate: string | null;
  badges: GamificationBadge[];
}
