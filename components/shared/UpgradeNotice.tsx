import React from 'react';
import { useTranslation } from '../../i18n/LanguageContext';

interface UpgradeNoticeProps {
    featureName: string;
    message?: string;
}

const UpgradeNotice: React.FC<UpgradeNoticeProps> = ({ featureName, message }) => {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col items-center justify-center h-full text-center bg-gray-800/50 p-8 rounded-lg">
            <h2 className="text-2xl font-bold text-white mb-2">{t('upgradeNotice.title', { featureName })}</h2>
            <p className="text-gray-400 max-w-md mb-6">
                {message || t('upgradeNotice.message')}
            </p>
             <a href="#" onClick={() => window.location.reload()} className="px-6 py-3 bg-yellow-500 text-black font-bold rounded-md hover:bg-yellow-400 transition-colors">
                {t('upgradeNotice.button')}
            </a>
        </div>
    );
};

export default UpgradeNotice;