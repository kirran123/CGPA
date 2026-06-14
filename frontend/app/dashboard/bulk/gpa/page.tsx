'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  FileSpreadsheet, 
  UploadCloud, 
  Loader2, 
  CheckCircle, 
  AlertTriangle,
  Download,
  Info,
  X,
  FileText
} from 'lucide-react';
import { api, Department } from '@/lib/api';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';

/* ─── Sentinel value for "read from file" ─────────────────────────────────── */
const FROM_FILE = '__from_file__';

/* ─── Template Download Helper ────────────────────────────────────────────── */
function downloadTemplate() {
  // Build data rows — register numbers stored as text to prevent scientific notation
  const rows = [
    { RegisterNo: '953621104001', StudentName: 'Abinesh S',      Semester: 1, Regulation: 'R2021', MA3151: 'O',  PH3151: 'A+', CY3151: 'A', GE3151: 'B+' },
    { RegisterNo: '953621104002', StudentName: 'Bhuvanesh R',    Semester: 1, Regulation: 'R2021', MA3151: 'A',  PH3151: 'B+', CY3151: 'O', GE3151: 'B'  },
    { RegisterNo: '953621104003', StudentName: 'Deepak Kumar K', Semester: 1, Regulation: 'R2021', MA3151: 'B',  PH3151: 'C',  CY3151: 'U', GE3151: 'A'  },
  ];

  const ws = XLSX.utils.json_to_sheet(rows);

  // Force RegisterNo column (A) to be text so Excel doesn't mangle long numbers
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
    if (cell) { cell.t = 's'; cell.z = '@'; }
  }

  // Set column widths for readability
  ws['!cols'] = [{ wch: 18 }, { wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'GPA Template');

  XLSX.writeFile(wb, 'gpa_bulk_template.xlsx');
}

/* ─── Accepted file types ─────────────────────────────────────────────────── */
const ACCEPTED_TYPES = '.xlsx,.xls,.csv,.pdf';
const ACCEPTED_MIME = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv',
  'application/pdf',
];

function isValidFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return ['xlsx', 'xls', 'csv', 'pdf'].includes(ext);
}

