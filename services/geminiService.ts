import { Chat, Modality, Type } from "@google/genai";
import { Landmark, WorkoutPlan, AnalysisRecord, Language } from "../types";
import { getGenAIClient } from '../utils/genaiClient';

const VIDEO_MODEL = 'gemini-2.5-pro';
const IMAGE_MODEL = 'gemini-2.5-flash';
const CHAT_MODEL = 'gemini-2.5-flash';
const QUICK_REPLY_MODEL = 'gemini-2.0-flash-lite-001';
const WORKOUT_MODEL = 'gemini-2.5-pro';
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';

export const analyzeVideoWithPose = async (
    frames: string[], 
    landmarks: (Landmark[] | null)[], 
    basePrompt: string, 
    useThinkingMode: boolean,
    language: Language
): Promise<string> => {
    const model = VIDEO_MODEL;

    const detailedPrompt = `
        ${basePrompt}

        ---
        **Biomechanical Data Provided:**
        I have captured ${frames.length} frames from the video and for each frame, I've used MediaPipe Pose to extract 3D world landmarks of the user's body. These landmarks represent the approximate position of joints in meters, with the center of the hips being the origin (0,0,0).

        Please use this structured landmark data in conjunction with the images to provide a highly detailed and accurate biomechanical analysis. Focus on:
        - Joint angles (e.g., knee flexion, hip hinge, spinal alignment).
        - Symmetry between the left and right sides of the body.
        - The trajectory of key points (e.g., bar path, knee travel).
        - Any deviations from optimal form based on this precise data.
        - Provide feedback in clear, well-structured markdown format.
        - IMPORTANT: Your entire response must be in the following language: ${language}.

        The landmark data is provided below as a JSON array, where each element corresponds to a frame. If landmarks are null for a frame, it means no person was detected.
        
        **Landmark Data:**
        ${JSON.stringify(landmarks, null, 2)}
    `;

    const imageParts = frames.map(frame => ({
        inlineData: {
            mimeType: 'image/jpeg',
            data: frame,
        },
    }));

    const config = useThinkingMode ? { thinkingConfig: { thinkingBudget: 32768 } } : {};

    const ai = await getGenAIClient();
    const response = await ai.models.generateContent({
        model,
        contents: {
            parts: [{ text: detailedPrompt }, ...imageParts],
        },
        config,
    });
    return response.text;
};

export const analyzeImage = async (imageBase64: string, prompt: string, language: Language): Promise<string> => {
    const model = IMAGE_MODEL;
    const imagePart = {
        inlineData: {
            mimeType: 'image/jpeg',
            data: imageBase64,
        },
    };
    const fullPrompt = `${prompt}\n\nIMPORTANT: Please respond in the following language: ${language}.`;
    const ai = await getGenAIClient();
    const response = await ai.models.generateContent({
        model,
        contents: { parts: [imagePart, { text: fullPrompt }] },
    });
    return response.text;
};

export const initChat = async (language: Language): Promise<Chat> => {
    const ai = await getGenAIClient();
    return ai.chats.create({
        model: CHAT_MODEL,
        config: {
            systemInstruction: `You are a helpful and knowledgeable fitness coach. Provide safe, effective, and encouraging advice. Your entire response must be in the following language: ${language}.`,
        },
    });
};

export const generateQuickResponse = async (prompt: string, language: Language): Promise<string> => {
    const model = QUICK_REPLY_MODEL;
    const fullPrompt = `${prompt}\n\nIMPORTANT: Please respond in the following language: ${language}.`;
    const ai = await getGenAIClient();
    const response = await ai.models.generateContent({
        model,
        contents: fullPrompt,
    });
    return response.text;
};

export const textToSpeech = async (text: string): Promise<string> => {
    const model = TTS_MODEL;
    const ai = await getGenAIClient();
    const response = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: `Say this in a clear, encouraging tone: ${text}` }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
            },
        },
    });
    
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
        throw new Error("No audio data returned from API.");
    }
    return base64Audio;
};

export const generateWorkoutPlan = async (goal: string, level: string, equipment: string, language: Language, history?: AnalysisRecord[]): Promise<WorkoutPlan> => {
    const model = WORKOUT_MODEL;
    
    let historyPrompt = '';
    if (history && history.length > 0) {
        const relevantHistory = history.slice(0, 5).map(h => ({ exercise: h.exerciseName, feedback: h.result.substring(0, 200) + '...' }));
        historyPrompt = `
          Additionally, consider the user's past performance from their recent analysis history provided below.
          If they have specific weaknesses (e.g., poor squat depth, back rounding on deadlifts), incorporate corrective exercises, mobility work, or modifications to address these issues in the plan.
          
          Analysis History: ${JSON.stringify(relevantHistory)}
        `;
    }

    const prompt = `
      Create a detailed 4-week workout plan for a user with the following profile:
      - Main Goal: ${goal}
      - Experience Level: ${level}
      - Available Equipment: ${equipment}

      ${historyPrompt}

      The plan should be structured, balanced, and follow principles of progressive overload.
      Ensure the exercises are appropriate for the user's experience level and available equipment.
      Include a mix of compound and isolation exercises. Provide clear structure for each day, including rest days.
      The output MUST be in the specified JSON format. Do not include any explanatory text outside of the JSON structure.
      IMPORTANT: All text content within the JSON, such as planName, focus, and exercise names/notes, must be in the following language: ${language}.
    `;

    const ai = await getGenAIClient();
    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    planName: { type: Type.STRING },
                    durationWeeks: { type: Type.INTEGER },
                    daysPerWeek: { type: Type.INTEGER },
                    planDetails: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                day: { type: Type.INTEGER },
                                focus: { type: Type.STRING },
                                exercises: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            name: { type: Type.STRING },
                                            sets: { type: Type.INTEGER },
                                            reps: { type: Type.STRING },
                                            rest: { type: Type.STRING },
                                            notes: { type: Type.STRING, nullable: true },
                                        },
                                        required: ["name", "sets", "reps", "rest"]
                                    },
                                },
                            },
                            required: ["day", "focus", "exercises"]
                        },
                    },
                },
                required: ["planName", "durationWeeks", "daysPerWeek", "planDetails"]
            },
        },
    });

    const jsonString = response.text;
    try {
        return JSON.parse(jsonString) as WorkoutPlan;
    } catch (e) {
        console.error("Failed to parse workout plan JSON:", e);
        throw new Error("The AI returned an invalid workout plan format. Please try again.");
    }
};
