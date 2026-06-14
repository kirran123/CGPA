import { api } from './api';

/**
 * 3-Permission System:
 *  DEPT_FULL_ACCESS       — Full department access (can do everything)
 *  READ_ONLY              — View records only, no mutations
 *  EDIT_SUBJECT_CATALOGUE — Can add/edit/delete subjects in the catalog
 */
export type DeptPermission = 'full' | 'read' | 'edit_catalog' | 'none';

function getUser() {
  return api.getCurrentUser();
}

export function getDeptPermission(): DeptPermission {
  const user = getUser();
  if (!user) return 'none';

  const perms: string[] = user.permissions || [];

  if (perms.includes('DEPT_FULL_ACCESS')) return 'full';
  if (perms.includes('READ_ONLY')) return 'read';
  if (perms.includes('EDIT_SUBJECT_CATALOGUE')) return 'edit_catalog';

  // Fallback role mappings
  if (user.role === 'super_admin') return 'full';
  if (user.role === 'dept_admin') return 'full';
  if (user.role === 'staff') return 'read';

  return 'none';
}

/** Can edit/save GPA and CGPA records */
export function canEditRecords(): boolean {
  const user = getUser();
  if (!user) return false;

  // Super admin and dept_admin always can
  if (['super_admin', 'dept_admin'].includes(user.role)) return true;

  const perms = user.permissions || [];
  if (perms.includes('READ_ONLY')) return false;
  if (perms.includes('DEPT_FULL_ACCESS')) return true;

  // Staff default: allow GPA/CGPA calculation
  return user.role === 'staff';
}

/** Can edit subjects in the syllabus catalog */
export function canEditSubjects(): boolean {
  const user = getUser();
  if (!user) return false;

  if (['super_admin', 'dept_admin'].includes(user.role)) return true;

  const perms = user.permissions || [];
  if (perms.includes('READ_ONLY')) return false;
  if (perms.includes('DEPT_FULL_ACCESS')) return true;
  if (perms.includes('EDIT_SUBJECT_CATALOGUE')) return true;

  return false;
}

/** Can use bulk GPA upload tools */
export function canUseBulkCgpa(): boolean {
  const user = getUser();
  if (!user) return false;

  if (['super_admin', 'dept_admin'].includes(user.role)) return true;

  const perms = user.permissions || [];
  if (perms.includes('READ_ONLY')) return false;
  if (perms.includes('DEPT_FULL_ACCESS')) return true;

  return user.role === 'staff';
}

export const canUseBulk = canUseBulkCgpa;

export default { getDeptPermission, canEditSubjects, canEditRecords, canUseBulkCgpa, canUseBulk };
