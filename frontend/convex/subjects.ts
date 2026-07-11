import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: { department: v.optional(v.string()), regulation: v.optional(v.string()), semester: v.optional(v.number()) },
  handler: async (ctx, args) => {
    let list = await ctx.db.query("subjects").collect();
    if (args.department) list = list.filter((s) => s.department === args.department!.toUpperCase());
    if (args.regulation) list = list.filter((s) => s.regulation === args.regulation!.toUpperCase());
    if (args.semester !== undefined) list = list.filter((s) => s.semester === args.semester);
    return list.sort((a, b) => a.semester !== b.semester ? a.semester - b.semester : a.code.localeCompare(b.code));
  },
});

export const create = mutation({
  args: { code: v.string(), name: v.string(), credits: v.number(), semester: v.number(), department: v.string(), regulation: v.string() },
  handler: async (ctx, args) => {
    const codeUpper = args.code.toUpperCase().trim();
    const deptUpper = args.department.toUpperCase();
    const regUpper = args.regulation.toUpperCase();
    const existing = await ctx.db.query("subjects").withIndex("by_code_dept", (q) => q.eq("code", codeUpper).eq("department", deptUpper)).filter((q) => q.eq(q.field("regulation"), regUpper)).first();
    if (existing) throw new Error(`Subject ${codeUpper} already exists for regulation ${regUpper}`);
    return ctx.db.insert("subjects", { code: codeUpper, name: args.name, credits: args.credits, semester: args.semester, department: deptUpper, regulation: regUpper });
  },
});

export const update = mutation({
  args: { id: v.id("subjects"), code: v.optional(v.string()), name: v.optional(v.string()), credits: v.optional(v.number()), semester: v.optional(v.number()), regulation: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const subject = await ctx.db.get(args.id);
    if (!subject) throw new Error("Subject not found");
    const updates: any = {};
    if (args.code !== undefined) updates.code = args.code.toUpperCase().trim();
    if (args.name !== undefined) updates.name = args.name;
    if (args.credits !== undefined) updates.credits = args.credits;
    if (args.semester !== undefined) updates.semester = args.semester;
    if (args.regulation !== undefined) updates.regulation = args.regulation.toUpperCase().trim();
    if (updates.code || updates.regulation) {
      const c = updates.code || subject.code, r = updates.regulation || subject.regulation;
      const ex = await ctx.db.query("subjects").withIndex("by_code_dept", (q) => q.eq("code", c).eq("department", subject.department)).filter((q) => q.eq(q.field("regulation"), r)).first();
      if (ex && ex._id !== args.id) throw new Error(`Subject ${c} already exists for regulation ${r}`);
    }
    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

export const remove = mutation({
  args: { id: v.id("subjects") },
  handler: async (ctx, args) => {
    const subject = await ctx.db.get(args.id);
    if (!subject) throw new Error("Subject not found");
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

export const insertBulk = mutation({
  args: {
    subjects: v.array(v.object({ code: v.string(), name: v.string(), credits: v.number(), semester: v.number(), department: v.string(), regulation: v.string() })),
    skipDuplicates: v.boolean(),
  },
  handler: async (ctx, args) => {
    let created = 0, updated = 0, skipped = 0;
    for (const sub of args.subjects) {
      const existing = await ctx.db.query("subjects").withIndex("by_code_dept", (q) => q.eq("code", sub.code).eq("department", sub.department)).filter((q) => q.eq(q.field("regulation"), sub.regulation)).first();
      if (existing) {
        if (args.skipDuplicates) skipped++;
        else { await ctx.db.patch(existing._id, { name: sub.name, credits: sub.credits, semester: sub.semester }); updated++; }
      } else { await ctx.db.insert("subjects", sub); created++; }
    }
    return { created, updated, skipped };
  },
});
