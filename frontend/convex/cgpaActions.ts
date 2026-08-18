"use node";

// Polyfill DOMMatrix & Path2D required by pdfjs-dist / pdf-parse in Node environments
if (typeof (globalThis as any).DOMMatrix === "undefined") {
  class DOMMatrixPolyfill {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    m11 = 1; m12 = 0; m13 = 0; m14 = 0;
    m21 = 0; m22 = 1; m23 = 0; m24 = 0;
    m31 = 0; m32 = 0; m33 = 1; m34 = 0;
    m41 = 0; m42 = 0; m43 = 0; m44 = 1;
    is2D = true;
    isIdentity = true;
    constructor(init?: any) {
      if (Array.isArray(init) && init.length >= 6) {
        this.a = this.m11 = init[0];
        this.b = this.m12 = init[1];
        this.c = this.m21 = init[2];
        this.d = this.m22 = init[3];
        this.e = this.m41 = init[4];
        this.f = this.m42 = init[5];
      }
    }
    multiply() { return this; }
    translate() { return this; }
    scale() { return this; }
    rotate() { return this; }
    skewX() { return this; }
    skewY() { return this; }
    inverse() { return this; }
    transformPoint(p: any) { return p || { x: 0, y: 0, z: 0, w: 1 }; }
    toFloat32Array() { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); }
    toFloat64Array() { return new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); }
  }
  (globalThis as any).DOMMatrix = DOMMatrixPolyfill;
}

if (typeof (globalThis as any).Path2D === "undefined") {
  class Path2DPolyfill {
    addPath() {}
    closePath() {}
    moveTo() {}
    lineTo() {}
    quadraticCurveTo() {}
    bezierCurveTo() {}
    arc() {}
    arcTo() {}
    ellipse() {}
    rect() {}
  }
  (globalThis as any).Path2D = Path2DPolyfill;
}

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
    const blob = await ctx.storage.get(args.storageId);
    if (!blob) throw new Error("File not found in storage");
    const arrayBuffer = await blob.arrayBuffer();
    const activeDept = args.department.toUpperCase();
    const regulation = args.regulation.toUpperCase();

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdf = require("pdf-parse");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const xlsx = require("xlsx");

    // ── Step 1: Fetch total credits per semester from DB ────────────────────
    // Priority: 1) semesterCredits configuration table, 2) subjects table
    const semCreditsMap = new Map<number, number>();

    const configuredCreditsMap: Record<number, number> = await ctx.runQuery(
      api.semesterCredits.getByDeptReg,
      { department: activeDept, regulation }
    );

    if (configuredCreditsMap) {
      for (const [semStr, creds] of Object.entries(configuredCreditsMap)) {
        const sem = Number(semStr);
        if (creds > 0) semCreditsMap.set(sem, creds);
      }
    }

    const allSubjects: any[] = await ctx.runQuery(api.subjects.get, {
      department: activeDept,
      regulation: regulation,
    });

    for (const s of allSubjects) {
      if (!semCreditsMap.has(s.semester)) {
        semCreditsMap.set(s.semester, (semCreditsMap.get(s.semester) || 0) + (s.credits || 0));
      }
    }

    // ── Step 2: Parse uploaded file (PDF or Excel) — extract only GPA values ─
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
          // Only extract the GPA value; credits will come from the database
          const combined = block.match(new RegExp(`Sem(?:ester)?\\s*${sem}\\s*[:\\-\\s]?\\s*\\b(\\d+(?:\\.\\d+)?)\\b\\s*(?:GPA)?\\s*\\b(\\d+)\\b`, "i"));
          if (combined) { semesters.push({ semester: sem, gpa: parseFloat(combined[1]) }); continue; }
          const gpaM = block.match(new RegExp(`Sem(?:ester)?\\s*${sem}\\s*(?:GPA)?\\s*[:\\-\\s]?\\s*\\b(\\d+(?:\\.\\d+)?)\\b`, "i"));
          if (gpaM && parseFloat(gpaM[1]) > 0) semesters.push({ semester: sem, gpa: parseFloat(gpaM[1]) });
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
              if (!isNaN(gpa) && gpa > 0) { semesters.push({ semester: sem, gpa }); break; }
            }
          }
        }
        if (semesters.length) parsedStudents.push({ registerNo, studentName, semesters });
      }
    }

    if (!parsedStudents.length) throw new Error("No valid student records found.");

    // ── Step 3: Compute credit-weighted CGPA using DB-fetched semester credits ─
    const recordsToWrite: any[] = [];
    const errors: string[] = [];

    for (let i = 0; i < parsedStudents.length; i++) {
      const { registerNo, studentName, semesters } = parsedStudents[i];
      try {
        let gpaSum = 0;
        let countedSems = 0;
        let totalCredits = 0;
        let totalWeightedPoints = 0;

        const formattedSemesters = semesters.map((s: any) => {
          const credits = semCreditsMap.get(s.semester) || 0;   // always from DB
          if (s.gpa > 0) {
            gpaSum += s.gpa;
            countedSems++;
            if (credits > 0) {
              totalCredits += credits;
              totalWeightedPoints += s.gpa * credits;
            }
          }
          return { semester: s.semester, gpa: s.gpa, credits };
        });

        // Weighted CGPA: Σ(GPA × Credits) / Σ(Credits)
        const cgpa = totalCredits > 0
          ? parseFloat((totalWeightedPoints / totalCredits).toFixed(2))
          : (countedSems > 0 ? parseFloat((gpaSum / countedSems).toFixed(2)) : 0);

        recordsToWrite.push({
          studentName,
          registerNo,
          department: activeDept,
          regulation,
          semesters: formattedSemesters,
          totalCredits,
          cgpa,
          calculatedBy: args.userId,
          isBulk: true,
        });
      } catch (err: any) {
        errors.push(`Record ${i + 1} (${studentName || registerNo}): ${err.message}`);
      }
    }

    if (!recordsToWrite.length) throw new Error("All calculations failed:\n" + errors.join("\n"));

    const result = (await ctx.runMutation(api.cgpa.bulkInsert, { records: recordsToWrite, userId: args.userId })) as any;
    await ctx.storage.delete(args.storageId);
    return { message: `Successfully calculated ${result.count} CGPA records.`, recordsCount: result.count, errors };
  },
});
