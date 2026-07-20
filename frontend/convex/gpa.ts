import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_GRADE_MAP: Record<string, number> = {
  O: 10, "A+": 9, A: 8, "B+": 7, B: 6, C: 5, U: 0,
};

async function getGradePointsMap(ctx: any, department: string, regulation: string, semester: number) {
  const setting = await ctx.db
    .query("gradeSettings")
    .withIndex("by_dept_reg_sem", (q: any) =>
      q.eq("department", department.toUpperCase())
       .eq("regulation", regulation.toUpperCase())
       .eq("semester", semester)
    )
    .unique();
  if (setting?.grades?.length > 0) {
    const map: Record<string, number> = {};
    setting.grades.forEach((g: any) => { map[g.grade.toUpperCase()] = g.points; });
    return map;
  }
  return DEFAULT_GRADE_MAP;
}

const isValidGrade = (raw: string, validGradesSet: Set<string>) => {
  if (!raw) return false;
  const g = String(raw).trim().toUpperCase();
  if (["", "-", "N/A", "NA", "AB", "ABSENT", "0", "NULL", "UNDEFINED"].includes(g)) return false;
  return validGradesSet.has(g);
};

async function calculateGPAAndCGPA(
  ctx: any,
  subjectsInput: Array<{ subjectCode: string; grade: string }>,
  department: string,
  regulation: string,
  gradePointsMap: Record<string, number>
) {
  let totalCredits = 0;
  let totalPoints = 0;
  const validGradesSet = new Set(Object.keys(gradePointsMap));
  const subjectsDetails = [];

  for (const s of subjectsInput) {
    if (!isValidGrade(s.grade, validGradesSet)) continue;
    const subject = await ctx.db
      .query("subjects")
      .withIndex("by_code_dept", (q: any) =>
        q.eq("code", s.subjectCode.toUpperCase()).eq("department", department.toUpperCase())
      )
      .filter((q: any) => q.eq(q.field("regulation"), regulation.toUpperCase()))
      .first();
    if (!subject) { console.warn(`Subject ${s.subjectCode} not found, skipping.`); continue; }
    const grade = s.grade.trim().toUpperCase();
    const gradePoint = gradePointsMap[grade] ?? 0;
    totalCredits += subject.credits;
    totalPoints += subject.credits * gradePoint;
    subjectsDetails.push({ subjectCode: subject.code, subjectName: subject.name, grade, gradePoint, credits: subject.credits });
  }
  return { gpa: totalCredits > 0 ? parseFloat((totalPoints / totalCredits).toFixed(2)) : 0, totalCredits, totalPoints, subjects: subjectsDetails };
}

async function syncStudentCgpa(
  ctx: any,
  registerNo: string,
  department: string,
  regulation: string,
  studentName: string,
  userId: any
) {
  const regUpper = registerNo.trim().toUpperCase();
  const deptUpper = department.trim().toUpperCase();

  const records = await ctx.db
    .query("gpaRecords")
    .withIndex("by_student", (q: any) => q.eq("registerNo", regUpper))
    .collect();

  const deptRecords = records.filter((r: any) => r.department.toUpperCase() === deptUpper);
  if (deptRecords.length === 0) return;

  const semesterMap = new Map<number, any>();
  for (const r of deptRecords) {
    const existing = semesterMap.get(r.semester);
    if (!existing || (r.createdAt || 0) > (existing.createdAt || 0)) {
      semesterMap.set(r.semester, r);
    }
  }

  let gpaSum = 0;
  let totalCreds = 0;
  let semCount = 0;

  const semestersList = Array.from(semesterMap.values())
    .sort((a, b) => a.semester - b.semester)
    .map((r) => {
      const gpa = r.gpa || 0;
      const credits = r.totalCredits || 0;
      if (gpa > 0) {
        gpaSum += gpa;
        totalCreds += credits;
        semCount++;
      }
      return { semester: r.semester, gpa, credits };
    });

  const computedCgpa = semCount > 0 ? parseFloat((gpaSum / semCount).toFixed(2)) : 0;
  const resolvedName = studentName || deptRecords[0]?.studentName || `Student_${regUpper}`;

  const existingCgpa = await ctx.db
    .query("cgpaRecords")
    .withIndex("by_registerNo", (q: any) => q.eq("registerNo", regUpper))
    .filter((q: any) => q.eq(q.field("department"), deptUpper))
    .first();

  const cgpaData = {
    studentName: resolvedName,
    registerNo: regUpper,
    department: deptUpper,
    regulation: (regulation || "R2021").toUpperCase(),
    semesters: semestersList,
    totalCredits: totalCreds,
    cgpa: computedCgpa,
    calculatedBy: userId,
    isBulk: false,
    createdAt: Date.now(),
  };

  if (existingCgpa) {
    await ctx.db.patch(existingCgpa._id, cgpaData);
  } else {
    await ctx.db.insert("cgpaRecords", cgpaData);
  }
}

