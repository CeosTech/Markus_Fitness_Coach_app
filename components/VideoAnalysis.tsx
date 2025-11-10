
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { analyzeVideoWithPose } from '../services/geminiService';
import Loader from './shared/Loader';
import { renderMarkdown } from '../utils/markdown';
import { FrameData, User } from '../types';
import { detectPoseOnImage } from '../utils/poseDetection';
import FrameWithPose from './FrameWithPose';
import UpgradeNotice from './shared/UpgradeNotice';
import { useTranslation } from '../i18n/LanguageContext';
import { useCMS } from '../contexts/CMSContext';

interface VideoAnalysisProps {
  currentUser: User;
}

const DEFAULT_FREE_VIDEO_LIMIT = 5;

const VideoAnalysis: React.FC<VideoAnalysisProps> = ({ currentUser }) => {
  const { t, language } = useTranslation();
  const { getValue } = useCMS();
  const freeTierLimit = Number(getValue('limits.freeVideoMonthly', DEFAULT_FREE_VIDEO_LIMIT)) || DEFAULT_FREE_VIDEO_LIMIT;
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [frameData, setFrameData] = useState<FrameData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState('');
  const [error, setError] = useState('');
  const [notification, setNotification] = useState('');
  const [exerciseName, setExerciseName] = useState('');
  const [useThinkingMode, setUseThinkingMode] = useState(false);
  const [numFramesToExtract, setNumFramesToExtract] = useState(10);
  const [usageCount, setUsageCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (currentUser.subscriptionTier === 'free') {
      fetch('/api/analysis/stats')
        .then(res => res.json())
        .then(data => setUsageCount(data.video || 0))
        .catch(err => console.error("Could not fetch usage stats", err));
    }
  }, [currentUser.subscriptionTier]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setFrameData([]);
      setAnalysis('');
      setError('');
      setNotification('');
    }
  };

  const extractFrames = useCallback(async () => {
    if (!videoFile || !videoRef.current || !canvasRef.current) return;
  
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if(!context) return;
  
    setIsLoading(true);
    setError(t('videoAnalysis.loadingVideo'));
    
    const videoUrl = URL.createObjectURL(videoFile);
    video.src = videoUrl;

    await new Promise<void>(resolve => {
        video.onloadeddata = () => resolve();
        video.onerror = () => {
            setError(t('videoAnalysis.errorLoadingVideo'));
            setIsLoading(false);
            resolve();
        }
    });

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
      
    const duration = video.duration;
    if(duration === 0) {
        setError(t('videoAnalysis.errorVideoDuration'));
        setIsLoading(false);
        URL.revokeObjectURL(videoUrl);
        return;
    }

    const interval = duration / numFramesToExtract;
    const extractedFrames: FrameData[] = [];
    
    setError(t('videoAnalysis.extractingFrames', { count: numFramesToExtract }));

    for (let i = 0; i < numFramesToExtract; i++) {
        const currentTime = i * interval;
        video.currentTime = currentTime;
        await new Promise(resolve => { video.onseeked = resolve; });
        
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        
        const imageData = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
        
        const imageElement = new Image();
        const imageLoadPromise = new Promise<void>(resolve => { imageElement.onload = () => resolve(); });
        imageElement.src = `data:image/jpeg;base64,${imageData}`;
        await imageLoadPromise;
        
        const poseResult = await detectPoseOnImage(imageElement);
        
        extractedFrames.push({
            imageData,
            poseResult,
            width: video.videoWidth,
            height: video.videoHeight
        });
        
        setFrameData([...extractedFrames]);
    }
    
    setIsLoading(false);
    setError(extractedFrames.length > 0 ? '' : t('videoAnalysis.errorCouldNotExtract'));
    URL.revokeObjectURL(videoUrl);

  }, [videoFile, numFramesToExtract, t]);

  const saveAnalysis = async (result: string, frames: FrameData[]) => {
    try {
        const poseData = frames.map(f => f.poseResult.worldLandmarks);
        const poseDataJson = JSON.stringify(poseData);
        await fetch('/api/analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'video',
                exerciseName: exerciseName,
                result: result,
                poseDataJson: poseDataJson
            })
        });
        setNotification(t('videoAnalysis.analysisSaved'));
        if (currentUser.subscriptionTier === 'free') {
          setUsageCount(prev => prev + 1);
        }
        setTimeout(() => setNotification(''), 3000);
    } catch (err) {
        console.error("Failed to save analysis:", err);
        setNotification(t('videoAnalysis.analysisSaveFailed'));
         setTimeout(() => setNotification(''), 3000);
    }
  };

  const handleAnalyze = async () => {
    if (frameData.length === 0) {
        setError(t('videoAnalysis.errorExtractFirst'));
        return;
    }
    if (!exerciseName) {
        setError(t('videoAnalysis.errorEnterExercise'));
        return;
    }

    setIsLoading(true);
    setAnalysis('');
    setError(t('videoAnalysis.sendingToAI'));
    setNotification('');

    try {
        const prompt = `Analyze my weightlifting form for the exercise "${exerciseName}".`;
        const landmarksPerFrame = frameData.map(fd => fd.poseResult.worldLandmarks);
        const frameImages = frameData.map(fd => fd.imageData);

        const result = await analyzeVideoWithPose(frameImages, landmarksPerFrame, prompt, useThinkingMode, language);
        setAnalysis(result);
        await saveAnalysis(result, frameData);
        setError('');
    } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
        setIsLoading(false);
    }
  };

  const isUsageLimitReached = currentUser.subscriptionTier === 'free' && usageCount >= freeTierLimit;

  if (isUsageLimitReached) {
    return <UpgradeNotice 
      featureName={t('sidebar.videoAnalysis')} 
      message={t('videoAnalysis.freeTierUsage', { count: usageCount, limit: freeTierLimit })}
    />;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <h2 className="text-3xl font-bold text-white">{t('videoAnalysis.title')}</h2>
      {currentUser.subscriptionTier === 'free' && (
        <div className="bg-blue-900/50 border border-blue-700 text-blue-200 text-center p-2 rounded-lg text-sm">
          {t('videoAnalysis.freeTierUsage', { count: usageCount, limit: freeTierLimit })}
        </div>
      )}
      {notification && <div className="bg-green-600/50 border border-green-500 text-white text-center p-2 rounded-lg">{notification}</div>}
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg space-y-4">
        <div>
          <label htmlFor="video-upload" className="block text-sm font-medium text-gray-300 mb-2">
            {t('videoAnalysis.uploadLabel')}
          </label>
          <input
            id="video-upload"
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-500 file:text-white hover:file:bg-indigo-600"
          />
        </div>

        {videoFile && (
            <div className="space-y-6">
                <div>
                  <label htmlFor="frame-slider" className="block text-sm font-medium text-gray-300 mb-2">
                    {t('videoAnalysis.analysisDetailLabel')} <span className="font-bold text-indigo-300">{numFramesToExtract}</span>
                  </label>
                  <input
                    id="frame-slider"
                    type="range"
                    min="5"
                    max="20"
                    step="1"
                    value={numFramesToExtract}
                    onChange={(e) => setNumFramesToExtract(Number(e.target.value))}
                    className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <button 
                        onClick={extractFrames} 
                        disabled={isLoading || frameData.length > 0}
                        className="w-full sm:w-auto px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-500 transition-colors"
                    >
                        {frameData.length > 0 ? t('videoAnalysis.extractButtonCompleted', { count: frameData.length }) : t('videoAnalysis.extractButton')}
                    </button>
                     <input
                        type="text"
                        value={exerciseName}
                        onChange={(e) => setExerciseName(e.target.value)}
                        placeholder={t('videoAnalysis.exercisePlaceholder')}
                        className="w-full sm:flex-1 bg-gray-700 border border-gray-600 rounded-md px-4 py-2 text-white placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
            </div>
        )}
      </div>

       {frameData.length > 0 && (
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold text-gray-300 mb-4">{t('videoAnalysis.framesHeader')}</h3>
            <div className="flex overflow-x-auto space-x-4 pb-4">
            {frameData.map((frame, index) => {
                const aspectRatio = frame.width / frame.height;
                const displayHeight = 150;
                const displayWidth = displayHeight * aspectRatio;
                return (
                    <div key={index} className="flex-shrink-0 bg-gray-900 rounded-md overflow-hidden shadow-lg">
                    <FrameWithPose
                        imageData={frame.imageData}
                        imageLandmarks={frame.poseResult.imageLandmarks}
                        width={displayWidth}
                        height={displayHeight}
                    />
                    <p className="text-xs text-center text-gray-400 p-1">{t('videoAnalysis.frameLabel', { index: index + 1 })}</p>
                    </div>
                );
            })}
            </div>
             <div className="mt-4 space-y-4">
                 <div className="flex items-center space-x-3">
                    <input type="checkbox" id="thinking-mode" checked={useThinkingMode} onChange={(e) => setUseThinkingMode(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <label htmlFor="thinking-mode" className="text-sm font-medium text-gray-300">
                        {t('videoAnalysis.thinkingModeLabel')}
                    </label>
                </div>
                <button 
                    onClick={handleAnalyze} 
                    disabled={isLoading}
                    className="w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 disabled:bg-gray-500 transition-colors"
                >
                    {t('videoAnalysis.analyzeButton')}
                </button>
            </div>
        </div>
        )}
      

      {(isLoading || error || analysis) && (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          {isLoading && <div className="flex flex-col items-center"><Loader /><p className="mt-2 text-indigo-300">{error || t('videoAnalysis.analyzingVideo')}</p></div>}
          {error && !isLoading && <p className="text-red-400">{error}</p>}
          {analysis && (
            <div>
              <h3 className="text-xl font-semibold mb-3 text-indigo-300">{t('videoAnalysis.analysisResultHeader')}</h3>
              <div className="bg-gray-900 p-4 rounded-md border border-gray-700">
                {renderMarkdown(analysis)}
              </div>
            </div>
          )}
        </div>
      )}
      
      <video ref={videoRef} className="hidden" muted playsInline />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default VideoAnalysis;
