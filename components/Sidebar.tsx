import React from 'react';
import { ViewType, User } from '../types';
import VideoIcon from './icons/VideoIcon';
import ImageIcon from './icons/ImageIcon';
import ChatIcon from './icons/ChatIcon';
import LiveIcon from './icons/LiveIcon';
import SignOutIcon from './icons/SignOutIcon';
import ProfileIcon from './icons/ProfileIcon';
import PlanIcon from './icons/PlanIcon';
import LockIcon from './icons/LockIcon';
import ToolsIcon from './icons/ToolsIcon';
import AdminIcon from './icons/AdminIcon';
import SubscriptionIcon from './icons/SubscriptionIcon';
import MealIcon from './icons/MealIcon';
import FoodScanIcon from './icons/FoodScanIcon';
import PerformanceIcon from './icons/PerformanceIcon';
import { useTranslation } from '../i18n/LanguageContext';

interface SidebarProps {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  handleSignOut: () => void;
  currentUser: User;
  onNavigate?: () => void;
}

const NavButton: React.FC<{
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  isLocked?: boolean;
}> = ({ label, icon, isActive, onClick, isLocked = false }) => (
  <button
    onClick={onClick}
    disabled={isLocked}
    className={`w-full flex items-center justify-between space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
      isActive
        ? 'bg-indigo-600 text-white shadow-lg'
        : isLocked
        ? 'text-gray-500 cursor-not-allowed'
        : 'text-gray-400 hover:bg-gray-700 hover:text-white'
    }`}
    title={isLocked ? 'Upgrade to Pro or Elite to access this feature' : ''}
  >
    <div className="flex items-center space-x-3">
      {icon}
      <span className="font-medium">{label}</span>
    </div>
    {isLocked && <LockIcon />}
  </button>
);

const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView, handleSignOut, currentUser, onNavigate }) => {
  const { t } = useTranslation();
  const toolViews: ViewType[] = ['tools', 'toolsStopwatch', 'toolsBoxing', 'toolsHydration', 'toolsOrm', 'toolsMobility'];
  const isLiveCoachLocked = currentUser.subscriptionTier === 'free';
  const isPlanGeneratorLocked = currentUser.subscriptionTier === 'free';
  const isMealScanLocked = currentUser.subscriptionTier === 'free';
  const showAdmin = currentUser.isAdmin;
  const handleNavigate = (view: ViewType) => {
    setCurrentView(view);
    onNavigate?.();
  };
  const handleSignOutClick = () => {
    handleSignOut();
    onNavigate?.();
  };
  
  return (
    <aside className="w-full max-w-xs lg:max-w-[16rem] bg-gray-800 p-6 flex flex-col space-y-8 shadow-2xl overflow-y-auto h-full">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-wider">
          {t('appName')} <span className="text-indigo-400">{t('sidebar.coach')}</span>
        </h1>
        <p className="text-xs text-gray-400 mt-1">{t('sidebar.subtitle')}</p>
      </div>
      <nav className="flex-1 flex flex-col space-y-4">
        <NavButton
          label={t('sidebar.videoAnalysis')}
          icon={<VideoIcon />}
          isActive={currentView === 'video'}
          onClick={() => handleNavigate('video')}
        />
        <NavButton
          label={t('sidebar.imageAnalysis')}
          icon={<ImageIcon />}
          isActive={currentView === 'image'}
          onClick={() => handleNavigate('image')}
        />
        <NavButton
          label={t('sidebar.aiChat')}
          icon={<ChatIcon />}
          isActive={currentView === 'chat'}
          onClick={() => handleNavigate('chat')}
        />
        <NavButton
          label={t('sidebar.liveCoach')}
          icon={<LiveIcon />}
          isActive={currentView === 'live'}
          onClick={() => handleNavigate('live')}
          isLocked={isLiveCoachLocked}
        />
        <NavButton
          label={t('sidebar.planGenerator')}
          icon={<PlanIcon />}
          isActive={currentView === 'plan'}
          onClick={() => handleNavigate('plan')}
          isLocked={isPlanGeneratorLocked}
        />
        <NavButton
          label={t('sidebar.mealPlanner')}
          icon={<MealIcon />}
          isActive={currentView === 'meal'}
          onClick={() => handleNavigate('meal')}
        />
        <NavButton
          label={t('sidebar.mealScan')}
          icon={<FoodScanIcon />}
          isActive={currentView === 'mealScan'}
          onClick={() => handleNavigate('mealScan')}
          isLocked={isMealScanLocked}
        />
        <NavButton
          label={t('sidebar.performance')}
          icon={<PerformanceIcon />}
          isActive={currentView === 'performance'}
          onClick={() => handleNavigate('performance')}
        />
        <NavButton
          label={t('sidebar.subscription')}
          icon={<SubscriptionIcon />}
          isActive={currentView === 'subscription'}
          onClick={() => handleNavigate('subscription')}
        />
        <NavButton
          label={t('sidebar.tools')}
          icon={<ToolsIcon />}
          isActive={toolViews.includes(currentView)}
          onClick={() => handleNavigate('tools')}
        />
        {showAdmin && (
          <NavButton
            label={t('sidebar.admin')}
            icon={<AdminIcon />}
            isActive={currentView === 'admin'}
            onClick={() => handleNavigate('admin')}
          />
        )}
         <NavButton
          label={t('sidebar.profileHistory')}
          icon={<ProfileIcon />}
          isActive={currentView === 'profile'}
          onClick={() => handleNavigate('profile')}
        />
      </nav>
      <div className="space-y-4">
        <button
          onClick={handleSignOutClick}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-red-800 hover:text-white transition-all duration-200"
        >
          <SignOutIcon />
          <span className="font-medium">{t('sidebar.signOut')}</span>
        </button>
        <div className="text-center text-xs text-gray-500">
          <p>{t('common.poweredBy')}</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