export const calculateSingle = mutation({
  args: {
    studentName: v.optional(v.string()),
    registerNo: v.optional(v.string()),
    semester: v.number(),
    regulation: v.string(),
    department: v.string(),
    subjects: v.array(v.object({ subjectCode: v.string(), grade: v.string() })),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const activeDept = args.department.toUpperCase();
    const regUpper = args.regulation.toUpperCase();
    let registerNo = (args.registerNo || "").trim().toUpperCase();

    let officialStudent = registerNo
      ? await ctx.db
          .query("students")
          .withIndex("by_registerNo", (q) => q.eq("registerNo", registerNo))
          .first()
      : null;

    let studentName = officialStudent ? officialStudent.name : args.studentName?.trim() || "";
    if (!studentName.trim()) {
      const records = await ctx.db.query("gpaRecords").withIndex("by_department", (q) => q.eq("department", activeDept)).collect();
      studentName = `Student${records.length + 1}`;
    }
    if (!registerNo.trim()) registerNo = `AUTO-${activeDept}-${Date.now()}`;
    const gradeMap = await getGradePointsMap(ctx, activeDept, regUpper, args.semester);
    const { gpa, totalCredits, totalPoints, subjects } = await calculateGPAAndCGPA(ctx, args.subjects, activeDept, regUpper, gradeMap);
    const existing = await ctx.db.query("gpaRecords")
      .withIndex("by_student", (q) => q.eq("registerNo", registerNo).eq("semester", args.semester).eq("department", activeDept))
      .first();
    const recordData = { studentName, registerNo, semester: args.semester, regulation: regUpper, department: activeDept, subjects, totalCredits, totalPoints, gpa, calculatedBy: args.userId, isBulk: false, batchId: "", createdAt: Date.now() };
    let recordId;
    if (existing) { await ctx.db.patch(existing._id, recordData); recordId = existing._id; }
    else { recordId = await ctx.db.insert("gpaRecords", recordData); }

    await syncStudentCgpa(ctx, registerNo, activeDept, regUpper, studentName, args.userId);

    const user = await ctx.db.get(args.userId);
    await ctx.db.insert("historyLogs", { action: "Calculate GPA", details: `Calculated GPA (${gpa}) for ${studentName} (${registerNo}), Sem ${args.semester}`, performedBy: args.userId, performedByName: user?.name || "Unknown", department: activeDept, timestamp: Date.now() });
    const record = await ctx.db.get(recordId);
    return { ...(record as any), calculatedBy: { name: user?.name || "Unknown" } };
  },
});

export const getBatchRecords = query({
  args: { batchId: v.string() },
  handler: async (ctx, args) => {
    const records = await ctx.db.query("gpaRecords").withIndex("by_batch", (q) => q.eq("batchId", args.batchId)).collect();
    const out: any[] = [];
    for (const r of records) {
      const user = (await ctx.db.get(r.calculatedBy as any)) as any;
      out.push({ ...(r as any), calculatedBy: { name: user?.name || "Unknown" } });
    }
    return out.sort((a, b) => a.registerNo.localeCompare(b.registerNo));
  },
});

