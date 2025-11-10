
import React from 'react';

const DumbbellIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className={className ?? "h-6 w-6"} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
    >
        <path d="M14.4 14.4 9.6 9.6" />
        <path d="M18 7 7 18" />
        <path d="m5 8 3-3" />
        <path d="m2 11 3-3" />
        <path d="m3 5 3 3" />
        <path d="m19 16 3 3" />
        <path d="m16 19 3 3" />
        <path d="m22 13-3 3" />
    </svg>
);

export default DumbbellIcon;
