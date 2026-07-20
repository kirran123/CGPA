'use client';

import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Download,
  Search,
  RefreshCw,
  Edit,
  Trash2,
  FileText,
  AlertCircle,
  Loader2,
  CheckCircle,
  X,
  Filter
} from 'lucide-react';
import { api, Department, GpaRecord } from '@/lib/api';
import { canEditRecords as canEditRecordsFn } from '@/lib/permissions';

export default function GpaResultsPage() {
  const [records, setRecords] = useState<GpaRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedSem, setSelectedSem] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Downloading state
  const [downloadingRowId, setDownloadingRowId] = useState<string | null>(null);
  const [downloadingOverall, setDownloadingOverall] = useState(false);

  // Editing state
  const [editingRecord, setEditingRecord] = useState<GpaRecord | null>(null);
  const [editName, setEditName] = useState('');
  const [editRegNo, setEditRegNo] = useState('');
  const [editGpa, setEditGpa] = useState<number>(0);
  const [editSem, setEditSem] = useState<number>(1);
  const [savingEdit, setSavingEdit] = useState(false);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const canEdit = canEditRecordsFn();

  const [students, setStudents] = useState<any[]>([]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const u = api.getCurrentUser();
      setCurrentUser(u);

      const depts = await api.getPublicDepartments();
      setDepartments(depts);

      const initialDept = u?.role !== 'super_admin' ? u?.department || '' : selectedDept;
      if (initialDept && !selectedDept) setSelectedDept(initialDept);

      const activeDept = initialDept || selectedDept || undefined;
      const semNum = selectedSem ? parseInt(selectedSem) : undefined;

      const [fetchedRecords, fetchedStudents] = await Promise.all([
        api.getGpaRecords(activeDept, semNum),
        api.getStudents(activeDept)
      ]);

      setRecords(fetchedRecords);
      setStudents(fetchedStudents);
    } catch (err: any) {
      setError(err.message || 'Failed to load GPA results.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDept, selectedSem]);

  const studentRows = React.useMemo(() => {
    const map = new Map<string, {
      registerNo: string;
      studentName: string;
      department: string;
      semesters: { [sem: number]: { gpa: number; id: string; record: GpaRecord } };
    }>();

    // 1. Initialize with students from Student Management
    for (const st of students) {
      const key = st.registerNo.trim().toUpperCase();
      map.set(key, {
        registerNo: st.registerNo,
        studentName: st.name,
        department: st.department.toUpperCase(),
        semesters: {}
      });
    }

    // 2. Map calculated GPA records
    for (const r of records) {
      const key = r.registerNo.trim().toUpperCase();
      let row = map.get(key);
      if (!row) {
        row = {
          registerNo: r.registerNo,
          studentName: r.studentName,
          department: r.department.toUpperCase(),
          semesters: {}
        };
        map.set(key, row);
      }
      row.semesters[r.semester] = { gpa: r.gpa, id: r._id, record: r };
    }

    let rowsList = Array.from(map.values());

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      rowsList = rowsList.filter(
        (r) =>
          r.studentName.toLowerCase().includes(q) ||
          r.registerNo.toLowerCase().includes(q)
      );
    }

    if (selectedSem) {
      const sNum = parseInt(selectedSem);
      rowsList = rowsList.filter((r) => r.semesters[sNum] !== undefined);
    }

    return rowsList.sort((a, b) => a.registerNo.localeCompare(b.registerNo));
  }, [students, records, searchQuery, selectedSem]);

  const handleDownloadRowPdf = async (recordId: string, regNo: string, sem: number) => {
    setDownloadingRowId(recordId);
    try {
      const blob = await api.downloadGpaReportPdf(recordId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GPA_Sem${sem}_${regNo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Failed to download GPA report PDF.');
    } finally {
      setDownloadingRowId(null);
    }
  };

  const handleDownloadOverallPdf = async () => {
    setDownloadingOverall(true);
    try {
      const semNum = selectedSem ? parseInt(selectedSem) : undefined;
      const deptCode = selectedDept || (currentUser?.role !== 'super_admin' ? currentUser?.department : undefined);
      const blob = await api.downloadOverallSemesterGpaPdf(deptCode, semNum);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GPA_Overall_Report_${deptCode || 'All'}_${semNum ? `Sem${semNum}` : 'AllSem'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Failed to download overall GPA PDF.');
    } finally {
      setDownloadingOverall(false);
    }
  };

  const handleDeleteRow = async (id: string, name: string, regNo: string) => {
    if (!window.confirm(`Are you sure you want to delete the GPA record for "${name}" (${regNo})?`)) return;
    try {
      await api.deleteGpaRecord(id);
      setSuccessMsg(`Deleted GPA record for ${name}`);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete record.');
    }
  };

  const handleOpenEdit = (rec: GpaRecord) => {
    setEditingRecord(rec);
    setEditName(rec.studentName);
    setEditRegNo(rec.registerNo);
    setEditGpa(rec.gpa);
    setEditSem(rec.semester);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    setSavingEdit(true);
    try {
      await api.updateGpaRecord(editingRecord._id, {
        studentName: editName,
        registerNo: editRegNo,
        gpa: editGpa,
        semester: editSem
      });
      setSuccessMsg(`Updated GPA record for ${editName} (${editRegNo})`);
      setEditingRecord(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update record.');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sky-500/10">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2 font-['Outfit']">
            <GraduationCap className="h-5 w-5 text-sky-400" />
            GPA Results Directory
          </h1>
          <p className="text-xs text-sky-300/50 mt-1">
            All semester GPA results from single and bulk calculations with edit, delete, and PDF export options.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-2 border border-sky-500/15 hover:border-sky-500/35 bg-sky-500/5 hover:bg-sky-500/10 text-xs font-semibold text-sky-300 hover:text-white rounded-xl transition-all cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={handleDownloadOverallPdf}
            disabled={downloadingOverall || studentRows.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-sky-500/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {downloadingOverall ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            <span>Overall GPA PDF Report</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-2xl text-xs flex items-center justify-between animate-scale-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400/60 hover:text-emerald-400">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white/[0.02] border border-sky-500/10 p-4 rounded-2xl backdrop-blur-xl">
        <div className="md:col-span-4">
          <label className="text-[10px] uppercase font-bold text-sky-300/40 tracking-wider block mb-1">
            Department
          </label>
          <select
            value={selectedDept}
            disabled={currentUser?.role === 'dept_admin' || currentUser?.role === 'staff'}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-full bg-[#071830] border border-sky-500/18 focus:border-sky-500/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition-all disabled:opacity-50"
          >
            <option value="">All Departments</option>
            {departments
              .filter((d) => currentUser?.role === 'super_admin' || d.code === currentUser?.department)
              .map((d) => (
                <option key={d._id} value={d.code}>{d.name} ({d.code})</option>
              ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="text-[10px] uppercase font-bold text-sky-300/40 tracking-wider block mb-1">
            Semester Filter
          </label>
          <select
            value={selectedSem}
            onChange={(e) => setSelectedSem(e.target.value)}
            className="w-full bg-[#071830] border border-sky-500/18 focus:border-sky-500/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition-all"
          >
            <option value="">All Semesters (1 - 8)</option>
            {[...Array(8)].map((_, i) => (
              <option key={i + 1} value={i + 1}>Semester {i + 1}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-5">
          <label className="text-[10px] uppercase font-bold text-sky-300/40 tracking-wider block mb-1">
            Search Student
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student name or register number..."
              className="w-full bg-[#071830] border border-sky-500/18 focus:border-sky-500/50 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-sky-400/25 focus:outline-none transition-all"
            />
            <Search className="h-4 w-4 text-sky-400/40 absolute left-3 top-2.5 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="h-60 flex flex-col items-center justify-center text-sky-300 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
          <p className="text-xs text-sky-300/50">Fetching GPA results...</p>
        </div>
      ) : error ? (
        <div className="bg-red-500/8 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : studentRows.length === 0 ? (
        <div className="bg-white/[0.02] border border-sky-500/10 rounded-2xl p-12 text-center">
          <GraduationCap className="h-10 w-10 text-sky-500/25 mx-auto mb-3" />
          <p className="text-sm font-semibold text-white">No GPA records found</p>
          <p className="text-xs text-sky-300/40 mt-1 max-w-md mx-auto">
            Calculate GPA using individual or bulk GPA calculators to view student results here.
          </p>
        </div>
      ) : (
        <div className="bg-white/[0.02] border border-sky-500/10 rounded-2xl overflow-hidden backdrop-blur-xl">
          <div className="px-5 py-3 border-b border-sky-500/10 flex items-center justify-between">
            <span className="text-xs font-semibold text-sky-300">
              Showing {studentRows.length} Students
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[900px]">
              <thead>
                <tr className="border-b border-sky-500/10 text-sky-300/40 font-bold uppercase tracking-wider text-[9px] bg-sky-500/[0.02]">
                  <th className="py-3 px-4">Register No</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-3 text-center">Dept</th>
                  <th className="py-3 px-2 text-center">Sem 1</th>
                  <th className="py-3 px-2 text-center">Sem 2</th>
                  <th className="py-3 px-2 text-center">Sem 3</th>
                  <th className="py-3 px-2 text-center">Sem 4</th>
                  <th className="py-3 px-2 text-center">Sem 5</th>
                  <th className="py-3 px-2 text-center">Sem 6</th>
                  <th className="py-3 px-2 text-center">Sem 7</th>
                  <th className="py-3 px-2 text-center">Sem 8</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {studentRows.map((r, idx) => (
                  <tr
                    key={r.registerNo}
                    className={`border-b border-sky-500/5 hover:bg-sky-500/[0.03] transition-colors ${
                      idx % 2 === 0 ? 'bg-white/[0.005]' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-sky-400">{r.registerNo}</td>
                    <td className="py-3 px-4 font-semibold text-white">{r.studentName}</td>
                    <td className="py-3 px-3 text-center">
                      <span className="bg-sky-500/10 border border-sky-500/15 text-sky-300 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold">
                        {r.department}
                      </span>
                    </td>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((sNum) => {
                      const semInfo = r.semesters[sNum];
                      return (
                        <td key={sNum} className="py-3 px-2 text-center font-mono text-[11px]">
                          {semInfo ? (
                            <span className="text-sky-200/90 font-semibold">{semInfo.gpa.toFixed(2)}</span>
                          ) : (
                            <span className="text-sky-400/20">-</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {Object.values(r.semesters).length > 0 && (
                          <button
                            disabled={downloadingRowId === Object.values(r.semesters)[0].id}
                            onClick={() => handleDownloadRowPdf(Object.values(r.semesters)[0].id, r.registerNo, Object.values(r.semesters)[0].record.semester)}
                            className="flex items-center gap-1 text-[10px] font-bold text-sky-300 hover:text-white bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 px-2 py-1 rounded-xl transition-all cursor-pointer disabled:opacity-40"
                            title="Download GPA Report PDF"
                          >
                            {downloadingRowId === Object.values(r.semesters)[0].id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <FileText className="h-3 w-3" />
                            )}
                            <span>PDF</span>
                          </button>
                        )}

                        {canEdit && Object.values(r.semesters).length > 0 && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(Object.values(r.semesters)[0].record)}
                              className="p-1.5 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-300 rounded-xl transition-all cursor-pointer"
                              title="Edit GPA Record"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteRow(Object.values(r.semesters)[0].id, r.studentName, r.registerNo)}
                              className="p-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl transition-all cursor-pointer"
                              title="Delete Record"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#071830] border border-sky-500/20 rounded-2xl max-w-md w-full p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-sky-500/15">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit className="h-4 w-4 text-sky-400" /> Edit GPA Record
              </h3>
              <button onClick={() => setEditingRecord(null)} className="text-sky-400/60 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div className="form-group">
                <label className="form-label">Student Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#040f24] border border-sky-500/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Register Number</label>
                <input
                  type="text"
                  required
                  value={editRegNo}
                  onChange={(e) => setEditRegNo(e.target.value)}
                  className="w-full bg-[#040f24] border border-sky-500/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Semester</label>
                  <select
                    value={editSem}
                    onChange={(e) => setEditSem(Number(e.target.value))}
                    className="w-full bg-[#040f24] border border-sky-500/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    {[...Array(8)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>Semester {i + 1}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">GPA (0 - 10)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    required
                    value={editGpa}
                    onChange={(e) => setEditGpa(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#040f24] border border-sky-500/20 rounded-xl px-3 py-2 text-xs text-white text-center font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-sky-500/15">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 text-xs font-semibold text-sky-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingEdit && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Save Record</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
