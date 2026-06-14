'use client';

import React, { useState, useEffect } from 'react';

import { 
  TrendingUp,
  FileText, 
  Loader2, 
  Save, 
  CheckCircle,
  RefreshCw,
  Plus,
  Trash2,
  Info,
  Download
} from 'lucide-react';
import { api, Department } from '@/lib/api';
import { canEditRecords as canEditRecordsFn } from '@/lib/permissions';

interface SemesterRow {
  id: string;
  semester: number;
  gpa: number;
}

export default function InternalCgpaCalculator() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [studentName, setStudentName] = useState('');
  const [registerNo, setRegisterNo] = useState('');
  const [regulation, setRegulation] = useState('');
  const [regulations, setRegulations] = useState<string[]>([]);
  
  const [rows, setRows] = useState<SemesterRow[]>([
    { id: '1', semester: 1, gpa: 0 },
    { id: '2', semester: 2, gpa: 0 }
  ]);

  const [loadingDepts, setLoadingDepts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const canEditRecords = canEditRecordsFn();

  const downloadReport = async () => {
    setDownloadingPdf(true);
    try {
      const activeDeptObj = departments.find(d => d.code === selectedDept);
      const payload = {
        studentName: studentName.trim() || 'Student',
        registerNo: registerNo.trim() || 'Student',
        department: activeDeptObj ? activeDeptObj.name : selectedDept,
        regulation,
        semesters: rows.map(r => ({
          semester: Number(r.semester),
          gpa: parseFloat(String(r.gpa)) || 0,
          credits: 0
        }))
      };
      const blob = await api.downloadPublicCgpaPdf(payload);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `CGPA_Report_${selectedDept}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      console.error(err);
      alert('Failed to generate report PDF.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const u = api.getCurrentUser();
        setCurrentUser(u);
        
        const depts = await api.getPublicDepartments();
        setDepartments(depts);
        if (u?.department) {
          setSelectedDept(u.department);
        } else if (depts.length > 0) {
          setSelectedDept(depts[0].code);
        }

        // Fetch dynamic regulations
        const regs = await api.getRegulations();
        const regNames = regs.map((r: any) => r.name);
        setRegulations(regNames);
        if (regNames.length > 0) {
          if (regNames.includes('R2021')) {
            setRegulation('R2021');
          } else {
            setRegulation(regNames[0]);
          }
        }
      } catch (err) {
        console.error('Error fetching initial configuration:', err);
      } finally {
        setLoadingDepts(false);
      }
    };
    init();
  }, []);

  // Compute CGPA (simple average)
  let filledRows = 0, gpaSum = 0;
  rows.forEach(r => {
    const semGpa = parseFloat(String(r.gpa)) || 0;
    if (semGpa > 0) {
      gpaSum += semGpa;
      filledRows++;
    }
  });
  const cgpa = filledRows > 0 ? parseFloat((gpaSum / filledRows).toFixed(2)) : 0;

  const addRow = () => {
    const nextSem = rows.length + 1;
    if (nextSem > 8) return;
    setRows([...rows, { id: String(nextSem), semester: nextSem, gpa: 0 }]);
  };

  const removeRow = (id: string) => {
    if (rows.length === 1) return;
    const updated = rows.filter(r => r.id !== id).map((r, idx) => ({ ...r, semester: idx + 1, id: String(idx + 1) }));
    setRows(updated);
  };

  const updateGpa = (id: string, gpa: number) => {
    setRows(rows.map(r => r.id === id ? { ...r, gpa } : r));
  };

  const resetCalculator = () => {
    setRows([
      { id: '1', semester: 1, gpa: 0 },
      { id: '2', semester: 2, gpa: 0 }
    ]);
    setStudentName('');
    setRegisterNo('');
    setSaveSuccess(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(null);
    const nameToSave = studentName.trim() || 'Student';
    const regToSave = registerNo.trim() || 'Student';

    const payload = {
      studentName: nameToSave,
      registerNo: regToSave,
      department: selectedDept,
      regulation,
      semesters: rows.map(r => ({
        semester: Number(r.semester),
        gpa: parseFloat(String(r.gpa)) || 0,
        credits: 0
      }))
    };

    try {
      await api.calculateCgpa(payload);
      setSaveSuccess(`CGPA record computed & saved — ${nameToSave} (${regToSave}) — CGPA: ${cgpa.toFixed(2)}`);
    } catch (err: any) {
      alert(err.message || 'Failed to calculate & save CGPA record.');
    } finally {
      setSaving(false);
    }
  };

  const getCgpaLabel = (c: number) => {
    if (c >= 9) return { text: 'Outstanding 🏆', color: 'text-emerald-400' };
    if (c >= 8) return { text: 'Excellent ⭐', color: 'text-green-400' };
    if (c >= 7) return { text: 'Very Good 👍', color: 'text-teal-400' };
    if (c >= 6) return { text: 'Good', color: 'text-blue-400' };
    if (c >= 5) return { text: 'Average', color: 'text-amber-400' };
    if (c > 0)  return { text: 'Below Average', color: 'text-orange-400' };
    return { text: 'Enter semester GPAs', color: 'text-sky-300/40' };
  };
  const cgpaLabel = getCgpaLabel(cgpa);

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sky-500/10 animate-fade-in-down">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2 font-['Outfit']">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
            CGPA Calculation
          </h1>
          <p className="text-xs text-sky-300/50 mt-1">
            Compute cumulative performance using simple GPA average (credit weights not required)
          </p>
        </div>
        <button 
          onClick={resetCalculator} 
          className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300 hover:text-white transition-all px-3 py-1.5 rounded-lg border border-emerald-500/20 hover:border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reset
        </button>
      </div>

      {saveSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-2xl text-xs flex items-center gap-2 animate-scale-in">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left: Setup Panel ── */}
        <div className="space-y-5 animate-slide-left">
          <div className="bg-white/[0.02] border border-sky-500/10 rounded-2xl p-5 backdrop-blur-xl space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-sky-500/10">
              <FileText className="h-4 w-4 text-emerald-400" />
              Academic Profile
            </h2>

            {/* Regulation */}
            <div className="form-group">
              <label className="form-label">Regulation</label>
              <select
                value={regulation}
                onChange={e => setRegulation(e.target.value)}
                className="w-full bg-[#071830] border border-sky-500/18 focus:border-sky-500/50 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500/15 transition-all"
              >
                {regulations.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {/* Department */}
            <div className="form-group">
              <label className="form-label">Department</label>
              {loadingDepts ? (
                <div className="h-9 skeleton rounded-xl" />
              ) : (
                <select
                  value={selectedDept}
                  disabled={currentUser?.role === 'dept_admin' || currentUser?.role === 'staff'}
                  onChange={e => setSelectedDept(e.target.value)}
                  className="w-full bg-[#071830] border border-sky-500/18 focus:border-sky-500/50 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500/15 transition-all disabled:opacity-50"
                >
                  {departments
                    .filter(d => currentUser?.role === 'super_admin' || d.code === currentUser?.department)
                    .map(d => (
                      <option key={d._id} value={d.code}>{d.name}</option>
                    ))}
                </select>
              )}
            </div>

            <div className="section-divider !my-2" />

            {/* Optional Student Info */}
            <div className="bg-sky-500/[0.04] border border-sky-500/10 rounded-xl p-3 space-y-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Info className="h-3 w-3 text-sky-400/60" />
                <span className="text-[10px] text-sky-300/50">Optional — leave blank to auto-assign (Student1, Student2…)</span>
              </div>
              <div className="form-group">
                <label className="form-label">Student Name</label>
                <input
                  type="text"
                  value={studentName}
                  onChange={e => setStudentName(e.target.value)}
                  placeholder="e.g. Name"
                  className="w-full bg-[#071830] border border-sky-500/15 focus:border-sky-500/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none placeholder:text-sky-400/25 transition-all"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Register No.</label>
                <input
                  type="text"
                  value={registerNo}
                  onChange={e => setRegisterNo(e.target.value)}
                  placeholder="e.g. 953621104012"
                  className="w-full bg-[#071830] border border-sky-500/15 focus:border-sky-500/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none placeholder:text-sky-400/25 transition-all"
                />
              </div>
            </div>
          </div>

          {/* CGPA Result */}
          <div className="cgpa-display animate-pulse-glow">
            <div className="text-center">
              <span className="text-[10px] font-bold text-emerald-300/50 uppercase tracking-widest block mb-2">Cumulative CGPA</span>
              <div className="display-number text-5xl font-black text-white mb-1">
                <span className="gradient-text-emerald">{cgpa.toFixed(2)}</span>
                <span className="text-lg text-sky-300/40 ml-1">/ 10</span>
              </div>
            </div>
          </div>

          {/* Save & Download Buttons */}
          <div className="space-y-2">
            <button
              onClick={downloadReport}
              disabled={downloadingPdf || filledRows === 0}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all hover:-translate-y-0.5 hover:shadow-emerald-500/35 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm cursor-pointer"
            >
              {downloadingPdf ? (
                <><Loader2 className="h-4 w-4 animate-spin" /><span>Generating PDF...</span></>
              ) : (
                <><Download className="h-4 w-4" /><span>Download PDF Report</span></>
              )}
            </button>

            {canEditRecords && (
              <button
                onClick={handleSave}
                disabled={saving || filledRows === 0}
                className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-300 hover:text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs cursor-pointer"
              >
                {saving ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /><span>Saving...</span></>
                ) : (
                  <><Save className="h-3.5 w-3.5" /><span>Calculate &amp; Save (Database)</span></>
                )}
              </button>
            )}
          </div>
        </div>

        {/* ── Right: Semesters Table ── */}
        <div className="lg:col-span-2 animate-slide-right">
          <div className="bg-white/[0.02] border border-sky-500/10 rounded-2xl p-5 backdrop-blur-xl">
            <h2 className="text-sm font-bold text-white mb-5 pb-3 border-b border-sky-500/10 flex items-center justify-between">
              <span>Semester Breakdown</span>
              <span className="text-[10px] text-sky-300/40 font-normal">{rows.length} / 8 semesters</span>
            </h2>

            {/* Column Headers */}
            <div className="grid grid-cols-12 gap-3 text-[10px] font-bold uppercase tracking-wider text-sky-300/40 px-3 pb-3 border-b border-sky-500/5 mb-3">
              <div className="col-span-4">Semester</div>
              <div className="col-span-6 text-center">GPA (0 – 10)</div>
              <div className="col-span-2 text-center">Remove</div>
            </div>

            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {rows.map((row, idx) => {
                const semGpa = parseFloat(String(row.gpa)) || 0;
                const gpaColor = semGpa >= 8.5 ? 'text-emerald-400' : semGpa >= 7 ? 'text-teal-400' : semGpa >= 5 ? 'text-amber-400' : 'text-sky-300/60';
                return (
                  <div
                    key={row.id}
                    style={{animationDelay: `${idx * 40}ms`}}
                    className="grid grid-cols-12 gap-3 bg-[#0a052a]/50 border border-sky-500/[0.07] hover:border-sky-500/15 p-3 rounded-xl items-center transition-all animate-fade-in-up"
                  >
                    <div className="col-span-4 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-sky-500/10 border border-sky-500/15 flex items-center justify-center text-[10px] font-black text-sky-400">
                        {row.semester}
                      </div>
                      <span className="text-xs font-semibold text-white/80">Semester {row.semester}</span>
                    </div>

                    <div className="col-span-6">
                      <input
                        type="number"
                        placeholder="0.00"
                        value={row.gpa || ''}
                        min="0"
                        max="10"
                        step="0.01"
                        onChange={e => updateGpa(row.id, parseFloat(e.target.value) || 0)}
                        className={`w-full bg-[#071830] border border-sky-500/10 focus:border-sky-500/40 rounded-xl px-3 py-2 text-center text-xs font-bold focus:outline-none transition-all ${gpaColor}`}
                      />
                    </div>

                    <div className="col-span-2 flex justify-center">
                      <button
                        onClick={() => removeRow(row.id)}
                        disabled={rows.length <= 1}
                        className="p-2 bg-red-500/8 hover:bg-red-500/20 border border-red-500/15 hover:border-red-500/35 rounded-xl text-red-400 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {rows.length < 8 && (
              <button
                onClick={addRow}
                className="w-full mt-3 py-2.5 bg-sky-500/[0.06] hover:bg-sky-500/10 text-sky-300/70 hover:text-white rounded-xl text-xs font-semibold transition-all border border-sky-500/12 hover:border-sky-500/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Add Semester
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
