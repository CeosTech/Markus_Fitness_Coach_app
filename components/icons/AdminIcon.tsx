import React from 'react';

const AdminIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <path d="M12 2 3 6v5c0 5 3.8 9.7 9 11 5.2-1.3 9-6 9-11V6l-9-4z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

export default AdminIcon;
