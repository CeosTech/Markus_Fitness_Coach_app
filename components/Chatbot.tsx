import React, { useState, useRef, useEffect } from 'react';
import { Chat } from '@google/genai';
import { ChatMessage } from '../types';
import { initChat, generateQuickResponse, textToSpeech } from '../services/geminiService';
import Loader from './shared/Loader';
import { useTranslation } from '../i18n/LanguageContext';

const Chatbot: React.FC = () => {
  const { t, language } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [useQuickResponse, setUseQuickResponse] = useState(false);
  const chatRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatRef.current = initChat(language);
    setMessages([{ role: 'model', content: t('chatbot.initialMessage') }]);
  }, [language, t]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError('');

    try {
      let modelResponse: string;
      if (useQuickResponse) {
        modelResponse = await generateQuickResponse(input, language);
      } else {
        if (!chatRef.current) throw new Error("Chat not initialized");
        const result = await chatRef.current.sendMessage({ message: input });
        modelResponse = result.text;
      }
      setMessages(prev => [...prev, { role: 'model', content: modelResponse }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTTS = async (text: string) => {
    try {
      const audioBase64 = await textToSpeech(text);
      const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
      audio.play();
    } catch(err) {
      setError(t('chatbot.errorTTS'));
    }
  }

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto bg-gray-800 rounded-lg shadow-2xl">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-xl font-bold text-white">{t('chatbot.title')}</h2>
      </div>
      <div className="flex-1 p-6 overflow-y-auto space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-md p-3 rounded-lg ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
              <p className="text-sm">{msg.content}</p>
              {msg.role === 'model' && (
                <button onClick={() => handleTTS(msg.content)} className="mt-2 text-xs text-indigo-300 hover:underline">
                  {t('chatbot.readAloud')}
                </button>
              )}
            </div>
          </div>
        ))}
        {isLoading && <div className="flex justify-start"><div className="p-3 rounded-lg bg-gray-700"><Loader /></div></div>}
        <div ref={messagesEndRef} />
      </div>
      {error && <p className="p-4 text-sm text-red-400">{error}</p>}
      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center space-x-2">
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSend()}
                placeholder={t('chatbot.inputPlaceholder')}
                className="flex-1 bg-gray-700 border border-gray-600 rounded-full px-4 py-2 text-white placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500"
                disabled={isLoading}
            />
            <button
                onClick={handleSend}
                disabled={isLoading}
                className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-full hover:bg-indigo-700 disabled:bg-gray-500 transition-colors"
            >
                {t('common.send')}
            </button>
        </div>
        <div className="flex items-center space-x-2 mt-2 ml-4">
            <input
                type="checkbox"
                id="quick-response"
                checked={useQuickResponse}
                onChange={(e) => setUseQuickResponse(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="quick-response" className="text-xs text-gray-400">
                {t('chatbot.quickResponseLabel')}
            </label>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;