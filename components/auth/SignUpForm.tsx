import React, { useState } from 'react';
import { User } from '../../types';
import { useTranslation } from '../../i18n/LanguageContext';
import GoogleAuthButton from './GoogleAuthButton';

interface SignUpFormProps {
  onAuthSuccess: (user: User) => void;
  onSwitchView: () => void;
}

const SignUpForm: React.FC<SignUpFormProps> = ({ onAuthSuccess, onSwitchView }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (step === 1) {
      if (!email || !password) {
        setError(t('signUp.additionalInfoRequired'));
        return;
      }
      setStep(2);
      return;
    }

    if (!firstName || !birthDate || !heightCm || !weightKg) {
      setError(t('signUp.additionalInfoRequired'));
      return;
    }

    const parsedHeight = Number(heightCm);
    const parsedWeight = Number(weightKg);

    if (!Number.isFinite(parsedHeight) || !Number.isFinite(parsedWeight)) {
      setError(t('signUp.invalidMetrics'));
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          firstName,
          birthDate,
          heightCm: parsedHeight,
          weightKg: parsedWeight,
        }),
      });
      
      const data = await response.json();
      if (response.ok) {
        onAuthSuccess(data.user);
      } else {
        setError(data.message || 'Failed to sign up.');
      }
    } catch (err) {
      setError('A network error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="py-20 flex items-center justify-center">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800/80 backdrop-blur-sm rounded-lg shadow-2xl border border-gray-700">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white fade-in">{t(step === 1 ? 'signUp.title' : 'signUp.detailsStepTitle')}</h2>
          <p className="text-gray-400 mt-2">{step === 1 ? t('signUp.subtitle') : t('signUp.detailsStepSubtitle')}</p>
          <p className="text-xs text-gray-500 mt-2 uppercase tracking-wide">{t('signUp.stepIndicator', { step })}</p>
        </div>
        <form className="space-y-6 fade-in fade-in-delay-1" onSubmit={handleSubmit}>
          {step === 1 ? (
            <>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300">{t('signUp.emailLabel')}</label>
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
                  {t('signUp.passwordLabel')}
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label htmlFor="first-name" className="block text-sm font-medium text-gray-300">{t('signUp.firstNameLabel')}</label>
                <input
                  id="first-name"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="birth-date" className="block text-sm font-medium text-gray-300">{t('signUp.birthDateLabel')}</label>
                <input
                  id="birth-date"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="height" className="block text-sm font-medium text-gray-300">{t('signUp.heightLabel')}</label>
                  <input
                    id="height"
                    type="number"
                    min="0"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    required
                    className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="weight" className="block text-sm font-medium text-gray-300">{t('signUp.weightLabel')}</label>
                  <input
                    id="weight"
                    type="number"
                    min="0"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    required
                    className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-4 py-3 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-gray-800 transition-all transform hover:scale-105"
            >
              {isLoading ? t('signUp.loadingButton') : step === 1 ? t('signUp.nextButton') : t('signUp.button')}
            </button>
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="mt-3 w-full px-4 py-2 font-semibold text-gray-300 border border-gray-600 rounded-md hover:bg-gray-700 transition-colors"
              >
                {t('signUp.backButton')}
              </button>
            )}
          </div>
        </form>
        <div className="flex items-center gap-3 text-gray-500 text-xs uppercase tracking-wider">
          <span className="flex-1 h-px bg-gray-700" />
          {t('common.or')}
          <span className="flex-1 h-px bg-gray-700" />
        </div>
        <GoogleAuthButton onAuthSuccess={onAuthSuccess} onError={setError} />
        <p className="text-sm text-center text-gray-400 fade-in fade-in-delay-2">
          {t('signUp.switchPrompt')}{' '}
          <button onClick={onSwitchView} className="font-medium text-blue-400 hover:underline">
            {t('signUp.switchLink')}
          </button>
        </p>
      </div>
    </div>
  );
};

export default SignUpForm;
