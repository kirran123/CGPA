"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const bulkCalculate = action({
  args: {
    storageId: v.string(),
    department: v.string(),
    regulation: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const arrayBuffer = await ctx.storage.get(args.storageId);
    if (!arrayBuffer) throw new Error("File not found in storage");
    const activeDept = args.department.toUpperCase();
    const regulation = args.regulation.toUpperCase();

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdf = require("pdf-parse");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const xlsx = require("xlsx");

    let parsedStudents: any[] = [];
    const bytes = new Uint8Array(arrayBuffer.slice(0, 4));
    const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;

    if (isPdf) {
      const data = await pdf(Buffer.from(arrayBuffer));
      const text = String(data.text || "").replace(/[\u00A0\s]+/g, " ").trim();
      if (!text) throw new Error("PDF is empty or not selectable text.");
      const lines = text.split("\n").map((l: string) => l.trim()).filter(Boolean);
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
      if (!studentIndices.length) throw new Error("No student register numbers found in CGPA PDF.");

      for (let i = 0; i < studentIndices.length; i++) {
        const cur = studentIndices[i];
        const nxt = studentIndices[i + 1];
        const block = lines.slice(cur.lineIdx, nxt ? nxt.lineIdx : lines.length).join(" ");
        const semesters: any[] = [];
        for (let sem = 1; sem <= 8; sem++) {
          const combined = block.match(new RegExp(`Sem(?:ester)?\\s*${sem}\\s*[:\\-\\s]?\\s*\\b(\\d+(?:\\.\\d+)?)\\b\\s*(?:GPA)?\\s*\\b(\\d+)\\b`, "i"));
          if (combined) { semesters.push({ semester: sem, gpa: parseFloat(combined[1]), credits: parseInt(combined[2]) }); continue; }
          const gpaM = block.match(new RegExp(`Sem(?:ester)?\\s*${sem}\\s*(?:GPA)?\\s*[:\\-\\s]?\\s*\\b(\\d+(?:\\.\\d+)?)\\b`, "i"));
          const credM = block.match(new RegExp(`Sem(?:ester)?\\s*${sem}\\s*(?:Credits|Cred|C)?\\s*[:\\-\\s]?\\s*\\b(\\d+)\\b`, "i"));
          if (gpaM && parseFloat(gpaM[1]) > 0) semesters.push({ semester: sem, gpa: parseFloat(gpaM[1]), credits: credM ? parseInt(credM[1]) : 0 });
        }
        if (semesters.length) parsedStudents.push({ registerNo: cur.regNo, studentName: cur.name, semesters });
      }
    } else {
      const workbook = xlsx.read(new Uint8Array(arrayBuffer), { type: "array" });
      const rawData: any[] = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      if (!rawData.length) throw new Error("Excel sheet is empty.");
      for (const row of rawData as any[]) {
        const registerNo = String(row.RegisterNo || row["Register No"] || "").trim();
        const studentName = String(row.StudentName || row["Student Name"] || "").trim();
        if (!registerNo || !studentName) continue;
        const semesters: any[] = [];
        for (let sem = 1; sem <= 8; sem++) {
          for (const k of [`Sem${sem}_GPA`, `Sem ${sem} GPA`, `Sem_${sem}_GPA`]) {
            if (row[k] !== undefined) {
              const gpa = parseFloat(row[k]);
              if (!isNaN(gpa) && gpa > 0) { semesters.push({ semester: sem, gpa, credits: 0 }); break; }
            }
          }
        }
        if (semesters.length) parsedStudents.push({ registerNo, studentName, semesters });
      }
    }

    if (!parsedStudents.length) throw new Error("No valid student records found.");

    const recordsToWrite: any[] = [];
    const errors: string[] = [];
    for (let i = 0; i < parsedStudents.length; i++) {
      const { registerNo, studentName, semesters } = parsedStudents[i];
      try {
        let gpaSum = 0, countedSems = 0, totalCredits = 0;
        semesters.forEach((s: any) => { if (s.gpa > 0) { gpaSum += s.gpa; countedSems++; totalCredits += s.credits || 0; } });
        const cgpa = countedSems > 0 ? parseFloat((gpaSum / countedSems).toFixed(2)) : 0;
        recordsToWrite.push({ studentName, registerNo, department: activeDept, regulation, semesters, totalCredits, cgpa, calculatedBy: args.userId, isBulk: true });
      } catch (err: any) {
        errors.push(`Record ${i + 1} (${studentName || registerNo}): ${err.message}`);
      }
    }

    if (!recordsToWrite.length) throw new Error("All calculations failed:\n" + errors.join("\n"));
    const result = await ctx.runMutation(api.cgpa.bulkInsert, { records: recordsToWrite, userId: args.userId });
    await ctx.storage.delete(args.storageId);
    return { message: `Successfully calculated ${result.count} CGPA records.`, recordsCount: result.count, errors };
  },
});
