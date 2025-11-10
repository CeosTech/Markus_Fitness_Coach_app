
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenaiBlob } from '@google/genai';
import { decode, encode, decodeAudioData } from '../utils/audio';
import { User } from '../types';
import UpgradeNotice from './shared/UpgradeNotice';
import { detectPoseOnImage } from '../utils/poseDetection';
import Loader from './shared/Loader';
import { useTranslation } from '../i18n/LanguageContext';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

type SessionStatus = 'IDLE' | 'PREPARING' | 'CONNECTING' | 'ACTIVE' | 'ENDED' | 'ERROR';

interface TranscriptionTurn {
    userInput: string;
    modelOutput: string;
}

interface LiveCoachProps {
  currentUser: User;
}

const FRAME_RATE = 1; // Send 1 frame per second
const JPEG_QUALITY = 0.7;

const LiveCoach: React.FC<LiveCoachProps> = ({ currentUser }) => {
    const { t, language } = useTranslation();
    const [status, setStatus] = useState<SessionStatus>('IDLE');
    const [error, setError] = useState<string | null>(null);
    const [transcriptionHistory, setTranscriptionHistory] = useState<TranscriptionTurn[]>([]);
    const [currentInput, setCurrentInput] = useState('');
    const [currentOutput, setCurrentOutput] = useState('');
    
    // Wearable simulation state
    const [heartRate, setHeartRate] = useState(80);
    const [recoveryScore, setRecoveryScore] = useState(90);

    const sessionPromiseRef = useRef<any>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const frameIntervalRef = useRef<number | null>(null);
    const wearableIntervalRef = useRef<number | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    const nextStartTimeRef = useRef(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

    const currentInputRef = useRef('');
    const currentOutputRef = useRef('');

    const stopSession = useCallback(() => {
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then((session: any) => session.close());
            sessionPromiseRef.current = null;
        }

        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }

        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        
        if (frameIntervalRef.current) window.clearInterval(frameIntervalRef.current);
        if (wearableIntervalRef.current) window.clearInterval(wearableIntervalRef.current);
        frameIntervalRef.current = null;
        wearableIntervalRef.current = null;

        inputAudioContextRef.current?.close();
        outputAudioContextRef.current?.close();

        audioSourcesRef.current.forEach(source => source.stop());
        audioSourcesRef.current.clear();
        nextStartTimeRef.current = 0;
        
        setStatus('ENDED');
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => stopSession();
    }, [stopSession]);
    
    // Wearable simulation effect
    useEffect(() => {
        if (status === 'ACTIVE') {
            setHeartRate(120); // Initial workout HR
            wearableIntervalRef.current = window.setInterval(() => {
                setHeartRate(hr => Math.min(180, Math.max(110, hr + (Math.random() - 0.4) * 5)));
                setRecoveryScore(rec => Math.max(30, rec - 0.1));
            }, 2000);
        } else {
            setHeartRate(80);
            setRecoveryScore(90);
        }
        return () => {
             if (wearableIntervalRef.current) window.clearInterval(wearableIntervalRef.current);
        }
    }, [status]);


    const blobToBase64 = (blob: Blob): Promise<string> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                    resolve(reader.result.split(',')[1]);
                } else {
                    reject('Failed to convert blob to base64');
                }
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });

    const handleStartSession = async () => {
        if (status === 'ACTIVE' || status === 'CONNECTING' || status === 'PREPARING') return;
        
        setStatus('PREPARING');
        setError(null);
        setTranscriptionHistory([]);
        setCurrentInput('');
        setCurrentOutput('');
        currentInputRef.current = '';
        currentOutputRef.current = '';

        try {
            const systemInstruction = t('liveCoach.systemInstructionAuto', { 
              language: language
            });

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            mediaStreamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            
            setStatus('CONNECTING');
            
            inputAudioContextRef.current = new ((window as any).AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new ((window as any).AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        setStatus('ACTIVE');
                        
                        // Audio processing
                        const audioSource = inputAudioContextRef.current!.createMediaStreamSource(stream);
                        scriptProcessorRef.current = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob: GenaiBlob = {
                                data: encode(new Uint8Array(new Int16Array(inputData.map(x => x * 32768)).buffer)),
                                mimeType: 'audio/pcm;rate=16000'
                            };
                            sessionPromiseRef.current?.then((session: any) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        audioSource.connect(scriptProcessorRef.current);
                        scriptProcessorRef.current.connect(inputAudioContextRef.current!.destination);

                        // Video, Pose, and Wearable data processing
                        const videoEl = videoRef.current;
                        const canvasEl = canvasRef.current;
                        if(videoEl && canvasEl) {
                           const ctx = canvasEl.getContext('2d');
                           frameIntervalRef.current = window.setInterval(() => {
                               if (!ctx) return;
                               canvasEl.width = videoEl.videoWidth;
                               canvasEl.height = videoEl.videoHeight;
                               ctx.drawImage(videoEl, 0, 0, videoEl.videoWidth, videoEl.videoHeight);
                               
                               canvasEl.toBlob(async (blob) => {
                                   if (blob) {
                                       const base64Data = await blobToBase64(blob);
                                       const imageElement = new Image();
                                       imageElement.src = `data:image/jpeg;base64,${base64Data}`;
                                       await new Promise<void>(r => {imageElement.onload = () => r()});

                                       if (imageElement.width > 0 && imageElement.height > 0) {
                                           const poseResult = await detectPoseOnImage(imageElement);
                                           
                                           sessionPromiseRef.current?.then((session: any) => {
                                                // Send all data streams together
                                                session.sendRealtimeInput({
                                                    media: { data: base64Data, mimeType: 'image/jpeg' }
                                                });
                                                if (poseResult && poseResult.worldLandmarks) {
                                                    session.sendRealtimeInput({ text: `POSE_DATA: ${JSON.stringify(poseResult.worldLandmarks)}` });
                                                }
                                                // Send current wearable data
                                                session.sendRealtimeInput({ text: `PHYSIO_DATA: ${JSON.stringify({ heartRate: Math.round(heartRate), recoveryScore: Math.round(recoveryScore) })}` });
                                           });
                                       }
                                   }
                               }, 'image/jpeg', JPEG_QUALITY);
                           }, 1000 / FRAME_RATE);
                        }
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (audioData && outputAudioContextRef.current) {
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContextRef.current.currentTime);
                            const audioBuffer = await decodeAudioData(decode(audioData), outputAudioContextRef.current, 24000, 1);
                            const source = outputAudioContextRef.current.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputAudioContextRef.current.destination);
                            source.onended = () => audioSourcesRef.current.delete(source);
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            audioSourcesRef.current.add(source);
                        }
                        if (message.serverContent?.inputTranscription) {
                            currentInputRef.current += message.serverContent.inputTranscription.text;
                            setCurrentInput(currentInputRef.current);
                        }
                        if (message.serverContent?.outputTranscription) {
                            currentOutputRef.current += message.serverContent.outputTranscription.text;
                            setCurrentOutput(currentOutputRef.current);
                        }
                        if (message.serverContent?.turnComplete) {
                            const turn: TranscriptionTurn = { userInput: currentInputRef.current, modelOutput: currentOutputRef.current };
                            setTranscriptionHistory(prev => [...prev, turn]);
                            currentInputRef.current = '';
                            currentOutputRef.current = '';
                            setCurrentInput('');
                            setCurrentOutput('');
                        }
                        if (message.serverContent?.interrupted) {
                            audioSourcesRef.current.forEach(source => source.stop());
                            audioSourcesRef.current.clear();
                            nextStartTimeRef.current = 0;
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        setError(`Session error: ${e.message}`);
                        setStatus('ERROR');
                        stopSession();
                    },
                    onclose: () => {
                        setStatus('ENDED');
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    systemInstruction: systemInstruction,
                },
            });
        } catch (err) {
            setError(err instanceof Error ? `Failed to start session: ${err.message}` : 'An unknown error occurred.');
            setStatus('ERROR');
        }
    };
    
    if (currentUser.subscriptionTier === 'free') {
        return <UpgradeNotice featureName={t('sidebar.liveCoach')} />;
    }

    const renderPreSessionUI = () => (
      <div className="p-6 flex flex-col items-center justify-center text-center h-full">
          <h3 className="text-xl font-semibold text-white">{t('liveCoach.preSessionHeaderAuto')}</h3>
          <p className="text-gray-400 mt-2 mb-6">{t('liveCoach.preSessionPromptAuto')}</p>
          {error && <p className="text-red-400 mt-4">{error}</p>}
          <button onClick={handleStartSession} className="w-full max-w-sm mt-4 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed">
              {t('liveCoach.startButton')}
          </button>
      </div>
    );
    
    const WearableDisplay = () => (
        <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700 flex items-center justify-around">
             <div className="text-center">
                <p className="text-xs text-red-400 font-semibold">{t('liveCoach.heartRate')}</p>
                <p className="text-lg font-bold text-white">{Math.round(heartRate)} <span className="text-xs">BPM</span></p>
             </div>
             <div className="text-center">
                <p className="text-xs text-green-400 font-semibold">{t('liveCoach.recovery')}</p>
                <p className="text-lg font-bold text-white">{Math.round(recoveryScore)}<span className="text-xs">%</span></p>
             </div>
        </div>
    )

    const renderActiveSessionUI = () => (
      <div className="flex-1 p-6 flex flex-col md:flex-row gap-6 overflow-hidden">
          <div className="md:w-1/2 flex flex-col gap-4">
              <video ref={videoRef} autoPlay muted className="w-full h-auto rounded-lg bg-black flex-grow object-cover"></video>
              <WearableDisplay />
          </div>
          <div className="md:w-1/2 flex flex-col space-y-4 overflow-y-auto">
              {transcriptionHistory.map((turn, index) => (
                  <div key={index} className="space-y-2">
                      <p><strong className="text-indigo-300">{t('liveCoach.you')}</strong> {turn.userInput}</p>
                      <p><strong className="text-green-300">{t('liveCoach.coach')}</strong> {turn.modelOutput}</p>
                      <hr className="border-gray-700"/>
                  </div>
              ))}
              {(status === 'ACTIVE' || status === 'CONNECTING') && (
                  <div className="space-y-2 pt-4">
                      <p><strong className="text-indigo-300">{t('liveCoach.you')}</strong> {currentInput}<span className="animate-pulse">_</span></p>
                      <p><strong className="text-green-300">{t('liveCoach.coach')}</strong> {currentOutput}<span className="animate-pulse">_</span></p>
                  </div>
              )}
          </div>
      </div>
    );

    return (
        <div className="flex flex-col h-full max-w-4xl mx-auto bg-gray-800 rounded-lg shadow-2xl">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">{t('liveCoach.title')}</h2>
                <div className={`px-3 py-1 text-xs font-semibold rounded-full ${
                    status === 'ACTIVE' ? 'bg-green-500 text-white' :
                    status === 'CONNECTING' || status === 'PREPARING' ? 'bg-yellow-500 text-black' :
                    'bg-gray-600 text-gray-200'
                }`}>{t(`liveCoach.status.${status.toLowerCase()}`)}</div>
            </div>

            {status === 'IDLE' || status === 'ENDED' || status === 'ERROR' ? renderPreSessionUI() : null}
            {status === 'PREPARING' && <div className="flex flex-col items-center justify-center h-full"><Loader /><p className="mt-4 text-indigo-300">{t('liveCoach.preparation.connecting')}</p></div>}
            {(status === 'ACTIVE' || status === 'CONNECTING') && renderActiveSessionUI()}

            <div className="p-4 border-t border-gray-700">
                {status !== 'IDLE' && status !== 'ENDED' && status !== 'ERROR' ? (
                    <button onClick={stopSession} className="w-full py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors">
                        {t('liveCoach.stopButton')}
                    </button>
                ) : null}
            </div>
            <canvas ref={canvasRef} className="hidden"></canvas>
        </div>
    );
};

export default LiveCoach;
