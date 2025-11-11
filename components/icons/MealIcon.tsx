import React from 'react';

const MealIcon: React.FC<{ className?: string }> = ({ className = 'h-5 w-5 text-current' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 3v8" />
    <path d="M7 3v8" />
    <path d="M4 8h3" />
    <path d="M10 3h2v9" />
    <path d="M15 5c2 0 3 1 3 3v4" />
    <path d="M5 21v-4h6" />
    <path d="M13 17h6v4" />
  </svg>
);

export default MealIcon;
