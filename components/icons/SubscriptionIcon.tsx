import React from 'react';

const SubscriptionIcon: React.FC<{ className?: string }> = ({ className = 'h-5 w-5 text-current' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="14" rx="2" />
    <path d="M3 9h18" />
    <path d="M8 15h2" />
    <path d="M13 15h3" />
  </svg>
);

export default SubscriptionIcon;
