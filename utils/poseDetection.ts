import { PoseResult, Landmark } from '../types';

declare const window: any;

let poseDetector: any = null;

const initializePoseDetector = async (): Promise<any> => {
  if (poseDetector) return poseDetector;

  poseDetector = new window.Pose({
    locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
  });
  
  poseDetector.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  return poseDetector;
};

export const detectPoseOnImage = async (imageElement: HTMLImageElement): Promise<PoseResult> => {
  const detector = await initializePoseDetector();
  const results = await detector.send({ image: imageElement });
  
  return {
    worldLandmarks: results?.poseWorldLandmarks || null,
    imageLandmarks: results?.poseLandmarks || null,
  };
};

// --- Angle Calculation & Drawing ---
const calculateAngle = (a: Landmark, b: Landmark, c: Landmark): number => {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) {
        angle = 360 - angle;
    }
    return Math.round(angle);
}

const drawAngle = (ctx: CanvasRenderingContext2D, p1: Landmark, p2: Landmark, p3: Landmark, scaledLandmarks: Landmark[]) => {
    if (!p1 || !p2 || !p3) return;
    
    const angle = calculateAngle(p1, p2, p3);
    const joint = scaledLandmarks.find(lm => lm === p2);
    if (joint) {
        ctx.fillStyle = "white";
        ctx.font = "bold 14px Arial";
        ctx.fillText(angle.toString(), joint.x + 10, joint.y);
    }
};

export const drawPoseOnCanvas = (
  ctx: CanvasRenderingContext2D,
  imageLandmarks: Landmark[] | null
) => {
  if (!imageLandmarks) return;
  const { canvas } = ctx;
  const { width, height } = canvas;
  
  ctx.save();
  ctx.clearRect(0, 0, width, height);

  const scaledLandmarks = imageLandmarks.map(landmark => ({
    ...landmark,
    x: landmark.x * width,
    y: landmark.y * height,
  }));
  
  // Draw connections (skeleton)
  window.drawConnectors(ctx, scaledLandmarks, window.POSE_CONNECTIONS, {
    color: 'rgba(59, 130, 246, 0.85)',
    lineWidth: 3
  });

  // Draw landmarks (joints)
  window.drawLandmarks(ctx, scaledLandmarks, {
    color: 'rgba(239, 68, 68, 0.85)',
    radius: 4
  });

  // Landmark indices from MediaPipe Pose
  const [
    NOSE, LEFT_EYE_INNER, LEFT_EYE, LEFT_EYE_OUTER, RIGHT_EYE_INNER, RIGHT_EYE, RIGHT_EYE_OUTER, 
    LEFT_EAR, RIGHT_EAR, MOUTH_LEFT, MOUTH_RIGHT, LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_ELBOW, 
    RIGHT_ELBOW, LEFT_WRIST, RIGHT_WRIST, LEFT_PINKY, RIGHT_PINKY, LEFT_INDEX, RIGHT_INDEX, 
    LEFT_THUMB, RIGHT_THUMB, LEFT_HIP, RIGHT_HIP, LEFT_KNEE, RIGHT_KNEE, LEFT_ANKLE, RIGHT_ANKLE, 
    LEFT_HEEL, RIGHT_HEEL, LEFT_FOOT_INDEX, RIGHT_FOOT_INDEX
  ] = Array.from({ length: 33 }, (_, i) => scaledLandmarks[i]);

  // Draw angles
  // Knees
  drawAngle(ctx, LEFT_HIP, LEFT_KNEE, LEFT_ANKLE, scaledLandmarks);
  drawAngle(ctx, RIGHT_HIP, RIGHT_KNEE, RIGHT_ANKLE, scaledLandmarks);
  // Hips
  drawAngle(ctx, LEFT_SHOULDER, LEFT_HIP, LEFT_KNEE, scaledLandmarks);
  drawAngle(ctx, RIGHT_SHOULDER, RIGHT_HIP, RIGHT_KNEE, scaledLandmarks);
  // Elbows
  drawAngle(ctx, LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST, scaledLandmarks);
  drawAngle(ctx, RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST, scaledLandmarks);

  ctx.restore();
};