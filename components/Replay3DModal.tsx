import React, { useRef, useEffect, useState } from 'react';
// FIX: Changed CDN URL import to a standard module import for better compatibility with build tools.
import * as THREE from 'three';
import { Landmark } from '../types';
import { useTranslation } from '../i18n/LanguageContext';

interface Replay3DModalProps {
    poseDataJson: string;
    onClose: () => void;
}

const POSE_CONNECTIONS: [number, number][] = [
    [11, 12], [12, 14], [14, 16], [11, 13], [13, 15], [23, 24], [24, 26], 
    [26, 28], [23, 25], [25, 27], [27, 29], [11, 23], [12, 24]
];

const Replay3DModal: React.FC<Replay3DModalProps> = ({ poseDataJson, onClose }) => {
    const { t } = useTranslation();
    const mountRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef(new THREE.Scene());
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    // FIX: Initialize useRef with null to prevent "Expected 1 arguments, but got 0" error.
    const animationFrameRef = useRef<number | null>(null);
    const skeletonRef = useRef(new THREE.Group());
    const [isPlaying, setIsPlaying] = useState(true);
    const [currentFrame, setCurrentFrame] = useState(0);
    const [totalFrames, setTotalFrames] = useState(0);
    const poseDataRef = useRef<Landmark[][]>([]);
    
    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;
        
        // --- Setup Scene ---
        const scene = sceneRef.current;
        scene.background = new THREE.Color(0x111827);
        
        cameraRef.current = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 1000);
        cameraRef.current.position.z = 2.5;

        rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
        rendererRef.current.setSize(mount.clientWidth, mount.clientHeight);
        mount.appendChild(rendererRef.current.domElement);

        const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x444444);
        scene.add(gridHelper);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1);
        scene.add(directionalLight);
        
        // --- Parse Data ---
        try {
            const parsedData = JSON.parse(poseDataJson).filter((frame: Landmark[] | null) => frame !== null);
            poseDataRef.current = parsedData;
            setTotalFrames(parsedData.length);
        } catch(e) { console.error("Failed to parse pose data:", e); }

        // --- Create Skeleton ---
        const jointGeometry = new THREE.SphereGeometry(0.02, 16, 16);
        const jointMaterial = new THREE.MeshPhongMaterial({ color: 0x3b82f6 });
        for (let i = 0; i < 33; i++) {
            const joint = new THREE.Mesh(jointGeometry, jointMaterial);
            skeletonRef.current.add(joint);
        }

        const boneMaterial = new THREE.LineBasicMaterial({ color: 0x4f46e5 });
        POSE_CONNECTIONS.forEach(() => {
            const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
            const bone = new THREE.Line(geometry, boneMaterial);
            skeletonRef.current.add(bone);
        });

        scene.add(skeletonRef.current);
        
        // --- Animation Loop ---
        const animate = (time: number) => {
            animationFrameRef.current = requestAnimationFrame(animate);
            if (cameraRef.current && rendererRef.current) {
                skeletonRef.current.rotation.y += 0.005; // Auto-rotate
                rendererRef.current.render(scene, cameraRef.current);
            }
        };
        animate(0);
        
        // --- Resize Handler ---
        const handleResize = () => {
             if (rendererRef.current && cameraRef.current) {
                const { clientWidth, clientHeight } = mount;
                rendererRef.current.setSize(clientWidth, clientHeight);
                cameraRef.current.aspect = clientWidth / clientHeight;
                cameraRef.current.updateProjectionMatrix();
            }
        };
        window.addEventListener('resize', handleResize);

        // --- Cleanup ---
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            window.removeEventListener('resize', handleResize);
            if (mount && rendererRef.current) {
                mount.removeChild(rendererRef.current.domElement);
            }
        };

    }, [poseDataJson]);
    
     // --- Playback Effect ---
    useEffect(() => {
        let timer: number;
        if (isPlaying && totalFrames > 0) {
            timer = window.setInterval(() => {
                setCurrentFrame(prevFrame => (prevFrame + 1) % totalFrames);
            }, 100); // 10 FPS
        }
        return () => clearInterval(timer);
    }, [isPlaying, totalFrames]);
    
    // --- Skeleton Update ---
    useEffect(() => {
        const frameLandmarks = poseDataRef.current[currentFrame];
        if (!frameLandmarks) return;

        const joints = skeletonRef.current.children.slice(0, 33) as THREE.Mesh[];
        const bones = skeletonRef.current.children.slice(33) as THREE.Line[];

        frameLandmarks.forEach((landmark, i) => {
            if (joints[i]) {
                joints[i].position.set(-landmark.x, -landmark.y, -landmark.z);
            }
        });

        POSE_CONNECTIONS.forEach(([startIdx, endIdx], i) => {
            const startPoint = frameLandmarks[startIdx];
            const endPoint = frameLandmarks[endIdx];
            if (bones[i] && startPoint && endPoint) {
                const geometry = bones[i].geometry as THREE.BufferGeometry;
                const positions = geometry.attributes.position.array as Float32Array;
                positions[0] = -startPoint.x; positions[1] = -startPoint.y; positions[2] = -startPoint.z;
                positions[3] = -endPoint.x; positions[4] = -endPoint.y; positions[5] = -endPoint.z;
                geometry.attributes.position.needsUpdate = true;
            }
        });

    }, [currentFrame]);


    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">{t('replay3D.modalTitle')}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
                </div>
                <div ref={mountRef} className="flex-1 relative"></div>
                <div className="p-4 border-t border-gray-700 flex items-center gap-4">
                    <button onClick={() => setIsPlaying(!isPlaying)} className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md">
                        {isPlaying ? t('replay3D.pause') : t('replay3D.play')}
                    </button>
                     <input
                        type="range"
                        min="0"
                        max={totalFrames > 0 ? totalFrames - 1 : 0}
                        value={currentFrame}
                        onChange={e => setCurrentFrame(Number(e.target.value))}
                        className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    <span className="text-sm text-gray-300 w-24 text-center">{currentFrame + 1} / {totalFrames}</span>
                </div>
            </div>
        </div>
    );
};

export default Replay3DModal;
