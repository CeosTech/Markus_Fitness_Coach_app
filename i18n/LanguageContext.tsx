import React, {
  createContext,
  useState,
  useContext,
  useCallback,
  useEffect,
  useRef,
useMemo,
} from 'react';
import { Language } from '../types';

type Replacements = Record<string, string | number>;
type Translations = Record<string, any>;

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, replacements?: Replacements) => string;
  translations: Translations | null;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'app_language';
const FALLBACK_LANG: Language = 'en';

async function fetchJSON(url: string, signal?: AbortSignal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Langue initiale depuis localStorage ou fallback
  const initialLang = ((): Language => {
    if (typeof window === 'undefined') return FALLBACK_LANG;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return (saved as Language) || FALLBACK_LANG;
  })();

  const [language, setLanguageState] = useState<Language>(initialLang);
  const [translations, setTranslations] = useState<Translations | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const abortRef = useRef<AbortController | null>(null);

  // Charge les traductions avec fallback vers EN (sans re-boucler sur EN si déjà EN)
  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setTranslations(null);
      try {
        const data = await fetchJSON(`/i18n/locales/${language}.json`, controller.signal);
        if (cancelled) return;
        setTranslations(data);
      } catch (e) {
        if (controller.signal.aborted) {
          return; // abandon silently: component is unmounting or language changed
        }
        console.error(e);
        if (language !== FALLBACK_LANG) {
          try {
            const fallback = await fetchJSON(`/i18n/locales/${FALLBACK_LANG}.json`, controller.signal);
            if (cancelled) return;
            setTranslations(fallback);
            setLanguageState(FALLBACK_LANG);
            if (typeof window !== 'undefined') {
              window.localStorage.setItem(STORAGE_KEY, FALLBACK_LANG);
            }
          } catch (fallbackErr) {
            if (controller.signal.aborted) {
              return;
            }
            console.error(fallbackErr);
            if (cancelled) return;
            setTranslations({});
          }
        } else {
          // même l'anglais a échoué
          setTranslations({});
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, lang);
    }
  }, []);

  const t = useCallback(
    (key: string, replacements?: Replacements): string => {
      if (!translations) return ''; // en cours de chargement
      // navigation sûre dans l’objet de traductions
      const value = key.split('.').reduce<any>((obj, k) => (obj ? obj[k] : undefined), translations);

      if (typeof value !== 'string') {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`Missing i18n key '${key}' for '${language}'`);
        }
        return key;
      }

      if (!replacements) return value;

      let text = value;
      for (const [ph, val] of Object.entries(replacements)) {
        // remplace tous les {{placeholder}}
        text = text.replace(new RegExp(`\\{\\{${ph}\\}\\}`, 'g'), String(val));
      }
      return text;
    },
    [translations, language]
  );

  const contextValue = useMemo(
    () => ({ language, setLanguage, t, translations, isLoading }),
    [language, setLanguage, t, translations, isLoading]
  );

  // Option : tu peux rendre un loader ici, plutôt que null
  if (isLoading && !translations) {
    return null; // ou <Spinner />
  }

  return <LanguageContext.Provider value={contextValue}>{children}</LanguageContext.Provider>;
};

export const useTranslation = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return ctx;
};
