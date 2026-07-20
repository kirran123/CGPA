'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Loader2, 
  Mail, 
  Building, 
  KeyRound, 
  Check,
  X,
  Search,
  ChevronDown,
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
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const navigate = useNavigate();

  // Filter staff list (search and department filter only active/shown for super_admin)
  const filteredStaff = useMemo(() => {
    let result = staffList;
    if (currentUser?.role === 'super_admin') {
      if (selectedDept) {
        result = result.filter(s => s.department === selectedDept);
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        result = result.filter(s =>
          s.name.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          (s.department || '').toLowerCase().includes(q)
        );
      }
    }
    return result;
  }, [staffList, search, selectedDept, currentUser?.role]);

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

        // If the logged-in user just updated their own profile, refresh the sidebar
        if (currentUser && editingStaff._id === currentUser._id) {
          const fresh = await api.refreshCurrentUser();
          if (fresh) {
            setCurrentUser(fresh);
            window.dispatchEvent(new Event('auth-change'));
          }
        }
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
              : `Manage staff members inside the Department of ${currentUser?.department}.`
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

      {/* Search + Dept Filter toolbar — super_admin only */}
      {currentUser?.role === 'super_admin' && (
        <div className="flex items-center gap-2">
          {/* Search input */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-sky-400/40 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or email…"
              className="w-full bg-white/[0.03] border border-sky-500/15 focus:border-sky-500/35 rounded-lg pl-7 pr-6 py-1.5 text-xs text-white focus:outline-none placeholder:text-sky-300/20 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-sky-400/40 hover:text-sky-300 transition-colors">
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </div>

          {/* Department filter */}
          <div className="relative">
            <select
              value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
              className="appearance-none bg-white/[0.03] border border-sky-500/15 focus:border-sky-500/35 rounded-lg pl-3 pr-7 py-1.5 text-xs text-white focus:outline-none transition-colors cursor-pointer"
            >
              <option value="">All Depts</option>
              {Array.from(new Set(staffList.map(s => s.department).filter(Boolean))).sort().map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-sky-400/40 pointer-events-none" />
          </div>

          {/* Active filter pills */}
          {(search || selectedDept) && (
            <button
              onClick={() => { setSearch(''); setSelectedDept(''); }}
              className="flex items-center gap-1 px-2 py-1.5 text-[10px] text-sky-300/50 hover:text-sky-300 border border-sky-500/10 hover:border-sky-500/25 rounded-lg transition-colors"
            >
              <X className="h-2.5 w-2.5" /> Clear
            </button>
          )}

          {/* Result count badge */}
          {(search || selectedDept) && (
            <span className="text-[10px] text-sky-300/40 shrink-0">
              {filteredStaff.length} of {staffList.length}
            </span>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl text-xs">
          {error}
        </div>
      )}

      {/* Staff Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStaff.map((staff) => (
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
                      if (perm === 'DEPT_FULL_ACCESS' || perm === 'DEPARTMENT_FULL_ACCESS' || perm === 'DEPT_ACCESS') return 'DEPT ACCESS';
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

        {/* No results from filter/search */}
        {filteredStaff.length === 0 && (search.trim() || selectedDept) && (
          <div className="col-span-3 py-16 flex flex-col items-center gap-2 text-sky-300/40">
            <Search className="h-8 w-8" />
            <p className="text-sm">No staff match the current filters</p>
            <button onClick={() => { setSearch(''); setSelectedDept(''); }} className="text-xs text-sky-400 hover:underline mt-1">Clear filters</button>
          </div>
        )}

        {/* No staff at all */}
        {staffList.length === 0 && !search.trim() && !selectedDept && (
          <div className="col-span-3 py-16 flex flex-col items-center gap-2 text-sky-300/30">
            <Users className="h-8 w-8" />
            <p className="text-sm font-medium">No staff members found</p>
            <p className="text-xs">Click &ldquo;+ Add Staff Member&rdquo; to get started.</p>
          </div>
        )}
      </div>

      {/* Modal Overlay */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowModal(false)} />

          <div
            className="relative z-10 w-full mx-4 max-w-md flex flex-col bg-[#071830] border border-sky-500/20 rounded-2xl shadow-2xl overflow-hidden"
            style={{ maxHeight: '90vh' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-sky-500/10 shrink-0">
              <h2 className="text-sm font-black text-white">
                {editingStaff ? 'Edit Staff Details' : 'Register Staff Member'}
              </h2>
              <button type="button" onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg bg-sky-500/5 hover:bg-sky-500/15 border border-sky-500/10 text-sky-400 hover:text-white transition-all">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">

                {/* Name */}
                <div>
                  <label className="block text-[10px] font-bold text-sky-300 uppercase tracking-wider mb-1">Staff Full Name</label>
                  <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Full Name"
                    className="w-full bg-white/[0.04] border border-sky-500/20 focus:border-sky-500 rounded-xl px-3 py-2 text-sm text-white focus:outline-none placeholder:text-sky-300/25 transition-colors" />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-[10px] font-bold text-sky-300 uppercase tracking-wider mb-1">Staff Email</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    disabled={!!editingStaff && currentUser?.role !== 'super_admin'}
                    placeholder="Staff Email"
                    className="w-full bg-white/[0.04] border border-sky-500/20 focus:border-sky-500 rounded-xl px-3 py-2 text-sm text-white focus:outline-none placeholder:text-sky-300/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-[10px] font-bold text-sky-300 uppercase tracking-wider mb-1">
                    {editingStaff ? 'Reset Password (blank = keep current)' : 'Account Password'}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-sky-400 pointer-events-none">
                      <KeyRound className="h-3.5 w-3.5" />
                    </span>
                    <input type="password" required={!editingStaff} value={password} onChange={e => setPassword(e.target.value)}
                      disabled={!!editingStaff && currentUser?.role !== 'super_admin'}
                      placeholder={editingStaff ? (currentUser?.role === 'super_admin' ? 'New password (optional)' : 'Reset disabled') : 'Password'}
                      className="w-full bg-white/[0.04] border border-sky-500/20 focus:border-sky-500 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none placeholder:text-sky-300/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" />
                  </div>
                </div>

                {/* Role + Department */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-sky-300 uppercase tracking-wider mb-1">Role</label>
                    <select value={role} disabled={currentUser?.role === 'dept_admin' || currentUser?.role === 'staff'}
                      onChange={e => setRole(e.target.value as any)}
                      className="w-full bg-white/[0.04] border border-sky-500/20 focus:border-sky-500 rounded-xl px-2 py-2 text-sm text-white focus:outline-none disabled:opacity-50 transition-colors">
                      <option value="staff">Lecturer / Staff</option>
                      <option value="dept_admin">Dept HOD</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-sky-300 uppercase tracking-wider mb-1">Department</label>
                    <select value={department} disabled={currentUser?.role === 'dept_admin' || currentUser?.role === 'staff'}
                      onChange={e => setDepartment(e.target.value)}
                      className="w-full bg-white/[0.04] border border-sky-500/20 focus:border-sky-500 rounded-xl px-2 py-2 text-sm text-white focus:outline-none disabled:opacity-50 transition-colors">
                      <option value="">None</option>
                      {departments.map(d => (
                        <option key={d._id} value={d.code}>{d.code}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Permissions */}
                <div>
                  <label className="block text-[10px] font-bold text-sky-300 uppercase tracking-wider mb-1">Permissions</label>
                  <div className="bg-white/[0.02] border border-sky-500/10 rounded-xl p-2.5 space-y-0.5">
                    {[
                      { key: 'FULL_ACCESS',           label: 'Full Access (System Wide)',  color: 'text-blue-300'    },
                      { key: 'DEPT_ACCESS',            label: 'Department Access',          color: 'text-sky-300'     },
                      { key: 'READ_ONLY',              label: 'Read Only',                  color: 'text-amber-300'   },
                      { key: 'EDIT_SUBJECT_CATALOGUE', label: 'Edit Subject Catalogue',     color: 'text-emerald-300' },
                    ].filter(p => p.key !== 'FULL_ACCESS' || (role !== 'dept_admin' && role !== 'staff'))
                     .map(p => {
                      const checked = permissions.includes(p.key);
                      return (
                        <label key={p.key} className="flex items-center gap-2.5 cursor-pointer hover:bg-sky-500/[0.05] px-2 py-1.5 rounded-lg transition-colors select-none">
                          <input type="checkbox" checked={checked}
                            onChange={e => setPermissions(e.target.checked ? [...permissions, p.key] : permissions.filter(x => x !== p.key))}
                            className="w-3.5 h-3.5 accent-sky-500 shrink-0" />
                          <span className={`text-xs font-semibold ${p.color}`}>{p.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-2.5 rounded-xl text-xs">{error}</div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 px-4 py-3 border-t border-sky-500/10 shrink-0">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-sky-500/20 hover:bg-white/5 text-sm text-sky-300 rounded-xl transition-all font-medium">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-sm text-white font-bold rounded-xl transition-all shadow-lg shadow-sky-500/20 disabled:opacity-50 disabled:pointer-events-none">
                  {submitting ? 'Saving...' : (editingStaff ? 'Update Member' : 'Save Member')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

