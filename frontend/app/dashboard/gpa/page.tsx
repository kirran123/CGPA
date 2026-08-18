'use client';

import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  FileText,
  Loader2,
  Save,
  CheckCircle,
  RefreshCw,
  Info,
  Download,
  Plus,
  Trash2,
  Edit2
} from 'lucide-react';
import { api, Department, Subject } from '@/lib/api';
import { canEditRecords as canEditRecordsFn } from '@/lib/permissions';
import SearchableStudentSelect from '@/components/SearchableStudentSelect';

interface SubjectRow {
  id: string;
  subjectCode: string;
  subjectName: string;
  credits: number;
  grade: string;
  isCustom?: boolean;
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

export default function InternalGpaCalculator() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedSem, setSelectedSem] = useState(1);
  const [studentName, setStudentName] = useState('');
  const [registerNo, setRegisterNo] = useState('');
  const [regulation, setRegulation] = useState('');
  const [regulations, setRegulations] = useState<string[]>([]);
  const [rows, setRows] = useState<SubjectRow[]>([]);
  const [gradeSettingsList, setGradeSettingsList] = useState<{ grade: string; points: number }[]>(DEFAULT_GRADES);

  const [loadingDepts, setLoadingDepts] = useState(true);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Student Roster state & Batch filtering
  const [studentRoster, setStudentRoster] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [batches, setBatches] = useState<{ batch: string; count: number }[]>([]);
  const [selectedStudentReg, setSelectedStudentReg] = useState<string>('');

  const canEditRecords = canEditRecordsFn();

  // Load User, Departments & Regulations
  useEffect(() => {
    const init = async () => {
      try {
        const u = api.getCurrentUser();
        setCurrentUser(u);

        const depts = await api.getPublicDepartments();
        setDepartments(depts);

        // Lock to user department for dept_admin / staff
        const userDept = u?.role !== 'super_admin' ? u?.department || '' : '';
        if (userDept) {
          setSelectedDept(userDept);
        } else if (depts.length > 0) {
          setSelectedDept(depts[0].code);
        }

        // Fetch dynamic regulations
        const regs = await api.getRegulations();
        const regNames = regs.map((r: any) => r.name);
        setRegulations(regNames);
        if (regNames.length > 0) {
          setRegulation(regNames.includes('R2021') ? 'R2021' : regNames[0]);
        }
      } catch (err) {
        console.error('Error fetching departments:', err);
      } finally {
        setLoadingDepts(false);
      }
    };
    init();
  }, []);

  // Fetch Student Roster & Batches restricted by active department
  useEffect(() => {
    const fetchStudentsAndBatches = async () => {
      try {
        const userDept = currentUser?.role !== 'super_admin' ? currentUser?.department || '' : '';
        const activeDept = userDept || selectedDept;

        const [sts, bts] = await Promise.all([
          api.getStudents(activeDept || undefined, selectedBatch || undefined),
          api.getStudentBatches(activeDept || undefined)
        ]);
        setStudentRoster(sts);
        setBatches(bts);
      } catch (e) {
        console.error('Error fetching students roster:', e);
      }
    };
    fetchStudentsAndBatches();
  }, [selectedDept, selectedBatch, currentUser]);

  const handleSelectStudent = (regNo: string, student?: any) => {
    setSelectedStudentReg(regNo);
    if (!regNo) return;
    const st = student || studentRoster.find((s) => s.registerNo.toUpperCase() === regNo.toUpperCase());
    if (!st) return;
    setStudentName(st.name);
    setRegisterNo(st.registerNo);
    if (st.department && (currentUser?.role === 'super_admin' || currentUser?.department === st.department)) {
      setSelectedDept(st.department);
    }
    if (st.regulation) setRegulation(st.regulation);
  };

  const downloadReport = async () => {
    setDownloadingPdf(true);
    try {
      const activeDeptObj = departments.find(d => d.code === selectedDept);
      const gradedRows = rows.filter(r => r.grade && r.grade.trim() !== '');
      if (gradedRows.length === 0) {
        alert('Please enter at least one grade before downloading the PDF.');
        return;
      }
      const payload = {
        studentName: studentName.trim() || 'Student',
        registerNo: registerNo.trim() || 'Student',
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

  // Fetch subjects when dept, semester, or regulation changes
  useEffect(() => {
    if (!selectedDept || !regulation) return;
    const fetchSubjects = async () => {
      setLoadingSubjects(true);
      setSaveSuccess(null);
      try {
        const subjects = await api.getSubjects(selectedDept, selectedSem, regulation);
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

  // Live GPA calculation — only count subjects where a grade has been entered
  let totalCredits = 0, totalPoints = 0;
  rows.forEach(r => {
    if (!r.grade || r.grade.trim() === '') return;
    const cred = Number(r.credits) || 0;
    const gp = dynamicGradePoints[r.grade.toUpperCase()] !== undefined ? dynamicGradePoints[r.grade.toUpperCase()] : -1;
    if (gp >= 0 && cred >= 0) { totalCredits += cred; totalPoints += cred * gp; }
  });
  const gpa = totalCredits > 0 ? parseFloat((totalPoints / totalCredits).toFixed(2)) : 0;
  const anyGradeSet = rows.some(r => r.grade && r.grade.trim() !== '');

  const updateGrade = (id: string, grade: string) => {
    setRows(rows.map(r => r.id === id ? { ...r, grade } : r));
  };

  // Temporary row editing for local calculation (does not touch DB)
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
        isCustom: true
      }
    ]);
  };

  const resetCalculator = () => {
    setRows(rows.map(r => ({ ...r, grade: '' })));
    setStudentName('');
    setRegisterNo('');
    setSelectedStudentReg('');
    setSaveSuccess(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(null);
    const nameToSave = studentName.trim() || 'Student';
    const regToSave = registerNo.trim() || 'Student';

    const gradedRows = rows.filter(r => r.grade && r.grade.trim() !== '');
    if (gradedRows.length === 0) {
      alert('Please enter at least one grade before saving.');
      setSaving(false);
      return;
    }

    const payload = {
      studentName: nameToSave,
      registerNo: regToSave,
      semester: selectedSem,
      department: selectedDept,
      regulation,
      subjects: gradedRows.map(r => ({
        subjectCode: r.subjectCode,
        grade: r.grade
      }))
    };

    try {
      const record = await api.calculateGpa(payload);
      setSaveSuccess(`GPA record calculated & saved — ${nameToSave} (${regToSave}) — GPA: ${record.gpa}`);
    } catch (err: any) {
      alert(err.message || 'Failed to calculate & save GPA record.');
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sky-500/10 animate-fade-in-down">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2 font-['Outfit']">
            <GraduationCap className="h-5 w-5 text-sky-400" />
            GPA Calculation
          </h1>
          <p className="text-xs text-sky-300/50 mt-1">
            Select department, regulation &amp; semester → grades auto-load from syllabus catalog
          </p>
        </div>
        <button
          onClick={resetCalculator}
          className="flex items-center gap-1.5 text-xs font-semibold text-sky-300 hover:text-white transition-all px-3 py-1.5 rounded-lg border border-sky-500/20 hover:border-sky-500/40 bg-sky-500/5 hover:bg-sky-500/10 cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reset Grades
        </button>
      </div>

      {saveSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-2xl text-xs flex items-center gap-2 animate-scale-in">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left: Details Panel ── */}
        <div className="space-y-5 animate-slide-left">
          <div className="bg-white/[0.02] border border-sky-500/10 rounded-2xl p-5 backdrop-blur-xl space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-sky-500/10">
              <FileText className="h-4 w-4 text-sky-400" />
              Calculation Setup
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

            {/* Semester */}
            <div className="form-group">
              <label className="form-label">Semester</label>
              <select
                value={selectedSem}
                onChange={e => setSelectedSem(Number(e.target.value))}
                className="w-full bg-[#071830] border border-sky-500/18 focus:border-sky-500/50 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500/15 transition-all"
              >
                {[...Array(8)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>Semester {i + 1}</option>
                ))}
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
                      <option key={d._id} value={d.code}>{d.name} ({d.code})</option>
                    ))}
                </select>
              )}
            </div>

            <div className="section-divider !my-2" />

            {/* Student Info & Searchable Dropdown */}
            <div className="bg-sky-500/[0.04] border border-sky-500/10 rounded-xl p-3 space-y-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Info className="h-3 w-3 text-sky-400/60" />
                <span className="text-[10px] text-sky-300/60">Select registered student or type details below</span>
              </div>

              {/* Batch Selector Filter */}
              <div className="form-group">
                <label className="form-label text-[10px] font-bold text-sky-300 uppercase">Filter Roster By Batch</label>
                <select
                  value={selectedBatch}
                  onChange={(e) => setSelectedBatch(e.target.value)}
                  className="w-full bg-[#071830] border border-sky-500/18 focus:border-sky-500/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="">All Batches ({batches.reduce((sum, b) => sum + b.count, 0) || studentRoster.length} students)</option>
                  {batches.map((b) => (
                    <option key={b.batch} value={b.batch}>{b.batch} ({b.count} students)</option>
                  ))}
                </select>
              </div>

              {/* Searchable Student Combobox */}
              <div className="form-group">
                <label className="form-label text-[10px] font-bold text-sky-300 uppercase">Select Registered Student</label>
                <SearchableStudentSelect
                  students={studentRoster}
                  value={selectedStudentReg}
                  valueKey="registerNo"
                  onChange={handleSelectStudent}
                  placeholder="Search & choose student..."
                />
              </div>

              <div className="form-group">
                <label className="form-label">Student Name</label>
                <input
                  type="text"
                  value={studentName}
                  onChange={e => setStudentName(e.target.value)}
                  placeholder="e.g. Abinesh S"
                  className="w-full bg-[#071830] border border-sky-500/15 focus:border-sky-500/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none placeholder:text-sky-400/25 transition-all"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Register No.</label>
                <input
                  type="text"
                  value={registerNo}
                  onChange={e => {
                    const val = e.target.value;
                    setRegisterNo(val);
                    const match = studentRoster.find(s => s.registerNo.toUpperCase() === val.trim().toUpperCase());
                    if (match) {
                      setStudentName(match.name);
                      if (match.regulation) setRegulation(match.regulation);
                      setSelectedStudentReg(match.registerNo);
                    }
                  }}
                  placeholder="e.g. 953621104012"
                  className="w-full bg-[#071830] border border-sky-500/15 focus:border-sky-500/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none placeholder:text-sky-400/25 transition-all"
                />
              </div>
            </div>
          </div>

          {/* GPA Result Display */}
          <div className="gpa-display animate-pulse-glow">
            <div className="text-center">
              <span className="text-[10px] font-bold text-sky-300/50 uppercase tracking-widest block mb-2">Computed GPA</span>
              <div className="display-number text-5xl font-black text-white mb-1">
                <span className="gradient-text">{gpa.toFixed(2)}</span>
                <span className="text-lg text-sky-300/40 ml-1">/ 10</span>
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
          </div>

          {/* Save & Download Buttons */}
          <div className="space-y-2">
            <button
              onClick={downloadReport}
              disabled={downloadingPdf || rows.length === 0 || !anyGradeSet}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-sky-500/20 transition-all hover:-translate-y-0.5 hover:shadow-sky-500/35 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm cursor-pointer"
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
                disabled={saving || rows.length === 0 || !anyGradeSet}
                className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 hover:border-sky-500/40 text-sky-300 hover:text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs cursor-pointer"
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

        {/* ── Right: Grades & Temporary Subject Customization Table ── */}
        <div className="lg:col-span-2 animate-slide-right">
          <div className="bg-white/[0.02] border border-sky-500/10 rounded-2xl p-5 backdrop-blur-xl h-full flex flex-col justify-between">
            <div>
              <div className="mb-4 pb-3 border-b border-sky-500/10 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Semester Grades</span>
                    {rows.length > 0 && (
                      <span className="text-[10px] text-sky-300/40 font-normal">
                        {rows.filter(r => r.grade).length} / {rows.length} graded
                      </span>
                    )}
                  </h2>
                  <p className="text-[10px] text-amber-300/60 mt-0.5">
                    💡 Note: You can temporarily edit code/name/credits or delete/add subjects below for custom calculation. (Will NOT affect database records)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleTemporaryAddRow}
                  className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 hover:text-white bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-sm shrink-0 whitespace-nowrap"
                >
                  <Plus className="h-4 w-4 text-emerald-400" />
                  <span>+ Add Subject Row</span>
                </button>
              </div>

              {loadingSubjects ? (
                <div className="space-y-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="skeleton h-14 rounded-xl" style={{ opacity: 1 - i * 0.12 }} />
                  ))}
                </div>
              ) : rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <GraduationCap className="h-10 w-10 text-sky-500/25 mb-3 animate-float" />
                  <p className="text-sm text-sky-300/50 font-medium">No subjects loaded</p>
                  <p className="text-xs text-sky-300/30 mt-1 max-w-xs mb-3">
                    No subjects found for {selectedDept} — {regulation} — Semester {selectedSem}. You can click "Add Subject Row" to manually enter subjects.
                  </p>
                  <button
                    type="button"
                    onClick={handleTemporaryAddRow}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 rounded-xl hover:bg-emerald-500/30 transition-all cursor-pointer shadow-md"
                  >
                    <Plus className="h-4 w-4" />
                    <span>+ Add Subject Row</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                  {/* Column headers */}
                  <div className="hidden md:grid grid-cols-12 gap-2 text-[10px] font-bold uppercase tracking-wider text-sky-300/40 px-3 pb-1">
                    <div className="col-span-2">Code</div>
                    <div className="col-span-5">Subject Name</div>
                    <div className="col-span-1 text-center">Credits</div>
                    <div className="col-span-2 text-center">Grade</div>
                    <div className="col-span-2 text-center">Actions</div>
                  </div>

                  {rows.map((row, idx) => (
                    <div
                      key={row.id}
                      style={{ animationDelay: `${idx * 30}ms` }}
                      className={`grid grid-cols-1 md:grid-cols-12 gap-2 p-2.5 rounded-xl border transition-all duration-150 animate-fade-in-up items-center ${row.grade
                          ? 'bg-sky-500/[0.04] border-sky-500/12'
                          : 'bg-[#0a052a]/50 border-sky-500/[0.06] hover:border-sky-500/15'
                        }`}
                    >
                      {/* Code */}
                      <div className="col-span-2">
                        <input
                          type="text"
                          value={row.subjectCode}
                          title={row.subjectCode}
                          onChange={(e) => updateRowField(row.id, 'subjectCode', e.target.value)}
                          className="w-full bg-[#071830] border border-sky-500/15 focus:border-sky-500/40 rounded-lg px-2 py-1 text-[11px] font-mono font-bold text-sky-400 focus:outline-none"
                        />
                      </div>

                      {/* Subject Name */}
                      <div className="col-span-5">
                        <input
                          id={`sub-name-${row.id}`}
                          type="text"
                          value={row.subjectName}
                          title={row.subjectName}
                          onChange={(e) => updateRowField(row.id, 'subjectName', e.target.value)}
                          className="w-full bg-[#071830] border border-sky-500/15 focus:border-sky-500/40 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
                        />
                      </div>

                      {/* Credits */}
                      <div className="col-span-1">
                        <input
                          type="number"
                          min="0"
                          max="12"
                          value={row.credits}
                          onChange={(e) => updateRowField(row.id, 'credits', parseFloat(e.target.value) || 0)}
                          className="w-full bg-[#071830] border border-sky-500/15 focus:border-sky-500/40 rounded-lg px-1.5 py-1 text-xs text-sky-300 font-semibold text-center focus:outline-none"
                        />
                      </div>

                      {/* Grade Selector */}
                      <div className="col-span-2">
                        <select
                          value={row.grade}
                          onChange={e => updateGrade(row.id, e.target.value)}
                          className={`w-full bg-[#071830] border border-sky-500/15 focus:border-sky-500/50 rounded-xl px-1.5 py-1.5 text-xs focus:outline-none text-center font-bold transition-all ${row.grade ? getGradeColor(row.grade) : 'text-sky-300/40'
                            }`}
                        >
                          <option value="">-- Grade --</option>
                          {[...gradeSettingsList].sort((a, b) => b.points - a.points).map(g => (
                            <option key={g.grade} value={g.grade} className={getGradeColor(g.grade)}>
                              {g.grade} ({g.points})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Action: Edit & Delete (Edit is BEFORE Delete) */}
                      <div className="col-span-2 flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const el = document.getElementById(`sub-name-${row.id}`);
                            if (el) el.focus();
                          }}
                          className="p-1.5 text-sky-300 hover:text-white bg-sky-500/10 hover:bg-sky-500/25 border border-sky-500/20 hover:border-sky-500/40 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[10px] font-semibold"
                          title="Edit subject details"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTemporaryDeleteRow(row.id)}
                          className="p-1.5 text-red-400/70 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[10px] font-semibold"
                          title="Remove subject row temporarily from calculation"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Delete</span>
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
  );
}
