
import React from 'react';
import Sidebar from './Sidebar';
import { ViewType, User } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  handleSignOut: () => void;
  currentUser: User;
}

const Layout: React.FC<LayoutProps> = ({ children, currentView, setCurrentView, handleSignOut, currentUser }) => {
  return (
    <div className="flex h-screen bg-gray-900 text-gray-200 font-sans">
      <Sidebar 
        currentView={currentView} 
        setCurrentView={setCurrentView} 
        handleSignOut={handleSignOut} 
        currentUser={currentUser}
      />
      <main className="flex-1 p-4 sm:p-6 lg:p-10 overflow-y-auto">
        {children}
      </main>
    </div>
  );
};

export default Layout;