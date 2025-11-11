import React from 'react';

const FoodScanIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M4 5h3l2 4h6l2-4h3" />
    <path d="M12 9v11" />
    <path d="M8 20h8" />
    <path d="M6 13h12" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

export default FoodScanIcon;
