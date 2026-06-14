'use client';

import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  Loader2,
  Search,
  RefreshCw,
  FileText,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { api, GpaRecord } from '@/lib/api';

interface Batch {
  batchId: string;
  batchName: string;
  department: string;
  semester: number;
  regulation?: string;
  count: number;
  avgGpa: number;
  createdAt: string;
}

export default function BatchResultsPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Accordion state
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [batchRecords, setBatchRecords] = useState<Record<string, GpaRecord[]>>({});
  const [loadingRecords, setLoadingRecords] = useState<Record<string, boolean>>({});

  // Downloading indicators
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingBatchId, setDownloadingBatchId] = useState<string | null>(null);

  const [currentUser, setCurrentUser] = useState<any>(null);

  const fetchBatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const u = api.getCurrentUser();
      setCurrentUser(u);
      
      const dept = u?.role !== 'super_admin' ? u?.department : undefined;
      const data = await api.getBatches(dept);
      setBatches(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load batches.');
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const u = api.getCurrentUser();
      setCurrentUser(u);
      const dept = u?.role !== 'super_admin' ? u?.department : undefined;
      const data = await api.getBatches(dept);
      setBatches(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load batches.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteRecord = async (recordId: string, name: string, batchId: string) => {
    if (!window.confirm(`Are you sure you want to delete the GPA record for "${name}"?`)) {
      return;
    }

    try {
      await api.deleteGpaRecord(recordId);
      
      // Update local state for batch records
      if (batchRecords[batchId]) {
        const updatedRecords = batchRecords[batchId].filter(r => r._id !== recordId);
        setBatchRecords(prev => ({ ...prev, [batchId]: updatedRecords }));
        
        // Update batch counts and averages locally in state
        setBatches(prev => prev.map(b => {
          if (b.batchId === batchId) {
            const newCount = b.count - 1;
            if (newCount <= 0) {
              // If batch is empty, reload/refresh list
              setTimeout(() => loadData(), 500);
            }
            const newAvg = updatedRecords.length > 0 
              ? updatedRecords.reduce((sum, r) => sum + r.gpa, 0) / updatedRecords.length 
              : 0;
            return { ...b, count: newCount, avgGpa: newAvg };
          }
          return b;
        }).filter(b => b.count > 0));
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete record');
    }
  };

  const handleDeleteBatch = async (batchId: string, name: string) => {
    if (!window.confirm(`WARNING: This will permanently delete the entire batch "${name}" and all student grade records inside it.\n\nAre you sure you want to proceed?`)) {
      return;
    }

    try {
      setLoading(true);
      await api.deleteBatch(batchId);
      setExpandedBatchId(null);
      // Remove batch records from cache
      setBatchRecords(prev => {
        const next = { ...prev };
        delete next[batchId];
        return next;
      });
      // Refresh list from server
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete batch');
      setLoading(false);
    }
  };

  const toggleBatch = async (batchId: string) => {
    if (expandedBatchId === batchId) {
      setExpandedBatchId(null);
      return;
    }

    setExpandedBatchId(batchId);

    // If records are not loaded yet, fetch them
    if (!batchRecords[batchId]) {
      setLoadingRecords(prev => ({ ...prev, [batchId]: true }));
      try {
        const records = await api.getBatchRecords(batchId);
        setBatchRecords(prev => ({ ...prev, [batchId]: records }));
      } catch (err: any) {
        console.error('Failed to load batch records:', err);
      } finally {
        setLoadingRecords(prev => ({ ...prev, [batchId]: false }));
      }
    }
  };

  const handleDownloadStudentPdf = async (recordId: string, regNo: string) => {
    try {
      setDownloadingId(recordId);
      const blob = await api.downloadGpaReportPdf(recordId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const currentSem = expandedBatchId ? batchRecords[expandedBatchId]?.[0]?.semester || '' : '';
      a.download = `GPA_Sem_${currentSem}_${regNo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Failed to download GPA report PDF.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadBatchPdf = async (batchId: string, batchName: string) => {
    try {
      setDownloadingBatchId(batchId);
      const blob = await api.downloadBatchPdf(batchId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Batch_${batchName.replace(/\s+/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Failed to download full batch PDF.');
    } finally {
      setDownloadingBatchId(null);
    }
  };

  const filteredBatches = batches.filter(b =>
    b.batchName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.batchId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2 font-['Outfit']">
            <FileSpreadsheet className="h-5 w-5 text-sky-400" />
            GPA Batch Results
          </h1>
          <p className="text-xs text-sky-200/40 mt-0.5">
            View bulk GPA calculations grouped by upload batches.
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-4 py-2 border border-sky-500/15 hover:border-sky-500/35 bg-sky-500/5 hover:bg-sky-500/10 text-xs font-semibold text-sky-300 hover:text-white rounded-xl transition-all cursor-pointer whitespace-nowrap"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Search Filter */}
      <div className="relative max-w-md">
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-sky-400/40">
          <Search className="h-4 w-4" />
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search batches by name..."
          className="w-full pl-10 pr-4 py-2.5 bg-white/[0.02] border border-sky-500/10 focus:border-sky-500/40 rounded-xl text-xs text-white placeholder-sky-300/30 focus:outline-none transition-colors"
        />
      </div>

      {/* Main content area */}
      {loading ? (
        <div className="h-60 flex flex-col items-center justify-center text-sky-300 gap-3">
          <div className="relative">
            <div className="w-10 h-10 border-2 border-sky-500/20 rounded-full" />
            <div className="absolute inset-0 w-10 h-10 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-xs text-sky-300/50">Fetching batches...</p>
        </div>
      ) : error ? (
        <div className="bg-red-500/8 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : filteredBatches.length === 0 ? (
        <div className="glass-card border border-sky-500/10 rounded-2xl p-10 text-center text-sky-300/50">
          <FileSpreadsheet className="h-10 w-10 mx-auto text-sky-400/20 mb-3" />
          <p className="text-sm font-semibold">No batches found</p>
          <p className="text-xs mt-1">
            {searchQuery ? 'Try adjusting your search criteria.' : 'Create a batch using the Bulk GPA Upload tool.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBatches.map(batch => {
            const isExpanded = expandedBatchId === batch.batchId;
            const records = batchRecords[batch.batchId] || [];
            const isRecLoading = loadingRecords[batch.batchId];

            return (
              <div
                key={batch.batchId}
                className={`glass-card border rounded-2xl transition-all duration-300 ${
                  isExpanded ? 'border-sky-500/25 bg-sky-500/[0.01]' : 'border-sky-500/10 hover:border-sky-500/20'
                }`}
              >
                {/* Batch Header / Accordion trigger */}
                <div
                  onClick={() => toggleBatch(batch.batchId)}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="text-[9px] font-bold px-2.5 py-0.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-300 uppercase tracking-wider">
                        {batch.department}
                      </span>
                      <span className="text-[9px] font-bold px-2.5 py-0.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-300 uppercase tracking-wider">
                        Sem {batch.semester}
                      </span>
                      {batch.regulation && (
                        <span className="text-[9px] font-bold px-2.5 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 uppercase tracking-wider">
                          {batch.regulation}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-white leading-snug truncate font-['Outfit']">
                      {batch.batchName}
                    </h3>
                    <div className="flex items-center gap-3 text-[10px] text-sky-300/40 mt-2">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3 text-sky-400/50" />
                        {new Date(batch.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1.5">
                        <GraduationCap className="h-3.5 w-3.5 text-sky-400/50" />
                        {batch.count} Students
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    {/* Stats */}
                    <div className="bg-white/[0.02] border border-sky-500/5 rounded-xl px-3.5 py-1.5 text-center min-w-[70px]">
                      <div className={`text-xs font-black ${
                        batch.avgGpa >= 7.5 ? 'text-emerald-400' : batch.avgGpa >= 5.0 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {batch.avgGpa.toFixed(2)}
                      </div>
                      <div className="text-[8px] text-sky-300/35 uppercase tracking-wider mt-0.5">Avg GPA</div>
                    </div>

                    {/* Download Batch PDF button */}
                    <button
                      type="button"
                      disabled={downloadingBatchId !== null}
                      onClick={e => {
                        e.stopPropagation();
                        handleDownloadBatchPdf(batch.batchId, batch.batchName);
                      }}
                      className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 hover:text-white bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/15 hover:border-emerald-500/35 px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-40"
                      title="Download Full Batch PDF (all student results)"
                    >
                      {downloadingBatchId === batch.batchId ? (
                        <Loader2 className="h-3 w-3 animate-spin text-emerald-400" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      <span className="hidden sm:inline">Full PDF</span>
                    </button>

                    {/* Delete Batch button */}
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        handleDeleteBatch(batch.batchId, batch.batchName);
                      }}
                      className="flex items-center justify-center p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/15 hover:border-red-500/35 rounded-xl text-red-400 hover:text-red-300 transition-all duration-200 cursor-pointer w-9 h-9"
                      title="Delete Batch"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>

                    {/* Accordion Arrow */}
                    <div className="p-2 bg-sky-500/5 border border-sky-500/10 rounded-lg text-sky-300">
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details Section */}
                {isExpanded && (
                  <div className="border-t border-sky-500/10 p-5 bg-[#070420]/30 rounded-b-2xl">
                    {isRecLoading ? (
                      <div className="py-8 flex items-center justify-center text-xs text-sky-300">
                        <Loader2 className="h-4.5 w-4.5 animate-spin mr-2" /> Loading student records...
                      </div>
                    ) : records.length === 0 ? (
                      <div className="py-4 text-center text-xs text-sky-300/40 font-medium">
                        No records found inside this batch.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-sky-500/10 text-sky-300/40 font-bold uppercase tracking-wider text-[9px]">
                              <th className="py-2.5 px-3">Register No</th>
                              <th className="py-2.5 px-3">Student Name</th>
                              <th className="py-2.5 px-3 text-center">Semester</th>
                              <th className="py-2.5 px-3 text-center">GPA</th>
                              <th className="py-2.5 px-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {records.map((rec, index) => (
                              <tr
                                key={rec._id}
                                className={`border-b border-sky-500/5 hover:bg-sky-500/[0.02] transition-colors ${
                                  index % 2 === 0 ? 'bg-white/[0.01]' : ''
                                }`}
                              >
                                <td className="py-3 px-3 font-mono text-white/90">{rec.registerNo}</td>
                                <td className="py-3 px-3 font-semibold text-white/80">{rec.studentName}</td>
                                <td className="py-3 px-3 text-center text-sky-200/60">{rec.semester}</td>
                                <td className="py-3 px-3 text-center">
                                  <span className={`font-bold px-2 py-0.5 rounded-md ${
                                    rec.gpa >= 7.5 ? 'text-emerald-400 bg-emerald-500/5 border border-emerald-500/10' : rec.gpa >= 5.0 ? 'text-amber-400 bg-amber-500/5 border border-amber-500/10' : 'text-red-400 bg-red-500/5 border border-red-500/10'
                                  }`}>
                                    {rec.gpa.toFixed(2)}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      disabled={downloadingId !== null}
                                      onClick={() => handleDownloadStudentPdf(rec._id, rec.registerNo)}
                                      className="inline-flex items-center gap-1.5 text-[10px] font-bold text-sky-300 hover:text-white bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/15 hover:border-sky-500/35 px-3 py-1.5 rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-40"
                                      title="Download individual GPA PDF"
                                    >
                                      {downloadingId === rec._id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <FileText className="h-3.5 w-3.5" />
                                      )}
                                      <span>Download PDF</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteRecord(rec._id, rec.studentName, batch.batchId)}
                                      className="inline-flex items-center justify-center p-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/45 rounded-xl text-red-400 hover:text-red-300 transition-all duration-200 cursor-pointer"
                                      title="Delete Student Record"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
