'use client';

import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  Calendar, 
  User, 
  ShieldAlert, 
  Loader2,
  FileCheck,
  Building,
  Users,
  Settings,
  Download,
  GraduationCap,
  Award,
  Shield,
  ChevronDown
} from 'lucide-react';
import { api, HistoryLog, GpaRecord, CgpaRecord, Department } from '@/lib/api';

export default function HistoryLogs() {
  const [activeTab, setActiveTab] = useState<'calculations' | 'activity'>('calculations');
  const [logs, setLogs] = useState<HistoryLog[]>([]);
  const [gpaRecords, setGpaRecords] = useState<GpaRecord[]>([]);
  const [cgpaRecords, setCgpaRecords] = useState<CgpaRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  // '' means ALL departments (super admin only)
  const [selectedDept, setSelectedDept] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [loadingCalcs, setLoadingCalcs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const isSuperAdmin = currentUser?.role === 'super_admin';

  // Initialize
  useEffect(() => {
    const u = api.getCurrentUser();
    setCurrentUser(u);

    // Non-super-admin is locked to their own department
    if (u && u.role !== 'super_admin' && u.department) {
      setSelectedDept(u.department);
    }

    const loadDeptsAndLogs = async () => {
      try {
        setLoading(true);
        const depts = await api.getPublicDepartments();
        setDepartments(depts);

        // Super admin: default to "all" (empty string)
        // Others: already set their own dept above

        // Activity logs - backend already filters by role
        const activityLogs = await api.getHistoryLogs();
        setLogs(activityLogs);
      } catch (err: any) {
        setError(err.message || 'Failed to initialize logs.');
      } finally {
        setLoading(false);
      }
    };
    loadDeptsAndLogs();
  }, []);

  // Fetch GPA/CGPA calculations whenever dept or tab changes
  const loadCalculations = async (dept: string) => {
    setLoadingCalcs(true);
    try {
      // For super admin with no dept selected → fetch all (pass undefined)
      // For others → always use their locked dept
      const deptParam = dept || undefined;
      const gpas = await api.getGpaRecords(deptParam);
      const cgpas = await api.getCgpaRecords(deptParam);
      setGpaRecords(gpas);
      setCgpaRecords(cgpas);
    } catch (err) {
      console.error('Error loading calculated records:', err);
    } finally {
      setLoadingCalcs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'calculations' && currentUser) {
      loadCalculations(selectedDept);
    }
  }, [activeTab, selectedDept, currentUser]);

  const handleDownloadGpa = async (recordId: string, regNo: string, sem: number) => {
    setDownloadingId(recordId);
    try {
      const blob = await api.downloadGpaReportPdf(recordId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GPA_Sem${sem}_${regNo}.pdf`;
      a.click();
    } catch (err) {
      alert('Failed to download GPA report PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadCgpa = async (recordId: string, regNo: string) => {
    setDownloadingId(recordId);
    try {
      const blob = await api.downloadCgpaReportPdf(recordId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CGPA_${regNo}.pdf`;
      a.click();
    } catch (err) {
      alert('Failed to download CGPA report PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  const getActionIcon = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('gpa') || act.includes('cgpa')) return <FileCheck className="h-5 w-5 text-emerald-400" />;
    if (act.includes('department')) return <Building className="h-5 w-5 text-sky-400" />;
    if (act.includes('staff')) return <Users className="h-5 w-5 text-sky-400" />;
    return <Settings className="h-5 w-5 text-sky-400" />;
  };

  // Search filters
  const filteredGpa = gpaRecords.filter(r => {
    const q = search.toLowerCase();
    return r.studentName.toLowerCase().includes(q) || r.registerNo.toLowerCase().includes(q);
  });

  const filteredCgpa = cgpaRecords.filter(r => {
    const q = search.toLowerCase();
    return r.studentName.toLowerCase().includes(q) || r.registerNo.toLowerCase().includes(q);
  });

  const filteredLogs = logs.filter(log => {
    const query = search.toLowerCase();
    return (
      log.action.toLowerCase().includes(query) ||
      log.details.toLowerCase().includes(query) ||
      log.performedByName.toLowerCase().includes(query) ||
      (log.department && log.department.toLowerCase().includes(query))
    );
  });

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-sky-300">
        <Loader2 className="h-10 w-10 animate-spin text-sky-500 mb-3" />
        <p className="text-sm">Retrieving performance logs...</p>
      </div>
    );
  }

  // Role label for header
  const roleLabel = isSuperAdmin
    ? 'Showing all logs & calculations across the institution'
    : `Showing only your own logs & calculations`;

  const scopeColor = isSuperAdmin ? 'text-sky-300' : 'text-emerald-300';
  const scopeBg   = isSuperAdmin ? 'bg-sky-500/10 border-sky-500/20' : 'bg-emerald-500/10 border-emerald-500/20';
  const ScopeIcon = isSuperAdmin ? Shield : User;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">

      {/* Scope Banner */}
      <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-xs font-semibold ${scopeBg} ${scopeColor} animate-fade-in`}>
        <ScopeIcon className="h-4 w-4 shrink-0" />
        <span>{roleLabel}</span>
      </div>

      {/* Tab switcher + filters row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-sky-500/10">
        <div className="flex bg-[#040f24]/60 border border-sky-500/15 rounded-2xl p-1 shrink-0">
          <button
            onClick={() => setActiveTab('calculations')}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'calculations'
                ? 'bg-sky-500 text-white shadow-md'
                : 'text-sky-300 hover:text-white'
            }`}
          >
            Calculations History
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'activity'
                ? 'bg-sky-500 text-white shadow-md'
                : 'text-sky-300 hover:text-white'
            }`}
          >
            Activity Logs
          </button>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Department dropdown — only visible to super admin on calculations tab */}
          {activeTab === 'calculations' && isSuperAdmin && (
            <div className="relative">
              <select
                value={selectedDept}
                onChange={e => setSelectedDept(e.target.value)}
                className="appearance-none bg-[#040f24] border border-sky-500/20 focus:border-sky-500 rounded-xl pl-3 pr-8 py-2 text-xs text-white focus:outline-none cursor-pointer"
              >
                <option value="">All Departments</option>
                {departments.map(d => (
                  <option key={d._id} value={d.code}>{d.code} — {d.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-sky-400 pointer-events-none" />
            </div>
          )}

          <div className="relative w-full sm:w-64">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-sky-400">
              <Search className="h-4 w-4" />
            </span>
            <input 
              type="text" 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={activeTab === 'calculations' ? "Search student / reg no..." : "Search activities..."}
              className="w-full bg-[#040f24] border border-sky-500/20 focus:border-sky-500 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs flex items-center gap-2">
          <ShieldAlert className="h-4.5 w-4.5" />
          <span>{error}</span>
        </div>
      )}

      {/* ─── Calculations Tab ─── */}
      {activeTab === 'calculations' && (
        <div className="space-y-6">
          {loadingCalcs ? (
            <div className="h-48 flex items-center justify-center text-sky-300">
              <Loader2 className="h-8 w-8 animate-spin text-sky-500 mr-2" />
              <span className="text-xs">Fetching calculation history...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* GPA Calculations */}
              <div className="bg-white/[0.01] border border-sky-500/10 rounded-3xl p-6 backdrop-blur-xl">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2 border-b border-sky-500/10 pb-2">
                  <GraduationCap className="h-4.5 w-4.5 text-sky-400" />
                  GPA Calculation History
                  <span className="ml-auto text-[10px] bg-sky-500/10 border border-sky-500/15 text-sky-300 px-2 py-0.5 rounded-lg font-bold">
                    {filteredGpa.length} records
                  </span>
                </h3>

                {filteredGpa.length === 0 ? (
                  <p className="text-xs text-sky-300/40 italic text-center py-8">No GPA records found.</p>
                ) : (
                  <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                    {filteredGpa.map((record: any) => (
                      <div key={record._id} className="p-3.5 bg-sky-950/20 border border-sky-500/5 hover:border-sky-500/20 rounded-2xl flex justify-between items-center transition-all">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-white truncate">{record.studentName}</span>
                            <span className="text-[10px] font-mono text-sky-300/70 bg-sky-500/5 px-2 py-0.5 rounded border border-sky-500/10 shrink-0">{record.registerNo}</span>
                          </div>
                          <p className="text-[10px] text-sky-200/50">
                            Semester {record.semester} &nbsp;|&nbsp; Dept: <span className="text-sky-300/70">{record.department}</span> &nbsp;|&nbsp; {new Date(record.createdAt).toLocaleDateString('en-IN')}
                          </p>
                          {/* Show who calculated — useful for super admin to see across staff */}
                          {isSuperAdmin && record.calculatedBy?.name && (
                            <p className="text-[10px] text-sky-300/50 flex items-center gap-1">
                              <User className="h-3 w-3 text-sky-400/60" />
                              By: <span className="font-semibold text-sky-200/70">{record.calculatedBy.name}</span>
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-3">
                          <div className="text-right">
                            <span className="text-[10px] text-sky-300/60 block">GPA</span>
                            <span className="text-sm font-black text-emerald-400">{record.gpa.toFixed(2)}</span>
                          </div>
                          <button
                            onClick={() => handleDownloadGpa(record._id, record.registerNo, record.semester)}
                            disabled={downloadingId === record._id}
                            className="p-2 bg-sky-500/10 hover:bg-sky-500 border border-sky-500/20 text-sky-300 hover:text-white rounded-xl transition-all cursor-pointer"
                            title="Download PDF Report"
                          >
                            {downloadingId === record._id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* CGPA Calculations */}
              <div className="bg-white/[0.01] border border-sky-500/10 rounded-3xl p-6 backdrop-blur-xl">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2 border-b border-sky-500/10 pb-2">
                  <Award className="h-4.5 w-4.5 text-amber-400" />
                  CGPA Calculation History
                  <span className="ml-auto text-[10px] bg-amber-500/10 border border-amber-500/15 text-amber-300 px-2 py-0.5 rounded-lg font-bold">
                    {filteredCgpa.length} records
                  </span>
                </h3>

                {filteredCgpa.length === 0 ? (
                  <p className="text-xs text-sky-300/40 italic text-center py-8">No CGPA records found.</p>
                ) : (
                  <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                    {filteredCgpa.map((record: any) => (
                      <div key={record._id} className="p-3.5 bg-sky-950/20 border border-sky-500/5 hover:border-sky-500/20 rounded-2xl flex justify-between items-center transition-all">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-white truncate">{record.studentName}</span>
                            <span className="text-[10px] font-mono text-sky-300/70 bg-sky-500/5 px-2 py-0.5 rounded border border-sky-500/10 shrink-0">{record.registerNo}</span>
                          </div>
                          <p className="text-[10px] text-sky-200/50">
                            Semesters: {record.semesters.length} &nbsp;|&nbsp; Dept: <span className="text-sky-300/70">{record.department}</span> &nbsp;|&nbsp; {new Date(record.createdAt).toLocaleDateString('en-IN')}
                          </p>
                          {/* Show who calculated — super admin only */}
                          {isSuperAdmin && record.calculatedBy?.name && (
                            <p className="text-[10px] text-sky-300/50 flex items-center gap-1">
                              <User className="h-3 w-3 text-sky-400/60" />
                              By: <span className="font-semibold text-sky-200/70">{record.calculatedBy.name}</span>
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-3">
                          <div className="text-right">
                            <span className="text-[10px] text-sky-300/60 block">CGPA</span>
                            <span className="text-sm font-black text-amber-400">{record.cgpa.toFixed(2)}</span>
                          </div>
                          <button
                            onClick={() => handleDownloadCgpa(record._id, record.registerNo)}
                            disabled={downloadingId === record._id}
                            className="p-2 bg-sky-500/10 hover:bg-sky-500 border border-sky-500/20 text-sky-300 hover:text-white rounded-xl transition-all cursor-pointer"
                            title="Download PDF Report"
                          >
                            {downloadingId === record._id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      )}

      {/* ─── Activity Logs Tab ─── */}
      {activeTab === 'activity' && (
        <div className="bg-white/[0.01] border border-sky-500/10 rounded-3xl p-6 backdrop-blur-xl">
          {/* Count badge */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-sky-500/10">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <History className="h-4.5 w-4.5 text-sky-400" />
              {isSuperAdmin ? 'All System Activity Logs' : 'My Activity Logs'}
            </h3>
            <span className="text-[10px] bg-sky-500/10 border border-sky-500/15 text-sky-300 px-2 py-0.5 rounded-lg font-bold">
              {filteredLogs.length} entries
            </span>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="text-center text-sky-300/50 text-sm py-12">
              No activity records found matching your query.
            </div>
          ) : (
            <div className="divide-y divide-sky-500/5 max-h-[600px] overflow-y-auto">
              {filteredLogs.map((log) => (
                <div key={log._id} className="py-4 flex gap-4 items-start first:pt-0 last:pb-0">
                  <div className="bg-sky-500/10 p-2.5 rounded-xl shrink-0 mt-0.5">
                    {getActionIcon(log.action)}
                  </div>
                  <div className="flex-grow space-y-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-bold text-white leading-snug">{log.action}</span>
                      <span className="text-[10px] text-sky-300/50 font-semibold flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(log.timestamp).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <p className="text-xs text-sky-200/70 leading-relaxed">{log.details}</p>
                    <div className="flex items-center gap-3 text-[10px] text-sky-300/80 pt-1 font-medium flex-wrap">
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5 text-sky-400" />
                        Performed by: <span className="font-semibold text-white ml-0.5">{log.performedByName}</span>
                      </span>
                      {log.department && (
                        <span className="bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/10 text-[9px] uppercase font-bold tracking-wide">
                          {log.department}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
