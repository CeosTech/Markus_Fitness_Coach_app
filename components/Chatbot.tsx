import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import Loader from './shared/Loader';
import { useTranslation } from '../i18n/LanguageContext';
import { textToSpeech } from '../services/geminiService';
import { getGenAIClient } from '../utils/genaiClient';

interface ChatSessionMeta {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessage?: string | null;
}

const mapHistoryForModel = (history: ChatMessage[]) =>
  history.map((msg) => ({
    role: msg.role === 'model' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

const Chatbot: React.FC = () => {
  const { t, language } = useTranslation();
  const [sessions, setSessions] = useState<ChatSessionMeta[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [useQuickResponse, setUseQuickResponse] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceReady, setVoiceReady] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const recognitionRef = useRef<any>(null);
  const voiceDraftRef = useRef('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchSessions = () => {
    setSessionsLoading(true);
    fetch('/api/chat/sessions')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load sessions.');
        return res.json();
      })
      .then((data) => {
        const list: ChatSessionMeta[] = data.sessions || [];
        setSessions(list);
        if (!list.length) {
          createSession();
        } else if (!selectedSessionId) {
          setSelectedSessionId(list[0].id);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load sessions.'))
      .finally(() => setSessionsLoading(false));
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (!selectedSessionId) {
      setMessages([]);
      return;
    }
    setMessagesLoading(true);
    fetch(`/api/chat/sessions/${selectedSessionId}/messages`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load messages.');
        return res.json();
      })
      .then((data) => {
        const loaded: ChatMessage[] = (data.messages || []).map((msg: any) => ({
          role: msg.role === 'model' ? 'model' : 'user',
          content: msg.content,
        }));
        if (!loaded.length) {
          loaded.push({ role: 'model', content: t('chatbot.initialMessage') });
        }
        setMessages(loaded);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load messages.'))
      .finally(() => setMessagesLoading(false));
  }, [selectedSessionId, t]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      recognitionRef.current = null;
      setVoiceReady(false);
      setIsListening(false);
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      const trimmed = transcript.trim();
      if (!trimmed) return;
      if (event.results[event.results.length - 1].isFinal) {
        setInput((prev) => {
          const base = voiceDraftRef.current ? `${voiceDraftRef.current} ` : '';
          return `${base}${trimmed}`.trim();
        });
        voiceDraftRef.current = '';
      } else {
        setInput(`${voiceDraftRef.current} ${trimmed}`.trim());
      }
    };
    recognition.onerror = () => {
      setError(t('chatbot.voiceError'));
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
      voiceDraftRef.current = '';
    };
    recognitionRef.current = recognition;
    setVoiceReady(true);
    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [language, t]);

  const handleToggleListening = () => {
    if (!recognitionRef.current) {
      setError(t('chatbot.voiceUnsupported'));
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      return;
    }
    try {
      voiceDraftRef.current = input.trim();
      recognitionRef.current.start();
      setIsListening(true);
      setError('');
    } catch (err) {
      setError(t('chatbot.voiceError'));
      setIsListening(false);
    }
  };

  const createSession = () => {
    fetch('/api/chat/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to create session.');
        return res.json();
      })
      .then((session) => {
        setSessions((prev) => [{ ...session, lastMessage: null }, ...prev]);
        setSelectedSessionId(session.id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to create session.'));
  };

  const ensureSession = async (): Promise<number> => {
    if (selectedSessionId) return selectedSessionId;
    const res = await fetch('/api/chat/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error('Failed to create session.');
    const session = await res.json();
    setSessions((prev) => [{ ...session, lastMessage: null }, ...prev]);
    setSelectedSessionId(session.id);
    return session.id;
  };

  const handleDeleteSession = (sessionId: number) => {
    if (!window.confirm(t('chatbot.deleteChatConfirm'))) return;
    fetch(`/api/chat/sessions/${sessionId}`, { method: 'DELETE' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to delete session.');
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (selectedSessionId === sessionId) {
          setSelectedSessionId(null);
          setMessages([]);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to delete session.'));
  };

  const handleTTS = async (text: string) => {
    try {
      const audioBase64 = await textToSpeech(text);
      const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
      audio.play();
    } catch (err) {
      setError(t('chatbot.errorTTS'));
    }
  };

  const saveMessages = async (sessionId: number, newMessages: ChatMessage[]) => {
    const body = {
      messages: newMessages.map((msg) => ({ role: msg.role, content: msg.content })),
      titleHint: newMessages.find((msg) => msg.role === 'user')?.content ?? '',
    };
    const res = await fetch(`/api/chat/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to save messages.');
    }
    const data = await res.json();
    setSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId
          ? { ...session, updatedAt: data.updatedAt, lastMessage: newMessages[newMessages.length - 1]?.content ?? session.lastMessage }
          : session
      )
    );
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput('');
    const sessionId = await ensureSession();
    const userMessage: ChatMessage = { role: 'user', content: trimmed };
    const optimisticHistory = [...messages, userMessage];
    setMessages(optimisticHistory);
    setIsLoading(true);
    setError('');

    try {
      const ai = await getGenAIClient();
      const model = useQuickResponse ? 'gemini-2.0-flash-lite-001' : 'gemini-2.5-flash';
      const contents = [...mapHistoryForModel(messages), { role: 'user', parts: [{ text: trimmed }] }];
      const response = await ai.models.generateContent({ model, contents });
      const assistantText = response.text.trim();
      const assistantMessage: ChatMessage = { role: 'model', content: assistantText || t('chatbot.errorTTS') };
      const newHistory = [...optimisticHistory, assistantMessage];
      setMessages(newHistory);
      await saveMessages(sessionId, [userMessage, assistantMessage]);
      if (autoSpeak && assistantText) {
        handleTTS(assistantText);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred.');
      setMessages(messages); // rollback
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full bg-gray-800 rounded-lg shadow-2xl overflow-hidden">
      <aside className="w-64 border-r border-gray-700 flex flex-col">
        <div className="p-4 flex items-center justify-between border-b border-gray-700">
          <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">{t('chatbot.sessionsTitle')}</h3>
          <button
            onClick={createSession}
            className="px-2 py-1 text-xs font-semibold text-white bg-indigo-600 rounded hover:bg-indigo-700"
          >
            {t('chatbot.newChat')}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessionsLoading ? (
            <div className="flex justify-center p-4"><Loader /></div>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-center text-gray-500 p-4">{t('chatbot.emptySessions')}</p>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => setSelectedSessionId(session.id)}
                className={`w-full text-left px-4 py-3 border-b border-gray-700 hover:bg-gray-700 ${
                  selectedSessionId === session.id ? 'bg-gray-700' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white truncate">{session.title}</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSession(session.id);
                    }}
                    className="text-xs text-gray-400 hover:text-red-400"
                  >
                    {t('chatbot.deleteChat')}
                  </button>
                </div>
                <p className="text-xs text-gray-400 truncate">
                  {session.lastMessage || t('chatbot.noMessages')}
                </p>
              </button>
            ))
          )}
        </div>
      </aside>
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">{t('chatbot.title')}</h2>
        </div>
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {messagesLoading ? (
            <div className="flex justify-center"><Loader /></div>
          ) : (
            messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-md p-3 rounded-lg ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  {msg.role === 'model' && (
                    <button onClick={() => handleTTS(msg.content)} className="mt-2 text-xs text-indigo-300 hover:underline">
                      {t('chatbot.readAloud')}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
          {isLoading && <div className="flex justify-start"><div className="p-3 rounded-lg bg-gray-700"><Loader /></div></div>}
          <div ref={messagesEndRef} />
        </div>
        {error && <p className="p-4 text-sm text-red-400">{error}</p>}
        <div className="p-4 border-t border-gray-700">
          <div className="flex flex-col gap-2">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSend()}
                placeholder={t('chatbot.inputPlaceholder')}
                className="flex-1 bg-gray-700 border border-gray-600 rounded-full px-4 py-2 text-white placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500"
                disabled={isLoading || sessionsLoading}
              />
              <button
                onClick={handleSend}
                disabled={isLoading || sessionsLoading}
                className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-full hover:bg-indigo-700 disabled:bg-gray-500 transition-colors"
              >
                {t('common.send')}
              </button>
              <button
                type="button"
                onClick={handleToggleListening}
                disabled={!voiceReady || isLoading}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  isListening ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                } ${!voiceReady ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {isListening ? t('chatbot.voiceButtonStop') : t('chatbot.voiceButtonStart')}
              </button>
            </div>
            {!voiceReady && <p className="text-xs text-gray-500 ml-1">{t('chatbot.voiceUnsupported')}</p>}
            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 ml-1">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={useQuickResponse}
                  onChange={(e) => setUseQuickResponse(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>{t('chatbot.quickResponseLabel')}</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoSpeak}
                  onChange={(e) => setAutoSpeak(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>{t('chatbot.autoSpeakLabel')}</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
