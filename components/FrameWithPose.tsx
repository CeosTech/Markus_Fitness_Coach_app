import React, { useRef, useEffect } from 'react';
import { drawPoseOnCanvas } from '../utils/poseDetection';
import { Landmark } from '../types';

interface FrameWithPoseProps {
  imageData: string;
  imageLandmarks: Landmark[] | null;
  width: number;
  height: number;
}

const FrameWithPose: React.FC<FrameWithPoseProps> = ({ imageData, imageLandmarks, width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas before redrawing
    ctx.clearRect(0, 0, width, height);

    if (imageLandmarks) {
        drawPoseOnCanvas(ctx, imageLandmarks);
    }
  }, [imageLandmarks, width, height]);

  return (
    <div className="relative flex-shrink-0" style={{ width: `${width}px`, height: `${height}px` }}>
      <img src={`data:image/jpeg;base64,${imageData}`} alt="Workout frame" width={width} height={height} className="block rounded-t-md" />
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="absolute top-0 left-0"
      />
    </div>
  );
};

export default FrameWithPose;