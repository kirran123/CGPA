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
  GraduationCap
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
  
  // Action status
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
        if (user.role === 'super_admin') {
          setSelectedDept(depts.length > 0 ? depts[0].code : '');
        } else {
          setSelectedDept(user.department || '');
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sky-500/10">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2 font-['Outfit']">
            <Sliders className="h-5 w-5 text-sky-400" />
            Grade Settings Manager
          </h1>
          <p className="text-xs text-sky-300/50 mt-1">
            Configure grades and point weights per department, regulation, and semester.
          </p>
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
              className="bg-[#071830] border border-sky-500/15 focus:border-sky-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed w-full sm:min-w-[150px]"
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

      {/* Main Grid Content */}
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
                )}
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-sky-500/15 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
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
    </div>
  );
}
