import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

async function syncGpaFromSemesters(
  ctx: any,
  registerNo: string,
  studentName: string,
  department: string,
  regulation: string,
  semesters: Array<{ semester: number; gpa: number; credits?: number }>,
  userId: any,
  isBulk: boolean
) {
  const regUpper = registerNo.trim().toUpperCase();
  const deptUpper = department.trim().toUpperCase();
  const regName = (regulation || "R2021").toUpperCase();

  for (const s of semesters) {
    if (!s.gpa || s.gpa <= 0) continue;
    const existingGpa = await ctx.db
      .query("gpaRecords")
      .withIndex("by_student", (q: any) =>
        q.eq("registerNo", regUpper).eq("semester", s.semester).eq("department", deptUpper)
      )
      .first();

    const gpaData = {
      studentName: studentName || `Student_${regUpper}`,
      registerNo: regUpper,
      semester: s.semester,
      regulation: regName,
      department: deptUpper,
      subjects: existingGpa?.subjects || [],
      totalCredits: s.credits || existingGpa?.totalCredits || 0,
      totalPoints: parseFloat(((s.gpa || 0) * (s.credits || existingGpa?.totalCredits || 0)).toFixed(2)),
      gpa: s.gpa,
      calculatedBy: userId,
      isBulk,
      batchId: existingGpa?.batchId || "",
      createdAt: Date.now(),
    };

    if (existingGpa) {
      await ctx.db.patch(existingGpa._id, gpaData);
    } else {
      await ctx.db.insert("gpaRecords", gpaData);
    }
  }
}

export const calculateSingle = mutation({
  args: {
    studentName: v.optional(v.string()),
    registerNo: v.optional(v.string()),
    department: v.string(),
    regulation: v.string(),
    semesters: v.array(v.object({ semester: v.number(), gpa: v.number(), credits: v.optional(v.number()) })),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const activeDept = args.department.toUpperCase();
    const regUpper = args.regulation.toUpperCase();
    let studentName = args.studentName || "";
    let registerNo = (args.registerNo || "").trim().toUpperCase();
    if (!studentName.trim()) {
      const records = await ctx.db.query("cgpaRecords").withIndex("by_department", (q) => q.eq("department", activeDept)).collect();
      studentName = `Student${records.length + 1}`;
    }
    if (!registerNo.trim()) registerNo = `AUTO-${activeDept}-${Date.now()}`;

    let gpaSum = 0, countedSems = 0, totalCredits = 0;
    const formattedSemesters = args.semesters.map((s) => {
      const credits = s.credits || 0;
      if (s.gpa > 0) { gpaSum += s.gpa; countedSems++; totalCredits += credits; }
      return { semester: s.semester, gpa: s.gpa, credits };
    });
    const cgpa = countedSems > 0 ? parseFloat((gpaSum / countedSems).toFixed(2)) : 0;

    const existing = await ctx.db.query("cgpaRecords")
      .withIndex("by_registerNo", (q) => q.eq("registerNo", registerNo))
      .filter((q) => q.eq(q.field("department"), activeDept))
      .first();
    const recordData = { studentName, registerNo, department: activeDept, regulation: regUpper, semesters: formattedSemesters, totalCredits, cgpa, calculatedBy: args.userId, isBulk: false, createdAt: Date.now() };
    let recordId;
    if (existing) { await ctx.db.patch(existing._id, recordData); recordId = existing._id; }
    else { recordId = await ctx.db.insert("cgpaRecords", recordData); }

    await syncGpaFromSemesters(ctx, registerNo, studentName, activeDept, regUpper, formattedSemesters, args.userId, false);

    const user = await ctx.db.get(args.userId);
    await ctx.db.insert("historyLogs", { action: "Calculate CGPA", details: `Calculated CGPA (${cgpa}) for ${studentName} (${registerNo}) across ${formattedSemesters.length} semesters`, performedBy: args.userId, performedByName: user?.name || "Unknown", department: activeDept, timestamp: Date.now() });
    return { ...(await ctx.db.get(recordId)), calculatedBy: { name: user?.name || "Unknown" } };
  },
});

export const getRecords = query({
  args: { department: v.optional(v.string()), userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    let records = await ctx.db.query("cgpaRecords").collect();
    if (args.department) records = records.filter((r) => r.department === args.department!.toUpperCase());
    if (args.userId) records = records.filter((r) => r.calculatedBy === args.userId);
    const out: any[] = [];
    for (const r of records) {
      const user = (await ctx.db.get(r.calculatedBy as any)) as any;
      out.push({ ...(r as any), calculatedBy: { name: user?.name || "Unknown" } });
    }
    return out.sort((a, b) => b.cgpa !== a.cgpa ? b.cgpa - a.cgpa : a.registerNo.localeCompare(b.registerNo));
  },
});

