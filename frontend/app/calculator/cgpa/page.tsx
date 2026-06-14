'use client';

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

import { 
  TrendingUp,
  Download,
  RefreshCw,
  Loader2,
  Plus,
  Trash2,
  ArrowLeft,
  Sparkles,
  GraduationCap
} from 'lucide-react';
import { api, Department } from '@/lib/api';

interface SemesterRow {
  id: string;
  semester: number;
  gpa: number;
}

export default function CgpaCalculator() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [regulation, setRegulation] = useState('');
  const [regulations, setRegulations] = useState<string[]>([]);
  const [rows, setRows] = useState<SemesterRow[]>([
    { id: '1', semester: 1, gpa: 0 },
    { id: '2', semester: 2, gpa: 0 }
  ]);

  const [loadingDepts, setLoadingDepts] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    const fetchDeptsAndRegs = async () => {
      try {
        const depts = await api.getPublicDepartments();
        setDepartments(depts);
        if (depts.length > 0) setSelectedDept(depts[0].code);

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
    fetchDeptsAndRegs();
  }, []);

  // Simple average CGPA (public student view — no credits input)
  let countedSems = 0, gpaSum = 0;
  rows.forEach(r => {
    const semGpa = parseFloat(String(r.gpa)) || 0;
    if (semGpa > 0) { countedSems++; gpaSum += semGpa; }
  });
  const cgpa = countedSems > 0 ? parseFloat((gpaSum / countedSems).toFixed(2)) : 0;



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
  };

  const downloadReport = async () => {
    setDownloadingPdf(true);
    try {
      const activeDeptObj = departments.find(d => d.code === selectedDept);
      const payload = {
        department: activeDeptObj ? activeDeptObj.name : selectedDept,
        regulation,
        semesters: rows.map(r => ({
          semester: Number(r.semester),
          gpa: parseFloat(String(r.gpa)) || 0
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
      alert('Failed to generate CGPA report.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const getCgpaLabel = (c: number) => {
    if (c >= 9) return { text: 'Outstanding 🏆', color: 'text-emerald-400' };
    if (c >= 8) return { text: 'Excellent ⭐', color: 'text-green-400' };
    if (c >= 7) return { text: 'Very Good 👍', color: 'text-teal-400' };
    if (c >= 6) return { text: 'Good', color: 'text-blue-400' };
    if (c >= 5) return { text: 'Average', color: 'text-amber-400' };
    if (c > 0)  return { text: 'Below Average', color: 'text-orange-400' };
    return { text: 'Enter semester GPAs', color: 'text-sky-300/35' };
  };
  const cgpaLabel = getCgpaLabel(cgpa);

  return (
    <div className="min-h-screen bg-[#040f24] text-white">
      {/* Background orbs */}
      <div className="orb orb-emerald w-[400px] h-[400px] top-20 left-1/2 -translate-x-1/2 opacity-40 fixed" />
      <div className="orb orb-indigo w-[250px] h-[250px] bottom-32 left-12 opacity-25 fixed" />

      <div className="max-w-4xl mx-auto px-4 pt-8 pb-16 sm:px-6 lg:px-8 relative z-10">

        {/* Back Link */}
        <div className="mb-6 animate-fade-in-down">
          <Link 
            to="/" 
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 hover:text-white bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/15 hover:border-emerald-500/35 px-3.5 py-2 rounded-xl transition-all duration-300 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Home</span>
          </Link>
        </div>

        {/* Title */}
        <div className="text-center mb-10 animate-fade-in-down">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold uppercase tracking-widest mb-5">
            <Sparkles className="h-3.5 w-3.5" />
            Cumulative CGPA Calculator
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight mb-3 font-['Outfit']">
            Track Your <span className="gradient-text-emerald">CGPA</span>
          </h1>
          <p className="text-sm text-sky-200/50 max-w-xl mx-auto leading-relaxed">
            Enter your semester-wise GPA scores to compute your cumulative academic performance. Download a PDF report.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Controls + Result ── */}
          <div className="space-y-5 animate-slide-left">
            <div className="glass-card rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white pb-2 border-b border-sky-500/10">Setup</h3>

              <div className="form-group">
                <label className="form-label">Regulation</label>
                <select
                  value={regulation}
                  onChange={e => setRegulation(e.target.value)}
                  className="w-full bg-[#071830] border border-sky-500/18 focus:border-sky-500/50 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none transition-all"
                >
                  {regulations.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Department</label>
                {loadingDepts ? (
                  <div className="h-9 skeleton rounded-xl" />
                ) : (
                  <select
                    value={selectedDept}
                    onChange={e => setSelectedDept(e.target.value)}
                    className="w-full bg-[#071830] border border-sky-500/18 focus:border-sky-500/50 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none transition-all"
                  >
                    {departments.map(d => (
                      <option key={d._id} value={d.code}>{d.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* CGPA Display */}
            <div className="cgpa-display text-center">
              <span className="text-[10px] font-bold text-emerald-300/50 uppercase tracking-widest block mb-2">Your CGPA</span>
              <div className="display-number text-6xl font-black mb-1 animate-pulse-glow">
                <span className="gradient-text-emerald">{cgpa.toFixed(2)}</span>
                <span className="text-xl text-sky-300/30 ml-1.5">/ 10</span>
              </div>
              <span className={`text-xs font-semibold ${cgpaLabel.color}`}>{cgpaLabel.text}</span>
              {countedSems > 0 && (
                <p className="text-[10px] text-sky-300/35 mt-2">
                  Averaged across <span className="text-white font-bold">{countedSems}</span> semesters
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <button
                onClick={downloadReport}
                disabled={downloadingPdf || countedSems === 0}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none text-sm cursor-pointer"
              >
                {downloadingPdf ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /><span>Generating...</span></>
                ) : (
                  <><Download className="h-4 w-4" /><span>Download PDF Report</span></>
                )}
              </button>
              <button
                onClick={resetCalculator}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-emerald-300 hover:text-white transition-all rounded-xl border border-emerald-500/30 hover:border-emerald-500/50 bg-emerald-500/5 hover:bg-emerald-500/12 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Reset Calculator
              </button>
            </div>
          </div>

          {/* ── Semester Rows ── */}
          <div className="lg:col-span-2 animate-slide-right">
            <div className="glass-card rounded-2xl p-5">
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-sky-500/10">
                <h3 className="text-sm font-bold text-white">Semester GPA Entry</h3>
                <span className="text-[10px] text-sky-300/35">{rows.length} / 8 semesters</span>
              </div>

              {/* Column headers */}
              <div className="grid grid-cols-12 gap-3 text-[10px] font-bold uppercase tracking-wider text-sky-300/35 px-3 pb-3 border-b border-sky-500/5 mb-3">
                <div className="col-span-4">Semester</div>
                <div className="col-span-6 text-center">GPA Score (0 – 10)</div>
                <div className="col-span-2 text-center">Del</div>
              </div>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {rows.map((row, idx) => {
                  const g = parseFloat(String(row.gpa)) || 0;
                  const inputColor = g >= 8.5 ? 'text-emerald-400' : g >= 7 ? 'text-teal-400' : g >= 5 ? 'text-amber-400' : 'text-sky-300/60';
                  return (
                    <div
                      key={row.id}
                      style={{animationDelay: `${idx * 40}ms`}}
                      className="grid grid-cols-12 gap-3 bg-[#0a052a]/50 border border-sky-500/[0.07] hover:border-emerald-500/12 p-3 rounded-xl items-center transition-all animate-fade-in-up"
                    >
                      <div className="col-span-4 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center text-[10px] font-black text-emerald-400">
                          {row.semester}
                        </div>
                        <span className="text-xs text-white/60 font-semibold font-medium">Semester {row.semester}</span>
                      </div>

                      <div className="col-span-6">
                        <input
                          type="number"
                          placeholder="e.g. 8.45"
                          value={row.gpa || ''}
                          min="0"
                          max="10"
                          step="0.01"
                          onChange={e => updateGpa(row.id, parseFloat(e.target.value) || 0)}
                          className={`w-full bg-[#071830] border border-sky-500/10 focus:border-emerald-500/40 rounded-xl px-3 py-2 text-center text-sm font-bold focus:outline-none transition-all ${inputColor}`}
                        />
                      </div>

                      <div className="col-span-2 flex justify-center">
                        <button
                          onClick={() => removeRow(row.id)}
                          disabled={rows.length <= 1}
                          className="p-1.5 bg-red-500/8 hover:bg-red-500/20 border border-red-500/15 hover:border-red-500/35 rounded-lg text-red-400 transition-all disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
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
                  className="w-full mt-3 py-2.5 bg-emerald-500/[0.06] hover:bg-emerald-500/10 text-emerald-300/60 hover:text-white rounded-xl text-xs font-semibold transition-all border border-emerald-500/10 hover:border-emerald-500/22 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> Add Semester
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
