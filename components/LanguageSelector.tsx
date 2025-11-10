import React from 'react';
import { useTranslation } from '../i18n/LanguageContext';
import { Language } from '../types';

const LanguageSelector: React.FC = () => {
  const { language, setLanguage } = useTranslation();

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value as Language);
  };

  return (
    <div className="relative">
      <select
        value={language}
        onChange={handleLanguageChange}
        className="bg-gray-800 border border-gray-600 text-white text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block w-full pl-3 pr-8 py-2 appearance-none"
        aria-label="Select language"
      >
        <option value="en">English</option>
        <option value="fr">Français</option>
        <option value="es">Español</option>
      </select>
       <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </div>
    </div>
  );
};

export default LanguageSelector;