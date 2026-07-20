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
    const existing = await ctx.db
      .query("students")
      .withIndex("by_registerNo", (q) => q.eq("registerNo", regNoUpper))
      .first();

    const data = {
      name: args.name.trim(),
      registerNo: regNoUpper,
      department: deptUpper,
      batch: args.batch.trim(),
      regulation: args.regulation ? args.regulation.trim().toUpperCase() : "R2021",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    } else {
      return await ctx.db.insert("students", data);
    }
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
    const patch: any = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.registerNo !== undefined) patch.registerNo = args.registerNo.trim().toUpperCase();
    if (args.department !== undefined) patch.department = args.department.trim().toUpperCase();
    if (args.batch !== undefined) patch.batch = args.batch.trim();
    if (args.regulation !== undefined) patch.regulation = args.regulation.trim().toUpperCase();

    await ctx.db.patch(args.id, patch);
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
      const existing = await ctx.db
        .query("students")
        .withIndex("by_registerNo", (q) => q.eq("registerNo", regNoUpper))
        .first();

      const data = {
        name: s.name.trim(),
        registerNo: regNoUpper,
        department: deptUpper,
        batch: s.batch.trim(),
        regulation: s.regulation ? s.regulation.trim().toUpperCase() : "R2021",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      if (existing) {
        await ctx.db.patch(existing._id, data);
      } else {
        await ctx.db.insert("students", data);
      }
      count++;
    }
    return { count };
  },
});
