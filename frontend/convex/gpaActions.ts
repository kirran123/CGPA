"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

const DEFAULT_GRADE_MAP: Record<string, number> = {
  O: 10, "A+": 9, A: 8, "B+": 7, B: 6, C: 5, U: 0,
};

const META_KEYS = ["registerno","register no","register_no","studentname","student name","student_name","name","semester","sem","regulation","reg","gpa","cgpa","total","result","remarks","rank","s.no","sno","sl.no","slno","status"];

const isValidGrade = (raw: string, validGrades: Set<string>) => {
  if (!raw) return false;
  const g = String(raw).trim().toUpperCase();
  if (["","-","N/A","NA","AB","ABSENT","0","NULL","UNDEFINED"].includes(g)) return false;
  return validGrades.has(g);
};

// Pure calculation — no ctx.db access
function calcGPA(
  subjectsInput: Array<{ subjectCode: string; grade: string }>,
  subjectMap: Map<string, { name: string; credits: number }>,
  gradeMap: Record<string, number>
) {
  const validGrades = new Set(Object.keys(gradeMap));
  let totalCredits = 0, totalPoints = 0;
  const subjectsDetails: any[] = [];
  for (const s of subjectsInput) {
    if (!isValidGrade(s.grade, validGrades)) continue;
    const subject = subjectMap.get(s.subjectCode.toUpperCase());
    if (!subject) continue;
    const grade = s.grade.trim().toUpperCase();
    const gradePoint = gradeMap[grade] ?? 0;
    totalCredits += subject.credits;
    totalPoints += subject.credits * gradePoint;
    subjectsDetails.push({ subjectCode: s.subjectCode.toUpperCase(), subjectName: subject.name, grade, gradePoint, credits: subject.credits });
  }
  return { gpa: totalCredits > 0 ? parseFloat((totalPoints / totalCredits).toFixed(2)) : 0, totalCredits, totalPoints, subjects: subjectsDetails };
}

