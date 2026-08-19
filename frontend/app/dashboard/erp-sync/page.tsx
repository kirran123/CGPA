'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
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
  Zap,
  CalendarClock,
  XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';

const DEFAULT_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzZXJ2aWNlOnByaW1hcnktYXBpLWNvbnN1bWVyIiwic3ZjIjp0cnVlLCJqdGkiOiIzZjFjOWE3ZTViMmQ0OGM2IiwiaXNfYWRtaW4iOmZhbHNlLCJpYXQiOjE3ODY5NDg5NTEsImV4cCI6MjEwMjMwODk1MX0.06bbln7QeWOOHB9ch66JPYdiKEJyX0_AOF_lDrrIWDo";

// Messages that appear progressively in the console while the action runs server-side
const PROGRESS_STEPS = [
  { delay: 500,  msg: 'Authenticating with ERP bearer token...' },
  { delay: 2000, msg: 'Fetching departments from ERP (page 1)...' },
  { delay: 4500, msg: 'Fetching regulations from ERP...' },
  { delay: 7000, msg: 'Fetching courses — this may take a moment (large dataset)...' },
  { delay: 12000, msg: 'Fetching course_hours for credit mapping...' },
  { delay: 18000, msg: 'Applying upsert logic — no duplicates will be created...' },
  { delay: 25000, msg: 'Processing students roster...' },
  { delay: 35000, msg: 'Still syncing — large dataset in progress, please wait...' },
  { delay: 55000, msg: 'Finalising database writes...' },
  { delay: 75000, msg: 'Almost done — committing last batch...' },
];