export default function BulkGpaUpload() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState('');
  /* "semester" is either a number-string ("1"…"8") or FROM_FILE */
  const [selectedSem, setSelectedSem] = useState<string>('1');
  const [regulations, setRegulations] = useState<string[]>([]);
  /* "regulation" is a regulation name or FROM_FILE */
  const [selectedReg, setSelectedReg] = useState<string>('');
  const [batchName, setBatchName] = useState('');
  
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deptsLoading, setDeptsLoading] = useState(true);
  
  const [result, setResult] = useState<{ message: string; batchId?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const fetchDeptsAndRegs = async () => {
      try {
        const u = api.getCurrentUser();
        setCurrentUser(u);

        const [list, regs] = await Promise.all([
          api.getPublicDepartments(),
          api.getRegulations()
        ]);
        setDepartments(list);

        if (u?.department) {
          setSelectedDept(u.department);
        } else if (list.length > 0) {
          setSelectedDept(list[0].code);
        }
        const regNames = regs.map((r: any) => r.name);
        setRegulations(regNames);
        // Default: first reg value (not FROM_FILE)
        if (regNames.length > 0) {
          setSelectedReg(regNames.includes('R2021') ? 'R2021' : regNames[0]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setDeptsLoading(false);
      }
    };
    fetchDeptsAndRegs();
  }, []);

  /* ── File picking helpers ── */
  const applyFile = (f: File) => {
    if (!isValidFile(f)) {
      setError('Unsupported file type. Please upload .xlsx, .xls, .csv, or .pdf');
      return;
    }
    setFile(f);
    setError(null);
    setResult(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) applyFile(e.target.files[0]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) applyFile(f);
  };

  /* ── Upload & PDF Download ── */
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file first (.xlsx, .xls, .csv, or .pdf).');
      return;
    }

    if (!batchName.trim()) {
      setError('Please specify a batch name to identify this calculation.');
      return;
    }

    // Validate: if neither FROM_FILE nor a real number, block
    if (selectedSem !== FROM_FILE && (isNaN(Number(selectedSem)) || Number(selectedSem) < 1)) {
      setError('Please select a valid semester.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('department', selectedDept);
    // Pass sentinel or actual value — backend handles both
    formData.append('semester', selectedSem);
    formData.append('regulation', selectedReg);
    formData.append('batchName', batchName.trim());

    try {
      // 1. Upload and save the batch in the database
      const saveRes = await api.bulkUploadGpa(formData);
      const batchId = saveRes.batchId;

      if (!batchId) {
        throw new Error('Batch upload succeeded but batchId was not returned. Please check the Batch Results page.');
      }

      // 2. Fetch and download the compiled PDF for this saved batch
      const blob = await api.downloadBatchPdf(batchId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const formattedBatch = batchName.trim().replace(/\s+/g, '_');
      link.setAttribute('download', `Batch_${formattedBatch}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);

      setResult({ message: 'Success', batchId });
      setFile(null);
      setBatchName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setError(err.message || 'Bulk upload calculation and PDF generation failed.');
    } finally {
      setLoading(false);
    }

  };

  /* ── File icon ── */
  const FileIcon = () => {
    if (!file) return <FileSpreadsheet className="h-10 w-10 text-sky-400/60 mx-auto mb-3" />;
    if (file.name.endsWith('.pdf')) return <FileText className="h-10 w-10 text-red-400 mx-auto mb-3" />;
    if (file.name.endsWith('.csv')) return <FileSpreadsheet className="h-10 w-10 text-emerald-400 mx-auto mb-3" />;
    return <FileSpreadsheet className="h-10 w-10 text-sky-400 mx-auto mb-3" />;
  };

  const semIsFromFile = selectedSem === FROM_FILE;
  const regIsFromFile = selectedReg === FROM_FILE;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white/[0.02] border border-sky-500/10 rounded-3xl p-6 backdrop-blur-xl">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-sky-500/10 pb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-sky-400" />
              Bulk GPA Processor
            </h2>
            <p className="text-xs text-sky-200/60 leading-relaxed mt-1">
              Upload Excel, CSV, or PDF files to calculate GPA &amp; CGPA for multiple students at once.
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

        {/* Warning Banner */}
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-4 text-xs text-red-300">
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

        {/* Format info banner */}
        <div className="flex items-start gap-3 bg-sky-500/5 border border-sky-500/15 rounded-2xl p-4 mb-6 text-xs text-sky-200/70">
          <Info className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
          <div className="space-y-1 leading-relaxed">
            <p>
              <span className="text-white font-semibold">Excel / CSV columns:</span>{' '}
              <code className="text-sky-300">RegisterNo</code>,{' '}
              <code className="text-sky-300">StudentName</code>,{' '}
              <code className="text-amber-300">Semester</code> <span className="text-sky-300/50">(optional)</span>,{' '}
              <code className="text-amber-300">Regulation</code> <span className="text-sky-300/50">(optional)</span>,{' '}
              then subject codes as remaining columns.
            </p>
            <p>
              Choose <span className="text-amber-300 font-semibold">From file</span> in the Semester / Regulation dropdowns to read those values from each row in the file. If a row is missing them, the fallback dropdown value will be used.
            </p>
          </div>
        </div>

        {deptsLoading ? (
          <div className="h-40 flex items-center justify-center text-xs text-sky-300">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading parameters...
          </div>
        ) : (
          <form onSubmit={handleUpload} className="space-y-6">

            {/* Controls row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* Department */}
              <div>
                <label className="block text-[10px] font-bold text-sky-300 uppercase tracking-wider mb-2">
                  Department
                </label>
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

              {/* Semester — with "From file" option */}
              <div>
                <label className="block text-[10px] font-bold text-sky-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  Semester
                  {semIsFromFile && (
                    <span className="text-amber-400 text-[9px] font-normal normal-case border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 rounded-md">
                      reading from file
                    </span>
                  )}
                </label>
                <select
                  value={selectedSem}
                  onChange={e => setSelectedSem(e.target.value)}
                  className={`w-full bg-[#071830] border rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none transition-colors ${
                    semIsFromFile
                      ? 'border-amber-500/40 focus:border-amber-500'
                      : 'border-sky-500/20 focus:border-sky-500'
                  }`}
                >
                  <option value={FROM_FILE}>— From file —</option>
                  {[...Array(8)].map((_, i) => (
                    <option key={i + 1} value={String(i + 1)}>Semester {i + 1}</option>
                  ))}
                </select>
              </div>

              {/* Regulation — with "From file" option */}
              <div>
                <label className="block text-[10px] font-bold text-sky-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  Regulation
                  {regIsFromFile && (
                    <span className="text-amber-400 text-[9px] font-normal normal-case border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 rounded-md">
                      reading from file
                    </span>
                  )}
                </label>
                <select
                  value={selectedReg}
                  onChange={e => setSelectedReg(e.target.value)}
                  className={`w-full bg-[#071830] border rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none transition-colors ${
                    regIsFromFile
                      ? 'border-amber-500/40 focus:border-amber-500'
                      : 'border-sky-500/20 focus:border-sky-500'
                  }`}
                >
                  <option value={FROM_FILE}>— From file —</option>
                  {regulations.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Batch Name */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-sky-300 uppercase tracking-wider">
                Batch Name *
              </label>
              <input
                type="text"
                required
                value={batchName}
                onChange={e => setBatchName(e.target.value)}
                placeholder="e.g. IT Batch 1 – Semester 3 (June 2026)"
                className="w-full bg-[#071830] border border-sky-500/20 focus:border-sky-500 rounded-xl px-4 py-3 text-xs text-white placeholder-sky-300/30 focus:outline-none transition-colors"
              />
              <p className="text-[10px] text-sky-300/40">
                This name will group all calculated student GPA records in the batch results view.
              </p>
            </div>

            {/* Drag & Drop zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-sky-400/60 bg-sky-500/10 scale-[1.01]'
                  : file
                    ? 'border-emerald-500/35 bg-emerald-500/5 hover:bg-emerald-500/8'
                    : 'border-sky-500/20 hover:border-sky-500/40 hover:bg-sky-500/5'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept={ACCEPTED_TYPES}
                className="hidden"
              />
              <FileIcon />
              {file ? (
                <div>
                  <p className="text-sm font-bold text-emerald-400">{file.name}</p>
                  <p className="text-xs text-sky-300/50 mt-1">
                    {(file.size / 1024).toFixed(1)} KB — click to change
                  </p>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="mt-3 inline-flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 px-2.5 py-1 rounded-lg transition-all"
                  >
                    <X className="h-3 w-3" /> Remove
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-white mb-1">
                    Drop your file here or click to browse
                  </p>
                  <p className="text-xs text-sky-300/50">
                    Supported: <code className="text-sky-300">.xlsx</code> · <code className="text-sky-300">.xls</code> · <code className="text-sky-300">.csv</code> · <code className="text-sky-300">.pdf</code>
                  </p>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !file || !batchName.trim()}
              className="flex items-center justify-center gap-2 w-full py-4 bg-gradient-to-r from-sky-500 to-purple-600 hover:from-sky-500 hover:to-purple-700 text-white font-bold rounded-2xl shadow-lg transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing bulk records...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>Execute Bulk Calculation</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* Result feedback */}
      {result && (
        <div className="bg-white/[0.02] border border-emerald-500/15 rounded-3xl p-6 backdrop-blur-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-500/10 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CheckCircle className="h-4.5 w-4.5 text-emerald-400" />
              Batch Processing &amp; PDF Download Complete
            </h3>
            <Link
              to="/dashboard/bulk/gpa/batches"
              className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 hover:text-white bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 px-3 py-2 rounded-xl transition-all duration-200 whitespace-nowrap"
            >
              <FileText className="h-3.5 w-3.5" />
              View Batch Results
            </Link>
          </div>
          <div className="space-y-2 text-xs leading-relaxed text-sky-200/80">
            <p>
              Your student records have been successfully calculated and saved to the database under the batch.
            </p>
            <p>
              The multi-page PDF report has been compiled and triggered for automatic download in your browser.
            </p>
            <p className="text-emerald-400/70 mt-1 font-semibold">
              ✓ Student GPA records stored — view them in the <strong>Batch Results</strong> panel.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
