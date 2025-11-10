import React, { useState } from 'react';
import { User } from '../../types';
import { useTranslation } from '../../i18n/LanguageContext';
import GoogleAuthButton from './GoogleAuthButton';

interface SignInFormProps {
  onAuthSuccess: (user: User) => void;
  onSwitchView: () => void;
}

const SignInForm: React.FC<SignInFormProps> = ({ onAuthSuccess, onSwitchView }) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (response.ok) {
        onAuthSuccess(data.user);
      } else {
        setError(data.message || 'Failed to sign in.');
      }
    } catch (err) {
      setError('An network error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="py-20 flex items-center justify-center">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800/80 backdrop-blur-sm rounded-lg shadow-2xl border border-gray-700">
        <h2 className="text-3xl font-bold text-center text-white fade-in">{t('signIn.title')}</h2>
        <form className="space-y-6 fade-in fade-in-delay-1" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300">{t('signIn.emailLabel')}</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-300"
            >
              {t('signIn.passwordLabel')}
            </label>
            <div className="relative mt-1">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 pr-16 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                className="absolute inset-y-0 right-2 px-3 text-xs font-semibold text-gray-300 hover:text-white"
              >
                {showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-4 py-3 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-gray-800 transition-all transform hover:scale-105"
            >
              {isLoading ? t('signIn.loadingButton') : t('signIn.button')}
            </button>
          </div>
        </form>
        <div className="flex items-center gap-3 text-gray-500 text-xs uppercase tracking-wider">
          <span className="flex-1 h-px bg-gray-700" />
          {t('common.or')}
          <span className="flex-1 h-px bg-gray-700" />
        </div>
        <GoogleAuthButton onAuthSuccess={onAuthSuccess} onError={setError} />
        <p className="text-sm text-center text-gray-400 fade-in fade-in-delay-2">
          {t('signIn.switchPrompt')}{' '}
          <button onClick={onSwitchView} className="font-medium text-blue-400 hover:underline">
            {t('signIn.switchLink')}
          </button>
        </p>
      </div>
    </div>
  );
};

export default SignInForm;
