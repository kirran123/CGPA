'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  GraduationCap,
  TrendingUp,
  FileCheck,
  Loader2,
  Shield,
  Building,
  Mail,
  User,
  Plus,
  Bookmark,
  Calendar,
  Download,
  Award
} from 'lucide-react';
import { api, DashboardStats } from '@/lib/api';

export default function AnalyticsDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  // Regulation creator
  const [newReg, setNewReg] = useState('');
  const [addingReg, setAddingReg] = useState(false);
  const [regulations, setRegulations] = useState<string[]>([]);

  const fetchDashboardData = async () => {
    try {
      const u = api.getCurrentUser();
      setUser(u);
      
      const data = await api.getDashboardStats();
      setStats(data);

      const regs = await api.getRegulations();
      setRegulations(regs.map((r: any) => r.name));
    } catch (err: any) {
      setError(err.message || 'Failed to fetch analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleAddRegulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReg.trim()) return;
    setAddingReg(true);
    try {
      await api.createRegulation(newReg.trim());
      setNewReg('');
      // Refresh regulations and dashboard data
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message || 'Failed to add regulation');
    } finally {
      setAddingReg(false);
    }
  };

  const handleDownloadPdf = async (recordId: string, studentName: string) => {
    try {
      const blob = await api.downloadGpaReportPdf(recordId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `GPA_Report_${studentName}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      console.error(err);
      alert('Failed to download report PDF.');
    }
  };

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-sky-300 gap-3">
        <div className="relative mb-2">
          <div className="w-12 h-12 border-2 border-sky-500/20 rounded-full" />
          <div className="absolute inset-0 w-12 h-12 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-sm text-sky-300/60 font-semibold">Loading portal insights...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-red-500/8 border border-red-500/20 text-red-400 p-8 rounded-2xl text-center max-w-xl mx-auto animate-scale-in">
        <p className="font-bold mb-1">Failed to load analytics</p>
        <p className="text-sm opacity-70 mb-4">{error || 'Please check backend service logs.'}</p>
        <button onClick={fetchDashboardData} className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/35 rounded-xl text-xs font-bold transition-all">Retry Connect</button>
      </div>
    );
  }

  const getRoleGreeting = () => {
    if (!user) return 'Welcome back';
    const hour = new Date().getHours();
    const time = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    return `${time}, ${user.name}`;
  };

  const isSuperAdmin = user?.role === 'super_admin';

  const getKpiLabel = (type: 'gpa' | 'cgpa' | 'total' | 'students') => {
    if (isSuperAdmin) {
      if (type === 'gpa') return 'Institution Avg GPA';
      if (type === 'cgpa') return 'Institution Avg CGPA';
      if (type === 'total') return 'Total Student Entries';
      return 'Unique Students';
    } else {
      if (type === 'gpa') return 'My Avg Calculated GPA';
      if (type === 'cgpa') return 'My Avg Calculated CGPA';
      if (type === 'total') return 'My Total Calculations';
      return 'My Unique Students';
    }
  };

  const kpis = [
    {
      label: getKpiLabel('total'),
      value: stats.stats.totalRecords.toLocaleString(),
      icon: <FileCheck className="h-5 w-5 text-sky-400" />,
      desc: isSuperAdmin ? 'Cumulative recorded sets' : 'Calculated by me',
      color: 'text-sky-400',
      bg: 'bg-sky-500/10',
      border: 'border-sky-500/15'
    },
    {
      label: getKpiLabel('students'),
      value: stats.stats.totalStudents.toLocaleString(),
      icon: <Users className="h-5 w-5 text-blue-400" />,
      desc: isSuperAdmin ? 'Distinct register numbers' : 'Distinct students I calculated',
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/15'
    },
    {
      label: getKpiLabel('gpa'),
      value: stats.stats.avgGpa.toFixed(2),
      icon: <GraduationCap className="h-5 w-5 text-emerald-400" />,
      desc: isSuperAdmin ? 'Across semester records' : 'My calculation average',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/15'
    },
    {
      label: getKpiLabel('cgpa'),
      value: stats.stats.avgCgpa.toFixed(2),
      icon: <TrendingUp className="h-5 w-5 text-amber-400" />,
      desc: isSuperAdmin ? 'Overall CGPA average' : 'My CGPA average',
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/15'
    }
  ];

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 bg-gradient-to-r from-sky-950/20 to-blue-950/15 p-6 rounded-3xl border border-sky-500/10 relative overflow-hidden animate-fade-in-down">
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/5 rounded-full filter blur-3xl -translate-y-12 translate-x-12" />
        <div className="relative z-10">
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight font-['Outfit']">{getRoleGreeting()}</h1>
          <p className="text-xs text-sky-300/55 mt-1.5 max-w-2xl leading-relaxed">
            {isSuperAdmin
              ? 'Super Administrator Account — access department details, create syllabus regulations, inspect recent calculation logs, and maintain system controls.'
              : `Academic Staff Dashboard — Department: ${user?.department || 'RIT Faculty'}. Compute student grades and download certified reports.`}
          </p>
        </div>
        <div className="flex items-center gap-3 relative z-10 shrink-0">
          {isSuperAdmin ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-sky-500/10 border border-sky-500/20 rounded-xl text-xs font-bold text-sky-300">
              <Shield className="h-4 w-4" />
              <span>Super Admin</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs font-bold text-emerald-300">
              <GraduationCap className="h-4 w-4" />
              <span>{user?.role === 'dept_admin' ? 'Dept Admin' : 'Academic Staff'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Global KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {kpis.map((k, idx) => (
          <div
            key={idx}
            style={{animationDelay: `${idx * 40}ms`}}
            className="glass-card rounded-2xl p-5 border border-sky-500/10 hover:border-sky-500/25 flex flex-col justify-between hover:shadow-lg transition-all animate-fade-in-up"
          >
            <div className="flex justify-between items-start mb-3">
              <span className="text-[10px] font-bold text-sky-300/38 uppercase tracking-widest leading-none">{k.label}</span>
              <div className={`${k.bg} border ${k.border} p-2 rounded-xl text-white`}>
                {k.icon}
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-white leading-none font-['Outfit'] mb-1">{k.value}</div>
              <p className="text-[10px] text-sky-300/28 font-medium">{k.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Super Admin Sections */}
      {isSuperAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Department-Wise Overview (Left col-span 2) */}
          <div className="lg:col-span-2 space-y-4 animate-slide-left">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider font-['Outfit']">
              <Building className="h-4.5 w-4.5 text-sky-400" />
              Department-Wise Overview
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stats.departmentOverviews && stats.departmentOverviews.map((d, di) => (
                <div
                  key={d.code}
                  style={{animationDelay: `${di * 50}ms`}}
                  className="glass-card rounded-2xl p-5 border border-sky-500/10 hover:border-sky-500/22 hover:shadow-md transition-all flex flex-col justify-between animate-fade-in-up"
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <span className="badge-indigo">{d.code}</span>
                      <span className="text-[10px] text-sky-300/32 font-semibold">Branch Stats</span>
                    </div>
                    <h3 className="text-xs font-bold text-white mb-2 truncate font-['Outfit']" title={d.name}>{d.name}</h3>
                    
                    {/* HOD Details */}
                    <div className="bg-sky-950/30 border border-sky-500/6 rounded-xl p-2.5 space-y-1.5 mb-4">
                      <div className="flex items-center gap-1.5 text-[10px] text-sky-300/55 leading-none">
                        <User className="h-3 w-3 text-sky-400 shrink-0" />
                        <span>HOD: <span className="font-bold text-white">{d.hodName}</span></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-sky-300/55 leading-none">
                        <Mail className="h-3 w-3 text-sky-400 shrink-0" />
                        <a href={`mailto:${d.email}`} className="hover:text-white transition-colors truncate font-medium">{d.email}</a>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-t border-sky-500/6 pt-3 text-center">
                    <div className="bg-sky-500/[0.04] border border-sky-500/6 rounded-xl py-1.5">
                      <div className="text-xs font-extrabold text-white leading-none">{d.totalStudents}</div>
                      <div className="text-[8px] text-sky-300/30 uppercase mt-0.5">Students</div>
                    </div>
                    <div className="bg-emerald-500/[0.04] border border-emerald-500/6 rounded-xl py-1.5">
                      <div className="text-xs font-extrabold text-emerald-400 leading-none">{d.avgGpa > 0 ? d.avgGpa.toFixed(2) : 'N/A'}</div>
                      <div className="text-[8px] text-sky-300/30 uppercase mt-0.5">Avg GPA</div>
                    </div>
                    <div className="bg-amber-500/[0.04] border border-amber-500/6 rounded-xl py-1.5">
                      <div className="text-xs font-extrabold text-amber-400 leading-none">{d.avgCgpa > 0 ? d.avgCgpa.toFixed(2) : 'N/A'}</div>
                      <div className="text-[8px] text-sky-300/30 uppercase mt-0.5">Avg CGPA</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Regulations Manager (Right col-span 1) */}
          <div className="space-y-4 animate-slide-right">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider font-['Outfit']">
              <Bookmark className="h-4.5 w-4.5 text-sky-400" />
              Syllabus Regulations
            </h2>

            <div className="bg-white/[0.02] border border-sky-500/10 rounded-2xl p-5 backdrop-blur-xl space-y-5">
              <div>
                <h3 className="text-xs font-bold text-white">Active Regulations</h3>
                <p className="text-[10px] text-sky-300/38 mt-1">Configure and view registered academic regulations</p>
              </div>

              {/* Regulations badges */}
              <div className="flex flex-wrap gap-2">
                {regulations.map(r => (
                  <span key={r} className="px-3 py-1 bg-sky-500/10 border border-sky-500/20 text-sky-300 rounded-xl text-xs font-bold shadow-sm animate-scale-in">
                    Regulation {r}
                  </span>
                ))}
              </div>

              <div className="section-divider !my-1" />

              {/* Add Regulation Form */}
              <form onSubmit={handleAddRegulation} className="space-y-3.5">
                <div className="form-group">
                  <label className="form-label">Add Regulation Code</label>
                  <input
                    type="text"
                    required
                    value={newReg}
                    onChange={e => setNewReg(e.target.value)}
                    placeholder="e.g. 26"
                    className="w-full bg-[#071830] border border-sky-500/15 focus:border-sky-400/55 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none placeholder:text-sky-300/15 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={addingReg || !newReg.trim()}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all hover:-translate-y-0.5 disabled:opacity-50 cursor-pointer"
                >
                  {addingReg ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /><span>Registering...</span></>
                  ) : (
                    <><Plus className="h-3.5 w-3.5" /><span>Create Regulation</span></>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Recent calculations (Visible to all) */}
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider font-['Outfit']">
            <Award className="h-4.5 w-4.5 text-sky-400" />
            {isSuperAdmin ? 'Recent Student Performance Records' : 'My Recent Calculations'}
          </h2>
          {!isSuperAdmin && (
            <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1">
              <User className="h-3 w-3" />
              Showing only your own calculations
            </span>
          )}
        </div>

        <div className="bg-white/[0.02] border border-sky-500/10 rounded-2xl p-5 backdrop-blur-xl overflow-hidden">
          {(!stats.recentRecords || stats.recentRecords.length === 0) ? (
            <div className="py-12 text-center text-sky-300/38 text-xs">
              {isSuperAdmin
                ? 'No calculations saved to the database yet.'
                : 'You have not calculated any student grades yet. Click GPA or CGPA Calculation in the sidebar to start.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-sky-500/10 text-sky-300/38 uppercase font-bold tracking-wider">
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Register No.</th>
                    <th className="py-3 px-4 text-center">Semester</th>
                    <th className="py-3 px-4 text-center">Department</th>
                    <th className="py-3 px-4 text-center">GPA</th>
                    <th className="py-3 px-4 text-center">CGPA</th>
                    {isSuperAdmin && <th className="py-3 px-4 text-center">Calculated By</th>}
                    <th className="py-3 px-4 text-center">Saved On</th>
                    <th className="py-3 px-4 text-center">Report</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-500/6">
                  {stats.recentRecords.map((r, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-sky-500/[0.04] transition-colors text-white/90"
                    >
                      <td className="py-3.5 px-4 font-bold text-white">{r.studentName}</td>
                      <td className="py-3.5 px-4 font-mono text-sky-200/65">{r.registerNo}</td>
                      <td className="py-3.5 px-4 text-center font-bold">Sem {r.semester}</td>
                      <td className="py-3.5 px-4 text-center"><span className="badge-indigo">{r.department || 'N/A'}</span></td>
                      <td className="py-3.5 px-4 text-center text-emerald-400 font-bold">{r.gpa > 0 ? r.gpa.toFixed(2) : 'N/A'}</td>
                      <td className="py-3.5 px-4 text-center text-amber-400 font-bold">{r.cgpa > 0 ? r.cgpa.toFixed(2) : 'N/A'}</td>
                      {isSuperAdmin && (
                        <td className="py-3.5 px-4 text-center text-sky-300/55 font-semibold">{r.calculatedBy?.name || 'System'}</td>
                      )}
                      <td className="py-3.5 px-4 text-center text-sky-300/48 font-medium">
                        <span className="flex items-center justify-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-sky-400/48" />
                          {new Date(r.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleDownloadPdf(r.registerNo, r.studentName)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-sky-500/8 hover:bg-sky-500/18 border border-sky-500/12 hover:border-sky-400/30 rounded-lg text-sky-400 hover:text-white transition-all cursor-pointer font-bold text-[10px]"
                        >
                          <Download className="h-3 w-3" />
                          <span>PDF</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
