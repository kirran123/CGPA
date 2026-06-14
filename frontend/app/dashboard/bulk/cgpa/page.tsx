'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  FileSpreadsheet, 
  UploadCloud, 
  Loader2, 
  CheckCircle, 
  AlertTriangle,
  Building,
  Download
} from 'lucide-react';
import { api, Department } from '@/lib/api';
import { canUseBulkCgpa as canUseBulkCgpaFn } from '@/lib/permissions';

/* ─── Template Download Helper ────────────────────────────────────────────── */
function downloadTemplate() {
  const header = 'RegisterNo,StudentName,Sem1_GPA,Sem2_GPA,Sem3_GPA,Sem4_GPA\n';
  const sample = [
    '953621104001,Abinesh S,8.4,9.1,8.7,8.9',
    '953621104002,Bhuvanesh R,7.9,8.2,8.5,8.1',
    '953621104003,Deepak Kumar K,6.5,7.1,5.8,6.2',
  ].join('\n');
  const blob = new Blob([header + sample], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'cgpa_bulk_template.csv';
  a.click();
}

export default function BulkCgpaUpload() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState('');
  
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [deptsLoading, setDeptsLoading] = useState(true);
  
  const [result, setResult] = useState<{ message: string; recordsCount: number; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const canUseBulk = canUseBulkCgpaFn();

  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const u = api.getCurrentUser();
        setCurrentUser(u);

        const list = await api.getPublicDepartments();
        setDepartments(list);

        if (u?.department) {
          setSelectedDept(u.department);
        } else if (list.length > 0) {
          setSelectedDept(list[0].code);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setDeptsLoading(false);
      }
    };
    fetchDepts();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setResult(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select an Excel file (.xlsx) first.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('department', selectedDept);

    try {
      const data = await api.bulkUploadCgpa(formData);
      setResult(data);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setError(err.message || 'Bulk upload processing failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white/[0.02] border border-sky-500/10 rounded-3xl p-6 backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-sky-500/10 pb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-sky-400" />
              Bulk CGPA Processor (Excel or PDF)
            </h2>
            <p className="text-xs text-sky-200/60 leading-relaxed mt-1">
              Upload spreadsheets or text-based PDFs matching the cumulative grading layout to calculate CGPA across semesters for multiple student profiles simultaneously.
            </p>
          </div>
          <button
            type="button"
            onClick={downloadTemplate}
            className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300 hover:text-white bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/15 hover:border-emerald-500/35 px-4 py-2 rounded-xl transition-all duration-300 cursor-pointer whitespace-nowrap"
          >
            <Download className="h-4 w-4" />
            <span>Download Excel Template</span>
          </button>
        </div>

        {deptsLoading ? (
          <div className="h-40 flex items-center justify-center text-xs text-sky-300">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading active department parameters...
          </div>
        ) : canUseBulk ? (
          <div className="space-y-6">
            {/* Warning Banner */}
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-xs text-red-300">
              <AlertTriangle className="h-4.5 w-4.5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1 leading-relaxed">
                <p className="font-bold text-white uppercase tracking-wider text-[9px] mb-0.5">Excel File Format Required</p>
                <p>
                  Please <span className="font-semibold text-white">DO NOT upload CSV files</span>. CSV files exported from Excel can convert large register numbers into scientific notation (e.g. <code className="text-red-200">9.54E+11</code>), which truncates the unique digits and causes records to overwrite each other.
                </p>
                <p>
                  Use the standard <span className="font-semibold text-emerald-300">Excel (.xlsx or .xls)</span> file format instead, as it preserves full numeric precision.
                </p>
              </div>
            </div>

            <form onSubmit={handleUpload} className="space-y-6">
            <div>
              <label className="block text-[10px] font-bold text-sky-300 uppercase tracking-wider mb-2">Target Department</label>
              <select
                value={selectedDept}
                disabled={currentUser?.role === 'dept_admin' || currentUser?.role === 'staff'}
                onChange={e => setSelectedDept(e.target.value)}
                className="w-full bg-[#071830] border border-sky-500/20 focus:border-sky-500 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none disabled:opacity-50"
              >
                {departments
                  .filter(d => currentUser?.role === 'super_admin' || d.code === currentUser?.department)
                  .map(d => (
                    <option key={d._id} value={d.code}>{d.name}</option>
                  ))}
              </select>
            </div>

            {/* Drag & Drop zone */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-sky-500/20 hover:border-sky-500/40 rounded-3xl p-10 text-center cursor-pointer transition-all hover:bg-sky-500/5"
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".xlsx,.xls,.pdf"
                className="hidden" 
              />
              <UploadCloud className="h-12 w-12 text-sky-400/80 mx-auto mb-3" />
              <p className="text-sm font-semibold text-white">
                {file ? `Selected: ${file.name}` : 'Select Cumulative Grades File (.xlsx, .xls, or .pdf)'}
              </p>
              <p className="text-xs text-sky-300/50 mt-2 leading-relaxed">
                Expected formats: Excel with <span className="font-mono text-white font-bold">RegisterNo</span>, <span className="font-mono text-white font-bold font-bold">StudentName</span> columns followed by <span className="font-mono text-white font-bold font-bold">SemX_GPA</span> and <span className="font-mono text-white font-bold font-bold">SemX_Credits</span>; or a text-based PDF detailing previous semester performance blocks.
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !file}
              className="flex items-center justify-center gap-2 w-full py-4 bg-gradient-to-r from-sky-500 to-purple-650 hover:from-sky-500 hover:to-purple-750 text-white font-bold rounded-2xl shadow-lg transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  <span>Processing bulk records...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="h-4.5 w-4.5" />
                  <span>Execute Bulk CGPA Calculation</span>
                </>
              )}
            </button>
          </form>
          </div>
        ) : (
          <div className="p-6 bg-white/[0.02] border border-sky-500/10 rounded-2xl text-sm text-sky-300">
            You don't have permission to execute bulk CGPA calculations. Contact your department administrator if you need access.
          </div>
        )}
      </div>

      {/* Result feedback */}
      {result && (
        <div className="bg-white/[0.02] border border-sky-500/10 rounded-3xl p-6 backdrop-blur-xl space-y-4">
          <h3 className="text-sm font-bold text-white border-b border-sky-500/10 pb-2 flex items-center gap-2">
            <CheckCircle className="h-4.5 w-4.5 text-emerald-400" />
            Bulk Process Complete
          </h3>
          <p className="text-xs text-sky-200/80">
            Successfully calculated and stored <span className="font-semibold text-emerald-400">{result.recordsCount}</span> student cumulative CGPA records.
          </p>

          {result.errors.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                Processing Notes / Failures ({result.errors.length}):
              </span>
              <div className="max-h-48 overflow-y-auto bg-[#0a052a] p-3 rounded-2xl border border-sky-500/5 text-[11px] font-mono text-sky-300 space-y-1">
                {result.errors.map((err, idx) => (
                  <p key={idx} className="leading-relaxed border-l-2 border-red-500/40 pl-2">{err}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
