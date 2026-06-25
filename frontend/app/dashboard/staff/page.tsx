'use client';

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Loader2, 
  Mail, 
  Building, 
  User, 
  KeyRound, 
  ShieldCheck,
  Check,
  X
} from 'lucide-react';
import { api, User as UserType, Department } from '@/lib/api';

export default function StaffManagement() {
  const [staffList, setStaffList] = useState<UserType[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<UserType | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'staff' | 'dept_admin'>('staff');
  const [department, setDepartment] = useState('IT');
  const [permissions, setPermissions] = useState<string[]>([]);
  
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const u = api.getCurrentUser();
      if (!u || u.role === 'staff') {
        navigate('/dashboard');
        return;
      }
      setCurrentUser(u);

      const [list, depts] = await Promise.all([
        api.getStaff(),
        api.getPublicDepartments()
      ]);
      setStaffList(list);
      setDepartments(depts);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch staff data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingStaff(null);
    setName('');
    setEmail('');
    setPassword('');
    setRole('staff');
    setDepartment(currentUser?.department || 'IT');
    setPermissions([]);
    setShowModal(true);
  };

  const openEditModal = (staff: UserType) => {
    setEditingStaff(staff);
    setName(staff.name);
    setEmail(staff.email);
    setPassword(''); // leave blank for no password update
    setRole(staff.role as any);
    setDepartment(staff.department);
    setPermissions(staff.permissions || []);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload: any = { name, email, role, department, permissions };
    if (password) payload.password = password;

    try {
      if (editingStaff) {
        await api.updateStaff(editingStaff._id, payload);
      } else {
        if (!password) {
          setError('Password is required for new accounts.');
          setSubmitting(false);
          return;
        }
        await api.createStaff(payload);
      }
      setShowModal(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this staff member? This action cannot be undone.')) return;

    try {
      await api.deleteStaff(id);
      loadData();
    } catch (err: any) {
      alert('Failed to delete staff member.');
    }
  };

  const toggleStatus = async (staff: UserType) => {
    const nextStatus = staff.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await api.updateStaff(staff._id, { ...staff, status: nextStatus });
      loadData();
    } catch (err: any) {
      alert('Failed to update staff status.');
    }
  };

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-sky-300">
        <Loader2 className="h-10 w-10 animate-spin text-sky-500 mb-3" />
        <p className="text-sm">Fetching faculty catalog...</p>
      </div>
    );
  }

  const roleLabels: { [key: string]: string } = {
    super_admin: 'Super Admin',
    dept_admin: 'Dept HOD',
    staff: 'Lecturer'
  };

  return (
    <div className="space-y-6">
      {/* Header Area */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pb-4 border-b border-sky-500/10">
        <div>
          <p className="text-xs text-sky-300">
            {currentUser?.role === 'super_admin' 
              ? 'Manage faculty lists, reset credentials, and assign administrative HOD boundaries.'
              : `Manage staff rosters inside the Department of ${currentUser?.department}.`
            }
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-500 to-purple-650 hover:from-sky-500 hover:to-purple-750 text-white rounded-xl text-xs font-bold transition-all shadow-md w-full sm:w-auto shrink-0"
        >
          <Plus className="h-4 w-4" /> Add Staff Member
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl text-xs">
          {error}
        </div>
      )}

      {/* Staff Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {staffList.map((staff) => (
          <div 
            key={staff._id}
            className={`bg-white/[0.01] border rounded-3xl p-6 backdrop-blur-xl transition-all duration-300 flex flex-col justify-between ${
              staff.status === 'Active' ? 'border-sky-500/15 hover:border-sky-500/25' : 'border-red-500/15 opacity-60'
            }`}
          >
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border uppercase tracking-wider ${
                  staff.role === 'dept_admin' 
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' 
                    : 'bg-sky-500/10 border-sky-500/20 text-sky-300'
                }`}>
                  {roleLabels[staff.role]}
                </span>
                
                <div className="flex items-center gap-2">
                  {staff._id !== currentUser?._id && (
                    <button 
                      onClick={() => openEditModal(staff)}
                      className="p-2 bg-sky-500/5 hover:bg-sky-500/20 border border-sky-500/10 hover:border-sky-500/30 rounded-xl text-sky-300 hover:text-white transition-all cursor-pointer"
                      title="Edit Member Details"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {staff.role !== 'super_admin' && staff._id !== currentUser?._id && (
                    <>
                      <button 
                        onClick={() => toggleStatus(staff)}
                        className={`p-2 border rounded-xl transition-all cursor-pointer ${
                          staff.status === 'Active' 
                            ? 'bg-red-500/5 hover:bg-red-500/25 border-red-500/10 hover:border-red-500/30 text-red-400' 
                            : 'bg-emerald-500/5 hover:bg-emerald-500/25 border-emerald-500/10 hover:border-emerald-500/30 text-emerald-400'
                        }`}
                        title={staff.status === 'Active' ? 'Deactivate Account' : 'Activate Account'}
                      >
                        {staff.status === 'Active' ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                      </button>
                      <button 
                        onClick={() => handleDelete(staff._id)}
                        className="p-2 bg-red-500/5 hover:bg-red-500/25 border border-red-500/10 hover:border-red-500/30 rounded-xl text-red-400 hover:text-red-300 transition-all cursor-pointer"
                        title="Delete Account"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <h3 className="text-base font-bold text-white mb-1">{staff.name}</h3>
              <p className="text-xs text-sky-200/50 flex items-center gap-1.5 mb-3">
                <Mail className="h-3.5 w-3.5 text-sky-400" />
                <span>{staff.email}</span>
              </p>
              {staff.permissions && staff.permissions.length > 0 ? (
                <div className="flex flex-wrap gap-1 mb-4">
                  {staff.permissions.map(p => {
                    const getFriendlyPermission = (perm: string) => {
                      if (perm === 'DEPT_FULL_ACCESS' || perm === 'DEPARTMENT_FULL_ACCESS' || perm === 'DEPT_ACCESS') {
                        return 'DEPT ACCESS';
                      }
                      return perm.replace(/_/g, ' ');
                    };
                    return (
                      <span key={p} className="text-[9px] font-semibold bg-sky-500/10 text-sky-300 px-2 py-0.5 rounded border border-sky-500/10 uppercase">
                        {getFriendlyPermission(p)}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[10px] text-sky-300/30 italic mb-4">No specific permissions assigned</p>
              )}
            </div>

            {staff.role !== 'super_admin' && (
              <div className="pt-4 border-t border-sky-500/10 flex items-center justify-between text-xs text-sky-200/75">
                <span className="flex items-center gap-1.5">
                  <Building className="h-4 w-4 text-sky-400" />
                  <span>Dept: <span className="font-semibold text-white">{staff.department}</span></span>
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal Dialog */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
          <div className="bg-[#071830] border border-sky-500/20 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl relative z-10 flex flex-col max-h-[92dvh] sm:max-h-[calc(100dvh-3rem)]">

            {/* Sticky Header */}
            <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-sky-500/10">
              <h2 className="text-sm font-black text-white">
                {editingStaff ? 'Edit Staff Details' : 'Register Staff Member'}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg bg-sky-500/5 hover:bg-sky-500/15 border border-sky-500/10 text-sky-400 hover:text-white transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4" style={{ overscrollBehavior: 'contain' }}>

                <div>
                  <label className="block text-[10px] font-bold text-sky-300 uppercase tracking-wider mb-1.5">Staff Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Full Name"
                    className="w-full bg-white/[0.04] border border-sky-500/20 focus:border-sky-500 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none placeholder:text-sky-300/25 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-sky-300 uppercase tracking-wider mb-1.5">Academic Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    disabled={!!editingStaff && currentUser?.role !== 'super_admin'}
                    placeholder="Academic Email"
                    className="w-full bg-white/[0.04] border border-sky-500/20 focus:border-sky-500 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none placeholder:text-sky-300/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-sky-300 uppercase tracking-wider mb-1.5">
                    {editingStaff ? 'Reset Password (blank = keep current)' : 'Account Password'}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-sky-400 pointer-events-none">
                      <KeyRound className="h-3.5 w-3.5" />
                    </span>
                    <input
                      type="password"
                      required={!editingStaff}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      disabled={!!editingStaff && currentUser?.role !== 'super_admin'}
                      placeholder={editingStaff ? (currentUser?.role === 'super_admin' ? 'New password (optional)' : 'Reset disabled') : 'Password'}
                      className="w-full bg-white/[0.04] border border-sky-500/20 focus:border-sky-500 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none placeholder:text-sky-300/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-sky-300 uppercase tracking-wider mb-1.5">Role</label>
                    <select
                      value={role}
                      disabled={currentUser?.role === 'dept_admin' || currentUser?.role === 'staff'}
                      onChange={e => setRole(e.target.value as any)}
                      className="w-full bg-white/[0.04] border border-sky-500/20 focus:border-sky-500 rounded-xl px-2 py-2.5 text-sm text-white focus:outline-none disabled:opacity-50 transition-colors"
                    >
                      <option value="staff">Lecturer / Staff</option>
                      <option value="dept_admin">Department HOD</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-sky-300 uppercase tracking-wider mb-1.5">Department</label>
                    <select
                      value={department}
                      disabled={currentUser?.role === 'dept_admin' || currentUser?.role === 'staff'}
                      onChange={e => setDepartment(e.target.value)}
                      className="w-full bg-white/[0.04] border border-sky-500/20 focus:border-sky-500 rounded-xl px-2 py-2.5 text-sm text-white focus:outline-none disabled:opacity-50 transition-colors"
                    >
                      <option value="">None (Super Admin)</option>
                      {departments.map(d => (
                        <option key={d._id} value={d.code}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-sky-300 uppercase tracking-wider mb-1.5">Assign Permission Role</label>
                  <div className="bg-white/[0.02] border border-sky-500/10 rounded-xl p-3 space-y-1">
                    <p className="text-[9px] text-sky-300/40 mb-2">Select one or more permission levels for this staff member:</p>
                    {[
                      { key: 'FULL_ACCESS', label: 'Full Access (System Wide)', desc: 'All powers across all departments', color: 'text-blue-300' },
                      { key: 'DEPT_ACCESS', label: 'Department Access', desc: 'Can do everything in their department only', color: 'text-sky-300' },
                      { key: 'READ_ONLY', label: 'Read Only', desc: 'Can view records only — no edits or saves', color: 'text-amber-300' },
                      { key: 'EDIT_SUBJECT_CATALOGUE', label: 'Edit Subject Catalogue', desc: 'Can add/edit/delete subjects in the catalog', color: 'text-emerald-300' }
                    ].filter(p => {
                      if (p.key === 'FULL_ACCESS') {
                        return role !== 'dept_admin' && role !== 'staff';
                      }
                      return true;
                    }).map(p => {
                      const checked = permissions.includes(p.key);
                      return (
                        <label key={p.key} className="flex items-start gap-3 cursor-pointer hover:bg-sky-500/[0.05] p-2 rounded-lg transition-colors select-none">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={e => {
                              if (e.target.checked) {
                               setPermissions([...permissions, p.key]);
                              } else {
                                setPermissions(permissions.filter(x => x !== p.key));
                              }
                            }}
                            className="mt-0.5 w-4 h-4 accent-sky-500 shrink-0"
                          />
                          <div>
                            <span className={`text-xs font-bold ${p.color}`}>{p.label}</span>
                            <p className="text-[10px] text-sky-300/40 mt-0.5 leading-relaxed">{p.desc}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs">
                    {error}
                  </div>
                )}
              </div>

              {/* Sticky Footer Buttons */}
              <div className="shrink-0 flex justify-end gap-3 px-5 py-4 border-t border-sky-500/10 bg-[#071830]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 border border-sky-500/20 hover:bg-white/5 text-sm text-sky-300 rounded-xl transition-all font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-sm text-white font-bold rounded-xl transition-all shadow-lg shadow-sky-500/20 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {submitting ? 'Saving...' : 'Save Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