export const bulkCalculate = action({
  args: {
    storageId: v.string(),
    semester: v.string(),
    department: v.string(),
    regulation: v.string(),
    batchName: v.optional(v.string()),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const arrayBuffer = await ctx.storage.get(args.storageId);
    if (!arrayBuffer) throw new Error("File not found in storage");

    const activeDept = args.department.toUpperCase();
    const resolvedBatchName = (args.batchName || "").trim() ||
      `Batch ${new Date().toLocaleString("en-IN", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })}`;
    const batchId = `${activeDept}-${Date.now()}`;
    const FROM_FILE = "__from_file__";
    const semFromFile = args.semester === FROM_FILE;
    const regFromFile = args.regulation === FROM_FILE;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdf = require("pdf-parse");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const xlsx = require("xlsx");

    let parsedStudents: any[] = [];

    // Detect PDF by magic bytes
    const bytes = new Uint8Array(arrayBuffer.slice(0, 4));
    const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;

    if (isPdf) {
      const semNum = parseInt(args.semester);
      if (isNaN(semNum)) throw new Error("Select a specific semester when uploading a PDF.");
      const data = await pdf(Buffer.from(arrayBuffer));
      const text = String(data.text || "").replace(/[\u00A0\s]+/g, " ").trim();
      if (!text) throw new Error("PDF appears to be empty or not selectable text.");
      const lines = text.split("\n").map((l: string) => l.trim()).filter(Boolean);
      const dbSubjects: any[] = await ctx.runQuery(api.subjects.get, { department: activeDept, semester: semNum });
      if (!dbSubjects.length) throw new Error(`No subjects configured for ${activeDept} sem ${semNum}`);
      const subjectCodes = dbSubjects.map((s: any) => String(s.code).toUpperCase());

      const studentIndices: any[] = [];
      lines.forEach((line: string, idx: number) => {
        const m = line.match(/\b\d{8,12}\b/);
        if (!m) return;
        const regNo = m[0];
        let name = line.replace(regNo, "").replace(/[^a-zA-Z\s.]/g, "").trim();
        if (name.length <= 3 || !/^[A-Z]/.test(name)) {
          const next = (lines[idx + 1] || "").replace(/[^a-zA-Z\s.]/g, "").trim();
          name = next.length > 3 && /^[A-Z]/.test(next) && !next.match(/\b\d{8,12}\b/) ? next : `Student ${regNo}`;
        }
        studentIndices.push({ regNo, name, lineIdx: idx });
      });
      if (!studentIndices.length) throw new Error("No student register numbers found in PDF.");

      for (let i = 0; i < studentIndices.length; i++) {
        const cur = studentIndices[i];
        const nxt = studentIndices[i + 1];
        const block = lines.slice(cur.lineIdx, nxt ? nxt.lineIdx : lines.length).join(" ");
        const studentSubjects: any[] = [];
        const gradeOpts = "(O|A\\+|A|B\\+|B|C|U|RA|AB|UA)";
        subjectCodes.forEach((code: string) => {
          const pat = code.replace(/[^A-Z0-9]/g, "");
          const m1 = block.match(new RegExp(`\\b${pat}\\b[\\s\\S]{0,40}?\\b${gradeOpts}\\b`, "i"));
          if (m1) { let g = (m1[1] || m1[m1.length-1]).toUpperCase(); if (g==="AB"||g==="UA") g="U"; studentSubjects.push({ subjectCode: code, grade: g }); return; }
          const m2 = block.match(new RegExp(`\\b${gradeOpts}\\b[\\s\\S]{0,20}?\\b${pat}\\b`, "i"));
          if (m2) { let g = (m2[1] || m2[m2.length-1]).toUpperCase(); if (g==="AB"||g==="UA") g="U"; studentSubjects.push({ subjectCode: code, grade: g }); }
        });
        if (studentSubjects.length) {
          const rm = block.match(/\b(R2017|R2021|R2023)\b/i);
          parsedStudents.push({ registerNo: cur.regNo, studentName: cur.name, semester: semNum, regulation: rm ? rm[1].toUpperCase() : (args.regulation || "R2021"), subjects: studentSubjects });
        }
      }
    } else {
      // Excel
      const workbook = xlsx.read(new Uint8Array(arrayBuffer), { type: "array" });
      const rawData: any[] = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "", raw: true });
      if (!rawData.length) throw new Error("Excel sheet is empty.");

      const pick = (row: any, ...keys: string[]) => {
        for (const k of keys) {
          const found = Object.keys(row).find((rk) => rk.trim().toLowerCase() === k.toLowerCase());
          if (found && String(row[found]).trim()) return String(row[found]).trim();
        }
        return "";
      };
      const sanitizeReg = (val: any) => {
        const str = String(val ?? "").trim();
        if (/^[+-]?\d+(\.\d+)?[Ee][+-]?\d+$/.test(str)) { const n = Number(str); if (!isNaN(n)) return Math.round(n).toString(); }
        return str;
      };

      for (const row of rawData) {
        const registerNo = sanitizeReg(pick(row, "RegisterNo","Register No","register_no","register no"));
        if (!registerNo) continue;
        const studentName = pick(row, "StudentName","Student Name","student_name","name");
        let rowSem = semFromFile ? parseInt(pick(row,"Semester","Sem","semester","sem")) : parseInt(args.semester);
        let rowReg = regFromFile ? pick(row,"Regulation","Reg","regulation","reg") : args.regulation;
        if (isNaN(rowSem)) continue;
        const studentSubjects: any[] = [];
        Object.keys(row).forEach((key) => {
          const tk = key.trim(); const kl = tk.toLowerCase();
          if (!kl || kl.startsWith("__empty") || META_KEYS.includes(kl)) return;
          const rawGrade = String(row[key] ?? "").trim();
          if (rawGrade) studentSubjects.push({ subjectCode: tk, grade: rawGrade });
        });
        if (studentSubjects.length) parsedStudents.push({ registerNo, studentName: studentName || `Student_${registerNo}`, semester: rowSem, regulation: rowReg || "R2021", subjects: studentSubjects });
      }
    }

    if (!parsedStudents.length) throw new Error("No valid student records found.");

    // Prefetch subjects and grade maps per unique sem+reg combo
    type SubMap = Map<string, { name: string; credits: number }>;
    const subjectCache = new Map<string, SubMap>();
    const gradeCache = new Map<string, Record<string, number>>();

    for (const student of parsedStudents) {
      const key = `${student.semester}|${student.regulation}`;
      if (!subjectCache.has(key)) {
        const list: any[] = await ctx.runQuery(api.subjects.get, { department: activeDept, semester: student.semester, regulation: student.regulation });
        const sm: SubMap = new Map();
        list.forEach((s: any) => sm.set(s.code.toUpperCase(), { name: s.name, credits: s.credits }));
        subjectCache.set(key, sm);
        const grades: any[] = await ctx.runQuery(api.gradeSettings.get, { department: activeDept, regulation: student.regulation, semester: student.semester });
        gradeCache.set(key, grades.length > 0 ? grades.reduce((a: any, g: any) => { a[g.grade.toUpperCase()] = g.points; return a; }, {}) : { ...DEFAULT_GRADE_MAP });
      }
    }

    const recordsToWrite: any[] = [];
    const errors: string[] = [];

    for (let i = 0; i < parsedStudents.length; i++) {
      const { registerNo, studentName, semester, regulation, subjects } = parsedStudents[i];
      try {
        const key = `${semester}|${regulation}`;
        const sm = subjectCache.get(key)!;
        const gm = gradeCache.get(key)!;
        const { gpa, totalCredits, totalPoints, subjects: subjectsDetails } = calcGPA(subjects, sm, gm);
        recordsToWrite.push({ studentName, registerNo, semester, gpa, totalCredits, totalPoints, subjects: subjectsDetails, department: activeDept, regulation, isBulk: true, batchName: resolvedBatchName, batchId, calculatedBy: args.userId });
      } catch (err: any) {
        errors.push(`Record ${i + 1} (${studentName || registerNo}): ${err.message}`);
      }
    }

    if (!recordsToWrite.length) throw new Error("All calculations failed:\n" + errors.join("\n"));

    const result = await ctx.runMutation(api.gpa.bulkInsert, { records: recordsToWrite, userId: args.userId });
    await ctx.storage.delete(args.storageId);

    return { message: `Successfully calculated ${result.count} records.`, recordsCount: result.count, batchId, batchName: resolvedBatchName, errors };
  },
});
