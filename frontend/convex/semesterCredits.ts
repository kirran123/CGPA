import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get total credits for a specific department, regulation, and semester
export const get = query({
  args: {
    department: v.string(),
    regulation: v.string(),
    semester: v.number(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("semesterCredits")
      .withIndex("by_dept_reg_sem", (q) =>
        q
          .eq("department", args.department.toUpperCase())
          .eq("regulation", args.regulation.toUpperCase())
          .eq("semester", args.semester)
      )
      .unique();

    return record ? record.totalCredits : 0;
  },
});

// Get total credits map { [semester]: totalCredits } for a department and regulation
export const getByDeptReg = query({
  args: {
    department: v.string(),
    regulation: v.string(),
  },
  handler: async (ctx, args) => {
    const deptUpper = args.department.toUpperCase();
    const regUpper = args.regulation.toUpperCase();

    const records = await ctx.db
      .query("semesterCredits")
      .withIndex("by_dept_reg", (q) =>
        q.eq("department", deptUpper).eq("regulation", regUpper)
      )
      .collect();

    const result: Record<number, number> = {};
    for (const r of records) {
      // Include ALL records (even 0) so the frontend knows the entry exists
      result[r.semester] = r.totalCredits;
    }
    return result;
  },
});

// Bulk save total credits for semesters 1-8 for a department & regulation
export const saveBulk = mutation({
  args: {
    department: v.string(),
    regulation: v.string(),
    semesterCredits: v.array(
      v.object({
        semester: v.number(),
        totalCredits: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const deptUpper = args.department.toUpperCase();
    const regUpper = args.regulation.toUpperCase();

    for (const item of args.semesterCredits) {
      const existing = await ctx.db
        .query("semesterCredits")
        .withIndex("by_dept_reg_sem", (q) =>
          q
            .eq("department", deptUpper)
            .eq("regulation", regUpper)
            .eq("semester", item.semester)
        )
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          totalCredits: item.totalCredits,
        });
      } else {
        await ctx.db.insert("semesterCredits", {
          department: deptUpper,
          regulation: regUpper,
          semester: item.semester,
          totalCredits: item.totalCredits,
        });
      }
    }
    return { success: true };
  },
});
