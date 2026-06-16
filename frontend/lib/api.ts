let rawBaseUrl = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000/api' : 'https://cgpa-lr2c.onrender.com/api') : 'https://cgpa-lr2c.onrender.com/api');
if (rawBaseUrl && !rawBaseUrl.endsWith('/api') && !rawBaseUrl.endsWith('/api/')) {
  rawBaseUrl = rawBaseUrl.endsWith('/') ? `${rawBaseUrl}api` : `${rawBaseUrl}/api`;
}
const API_BASE_URL = rawBaseUrl;

// Helper to get auth header
const getAuthHeaders = (): Record<string, string> => {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('rit_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'dept_admin' | 'staff';
  department: string;
  status: 'Active' | 'Inactive';
  permissions?: string[];
}

export interface Department {
  _id: string;
  name: string;
  code: string;
  description: string;
  hodName: string;
  email: string;
  status: 'Active' | 'Inactive';
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
  recentRecords?: { studentName: string; registerNo: string; semester: number; gpa: number; cgpa: number; createdAt: string; department?: string; calculatedBy?: { name: string } }[];
  departmentOverviews?: { code: string; name: string; hodName: string; email: string; totalRecords: number; totalStudents: number; avgGpa: number; avgCgpa: number }[];
}

export const api = {
  // Authentication
  login: async (credentials: any) => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Login failed');
    }
    const data = await res.json();
    localStorage.setItem('rit_token', data.token);
    localStorage.setItem('rit_user', JSON.stringify({
      _id: data._id,
      name: data.name,
      email: data.email,
      role: data.role,
      department: data.department,
      permissions: data.permissions || []
    }));
    return data;
  },

  logout: () => {
    localStorage.removeItem('rit_token');
    localStorage.removeItem('rit_user');
  },

  getCurrentUser: (): User | null => {
    if (typeof window === 'undefined') return null;
    const user = localStorage.getItem('rit_user');
    if (!user) return null;
    try {
      return JSON.parse(user);
    } catch (e) {
      console.error('Error parsing user from localStorage:', e);
      return null;
    }
  },

  // Public APIs
  getPublicDepartments: async (): Promise<Department[]> => {
    const res = await fetch(`${API_BASE_URL}/departments/public`);
    if (!res.ok) throw new Error('Failed to fetch departments');
    return res.json();
  },

  getPublicSubjects: async (department: string, semester?: number, regulation?: string): Promise<Subject[]> => {
    const semParam = semester ? `&semester=${semester}` : '';
    const regParam = regulation ? `&regulation=${encodeURIComponent(regulation)}` : '';
    const res = await fetch(`${API_BASE_URL}/subjects/public?department=${department}${semParam}${regParam}`);
    if (!res.ok) throw new Error('Failed to fetch subjects');
    return res.json();
  },

  downloadPublicGpaPdf: async (payload: any) => {
    const res = await fetch(`${API_BASE_URL}/reports/gpa-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to generate PDF');
    return res.blob();
  },

  downloadPublicCgpaPdf: async (payload: any) => {
    const res = await fetch(`${API_BASE_URL}/reports/cgpa-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to generate PDF');
    return res.blob();
  },

  // Departments CRUD (Protected)
  getDepartments: async (): Promise<Department[]> => {
    const res = await fetch(`${API_BASE_URL}/departments`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch departments');
    return res.json();
  },

  createDepartment: async (data: any): Promise<Department> => {
    const res = await fetch(`${API_BASE_URL}/departments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create department');
    return res.json();
  },

  updateDepartment: async (id: string, data: any): Promise<Department> => {
    const res = await fetch(`${API_BASE_URL}/departments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update department');
    return res.json();
  },

  getDepartmentStats: async () => {
    const res = await fetch(`${API_BASE_URL}/departments/stats`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch department stats');
    return res.json();
  },

  // Staff CRUD (Protected)
  getStaff: async (): Promise<User[]> => {
    const res = await fetch(`${API_BASE_URL}/staff`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch staff');
    return res.json();
  },

  createStaff: async (data: any): Promise<User> => {
    const res = await fetch(`${API_BASE_URL}/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to create staff');
    }
    return res.json();
  },

  updateStaff: async (id: string, data: any): Promise<User> => {
    const res = await fetch(`${API_BASE_URL}/staff/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update staff');
    return res.json();
  },

  deleteStaff: async (id: string): Promise<any> => {
    const res = await fetch(`${API_BASE_URL}/staff/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete staff');
    return res.json();
  },

  // Subjects CRUD (Protected)
  getSubjects: async (department: string, semester?: number, regulation?: string): Promise<Subject[]> => {
    const semParam = semester ? `&semester=${semester}` : '';
    const regParam = regulation ? `&regulation=${encodeURIComponent(regulation)}` : '';
    const res = await fetch(`${API_BASE_URL}/subjects?department=${department}${semParam}${regParam}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch subjects');
    return res.json();
  },

  createSubject: async (data: any): Promise<Subject> => {
    const res = await fetch(`${API_BASE_URL}/subjects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to create subject');
    }
    return res.json();
  },

  updateSubject: async (id: string, data: any): Promise<Subject> => {
    const res = await fetch(`${API_BASE_URL}/subjects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update subject');
    return res.json();
  },

  deleteSubject: async (id: string): Promise<any> => {
    const res = await fetch(`${API_BASE_URL}/subjects/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete subject');
    return res.json();
  },

  bulkUploadSubjects: async (formData: FormData): Promise<any> => {
    const res = await fetch(`${API_BASE_URL}/subjects/bulk-upload`, {
      method: 'POST',
      headers: getAuthHeaders(), // no Content-Type; browser sets multipart boundary
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Upload failed' }));
      throw new Error(err.message || 'Failed to bulk upload subjects');
    }
    return res.json();
  },

  // GPA (Protected)
  calculateGpa: async (data: any): Promise<GpaRecord> => {
    const res = await fetch(`${API_BASE_URL}/gpa/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to calculate GPA');
    }
    return res.json();
  },

  getGpaRecords: async (department?: string, semester?: number): Promise<GpaRecord[]> => {
    const deptParam = department ? `department=${department}` : '';
    const semParam = semester ? `&semester=${semester}` : '';
    const query = deptParam ? `?${deptParam}${semParam}` : (semParam ? `?${semParam.slice(1)}` : '');
    const res = await fetch(`${API_BASE_URL}/gpa/records${query}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch GPA records');
    return res.json();
  },

  bulkUploadGpa: async (formData: FormData): Promise<any> => {
    const res = await fetch(`${API_BASE_URL}/gpa/bulk-calculate`, {
      method: 'POST',
      headers: getAuthHeaders(), // Do NOT set content-type, let browser set boundaries for multipart/form-data
      body: formData
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed bulk upload');
    }
    return res.json();
  },

  // CGPA (Protected)
  calculateCgpa: async (data: any): Promise<CgpaRecord> => {
    const res = await fetch(`${API_BASE_URL}/cgpa/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to calculate CGPA');
    }
    return res.json();
  },

  getCgpaRecords: async (department?: string): Promise<CgpaRecord[]> => {
    const query = department ? `?department=${department}` : '';
    const res = await fetch(`${API_BASE_URL}/cgpa/records${query}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch CGPA records');
    return res.json();
  },

  bulkUploadCgpa: async (formData: FormData): Promise<any> => {
    const res = await fetch(`${API_BASE_URL}/cgpa/bulk-calculate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed bulk CGPA upload');
    }
    return res.json();
  },

  // Reports Stored (Protected)
  downloadGpaReportPdf: async (recordId: string) => {
    const res = await fetch(`${API_BASE_URL}/reports/gpa/${recordId}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to download GPA PDF');
    return res.blob();
  },

  downloadCgpaReportPdf: async (recordId: string) => {
    const res = await fetch(`${API_BASE_URL}/reports/cgpa/${recordId}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to download CGPA PDF');
    return res.blob();
  },

  downloadGpaRankListPdf: async (department: string, semester: number) => {
    const res = await fetch(`${API_BASE_URL}/reports/rank-list/gpa?department=${department}&semester=${semester}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to download GPA Rank List PDF');
    return res.blob();
  },

  downloadCgpaRankListPdf: async (department: string) => {
    const res = await fetch(`${API_BASE_URL}/reports/rank-list/cgpa?department=${department}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to download CGPA Rank List PDF');
    return res.blob();
  },

  // Analytics (Protected)
  getDashboardStats: async (department?: string): Promise<DashboardStats> => {
    const deptParam = department ? `?department=${department}` : '';
    const res = await fetch(`${API_BASE_URL}/analytics/dashboard-stats${deptParam}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch dashboard stats');
    return res.json();
  },

  getHistoryLogs: async (): Promise<HistoryLog[]> => {
    const res = await fetch(`${API_BASE_URL}/analytics/history`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch history logs');
    return res.json();
  },

  getRegulations: async (): Promise<{ _id: string; name: string }[]> => {
    const res = await fetch(`${API_BASE_URL}/regulations`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch regulations');
    return res.json();
  },

  createRegulation: async (name: string): Promise<any> => {
    const res = await fetch(`${API_BASE_URL}/regulations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ name })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to create regulation');
    }
    return res.json();
  },

  getBatches: async (department?: string): Promise<any[]> => {
    const q = department ? `?department=${department}` : '';
    const res = await fetch(`${API_BASE_URL}/gpa/batches${q}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch batches');
    return res.json();
  },

  getBatchRecords: async (batchId: string): Promise<GpaRecord[]> => {
    const res = await fetch(`${API_BASE_URL}/gpa/batch/${batchId}/records`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch batch records');
    return res.json();
  },

  downloadBatchPdf: async (batchId: string): Promise<Blob> => {
    const res = await fetch(`${API_BASE_URL}/reports/batch/${batchId}/pdf`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to download batch PDF');
    return res.blob();
  },

  deleteGpaRecord: async (id: string): Promise<any> => {
    const res = await fetch(`${API_BASE_URL}/gpa/record/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to delete record');
    }
    return res.json();
  },

  deleteBatch: async (batchId: string): Promise<any> => {
    const res = await fetch(`${API_BASE_URL}/gpa/batch/${batchId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to delete batch');
    }
    return res.json();
  },

  downloadBulkGpaPdf: async (formData: FormData): Promise<Blob> => {
    const res = await fetch(`${API_BASE_URL}/reports/bulk-gpa-pdf`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Failed to generate bulk PDF' }));
      throw new Error(err.message || 'Failed bulk PDF generation');
    }
    return res.blob();
  },

  getGradeSettings: async (department: string, regulation: string, semester: number): Promise<any> => {
    const res = await fetch(`${API_BASE_URL}/grade-settings/${encodeURIComponent(department)}/${encodeURIComponent(regulation)}/${semester}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch grade settings');
    return res.json();
  },

  saveGradeSettings: async (department: string, regulation: string, semester: number, grades: { grade: string; points: number }[]): Promise<any> => {
    const res = await fetch(`${API_BASE_URL}/grade-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ department, regulation, semester, grades })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to save grade settings');
    }
    return res.json();
  }
};
