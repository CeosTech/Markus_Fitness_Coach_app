import React from 'react';

const ToolsIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className ?? 'h-6 w-6'}
  >
    <path d="m15 7 4 4" />
    <path d="m14 16 6-6a2 2 0 0 0-3-3l-6 6" />
    <circle cx="9" cy="15" r="5" />
    <path d="m8 15 1 1 3-3" />
  </svg>
);

export default ToolsIcon;
