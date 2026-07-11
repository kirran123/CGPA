'use client';

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { LogIn, Mail, Lock, Loader2, GraduationCap, ShieldAlert, Shield, Building, Users, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import FooterCredit from '@/components/layout/FooterCredit';
import ThemeToggle from '@/components/layout/ThemeToggle';

type RoleTab = 'super_admin' | 'dept_admin' | 'staff';

interface RoleConfig {
  id: RoleTab;
  label: string;
  icon: React.ReactNode;
  desc: string;
  placeholder: { email: string; password: string };
  color: string;
  borderColor: string;
  bgColor: string;
}

const roles: RoleConfig[] = [
  {
    id: 'super_admin',
    label: 'Administrator',
    icon: <Shield className="h-4 w-4" />,
    desc: 'Full system access — manage all departments, staff, and platform settings.',
    placeholder: { email: 'admin@gmail.com', password: '••••••••' },
    color: 'text-sky-300',
    borderColor: 'border-sky-500',
    bgColor: 'bg-sky-500/10'
  },
  {
    id: 'dept_admin',
    label: 'Dept. Admin',
    icon: <Building className="h-4 w-4" />,
    desc: 'Departmental access — manage staff, subjects, and view department analytics.',
    placeholder: { email: 'hod@rit.edu.in', password: '••••••••' },
    color: 'text-amber-300',
    borderColor: 'border-amber-500',
    bgColor: 'bg-amber-500/10'
  },
  {
    id: 'staff',
    label: 'Staff',
    icon: <Users className="h-4 w-4" />,
    desc: 'Faculty access — calculate GPA/CGPA and view history.',
    placeholder: { email: 'staff@rit.edu.in', password: '••••••••' },
    color: 'text-emerald-300',
    borderColor: 'border-emerald-500',
    bgColor: 'bg-emerald-500/10'
  }
];

export default function LoginPage() {
  const [activeRole, setActiveRole] = useState<RoleTab>('super_admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const user = api.getCurrentUser();
    if (user) {
      const path =
        user.role === 'super_admin' ? '/dashboard'
          : user.role === 'dept_admin' ? '/dashboard/staff'
            : '/dashboard/subjects';
      navigate(path);
    }
  }, []);

  const activeConfig = roles.find(r => r.id === activeRole)!;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await api.login({ email, password });
      const roleMap: Record<string, RoleTab> = {
        super_admin: 'super_admin',
        dept_admin: 'dept_admin',
        staff: 'staff'
      };
      const userRole = roleMap[user.role];
      if (userRole !== activeRole) {
        api.logout();
        setError(`This account is not registered as ${activeConfig.label}. Please select the correct role tab.`);
        setLoading(false);
        return;
      }
      const path =
        user.role === 'super_admin' ? '/dashboard'
          : user.role === 'dept_admin' ? '/dashboard/staff'
            : '/dashboard/subjects';
      navigate(path);
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (role: RoleTab) => {
    setActiveRole(role);
    setEmail('');
    setPassword('');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#040f24] flex items-center justify-center px-4 relative overflow-hidden">
      {/* Floating Theme Toggle */}
      <div className="absolute top-6 right-6 z-50 glass-card p-1 rounded-xl border border-sky-500/15 shadow-xl hover:scale-105 transition-all duration-300">
        <ThemeToggle />
      </div>

      {/* Background orbs */}
      <div className="orb orb-sky  w-[500px] h-[500px] top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-45" />
      <div className="orb orb-blue w-[300px] h-[300px] bottom-0 right-1/4 opacity-25" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex flex-col items-center gap-3 group">
            <img src="/rit-logo.jpg" alt="RIT Logo" className="h-20 w-20 object-contain group-hover:scale-105 transition-transform duration-300 mix-blend-multiply" />
            <div>
              <div className="text-white font-bold text-lg tracking-wide font-['Outfit']">RIT Portal</div>
              <div className="text-sky-400/50 text-xs font-medium">CGPA Calculator</div>
            </div>
          </Link>
        </div>

        {/* Card */}
        <div className="glass-card rounded-2xl border border-sky-500/14 overflow-hidden">
          {/* Role Tabs */}
          <div className="flex border-b border-sky-500/10">
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => handleTabChange(role.id)}
                className={`flex-1 flex flex-col items-center gap-1.5 px-3 py-4 text-center transition-all duration-200 relative cursor-pointer login-tab ${activeRole === role.id
                    ? `${role.color} bg-white/[0.03] login-tab-active ${role.id}`
                    : 'text-sky-200/38 hover:text-sky-200/65 hover:bg-white/[0.015] login-tab-inactive'
                  }`}
              >
                {role.icon}
                <span className="text-[11px] font-semibold">{role.label}</span>
                {activeRole === role.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-current opacity-75 rounded-full" />
                )}
              </button>
            ))}
          </div>

          <div className="p-7">
            {/* Role description */}
            <div className={`flex items-start gap-3 p-3 rounded-xl ${activeConfig.bgColor} border border-current/10 mb-6`}>
              <div className={`${activeConfig.color} mt-0.5 shrink-0`}>{activeConfig.icon}</div>
              <p className={`text-xs leading-relaxed ${activeConfig.color} opacity-80`}>{activeConfig.desc}</p>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs flex items-start gap-2 mb-5">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-[11px] font-semibold text-sky-300/75 uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-sky-400/55">
                    <Mail className="h-4 w-4" />
                  </span>
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder={activeConfig.placeholder.email}
                    className="w-full bg-[#071830] border border-sky-500/18 focus:border-sky-400/55 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-sky-300/22 focus:outline-none focus:ring-2 focus:ring-sky-500/12 transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[11px] font-semibold text-sky-300/75 uppercase tracking-wider mb-2">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-sky-400/55">
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    id="login-password"
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#071830] border border-sky-500/18 focus:border-sky-400/55 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-sky-300/22 focus:outline-none focus:ring-2 focus:ring-sky-500/12 transition-all"
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                id="login-submit-btn"
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 w-full py-3.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-sky-500/22 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sky-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    <span>Sign In as {activeConfig.label}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Back link */}
        <div className="text-center mt-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-sky-300 hover:text-white bg-sky-500/10 hover:bg-sky-500/18 border border-sky-500/18 hover:border-sky-400/38 px-5 py-2.5 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-sky-500/10 hover:-translate-y-0.5 cursor-pointer login-return-btn"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Public Website</span>
          </Link>
        </div>

        <p className="text-center text-[10px] text-sky-300/20 mt-3 login-sessions-logged">
          Authorized access only. All sessions are logged.
        </p>
        <FooterCredit className="mt-3" />
      </div>
    </div>
  );
}
