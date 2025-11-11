import React from 'react';
import { useTranslation } from '../i18n/LanguageContext';
import { ViewType } from '../types';

interface ToolsProps {
  onSelectTool: (view: ViewType) => void;
}

const Tools: React.FC<ToolsProps> = ({ onSelectTool }) => {
  const { t } = useTranslation();
  const toolCards: Array<{ view: ViewType; title: string; description: string; accent: string }> = [
    { view: 'toolsStopwatch', title: t('tools.stopwatch.title'), description: t('tools.stopwatch.subtitle'), accent: 'from-indigo-500/30 via-indigo-900/20 to-indigo-950/60' },
    { view: 'toolsBoxing', title: t('tools.boxing.title'), description: t('tools.boxing.subtitle'), accent: 'from-rose-500/30 via-rose-900/20 to-rose-950/60' },
    { view: 'toolsHydration', title: t('tools.hydration.title'), description: t('tools.hydration.subtitle'), accent: 'from-cyan-500/30 via-cyan-900/20 to-cyan-950/60' },
    { view: 'toolsOrm', title: t('tools.orm.title'), description: t('tools.orm.subtitle'), accent: 'from-emerald-500/30 via-emerald-900/20 to-emerald-950/60' }
  ];

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-white">{t('tools.title')}</h2>
        <p className="text-gray-400 max-w-2xl mx-auto">{t('tools.subtitle')}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {toolCards.map(card => (
          <div key={card.view} className={`rounded-2xl border border-gray-800 bg-gradient-to-br ${card.accent} p-6 flex flex-col justify-between`}>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-gray-400">{t('tools.hub.singleLabel')}</p>
              <h3 className="text-2xl font-semibold text-white">{card.title}</h3>
              <p className="text-sm text-gray-200">{card.description}</p>
            </div>
            <button
              type="button"
              onClick={() => onSelectTool(card.view)}
              className="mt-6 inline-flex items-center justify-center rounded-lg bg-white/90 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-white"
            >
              {t('tools.hub.openTool')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Tools;
