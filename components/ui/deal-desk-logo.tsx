import React from 'react';

export interface DealDeskLogoMarkProps {
  className?: string;
}

export function DealDeskLogoMark({ className = 'size-9 shrink-0' }: DealDeskLogoMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      data-testid="deal-desk-logo-mark"
      className={className}
    >
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="6.5"
        fill="#F8F8F6"
        stroke="#111215"
        strokeWidth="2"
      />
      <path
        d="M7.5 21.5A9.5 9.5 0 1 1 24.5 21.5"
        stroke="#111215"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M16 18.5L21.5 11.5"
        stroke="#0F52BA"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <circle cx="16" cy="18.5" r="2.3" fill="#111215" />
    </svg>
  );
}
