
import React, { useState } from 'react';
import { MarketingPage } from '../../types';
import { useTranslation } from '../../i18n/LanguageContext';
import DumbbellIcon from '../icons/DumbbellIcon';

interface FooterProps {
    setPage: (page: MarketingPage) => void;
}

const Footer: React.FC<FooterProps> = ({ setPage }) => {
    const { t, language } = useTranslation();
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const SocialIcon = ({ d }: { d: string }) => (
        <a href="#" className="text-gray-400 hover:text-blue-500 transition-colors">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d={d} />
            </svg>
        </a>
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;
        setStatus('loading');
        setMessage('');
        try {
            const res = await fetch('/api/newsletter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), language })
            });
            if (!res.ok) throw new Error('Request failed');
            setStatus('success');
            setMessage(t('footer.newsletterSuccess'));
            setEmail('');
        } catch (err) {
            setStatus('error');
            setMessage(t('footer.newsletterError'));
        }
    };

    return (
        <footer className="bg-gray-900 border-t border-gray-800">
            <div className="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8 text-center">
                <div className="flex justify-center mb-4">
                    <DumbbellIcon className="h-12 w-12 text-blue-500 animate-lift" />
                </div>
                <h2 className="text-4xl font-extrabold text-white tracking-tight">
                    {t('appName')}
                </h2>
                <p className="mt-2 text-lg text-gray-400">
                    {t('sidebar.subtitle')}
                </p>

                <form onSubmit={handleSubmit} className="mt-8 max-w-xl mx-auto">
                    <p className="text-sm uppercase tracking-[0.2em] text-blue-300 mb-3 animate-pulse">{t('footer.newsletterTitle')}</p>
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={t('footer.newsletterPlaceholder')}
                            className="w-full bg-gray-800 border border-gray-700 rounded-md px-4 py-3 text-white focus:ring-blue-500 focus:border-blue-500"
                            required
                        />
                        <button
                            type="submit"
                            disabled={status === 'loading'}
                            className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-gray-600 transition-colors"
                        >
                            {status === 'loading' ? t('footer.newsletterLoading') : t('footer.newsletterCta')}
                        </button>
                    </div>
                    {message && (
                        <p className={`mt-3 text-sm ${status === 'success' ? 'text-emerald-300' : 'text-red-300'}`}>
                            {message}
                        </p>
                    )}
                </form>

                <div className="mt-8 flex justify-center items-center space-x-6">
                    <button onClick={() => setPage('privacy')} className="text-base text-gray-400 hover:text-white">Privacy</button>
                    <span className="text-gray-600">|</span>
                    <button onClick={() => setPage('terms')} className="text-base text-gray-400 hover:text-white">Terms</button>
                </div>

                 <div className="mt-8 flex justify-center space-x-6">
                    <SocialIcon d="M22.9 5.8c-.8.4-1.7.6-2.6.7 1-.6 1.7-1.5 2-2.5-.9.5-1.9.9-3 1.1-.9-.9-2.1-1.5-3.4-1.5-2.6 0-4.7 2.1-4.7 4.7 0 .4 0 .7.1 1.1-3.9-.2-7.4-2.1-9.7-4.9-.4.7-.6 1.5-.6 2.4 0 1.6.8 3.1 2.1 3.9-.8 0-1.5-.2-2.1-.6v.1c0 2.3 1.6 4.2 3.8 4.6-.4.1-.8.2-1.2.2-.3 0-.6 0-.9-.1.6 1.9 2.4 3.2 4.5 3.3-1.6 1.3-3.7 2-5.9 2-1.1 0-2.2-.1-3.3-.2 2.1 1.4 4.6 2.2 7.3 2.2 8.8 0 13.6-7.3 13.6-13.6 0-.2 0-.4 0-.6.9-.7 1.7-1.5 2.4-2.5z" />
                    <SocialIcon d="M22 12c0-5.5-4.5-10-10-10S2 6.5 2 12c0 5 3.7 9.1 8.4 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7C18.3 21.1 22 17 22 12z" />
                </div>
                
                <p className="mt-8 text-base text-gray-500">{t('footer.copyright')}</p>
            </div>
        </footer>
    );
};

export default Footer;
