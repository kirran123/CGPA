'use client';

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Building,
  GraduationCap,
} from 'lucide-react';
import { api, Department } from '@/lib/api';

export default function DashboardTotalCredits() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [regulations, setRegulations] = useState<string[]>([]);

  // Selection filters
  const [selectedDept, setSelectedDept] = useState('');
  const [regulation, setRegulation] = useState('');

  // Total Credits state for Semesters 1-8
  const [semCredits, setSemCredits] = useState<{ semester: number; totalCredits: number }[]>(
    Array.from({ length: 8 }, (_, i) => ({ semester: i + 1, totalCredits: 0 }))
  );

  // Status & loading flags
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [savingCredits, setSavingCredits] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Authenticate user & load departments/regulations
  useEffect(() => {
    const init = async () => {
      try {
        const user = api.getCurrentUser();
        if (!user) {
          navigate('/login');
          return;
        }
        setCurrentUser(user);

        // Fetch departments
        const depts = await api.getPublicDepartments();
        setDepartments(depts);

        // Initialize department selection
        if (user.role === 'super_admin' || !user.department) {
          setSelectedDept(depts.length > 0 ? depts[0].code : '');
        } else {
          setSelectedDept(user.department.toUpperCase());
        }

        // Fetch regulations
        const regs = await api.getRegulations();
        const regNames = regs.map((r: any) => r.name);
        setRegulations(regNames);
        if (regNames.length > 0) {
          setRegulation(regNames.includes('R2021') ? 'R2021' : regNames[0]);
        } else {
          setRegulation('R2021');
        }
      } catch (err) {
        console.error('Failed to initialize Total Credits page:', err);
        setRegulations(['R2021', 'R2023', 'R2017']);
        setRegulation('R2021');
      } finally {
        setLoadingInitial(false);
      }
    };
    init();
  }, [navigate]);

  // Load total semester credits when selectedDept or regulation changes
  useEffect(() => {
    if (!selectedDept || !regulation) return;
    const loadCredits = async () => {
      setLoadingCredits(true);
      setStatusMsg(null);
      try {
        const map = await api.getSemesterCreditsMap(selectedDept, regulation);
        const list = Array.from({ length: 8 }, (_, i) => ({
          semester: i + 1,
          totalCredits: map[i + 1] || 0,
        }));
        setSemCredits(list);
      } catch (err) {
        console.error('Failed to load total credits:', err);
      } finally {
        setLoadingCredits(false);
      }
    };
    loadCredits();
  }, [selectedDept, regulation]);

  const handleSemesterCreditChange = (index: number, val: number) => {
    const updated = [...semCredits];
    updated[index].totalCredits = Math.max(0, val);
    setSemCredits(updated);
  };

  const saveTotalCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    if (!selectedDept) {
      setStatusMsg({ type: 'error', text: 'Department selection required.' });
      return;
    }

    setSavingCredits(true);
    try {
      await api.saveSemesterCredits(selectedDept, regulation, semCredits);
      setStatusMsg({ type: 'success', text: `Total credits for ${selectedDept} (${regulation}) updated successfully!` });
      setTimeout(() => setStatusMsg(null), 4000);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to save total credits.' });
    } finally {
      setSavingCredits(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="h-80 flex flex-col items-center justify-center text-sky-300 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
        <p className="text-sm text-sky-300/50">Loading configurations...</p>
      </div>
    );
  }

  const totalDegreeCredits = semCredits.reduce((acc, curr) => acc + (curr.totalCredits || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sky-500/15">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5 font-['Outfit'] tracking-tight">
            <TrendingUp className="h-6 w-6 text-emerald-400 shrink-0" />
            Total Credits Manager
          </h1>
          <p className="text-xs sm:text-sm text-sky-300/70 mt-1 font-medium">
            Define official total registered credit points for each semester per department and regulation for CGPA calculations.
          </p>
        </div>

        <div className="px-4 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2.5 self-start sm:self-auto shadow-sm backdrop-blur-md">
          <span className="opacity-90">Total Degree Credits:</span>
          <span className="text-white text-base font-black font-mono bg-emerald-500/20 px-2.5 py-0.5 rounded-lg border border-emerald-500/30">{totalDegreeCredits}</span>
        </div>
      </div>

      {/* Filter Selection Panel */}
      <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-4 bg-[#071830]/80 border border-sky-500/20 p-4 sm:p-5 rounded-2xl backdrop-blur-xl shadow-lg">
        <div className="flex items-center gap-2 text-xs font-bold text-sky-300/80 uppercase tracking-wider">
          <Building className="h-4 w-4 text-sky-400" />
          <span>Select Curriculum:</span>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 sm:gap-5 w-full sm:w-auto">
          {/* Department Selection */}
          <div className="flex flex-col gap-1 w-full sm:w-auto">
            <span className="text-[10px] text-sky-300/60 uppercase font-bold tracking-wider">Department</span>
            <select
              value={selectedDept}
              disabled={currentUser?.role !== 'super_admin'}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-[#050d21] border border-sky-500/25 focus:border-emerald-500/50 rounded-xl px-3.5 py-2 text-xs font-bold text-white focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed w-full sm:min-w-[200px] truncate shadow-inner transition-all"
            >
              {departments.map((d) => (
                <option key={d._id} value={d.code}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          {/* Regulation */}
          <div className="flex flex-col gap-1 w-full sm:w-auto">
            <span className="text-[10px] text-sky-300/60 uppercase font-bold tracking-wider">Regulation</span>
            <select
              value={regulation}
              onChange={(e) => setRegulation(e.target.value)}
              className="bg-[#050d21] border border-sky-500/25 focus:border-emerald-500/50 rounded-xl px-3.5 py-2 text-xs font-bold text-white focus:outline-none w-full sm:w-auto shadow-inner transition-all"
            >
              {regulations.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
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

      {/* Main Grid Content */}
      <div className="bg-[#071830]/80 border border-sky-500/20 rounded-2xl p-5 sm:p-6 relative overflow-hidden backdrop-blur-xl space-y-6 shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {loadingCredits ? (
          <div className="h-48 flex flex-col items-center justify-center text-sky-300 gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
            <p className="text-xs text-sky-300/70 font-semibold">Fetching configured semester credits...</p>
          </div>
        ) : (
          <form onSubmit={saveTotalCredits} className="space-y-6">
            <div className="flex items-center justify-between border-b border-sky-500/10 pb-3">
              <h2 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 font-['Outfit']">
                <GraduationCap className="h-4 w-4 text-emerald-400" />
                Semester Credit Allocation ({selectedDept} — {regulation})
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {semCredits.map((item, idx) => (
                <div
                  key={item.semester}
                  className="bg-[#050d21]/90 border border-sky-500/20 hover:border-emerald-500/40 p-4 rounded-2xl flex flex-col gap-3 transition-all duration-200 shadow-md hover:shadow-emerald-500/5 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-white group-hover:text-emerald-300 transition-colors">Semester {item.semester}</span>
                    <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Sem {item.semester}</span>
                  </div>

                  <div className="relative flex items-center">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      placeholder="e.g. 24"
                      value={item.totalCredits || ''}
                      onChange={(e) => handleSemesterCreditChange(idx, parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#030a1a] border border-sky-500/25 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 rounded-xl pl-3.5 pr-14 py-2.5 text-sm font-black text-emerald-300 focus:outline-none transition-all placeholder:text-sky-300/30 shadow-inner"
                    />
                    <span className="absolute right-3 text-[10px] text-emerald-400/60 font-bold uppercase tracking-wider pointer-events-none">
                      credits
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-3 border-t border-sky-500/10">
              <p className="text-[11px] text-sky-300/60 font-medium">
                * Note: Configured semester total credits override subject sum values for all CGPA calculations.
              </p>

              <button
                type="submit"
                disabled={savingCredits}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
              >
                {savingCredits ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving Total Credits...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Total Credits
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
