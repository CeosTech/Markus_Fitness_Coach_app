import { Modality, Type } from "@google/genai";
import { Landmark, WorkoutPlan, AnalysisRecord, Language, Sex, MealPlan } from "../types";
import { getGenAIClient } from '../utils/genaiClient';

const VIDEO_MODEL = 'gemini-2.5-pro';
const IMAGE_MODEL = 'gemini-2.5-flash';
const WORKOUT_MODEL = 'gemini-2.5-pro';
const MEAL_MODEL = 'gemini-2.5-pro';
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

export const generateWorkoutPlan = async (
    goal: string,
    level: string,
    equipment: string,
    trainingDays: number,
    language: Language,
    history?: AnalysisRecord[],
    sex: Sex = 'male'
): Promise<WorkoutPlan> => {
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
      - Preferred Training Days Per Week: ${trainingDays}
      - Athlete Profile Sex: ${sex}

      ${historyPrompt}

      The plan should be structured, balanced, and follow principles of progressive overload.
      Ensure the exercises are appropriate for the user's experience level, sex, preferences, and available equipment.
      If the profile is female or the goal references women-specific outcomes, include cues (e.g., glute focus, posture support, lower-impact or cycle-aware options) as needed.
      Include a mix of compound and isolation exercises. Provide clear structure for each day, including rest days.
      The output MUST be in the specified JSON format. Do not include any explanatory text outside of the JSON structure.
      IMPORTANT: All text content within the JSON, such as planName, focus, and exercise names/notes, must be in the following language: ${language}.
      Set daysPerWeek to ${trainingDays} unless contradicted by medical guidance.
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

interface MealPlanRequest {
    goal: string;
    calories: number;
    mealFrequency: number;
    dietStyle: string;
    allergies: string[];
    preferences?: string;
    language: Language;
    sex: Sex;
    prepMode: 'express' | 'batch';
}

export const generateMealPlan = async ({
    goal,
    calories,
    mealFrequency,
    dietStyle,
    allergies,
    preferences,
    language,
    sex,
    prepMode
}: MealPlanRequest): Promise<MealPlan> => {
    const model = MEAL_MODEL;
    const allergyText = allergies?.length ? allergies.join(', ') : 'None';
    const preferenceText = preferences?.trim() || 'No extra preferences provided.';
    const prepModeText =
        prepMode === 'batch'
            ? 'Batch cooking mode: plan 2-3 big prep sessions per week, reuse leftovers for lunches/dinners, favor tray bakes, slow-cooker, one-pot meals, and ingredient re-use across days.'
            : 'Express mode: each meal should be <15 minutes active prep, minimal ingredients and steps, prefer no-chop or pre-cut/frozen options when possible.';
    const prompt = `
      You are a certified sports dietitian specializing in high-performance athletics and women's health.
      Design a 7-day plan with ${mealFrequency} meals per day that supports the following profile:
      - Goal: ${goal}
      - Daily Calories Target: ${calories}
      - Diet Style: ${dietStyle}
      - Allergies or Intolerances: ${allergyText}
      - Additional Preferences or cultural notes: ${preferenceText}
      - Athlete Sex: ${sex}
      - Meal Prep Mode: ${prepMode === 'batch' ? 'batch cooking (2-3 prep sessions/week)' : 'express (<15 min each meal)'}

      Guidelines:
      - Respect allergens and diet style at all times.
      - Include female-specific considerations when the athlete is female (cycle-aware fuel, iron support, etc.).
      - Suggest fresh, practical recipe ideas with short descriptions and optional macro cues.
      - Provide grocery or prep tips if relevant.
      - Meals should cover breakfast through dinner plus snacks according to mealFrequency.
      - Return exactly 7 day objects, one per day of the week, in chronological order.
      - Include a shoppingList array that aggregates ingredients needed for the 7-day plan (group items logically, e.g., "Chicken breast (1.2 kg)").
      - Tailor macros to the stated goal (cutting, lean muscle, endurance, postpartum recovery, etc.).
      - ${prepModeText}
      - IMPORTANT: All narrative text must be in ${language}. Use the user's preferred language for meal names, summaries, and tips.
      - Output ONLY valid JSON that follows the schema.
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
                    caloriesPerDay: { type: Type.INTEGER },
                    mealFrequency: { type: Type.INTEGER },
                    groceryTips: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        nullable: true
                    },
                    shoppingList: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        nullable: true
                    },
                    days: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                day: { type: Type.STRING },
                                summary: { type: Type.STRING, nullable: true },
                                meals: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            name: { type: Type.STRING },
                                            description: { type: Type.STRING },
                                            calories: { type: Type.INTEGER },
                                            macros: { type: Type.STRING, nullable: true },
                                            recipeTips: { type: Type.STRING, nullable: true }
                                        },
                                        required: ["name", "description", "calories"]
                                    }
                                }
                            },
                            required: ["day", "meals"]
                        }
                    }
                },
                required: ["planName", "caloriesPerDay", "mealFrequency", "days"]
            }
        }
    });

    const jsonString = response.text;
    try {
        const parsed = JSON.parse(jsonString);
        if (!Array.isArray(parsed?.days) || parsed.days.length !== 7) {
            throw new Error('Meal plan must include 7 days. Please try again.');
        }
        return parsed as MealPlan;
    } catch (error) {
        console.error("Failed to parse meal plan JSON:", error, jsonString);
        throw new Error("The AI returned an invalid meal plan format. Please try again.");
    }
};
