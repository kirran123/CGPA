import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

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
    let registerNo = args.registerNo || "";
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
      const existing = await ctx.db.query("cgpaRecords")
        .withIndex("by_registerNo", (q) => q.eq("registerNo", rec.registerNo))
        .filter((q) => q.eq(q.field("department"), rec.department))
        .first();
      const data = { ...rec, createdAt: Date.now() };
      if (existing) await ctx.db.patch(existing._id, data);
      else await ctx.db.insert("cgpaRecords", data);
    }
    const user = await ctx.db.get(args.userId);
    await ctx.db.insert("historyLogs", { action: "Bulk Calculate CGPA", details: `Bulk calculated CGPA for ${args.records.length} students`, performedBy: args.userId, performedByName: user?.name || "Unknown", department, timestamp: Date.now() });
    return { count: args.records.length };
  },
});