export const getRecords = query({
  args: { department: v.optional(v.string()), semester: v.optional(v.number()), userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    let deptUpper = args.department ? args.department.toUpperCase() : undefined;

    let students = await ctx.db.query("students").collect();
    if (deptUpper) {
      students = students.filter((s) => s.department.toUpperCase() === deptUpper);
    }
    const studentRegs = new Set(students.map((s) => s.registerNo.trim().toUpperCase()));
    const studentMap = new Map<string, string>();
    for (const s of students) {
      studentMap.set(s.registerNo.trim().toUpperCase(), s.name);
    }

    let records = await ctx.db.query("gpaRecords").collect();
    if (deptUpper) records = records.filter((r) => r.department === deptUpper);
    if (args.semester !== undefined) records = records.filter((r) => r.semester === args.semester);
    if (args.userId) records = records.filter((r) => r.calculatedBy === args.userId);

    // Strictly filter: ONLY records for students in Student Management
    records = records.filter((r) => studentRegs.has(r.registerNo.trim().toUpperCase()));

    const recordMap = new Map<string, any>();
    for (const r of records) {
      const key = `${r.registerNo.trim().toUpperCase()}_SEM${r.semester}_${r.department.toUpperCase()}`;
      const prev = recordMap.get(key);
      if (!prev || (r.createdAt || 0) > (prev.createdAt || 0)) {
        recordMap.set(key, r);
      }
    }

    const out: any[] = [];
    for (const r of recordMap.values()) {
      const user = (await ctx.db.get(r.calculatedBy as any)) as any;
      const officialName = studentMap.get(r.registerNo.trim().toUpperCase()) || r.studentName;
      out.push({
        ...r,
        studentName: officialName,
        calculatedBy: { name: user?.name || "Unknown" }
      });
    }
    return out.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getById = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const raw = await ctx.db.get(args.id as any).catch(() => null);
    if (!raw) return null;
    const r = raw as any;
    const user = r.calculatedBy ? ((await ctx.db.get(r.calculatedBy as any).catch(() => null)) as any) : null;
    return { ...r, calculatedBy: { name: user?.name || "Unknown" } };
  },
});

