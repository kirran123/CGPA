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
    let studentName = args.studentName || "";
    let registerNo = args.registerNo || "";
    if (!studentName.trim()) {
      const records = await ctx.db.query("gpaRecords").withIndex("by_department", (q) => q.eq("department", activeDept)).collect();
      studentName = `Student${records.length + 1}`;
    }
    if (!registerNo.trim()) registerNo = `AUTO-${activeDept}-${Date.now()}`;
    const gradeMap = await getGradePointsMap(ctx, activeDept, regUpper, args.semester);
    const { gpa, totalCredits, totalPoints, subjects } = await calculateGPAAndCGPA(ctx, args.subjects, activeDept, regUpper, gradeMap);
    const existing = await ctx.db.query("gpaRecords")
      .withIndex("by_student", (q) => q.eq("registerNo", registerNo).eq("semester", args.semester).eq("department", activeDept))
      .filter((q) => q.eq(q.field("batchId"), ""))
      .first();
    const recordData = { studentName, registerNo, semester: args.semester, regulation: regUpper, department: activeDept, subjects, totalCredits, totalPoints, gpa, calculatedBy: args.userId, isBulk: false, batchId: "", createdAt: Date.now() };
    let recordId;
    if (existing) { await ctx.db.patch(existing._id, recordData); recordId = existing._id; }
    else { recordId = await ctx.db.insert("gpaRecords", recordData); }
    const user = await ctx.db.get(args.userId);
    await ctx.db.insert("historyLogs", { action: "Calculate GPA", details: `Calculated GPA (${gpa}) for ${studentName} (${registerNo}), Sem ${args.semester}`, performedBy: args.userId, performedByName: user?.name || "Unknown", department: activeDept, timestamp: Date.now() });
    const record = await ctx.db.get(recordId);
    return { ...record, calculatedBy: { name: user?.name || "Unknown" } };
  },
});

export const getBatchRecords = query({
  args: { batchId: v.string() },
  handler: async (ctx, args) => {
    const records = await ctx.db.query("gpaRecords").withIndex("by_batch", (q) => q.eq("batchId", args.batchId)).collect();
    const out = [];
    for (const r of records) {
      const user = await ctx.db.get(r.calculatedBy as any);
      out.push({ ...r, calculatedBy: { name: user?.name || "Unknown" } });
    }
    return out.sort((a, b) => a.registerNo.localeCompare(b.registerNo));
  },
});

export const getRecords = query({
  args: { department: v.optional(v.string()), semester: v.optional(v.number()), userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    let records = await ctx.db.query("gpaRecords").collect();
    if (args.department) records = records.filter((r) => r.department === args.department!.toUpperCase());
    if (args.semester !== undefined) records = records.filter((r) => r.semester === args.semester);
    if (args.userId) records = records.filter((r) => r.calculatedBy === args.userId);
    const out = [];
    for (const r of records) {
      const user = await ctx.db.get(r.calculatedBy as any);
      out.push({ ...r, calculatedBy: { name: user?.name || "Unknown" } });
    }
    return out.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getById = query({
  args: { id: v.id("gpaRecords") },
  handler: async (ctx, args) => {
    const r = await ctx.db.get(args.id);
    if (!r) return null;
    const user = await ctx.db.get(r.calculatedBy as any);
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
    const output = [];
    for (const b of batchMap.values()) {
      const user = await ctx.db.get(b.calculatedBy);
      output.push({ batchId: b.batchId, batchName: b.batchName, department: b.department, semester: b.semester, regulation: b.regulation, count: b.count, avgGpa: parseFloat((b.sumGpa / b.count).toFixed(2)), createdAt: b.createdAt, calculatedBy: { name: user?.name || "Unknown" } });
    }
    return output.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const deleteRecord = mutation({
  args: { id: v.id("gpaRecords"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.id);
    if (!record) throw new Error("GPA record not found");
    await ctx.db.delete(args.id);
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
      const existing = await ctx.db.query("gpaRecords")
        .withIndex("by_student", (q) => q.eq("registerNo", rec.registerNo).eq("semester", rec.semester).eq("department", rec.department))
        .filter((q) => q.eq(q.field("batchId"), batchId))
        .first();
      const data = { ...rec, createdAt: Date.now() };
      if (existing) await ctx.db.patch(existing._id, data);
      else await ctx.db.insert("gpaRecords", data);
    }
    const user = await ctx.db.get(args.userId);
    await ctx.db.insert("historyLogs", { action: "Bulk Calculate GPA", details: `Bulk calculated GPA for ${args.records.length} students (batch: ${batchName})`, performedBy: args.userId, performedByName: user?.name || "Unknown", department, timestamp: Date.now() });
    return { count: args.records.length };
  },
});
