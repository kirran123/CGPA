import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Helper to sort departments custom: IT first, CYBER last, others alphabetical by name
export function sortDepartmentsCustom<T extends { code: string; name: string }>(depts: T[]): T[] {
  return [...depts].sort((a, b) => {
    const codeA = (a.code || "").toUpperCase();
    const codeB = (b.code || "").toUpperCase();

    if (codeA === "IT" && codeB !== "IT") return -1;
    if (codeB === "IT" && codeA !== "IT") return 1;

    if (codeA === "CYBER" && codeB !== "CYBER") return 1;
    if (codeB === "CYBER" && codeA !== "CYBER") return -1;

    return (a.name || "").localeCompare(b.name || "");
  });
}

// Sync HOD for a specific department
export async function syncHodForDept(ctx: any, deptCode: string) {
  const dept = await ctx.db
    .query("departments")
    .withIndex("by_code", (q: any) => q.eq("code", deptCode.toUpperCase()))
    .unique();

  if (!dept) return;

  // Find an active dept_admin for this department code
  const hod = await ctx.db
    .query("users")
    .withIndex("by_department", (q: any) => q.eq("department", deptCode.toUpperCase()))
    .filter((q: any) => q.and(q.eq(q.field("role"), "dept_admin"), q.eq(q.field("status"), "Active")))
    .first();

  if (hod) {
    if (dept.hodName !== hod.name || dept.email !== hod.email) {
      await ctx.db.patch(dept._id, {
        hodName: hod.name,
        email: hod.email,
      });
    }
  } else {
    const defaultEmail = `${dept.code.toLowerCase()}hod@rit.edu.in`;
    if (dept.hodName !== "Pending Appointment" || dept.email !== defaultEmail) {
      await ctx.db.patch(dept._id, {
        hodName: "Pending Appointment",
        email: defaultEmail,
      });
    }
  }
}

// Sync all HODs helper
export async function syncAllHods(ctx: any) {
  const depts = await ctx.db.query("departments").collect();
  for (const d of depts) {
    await syncHodForDept(ctx, d.code);
  }
}

// Public query - Active departments only
export const getPublic = query({
  args: {},
  handler: async (ctx) => {
    const list = await ctx.db
      .query("departments")
      .filter((q) => q.eq(q.field("status"), "Active"))
      .collect();
    return sortDepartmentsCustom(list);
  },
});

// Protected query
export const get = query({
  args: { role: v.string() },
  handler: async (ctx, args) => {
    const list = await ctx.db.query("departments").collect();
    const filtered = args.role === "super_admin" ? list : list.filter((d) => d.status === "Active");
    return sortDepartmentsCustom(filtered);
  },
});

// Create Department
export const create = mutation({
  args: {
    name: v.string(),
    code: v.string(),
    description: v.optional(v.string()),
    hodName: v.optional(v.string()),
    email: v.optional(v.string()),
    status: v.union(v.literal("Active"), v.literal("Inactive")),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const codeUpper = args.code.toUpperCase().trim();
    const existing = await ctx.db
      .query("departments")
      .withIndex("by_code", (q) => q.eq("code", codeUpper))
      .unique();

    if (existing) {
      throw new Error("Department code already exists");
    }

    const deptId = await ctx.db.insert("departments", {
      name: args.name,
      code: codeUpper,
      description: args.description,
      hodName: args.hodName || "Pending Appointment",
      email: args.email || `${codeUpper.toLowerCase()}hod@rit.edu.in`,
      status: args.status,
      createdAt: Date.now(),
    });

    await syncHodForDept(ctx, codeUpper);

    // Audit Log
    const user = await ctx.db.get(args.userId);
    await ctx.db.insert("historyLogs", {
      action: "Create Department",
      details: `Created department ${args.name} (${codeUpper})`,
      performedBy: args.userId,
      performedByName: user?.name || "Unknown",
      timestamp: Date.now(),
    });

    return await ctx.db.get(deptId);
  },
});

// Update Department
export const update = mutation({
  args: {
    id: v.id("departments"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    hodName: v.optional(v.string()),
    email: v.optional(v.string()),
    status: v.optional(v.union(v.literal("Active"), v.literal("Inactive"))),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const dept = await ctx.db.get(args.id);
    if (!dept) {
      throw new Error("Department not found");
    }

    const updates: Partial<typeof dept> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.hodName !== undefined) updates.hodName = args.hodName;
    if (args.email !== undefined) updates.email = args.email;
    if (args.status !== undefined) updates.status = args.status;

    await ctx.db.patch(args.id, updates);
    await syncHodForDept(ctx, dept.code);

    // Audit Log
    const user = await ctx.db.get(args.userId);
    await ctx.db.insert("historyLogs", {
      action: "Update Department",
      details: `Updated department ${dept.name} (${dept.code})`,
      performedBy: args.userId,
      performedByName: user?.name || "Unknown",
      timestamp: Date.now(),
    });

    return await ctx.db.get(args.id);
  },
});

// Get Department stats (Super Admin only)
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const depts = await ctx.db.query("departments").collect();
    const statsList = [];

    for (const d of depts) {
      // Get all GPA and CGPA records for this department code
      const gpaRecs = await ctx.db
        .query("gpaRecords")
        .withIndex("by_department", (q) => q.eq("department", d.code))
        .collect();

      const cgpaRecs = await ctx.db
        .query("cgpaRecords")
        .withIndex("by_department", (q) => q.eq("department", d.code))
        .collect();

      // Distinct students by registerNo
      const studentRegs = new Set([
        ...gpaRecs.map((r) => r.registerNo),
        ...cgpaRecs.map((r) => r.registerNo),
      ]);

      // Staff count (excluding super_admins)
      const staffList = await ctx.db
        .query("users")
        .withIndex("by_department", (q) => q.eq("department", d.code))
        .collect();
      const staffCount = staffList.filter((u) => u.role !== "super_admin").length;

      // Average GPA calculation
      const gpas = gpaRecs.map((r) => r.gpa).filter((g) => g > 0);
      const avgGpa =
        gpas.length > 0 ? (gpas.reduce((s, g) => s + g, 0) / gpas.length).toFixed(2) : "N/A";

      statsList.push({
        _id: d._id,
        code: d.code,
        name: d.name,
        description: d.description || "",
        hodName: d.hodName || "Pending Appointment",
        email: d.email || `${d.code.toLowerCase()}hod@rit.edu.in`,
        status: d.status,
        students: studentRegs.size,
        staff: staffCount,
        avgGpa: avgGpa,
      });
    }

    return sortDepartmentsCustom(statsList);
  },
});
