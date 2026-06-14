import React from 'react';

interface FooterCreditProps {
  className?: string;
  variant?: 'dark' | 'sidebar';
}

export default function FooterCredit({ className = '', variant = 'dark' }: FooterCreditProps) {
  const isSidebar = variant === 'sidebar';

  return (
    <div
      className={`footer-credit ${
        isSidebar
          ? 'px-4 py-3 border-t border-sky-900/30'
          : 'py-5 border-t border-sky-900/20'
      } ${className}`}
    >
      <div className="flex flex-col items-center justify-center gap-1.5 text-center">
        {/* Line 1 */}
        <p className="text-sky-300/70 text-xs whitespace-nowrap">
          <span>Designed &amp; developed by </span>
          <span className="font-bold text-white whitespace-nowrap">Kirran S T</span>
        </p>

        {/* Line 2 */}
        <p className="text-sky-400/50 text-[11px]">
          Dept. of Information Technology
        </p>

        {/* Line 3: Links */}
        <div className="flex items-center justify-center gap-4 mt-1">
          <a
            href="https://www.linkedin.com/in/kirran-s-t-694031291/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sky-400/70 hover:text-sky-300 transition-all duration-200 font-semibold hover:scale-105 text-[11px]"
            title="LinkedIn Profile"
          >
            <svg className="h-3.5 w-3.5 fill-current shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
            </svg>
            <span>LinkedIn</span>
          </a>
          <span className="h-3 w-px bg-sky-800/60 block" />
          <a
            href="https://kirran123.github.io/Portfolio/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sky-400/70 hover:text-sky-300 transition-all duration-200 font-semibold hover:scale-105 text-[11px]"
            title="Portfolio"
          >
            <svg className="h-3.5 w-3.5 fill-none stroke-current shrink-0" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            <span>Portfolio</span>
          </a>
        </div>
      </div>
    </div>
  );
}
