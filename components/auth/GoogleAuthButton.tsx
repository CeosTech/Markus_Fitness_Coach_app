import React, { useEffect, useRef } from 'react';
import { User } from '../../types';
import { useTranslation } from '../../i18n/LanguageContext';

declare global {
  interface Window {
    google?: any;
  }
}

interface GoogleAuthButtonProps {
  onAuthSuccess: (user: User) => void;
  onError?: (message: string) => void;
}

const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({ onAuthSuccess, onError }) => {
  const { t } = useTranslation();
  const buttonRef = useRef<HTMLDivElement>(null);
  const clientId = process.env.GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId || !buttonRef.current) return;

    const renderButton = () => {
      if (!window.google || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: any) => {
          if (!response?.credential) {
            onError?.(t('googleAuth.error'));
            return;
          }
          try {
            const res = await fetch('/api/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ credential: response.credential })
            });
            const data = await res.json();
            if (!res.ok) {
              onError?.(data.message || t('googleAuth.error'));
              return;
            }
            onAuthSuccess(data.user);
          } catch (err) {
            onError?.(t('googleAuth.error'));
          }
        }
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        width: 280
      });
    };

    if (window.google && window.google.accounts?.id) {
      renderButton();
      return;
    }

    const existingScript = document.getElementById('google-client-script') as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', renderButton, { once: true });
      return () => existingScript.removeEventListener('load', renderButton);
    }

    const script = document.createElement('script');
    script.id = 'google-client-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = renderButton;
    script.onerror = () => onError?.(t('googleAuth.error'));
    document.body.appendChild(script);

    return () => {
      script.onload = null;
    };
  }, [clientId, onAuthSuccess, onError, t]);

  if (!clientId) {
    return <p className="text-sm text-center text-gray-500">{t('googleAuth.notConfigured')}</p>;
  }

  return <div className="flex justify-center"><div ref={buttonRef} /></div>;
};

export default GoogleAuthButton;