export const getBatches = query({
  args: { department: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let batchRecords = (await ctx.db.query("gpaRecords").collect()).filter((r) => r.batchId && r.batchId !== "");
    if (args.department) batchRecords = batchRecords.filter((r) => r.department === args.department!.toUpperCase());
    const batchMap = new Map<string, any>();
    for (const r of batchRecords) {
      const ex = batchMap.get(r.batchId!);
      if (!ex) batchMap.set(r.batchId!, { batchId: r.batchId, batchName: r.batchName || r.batchId, department: r.department, semester: r.semester, regulation: r.regulation, count: 1, sumGpa: r.gpa, createdAt: r.createdAt, calculatedBy: r.calculatedBy });
      else { ex.count++; ex.sumGpa += r.gpa; if (r.createdAt < ex.createdAt) ex.createdAt = r.createdAt; }
    }
    const output: any[] = [];
    for (const b of batchMap.values()) {
      const user = (await ctx.db.get(b.calculatedBy)) as any;
      output.push({ batchId: b.batchId, batchName: b.batchName, department: b.department, semester: b.semester, regulation: b.regulation, count: b.count, avgGpa: parseFloat((b.sumGpa / b.count).toFixed(2)), createdAt: b.createdAt, calculatedBy: { name: user?.name || "Unknown" } });
    }
    return output.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const updateRecord = mutation({
  args: {
    id: v.id("gpaRecords"),
    studentName: v.optional(v.string()),
    registerNo: v.optional(v.string()),
    gpa: v.optional(v.number()),
    semester: v.optional(v.number()),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.id);
    if (!record) throw new Error("GPA record not found");

    const patch: any = {};
    if (args.studentName !== undefined) patch.studentName = args.studentName.trim();
    if (args.registerNo !== undefined) patch.registerNo = args.registerNo.trim().toUpperCase();
    if (args.gpa !== undefined) patch.gpa = args.gpa;
    if (args.semester !== undefined) patch.semester = args.semester;

    await ctx.db.patch(args.id, patch);

    const updated = await ctx.db.get(args.id);
    if (updated) {
      await syncStudentCgpa(ctx, updated.registerNo, updated.department, updated.regulation || "R2021", updated.studentName, args.userId);
    }

    const user = await ctx.db.get(args.userId);
    await ctx.db.insert("historyLogs", {
      action: "Update GPA Record",
      details: `Updated GPA record for ${patch.studentName || record.studentName} (${patch.registerNo || record.registerNo})`,
      performedBy: args.userId,
      performedByName: user?.name || "Unknown",
      department: record.department,
      timestamp: Date.now(),
    });
    return { success: true };
  },
});

export const deleteRecord = mutation({
  args: { id: v.id("gpaRecords"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.id);
    if (!record) throw new Error("GPA record not found");
    await ctx.db.delete(args.id);
    await syncStudentCgpa(ctx, record.registerNo, record.department, record.regulation || "R2021", record.studentName, args.userId);
    const user = await ctx.db.get(args.userId);
    await ctx.db.insert("historyLogs", { action: "Delete GPA Record", details: `Deleted GPA record for ${record.studentName} (${record.registerNo}), Sem ${record.semester}`, performedBy: args.userId, performedByName: user?.name || "Unknown", department: record.department, timestamp: Date.now() });
    return { success: true };
  },
});

export const deleteBatch = mutation({
  args: { batchId: v.string(), userId: v.id("users") },
  handler: async (ctx, args) => {
    const records = await ctx.db.query("gpaRecords").withIndex("by_batch", (q) => q.eq("batchId", args.batchId)).collect();
    if (records.length === 0) throw new Error("Batch not found or already deleted");
    const batchName = records[0].batchName || args.batchId;
    const department = records[0].department;
    for (const r of records) await ctx.db.delete(r._id);
    const user = await ctx.db.get(args.userId);
    await ctx.db.insert("historyLogs", { action: "Delete GPA Batch", details: `Deleted GPA batch "${batchName}" (${records.length} records)`, performedBy: args.userId, performedByName: user?.name || "Unknown", department, timestamp: Date.now() });
    return { success: true };
  },
});

export const bulkInsert = mutation({
  args: {
    records: v.array(v.object({
      studentName: v.string(), registerNo: v.string(), semester: v.number(), gpa: v.number(),
      totalCredits: v.number(), totalPoints: v.number(),
      subjects: v.array(v.object({ subjectCode: v.string(), subjectName: v.string(), credits: v.number(), grade: v.string(), gradePoint: v.number() })),
      department: v.string(), regulation: v.string(), isBulk: v.boolean(),
      batchName: v.string(), batchId: v.string(), calculatedBy: v.id("users"),
    })),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const batchId = args.records[0].batchId;
    const batchName = args.records[0].batchName;
    const department = args.records[0].department;
    for (const rec of args.records) {
      const regUpper = rec.registerNo.trim().toUpperCase();
      const deptUpper = rec.department.toUpperCase();

      const officialStudent = await ctx.db
        .query("students")
        .withIndex("by_registerNo", (q) => q.eq("registerNo", regUpper))
        .first();

      const resolvedName = officialStudent ? officialStudent.name : rec.studentName.trim();

      const existing = await ctx.db.query("gpaRecords")
        .withIndex("by_student", (q) => q.eq("registerNo", regUpper).eq("semester", rec.semester).eq("department", deptUpper))
        .first();
      const data = { ...rec, studentName: resolvedName, registerNo: regUpper, department: deptUpper, createdAt: Date.now() };
      if (existing) await ctx.db.patch(existing._id, data);
      else await ctx.db.insert("gpaRecords", data);

      await syncStudentCgpa(ctx, regUpper, deptUpper, rec.regulation, resolvedName, args.userId);
    }
    const user = await ctx.db.get(args.userId);
    await ctx.db.insert("historyLogs", { action: "Bulk Calculate GPA", details: `Bulk calculated GPA for ${args.records.length} students (batch: ${batchName})`, performedBy: args.userId, performedByName: user?.name || "Unknown", department, timestamp: Date.now() });
    return { count: args.records.length };
  },
});
