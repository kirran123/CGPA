'use client';

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

import { 
  GraduationCap,
  Download,
  RefreshCw,
  Loader2,
  ArrowLeft,
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  Check
} from 'lucide-react';
import { api, Department } from '@/lib/api';

interface SubjectRow {
  id: string;
  subjectCode: string;
  subjectName: string;
  credits: number;
  grade: string;
  isCustom?: boolean;
  isEditing?: boolean;
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

  const [studentName, setStudentName] = useState('');
  const [registerNo, setRegisterNo] = useState('');
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
            grade: '',
            isEditing: false
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
    if (gp >= 0 && cred >= 0) { totalCredits += cred; totalPoints += cred * gp; }
  });
  const gpa = totalCredits > 0 ? parseFloat((totalPoints / totalCredits).toFixed(2)) : 0;
  // Enable download/save as soon as at least one grade is entered
  const anyGradeSet = rows.some(r => r.grade && r.grade.trim() !== '');

  const updateGrade = (id: string, grade: string) => {
    setRows(rows.map(r => r.id === id ? { ...r, grade } : r));
  };

  // Toggle edit state for row (Code, Name, Credits only editable when isEditing is true)
  const toggleEditRow = (id: string) => {
    setRows(rows.map(r => r.id === id ? { ...r, isEditing: !r.isEditing } : r));
  };

  // Temporary row editing for local calculation
  const updateRowField = (id: string, field: keyof SubjectRow, val: any) => {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: val } : r));
  };

  const handleTemporaryDeleteRow = (id: string) => {
    setRows(rows.filter(r => r.id !== id));
  };

  const handleTemporaryAddRow = () => {
    const newId = `temp-${Date.now()}`;
    setRows([
      ...rows,
      {
        id: newId,
        subjectCode: `ELECTIVE-${rows.length + 1}`,
        subjectName: 'Elective / Custom Subject',
        credits: 3,
        grade: '',
        isCustom: true,
        isEditing: true
      }
    ]);
  };

  const resetGrades = () => {
    setRows(rows.map(r => ({ ...r, grade: '' })));
    setStudentName('');
    setRegisterNo('');
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
        studentName: studentName.trim() || undefined,
        registerNo: registerNo.trim() || undefined,
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

      <div className="max-w-7xl mx-auto px-4 pt-2 pb-8 sm:px-6 lg:px-8 relative z-10">

        {/* Back Link */}
        <div className="mb-2 animate-fade-in-down">
          <Link 
            to="/" 
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-300 hover:text-white bg-sky-500/5 hover:bg-sky-500/10 border border-sky-500/15 hover:border-sky-500/35 px-3 py-1 rounded-xl transition-all duration-300 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Home</span>
          </Link>
        </div>

        {/* Title */}
        <div className="text-center mb-4 animate-fade-in-down">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-300 text-[10px] font-semibold uppercase tracking-widest mb-1">
            <Sparkles className="h-3 w-3" />
            GPA Performance Calculator
          </div>
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight mb-0.5 font-['Outfit']">
            Calculate Your <span className="gradient-text">Semester GPA</span>
          </h1>
          <p className="text-[11px] text-sky-200/50 max-w-xl mx-auto">
            Select department, regulation, and semester. Grades auto-load from syllabus catalog.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* ── Controls ── */}
          <div className="lg:col-span-4 space-y-3.5 animate-slide-left">
            <div className="glass-card rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-white pb-1 border-b border-sky-500/10">Setup</h3>

              <div className="form-group">
                <label className="form-label text-[11px]">Regulation</label>
                <select
                  value={regulation}
                  onChange={e => setRegulation(e.target.value)}
                  className="w-full bg-[#071830] border border-sky-500/18 focus:border-sky-500/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition-all"
                >
                  {regulations.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label text-[11px]">Semester</label>
                <select
                  value={selectedSem}
                  onChange={e => setSelectedSem(Number(e.target.value))}
                  className="w-full bg-[#071830] border border-sky-500/18 focus:border-sky-500/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition-all"
                >
                  {[...Array(8)].map((_, i) => (
                    <option key={i+1} value={i+1}>Semester {i+1}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label text-[11px]">Department</label>
                {loadingDepts ? (
                  <div className="h-8 skeleton rounded-xl" />
                ) : (
                  <select
                    value={selectedDept}
                    onChange={e => setSelectedDept(e.target.value)}
                    className="w-full bg-[#071830] border border-sky-500/18 focus:border-sky-500/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition-all"
                  >
                    {departments.map(d => (
                      <option key={d._id} value={d.code}>{d.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* GPA Display */}
            <div className="gpa-display text-center py-3">
              <span className="text-[10px] font-bold text-sky-300/50 uppercase tracking-widest block mb-1">Your GPA</span>
              <div className="display-number text-4xl md:text-5xl font-black text-white mb-0.5">
                {gpa.toFixed(2)}
                <span className="text-base text-sky-300/30 ml-1">/ 10</span>
              </div>
              {anyGradeSet && rows.length > 0 && (
                <div className="mt-1.5">
                  <div className="bg-sky-500/[0.06] rounded-xl p-1 text-center">
                    <div className="text-[9px] text-sky-300/40">Total Credits</div>
                    <div className="text-xs font-bold text-white">{totalCredits}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <button
                onClick={downloadReport}
                disabled={downloadingPdf || rows.length === 0 || !anyGradeSet}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-sky-500/20 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none text-xs cursor-pointer"
              >
                {downloadingPdf ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /><span>Generating...</span></>
                ) : (
                  <><Download className="h-3.5 w-3.5" /><span>Download PDF Report</span></>
                )}
              </button>
              <button
                onClick={resetGrades}
                disabled={rows.length === 0}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-sky-300 hover:text-white transition-all rounded-xl border border-sky-500/30 hover:border-sky-500/50 bg-sky-500/5 hover:bg-sky-500/12 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Reset Grades
              </button>
            </div>

            {/* Student Details (Optional for PDF Report) */}
            <div className="glass-card rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-sky-500/10">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Student Details (Optional)</h3>
                <span className="text-[9px] text-sky-300/40">Appears on PDF</span>
              </div>

              <div className="form-group space-y-1">
                <label className="form-label text-[10px] font-extrabold text-sky-400 uppercase tracking-wider block">
                  STUDENT NAME
                </label>
                <input
                  type="text"
                  placeholder="e.g. Abinesh S"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full bg-[#071830] border border-sky-500/18 focus:border-sky-500/50 rounded-xl px-3 py-2 text-xs text-white placeholder:text-sky-300/30 focus:outline-none transition-all"
                />
              </div>

              <div className="form-group space-y-1">
                <label className="form-label text-[10px] font-extrabold text-sky-400 uppercase tracking-wider block">
                  REGISTER NO.
                </label>
                <input
                  type="text"
                  placeholder="e.g. 953621104012"
                  value={registerNo}
                  onChange={(e) => setRegisterNo(e.target.value)}
                  className="w-full bg-[#071830] border border-sky-500/18 focus:border-sky-500/50 rounded-xl px-3 py-2 text-xs text-white placeholder:text-sky-300/30 focus:outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* ── Grades Table ── */}
          <div className="lg:col-span-8 animate-slide-right">
            <div className="bg-[#f4f9ff] rounded-3xl p-5 md:p-6 h-full flex flex-col justify-between shadow-2xl border border-[#cbe3fb]">
              <div>
                {/* Header Title & Subtitle */}
                <div className="mb-3 pb-2 border-b border-[#cbe3fb]/60">
                  <div className="flex items-center gap-2.5 mb-1">
                    <h3 className="text-base md:text-lg font-extrabold text-[#1e293b] font-['Outfit']">
                      Semester Grades
                    </h3>
                    {rows.length > 0 && (
                      <span className="text-xs font-bold text-sky-800 bg-[#dbeafe] border border-[#bfdbfe] px-2.5 py-0.5 rounded-full">
                        {rows.filter(r => r.grade).length} / {rows.length} graded
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] md:text-xs text-amber-700/90 font-medium leading-relaxed">
                    💡 Note: You can temporarily edit code/name/credits or delete/add subjects below for custom calculation. (Will NOT affect database records)
                  </p>
                  <div className="mt-2.5">
                    <button
                      type="button"
                      onClick={handleTemporaryAddRow}
                      className="flex items-center gap-1.5 text-xs font-bold text-[#137333] hover:text-[#0d5224] bg-[#e6f4ea] hover:bg-[#ceead6] border border-[#a8dab5] px-3.5 py-1.5 rounded-full transition-all cursor-pointer shadow-xs whitespace-nowrap"
                    >
                      <Plus className="h-3.5 w-3.5 text-[#137333]" />
                      <span>+ Add Subject Row</span>
                    </button>
                  </div>
                </div>

                {loadingSubjects ? (
                  <div className="space-y-2.5 pt-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="skeleton h-12 rounded-xl bg-sky-200/40" style={{opacity: 1 - i * 0.15}} />
                    ))}
                  </div>
                ) : rows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <GraduationCap className="h-9 w-9 text-sky-400/40 mb-2.5 animate-float" />
                    <p className="text-xs md:text-sm text-slate-700 font-semibold">No subjects found</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 max-w-xs mb-3">
                      No subjects configured for {selectedDept} — {regulation} — Semester {selectedSem}. Click below to manually add subject rows.
                    </p>
                    <button
                      type="button"
                      onClick={handleTemporaryAddRow}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-[#137333] bg-[#e6f4ea] border border-[#a8dab5] rounded-full hover:bg-[#ceead6] transition-all cursor-pointer shadow-md"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>+ Add Subject Row</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[440px] overflow-y-auto pr-4 pb-1 custom-scrollbar pt-1">
                    {/* Header Row */}
                    <div className="hidden md:grid grid-cols-12 gap-2 text-xs font-extrabold uppercase tracking-wider text-[#334155] px-2.5 pb-2 pr-4">
                      <div className="col-span-2">CODE</div>
                      <div className="col-span-4">SUBJECT NAME</div>
                      <div className="col-span-1 text-center">CREDITS</div>
                      <div className="col-span-2 text-center">GRADE</div>
                      <div className="col-span-3 text-center">ACTIONS</div>
                    </div>

                    {/* Subject Rows */}
                    {rows.map((row, idx) => (
                      <div
                        key={row.id}
                        style={{animationDelay: `${idx * 25}ms`}}
                        className={`grid grid-cols-1 md:grid-cols-12 gap-2 p-2 rounded-xl border transition-all animate-fade-in-up items-center ${
                          row.isEditing
                            ? 'bg-amber-100/90 border-amber-400 shadow-md ring-1 ring-amber-300/40'
                            : row.grade
                              ? 'bg-[#e0f2fe]/90 border-[#93c5fd]'
                              : 'bg-[#eaf4ff]/80 hover:bg-[#eaf4ff] border border-[#bbe1fa] shadow-2xs'
                        }`}
                      >
                        {/* Code */}
                        <div className="col-span-2">
                          <input
                            type="text"
                            readOnly={!row.isEditing}
                            value={row.subjectCode}
                            title={row.subjectCode}
                            onChange={(e) => updateRowField(row.id, 'subjectCode', e.target.value)}
                            className={`w-full rounded-xl px-2 py-1.5 text-xs font-mono font-bold text-center focus:outline-none transition-all truncate ${
                              row.isEditing
                                ? 'bg-white border-2 border-amber-500 text-amber-900 ring-2 ring-amber-400/20'
                                : 'bg-[#d5e8ff] border border-[#9ecaff] text-[#1e3a8a] cursor-default'
                            }`}
                          />
                        </div>

                        {/* Subject Name — Fully Visible Without Overlap */}
                        <div className="col-span-4">
                          <input
                            id={`public-sub-name-${row.id}`}
                            type="text"
                            readOnly={!row.isEditing}
                            value={row.subjectName}
                            title={row.subjectName}
                            onChange={(e) => updateRowField(row.id, 'subjectName', e.target.value)}
                            className={`w-full rounded-xl px-2.5 py-1.5 text-xs focus:outline-none transition-all ${
                              row.isEditing
                                ? 'bg-white border-2 border-amber-500 text-amber-900 font-semibold ring-2 ring-amber-400/20'
                                : 'bg-[#d5e8ff] border border-[#9ecaff] text-[#1e293b] font-semibold cursor-default'
                            }`}
                          />
                        </div>

                        {/* Credits */}
                        <div className="col-span-1">
                          <input
                            type="number"
                            min="0"
                            max="12"
                            readOnly={!row.isEditing}
                            value={row.credits}
                            onChange={(e) => updateRowField(row.id, 'credits', parseFloat(e.target.value) || 0)}
                            className={`w-full rounded-xl px-1 py-1.5 text-xs font-bold text-center focus:outline-none transition-all ${
                              row.isEditing
                                ? 'bg-white border-2 border-amber-500 text-amber-900 ring-2 ring-amber-400/20'
                                : 'bg-[#d5e8ff] border border-[#9ecaff] text-[#1e293b] cursor-default'
                            }`}
                          />
                        </div>

                        {/* Grade Selector */}
                        <div className="col-span-2">
                          <select
                            value={row.grade}
                            onChange={e => updateGrade(row.id, e.target.value)}
                            className="w-full bg-white border border-[#9ecaff] text-[#1e3a8a] font-bold text-xs text-center rounded-xl px-1 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-400 shadow-2xs transition-all cursor-pointer"
                          >
                            <option value="">-- Grade --</option>
                            {[...gradeSettingsList].sort((a, b) => b.points - a.points).map(g => (
                              <option key={g.grade} value={g.grade} className="text-slate-900 font-bold">
                                {g.grade} ({g.points})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Action Buttons: Edit & Delete (Given 3 cols so Delete never touches scrollbar) */}
                        <div className="col-span-3 flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggleEditRow(row.id)}
                            className={`px-2.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-xs font-bold shrink-0 shadow-2xs ${
                              row.isEditing
                                ? 'bg-amber-200 text-amber-900 border border-amber-400 shadow-sm'
                                : 'bg-[#d0e5ff] hover:bg-[#b5d7ff] text-[#1e3a8a] border border-[#9ecaff]'
                            }`}
                            title={row.isEditing ? "Finish editing subject" : "Edit subject details temporarily"}
                          >
                            {row.isEditing ? <Check className="h-3.5 w-3.5" /> : <Edit2 className="h-3.5 w-3.5" />}
                            <span>{row.isEditing ? 'Done' : 'Edit'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTemporaryDeleteRow(row.id)}
                            className="px-2.5 py-1.5 bg-[#ffe2e2] hover:bg-[#ffd0d0] text-[#991b1b] border border-[#fca5a5] rounded-xl text-xs font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer shrink-0"
                            title="Remove subject row temporarily from calculation"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Delete</span>
                          </button>
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
    </div>
  );
}
