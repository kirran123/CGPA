import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get grade settings
export const get = query({
  args: {
    department: v.string(),
    regulation: v.string(),
    semester: v.number(),
  },
  handler: async (ctx, args) => {
    const setting = await ctx.db
      .query("gradeSettings")
      .withIndex("by_dept_reg_sem", (q) =>
        q
          .eq("department", args.department.toUpperCase())
          .eq("regulation", args.regulation.toUpperCase())
          .eq("semester", args.semester)
      )
      .unique();

    if (setting) {
      return setting.grades;
    }
    // Return empty array if not configured (frontend fallback will handle defaults)
    return [];
  },
});

// Save grade settings
export const save = mutation({
  args: {
    department: v.string(),
    regulation: v.string(),
    semester: v.number(),
    grades: v.array(
      v.object({
        grade: v.string(),
        points: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const deptUpper = args.department.toUpperCase();
    const regUpper = args.regulation.toUpperCase();

    const existing = await ctx.db
      .query("gradeSettings")
      .withIndex("by_dept_reg_sem", (q) =>
        q.eq("department", deptUpper).eq("regulation", regUpper).eq("semester", args.semester)
      )
      .unique();

    const normalizedGrades = args.grades.map((g) => ({
      grade: g.grade.toUpperCase().trim(),
      points: g.points,
    }));

    if (existing) {
      await ctx.db.patch(existing._id, {
        grades: normalizedGrades,
      });
      return existing._id;
    } else {
      const newId = await ctx.db.insert("gradeSettings", {
        department: deptUpper,
        regulation: regUpper,
        semester: args.semester,
        grades: normalizedGrades,
      });
      return newId;
    }
  },
});
