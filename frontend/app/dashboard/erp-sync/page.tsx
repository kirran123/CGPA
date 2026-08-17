'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  Key,
  CheckCircle2,
  AlertCircle,
  Building,
  GraduationCap,
  Bookmark,
  Users,
  Terminal,
  Clock,
  Sparkles,
  Database,
  ArrowRight,
  Eye,
  EyeOff,
  Zap,
  CalendarClock,
} from 'lucide-react';
import { api } from '@/lib/api';

const DEFAULT_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzZXJ2aWNlOnByaW1hcnktYXBpLWNvbnN1bWVyIiwic3ZjIjp0cnVlLCJqdGkiOiIzZjFjOWE3ZTViMmQ0OGM2IiwiaXNfYWRtaW4iOmZhbHNlLCJpYXQiOjE3ODY5NDg5NTEsImV4cCI6MjEwMjMwODk1MX0.06bbln7QeWOOHB9ch66JPYdiKEJyX0_AOF_lDrrIWDo";

export default function DashboardErpSync() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Connection settings
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);

  // Sync options
  const [syncDepts, setSyncDepts] = useState(true);
  const [syncRegs, setSyncRegs] = useState(true);
  const [syncSubjects, setSyncSubjects] = useState(true);
  const [syncStudents, setSyncStudents] = useState(true);

  // Sync execution status
  const [syncing, setSyncing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Results status
  const [syncResults, setSyncResults] = useState<any>(null);

  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Authenticate user & load initial token
  useEffect(() => {
    const user = api.getCurrentUser();
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.role !== 'super_admin') {
      navigate('/dashboard');
      return;
    }
    setCurrentUser(user);

    // Load persisted token or use default
    const savedToken = localStorage.getItem('rit_erp_token');
    setToken(savedToken || DEFAULT_TOKEN);
    setLoadingInitial(false);
  }, [navigate]);

  // Auto-scroll the log console to the bottom when new logs arrive
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleSaveToken = () => {
    localStorage.setItem('rit_erp_token', token.trim());
    setStatusMsg({ type: 'success', text: 'ERP authentication token saved successfully!' });
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const handleResetToken = () => {
    setToken(DEFAULT_TOKEN);
    localStorage.setItem('rit_erp_token', DEFAULT_TOKEN);
    setStatusMsg({ type: 'success', text: 'Reset to default ERP authentication token.' });
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const handleTriggerSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setStatusMsg({ type: 'error', text: 'Please configure a valid Bearer Token before syncing.' });
      return;
    }

    setSyncing(true);
    setLogs(['Initiating connection to RIT ERP System...', `Endpoint: https://api.ritrjpm.edu.in/backend/api/academic`]);
    setSyncResults(null);
    setStatusMsg(null);

    try {
      const response = await api.syncErpData(token.trim(), {
        syncDepartments: syncDepts,
        syncRegulations: syncRegs,
        syncSubjects: syncSubjects,
        syncStudents: syncStudents,
      });

      if (response.logs) {
        setLogs((prev) => [...prev, ...response.logs, 'ERP Data Synchronization finished successfully!']);
      }
      setSyncResults(response.results);
      setStatusMsg({ type: 'success', text: 'ERP synchronization completed successfully!' });
    } catch (err: any) {
      console.error(err);
      setLogs((prev) => [...prev, `[ERROR] Sync failed: ${err.message || err}`]);
      setStatusMsg({ type: 'error', text: err.message || 'ERP synchronization failed. Check console logs.' });
    } finally {
      setSyncing(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="h-80 flex flex-col items-center justify-center text-sky-300 gap-3">
        <RefreshCw className="h-8 w-8 animate-spin text-sky-400" />
        <p className="text-sm text-sky-300/50">Verifying administrator authorization...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 bg-gradient-to-r from-sky-950/20 to-blue-950/15 p-6 rounded-3xl border border-sky-500/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/5 rounded-full filter blur-3xl -translate-y-12 translate-x-12" />
        <div className="relative z-10">
          <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5 font-['Outfit'] tracking-tight">
            <RefreshCw className="h-6 w-6 text-sky-400 shrink-0" />
            ERP Synchronisation Manager
          </h1>
          <p className="text-xs text-sky-300/60 mt-1.5 max-w-2xl leading-relaxed font-medium">
            Retrieve up-to-date departmental structures, regulations, subjects, credit weights, and student roster profiles directly from the institutional RIT ERP. Reconciles academic entries automatically.
          </p>
        </div>
      </div>

      {/* Live Sync Active Banner */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 flex items-center gap-3 p-3.5 bg-sky-500/5 border border-sky-500/20 rounded-2xl">
          <div className="p-2 bg-sky-500/10 rounded-xl shrink-0">
            <Zap className="h-4 w-4 text-sky-400" />
          </div>
          <div>
            <p className="text-xs font-extrabold text-white">Live Sync Active</p>
            <p className="text-[10px] text-sky-300/50 mt-0.5">
              ERP data is automatically synced to this system. Departments, regulations, and subjects stay current without duplicates.
            </p>
          </div>
        </div>
        <div className="flex-1 flex items-center gap-3 p-3.5 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl">
          <div className="p-2 bg-indigo-500/10 rounded-xl shrink-0">
            <CalendarClock className="h-4 w-4 text-indigo-400" />
          </div>
          <div>
            <p className="text-xs font-extrabold text-white">Scheduled: Daily 07:30 IST</p>
            <p className="text-[10px] text-indigo-300/50 mt-0.5">
              Automatic full sync runs at 02:00 UTC daily. Use the manual trigger below for an immediate update.
            </p>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {statusMsg && (
        <div
          className={`p-4 rounded-2xl flex items-start gap-3 border transition-all duration-300 shadow-md ${
            statusMsg.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/15 border-red-500/30 text-red-300'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
          )}
          <div className="text-xs font-bold">{statusMsg.text}</div>
        </div>
      )}

      {/* Main Grid: Control Panel (Left) & Results/Console (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Connection & Configuration */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Connection Settings Card */}
          <div className="bg-[#071830]/80 border border-sky-500/20 rounded-2xl p-5 backdrop-blur-xl shadow-lg space-y-4">
            <h2 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 font-['Outfit']">
              <Key className="h-4 w-4 text-sky-400" />
              ERP Integration Credentials
            </h2>
            <div className="section-divider !my-1" />

            <div className="space-y-3">
              <div className="form-group relative">
                <label className="form-label text-[10px] text-sky-300/60 uppercase font-bold tracking-wider">Bearer Authorization Token</label>
                <div className="relative flex items-center">
                  <input
                    type={showToken ? "text" : "password"}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Enter Bearer Token..."
                    className="w-full bg-[#050d21] border border-sky-500/25 focus:border-sky-400/50 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-sky-200 focus:outline-none transition-all placeholder:text-sky-300/20 shadow-inner font-mono truncate"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3.5 text-sky-300/40 hover:text-white transition-colors"
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={handleSaveToken}
                  className="flex-1 px-3.5 py-2 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-300 text-xs font-bold rounded-xl transition-all cursor-pointer text-center"
                >
                  Save Token Local
                </button>
                <button
                  type="button"
                  onClick={handleResetToken}
                  className="px-3.5 py-2 bg-sky-950/40 hover:bg-sky-900/40 border border-sky-500/10 text-sky-400/70 text-xs font-semibold rounded-xl transition-all cursor-pointer text-center"
                  title="Reset to default API token"
                >
                  Reset Default
                </button>
              </div>
            </div>
          </div>

          {/* Sync Resources Options */}
          <div className="bg-[#071830]/80 border border-sky-500/20 rounded-2xl p-5 backdrop-blur-xl shadow-lg space-y-4">
            <h2 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 font-['Outfit']">
              <Database className="h-4 w-4 text-sky-400" />
              Configure Sync Target
            </h2>
            <div className="section-divider !my-1" />

            <div className="space-y-3.5">
              {/* Dept Option */}
              <label className="flex items-center justify-between p-3 bg-[#050d21]/60 border border-sky-500/10 hover:border-sky-500/20 rounded-xl cursor-pointer transition-all">
                <div className="flex items-center gap-3">
                  <Building className="h-4.5 w-4.5 text-sky-400 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">Departments</span>
                    <span className="text-[10px] text-sky-300/40 mt-0.5">Degree branch details</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={syncDepts}
                  onChange={(e) => setSyncDepts(e.target.checked)}
                  className="w-4 h-4 rounded text-sky-500 focus:ring-sky-500 bg-[#050d21] border-sky-500/30"
                />
              </label>

              {/* Regulation Option */}
              <label className="flex items-center justify-between p-3 bg-[#050d21]/60 border border-sky-500/10 hover:border-sky-500/20 rounded-xl cursor-pointer transition-all">
                <div className="flex items-center gap-3">
                  <Bookmark className="h-4.5 w-4.5 text-indigo-400 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">Regulations</span>
                    <span className="text-[10px] text-sky-300/40 mt-0.5">Syllabus regulation codes</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={syncRegs}
                  onChange={(e) => setSyncRegs(e.target.checked)}
                  className="w-4 h-4 rounded text-sky-500 focus:ring-sky-500 bg-[#050d21] border-sky-500/30"
                />
              </label>

              {/* Subjects Option */}
              <label className="flex items-center justify-between p-3 bg-[#050d21]/60 border border-sky-500/10 hover:border-sky-500/20 rounded-xl cursor-pointer transition-all">
                <div className="flex items-center gap-3">
                  <GraduationCap className="h-4.5 w-4.5 text-emerald-400 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">Subjects & Course Hours</span>
                    <span className="text-[10px] text-sky-300/40 mt-0.5">Courses and credit configurations</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={syncSubjects}
                  onChange={(e) => setSyncSubjects(e.target.checked)}
                  className="w-4 h-4 rounded text-sky-500 focus:ring-sky-500 bg-[#050d21] border-sky-500/30"
                />
              </label>

              {/* Students Option */}
              <label className="flex items-center justify-between p-3 bg-[#050d21]/60 border border-sky-500/10 hover:border-sky-500/20 rounded-xl cursor-pointer transition-all">
                <div className="flex items-center gap-3">
                  <Users className="h-4.5 w-4.5 text-amber-400 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">Students Master Roster</span>
                    <span className="text-[10px] text-sky-300/40 mt-0.5">Registered student profiles & batch mapping</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={syncStudents}
                  onChange={(e) => setSyncStudents(e.target.checked)}
                  className="w-4 h-4 rounded text-sky-500 focus:ring-sky-500 bg-[#050d21] border-sky-500/30"
                />
              </label>
            </div>

            <button
              onClick={handleTriggerSync}
              disabled={syncing || (!syncDepts && !syncRegs && !syncSubjects && !syncStudents)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-extrabold rounded-xl shadow-lg hover:shadow-sky-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer uppercase tracking-wider font-['Outfit']"
            >
              {syncing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Syncing ERP Assets...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Trigger Synchronisation</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Side: Results Metrics & Real-time Console Log */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Sync Statistics Dashboard (only shows when sync results are returned) */}
          {syncResults && (
            <div className="bg-[#071830]/80 border border-sky-500/20 rounded-2xl p-5 backdrop-blur-xl shadow-lg space-y-4">
              <h2 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 font-['Outfit']">
                <Sparkles className="h-4 w-4 text-sky-400" />
                Latest Sync Metrics
              </h2>
              <div className="section-divider !my-1" />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                {/* Dept Stats */}
                {syncDepts && (
                  <div className="bg-[#050d21]/60 border border-sky-500/10 rounded-xl p-3 text-center">
                    <div className="text-[9px] font-bold text-sky-300/40 uppercase tracking-wider">Departments</div>
                    <div className="text-xl font-black text-white mt-1.5">{syncResults.departments.fetched}</div>
                    <div className="text-[8px] font-semibold text-emerald-400/80 mt-1">
                      +{syncResults.departments.inserted} Ins / {syncResults.departments.updated} Upd
                    </div>
                  </div>
                )}
                {/* Reg Stats */}
                {syncRegs && (
                  <div className="bg-[#050d21]/60 border-sky-500/10 rounded-xl p-3 text-center border">
                    <div className="text-[9px] font-bold text-indigo-300/40 uppercase tracking-wider">Regulations</div>
                    <div className="text-xl font-black text-white mt-1.5">{syncResults.regulations.fetched}</div>
                    <div className="text-[8px] font-semibold text-indigo-400/80 mt-1">
                      +{syncResults.regulations.inserted} Created
                    </div>
                  </div>
                )}
                {/* Subject Stats */}
                {syncSubjects && (
                  <div className="bg-[#050d21]/60 border-sky-500/10 rounded-xl p-3 text-center border">
                    <div className="text-[9px] font-bold text-emerald-300/40 uppercase tracking-wider">Subjects</div>
                    <div className="text-xl font-black text-white mt-1.5">{syncResults.subjects.fetched}</div>
                    <div className="text-[8px] font-semibold text-emerald-400/80 mt-1">
                      +{syncResults.subjects.inserted} Ins / {syncResults.subjects.updated} Upd
                    </div>
                  </div>
                )}
                {/* Student Stats */}
                {syncStudents && (
                  <div className="bg-[#050d21]/60 border-sky-500/10 rounded-xl p-3 text-center border">
                    <div className="text-[9px] font-bold text-amber-300/40 uppercase tracking-wider">Students</div>
                    <div className="text-xl font-black text-white mt-1.5">{syncResults.students.fetched}</div>
                    <div className="text-[8px] font-semibold text-emerald-400/80 mt-1">
                      +{syncResults.students.inserted} Processed
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Console Log Screen */}
          <div className="bg-[#071830]/80 border border-sky-500/20 rounded-2xl p-5 backdrop-blur-xl shadow-lg flex flex-col h-[400px]">
            <div className="flex justify-between items-center pb-3 border-b border-sky-500/10 shrink-0">
              <h2 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 font-['Outfit']">
                <Terminal className="h-4 w-4 text-sky-400" />
                Live Sync Console Logs
              </h2>
              <div className="flex items-center gap-1.5 text-[10px] text-sky-300/40 font-mono">
                <Clock className="h-3 w-3" />
                <span>UTC Time</span>
              </div>
            </div>

            {/* Scrollable logs box */}
            <div className="flex-1 min-h-0 bg-[#030a17] border border-sky-500/10 rounded-xl p-4 mt-4 overflow-y-auto font-mono text-[11px] text-sky-300/80 space-y-2 scrollbar-thin">
              {logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-sky-300/20 gap-2">
                  <Database className="h-7 w-7" />
                  <p>Console idle. Configure options and trigger sync above.</p>
                </div>
              ) : (
                logs.map((log, index) => {
                  const isError = log.includes('[ERROR]') || log.includes('Failure') || log.includes('failed');
                  return (
                    <div key={index} className={`leading-relaxed flex gap-2 ${isError ? 'text-red-400' : ''}`}>
                      <span className="text-sky-300/20 select-none shrink-0"><ArrowRight className="h-3.5 w-3.5 inline mt-0.5" /></span>
                      <span>{log}</span>
                    </div>
                  );
                })
              )}
              <div ref={consoleEndRef} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
