import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: {
    department: v.optional(v.string()),
    batch: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let students = await ctx.db.query("students").collect();
    if (args.department) {
      const deptUpper = args.department.toUpperCase();
      students = students.filter((s) => s.department.toUpperCase() === deptUpper);
    }
    if (args.batch) {
      students = students.filter((s) => s.batch === args.batch);
    }
    if (args.search && args.search.trim()) {
      const q = args.search.trim().toLowerCase();
      students = students.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.registerNo.toLowerCase().includes(q) ||
          s.batch.toLowerCase().includes(q)
      );
    }
    return students.sort((a, b) => a.registerNo.localeCompare(b.registerNo));
  },
});

export const getBatches = query({
  args: { department: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let students = await ctx.db.query("students").collect();
    if (args.department) {
      const deptUpper = args.department.toUpperCase();
      students = students.filter((s) => s.department.toUpperCase() === deptUpper);
    }
    const batchMap = new Map<string, number>();
    for (const s of students) {
      const current = batchMap.get(s.batch) || 0;
      batchMap.set(s.batch, current + 1);
    }
    const result = Array.from(batchMap.entries()).map(([batch, count]) => ({
      batch,
      count,
    }));
    return result.sort((a, b) => b.batch.localeCompare(a.batch));
  },
});

async function initializeStudentResults(
  ctx: any,
  studentName: string,
  registerNo: string,
  department: string,
  regulation: string
) {
  const regUpper = registerNo.trim().toUpperCase();
  const deptUpper = department.trim().toUpperCase();
  const regUpperVal = (regulation || "R2021").trim().toUpperCase();

  // 1. Fetch existing gpaRecords for this student and update studentName
  const existingGpaRecords = await ctx.db
    .query("gpaRecords")
    .withIndex("by_student", (q: any) => q.eq("registerNo", regUpper))
    .collect();

  let gpaSum = 0;
  let totalCreds = 0;
  let semCount = 0;
  const semesterMap = new Map<number, any>();

  for (const gRecord of existingGpaRecords) {
    if (gRecord.studentName !== studentName.trim()) {
      await ctx.db.patch(gRecord._id, { studentName: studentName.trim() });
    }
    const existing = semesterMap.get(gRecord.semester);
    if (!existing || (gRecord.createdAt || 0) > (existing.createdAt || 0)) {
      semesterMap.set(gRecord.semester, gRecord);
    }
  }

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

  // 2. Create or patch cgpaRecords with calculated results
  const existingCgpa = await ctx.db
    .query("cgpaRecords")
    .withIndex("by_registerNo", (q: any) => q.eq("registerNo", regUpper))
    .filter((q: any) => q.eq(q.field("department"), deptUpper))
    .first();

  const firstUser = await ctx.db.query("users").first();

  if (existingCgpa) {
    await ctx.db.patch(existingCgpa._id, {
      studentName: studentName.trim(),
      regulation: regUpperVal,
      semesters: semestersList,
      totalCredits: totalCreds,
      cgpa: computedCgpa,
    });
  } else if (firstUser) {
    await ctx.db.insert("cgpaRecords", {
      studentName: studentName.trim(),
      registerNo: regUpper,
      department: deptUpper,
      regulation: regUpperVal,
      semesters: semestersList,
      totalCredits: totalCreds,
      cgpa: computedCgpa,
      calculatedBy: firstUser._id,
      isBulk: false,
      createdAt: Date.now(),
    });
  }
}

export const create = mutation({
  args: {
    name: v.string(),
    registerNo: v.string(),
    department: v.string(),
    batch: v.string(),
    regulation: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const regNoUpper = args.registerNo.trim().toUpperCase();
    const deptUpper = args.department.trim().toUpperCase();
    const regVal = args.regulation ? args.regulation.trim().toUpperCase() : "R2021";
    const existing = await ctx.db
      .query("students")
      .withIndex("by_registerNo", (q) => q.eq("registerNo", regNoUpper))
      .first();

    const data = {
      name: args.name.trim(),
      registerNo: regNoUpper,
      department: deptUpper,
      batch: args.batch.trim(),
      regulation: regVal,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    let studentId;
    if (existing) {
      await ctx.db.patch(existing._id, data);
      studentId = existing._id;
    } else {
      studentId = await ctx.db.insert("students", data);
    }

    await initializeStudentResults(ctx, args.name, regNoUpper, deptUpper, regVal);
    return studentId;
  },
});

export const update = mutation({
  args: {
    id: v.id("students"),
    name: v.optional(v.string()),
    registerNo: v.optional(v.string()),
    department: v.optional(v.string()),
    batch: v.optional(v.string()),
    regulation: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const student = await ctx.db.get(args.id);
    const patch: any = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.registerNo !== undefined) patch.registerNo = args.registerNo.trim().toUpperCase();
    if (args.department !== undefined) patch.department = args.department.trim().toUpperCase();
    if (args.batch !== undefined) patch.batch = args.batch.trim();
    if (args.regulation !== undefined) patch.regulation = args.regulation.trim().toUpperCase();

    await ctx.db.patch(args.id, patch);

    const finalName = patch.name || student?.name || "";
    const finalRegNo = patch.registerNo || student?.registerNo || "";
    const finalDept = patch.department || student?.department || "";
    const finalReg = patch.regulation || student?.regulation || "R2021";
    if (finalRegNo && finalDept) {
      await initializeStudentResults(ctx, finalName, finalRegNo, finalDept, finalReg);
    }

    return args.id;
  },
});

export const remove = mutation({
  args: { id: v.id("students") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

export const bulkInsert = mutation({
  args: {
    students: v.array(
      v.object({
        name: v.string(),
        registerNo: v.string(),
        department: v.string(),
        batch: v.string(),
        regulation: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    let count = 0;
    for (const s of args.students) {
      const regNoUpper = s.registerNo.trim().toUpperCase();
      const deptUpper = s.department.trim().toUpperCase();
      const regVal = s.regulation ? s.regulation.trim().toUpperCase() : "R2021";
      const existing = await ctx.db
        .query("students")
        .withIndex("by_registerNo", (q) => q.eq("registerNo", regNoUpper))
        .first();

      const data = {
        name: s.name.trim(),
        registerNo: regNoUpper,
        department: deptUpper,
        batch: s.batch.trim(),
        regulation: regVal,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      if (existing) {
        await ctx.db.patch(existing._id, data);
      } else {
        await ctx.db.insert("students", data);
      }

      await initializeStudentResults(ctx, s.name, regNoUpper, deptUpper, regVal);
      count++;
    }
    return { count };
  },
});
