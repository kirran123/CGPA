'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Building,
  Bookmark,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  Info
} from 'lucide-react';
import { api, Subject, Department } from '@/lib/api';
import { canEditSubjects as canEditSubjectsFn } from '@/lib/permissions';

/* ─── Template Download Helper ────────────────────────────────────────────── */
function downloadTemplate() {
  const header = 'Code,Name,Credits,Semester,Regulation\n';
  const sample = [
    'CS3401,Database Management Systems,3,4,R2021',
    'CS3402,Computer Networks,3,4,R2021',
    'CS3501,Operating Systems,3,5,R2021',
  ].join('\n');
  const blob = new Blob([header + sample], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'subjects_template.csv';
  a.click();
}

/* ─── Types ────────────────────────────────────────────────────────────────── */
interface BulkResult {
  message: string;
  added: number;
  skipped: number;
  errors: { code: string; reason: string }[];
  addedCodes: string[];
  skippedCodes: string[];
}

export default function SubjectManagement() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterDept, setFilterDept] = useState('');
  const [filterSem, setFilterSem] = useState<number | ''>('');
  const [filterReg, setFilterReg] = useState<string | ''>('');
  const [regulations, setRegulations] = useState<string[]>([]);

  // Single-entry modal
  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  // Form Fields
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [credits, setCredits] = useState(3);
  const [semester, setSemester] = useState(1);
  const [department, setDepartment] = useState('IT');
  const [regulation, setRegulation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Bulk upload modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkDept, setBulkDept] = useState('');
  const [bulkReg, setBulkReg] = useState('');
  const [bulkSem, setBulkSem] = useState<number | ''>('');
  const [bulkSkip, setBulkSkip] = useState(true);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEditSubjects = canEditSubjectsFn();
  const navigate = useNavigate();

  // Load regulations once
  useEffect(() => {
    const fetchRegs = async () => {
      try {
        const list = await api.getRegulations();
        setRegulations(list.map((r: any) => r.name));
      } catch (err) {
        console.error('Failed to load regulations:', err);
      }
    };
    fetchRegs();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const u = api.getCurrentUser();
      if (!u) { navigate('/login'); return; }
      setCurrentUser(u);

      const depts = await api.getPublicDepartments();
      setDepartments(depts);

      const activeDept = u.role === 'super_admin'
        ? (filterDept || (depts.length > 0 ? depts[0].code : ''))
        : u.department || '';

      if (filterDept !== activeDept) { setFilterDept(activeDept); return; }
      if (activeDept) {
        const list = await api.getSubjects(activeDept, filterSem || undefined, filterReg || undefined);
        setSubjects(list);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load subjects.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    if (!currentUser || !filterDept) return;
    const fetch = async () => {
      setLoading(true);
      try {
        const list = await api.getSubjects(filterDept, filterSem || undefined, filterReg || undefined);
        setSubjects(list);
      } catch (err: any) { setError(err.message); }
      finally { setLoading(false); }
    };
    fetch();
  }, [filterDept, filterSem, filterReg, currentUser]);

  /* ── Single-entry handlers ── */
  const openCreateModal = () => {
    setEditingSubject(null);
    setCode(''); setName(''); setCredits(3); setSemester(1);
    setDepartment(currentUser?.department || (departments.length > 0 ? departments[0].code : ''));
    setRegulation(regulations.includes('R2021') ? 'R2021' : regulations[0] || '');
    setShowModal(true);
  };
  const openEditModal = (sub: Subject) => {
    setEditingSubject(sub);
    setCode(sub.code); setName(sub.name); setCredits(sub.credits);
    setSemester(sub.semester); setDepartment(sub.department);
    setRegulation(sub.regulation || 'R2021');
    setShowModal(true);
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setError(null);
    const payload = { code, name, credits, semester, department, regulation };
    try {
      if (editingSubject) await api.updateSubject(editingSubject._id, payload);
      else await api.createSubject(payload);
      setShowModal(false); loadData();
    } catch (err: any) { setError(err.message || 'Action failed.'); }
    finally { setSubmitting(false); }
  };
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this subject catalog entry?')) return;
    try { await api.deleteSubject(id); loadData(); }
    catch (err: any) { setError(err.message || 'Failed to delete.'); }
  };

  /* ── Bulk upload handlers ── */
  const openBulkModal = () => {
    setBulkFile(null); setBulkResult(null); setBulkError(null);
    setBulkDept(currentUser?.department || (departments.length > 0 ? departments[0].code : ''));
    setBulkReg(regulations[0] || '');
    setBulkSem('');
    setBulkSkip(true);
    setShowBulkModal(true);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) setBulkFile(f);
  };

  const handleBulkUpload = async () => {
    if (!bulkFile) { setBulkError('Please select a file first.'); return; }
    setBulkUploading(true); setBulkError(null); setBulkResult(null);
    try {
      const fd = new FormData();
      fd.append('file', bulkFile);
      fd.append('department', bulkDept || currentUser?.department || '');
      if (bulkReg) fd.append('regulation', bulkReg);
      if (bulkSem) fd.append('semester', String(bulkSem));
      fd.append('skipDuplicates', String(bulkSkip));

      const result = await (api as any).bulkUploadSubjects(fd);
      setBulkResult(result);
      loadData(); // refresh subject grid
    } catch (err: any) {
      setBulkError(err.message || 'Upload failed.');
    } finally {
      setBulkUploading(false);
    }
  };

  const getFileIcon = (file: File | null) => {
    if (!file) return null;
    if (file.name.endsWith('.pdf')) return <FileText className="h-5 w-5 text-red-400" />;
    return <FileSpreadsheet className="h-5 w-5 text-emerald-400" />;
  };

  /* ── Loading ── */
  if (loading && subjects.length === 0) {
    return (
      <div className="h-80 flex flex-col items-center justify-center text-sky-300 gap-3">
        <div className="relative">
          <div className="w-10 h-10 border-2 border-sky-500/20 rounded-full" />
          <div className="absolute inset-0 w-10 h-10 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-sm text-sky-300/50">Loading syllabus catalog...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sky-500/10">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2 font-['Outfit']">
            <BookOpen className="h-5 w-5 text-sky-400" />
            Syllabus Catalog Manager
          </h1>
          <p className="text-xs text-sky-300/50 mt-1">
            Maintain course details, credit weights, and regulations for GPA calculation mapping
          </p>
        </div>
      </div>

      {/* Filters + Action Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/[0.02] border border-sky-500/10 p-4 rounded-2xl backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-300/60 uppercase tracking-wider shrink-0">
            <Building className="h-4 w-4" />
            <span>Filters:</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            {/* Dept Filter */}
            <select
              value={filterDept}
              disabled={currentUser?.role !== 'super_admin'}
              onChange={e => setFilterDept(e.target.value)}
              className="w-full sm:w-64 bg-[#071830] border border-sky-500/15 focus:border-sky-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed truncate"
            >
              {departments
                .filter(d => currentUser?.role === 'super_admin' || d.code === currentUser?.department)
                .map(d => <option key={d._id} value={d.code}>{d.name}</option>)}
            </select>

            <div className="grid grid-cols-2 gap-3 w-full sm:w-auto sm:flex">
              {/* Semester Filter */}
              <select
                value={filterSem}
                onChange={e => setFilterSem(e.target.value ? Number(e.target.value) : '')}
                className="w-full sm:w-auto bg-[#071830] border border-sky-500/15 focus:border-sky-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              >
                <option value="">All Semesters</option>
                {[...Array(8)].map((_, i) => <option key={i+1} value={i+1}>Semester {i+1}</option>)}
              </select>

              {/* Regulation Filter */}
              <select
                value={filterReg}
                onChange={e => setFilterReg(e.target.value)}
                className="w-full sm:w-auto bg-[#071830] border border-sky-500/15 focus:border-sky-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              >
                <option value="">All Regulations</option>
                {(() => {
                  const opts = [...regulations];
                  subjects.forEach(sub => {
                    if (sub.regulation && !opts.includes(sub.regulation)) {
                      opts.push(sub.regulation);
                    }
                  });
                  return opts.map(r => <option key={r} value={r}>{r}</option>);
                })()}
              </select>
            </div>
          </div>
        </div>

        {canEditSubjects && (
          <div className="flex items-center gap-2 w-full lg:w-auto lg:justify-end">
            {/* Bulk Upload Button */}
            <button
              onClick={openBulkModal}
              className="flex-1 lg:flex-none justify-center flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
            >
              <Upload className="h-4 w-4" />
              <span>Bulk Upload</span>
            </button>
            {/* Single Add Button */}
            <button
              onClick={openCreateModal}
              className="flex-1 lg:flex-none justify-center flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-500 to-purple-600 hover:from-sky-500 hover:to-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add Subject</span>
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl text-xs flex items-center gap-2 animate-scale-in">
          <span>{error}</span>
        </div>
      )}

      {/* Subject Grid */}
      {subjects.length === 0 ? (
        <div className="bg-white/[0.01] border border-sky-500/10 rounded-3xl p-12 text-center text-sky-300/60 text-sm animate-fade-in-up">
          No syllabus catalog subjects configured for the selected filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects.map((sub, idx) => (
            <div
              key={sub._id}
              style={{ animationDelay: `${idx * 35}ms` }}
              className="glass-card rounded-2xl p-5 border border-sky-500/10 hover:border-sky-500/25 flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 animate-fade-in-up"
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <span className="text-[10px] font-mono font-bold text-sky-400 bg-sky-500/10 px-2.5 py-1 rounded-lg border border-sky-500/15">
                    {sub.code}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-sky-500/8 border border-sky-500/15 text-sky-300 px-2 py-0.5 rounded-md font-semibold">Sem {sub.semester}</span>
                    {sub.regulation && (
                      <span className="text-[10px] bg-sky-500/8 border border-sky-500/15 text-sky-300 px-2 py-0.5 rounded-md font-semibold">Reg {sub.regulation}</span>
                    )}
                  </div>
                </div>
                <h3 className="text-sm font-bold text-white mb-2 font-['Outfit'] leading-snug">{sub.name}</h3>
              </div>
              <div className="border-t border-sky-500/6 pt-3 mt-3 flex justify-between items-center">
                <div className="flex items-center gap-1 text-xs text-sky-300/60 font-semibold">
                  <Bookmark className="h-3.5 w-3.5" />
                  <span>{sub.credits} credits</span>
                </div>
                {canEditSubjects && (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => openEditModal(sub)} className="p-2 bg-sky-500/8 hover:bg-sky-500/20 rounded-xl text-sky-400 hover:text-white transition-all cursor-pointer" title="Edit">
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(sub._id)} className="p-2 bg-red-500/5 hover:bg-red-500/15 rounded-xl text-red-400 hover:text-white transition-all cursor-pointer" title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Single Add/Edit Modal ─────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-fade-in" onClick={() => setShowModal(false)} />
          {/* Modal card: max-h + flex-col so header/footer stay visible, body scrolls */}
          <div
            className="bg-[#071830] border border-sky-500/20 max-w-sm w-full rounded-t-2xl sm:rounded-2xl relative z-10 shadow-2xl animate-scale-in flex flex-col"
            style={{ maxHeight: '92dvh' }}
          >
            {/* Sticky Header */}
            <div className="flex items-center justify-between px-4 pt-3.5 pb-3 border-b border-sky-500/10 shrink-0">
              <h2 className="text-sm font-bold text-white flex items-center gap-2 font-['Outfit']">
                <BookOpen className="h-4 w-4 text-sky-400" />
                {editingSubject ? 'Edit Subject' : 'Add Subject'}
              </h2>
              <button type="button" onClick={() => setShowModal(false)} className="p-1.5 hover:bg-white/5 rounded-xl text-sky-300/50 hover:text-white transition-all cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
              {/* Scrollable body */}
              <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2.5">
                {/* Subject Code */}
                <div>
                  <label className="block text-[10px] font-bold text-sky-300 uppercase tracking-wider mb-1">Subject Code *</label>
                  <input type="text" required value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="e.g. CS3401" disabled={!canEditSubjects}
                    className="w-full bg-white/[0.03] border border-sky-500/20 focus:border-sky-500/60 rounded-lg px-3 py-1.5 text-xs text-white placeholder-sky-300/20 focus:outline-none transition-all disabled:opacity-40" />
                </div>
                {/* Subject Name */}
                <div>
                  <label className="block text-[10px] font-bold text-sky-300 uppercase tracking-wider mb-1">Subject Name *</label>
                  <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Database Management Systems" disabled={!canEditSubjects}
                    className="w-full bg-white/[0.03] border border-sky-500/20 focus:border-sky-500/60 rounded-lg px-3 py-1.5 text-xs text-white placeholder-sky-300/20 focus:outline-none transition-all disabled:opacity-60" />
                </div>
                {/* Credits + Semester + Regulation — single compact row */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-sky-300 uppercase tracking-wider mb-1">Credits *</label>
                    <input type="number" required min="0" max="10" value={credits} onChange={e => setCredits(Number(e.target.value))} disabled={!canEditSubjects}
                      className="w-full bg-white/[0.03] border border-sky-500/20 focus:border-sky-500/60 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none transition-all disabled:opacity-60" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-sky-300 uppercase tracking-wider mb-1">Semester</label>
                    <select value={semester} onChange={e => setSemester(Number(e.target.value))} disabled={!canEditSubjects}
                      className="w-full bg-[#071830] border border-sky-500/20 focus:border-sky-500/60 rounded-lg px-1.5 py-1.5 text-xs text-white focus:outline-none disabled:opacity-60">
                      {[...Array(8)].map((_, i) => <option key={i+1} value={i+1}>Sem {i+1}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-sky-300 uppercase tracking-wider mb-1">Regulation</label>
                    <select value={regulation} onChange={e => setRegulation(e.target.value)} disabled={!canEditSubjects}
                      className="w-full bg-[#071830] border border-sky-500/20 focus:border-sky-500/60 rounded-lg px-1.5 py-1.5 text-xs text-white focus:outline-none disabled:opacity-60">
                      {(() => {
                        const opts = [...regulations];
                        if (regulation && !opts.includes(regulation)) opts.push(regulation);
                        return opts.map(r => <option key={r} value={r}>{r}</option>);
                      })()}
                    </select>
                  </div>
                </div>
                {/* Department */}
                <div>
                  <label className="block text-[10px] font-bold text-sky-300 uppercase tracking-wider mb-1">Department</label>
                  {currentUser?.role === 'super_admin' ? (
                    <select value={department} onChange={e => setDepartment(e.target.value)}
                      className="w-full bg-[#071830] border border-sky-500/20 focus:border-sky-500/60 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none truncate">
                      {departments.map(d => <option key={d._id} value={d.code}>{d.name}</option>)}
                    </select>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.02] border border-sky-500/10 rounded-lg text-xs text-sky-300/60">
                      <Building className="h-3 w-3 text-sky-400/50 shrink-0" />
                      <span>{departments.find(d => d.code === department)?.name || department}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="flex justify-end gap-2.5 px-4 py-3 border-t border-sky-500/10 shrink-0">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-1.5 border border-sky-500/20 hover:bg-white/5 text-xs text-sky-300 rounded-lg transition-all cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={submitting || !canEditSubjects}
                  className="px-5 py-1.5 bg-sky-500 hover:bg-sky-400 text-xs text-white font-bold rounded-lg transition-all shadow-md disabled:opacity-50 cursor-pointer">
                  {submitting ? 'Saving...' : 'Save Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Bulk Upload Modal ─────────────────────────────────────────────── */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-3">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => { if (!bulkUploading) setShowBulkModal(false); }} />
          <div className="bg-[#071830] border border-emerald-500/20 max-w-xl w-full rounded-t-2xl sm:rounded-2xl p-4 relative z-10 shadow-2xl animate-scale-in flex flex-col" style={{maxHeight: '92dvh', overflowY: 'auto'}}>

            {/* Header */}
            <div className="flex items-center justify-between mb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <Upload className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white font-['Outfit']">Bulk Upload Subjects</h2>
                  <p className="text-[10px] text-sky-300/50">Import from Excel (.xlsx/.xls/.csv) or PDF</p>
                </div>
              </div>
              <button onClick={() => { if (!bulkUploading) setShowBulkModal(false); }} className="p-1.5 hover:bg-white/5 rounded-xl text-sky-300/50 hover:text-white transition-all cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Format hint — compact single line */}
            <div className="bg-sky-500/5 border border-sky-500/15 rounded-xl px-3 py-2 flex items-center gap-2 mb-3 shrink-0">
              <Info className="h-3.5 w-3.5 text-sky-400 shrink-0" />
              <p className="text-[10px] text-sky-300/70 flex-1">
                <span className="font-semibold text-sky-300">Excel/CSV columns:</span>{' '}
                <span className="font-mono text-white/80">Code · Name · Credits · Semester · Regulation</span>
                <span className="text-sky-300/40"> (optional) </span>
                <span className="font-semibold text-sky-300 ml-1">PDF:</span> table with Code, Name, Semester headers
              </p>
              <button onClick={downloadTemplate} className="text-emerald-400 hover:text-emerald-300 text-[10px] underline underline-offset-2 cursor-pointer whitespace-nowrap shrink-0">↓ Template</button>
            </div>

            {/* Drop Zone — compact */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl py-4 px-4 text-center cursor-pointer transition-all duration-200 mb-3 shrink-0 ${dragOver ? 'border-emerald-400 bg-emerald-500/10' : bulkFile ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-sky-500/20 hover:border-sky-500/40 hover:bg-sky-500/5'}`}
            >
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,.pdf" className="hidden" onChange={e => { if (e.target.files?.[0]) setBulkFile(e.target.files[0]); }} />
              {bulkFile ? (
                <div className="flex items-center justify-center gap-3">
                  {getFileIcon(bulkFile)}
                  <div className="text-left">
                    <p className="text-xs font-semibold text-white">{bulkFile.name}</p>
                    <p className="text-[10px] text-sky-300/50">{(bulkFile.size / 1024).toFixed(1)} KB · Click to change</p>
                  </div>
                  <button type="button" onClick={e => { e.stopPropagation(); setBulkFile(null); setBulkResult(null); setBulkError(null); }} className="ml-2 text-red-400 hover:text-red-300 text-[10px] underline cursor-pointer">Remove</button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3 pointer-events-none">
                  <div className="flex gap-2">
                    <FileSpreadsheet className="h-6 w-6 text-emerald-400/60" />
                    <FileText className="h-6 w-6 text-red-400/60" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-sky-300/70 font-medium">Drop your file here or <span className="text-sky-400">browse</span></p>
                    <p className="text-[10px] text-sky-300/40">.xlsx · .xls · .csv · .pdf — max 10 MB</p>
                  </div>
                </div>
              )}
            </div>

            {/* Options — all in one row */}
            <div className="grid grid-cols-4 gap-2 mb-3 shrink-0">
              {/* Department */}
              <div className="col-span-2">
                <label className="block text-[9px] font-bold text-sky-300 uppercase tracking-wider mb-1">Department</label>
                <select value={bulkDept} onChange={e => setBulkDept(e.target.value)} disabled={currentUser?.role === 'dept_admin' || currentUser?.role === 'staff'} className="w-full bg-[#071830] border border-sky-500/20 focus:border-sky-500 rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none disabled:opacity-50">
                  {departments
                    .filter(d => currentUser?.role === 'super_admin' || d.code === currentUser?.department)
                    .map(d => <option key={d._id} value={d.code}>{d.name}</option>)}
                </select>
              </div>

              {/* Regulation */}
              <div>
                <label className="block text-[9px] font-bold text-sky-300 uppercase tracking-wider mb-1">Regulation</label>
                <select value={bulkReg} onChange={e => setBulkReg(e.target.value)} className="w-full bg-[#071830] border border-sky-500/20 focus:border-sky-500 rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none">
                  <option value="">From file</option>
                  {regulations.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {/* Semester */}
              <div>
                <label className="block text-[9px] font-bold text-sky-300 uppercase tracking-wider mb-1">Semester</label>
                <select value={bulkSem} onChange={e => setBulkSem(e.target.value ? Number(e.target.value) : '')} className="w-full bg-[#071830] border border-sky-500/20 focus:border-sky-500 rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none">
                  <option value="">From file</option>
                  {[...Array(8)].map((_, i) => <option key={i+1} value={i+1}>Sem {i+1}</option>)}
                </select>
              </div>
            </div>

            {/* Skip duplicates toggle */}
            <div className="flex items-center gap-2.5 mb-3 shrink-0">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div className="relative">
                  <input type="checkbox" checked={bulkSkip} onChange={e => setBulkSkip(e.target.checked)} className="sr-only" />
                  <div className={`w-8 h-4 rounded-full transition-colors duration-200 ${bulkSkip ? 'bg-emerald-500' : 'bg-sky-500/20 border border-sky-500/30'}`} />
                  <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform duration-200 ${bulkSkip ? 'translate-x-4' : ''}`} />
                </div>
                <span className="text-[11px] text-sky-300/80 font-medium">Skip duplicates</span>
              </label>
              <span className="text-[10px] text-sky-300/40">{bulkSkip ? '(existing codes will be skipped)' : '(existing codes will be updated)'}</span>
            </div>

            {/* Error */}
            {bulkError && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-2 rounded-xl text-[11px] mb-3 shrink-0">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{bulkError}</span>
              </div>
            )}

            {/* Result */}
            {bulkResult && (
              <div className="mb-3 shrink-0 animate-fade-in-up">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-400">Upload Complete</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-emerald-500/10 rounded-lg py-2">
                      <div className="text-lg font-black text-emerald-400">{bulkResult.added}</div>
                      <div className="text-[9px] text-emerald-400/70 font-medium">Added</div>
                    </div>
                    <div className="bg-amber-500/10 rounded-lg py-2">
                      <div className="text-lg font-black text-amber-400">{bulkResult.skipped}</div>
                      <div className="text-[9px] text-amber-400/70 font-medium">Skipped</div>
                    </div>
                    <div className="bg-red-500/10 rounded-lg py-2">
                      <div className="text-lg font-black text-red-400">{bulkResult.errors.length}</div>
                      <div className="text-[9px] text-red-400/70 font-medium">Errors</div>
                    </div>
                  </div>
                  {bulkResult.errors.length > 0 && (
                    <div className="mt-2 max-h-20 overflow-y-auto">
                      {bulkResult.errors.map((e, i) => (
                        <p key={i} className="text-[10px] text-red-400/80"><span className="font-mono text-red-400">{e.code}</span>: {e.reason}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-3 border-t border-sky-500/10 shrink-0">
              <button type="button" onClick={() => { if (!bulkUploading) setShowBulkModal(false); }} className="px-4 py-2 border border-sky-500/20 hover:bg-white/5 text-xs text-sky-300 rounded-xl transition-all cursor-pointer">
                {bulkResult ? 'Close' : 'Cancel'}
              </button>
              {!bulkResult && (
                <button
                  onClick={handleBulkUpload}
                  disabled={bulkUploading || !bulkFile}
                  className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-xs text-white font-bold rounded-xl transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
                >
                  {bulkUploading ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing...</>
                  ) : (
                    <><Upload className="h-3.5 w-3.5" /> Upload & Import</>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

