
import React, { useState, useEffect } from 'react';
import { MarketingPage } from '../../types';
import { useTranslation } from '../../i18n/LanguageContext';
import LanguageSelector from '../LanguageSelector';

interface NavbarProps {
    activePage: MarketingPage;
    setPage: (page: MarketingPage) => void;
}

const NavLink: React.FC<{
    label: string;
    isActive: boolean;
    onClick: () => void;
}> = ({ label, isActive, onClick }) => (
    <button onClick={onClick} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-300 ${isActive ? 'text-white' : 'text-gray-400 hover:text-white'}`}>
        {label}
        {isActive && <span className="block h-0.5 bg-blue-500 mt-1 transition-all duration-300"></span>}
    </button>
);


const Navbar: React.FC<NavbarProps> = ({ activePage, setPage }) => {
    const [scrolled, setScrolled] = useState(false);
    const { t } = useTranslation();

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 10);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <nav className={`fixed w-full z-30 transition-all duration-300 ${scrolled ? 'bg-gray-900/80 backdrop-blur-sm shadow-lg' : 'bg-transparent'}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-20">
                    <div className="flex items-center">
                        <button onClick={() => setPage('home')} className="flex-shrink-0 text-white text-2xl font-bold tracking-wider">
                            {t('appName')}
                        </button>
                    </div>
                    <div className="hidden md:block">
                        <div className="ml-10 flex items-baseline space-x-4">
                            <NavLink label={t('navbar.home')} isActive={activePage === 'home'} onClick={() => setPage('home')} />
                            <NavLink label={t('navbar.features')} isActive={activePage === 'features'} onClick={() => setPage('features')} />
                            <NavLink label={t('navbar.pricing')} isActive={activePage === 'pricing'} onClick={() => setPage('pricing')} />
                        </div>
                    </div>
                    <div className="hidden md:block">
                         <div className="flex items-center space-x-4">
                            <LanguageSelector />
                            <button onClick={() => setPage('signin')} className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors">
                                {t('navbar.signIn')}
                            </button>
                             <button onClick={() => setPage('signup')} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all transform hover:scale-105">
                                {t('navbar.getStarted')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;