'use client';

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sliders,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Building,
  GraduationCap,
  TrendingUp,
} from 'lucide-react';
import { api, Department } from '@/lib/api';

const DEFAULT_GRADES = [
  { grade: 'O', points: 10 },
  { grade: 'A+', points: 9 },
  { grade: 'A', points: 8 },
  { grade: 'B+', points: 7 },
  { grade: 'B', points: 6 },
  { grade: 'C', points: 5 },
  { grade: 'U', points: 0 }
];

export default function DashboardGradeSettings() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [regulations, setRegulations] = useState<string[]>([]);
  
  // Selection filters
  const [selectedDept, setSelectedDept] = useState('');
  const [regulation, setRegulation] = useState('');
  const [semester, setSemester] = useState(1);
  
  // Grade rows state
  const [grades, setGrades] = useState<{ grade: string; points: number }[]>(DEFAULT_GRADES);

  // Total Credits state
  const [semCredits, setSemCredits] = useState<{ semester: number; totalCredits: number }[]>(
    Array.from({ length: 8 }, (_, i) => ({ semester: i + 1, totalCredits: 0 }))
  );
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [savingCredits, setSavingCredits] = useState(false);
  const [creditsStatusMsg, setCreditsStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Active section tab
  const [activeTab, setActiveTab] = useState<'grades' | 'credits'>('grades');
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [saving, setSaving] = useState(false);
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
        console.error('Failed to initialize Grade Settings:', err);
        setRegulations(['R2021', 'R2023', 'R2017']);
        setRegulation('R2021');
      } finally {
        setLoadingInitial(false);
      }
    };
    init();
  }, [navigate]);

  // Load configured grades when department/regulation/semester is changed
  useEffect(() => {
    if (!selectedDept || !regulation || !semester) return;
    
    const loadGrades = async () => {
      setLoadingSettings(true);
      setStatusMsg(null);
      try {
        const gs = await api.getGradeSettings(selectedDept, regulation, semester);
        if (gs && gs.grades && gs.grades.length > 0) {
          setGrades(gs.grades);
        } else {
          setGrades(DEFAULT_GRADES);
        }
      } catch (err) {
        console.error('Failed to load grade settings:', err);
        setGrades(DEFAULT_GRADES);
      } finally {
        setLoadingSettings(false);
      }
    };
    loadGrades();
  }, [selectedDept, regulation, semester]);

  // Load total semester credits when selectedDept or regulation changes
  useEffect(() => {
    if (!selectedDept || !regulation) return;
    const loadCredits = async () => {
      setLoadingCredits(true);
      setCreditsStatusMsg(null);
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
    setCreditsStatusMsg(null);

    if (!selectedDept) {
      setCreditsStatusMsg({ type: 'error', text: 'Department selection required.' });
      return;
    }

    setSavingCredits(true);
    try {
      await api.saveSemesterCredits(selectedDept, regulation, semCredits);
      setCreditsStatusMsg({ type: 'success', text: `Total credits for ${selectedDept} (${regulation}) saved successfully!` });
      setTimeout(() => setCreditsStatusMsg(null), 4000);
    } catch (err: any) {
      setCreditsStatusMsg({ type: 'error', text: err.message || 'Failed to save total credits.' });
    } finally {
      setSavingCredits(false);
    }
  };

  const handleGradeChange = (index: number, val: string) => {
    const updated = [...grades];
    // Force capital letters and exclude spaces/punctuation
    updated[index].grade = val.toUpperCase().replace(/[^A-Z0-9+#-]/g, '');
    setGrades(updated);
  };

  const handlePointsChange = (index: number, val: string) => {
    const updated = [...grades];
    let num = parseFloat(val);
    if (isNaN(num)) {
      updated[index].points = 0;
    } else {
      updated[index].points = Math.min(100, Math.max(0, num));
    }
    setGrades(updated);
  };

  const addGradeRow = () => {
    setGrades([...grades, { grade: '', points: 0 }]);
  };

  const removeGradeRow = (index: number) => {
    const updated = grades.filter((_, idx) => idx !== index);
    setGrades(updated);
  };

  const resetToDefault = () => {
    if (window.confirm('Are you sure you want to reset the rows to the default grade settings? (You will still need to click Save to apply changes)')) {
      setGrades(JSON.parse(JSON.stringify(DEFAULT_GRADES)));
    }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    // Validations
    if (!selectedDept) {
      setStatusMsg({ type: 'error', text: 'Department filter must be selected.' });
      return;
    }

    if (grades.length === 0) {
      setStatusMsg({ type: 'error', text: 'Please define at least one grade row.' });
      return;
    }

    const uniqueGrades = new Set<string>();
    for (let i = 0; i < grades.length; i++) {
      const g = grades[i].grade.trim();
      if (!g) {
        setStatusMsg({ type: 'error', text: `Grade name in row ${i + 1} cannot be empty.` });
        return;
      }
      if (uniqueGrades.has(g)) {
        setStatusMsg({ type: 'error', text: `Duplicate grade '${g}' found. Grades must be unique.` });
        return;
      }
      uniqueGrades.add(g);
    }

    setSaving(true);
    try {
      await api.saveGradeSettings(selectedDept, regulation, semester, grades);
      setStatusMsg({ type: 'success', text: 'Grade system configuration saved successfully.' });
      setTimeout(() => setStatusMsg(null), 4000);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to save grade system settings.' });
    } finally {
      setSaving(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="h-80 flex flex-col items-center justify-center text-sky-300 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
        <p className="text-sm text-sky-300/50">Loading configurations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Header & Tab Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sky-500/10">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2 font-['Outfit']">
            <Sliders className="h-5 w-5 text-sky-400" />
            Grade & Total Credits Manager
          </h1>
          <p className="text-xs text-sky-300/50 mt-1">
            Configure grade point weights and total registered semester credits for accurate CGPA calculations.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2 bg-[#071830] p-1.5 rounded-2xl border border-sky-500/15 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('grades')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all duration-200 cursor-pointer ${
              activeTab === 'grades'
                ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                : 'text-sky-300/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sliders className="h-4 w-4" />
            Grade Settings
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('credits')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all duration-200 cursor-pointer ${
              activeTab === 'credits'
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                : 'text-sky-300/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            Total Credits
          </button>
        </div>
      </div>

      {/* Filter Selection Panel */}
      <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4 bg-white/[0.02] border border-sky-500/10 p-4 rounded-2xl backdrop-blur-xl">
        <div className="flex items-center gap-2 text-xs font-semibold text-sky-300/60 uppercase tracking-wider">
          <Building className="h-4 w-4" />
          <span>Select Scope:</span>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
          {/* Department Selection */}
          <div className="flex flex-col gap-1 w-full sm:w-auto">
            <span className="text-[10px] text-sky-300/40 uppercase font-semibold">Department</span>
            <select
              value={selectedDept}
              disabled={currentUser?.role !== 'super_admin'}
              onChange={e => setSelectedDept(e.target.value)}
              className="bg-[#071830] border border-sky-500/15 focus:border-sky-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed w-full sm:min-w-[150px] truncate"
            >
              {departments.map(d => (
                <option key={d._id} value={d.code}>{d.name} ({d.code})</option>
              ))}
            </select>
          </div>

          {/* Regulation */}
          <div className="flex flex-col gap-1 w-full sm:w-auto">
            <span className="text-[10px] text-sky-300/40 uppercase font-semibold">Regulation</span>
            <select
              value={regulation}
              onChange={e => setRegulation(e.target.value)}
              className="bg-[#071830] border border-sky-500/15 focus:border-sky-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none w-full sm:w-auto"
            >
              {regulations.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Semester */}
          <div className="flex flex-col gap-1 w-full sm:w-auto">
            <span className="text-[10px] text-sky-300/40 uppercase font-semibold">Semester</span>
            <select
              value={semester}
              onChange={e => setSemester(Number(e.target.value))}
              className="bg-[#071830] border border-sky-500/15 focus:border-sky-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none w-full sm:w-auto"
            >
              {[...Array(8)].map((_, i) => <option key={i+1} value={i+1}>Semester {i+1}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {statusMsg && (
        <div className={`p-4 rounded-2xl flex items-start gap-3 border transition-all duration-300 ${
          statusMsg.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300' 
            : 'bg-red-500/10 border-red-500/25 text-red-300'
        }`}>
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
          )}
          <div className="text-xs font-medium">{statusMsg.text}</div>
        </div>
      )}

      {/* Main Grid Content — Render based on activeTab */}
      {activeTab === 'credits' ? (
        /* ── Total Credits Section ── */
        <div className="bg-white/[0.02] border border-sky-500/10 rounded-2xl p-6 relative overflow-hidden backdrop-blur-xl space-y-6">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sky-500/10">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2 font-['Outfit']">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
                Total Credits
              </h2>
              <p className="text-xs text-sky-300/50 mt-1">
                Set authoritative semester total credit values for <span className="text-emerald-300 font-semibold">{selectedDept}</span> under regulation <span className="text-emerald-300 font-semibold">{regulation}</span> for system-wide CGPA calculations.
              </p>
            </div>

            <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-bold flex items-center gap-2 self-start sm:self-auto">
              <span>Total Degree Credits:</span>
              <span className="text-white text-sm font-black">
                {semCredits.reduce((acc, curr) => acc + (curr.totalCredits || 0), 0)}
              </span>
            </div>
          </div>

          {/* Status Toast */}
          {creditsStatusMsg && (
            <div className={`p-4 rounded-2xl flex items-start gap-3 border transition-all duration-300 ${
              creditsStatusMsg.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300' 
                : 'bg-red-500/10 border-red-500/25 text-red-300'
            }`}>
              {creditsStatusMsg.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
              )}
              <div className="text-xs font-medium">{creditsStatusMsg.text}</div>
            </div>
          )}

          {loadingCredits ? (
            <div className="h-40 flex flex-col items-center justify-center text-sky-300 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
              <p className="text-xs text-sky-300/50">Fetching total semester credits...</p>
            </div>
          ) : (
            <form onSubmit={saveTotalCredits} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {semCredits.map((item, idx) => (
                  <div
                    key={item.semester}
                    className="bg-[#071830]/50 border border-sky-500/10 hover:border-emerald-500/25 p-3.5 rounded-xl flex flex-col gap-2 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Semester {item.semester}</span>
                      <span className="text-[10px] text-emerald-400/70 font-mono">Sem {item.semester}</span>
                    </div>

                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        placeholder="e.g. 24"
                        value={item.totalCredits || ''}
                        onChange={(e) => handleSemesterCreditChange(idx, parseFloat(e.target.value) || 0)}
                        className="w-full bg-[#071830] border border-sky-500/15 focus:border-emerald-500/40 rounded-lg px-3 py-2 text-sm font-bold text-emerald-300 text-center focus:outline-none transition-all placeholder:text-sky-300/20"
                      />
                      <span className="absolute right-2.5 top-2.5 text-[10px] text-sky-300/30 font-semibold pointer-events-none">
                        credits
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-2">
                <p className="text-[11px] text-sky-300/40">
                  * Configured semester total credits override subject sum values for all CGPA calculations.
                </p>

                <button
                  type="submit"
                  disabled={savingCredits}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-500/15 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
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
      ) : (
        /* ── Grade Settings Section ── */
        <div className="bg-white/[0.02] border border-sky-500/10 rounded-2xl p-6 relative overflow-hidden backdrop-blur-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />
          
          {loadingSettings ? (
            <div className="h-60 flex flex-col items-center justify-center text-sky-300 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-sky-400" />
              <p className="text-xs text-sky-300/50">Fetching configured grade settings...</p>
            </div>
          ) : (
            <form onSubmit={saveSettings} className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 flex-wrap">
                  <GraduationCap className="h-4 w-4 text-sky-400" />
                  Grade Mapping for {selectedDept} — {regulation} — Semester {semester}
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={resetToDefault}
                    className="px-3 py-1.5 rounded-xl border border-sky-500/15 hover:border-sky-500/30 text-[11px] text-sky-300 hover:text-white flex items-center gap-1.5 transition-all duration-200"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset to Default
                  </button>
                  <button
                    type="button"
                    onClick={addGradeRow}
                    className="px-3 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 hover:text-white border border-sky-500/20 text-[11px] flex items-center gap-1.5 transition-all duration-200"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Grade
                  </button>
                </div>
              </div>

              {/* Config Table */}
              <div className="border border-sky-500/10 rounded-xl overflow-hidden bg-[#071830]/30">
                <div className="grid grid-cols-12 bg-[#071830]/80 p-3 text-xs font-semibold text-sky-300/60 uppercase border-b border-sky-500/10">
                  <div className="col-span-1 text-center">#</div>
                  <div className="col-span-5">Grade Key</div>
                  <div className="col-span-5">Point Value (0-100)</div>
                  <div className="col-span-1 text-center">Action</div>
                </div>

                <div className="divide-y divide-sky-500/5 max-h-[350px] overflow-y-auto custom-scrollbar">
                  {grades.map((g, idx) => (
                    <div key={idx} className="grid grid-cols-12 p-3 items-center gap-2 hover:bg-white/[0.01] transition-colors">
                      <div className="col-span-1 text-center text-xs text-sky-300/40 font-mono">
                        {idx + 1}
                      </div>
                      
                      {/* Grade input */}
                      <div className="col-span-5">
                        <input
                          type="text"
                          required
                          placeholder="e.g. A+"
                          value={g.grade}
                          onChange={e => handleGradeChange(idx, e.target.value)}
                          className="w-full bg-[#071830] border border-sky-500/15 focus:border-sky-500/40 rounded-lg px-3 py-1.5 text-xs text-white uppercase focus:outline-none transition-all placeholder:text-sky-300/20"
                        />
                      </div>

                      {/* Point input */}
                      <div className="col-span-5">
                        <input
                          type="number"
                          required
                          step="0.01"
                          min="0"
                          max="100"
                          placeholder="e.g. 9"
                          value={g.points || 0}
                          onChange={e => handlePointsChange(idx, e.target.value)}
                          className="w-full bg-[#071830] border border-sky-500/15 focus:border-sky-500/40 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none transition-all placeholder:text-sky-300/20"
                        />
                      </div>

                      {/* Delete Action */}
                      <div className="col-span-1 flex justify-center">
                        <button
                          type="button"
                          onClick={() => removeGradeRow(idx)}
                          className="p-1.5 rounded-lg text-sky-300/40 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                          title="Delete Grade"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {grades.length === 0 && (
                    <div className="p-8 text-center text-xs text-sky-300/35">
                      No grades defined. Click "Add Grade" to configure mapping.
                    </div>
                          step="0.5"
                          placeholder="Points (e.g. 10)"
                          value={g.points}
                          onChange={(e) => handlePointsChange(idx, e.target.value)}
                          className="w-full bg-[#030a1a] border border-sky-500/25 focus:border-sky-500/60 focus:ring-2 focus:ring-sky-500/20 rounded-xl px-3 py-2 text-xs font-black text-sky-300 focus:outline-none placeholder:text-sky-300/30 transition-all shadow-inner"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeGradeRow(idx)}
                      disabled={grades.length <= 1}
                      className="p-2 rounded-xl text-sky-300/40 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-sky-300/40 transition-all cursor-pointer"
                      title="Remove grade row"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-sky-500/10">
                <button
                  type="button"
                  onClick={addGradeRow}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/25 text-sky-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  Add Grade Row
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving System...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Grade System
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Always render Total Credits below Grade Settings if activeTab === 'grades' */}
      {activeTab === 'grades' && (
        <div className="bg-[#071830]/80 border border-sky-500/20 rounded-2xl p-5 sm:p-6 relative overflow-hidden backdrop-blur-xl space-y-6 shadow-xl">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sky-500/10">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2 font-['Outfit']">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
                Total Credits
              </h2>
              <p className="text-xs text-sky-300/70 mt-1 font-medium">
                Set authoritative semester total credit values for <span className="text-emerald-300 font-bold">{selectedDept}</span> under regulation <span className="text-emerald-300 font-bold">{regulation}</span> for system-wide CGPA calculations.
              </p>
            </div>

            <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2.5 self-start sm:self-auto backdrop-blur-md">
              <span>Total Degree Credits:</span>
              <span className="text-white text-sm font-black font-mono bg-emerald-500/20 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                {semCredits.reduce((acc, curr) => acc + (curr.totalCredits || 0), 0)}
              </span>
            </div>
          </div>

          {/* Status Toast */}
          {creditsStatusMsg && (
            <div className={`p-4 rounded-2xl flex items-start gap-3 border transition-all duration-300 shadow-md ${
              creditsStatusMsg.type === 'success' 
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' 
                : 'bg-red-500/15 border-red-500/30 text-red-300'
            }`}>
              {creditsStatusMsg.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
              )}
              <div className="text-xs font-bold">{creditsStatusMsg.text}</div>
            </div>
          )}

          {loadingCredits ? (
            <div className="h-40 flex flex-col items-center justify-center text-sky-300 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
              <p className="text-xs text-sky-300/70 font-semibold">Fetching total semester credits...</p>
            </div>
          ) : (
            <form onSubmit={saveTotalCredits} className="space-y-6">
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
                  * Configured semester total credits override subject sum values for all CGPA calculations.
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
      )}
    </div>
  );
}
