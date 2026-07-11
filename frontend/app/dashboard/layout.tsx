'use client';

import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  GraduationCap,
  BarChart3,
  Building,
  Users,
  BookOpen,
  FileSpreadsheet,
  History,
  LogOut,
  Menu,
  X,
  Shield,
  TrendingUp,
  ChevronRight,
  Settings,
} from 'lucide-react';
import { api } from '@/lib/api';
import ThemeToggle from '@/components/layout/ThemeToggle';
import FooterCredit from '@/components/layout/FooterCredit';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: string[];
  group: string;
}

const allNavItems: NavItem[] = [
  { label: 'Overview', path: '/dashboard', icon: <BarChart3 className="h-4 w-4" />, roles: ['super_admin', 'dept_admin', 'staff'], group: 'core' },
  { label: 'Departments', path: '/dashboard/departments', icon: <Building className="h-4 w-4" />, roles: ['super_admin'], group: 'admin' },
  { label: 'Staff Management', path: '/dashboard/staff', icon: <Users className="h-4 w-4" />, roles: ['super_admin', 'dept_admin'], group: 'admin' },
  { label: 'Syllabus Catalog', path: '/dashboard/subjects', icon: <BookOpen className="h-4 w-4" />, roles: ['super_admin', 'dept_admin', 'staff'], group: 'admin' },
  { label: 'Grade Settings', path: '/dashboard/grade-settings', icon: <Settings className="h-4 w-4" />, roles: ['super_admin', 'dept_admin', 'staff'], group: 'admin' },
  { label: 'GPA Calculation', path: '/dashboard/gpa', icon: <GraduationCap className="h-4 w-4" />, roles: ['super_admin', 'dept_admin', 'staff'], group: 'calc' },
  { label: 'CGPA Calculation', path: '/dashboard/cgpa', icon: <TrendingUp className="h-4 w-4" />, roles: ['super_admin', 'dept_admin', 'staff'], group: 'calc' },
  { label: 'Bulk GPA Upload', path: '/dashboard/bulk/gpa', icon: <FileSpreadsheet className="h-4 w-4" />, roles: ['super_admin', 'dept_admin', 'staff'], group: 'tools' },
  { label: 'Batch Results', path: '/dashboard/bulk/gpa/batches', icon: <FileSpreadsheet className="h-4 w-4" />, roles: ['super_admin', 'dept_admin', 'staff'], group: 'tools' },
  { label: 'History & Logs', path: '/dashboard/history', icon: <History className="h-4 w-4" />, roles: ['super_admin', 'dept_admin', 'staff'], group: 'logs' },
];

const groupLabels: Record<string, string> = {
  core: 'Overview',
  admin: 'Administration',
  calc: 'Calculations',
  tools: 'Bulk Tools',
  logs: 'Activity Logs'
};

