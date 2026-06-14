'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import { 
  Cpu, 
  UploadCloud, 
  Loader2, 
  CheckCircle, 
  AlertTriangle,
  Save,
  Trash2,
  Plus,
  FileText
} from 'lucide-react';
import { api, Department } from '@/lib/api';
import { canEditRecords as canEditRecordsFn } from '@/lib/permissions';

interface ScannedSubject {
  id: string;
  subjectCode: string;
  subjectName: string;
  credits: number;
  grade: string;
}

export default function OcrDashboardScanner() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedSem, setSelectedSem] = useState(1);
  const [regulation, setRegulation] = useState('');
  const [regulations, setRegulations] = useState<string[]>([]);

  const [ocrLoading, setOcrLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [scannedRows, setScannedRows] = useState<ScannedSubject[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [studentName, setStudentName] = useState('');
  const [registerNo, setRegisterNo] = useState('');
  const canEditRecords = canEditRecordsFn();
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const gradePoints: { [key: string]: number } = {
    'O': 10, 'A+': 9, 'A': 8, 'B+': 7, 'B': 6, 'C': 5, 'U': 0
  };

  useEffect(() => {
    const fetchParams = async () => {
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

        // Fetch dynamic regulations
        const regs = await api.getRegulations();
        const regNames = regs.map((r: any) => r.name);
        setRegulations(regNames);
        if (regNames.length > 0) {
          if (regNames.includes('R2021')) {
            setRegulation('R2021');
          } else {
            setRegulation(regNames[0]);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchParams();
  }, []);

  const handleOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrLoading(true);
    setStatusMsg(null);
    setErrorMsg(null);

    try {
      const worker = await createWorker('eng');
      const ret = await worker.recognize(file);
      await worker.terminate();

      const text = ret.data.text;
      console.log('OCR Output Text:', text);

      // Regex matching
      const lines = text.split('\n');
      const parsedRows: ScannedSubject[] = [];
      const codeRegex = /[A-Z]{2,4}\d{4}/i;
      const grades = ['O', 'A\\+', 'A', 'B\\+', 'B', 'C', 'U', 'RA'];
      const gradeRegex = new RegExp(`\\b(${grades.join('|')})\\b`, 'i');

      let counter = 1;
      lines.forEach(line => {
        const codeMatch = line.match(codeRegex);
        if (codeMatch) {
          const code = codeMatch[0].toUpperCase();
          const gradeMatch = line.match(gradeRegex);
          let grade = gradeMatch ? gradeMatch[0].toUpperCase() : '';
          if (grade === 'RA') grade = 'U';

          parsedRows.push({
            id: String(counter++),
            subjectCode: code,
            subjectName: `Extracted Subject ${code}`,
            credits: 3,
            grade
          });
        }
      });

      if (parsedRows.length > 0) {
        setScannedRows(parsedRows);
        setStatusMsg(`Successfully extracted ${parsedRows.length} subjects. Please review and input student details to save.`);
      } else {
        setErrorMsg('Failed to find subject codes. Try a higher-resolution scan.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred while processing OCR.');
    } finally {
      setOcrLoading(false);
    }
  };

  const updateField = (id: string, field: keyof ScannedSubject, value: any) => {
    setScannedRows(scannedRows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const removeRow = (id: string) => {
    setScannedRows(scannedRows.filter(r => r.id !== id));
  };

  const addRow = () => {
    const nextId = String(scannedRows.length + 1);
    setScannedRows([...scannedRows, { id: nextId, subjectCode: '', subjectName: 'Custom Course', credits: 3, grade: '' }]);
  };

  const handleSave = async () => {
    if (!studentName || !registerNo) {
      alert('Please fill out student name and register number before saving.');
      return;
    }

    setSaving(true);
    setStatusMsg(null);
    setErrorMsg(null);

    const payload = {
      studentName,
      registerNo,
      semester: selectedSem,
      department: selectedDept,
      regulation,
      subjects: scannedRows.map(r => ({
        subjectCode: r.subjectCode,
        grade: r.grade || 'U'
      }))
    };

    try {
      await api.calculateGpa(payload);
      setStatusMsg(`GPA record for ${studentName} successfully created via OCR parse and stored in database!`);
      setScannedRows([]);
      setStudentName('');
      setRegisterNo('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save scanned record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {statusMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-2xl text-xs flex items-center gap-2 animate-scale-in">
          <CheckCircle className="h-4.5 w-4.5 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl text-xs flex items-center gap-2 animate-scale-in">
          <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scanned inputs */}
        <div className="space-y-6 animate-slide-left">
          <div className="bg-white/[0.02] border border-sky-500/10 rounded-3xl p-6 backdrop-blur-xl">
            <h2 className="text-base font-bold text-white mb-4 border-b border-sky-500/10 pb-2 flex items-center gap-2 font-['Outfit']">
              <Cpu className="h-5 w-5 text-sky-400" />
              OCR Document Upload
            </h2>

            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-sky-500/20 hover:border-sky-500/40 rounded-2xl p-8 text-center cursor-pointer transition-all hover:bg-sky-500/5 mb-6"
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleOcrUpload} 
                accept="image/*,application/pdf"
                className="hidden" 
              />
              {ocrLoading ? (
                <div className="py-2 flex flex-col items-center">
                  <Loader2 className="h-8 w-8 text-sky-400 animate-spin mb-2" />
                  <span className="text-xs font-semibold text-white">Running local OCR models...</span>
                </div>
              ) : (
                <div className="py-2 flex flex-col items-center">
                  <UploadCloud className="h-8 w-8 text-sky-400/80 mb-2" />
                  <span className="text-xs font-semibold text-white">Upload Scanned Marksheet</span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-sky-300 uppercase tracking-wider mb-2">Student Name</label>
                <input 
                  type="text" 
                  value={studentName} 
                  onChange={e => setStudentName(e.target.value)} 
                  placeholder="e.g. Name"
                  className="w-full bg-[#071830] border border-sky-500/20 focus:border-sky-500 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none placeholder:text-sky-400/25"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-sky-300 uppercase tracking-wider mb-2">Register Number</label>
                <input 
                  type="text" 
                  value={registerNo} 
                  onChange={e => setRegisterNo(e.target.value)} 
                  placeholder="e.g. 953621104012"
                  className="w-full bg-[#071830] border border-sky-500/20 focus:border-sky-500 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none placeholder:text-sky-400/25"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-sky-300 uppercase tracking-wider mb-2">Semester</label>
                  <select
                    value={selectedSem}
                    onChange={e => setSelectedSem(Number(e.target.value))}
                    className="w-full bg-[#071830] border border-sky-500/20 focus:border-sky-500 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none"
                  >
                    {[...Array(8)].map((_, i) => (
                      <option key={i+1} value={i+1}>Sem {i+1}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-sky-300 uppercase tracking-wider mb-2">Regulation</label>
                  <select
                    value={regulation}
                    onChange={e => setRegulation(e.target.value)}
                    className="w-full bg-[#071830] border border-sky-500/20 focus:border-sky-500 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none"
                  >
                    {regulations.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-sky-300 uppercase tracking-wider mb-2">Department</label>
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
            </div>
          </div>
        </div>

        {/* OCR Result details */}
        <div className="lg:col-span-2 space-y-6 animate-slide-right">
          <div className="bg-white/[0.02] border border-sky-500/10 rounded-3xl p-6 backdrop-blur-xl">
            <h2 className="text-base font-bold text-white mb-6 pb-2 border-b border-sky-500/10 font-['Outfit']">
              Parsed Subject & Grade Rows
            </h2>

            {scannedRows.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-sky-300/50 text-sm">
                <FileText className="h-8 w-8 text-sky-400/30 mb-2 animate-float" />
                Upload a marksheet to begin local analysis.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="hidden md:grid grid-cols-12 gap-4 text-xs font-semibold uppercase tracking-wider text-sky-300/80 px-2">
                  <div className="col-span-3">Subject Code</div>
                  <div className="col-span-5">Subject Name</div>
                  <div className="col-span-2 text-center">Credits</div>
                  <div className="col-span-2 text-center">Grade</div>
                </div>

                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-2">
                  {scannedRows.map((row) => (
                    <div 
                      key={row.id} 
                      className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-sky-950/20 border border-sky-500/5 p-3 rounded-2xl items-center animate-fade-in-up"
                    >
                      <div className="col-span-3">
                        <input 
                          type="text" 
                          placeholder="Code"
                          value={row.subjectCode}
                          onChange={e => canEditRecords && updateField(row.id, 'subjectCode', e.target.value.toUpperCase())}
                          disabled={!canEditRecords}
                          className={`w-full bg-[#071830] border border-sky-500/10 focus:border-sky-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none ${!canEditRecords ? 'opacity-60 cursor-not-allowed' : ''}`}
                        />
                      </div>

                      <div className="col-span-5">
                        <input 
                          type="text" 
                          placeholder="Name"
                          value={row.subjectName}
                          onChange={e => canEditRecords && updateField(row.id, 'subjectName', e.target.value)}
                          disabled={!canEditRecords}
                          className={`w-full bg-[#071830] border border-sky-500/10 focus:border-sky-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none ${!canEditRecords ? 'opacity-60 cursor-not-allowed' : ''}`}
                        />
                      </div>

                      <div className="col-span-2">
                        <select
                          value={row.credits}
                          onChange={e => canEditRecords && updateField(row.id, 'credits', Number(e.target.value))}
                          disabled={!canEditRecords}
                          className={`bg-[#071830] border border-sky-500/10 focus:border-sky-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none w-full text-center ${!canEditRecords ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          {[1,2,3,4,5,6].map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-2 flex items-center gap-2">
                        <select
                          value={row.grade}
                          onChange={e => canEditRecords && updateField(row.id, 'grade', e.target.value.toUpperCase())}
                          disabled={!canEditRecords}
                          className={`bg-[#071830] border border-sky-500/10 focus:border-sky-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none w-full text-center font-bold text-sky-400 ${!canEditRecords ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          <option value="">Grade</option>
                          <option value="O">O</option>
                          <option value="A+">A+</option>
                          <option value="A">A</option>
                          <option value="B+">B+</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                          <option value="U">U</option>
                        </select>
                        
                        <button 
                          onClick={() => canEditRecords && removeRow(row.id)}
                          disabled={!canEditRecords}
                          className={`p-2 bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 hover:border-red-500/40 rounded-xl text-red-400 transition-all cursor-pointer ${!canEditRecords ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => canEditRecords && addRow()}
                    disabled={!canEditRecords}
                    className={`flex-grow py-2.5 border border-sky-500/20 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${!canEditRecords ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <Plus className="h-4 w-4" /> Add custom entry row
                  </button>
                  
                  <button
                    onClick={handleSave}
                    disabled={saving || scannedRows.length === 0 || !canEditRecords}
                    className={`flex-grow py-2.5 bg-gradient-to-r from-sky-500 to-purple-650 hover:from-sky-500 hover:to-purple-750 text-white font-bold rounded-2xl shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer ${!canEditRecords ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4.5 w-4.5 animate-spin" />
                        <span>Logging Record...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-4.5 w-4.5" />
                        <span>Save OCR as GPA Record</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
