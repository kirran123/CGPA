'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Check, X, User } from 'lucide-react';

export interface StudentOption {
  _id?: string;
  registerNo: string;
  name: string;
  department?: string;
  batch?: string;
}

interface SearchableStudentSelectProps {
  students: StudentOption[];
  value: string; // registerNo or _id
  valueKey?: 'registerNo' | '_id';
  onChange: (value: string, student?: StudentOption) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function SearchableStudentSelect({
  students,
  value,
  valueKey = 'registerNo',
  onChange,
  placeholder = 'Search & choose student...',
  disabled = false,
  className = '',
}: SearchableStudentSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Find currently selected student
  const selectedStudent = students.find((s) =>
    valueKey === '_id' ? s._id === value : s.registerNo.toUpperCase() === value.toUpperCase()
  );

  // Calculate dropdown position from trigger element
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = Math.min(320, spaceBelow - 8);

    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      maxHeight: dropdownHeight,
      zIndex: 99999,
    });
  }, []);

  // Open/close
  const openDropdown = () => {
    if (disabled) return;
    updatePosition();
    setIsOpen(true);
  };

  const closeDropdown = () => {
    setIsOpen(false);
    setQuery('');
  };

  // Auto-focus search on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isOpen]);

  // Recalculate position on scroll/resize
  useEffect(() => {
    if (!isOpen) return;
    const update = () => updatePosition();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [isOpen, updatePosition]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current && triggerRef.current.contains(target)
      ) return;
      if (
        dropdownRef.current && dropdownRef.current.contains(target)
      ) return;
      closeDropdown();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const filteredStudents = React.useMemo(() => {
    if (!query.trim()) return students.slice(0, 100);
    const q = query.trim().toLowerCase();
    return students
      .filter(
        (s) =>
          s.registerNo.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          (s.department && s.department.toLowerCase().includes(q))
      )
      .slice(0, 100);
  }, [students, query]);

  const handleSelect = (s: StudentOption) => {
    const val = valueKey === '_id' ? (s._id || s.registerNo) : s.registerNo;
    onChange(val, s);
    closeDropdown();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setQuery('');
  };

  const dropdown = isOpen && typeof window !== 'undefined' ? createPortal(
    <div
      ref={dropdownRef}
      style={dropdownStyle}
      className="bg-[#071830] border border-sky-500/25 rounded-xl shadow-2xl overflow-hidden backdrop-blur-2xl"
    >
      {/* Sticky Search Bar */}
      <div className="p-2 border-b border-sky-500/15 bg-sky-500/[0.03] sticky top-0">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && closeDropdown()}
            placeholder="Search name or reg no..."
            className="w-full bg-[#040f24] border border-sky-500/20 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-sky-400/30 focus:outline-none focus:border-sky-500/50"
          />
          <Search className="h-3.5 w-3.5 text-sky-400/40 absolute left-2.5 top-2 pointer-events-none" />
        </div>
      </div>

      {/* Options List */}
      <div className="overflow-y-auto divide-y divide-sky-500/5" style={{ maxHeight: 220 }}>
        {filteredStudents.length === 0 ? (
          <div className="p-4 text-center text-xs text-sky-300/40">No matching students found</div>
        ) : (
          filteredStudents.map((s) => {
            const isSelected =
              valueKey === '_id' ? s._id === value : s.registerNo.toUpperCase() === value.toUpperCase();
            return (
              <div
                key={s._id || s.registerNo}
                onMouseDown={(e) => {
                  e.preventDefault(); // prevent blur before select fires
                  handleSelect(s);
                }}
                className={`px-3 py-2 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-sky-500/20 text-white font-semibold'
                    : 'hover:bg-sky-500/10 text-sky-200/90'
                }`}
              >
                <div className="truncate">
                  <span className="font-mono font-bold text-sky-400 mr-2">{s.registerNo}</span>
                  <span>{s.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {s.department && (
                    <span className="text-[9px] font-bold bg-sky-500/15 text-sky-300 px-1.5 py-0.5 rounded">
                      {s.department}
                    </span>
                  )}
                  {isSelected && <Check className="h-3.5 w-3.5 text-sky-400" />}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="px-3 py-1.5 border-t border-sky-500/10 bg-sky-500/[0.02] text-[10px] text-sky-300/40 text-right">
        Showing {filteredStudents.length} of {students.length} students
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <div ref={triggerRef} className={`relative w-full ${className}`}>
        {/* Trigger */}
        <div
          onClick={openDropdown}
          className={`w-full bg-[#071830] border rounded-xl px-3 py-2 text-xs text-white flex items-center justify-between gap-2 cursor-pointer transition-all ${
            isOpen ? 'border-sky-500 ring-2 ring-sky-500/15' : 'border-sky-500/18 hover:border-sky-500/40'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
            <User className="h-3.5 w-3.5 text-sky-400 shrink-0" />
            {selectedStudent ? (
              <span className="font-medium text-white truncate">
                <span className="font-mono font-bold text-sky-400 mr-1.5">{selectedStudent.registerNo}</span>
                - {selectedStudent.name}
                {selectedStudent.department && (
                  <span className="text-[10px] text-sky-300/60 ml-1.5 font-semibold">({selectedStudent.department})</span>
                )}
              </span>
            ) : (
              <span className="text-sky-300/40">{placeholder}</span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {selectedStudent && (
              <button
                type="button"
                onClick={handleClear}
                className="text-sky-300/40 hover:text-white p-0.5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <ChevronDown className={`h-3.5 w-3.5 text-sky-400/60 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </div>

      {/* Portal dropdown — renders outside all parent containers */}
      {dropdown}
    </>
  );
}