const roleConfig: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode; dotColor: string }> = {
  super_admin: {
    label: 'Super Administrator',
    color: 'text-sky-300',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/25',
    icon: <Shield className="h-3 w-3" />,
    dotColor: 'bg-sky-400'
  },
  dept_admin: {
    label: 'Department Admin',
    color: 'text-amber-300',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/25',
    icon: <Building className="h-3 w-3" />,
    dotColor: 'bg-amber-400'
  },
  staff: {
    label: 'Academic Staff',
    color: 'text-emerald-300',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/25',
    icon: <Users className="h-3 w-3" />,
    dotColor: 'bg-emerald-400'
  }
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;

  useEffect(() => {
    const handleAuth = () => {
      const currentUser = api.getCurrentUser();
      if (!currentUser) {
        navigate('/login');
        return;
      }
      setUser(currentUser);
      setLoading(false);

      if ((pathname === '/dashboard' || pathname === '/dashboard/') && currentUser.role !== 'super_admin') {
        const allowed = allNavItems.filter(item => item.roles.includes(currentUser.role));
        if (allowed.length > 0) navigate(allowed[0].path);
      }
    };

    handleAuth();

    window.addEventListener('auth-change', handleAuth);
    window.addEventListener('storage', handleAuth);

    return () => {
      window.removeEventListener('auth-change', handleAuth);
      window.removeEventListener('storage', handleAuth);
    };
  }, [pathname]);

  const handleLogout = () => { api.logout(); navigate('/'); };

  /* ── Loading screen ── */
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#040f24] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-5">
          <div className="relative">
            <div className="w-14 h-14 border-2 border-sky-500/15 rounded-full" />
            <div className="absolute inset-0 w-14 h-14 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
            <div className="absolute inset-2 w-10 h-10 border border-blue-400/30 border-b-transparent rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
          </div>
          <div className="text-center">
            <p className="text-sm text-sky-300/70 font-semibold">Initializing secure session</p>
            <p className="text-xs text-sky-400/40 mt-1">Verifying credentials...</p>
          </div>
        </div>
      </div>
    );
  }

  const allowedNavItems = allNavItems.filter(item => item.roles.includes(user.role));
  const rc = roleConfig[user.role] || roleConfig.staff;

  const grouped: Record<string, NavItem[]> = {};
  for (const item of allowedNavItems) {
    if (!grouped[item.group]) grouped[item.group] = [];
    grouped[item.group].push(item);
  }

  const getPageTitle = () => {
    const matched = allowedNavItems.find(item => item.path === pathname);
    return matched ? matched.label : 'Dashboard';
  };

  /* ── Sidebar content (shared between desktop & mobile drawer) ── */
  const SidebarContent = () => (
    <div className="flex flex-col h-full">

      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-sky-900/40 shrink-0">
        <img src="/rit-logo.jpg" alt="RIT Logo" className="h-10 w-10 object-contain flex-shrink-0 mix-blend-multiply" />
        <div className="flex flex-col leading-none">
          <span className="font-bold text-sm text-white tracking-wide font-['Outfit']">RIT Portal</span>
          <span className="text-sky-400/40 text-[10px] font-medium">CGPA Calculator</span>
        </div>
      </div>

      {/* User Profile Card */}
      <div className="mx-4 mt-5 mb-4">
        <div className={`${rc.bg} border ${rc.border} rounded-2xl p-3.5 relative overflow-hidden`}>
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-white/[0.03] to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="flex items-center gap-3 relative z-10">
            <div className={`h-9 w-9 rounded-xl ${rc.bg} border ${rc.border} flex items-center justify-center font-black text-base ${rc.color} shadow-inner`}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white truncate font-['Outfit']">{user.name}</div>
              <div className={`flex items-center gap-1.5 text-[10px] font-semibold ${rc.color} mt-0.5`}>
                <div className={`w-1.5 h-1.5 rounded-full ${rc.dotColor} animate-pulse`} />
                {rc.icon}
                <span>{rc.label}</span>
              </div>
            </div>
          </div>
          {user.department && (
            <div className="mt-2.5 pt-2.5 border-t border-white/[0.06] flex items-center gap-1.5">
              <Building className="h-3 w-3 text-sky-400/50" />
              <span className="text-[10px] text-sky-300/50 truncate">{user.department}</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-grow px-3 pb-4 overflow-y-auto space-y-0.5">
        {Object.entries(grouped).map(([group, items]) => (
          <div key={group} className="mb-4">
            <div className="px-3 py-1.5 text-[9px] font-bold text-sky-300/28 uppercase tracking-[0.15em]">
              {groupLabels[group]}
            </div>
            {items.map((item) => {
              const active = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group mb-0.5 ${active
                      ? 'nav-link-active text-white'
                      : 'text-sky-200/45 hover:bg-sky-500/[0.08] hover:text-white'
                    }`}
                >
                  <span className={`${active ? 'text-white' : 'text-sky-400/50 group-hover:text-sky-300'} transition-colors`}>
                    {item.icon}
                  </span>
                  <span className="flex-1 text-[13px]">{item.label}</span>
                  {active && <ChevronRight className="h-3 w-3 opacity-60" />}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Logout + Footer Credit */}
      <div className="px-3 border-t border-sky-900/35 pt-3 shrink-0">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sky-300/45 hover:text-red-400 hover:bg-red-500/8 w-full transition-all duration-150 cursor-pointer group"
        >
          <LogOut className="h-4 w-4 group-hover:rotate-12 transition-transform" />
          <span>Sign Out</span>
        </button>
        <FooterCredit variant="sidebar" className="mt-1" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#040f24] text-white flex" style={{ overflowX: 'hidden' }}>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 glass-sidebar border-r border-sky-900/35 shrink-0 fixed top-0 bottom-0 left-0 z-40">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
      <div className={`fixed inset-0 z-50 lg:hidden transition-all duration-300 ${sidebarOpen ? 'pointer-events-auto visible' : 'pointer-events-none invisible'}`}>
        <div
          className={`absolute inset-0 bg-black/70 transition-all duration-300 ${sidebarOpen ? 'opacity-100 backdrop-blur-sm pointer-events-auto visible' : 'opacity-0 pointer-events-none invisible'
            }`}
          onClick={() => setSidebarOpen(false)}
        />
        <aside className={`absolute top-0 bottom-0 left-0 w-64 glass-sidebar border-r border-sky-900/40 flex flex-col transition-transform duration-300 ease-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <SidebarContent />
        </aside>
      </div>

      {/* Main Content */}
      <div className="flex-grow flex flex-col lg:ml-64" style={{ minHeight: '100vh', overflowX: 'hidden' }}>

        {/* Top Header */}
        <header className="h-16 bg-[#040f24]/80 border-b border-sky-900/30 px-4 sm:px-6 flex justify-between items-center shrink-0 sticky top-0 z-30 backdrop-blur-2xl">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 bg-sky-900/35 hover:bg-sky-900/60 rounded-xl text-sky-300 hover:text-white transition-all"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sky-300/32 text-xs font-medium">
              <span>Dashboard</span>
              {getPageTitle() !== 'Dashboard' && (
                <>
                  <ChevronRight className="h-3 w-3" />
                  <span className="text-white font-semibold text-sm">{getPageTitle()}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${rc.bg} border ${rc.border}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${rc.dotColor} animate-pulse`} />
              <span className={rc.color}>{rc.icon}</span>
              <span className={`text-xs font-semibold ${rc.color}`}>{rc.label}</span>
            </div>
            <ThemeToggle />
            <div
              className={`h-9 w-9 rounded-xl ${rc.bg} border ${rc.border} flex items-center justify-center font-black text-sm ${rc.color} cursor-default`}
              title={user.name}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-grow p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto animate-fade-in">
          {children || <Outlet />}
        </main>

        {/* Mobile footer credit */}
        <div className="lg:hidden">
          <FooterCredit />
        </div>
      </div>
    </div>
  );
}