export const getById = query({
  args: { id: v.id("cgpaRecords") },
  handler: async (ctx, args) => {
    const r = await ctx.db.get(args.id);
    if (!r) return null;
    const user = (await ctx.db.get(r.calculatedBy as any)) as any;
    return { ...(r as any), calculatedBy: { name: user?.name || "Unknown" } };
  },
});

export const getStudentGpaHistory = query({
  args: { registerNo: v.string(), department: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const regUpper = args.registerNo.trim().toUpperCase();
    let gpaRecords = await ctx.db
      .query("gpaRecords")
      .collect();

    gpaRecords = gpaRecords.filter((r) => r.registerNo.trim().toUpperCase() === regUpper);
    if (args.department) {
      const deptUpper = args.department.trim().toUpperCase();
      gpaRecords = gpaRecords.filter((r) => r.department.toUpperCase() === deptUpper);
    }

    const semestersMap = new Map<number, any>();
    for (const r of gpaRecords) {
      const existing = semestersMap.get(r.semester);
      if (!existing || r.createdAt > existing.createdAt) {
        semestersMap.set(r.semester, r);
      }
    }

    const result = Array.from(semestersMap.values())
      .sort((a, b) => a.semester - b.semester)
      .map((r) => ({
        semester: r.semester,
        gpa: r.gpa,
        credits: r.totalCredits,
        studentName: r.studentName,
        regulation: r.regulation,
        department: r.department,
      }));

    return result;
  },
});

export const updateRecord = mutation({
  args: {
    id: v.id("cgpaRecords"),
    studentName: v.optional(v.string()),
    registerNo: v.optional(v.string()),
    semesters: v.optional(v.array(v.object({ semester: v.number(), gpa: v.number(), credits: v.optional(v.number()) }))),
    cgpa: v.optional(v.number()),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.id);
    if (!record) throw new Error("CGPA record not found");

    const patch: any = {};
    if (args.studentName !== undefined) patch.studentName = args.studentName.trim();
    if (args.registerNo !== undefined) patch.registerNo = args.registerNo.trim().toUpperCase();
    if (args.semesters !== undefined) {
      patch.semesters = args.semesters.map((s) => ({ semester: s.semester, gpa: s.gpa, credits: s.credits || 0 }));
    }
    if (args.cgpa !== undefined) patch.cgpa = args.cgpa;

    await ctx.db.patch(args.id, patch);
    const user = await ctx.db.get(args.userId);
    await ctx.db.insert("historyLogs", {
      action: "Update CGPA Record",
      details: `Updated CGPA record for ${patch.studentName || record.studentName} (${patch.registerNo || record.registerNo})`,
      performedBy: args.userId,
      performedByName: user?.name || "Unknown",
      department: record.department,
      timestamp: Date.now(),
    });
    return { success: true };
  },
});

export const deleteRecord = mutation({
  args: { id: v.id("cgpaRecords"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.id);
    if (!record) throw new Error("CGPA record not found");
    await ctx.db.delete(args.id);
    const user = await ctx.db.get(args.userId);
    await ctx.db.insert("historyLogs", { action: "Delete CGPA Record", details: `Deleted CGPA record for ${record.studentName} (${record.registerNo})`, performedBy: args.userId, performedByName: user?.name || "Unknown", department: record.department, timestamp: Date.now() });
    return { success: true };
  },
});

export const bulkInsert = mutation({
  args: {
    records: v.array(v.object({
      studentName: v.string(), registerNo: v.string(), department: v.string(), regulation: v.string(),
      semesters: v.array(v.object({ semester: v.number(), gpa: v.number(), credits: v.number() })),
      totalCredits: v.number(), cgpa: v.number(), calculatedBy: v.id("users"), isBulk: v.boolean(),
    })),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const department = args.records[0].department;
    for (const rec of args.records) {
      const regUpper = rec.registerNo.trim().toUpperCase();
      const deptUpper = rec.department.toUpperCase();
      const existing = await ctx.db.query("cgpaRecords")
        .withIndex("by_registerNo", (q) => q.eq("registerNo", regUpper))
        .filter((q) => q.eq(q.field("department"), deptUpper))
        .first();
      const data = { ...rec, registerNo: regUpper, department: deptUpper, createdAt: Date.now() };
      if (existing) await ctx.db.patch(existing._id, data);
      else await ctx.db.insert("cgpaRecords", data);

      await syncGpaFromSemesters(ctx, regUpper, rec.studentName, deptUpper, rec.regulation, rec.semesters, args.userId, true);
    }
    const user = await ctx.db.get(args.userId);
    await ctx.db.insert("historyLogs", { action: "Bulk Calculate CGPA", details: `Bulk calculated CGPA for ${args.records.length} students`, performedBy: args.userId, performedByName: user?.name || "Unknown", department, timestamp: Date.now() });
    return { count: args.records.length };
  },
});
