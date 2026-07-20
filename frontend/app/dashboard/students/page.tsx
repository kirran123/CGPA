'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Upload,
  Search,
  RefreshCw,
  Edit,
  Trash2,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
  Building,
  GraduationCap
} from 'lucide-react';
import { api, Department, Student } from '@/lib/api';
import { canEditRecords as canEditRecordsFn } from '@/lib/permissions';
import * as XLSX from 'xlsx';

/* ─── Excel Template Generator for Student Roster ───────────────────────── */
function downloadStudentTemplate() {
  const rows = [
    { RegNo: '953621104001', Name: 'Abinesh S', Department: 'IT', Batch: '2021-2025', Regulation: 'R2021' },
    { RegNo: '953621104002', Name: 'Bhuvanesh R', Department: 'IT', Batch: '2021-2025', Regulation: 'R2021' },
    { RegNo: '953621104003', Name: 'Deepak Kumar K', Department: 'IT', Batch: '2021-2025', Regulation: 'R2021' },
  ];

  const ws = XLSX.utils.json_to_sheet(rows);

  // Force RegNo column to text type so Excel doesn't format long numbers scientifically
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
    if (cell) { cell.t = 's'; cell.z = '@'; }
  }

  ws['!cols'] = [{ wch: 18 }, { wch: 22 }, { wch: 12 }, { wch: 14 }, { wch: 12 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Student Roster');
  XLSX.writeFile(wb, 'student_roster_template.xlsx');
}

export default function StudentManagementPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [regulations, setRegulations] = useState<string[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [batches, setBatches] = useState<{ batch: string; count: number }[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Add/Edit Form state
  const [formName, setFormName] = useState('');
  const [formRegNo, setFormRegNo] = useState('');
  const [formDept, setFormDept] = useState('');
  const [formBatch, setFormBatch] = useState('');
  const [formReg, setFormReg] = useState('R2021');
  const [submitting, setSubmitting] = useState(false);

  // Bulk upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadBatch, setUploadBatch] = useState('');
  const [uploadDept, setUploadDept] = useState('');
  const [uploadReg, setUploadReg] = useState('R2021');
  const [uploading, setUploading] = useState(false);

  const canEdit = canEditRecordsFn();

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const u = api.getCurrentUser();
      setCurrentUser(u);

      const depts = await api.getPublicDepartments();
      setDepartments(depts);

      const regs = await api.getRegulations();
      const regNames = regs.map((r: any) => r.name);
      setRegulations(regNames);
      if (regNames.length > 0) {
        setFormReg(regNames[0]);
        setUploadReg(regNames[0]);
      }

      const userDept = u?.role !== 'super_admin' ? u?.department || '' : '';
      const activeDept = userDept || selectedDept;
      if (userDept && selectedDept !== userDept) {
        setSelectedDept(userDept);
      }

      const fetchedStudents = await api.getStudents(
        activeDept || undefined,
        selectedBatch || undefined,
        searchQuery || undefined
      );
      setStudents(fetchedStudents);

      const fetchedBatches = await api.getStudentBatches(activeDept || undefined);
      setBatches(fetchedBatches);
    } catch (err: any) {
      setError(err.message || 'Failed to load student roster.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDept, selectedBatch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleOpenAdd = () => {
    setFormName('');
    setFormRegNo('');
    const defaultDept = currentUser?.role !== 'super_admin'
      ? currentUser?.department || 'IT'
      : (selectedDept || (departments.length > 0 ? departments[0].code : 'IT'));
    setFormDept(defaultDept);
    setFormBatch(selectedBatch || '2021-2025');
    if (regulations.length > 0) setFormReg(regulations[0]);
    setShowAddModal(true);
  };

  const handleOpenEdit = (student: Student) => {
    setEditingStudent(student);
    setFormName(student.name);
    setFormRegNo(student.registerNo);
    setFormDept(student.department);
    setFormBatch(student.batch);
    setFormReg(student.regulation || 'R2021');
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formRegNo.trim() || !formDept.trim() || !formBatch.trim()) {
      alert('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingStudent) {
        await api.updateStudent(editingStudent._id, {
          name: formName,
          registerNo: formRegNo,
          department: formDept,
          batch: formBatch,
          regulation: formReg
        });
        setSuccessMsg(`Updated details for ${formName} (${formRegNo})`);
        setEditingStudent(null);
      } else {
        await api.createStudent({
          name: formName,
          registerNo: formRegNo,
          department: formDept,
          batch: formBatch,
          regulation: formReg
        });
        setSuccessMsg(`Added student ${formName} (${formRegNo}) to Batch ${formBatch}`);
        setShowAddModal(false);
      }
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save student.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStudent = async (id: string, name: string, regNo: string) => {
    if (!window.confirm(`Are you sure you want to delete student "${name}" (${regNo})?`)) return;

    try {
      await api.deleteStudent(id);
      setSuccessMsg(`Deleted student record for ${name}`);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete student.');
    }
  };

  const handleBulkUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      alert('Please select an Excel (.xlsx / .csv) file.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('department', uploadDept || selectedDept || 'IT');
      formData.append('batch', uploadBatch || '2021-2025');
      formData.append('regulation', uploadReg || 'R2021');

      const result = await api.bulkUploadStudents(formData);
      setSuccessMsg(`Bulk upload complete! Processed ${result.count || 0} student records.`);
      setShowUploadModal(false);
      setUploadFile(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Bulk upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sky-500/10">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2 font-['Outfit']">
            <Users className="h-5 w-5 text-sky-400" />
            Students Management (Batch-wise Roster)
          </h1>
          <p className="text-xs text-sky-300/50 mt-1">
            Manage student register details by department and batch for GPA &amp; CGPA calculations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-2 border border-sky-500/15 hover:border-sky-500/35 bg-sky-500/5 hover:bg-sky-500/10 text-xs font-semibold text-sky-300 hover:text-white rounded-xl transition-all cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {canEdit && (
            <>
              <button
                onClick={downloadStudentTemplate}
                className="flex items-center gap-1.5 px-3.5 py-2 border border-emerald-500/20 hover:border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 text-xs font-semibold text-emerald-300 hover:text-white rounded-xl transition-all cursor-pointer"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Download Excel Template
              </button>

              <button
                onClick={() => {
                  setUploadDept(selectedDept || (departments[0]?.code || 'IT'));
                  setUploadBatch(selectedBatch || '2021-2025');
                  setShowUploadModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 hover:text-white text-xs font-semibold rounded-xl transition-all cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5" />
                Bulk Excel Upload
              </button>

              <button
                onClick={handleOpenAdd}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-sky-500/20 transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Add Single Student
              </button>
            </>
          )}
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

      {/* Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white/[0.02] border border-sky-500/10 p-4 rounded-2xl backdrop-blur-xl">
        {/* Department selector */}
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
            {departments.map((d) => (
              <option key={d._id} value={d.code}>{d.name} ({d.code})</option>
            ))}
          </select>
        </div>

        {/* Batch selector */}
        <div className="md:col-span-3">
          <label className="text-[10px] uppercase font-bold text-sky-300/40 tracking-wider block mb-1">
            Batch
          </label>
          <select
            value={selectedBatch}
            onChange={(e) => setSelectedBatch(e.target.value)}
            className="w-full bg-[#071830] border border-sky-500/18 focus:border-sky-500/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition-all"
          >
            <option value="">All Batches</option>
            {batches.map((b) => (
              <option key={b.batch} value={b.batch}>{b.batch} ({b.count} students)</option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="md:col-span-5">
          <label className="text-[10px] uppercase font-bold text-sky-300/40 tracking-wider block mb-1">
            Search Student
          </label>
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by Student Name or Register Number..."
              className="w-full bg-[#071830] border border-sky-500/18 focus:border-sky-500/50 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-sky-400/25 focus:outline-none transition-all"
            />
            <Search className="h-4 w-4 text-sky-400/40 absolute left-3 top-2.5 pointer-events-none" />
          </form>
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="h-60 flex flex-col items-center justify-center text-sky-300 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
          <p className="text-xs text-sky-300/50">Fetching student roster...</p>
        </div>
      ) : error ? (
        <div className="bg-red-500/8 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : students.length === 0 ? (
        <div className="bg-white/[0.02] border border-sky-500/10 rounded-2xl p-12 text-center">
          <Users className="h-10 w-10 text-sky-500/25 mx-auto mb-3" />
          <p className="text-sm font-semibold text-white">No students found</p>
          <p className="text-xs text-sky-300/40 mt-1 max-w-md mx-auto">
            No student details exist for the selected filters. Use the "Add Single Student" or "Bulk Excel Upload" options above to add students.
          </p>
        </div>
      ) : (
        <div className="bg-white/[0.02] border border-sky-500/10 rounded-2xl overflow-hidden backdrop-blur-xl">
          <div className="px-5 py-3 border-b border-sky-500/10 flex items-center justify-between">
            <span className="text-xs font-semibold text-sky-300">
              Showing {students.length} Students
            </span>
            {selectedBatch && (
              <span className="text-[10px] font-bold bg-sky-500/10 text-sky-300 px-2.5 py-0.5 rounded-lg border border-sky-500/20">
                Batch: {selectedBatch}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-sky-500/10 text-sky-300/40 font-bold uppercase tracking-wider text-[9px] bg-sky-500/[0.02]">
                  <th className="py-3 px-4">Register No</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Batch</th>
                  <th className="py-3 px-4">Regulation</th>
                  {canEdit && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {students.map((st, idx) => (
                  <tr
                    key={st._id}
                    className={`border-b border-sky-500/5 hover:bg-sky-500/[0.03] transition-colors ${
                      idx % 2 === 0 ? 'bg-white/[0.005]' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-sky-400">{st.registerNo}</td>
                    <td className="py-3 px-4 font-semibold text-white">{st.name}</td>
                    <td className="py-3 px-4">
                      <span className="bg-sky-500/10 border border-sky-500/15 text-sky-300 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold">
                        {st.department}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sky-200/70">{st.batch}</td>
                    <td className="py-3 px-4 text-amber-300/80 font-medium">{st.regulation || 'R2021'}</td>
                    {canEdit && (
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(st)}
                            className="p-1.5 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-300 rounded-lg transition-all"
                            title="Edit Student"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteStudent(st._id, st.name, st.registerNo)}
                            className="p-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg transition-all"
                            title="Delete Student"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Single Add / Edit Student Modal */}
      {(showAddModal || editingStudent) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#071830] border border-sky-500/20 rounded-2xl max-w-md w-full p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-sky-500/15">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-sky-400" />
                {editingStudent ? 'Edit Student Details' : 'Add Single Student'}
              </h3>
              <button
                onClick={() => { setShowAddModal(false); setEditingStudent(null); }}
                className="text-sky-400/60 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-3">
              <div className="form-group">
                <label className="form-label">Register Number</label>
                <input
                  type="text"
                  required
                  value={formRegNo}
                  onChange={(e) => setFormRegNo(e.target.value)}
                  placeholder="e.g. 953621104012"
                  className="w-full bg-[#040f24] border border-sky-500/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500/50"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Student Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Full Student Name"
                  className="w-full bg-[#040f24] border border-sky-500/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select
                    value={formDept}
                    disabled={currentUser?.role === 'dept_admin' || currentUser?.role === 'staff'}
                    onChange={(e) => setFormDept(e.target.value)}
                    className="w-full bg-[#040f24] border border-sky-500/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none disabled:opacity-50"
                  >
                    {departments
                      .filter((d) => currentUser?.role === 'super_admin' || d.code === currentUser?.department)
                      .map((d) => (
                        <option key={d._id} value={d.code}>{d.code}</option>
                      ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Batch</label>
                  <input
                    type="text"
                    required
                    value={formBatch}
                    onChange={(e) => setFormBatch(e.target.value)}
                    placeholder="e.g. 2021-2025"
                    className="w-full bg-[#040f24] border border-sky-500/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Regulation</label>
                <select
                  value={formReg}
                  onChange={(e) => setFormReg(e.target.value)}
                  className="w-full bg-[#040f24] border border-sky-500/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  {regulations.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-sky-500/15">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setEditingStudent(null); }}
                  className="px-4 py-2 text-xs font-semibold text-sky-300 hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{editingStudent ? 'Update Student' : 'Save Student'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Excel Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#071830] border border-sky-500/20 rounded-2xl max-w-lg w-full p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-sky-500/15">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                Bulk Student Excel Upload
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={downloadStudentTemplate}
                  className="flex items-center gap-1 text-[10px] font-bold text-emerald-300 hover:text-white bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                >
                  Download Template
                </button>
                <button onClick={() => setShowUploadModal(false)} className="text-sky-400/60 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <form onSubmit={handleBulkUploadSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="form-label">Target Dept</label>
                  <select
                    value={uploadDept}
                    disabled={currentUser?.role === 'dept_admin' || currentUser?.role === 'staff'}
                    onChange={(e) => setUploadDept(e.target.value)}
                    className="w-full bg-[#040f24] border border-sky-500/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none disabled:opacity-50"
                  >
                    {departments
                      .filter((d) => currentUser?.role === 'super_admin' || d.code === currentUser?.department)
                      .map((d) => (
                        <option key={d._id} value={d.code}>{d.code}</option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Batch Name</label>
                  <input
                    type="text"
                    required
                    value={uploadBatch}
                    onChange={(e) => setUploadBatch(e.target.value)}
                    placeholder="e.g. 2021-2025"
                    className="w-full bg-[#040f24] border border-sky-500/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="form-label">Regulation</label>
                  <select
                    value={uploadReg}
                    onChange={(e) => setUploadReg(e.target.value)}
                    className="w-full bg-[#040f24] border border-sky-500/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    {regulations.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Upload Drop Zone */}
              <div className="border-2 border-dashed border-sky-500/20 hover:border-sky-500/40 rounded-2xl p-6 text-center bg-sky-500/[0.02]">
                <FileSpreadsheet className="h-8 w-8 text-emerald-400/60 mx-auto mb-2" />
                <p className="text-xs text-white font-medium">Select Excel spreadsheet (.xlsx / .csv)</p>
                <p className="text-[10px] text-sky-300/40 mt-1">
                  Expected columns: <span className="font-mono text-sky-400">RegNo</span>, <span className="font-mono text-sky-400">Name</span>, <span className="font-mono text-sky-400">Department</span> (optional), <span className="font-mono text-sky-400">Batch</span> (optional)
                </p>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="mt-3 text-xs text-sky-300 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-500/10 file:text-emerald-300 cursor-pointer"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-sky-500/15">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-sky-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  <span>Start Excel Import</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
