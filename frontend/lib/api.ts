/**
 * api.ts — Convex-backed client
 *
 * This is a drop-in replacement for the original Express/REST api.ts.
 * All method signatures and return shapes are preserved so that every
 * page component works without a single line change.
 *
 * PDF downloads that previously returned Blob objects now decode the
 * base64 string returned by the Convex Action and convert it to a Blob
 * so callers see identical behaviour.
 */

import { ConvexHttpClient } from "convex/browser";
import { api as convexApi } from "../convex/_generated/api";

// ── Convex client (HTTP – works outside of React components) ──────────────
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string;
const convex = new ConvexHttpClient(CONVEX_URL);

// ── Auth helpers ──────────────────────────────────────────────────────────
const performLogout = () => {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem("rit_token");
  sessionStorage.removeItem("rit_user");
  window.dispatchEvent(new Event("auth-change"));
};

const getCurrentUserRaw = (): { _id: string; role: string; department: string; name: string } | null => {
  if (typeof window === "undefined") return null;
  const userStr = sessionStorage.getItem("rit_user");
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
};

/** Decode a base64 PDF string into a Blob for download */
const base64ToPdfBlob = (b64: string): Blob => {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: "application/pdf" });
};

// ── TypeScript Interfaces (identical to before) ───────────────────────────
export interface User {
  _id: string;
  name: string;
  email: string;
  role: "super_admin" | "dept_admin" | "staff";
  department: string;
  status: "Active" | "Inactive";
  permissions?: string[];
}

export interface Department {
  _id: string;
  name: string;
  code: string;
  description: string;
  hodName: string;
  email: string;
  status: "Active" | "Inactive";
}

export interface Subject {
  _id: string;
  code: string;
  name: string;
  credits: number;
  semester: number;
  department: string;
  regulation?: string;
}

export interface GpaRecord {
  _id: string;
  studentName: string;
  registerNo: string;
  semester: number;
  department: string;
  regulation?: string;
  gpa: number;
  cgpa: number;
  subjects: {
    subjectCode: string;
    subjectName: string;
    credits: number;
    grade: string;
    gradePoint: number;
  }[];
  createdAt: string;
  isBulk?: boolean;
  batchName?: string;
  batchId?: string;
}

export interface Student {
  _id: string;
  name: string;
  registerNo: string;
  department: string;
  batch: string;
  regulation?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface CgpaRecord {
  _id: string;
  studentName: string;
  registerNo: string;
  department: string;
  regulation?: string;
  semesters: {
    semester: number;
    gpa: number;
    credits: number;
  }[];
  totalCredits: number;
  cgpa: number;
  createdAt: string;
}

export interface HistoryLog {
  _id: string;
  action: string;
  details: string;
  performedBy: string;
  performedByName: string;
  department?: string;
  timestamp: string;
}

export interface DashboardStats {
  stats: {
    totalRecords: number;
    totalStudents: number;
    avgGpa: number;
    avgCgpa: number;
  };
  distribution: { range: string; count: number }[];
  trends: { semester: string; avgGpa: number }[];
  rankings: { rank: number; registerNo: string; name: string; cgpa: number; semester: number }[];
  recentRecords?: {
    studentName: string;
    registerNo: string;
    semester: number;
    gpa: number;
    cgpa: number;
    createdAt: string;
    department?: string;
    calculatedBy?: { name: string };
  }[];
  departmentOverviews?: {
    code: string;
    name: string;
    hodName: string;
    email: string;
    totalRecords: number;
    totalStudents: number;
    avgGpa: number;
    avgCgpa: number;
  }[];
}

// ── Helper to upload a File directly to Convex Storage ───────────────────
async function uploadFileToConvex(file: File): Promise<string> {
  const uploadUrl = await convex.mutation(convexApi.files.generateUploadUrl, {});
  const result = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!result.ok) throw new Error("File upload to Convex storage failed");
  const { storageId } = await result.json();
  return storageId as string;
}

