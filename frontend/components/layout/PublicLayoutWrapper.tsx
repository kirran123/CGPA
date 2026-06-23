'use client';

import React from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

export default function PublicLayoutWrapper({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const pathname = location.pathname;
  const isDashboard = pathname.startsWith('/dashboard');
  const isLogin = pathname.startsWith('/login');

  React.useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '');
      const element = document.getElementById(id);
      if (element) {
        const timer = setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
        return () => clearTimeout(timer);
      }
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, location.hash]);

  if (isDashboard || isLogin) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#040f24] text-white selection:bg-sky-500 selection:text-white">
      <Navbar />
      <main className="flex-grow pt-16">
        {children}
      </main>
      <Footer />
    </div>
  );
}
