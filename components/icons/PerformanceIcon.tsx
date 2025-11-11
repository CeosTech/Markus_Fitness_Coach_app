import React from 'react';

const PerformanceIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M4 19V5" />
    <path d="M10 19V9" />
    <path d="M16 19V12" />
    <path d="M22 19V4" />
    <path d="M2 19h20" />
  </svg>
);

export default PerformanceIcon;