// ── Main API Object ───────────────────────────────────────────────────────
export const api = {

  // ── Authentication ──────────────────────────────────────────────────────
  login: async (credentials: { email: string; password: string }) => {
    const data = await convex.mutation(convexApi.users.login, credentials);

    // Persist session (same keys as the original Express client)
    sessionStorage.setItem("rit_token", data.token);
    sessionStorage.setItem(
      "rit_user",
      JSON.stringify({
        _id: data._id,
        name: data.name,
        email: data.email,
        role: data.role,
        department: data.department,
        permissions: data.permissions || [],
      })
    );
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("auth-change"));
    }
    return data;
  },

  logout: () => {
    performLogout();
  },

  getCurrentUser: (): User | null => {
    if (typeof window === "undefined") return null;
    const token = sessionStorage.getItem("rit_token");
    const userStr = sessionStorage.getItem("rit_user");
    if (!token || !userStr) {
      if (token || userStr) {
        sessionStorage.removeItem("rit_token");
        sessionStorage.removeItem("rit_user");
      }
      return null;
    }
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  // ── Public APIs (no auth required) ─────────────────────────────────────
  getPublicDepartments: async (): Promise<Department[]> => {
    const result = await convex.query(convexApi.departments.getPublic, {});
    return result.map((d: any) => ({ ...d, _id: d._id }));
  },

  getPublicSubjects: async (department: string, semester?: number, regulation?: string): Promise<Subject[]> => {
    const result = await convex.query(convexApi.subjects.get, {
      department,
      semester,
      regulation,
    });
    return result.map((s: any) => ({ ...s, _id: s._id }));
  },

  downloadPublicGpaPdf: async (payload: any): Promise<Blob> => {
    const b64 = await convex.action(convexApi.reports.generateGpaPdf, payload);
    return base64ToPdfBlob(b64);
  },

  downloadPublicCgpaPdf: async (payload: any): Promise<Blob> => {
    const b64 = await convex.action(convexApi.reports.generateCgpaPdf, payload);
    return base64ToPdfBlob(b64);
  },

  // ── Departments CRUD ────────────────────────────────────────────────────
  getDepartments: async (): Promise<Department[]> => {
    const user = getCurrentUserRaw();
    const result = await convex.query(convexApi.departments.get, {
      role: user?.role || "staff",
    });
    return result.map((d: any) => ({ ...d, _id: d._id }));
  },

  createDepartment: async (data: any): Promise<Department> => {
    const user = getCurrentUserRaw();
    if (!user) throw new Error("Not authenticated");
    const result = await convex.mutation(convexApi.departments.create, {
      ...data,
      userId: user._id,
    });
    return { ...result, _id: result._id } as Department;
  },

  updateDepartment: async (id: string, data: any): Promise<Department> => {
    const user = getCurrentUserRaw();
    if (!user) throw new Error("Not authenticated");
    const result = await convex.mutation(convexApi.departments.update, {
      id: id as any,
      ...data,
      userId: user._id,
    });
    return { ...result, _id: result._id } as Department;
  },

  getDepartmentStats: async () => {
    const result = await convex.query(convexApi.departments.getStats, {});
    return result;
  },

  // ── Staff CRUD ──────────────────────────────────────────────────────────
  getStaff: async (): Promise<User[]> => {
    const user = getCurrentUserRaw();
    const result = await convex.query(convexApi.users.getStaff, {
      department: user?.department || undefined,
      role: user?.role || undefined,
    });
    return result.map((u: any) => ({ ...u, _id: u._id }));
  },

  createStaff: async (data: any): Promise<User> => {
    const id = await convex.mutation(convexApi.users.createStaff, data);
    // Fetch full user record
    const allStaff = await convex.query(convexApi.users.getStaff, {});
    const created = allStaff.find((u: any) => u._id === id);
    return { ...created, _id: created._id } as User;
  },

  updateStaff: async (id: string, data: any): Promise<User> => {
    await convex.mutation(convexApi.users.updateStaff, { id: id as any, ...data });
    const allStaff = await convex.query(convexApi.users.getStaff, {});
    const updated = allStaff.find((u: any) => u._id === id);
    return { ...updated, _id: updated._id } as User;
  },

  deleteStaff: async (id: string): Promise<any> => {
    return convex.mutation(convexApi.users.deleteStaff, { id: id as any });
  },

  // ── Subjects CRUD ───────────────────────────────────────────────────────
  getSubjects: async (department: string, semester?: number, regulation?: string): Promise<Subject[]> => {
    const result = await convex.query(convexApi.subjects.get, { department, semester, regulation });
    return result.map((s: any) => ({ ...s, _id: s._id }));
  },

  createSubject: async (data: any): Promise<Subject> => {
    const id = await convex.mutation(convexApi.subjects.create, data);
    const list = await convex.query(convexApi.subjects.get, { department: data.department });
    const created = list.find((s: any) => s._id === id);
    return { ...created, _id: created._id } as Subject;
  },

  updateSubject: async (id: string, data: any): Promise<Subject> => {
    await convex.mutation(convexApi.subjects.update, { id: id as any, ...data });
    // Re-fetch for the updated record
    const allSubjects = await convex.query(convexApi.subjects.get, {});
    const updated = allSubjects.find((s: any) => s._id === id);
    return { ...updated, _id: updated._id } as Subject;
  },

  deleteSubject: async (id: string): Promise<any> => {
    return convex.mutation(convexApi.subjects.remove, { id: id as any });
  },

  bulkUploadSubjects: async (formData: FormData): Promise<any> => {
    const file = formData.get("file") as File;
    const department = formData.get("department") as string;
    const regulation = formData.get("regulation") as string;
    const semester = formData.get("semester") ? parseInt(formData.get("semester") as string) : undefined;
    const skipDuplicates = formData.get("skipDuplicates") === "true";

    const storageId = await uploadFileToConvex(file);
    return convex.action(convexApi.subjectsActions.bulkUpload, {
      storageId,
      department,
      regulation,
      semester,
      skipDuplicates: skipDuplicates ?? true,
    });
  },

  // ── GPA ─────────────────────────────────────────────────────────────────
  calculateGpa: async (data: any): Promise<GpaRecord> => {
    const user = getCurrentUserRaw();
    if (!user) throw new Error("Not authenticated");
    const result = await convex.mutation(convexApi.gpa.calculateSingle, {
      ...data,
      userId: user._id,
    });
    return { ...result, _id: result._id, createdAt: new Date(result.createdAt).toISOString() } as GpaRecord;
  },

  getGpaRecords: async (department?: string, semester?: number): Promise<GpaRecord[]> => {
    const user = getCurrentUserRaw();
    // Dept-level users get only their own records
    const userId =
      user && (user.role === "dept_admin" || user.role === "staff")
        ? (user._id as any)
        : undefined;

    const result = await convex.query(convexApi.gpa.getRecords, { department, semester, userId });
    return result.map((r: any) => ({
      ...r,
      _id: r._id,
      createdAt: new Date(r.createdAt).toISOString(),
    }));
  },

  bulkUploadGpa: async (formData: FormData): Promise<any> => {
    const user = getCurrentUserRaw();
    if (!user) throw new Error("Not authenticated");

    const file = formData.get("file") as File;
    const department = (formData.get("department") as string) || user.department;
    const regulation = formData.get("regulation") as string;
    const semester = formData.get("semester") as string;
    const batchName = formData.get("batchName") as string;

    const storageId = await uploadFileToConvex(file);
    return convex.action(convexApi.gpaActions.bulkCalculate, {
      storageId,
      department,
      regulation: regulation || "__from_file__",
      semester: semester || "__from_file__",
      batchName: batchName || undefined,
      userId: user._id as any,
    });
  },

  getBatches: async (department?: string): Promise<any[]> => {
    return convex.query(convexApi.gpa.getBatches, { department });
  },

  getBatchRecords: async (batchId: string): Promise<GpaRecord[]> => {
    const result = await convex.query(convexApi.gpa.getBatchRecords, { batchId });
    return result.map((r: any) => ({
      ...r,
      _id: r._id,
      createdAt: new Date(r.createdAt).toISOString(),
    }));
  },

  deleteGpaRecord: async (id: string): Promise<any> => {
    const user = getCurrentUserRaw();
    if (!user) throw new Error("Not authenticated");
    return convex.mutation(convexApi.gpa.deleteRecord, { id: id as any, userId: user._id as any });
  },

  deleteBatch: async (batchId: string): Promise<any> => {
    const user = getCurrentUserRaw();
    if (!user) throw new Error("Not authenticated");
    return convex.mutation(convexApi.gpa.deleteBatch, { batchId, userId: user._id as any });
  },

  updateGpaRecord: async (id: string, data: { studentName?: string; registerNo?: string; gpa?: number; semester?: number }): Promise<any> => {
    const user = getCurrentUserRaw();
    if (!user) throw new Error("Not authenticated");
    return convex.mutation(convexApi.gpa.updateRecord, { id: id as any, ...data, userId: user._id as any });
  },

  // ── CGPA ────────────────────────────────────────────────────────────────
  calculateCgpa: async (data: any): Promise<CgpaRecord> => {
    const user = getCurrentUserRaw();
    if (!user) throw new Error("Not authenticated");
    const result = await convex.mutation(convexApi.cgpa.calculateSingle, {
      ...data,
      userId: user._id,
    });
    return { ...result, _id: result._id, createdAt: new Date(result.createdAt).toISOString() } as CgpaRecord;
  },

  getCgpaRecords: async (department?: string): Promise<CgpaRecord[]> => {
    const user = getCurrentUserRaw();
    const userId =
      user && (user.role === "dept_admin" || user.role === "staff")
        ? (user._id as any)
        : undefined;

    const result = await convex.query(convexApi.cgpa.getRecords, { department, userId });
    return result.map((r: any) => ({
      ...r,
      _id: r._id,
      createdAt: new Date(r.createdAt).toISOString(),
    }));
  },

  updateCgpaRecord: async (id: string, data: { studentName?: string; registerNo?: string; cgpa?: number; semesters?: any[] }): Promise<any> => {
    const user = getCurrentUserRaw();
    if (!user) throw new Error("Not authenticated");
    return convex.mutation(convexApi.cgpa.updateRecord, { id: id as any, ...data, userId: user._id as any });
  },

  getStudentGpaHistory: async (registerNo: string, department?: string): Promise<any[]> => {
    return convex.query(convexApi.cgpa.getStudentGpaHistory, { registerNo, department });
  },

  bulkUploadCgpa: async (formData: FormData): Promise<any> => {
    const user = getCurrentUserRaw();
    if (!user) throw new Error("Not authenticated");

    const file = formData.get("file") as File;
    const department = (formData.get("department") as string) || user.department;
    const regulation = (formData.get("regulation") as string) || "R2021";

    const storageId = await uploadFileToConvex(file);
    return convex.action(convexApi.cgpaActions.bulkCalculate, {
      storageId,
      department,
      regulation,
      userId: user._id as any,
    });
  },

  // ── Students Management ──────────────────────────────────────────────────
  getStudents: async (department?: string, batch?: string, search?: string): Promise<Student[]> => {
    const result = await convex.query(convexApi.students.get, { department, batch, search });
    return result.map((s: any) => ({ ...s, _id: s._id }));
  },

  getStudentBatches: async (department?: string): Promise<{ batch: string; count: number }[]> => {
    return convex.query(convexApi.students.getBatches, { department });
  },

  createStudent: async (data: { name: string; registerNo: string; department: string; batch: string; regulation?: string }): Promise<any> => {
    return convex.mutation(convexApi.students.create, data);
  },

  updateStudent: async (id: string, data: Partial<{ name: string; registerNo: string; department: string; batch: string; regulation: string }>): Promise<any> => {
    return convex.mutation(convexApi.students.update, { id: id as any, ...data });
  },

  deleteStudent: async (id: string): Promise<any> => {
    return convex.mutation(convexApi.students.remove, { id: id as any });
  },

  bulkUploadStudents: async (formData: FormData): Promise<any> => {
    const user = getCurrentUserRaw();
    if (!user) throw new Error("Not authenticated");

    const file = formData.get("file") as File;
    const department = (formData.get("department") as string) || user.department || "";
    const batch = (formData.get("batch") as string) || "";
    const regulation = (formData.get("regulation") as string) || "R2021";

    const storageId = await uploadFileToConvex(file);
    return convex.action(convexApi.studentsActions.bulkUpload, {
      storageId,
      department,
      batch,
      regulation,
    });
  },

  // ── PDF Reports ─────────────────────────────────────────────────────────
  downloadGpaReportPdf: async (recordId: string): Promise<Blob> => {
    const b64 = await convex.action(convexApi.reports.generateStoredGpaPdf, {
      recordId: recordId as any,
    });
    return base64ToPdfBlob(b64);
  },

  downloadCgpaReportPdf: async (recordId: string): Promise<Blob> => {
    const b64 = await convex.action(convexApi.reports.generateStoredCgpaPdf, {
      recordId: recordId as any,
    });
    return base64ToPdfBlob(b64);
  },

  downloadOverallSemesterGpaPdf: async (department?: string, semester?: number): Promise<Blob> => {
    const b64 = await convex.action(convexApi.reports.generateOverallSemesterGpaPdf, { department, semester });
    return base64ToPdfBlob(b64);
  },

  downloadOverallCgpaPdf: async (department?: string): Promise<Blob> => {
    const b64 = await convex.action(convexApi.reports.generateOverallCgpaPdf, { department });
    return base64ToPdfBlob(b64);
  },

  downloadGpaRankListPdf: async (department: string, semester: number): Promise<Blob> => {
    const b64 = await convex.action(convexApi.reports.generateRankListGpaPdf, { department, semester });
    return base64ToPdfBlob(b64);
  },

  downloadCgpaRankListPdf: async (department: string): Promise<Blob> => {
    const b64 = await convex.action(convexApi.reports.generateRankListCgpaPdf, { department });
    return base64ToPdfBlob(b64);
  },

  downloadBatchPdf: async (batchId: string): Promise<Blob> => {
    const b64 = await convex.action(convexApi.reports.generateBatchGpaPdf, { batchId });
    return base64ToPdfBlob(b64);
  },

  downloadBulkGpaPdf: async (formData: FormData): Promise<Blob> => {
    // The bulk GPA PDF uses the batch generated from a prior bulkUploadGpa call.
    // This method re-uses generateBatchGpaPdf with a batchId stored in FormData.
    const batchId = formData.get("batchId") as string;
    if (!batchId) throw new Error("batchId required for bulk PDF download");
    const b64 = await convex.action(convexApi.reports.generateBatchGpaPdf, { batchId });
    return base64ToPdfBlob(b64);
  },

  // ── Analytics ───────────────────────────────────────────────────────────
  getDashboardStats: async (department?: string): Promise<DashboardStats> => {
    const user = getCurrentUserRaw();
    if (!user) throw new Error("Not authenticated");
    return convex.query(convexApi.analytics.getDashboardStats, {
      department,
      role: user.role,
      userId: user._id as any,
    });
  },

  getHistoryLogs: async (): Promise<HistoryLog[]> => {
    const user = getCurrentUserRaw();
    if (!user) throw new Error("Not authenticated");
    const result = await convex.query(convexApi.analytics.getHistory, {
      role: user.role,
      userId: user._id as any,
    });
    return result.map((l: any) => ({
      ...l,
      _id: l._id,
      timestamp: new Date(l.timestamp).toISOString(),
    }));
  },

  // ── Regulations ─────────────────────────────────────────────────────────
  getRegulations: async (): Promise<{ _id: string; name: string }[]> => {
    const result = await convex.query(convexApi.regulations.get, {});
    return result.map((r: any) => ({ _id: r._id, name: r.name }));
  },

  createRegulation: async (name: string): Promise<any> => {
    const id = await convex.mutation(convexApi.regulations.create, { name });
    return { _id: id, name };
  },

  // ── Grade Settings ──────────────────────────────────────────────────────
  getGradeSettings: async (department: string, regulation: string, semester: number): Promise<any> => {
    const grades = await convex.query(convexApi.gradeSettings.get, { department, regulation, semester });
    // Return same shape as the Express backend: { grades: [...] }
    return { grades };
  },

  saveGradeSettings: async (
    department: string,
    regulation: string,
    semester: number,
    grades: { grade: string; points: number }[]
  ): Promise<any> => {
    const id = await convex.mutation(convexApi.gradeSettings.save, {
      department,
      regulation,
      semester,
      grades,
    });
    return { _id: id };
  },
};