export default function DashboardErpSync() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

  const [token, setToken] = useState('');

  const [syncDepts, setSyncDepts] = useState(true);
  const [syncRegs, setSyncRegs] = useState(true);
  const [syncSubjects, setSyncSubjects] = useState(true);
  const [syncStudents, setSyncStudents] = useState(true);

  const [syncing, setSyncing] = useState(false);
  const [logs, setLogs] = useState<{ text: string; type: 'info' | 'success' | 'error' | 'wait' }[]>([]);
  const [syncDone, setSyncDone] = useState<'success' | 'error' | null>(null);
  const [syncResults, setSyncResults] = useState<any>(null);
  const [elapsedSecs, setElapsedSecs] = useState(0);

  const consoleEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const user = api.getCurrentUser();
    if (!user) { navigate('/login'); return; }
    if (user.role !== 'super_admin') { navigate('/dashboard'); return; }
    setCurrentUser(user);
    const savedToken = localStorage.getItem('rit_erp_token');
    setToken(savedToken || DEFAULT_TOKEN);
    setLoadingInitial(false);
  }, [navigate]);

  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Cleanup timers on unmount
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    progressTimersRef.current.forEach(clearTimeout);
  }, []);

  const addLog = (text: string, type: 'info' | 'success' | 'error' | 'wait' = 'info') => {
    setLogs(prev => [...prev, { text, type }]);
  };



  const handleTriggerSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      addLog('ERROR: No Bearer Token configured.', 'error');
      return;
    }

    // Reset state
    setSyncing(true);
    setSyncDone(null);
    setSyncResults(null);
    setElapsedSecs(0);
    setLogs([
      { text: `[${new Date().toLocaleTimeString('en-IN')}] Manual sync initiated by ${currentUser?.name || 'Admin'}`, type: 'info' },
      { text: 'Connecting to https://api.ritrjpm.edu.in/backend/api/academic ...', type: 'info' },
    ]);

    // Start elapsed timer
    timerRef.current = setInterval(() => setElapsedSecs(s => s + 1), 1000);

    // Schedule progressive log messages while awaiting the server response
    progressTimersRef.current = PROGRESS_STEPS.map(({ delay, msg }) =>
      setTimeout(() => {
        setSyncing(curr => { if (curr) addLog(msg, 'wait'); return curr; });
      }, delay)
    );

    try {
      const response = await api.syncErpData(token.trim(), {
        syncDepartments: syncDepts,
        syncRegulations: syncRegs,
        syncSubjects: syncSubjects,
        syncStudents: syncStudents,
      });

      // Clear progress timers — real logs coming in
      progressTimersRef.current.forEach(clearTimeout);

      // Append real server logs
      if (response.logs?.length) {
        response.logs.forEach((l: string) => addLog(l, 'info'));
      }

      addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'success');
      addLog('✔ ERP Synchronisation completed successfully!', 'success');

      setSyncResults(response.results);
      setSyncDone('success');
    } catch (err: any) {
      progressTimersRef.current.forEach(clearTimeout);
      addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'error');
      addLog(`✘ Sync failed: ${err.message || err}`, 'error');
      setSyncDone('error');
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
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

  const fmtTime = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`;

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
            Retrieve up-to-date departmental structures, regulations, subjects, credit weights, and student roster profiles directly from the institutional RIT ERP.
          </p>
        </div>
      </div>

      {/* Info Banners */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 flex items-center gap-3 p-3.5 bg-sky-500/5 border border-sky-500/20 rounded-2xl">
          <div className="p-2 bg-sky-500/10 rounded-xl shrink-0"><Zap className="h-4 w-4 text-sky-400" /></div>
          <div>
            <p className="text-xs font-extrabold text-white">Live Sync Active</p>
            <p className="text-[10px] text-sky-300/50 mt-0.5">Upsert logic prevents any duplicate entries on every sync run.</p>
          </div>
        </div>
        <div className="flex-1 flex items-center gap-3 p-3.5 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl">
          <div className="p-2 bg-indigo-500/10 rounded-xl shrink-0"><CalendarClock className="h-4 w-4 text-indigo-400" /></div>
          <div>
            <p className="text-xs font-extrabold text-white">Scheduled: Daily 07:30 IST</p>
            <p className="text-[10px] text-indigo-300/50 mt-0.5">Auto-sync runs at 02:00 UTC daily via Convex cron — no server needed.</p>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left: Config */}
        <div className="lg:col-span-5 space-y-6">



          {/* Resources Card */}
          <div className="bg-[#071830]/80 border border-sky-500/20 rounded-2xl p-5 backdrop-blur-xl shadow-lg space-y-4">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 font-['Outfit']">
              <Database className="h-4 w-4 text-sky-400" /> Configure Sync Target
            </h2>
            <div className="section-divider !my-1" />
            <div className="space-y-3.5">
              {[
                { label: 'Departments', sub: 'Degree branch details', icon: <Building className="h-4 w-4 text-sky-400" />, val: syncDepts, set: setSyncDepts },
                { label: 'Regulations', sub: 'Syllabus regulation codes', icon: <Bookmark className="h-4 w-4 text-indigo-400" />, val: syncRegs, set: setSyncRegs },
                { label: 'Subjects & Course Hours', sub: 'Courses and credit configurations', icon: <GraduationCap className="h-4 w-4 text-emerald-400" />, val: syncSubjects, set: setSyncSubjects },
                { label: 'Students Master Roster', sub: 'Registered student profiles & batch mapping', icon: <Users className="h-4 w-4 text-amber-400" />, val: syncStudents, set: setSyncStudents },
              ].map(item => (
                <label key={item.label} className="flex items-center justify-between p-3 bg-[#050d21]/60 border border-sky-500/10 hover:border-sky-500/20 rounded-xl cursor-pointer transition-all">
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white">{item.label}</span>
                      <span className="text-[10px] text-sky-300/40 mt-0.5">{item.sub}</span>
                    </div>
                  </div>
                  <input type="checkbox" checked={item.val} onChange={e => item.set(e.target.checked)} className="w-4 h-4 rounded text-sky-500 bg-[#050d21] border-sky-500/30" />
                </label>
              ))}
            </div>

            <button
              onClick={handleTriggerSync}
              disabled={syncing || (!syncDepts && !syncRegs && !syncSubjects && !syncStudents)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-extrabold rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer uppercase tracking-wider font-['Outfit']"
            >
              {syncing ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /><span>Syncing ERP Assets... ({fmtTime(elapsedSecs)})</span></>
              ) : (
                <><Sparkles className="h-4 w-4" /><span>Trigger Synchronisation</span></>
              )}
            </button>
          </div>
        </div>

        {/* Right: Metrics + Console */}
        <div className="lg:col-span-7 space-y-6">

          {/* Completion Banner */}
          {syncDone === 'success' && (
            <div className="flex items-center gap-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl animate-fade-in">
              <div className="p-2.5 bg-emerald-500/20 rounded-xl shrink-0">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-emerald-300">Sync Completed Successfully</p>
                <p className="text-[11px] text-emerald-300/60 mt-0.5">All ERP data has been pulled and written to the database. GPA pages will reflect updated subjects immediately.</p>
              </div>
            </div>
          )}
          {syncDone === 'error' && (
            <div className="flex items-center gap-4 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl animate-fade-in">
              <div className="p-2.5 bg-red-500/20 rounded-xl shrink-0">
                <XCircle className="h-6 w-6 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-red-300">Sync Failed</p>
                <p className="text-[11px] text-red-300/60 mt-0.5">Check the console logs below for the error details. Verify the Bearer Token is valid and try again.</p>
              </div>
            </div>
          )}

          {/* Metrics Grid */}
          {syncResults && (
            <div className="bg-[#071830]/80 border border-sky-500/20 rounded-2xl p-5 backdrop-blur-xl shadow-lg space-y-4">
              <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 font-['Outfit']">
                <Sparkles className="h-4 w-4 text-emerald-400" /> Sync Results
              </h2>
              <div className="section-divider !my-1" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { show: syncDepts, label: 'Departments', color: 'sky', data: syncResults.departments, detail: `+${syncResults.departments.inserted} new · ${syncResults.departments.updated} updated` },
                  { show: syncRegs, label: 'Regulations', color: 'indigo', data: syncResults.regulations, detail: `+${syncResults.regulations.inserted} new · ${syncResults.regulations.skipped} skipped` },
                  { show: syncSubjects, label: 'Subjects', color: 'emerald', data: syncResults.subjects, detail: `+${syncResults.subjects.inserted} new · ${syncResults.subjects.skipped} preserved` },
                  { show: syncStudents, label: 'Students', color: 'amber', data: syncResults.students, detail: `+${syncResults.students.inserted} new · ${syncResults.students.fetched - syncResults.students.inserted} existing` },
                ].filter(m => m.show).map(m => (
                  <div key={m.label} className={`bg-[#050d21]/60 border border-${m.color}-500/15 rounded-xl p-3.5 text-center`}>
                    <div className={`text-[9px] font-bold text-${m.color}-300/40 uppercase tracking-wider`}>{m.label}</div>
                    <div className="text-2xl font-black text-white mt-1.5">{m.data.fetched}</div>
                    <div className={`text-[8px] font-semibold text-${m.color}-400/70 mt-1 leading-snug`}>{m.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Console */}
          <div className="bg-[#071830]/80 border border-sky-500/20 rounded-2xl p-5 backdrop-blur-xl shadow-lg flex flex-col" style={{ height: syncResults ? '280px' : '400px' }}>
            <div className="flex justify-between items-center pb-3 border-b border-sky-500/10 shrink-0">
              <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 font-['Outfit']">
                <Terminal className="h-4 w-4 text-sky-400" />
                Sync Console
                {syncing && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-500/10 border border-sky-500/20 rounded-full text-[10px] text-sky-400 font-semibold animate-pulse ml-1">● LIVE</span>}
                {syncDone === 'success' && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] text-emerald-400 font-semibold ml-1">✓ DONE</span>}
                {syncDone === 'error' && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded-full text-[10px] text-red-400 font-semibold ml-1">✗ FAILED</span>}
              </h2>
              <div className="flex items-center gap-1.5 text-[10px] text-sky-300/40 font-mono">
                <Clock className="h-3 w-3" />
                {syncing ? <span className="text-sky-400">{fmtTime(elapsedSecs)}</span> : <span>IST</span>}
              </div>
            </div>

            <div className="flex-1 min-h-0 bg-[#030a17] border border-sky-500/10 rounded-xl p-4 mt-4 overflow-y-auto font-mono text-[11px] space-y-1.5">
              {logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-sky-300/20 gap-2">
                  <Database className="h-7 w-7" />
                  <p>Console idle. Trigger sync to begin.</p>
                </div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className={`leading-relaxed flex gap-2 ${
                    log.type === 'success' ? 'text-emerald-400' :
                    log.type === 'error'   ? 'text-red-400' :
                    log.type === 'wait'    ? 'text-sky-400/60 italic' :
                    'text-sky-300/75'
                  }`}>
                    <span className="text-sky-300/20 select-none shrink-0 mt-0.5">
                      <ArrowRight className="h-3 w-3 inline" />
                    </span>
                    <span>{log.text}</span>
                    {log.type === 'wait' && syncing && (
                      <span className="animate-pulse text-sky-400/40">...</span>
                    )}
                  </div>
                ))
              )}
              <div ref={consoleEndRef} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
