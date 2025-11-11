import React from 'react';
import { useTranslation } from '../../i18n/LanguageContext';

interface ToolPageLayoutProps {
  title: string;
  subtitle: string;
  onBack: () => void;
  saveStatusLabel?: string;
  accentClass?: string;
  hero?: React.ReactNode;
  eyebrow?: string;
  children: React.ReactNode;
}

const ToolPageLayout: React.FC<ToolPageLayoutProps> = ({
  title,
  subtitle,
  onBack,
  saveStatusLabel,
  accentClass = 'bg-gray-900/60',
  hero,
  eyebrow,
  children
}) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className={`relative overflow-hidden rounded-3xl border border-white/5 ${accentClass}`}>
        <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.2),_transparent_55%)]" />
        <div className="relative p-6 sm:p-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-4">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center text-sm text-white/80 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              {t('common.back')}
            </button>
            {eyebrow && <p className="text-xs uppercase tracking-[0.3em] text-white/70">{eyebrow}</p>}
            <h2 className="text-3xl sm:text-4xl font-bold text-white drop-shadow-lg">{title}</h2>
            <p className="text-white/80 max-w-2xl">{subtitle}</p>
          </div>
          <div className="flex flex-col items-end gap-4">
            {hero && <div className="text-5xl sm:text-6xl drop-shadow-xl">{hero}</div>}
            {saveStatusLabel && (
              <span className="text-xs uppercase tracking-wide text-white/70 bg-white/10 px-4 py-2 rounded-full backdrop-blur">
                {saveStatusLabel}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="space-y-6">{children}</div>
    </div>
  );
};

export default ToolPageLayout;
