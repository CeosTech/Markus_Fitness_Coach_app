import { GoogleGenAI } from '@google/genai';

let clientPromise: Promise<GoogleGenAI> | null = null;

const fetchApiKey = async (): Promise<string> => {
  const response = await fetch('/api/config/genai');
  if (!response.ok) {
    throw new Error('Gemini configuration not available.');
  }
  const data = await response.json();
  if (!data?.apiKey) {
    throw new Error('Gemini API key missing in config.');
  }
  return data.apiKey;
};

export const getGenAIClient = (): Promise<GoogleGenAI> => {
  if (clientPromise) return clientPromise;
  clientPromise = fetchApiKey().then(apiKey => new GoogleGenAI({ apiKey }));
  return clientPromise;
};
