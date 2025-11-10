
import React from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import { MarketingPage } from '../../types';

interface MarketingLayoutProps {
  children: React.ReactNode;
  activePage: MarketingPage;
  setPage: (page: MarketingPage) => void;
}

const MarketingLayout: React.FC<MarketingLayoutProps> = ({ children, activePage, setPage }) => {
  return (
    <div className="bg-gray-900 min-h-screen flex flex-col font-sans">
      <Navbar activePage={activePage} setPage={setPage} />
      <main className="flex-grow">
        {children}
      </main>
      <Footer setPage={setPage} />
    </div>
  );
};

export default MarketingLayout;
