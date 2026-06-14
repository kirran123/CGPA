'use client';

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building,
  Plus,
  Loader2,
  Mail,
  User,
  Users,
  GraduationCap,
  Shield,
  BarChart3,
  AlertCircle,
  X
} from 'lucide-react';
import { api, Department } from '@/lib/api';

interface DepartmentStat extends Department {
  students: number;
  staff: number;
  avgGpa: string;
}

export default function DepartmentManagement() {
  const [departments, setDepartments] = useState<DepartmentStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentStat | null>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [hodName, setHodName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  const loadData = async () => {
    setLoading(true);
    try {
      const u = api.getCurrentUser();
      if (!u || u.role !== 'super_admin') {
        navigate('/dashboard');
        return;
      }
      const data = await api.getDepartmentStats();
      setDepartments(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch departments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const openCreateModal = () => {
    setEditingDept(null);
    setName(''); setCode(''); setDescription(''); setHodName(''); setEmail(''); setStatus('Active');
    setShowModal(true);
  };

  const openEditModal = (dept: DepartmentStat) => {
    setEditingDept(dept);
    setName(dept.name); setCode(dept.code); setDescription(dept.description || '');
    setHodName(dept.hodName); setEmail(dept.email); setStatus(dept.status);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const payload = { name, code, description, hodName, email, status };
    try {
      if (editingDept) {
        await api.updateDepartment(editingDept._id, payload);
      } else {
        await api.createDepartment(payload);
      }
      setShowModal(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (dept: DepartmentStat) => {
    const nextStatus = dept.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await api.updateDepartment(dept._id, {
        name: dept.name,
        description: dept.description,
        hodName: dept.hodName,
        email: dept.email,
        status: nextStatus
      });
      loadData();
    } catch {
      alert('Failed to toggle department status');
    }
  };

  if (loading) {
    return (
      <div className="h-80 flex flex-col items-center justify-center text-sky-300 gap-3">
        <div className="relative">
          <div className="w-10 h-10 border-2 border-sky-500/20 rounded-full" />
          <div className="absolute inset-0 w-10 h-10 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-sm text-sky-300/50">Loading departments...</p>
      </div>
    );
  }

  const activeDepts = departments.filter(d => d.status === 'Active').length;
  const totalStudents = departments.reduce((s, d) => s + d.students, 0);
  const totalStaff = departments.reduce((s, d) => s + d.staff, 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Building className="h-5 w-5 text-sky-400" />
            Department Management
          </h1>
          <p className="text-sm text-sky-200/45 mt-0.5">
            Manage all academic departments at Ramco Institute of Technology.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white rounded-xl text-sm font-semibold transition-all duration-200 shadow-lg shadow-sky-500/20 hover:-translate-y-0.5 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Add Department
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Departments', value: departments.length, icon: <Building className="h-4 w-4 text-sky-400" />, color: 'text-sky-300', bg: 'bg-sky-500/8 border-sky-500/15' },
          { label: 'Total Students', value: totalStudents, icon: <GraduationCap className="h-4 w-4 text-emerald-400" />, color: 'text-emerald-300', bg: 'bg-emerald-500/8 border-emerald-500/15' },
          { label: 'Total Faculty', value: totalStaff, icon: <Users className="h-4 w-4 text-amber-400" />, color: 'text-amber-300', bg: 'bg-amber-500/8 border-amber-500/15' },
        ].map((s, i) => (
          <div key={i} className={`glass-card border ${s.bg} rounded-2xl p-4`}>
            <div className="flex items-center gap-2 mb-2">
              {s.icon}
              <span className="text-[11px] text-sky-300/50 font-medium">{s.label}</span>
            </div>
            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/8 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Department Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {departments.map((dept) => (
          <div
            key={dept._id}
            className={`glass-card rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 ${
              dept.status === 'Active'
                ? 'border-sky-500/12 hover:border-sky-500/25'
                : 'border-red-500/15 opacity-60'
            }`}
          >
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border uppercase tracking-wider ${
                    dept.status === 'Active'
                      ? 'bg-sky-500/10 border-sky-500/20 text-sky-300'
                      : 'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}>
                    {dept.code}
                  </span>
                  {dept.status === 'Active' ? (
                    <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-semibold">Active</span>
                  ) : (
                    <span className="text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-semibold">Inactive</span>
                  )}
                </div>
              </div>

              <h3 className="text-sm font-bold text-white mb-1 leading-snug">{dept.name}</h3>
              <p className="text-xs text-sky-200/40 leading-relaxed mb-4">
                {dept.description || 'Leading innovations and professional training for tomorrow\'s challenges.'}
              </p>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-sky-200/60">
                  <User className="h-3.5 w-3.5 text-sky-400/60" />
                  <span>HOD: <span className="font-semibold text-white">{dept.hodName}</span></span>
                </div>
                <div className="flex items-center gap-2 text-xs text-sky-200/60">
                  <Mail className="h-3.5 w-3.5 text-sky-400/60" />
                  <a href={`mailto:${dept.email}`} className="hover:text-white transition-colors truncate">{dept.email}</a>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-4 pt-4 border-t border-sky-500/8">
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Students', value: dept.students, color: 'text-sky-300' },
                  { label: 'Faculty', value: dept.staff, color: 'text-blue-300' },
                  { label: 'Avg GPA', value: dept.avgGpa === 'N/A' ? 'N/A' : parseFloat(dept.avgGpa).toFixed(2), color: 'text-emerald-400' },
                ].map((s, si) => (
                  <div key={si} className="bg-white/[0.02] rounded-xl py-2 border border-sky-500/5">
                    <div className={`text-sm font-black ${s.color}`}>{s.value}</div>
                    <div className="text-[9px] text-sky-300/35 mt-0.5 uppercase tracking-wider">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="bg-[#071830] border border-sky-500/20 w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl relative z-10 shadow-2xl shadow-black/50 flex flex-col max-h-[100dvh] sm:max-h-[calc(100dvh-3rem)]">

            {/* Sticky Header */}
            <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-sky-500/10">
              <div>
                <h2 className="text-sm font-bold text-white">
                  {editingDept ? 'Edit Department' : 'Add New Department'}
                </h2>
                <p className="text-[10px] text-sky-300/40 mt-0.5">
                  {editingDept ? 'Update department details' : 'Register a new academic department'}
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/5 rounded-xl text-sky-300/50 hover:text-white transition-all cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && (
              <div className="bg-red-500/8 border border-red-500/20 text-red-400 px-5 py-3 text-xs flex items-center gap-2 shrink-0">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4" style={{ overscrollBehavior: 'contain' }}>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-sky-300/60 uppercase tracking-wider mb-1.5">Department Name *</label>
                    <input
                      type="text" required value={name} onChange={e => setName(e.target.value)}
                      placeholder="e.g. Mechanical Engineering"
                      className="w-full bg-[#071830] border border-sky-500/20 focus:border-sky-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-sky-300/20 focus:outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-sky-300/60 uppercase tracking-wider mb-1.5">Code *</label>
                    <input
                      type="text" required disabled={!!editingDept} value={code} onChange={e => setCode(e.target.value.toUpperCase())}
                      placeholder="MECH"
                      className="w-full bg-[#071830] border border-sky-500/20 focus:border-sky-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-sky-300/20 focus:outline-none transition-all disabled:opacity-40"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-sky-300/60 uppercase tracking-wider mb-1.5">Description</label>
                  <textarea
                    value={description} onChange={e => setDescription(e.target.value)}
                    placeholder="Brief description of the department..."
                    rows={2}
                    className="w-full bg-[#071830] border border-sky-500/20 focus:border-sky-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-sky-300/20 focus:outline-none resize-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-sky-300/60 uppercase tracking-wider mb-1.5">HOD Name *</label>
                    <input
                      type="text" required value={hodName} onChange={e => setHodName(e.target.value)}
                      placeholder="Dr. Name"
                      className="w-full bg-[#071830] border border-sky-500/20 focus:border-sky-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-sky-300/20 focus:outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-sky-300/60 uppercase tracking-wider mb-1.5">HOD Email *</label>
                    <input
                      type="email" required value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="hod@rit.edu.in"
                      className="w-full bg-[#071830] border border-sky-500/20 focus:border-sky-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-sky-300/20 focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-sky-300/60 uppercase tracking-wider mb-1.5">Status</label>
                  <select
                    value={status} onChange={e => setStatus(e.target.value as any)}
                    className="w-full bg-[#071830] border border-sky-500/20 focus:border-sky-500/50 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Sticky footer */}
              <div className="shrink-0 flex justify-end gap-3 px-5 py-4 border-t border-sky-500/10 bg-[#071830]">
                <button
                  type="button" onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 border border-sky-500/20 hover:bg-white/5 text-sm text-sky-300 rounded-xl transition-all cursor-pointer font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={submitting}
                  className="px-6 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-sm text-white font-semibold rounded-xl transition-all shadow-lg shadow-sky-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {submitting ? 'Saving...' : editingDept ? 'Save Changes' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
