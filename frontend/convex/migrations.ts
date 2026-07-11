import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ── 1. Import Users ────────────────────────────────────────────────────────
export const importUsers = mutation({
  args: {
    users: v.array(
      v.object({
        mongoId: v.string(),
        name: v.string(),
        email: v.string(),
        password: v.string(),
        role: v.union(v.literal("super_admin"), v.literal("dept_admin"), v.literal("staff")),
        department: v.optional(v.string()),
        designation: v.optional(v.string()),
        employeeId: v.optional(v.string()),
        mobile: v.optional(v.string()),
        permissions: v.array(v.string()),
        status: v.union(v.literal("Active"), v.literal("Inactive")),
        firstLogin: v.optional(v.boolean()),
        createdAt: v.number(),
        updatedAt: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const mapping: Record<string, string> = {};
    for (const user of args.users) {
      const { mongoId, ...data } = user;
      const existing = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", data.email.toLowerCase()))
        .unique();
      if (existing) {
        mapping[mongoId] = existing._id;
        continue;
      }
      const id = await ctx.db.insert("users", {
        ...data,
        email: data.email.toLowerCase(),
      });
      mapping[mongoId] = id;
    }
    return mapping;
  },
});

// ── 2. Import Departments ─────────────────────────────────────────────────
export const importDepartments = mutation({
  args: {
    departments: v.array(
      v.object({
        name: v.string(),
        code: v.string(),
        description: v.optional(v.string()),
        hodName: v.optional(v.string()),
        email: v.optional(v.string()),
        status: v.union(v.literal("Active"), v.literal("Inactive")),
        createdAt: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0, skipped = 0;
    for (const dept of args.departments) {
      const existing = await ctx.db
        .query("departments")
        .withIndex("by_code", (q) => q.eq("code", dept.code.toUpperCase()))
        .unique();
      if (existing) { skipped++; continue; }
      await ctx.db.insert("departments", { ...dept, code: dept.code.toUpperCase() });
      inserted++;
    }
    return { inserted, skipped };
  },
});

// ── 3. Import Regulations ─────────────────────────────────────────────────
export const importRegulations = mutation({
  args: {
    regulations: v.array(v.object({ name: v.string(), createdAt: v.number() })),
  },
  handler: async (ctx, args) => {
    let inserted = 0, skipped = 0;
    for (const reg of args.regulations) {
      const existing = await ctx.db
        .query("regulations")
        .withIndex("by_name", (q) => q.eq("name", reg.name.toUpperCase()))
        .unique();
      if (existing) { skipped++; continue; }
      await ctx.db.insert("regulations", { name: reg.name.toUpperCase(), createdAt: reg.createdAt });
      inserted++;
    }
    return { inserted, skipped };
  },
});

// ── 4. Import Grade Settings ─────────────────────────────────────────────
export const importGradeSettings = mutation({
  args: {
    settings: v.array(
      v.object({
        department: v.string(),
        regulation: v.string(),
        semester: v.number(),
        grades: v.array(v.object({ grade: v.string(), points: v.number() })),
      })
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0, updated = 0;
    for (const s of args.settings) {
      const existing = await ctx.db
        .query("gradeSettings")
        .withIndex("by_dept_reg_sem", (q) =>
          q.eq("department", s.department.toUpperCase())
           .eq("regulation", s.regulation.toUpperCase())
           .eq("semester", s.semester)
        )
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, { grades: s.grades });
        updated++;
      } else {
        await ctx.db.insert("gradeSettings", {
          department: s.department.toUpperCase(),
          regulation: s.regulation.toUpperCase(),
          semester: s.semester,
          grades: s.grades,
        });
        inserted++;
      }
    }
    return { inserted, updated };
  },
});

// ── 5. Import Subjects ────────────────────────────────────────────────────
export const importSubjects = mutation({
  args: {
    subjects: v.array(
      v.object({
        code: v.string(),
        name: v.string(),
        credits: v.number(),
        semester: v.number(),
        department: v.string(),
        regulation: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0, skipped = 0;
    for (const sub of args.subjects) {
      const existing = await ctx.db
        .query("subjects")
        .withIndex("by_code_dept", (q) =>
          q.eq("code", sub.code.toUpperCase()).eq("department", sub.department.toUpperCase())
        )
        .filter((q) => q.eq(q.field("regulation"), sub.regulation.toUpperCase()))
        .first();
      if (existing) { skipped++; continue; }
      await ctx.db.insert("subjects", {
        code: sub.code.toUpperCase(),
        name: sub.name,
        credits: sub.credits,
        semester: sub.semester,
        department: sub.department.toUpperCase(),
        regulation: sub.regulation.toUpperCase(),
      });
      inserted++;
    }
    return { inserted, skipped };
  },
});

// ── 6. Import GPA Records ─────────────────────────────────────────────────
export const importGpaRecords = mutation({
  args: {
    records: v.array(
      v.object({
        studentName: v.string(),
        registerNo: v.string(),
        semester: v.number(),
        regulation: v.optional(v.string()),
        department: v.string(),
        subjects: v.array(
          v.object({
            subjectCode: v.string(),
            subjectName: v.string(),
            credits: v.number(),
            grade: v.string(),
            gradePoint: v.number(),
          })
        ),
        totalCredits: v.number(),
        totalPoints: v.number(),
        gpa: v.number(),
        calculatedBy: v.id("users"),
        isBulk: v.boolean(),
        batchName: v.optional(v.string()),
        batchId: v.optional(v.string()),
        createdAt: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0, skipped = 0;
    for (const rec of args.records) {
      const existing = await ctx.db
        .query("gpaRecords")
        .withIndex("by_student", (q) =>
          q.eq("registerNo", rec.registerNo).eq("semester", rec.semester).eq("department", rec.department)
        )
        .filter((q) => q.eq(q.field("batchId"), rec.batchId || ""))
        .first();
      if (existing) { skipped++; continue; }
      await ctx.db.insert("gpaRecords", rec);
      inserted++;
    }
    return { inserted, skipped };
  },
});

// ── 7. Import CGPA Records ────────────────────────────────────────────────
export const importCgpaRecords = mutation({
  args: {
    records: v.array(
      v.object({
        studentName: v.string(),
        registerNo: v.string(),
        department: v.string(),
        regulation: v.optional(v.string()),
        semesters: v.array(
          v.object({ semester: v.number(), gpa: v.number(), credits: v.number() })
        ),
        totalCredits: v.number(),
        cgpa: v.number(),
        calculatedBy: v.id("users"),
        isBulk: v.boolean(),
        createdAt: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0, skipped = 0;
    for (const rec of args.records) {
      const existing = await ctx.db
        .query("cgpaRecords")
        .withIndex("by_registerNo", (q) => q.eq("registerNo", rec.registerNo))
        .filter((q) => q.eq(q.field("department"), rec.department))
        .first();
      if (existing) { skipped++; continue; }
      await ctx.db.insert("cgpaRecords", rec);
      inserted++;
    }
    return { inserted, skipped };
  },
});

// ── 8. Import History Logs ────────────────────────────────────────────────
export const importHistoryLogs = mutation({
  args: {
    logs: v.array(
      v.object({
        action: v.string(),
        details: v.string(),
        performedBy: v.id("users"),
        performedByName: v.string(),
        department: v.optional(v.string()),
        timestamp: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const log of args.logs) {
      await ctx.db.insert("historyLogs", log);
    }
    return { inserted: args.logs.length };
  },
});

// ── 9. Status check — how many records exist in each table ───────────────
export const getStatus = query({
  args: {},
  handler: async (ctx) => {
    const [users, departments, subjects, gpaRecords, cgpaRecords, gradeSettings, regulations, historyLogs] =
      await Promise.all([
        ctx.db.query("users").collect(),
        ctx.db.query("departments").collect(),
        ctx.db.query("subjects").collect(),
        ctx.db.query("gpaRecords").collect(),
        ctx.db.query("cgpaRecords").collect(),
        ctx.db.query("gradeSettings").collect(),
        ctx.db.query("regulations").collect(),
        ctx.db.query("historyLogs").collect(),
      ]);
    return {
      users: users.length,
      departments: departments.length,
      subjects: subjects.length,
      gpaRecords: gpaRecords.length,
      cgpaRecords: cgpaRecords.length,
      gradeSettings: gradeSettings.length,
      regulations: regulations.length,
      historyLogs: historyLogs.length,
    };
  },
});
