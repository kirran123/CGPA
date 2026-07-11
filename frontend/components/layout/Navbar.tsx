'use client';

import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, ChevronDown, GraduationCap, Building, LogIn, LogOut, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import ThemeToggle from './ThemeToggle';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const pathname = location.pathname;
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthChange = () => {
      setUser(api.getCurrentUser());
    };

    handleAuthChange();

    window.addEventListener('auth-change', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);

    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('auth-change', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [pathname]);

  const handleLogout = () => {
    api.logout();
    navigate('/');
  };

  const isLinkActive = (path: string) => pathname === path;

  return (
    <nav
      className={`rit-navbar fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
          ? 'bg-[#040f24]/96 backdrop-blur-xl shadow-lg shadow-sky-900/20 border-b border-sky-500/20 py-2'
          : 'bg-[#040f24]/80 backdrop-blur-md py-3'
        }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group flex-shrink-0">
            <div className="group-hover:scale-105 transition-transform duration-300 flex-shrink-0 h-9 w-9 rounded-full overflow-hidden border border-sky-500/30 shadow-lg shadow-sky-500/20">
              <img src="/rit-logo.jpg" alt="RIT Logo" className="h-full w-full object-cover scale-110" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-white font-bold text-base tracking-wide group-hover:text-sky-300 transition-colors duration-300 font-['Outfit']">
                RIT Portal
              </span>
              <span className="text-sky-400/60 text-[10px] font-medium hidden sm:block">
                Ramco Institute of Technology
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">

            {/* Student Dropdown */}
            <div className="relative group/menu">
              <button className="flex items-center gap-1.5 nav-text text-sky-100/80 hover:text-white font-medium transition-colors duration-200 py-2">
                <GraduationCap className="h-4 w-4 text-sky-400" />
                <span>Student</span>
                <ChevronDown className="h-3.5 w-3.5 text-sky-400/70 group-hover/menu:rotate-180 transition-transform duration-300" />
              </button>
              <div className="navbar-dropdown absolute top-full left-0 mt-2 w-58 rounded-2xl bg-[#071830]/98 border border-sky-500/18 p-2 shadow-2xl shadow-sky-900/30 opacity-0 translate-y-2 pointer-events-none group-hover/menu:opacity-100 group-hover/menu:translate-y-0 group-hover/menu:pointer-events-auto transition-all duration-300 z-50">
                <Link
                  to="/calculator/gpa"
                  className="flex items-center gap-3 px-3 py-2.5 text-sm text-sky-100/80 hover:bg-sky-500/10 hover:text-white rounded-xl transition-all duration-200"
                >
                  <span className="bg-sky-500/12 p-1.5 rounded-lg text-sky-400 text-xs font-bold">GPA</span>
                  <div>
                    <p className="font-semibold text-white">GPA Calculator</p>
                    <p className="text-xs text-sky-300/60">Semester GPA lookup</p>
                  </div>
                </Link>
                <Link
                  to="/calculator/cgpa"
                  className="flex items-center gap-3 px-3 py-2.5 text-sm text-sky-100/80 hover:bg-sky-500/10 hover:text-white rounded-xl transition-all duration-200"
                >
                  <span className="bg-emerald-500/12 p-1.5 rounded-lg text-emerald-400 text-xs font-bold">CG</span>
                  <div>
                    <p className="font-semibold text-white">CGPA Calculator</p>
                    <p className="text-xs text-sky-300/60">Cumulative calculation</p>
                  </div>
                </Link>
              </div>
            </div>

            {/* Departments */}
            <Link
              to="/#departments"
              className={`flex items-center gap-1.5 font-medium transition-colors duration-200 nav-text ${isLinkActive('/#departments') ? 'text-white' : 'text-sky-100/75 hover:text-white'
                }`}
            >
              <Building className="h-4 w-4 text-sky-400" />
              <span>Departments</span>
            </Link>

            <ThemeToggle />

            {/* Auth */}
            {user ? (
              <div className="flex items-center gap-3 border-l border-sky-500/18 pl-5">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-2 text-sky-300/70 hover:text-red-400 font-medium transition-colors duration-200"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 border-l border-sky-500/18 pl-5">
                <Link
                  to="/login"
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white rounded-xl font-semibold shadow-lg shadow-sky-500/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sky-500/40 text-sm"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Portal Login</span>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile toggle */}
          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-xl text-sky-300 hover:text-white hover:bg-sky-500/15 transition-all duration-200 focus:outline-none"
              aria-label="Toggle menu"
            >
              {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className={`md:hidden overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-[500px] border-b border-sky-500/12' : 'max-h-0'}`}>
        <div className="mobile-navbar-menu px-4 pt-2 pb-6 space-y-1.5 bg-[#040f24]/98 backdrop-blur-xl">
          <p className="text-[10px] font-bold text-sky-400/50 uppercase tracking-[0.15em] px-3 pt-2 pb-1">Student Services</p>
          <Link
            to="/calculator/gpa"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sky-100/80 hover:bg-sky-500/10 hover:text-white transition-all duration-200"
          >
            <GraduationCap className="h-4.5 w-4.5 text-sky-400" />
            <span className="font-medium">GPA Calculator</span>
          </Link>
          <Link
            to="/calculator/cgpa"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sky-100/80 hover:bg-sky-500/10 hover:text-white transition-all duration-200"
          >
            <TrendingUp className="h-4.5 w-4.5 text-emerald-400" />
            <span className="font-medium">CGPA Calculator</span>
          </Link>

          <div className="h-px bg-sky-500/10 my-2" />

          <Link
            to="/#departments"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sky-100/80 hover:bg-sky-500/10 hover:text-white transition-all duration-200"
          >
            <Building className="h-4.5 w-4.5 text-sky-400" />
            <span className="font-medium">Departments</span>
          </Link>

          <div className="h-px bg-sky-500/10 my-2" />

          {user ? (
            <button
              onClick={() => { handleLogout(); setIsOpen(false); }}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-200 font-medium"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          ) : (
            <Link
              to="/login"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-2 w-full px-4 py-3.5 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl font-bold shadow-lg shadow-sky-500/25 transition-all duration-200 text-sm"
            >
              <LogIn className="h-4 w-4" />
              <span>Portal Login</span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
