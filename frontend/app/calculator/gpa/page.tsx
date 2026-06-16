'use client';

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

import { 
  GraduationCap,
  Download,
  RefreshCw,
  Loader2,
  ArrowLeft,
  Sparkles
} from 'lucide-react';
import { api, Department } from '@/lib/api';

interface SubjectRow {
  id: string;
  subjectCode: string;
  subjectName: string;
  credits: number;
  grade: string;
}

const DEFAULT_GRADES = [
  { grade: 'O', points: 10 },
  { grade: 'A+', points: 9 },
  { grade: 'A', points: 8 },
  { grade: 'B+', points: 7 },
  { grade: 'B', points: 6 },
  { grade: 'C', points: 5 },
  { grade: 'U', points: 0 }
];

const getGradeColor = (grade: string) => {
  const c: { [key: string]: string } = {
    'O': 'text-emerald-400', 'A+': 'text-green-400', 'A': 'text-teal-400',
    'B+': 'text-blue-400', 'B': 'text-sky-400', 'C': 'text-amber-400',
    'U': 'text-red-400', 'RA': 'text-rose-400'
  };
  return c[grade.toUpperCase()] || 'text-indigo-400';
};

export default function GpaCalculator() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedSem, setSelectedSem] = useState(1);
  const [regulation, setRegulation] = useState('');
  const [regulations, setRegulations] = useState<string[]>([]);
  const [rows, setRows] = useState<SubjectRow[]>([]);
  const [gradeSettingsList, setGradeSettingsList] = useState<{ grade: string; points: number }[]>(DEFAULT_GRADES);

  const [loadingDepts, setLoadingDepts] = useState(true);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
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

  useEffect(() => {
    if (!selectedDept || !regulation) return;
    const fetchSubjects = async () => {
      setLoadingSubjects(true);
      try {
        const subjects = await api.getPublicSubjects(selectedDept, selectedSem, regulation);
        if (subjects.length > 0) {
          setRows(subjects.map((sub, idx) => ({
            id: String(idx + 1),
            subjectCode: sub.code,
            subjectName: sub.name,
            credits: sub.credits,
            grade: ''
          })));
        } else {
          setRows([]);
        }
      } catch (err) {
        console.error('Error fetching subjects:', err);
        setRows([]);
      } finally {
        setLoadingSubjects(false);
      }
    };
    fetchSubjects();
  }, [selectedDept, selectedSem, regulation]);

  useEffect(() => {
    if (!selectedDept || !regulation || !selectedSem) return;
    const fetchGrades = async () => {
      try {
        const gs = await api.getGradeSettings(selectedDept, regulation, selectedSem);
        if (gs && gs.grades && gs.grades.length > 0) {
          setGradeSettingsList(gs.grades);
        } else {
          setGradeSettingsList(DEFAULT_GRADES);
        }
      } catch (err) {
        console.error('Error fetching grade settings:', err);
        setGradeSettingsList(DEFAULT_GRADES);
      }
    };
    fetchGrades();
  }, [selectedDept, regulation, selectedSem]);

  const dynamicGradePoints = React.useMemo(() => {
    const map: Record<string, number> = {};
    gradeSettingsList.forEach(g => {
      map[g.grade.toUpperCase()] = g.points;
    });
    return map;
  }, [gradeSettingsList]);

  // Compute GPA — only count subjects where a grade has been entered
  let totalCredits = 0, totalPoints = 0;
  rows.forEach(r => {
    if (!r.grade || r.grade.trim() === '') return; // skip unentered subjects
    const cred = Number(r.credits) || 0;
    const gp = dynamicGradePoints[r.grade.toUpperCase()] !== undefined ? dynamicGradePoints[r.grade.toUpperCase()] : -1;
    if (gp >= 0 && cred > 0) { totalCredits += cred; totalPoints += cred * gp; }
  });
  const gpa = totalCredits > 0 ? parseFloat((totalPoints / totalCredits).toFixed(2)) : 0;
  // Enable download/save as soon as at least one grade is entered
  const anyGradeSet = rows.some(r => r.grade && r.grade.trim() !== '');


  const updateGrade = (id: string, grade: string) => {
    setRows(rows.map(r => r.id === id ? { ...r, grade } : r));
  };

  const resetGrades = () => {
    setRows(rows.map(r => ({ ...r, grade: '' })));
  };

  const downloadReport = async () => {
    setDownloadingPdf(true);
    try {
      const activeDeptObj = departments.find(d => d.code === selectedDept);
      // Only send subjects where a grade was actually entered — skip unentered ones
      const gradedRows = rows.filter(r => r.grade && r.grade.trim() !== '');
      if (gradedRows.length === 0) {
        alert('Please enter at least one grade before downloading the PDF.');
        return;
      }
      const payload = {
        department: activeDeptObj ? activeDeptObj.name : selectedDept,
        semester: Number(selectedSem),
        regulation,
        subjects: gradedRows.map(r => ({
          subjectCode: r.subjectCode,
          subjectName: r.subjectName,
          credits: Number(r.credits) || 0,
          grade: r.grade
        }))
      };
      const blob = await api.downloadPublicGpaPdf(payload);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `GPA_Report_Sem${selectedSem}_${selectedDept}.pdf`);
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


  return (
    <div className="min-h-screen bg-[#040f24] text-white">
      {/* Background orbs */}
      <div className="orb orb-indigo w-[500px] h-[500px] top-10 left-1/2 -translate-x-1/2 opacity-45 fixed" />
      <div className="orb orb-violet w-[300px] h-[300px] bottom-10 right-10 opacity-20 fixed" />

      <div className="max-w-5xl mx-auto px-4 pt-8 pb-16 sm:px-6 lg:px-8 relative z-10">

        {/* Back Link */}
        <div className="mb-6 animate-fade-in-down">
          <Link 
            to="/" 
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-300 hover:text-white bg-sky-500/5 hover:bg-sky-500/10 border border-sky-500/15 hover:border-sky-500/35 px-3.5 py-2 rounded-xl transition-all duration-300 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Home</span>
          </Link>
        </div>

        {/* Title */}
        <div className="text-center mb-10 animate-fade-in-down">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs font-semibold uppercase tracking-widest mb-5">
            <Sparkles className="h-3.5 w-3.5" />
            GPA Performance Calculator
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight mb-3 font-['Outfit']">
            Calculate Your <span className="gradient-text">Semester GPA</span>
          </h1>
          <p className="text-sm text-sky-200/50 max-w-xl mx-auto leading-relaxed">
            Select your department, regulation, and semester. Grades auto-load from the syllabus catalog.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Controls ── */}
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
                <label className="form-label">Semester</label>
                <select
                  value={selectedSem}
                  onChange={e => setSelectedSem(Number(e.target.value))}
                  className="w-full bg-[#071830] border border-sky-500/18 focus:border-sky-500/50 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none transition-all"
                >
                  {[...Array(8)].map((_, i) => (
                    <option key={i+1} value={i+1}>Semester {i+1}</option>
                  ))}
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

            {/* GPA Display */}
            <div className="gpa-display text-center">
              <span className="text-[10px] font-bold text-sky-300/50 uppercase tracking-widest block mb-2">Your GPA</span>
              <div className="display-number text-6xl font-black text-white mb-1">
                {gpa.toFixed(2)}
                <span className="text-xl text-sky-300/30 ml-1.5">/ 10</span>
              </div>
              {anyGradeSet && rows.length > 0 && (
                <div className="mt-3">
                  <div className="bg-sky-500/[0.06] rounded-xl p-2 text-center">
                    <div className="text-[9px] text-sky-300/40 mb-0.5">Total Credits</div>
                    <div className="text-sm font-bold text-white">{totalCredits}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <button
                onClick={downloadReport}
                disabled={downloadingPdf || rows.length === 0 || !anyGradeSet}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-sky-500/20 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none text-sm cursor-pointer"
              >
                {downloadingPdf ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /><span>Generating...</span></>
                ) : (
                  <><Download className="h-4 w-4" /><span>Download PDF Report</span></>
                )}
              </button>
              <button
                onClick={resetGrades}
                disabled={rows.length === 0}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-sky-300 hover:text-white transition-all rounded-xl border border-sky-500/30 hover:border-sky-500/50 bg-sky-500/5 hover:bg-sky-500/12 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Reset Grades
              </button>
            </div>
          </div>

          {/* ── Grades Table ── */}
          <div className="lg:col-span-2 animate-slide-right">
            <div className="glass-card rounded-2xl p-5 h-full">
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-sky-500/10">
                <h3 className="text-sm font-bold text-white">Grade Entry</h3>
                {rows.length > 0 && (
                  <span className="text-[10px] text-sky-300/40">
                    {rows.filter(r => r.grade).length} / {rows.length} graded
                  </span>
                )}
              </div>

              {loadingSubjects ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="skeleton h-14 rounded-xl" style={{opacity: 1 - i * 0.15}} />
                  ))}
                </div>
              ) : rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <GraduationCap className="h-10 w-10 text-sky-500/20 mb-3 animate-float" />
                  <p className="text-sm text-sky-300/45 font-medium">No subjects found</p>
                  <p className="text-xs text-sky-300/25 mt-1 max-w-xs">
                    No subjects configured for {selectedDept} — {regulation} — Semester {selectedSem}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                  <div className="hidden md:grid grid-cols-12 gap-3 text-[10px] font-bold uppercase tracking-wider text-sky-300/35 px-2 pb-2">
                    <div className="col-span-2">Code</div>
                    <div className="col-span-5">Subject</div>
                    <div className="col-span-2 text-center">Credits</div>
                    <div className="col-span-3 text-center">Grade</div>
                  </div>
                  {rows.map((row, idx) => (
                    <div
                      key={row.id}
                      style={{animationDelay: `${idx * 35}ms`}}
                      className={`grid grid-cols-1 md:grid-cols-12 gap-2 p-3 rounded-xl border transition-all animate-fade-in-up ${
                        row.grade ? 'bg-sky-500/[0.05] border-sky-500/12' : 'bg-[#0a052a]/40 border-sky-500/[0.06] hover:border-sky-500/15'
                      }`}
                    >
                      <div className="col-span-2 flex items-center">
                        <span className="text-[10px] font-mono font-bold text-sky-400 bg-sky-500/10 px-2 py-1 rounded-lg border border-sky-500/15">{row.subjectCode}</span>
                      </div>
                      <div className="col-span-5 flex items-center">
                        <span className="text-xs text-white/75 leading-tight">{row.subjectName}</span>
                      </div>
                      <div className="col-span-2 flex items-center justify-center">
                        <span className="text-xs font-semibold text-sky-300/60 bg-sky-500/8 px-2 py-1 rounded-lg">
                          {row.credits} Cr
                        </span>
                      </div>
                      <div className="col-span-3">
                        <select
                          value={row.grade}
                          onChange={e => updateGrade(row.id, e.target.value)}
                          className={`w-full bg-[#071830] border border-sky-500/15 focus:border-sky-500/50 rounded-xl px-2 py-2 text-xs focus:outline-none text-center font-bold transition-all ${
                            row.grade ? getGradeColor(row.grade) : 'text-sky-300/35'
                          }`}
                        >
                          <option value="">Grade</option>
                          {[...gradeSettingsList].sort((a, b) => b.points - a.points).map(g => (
                            <option key={g.grade} value={g.grade} className={getGradeColor(g.grade)}>
                              {g.grade} ({g.points})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
