import { query } from "./_generated/server";
import { v } from "convex/values";
import { sortDepartmentsCustom } from "./departments";

// Get dashboard stats
export const getDashboardStats = query({
  args: {
    department: v.optional(v.string()),
    role: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    let stats: any = {};
    let distribution: any[] = [];
    let trends: any[] = [];
    let rankings: any[] = [];
    let recentRecords: any[] = [];
    let departmentOverviews: any[] = [];

    const isSuperAdminGlobal = args.role === "super_admin" && !args.department;

    if (isSuperAdminGlobal) {
      // Global View (Super Admin)
      const gpaRecs = await ctx.db.query("gpaRecords").collect();
      const cgpaRecs = await ctx.db.query("cgpaRecords").collect();

      const totalRecords = gpaRecs.length + cgpaRecs.length;
      const uniqueStudents = new Set([
        ...gpaRecs.map((r) => r.registerNo),
        ...cgpaRecs.map((r) => r.registerNo),
      ]);

      // Overall average GPA
      const gpas = gpaRecs.map((r) => r.gpa).filter((g) => g > 0);
      const avgGpa = gpas.length > 0 ? gpas.reduce((s, g) => s + g, 0) / gpas.length : 0;

      // Overall average CGPA
      const cgpas = cgpaRecs.map((r) => r.cgpa).filter((c) => c > 0);
      const avgCgpa = cgpas.length > 0 ? cgpas.reduce((s, c) => s + c, 0) / cgpas.length : 0;

      stats = {
        totalRecords,
        totalStudents: uniqueStudents.size,
        avgGpa: parseFloat(avgGpa.toFixed(2)),
        avgCgpa: parseFloat(avgCgpa.toFixed(2)),
      };

      // Department Overviews
      const depts = await ctx.db
        .query("departments")
        .filter((q) => q.eq(q.field("status"), "Active"))
        .collect();

      for (const d of depts) {
        const dGpaRecs = gpaRecs.filter((r) => r.department === d.code);
        const dCgpaRecs = cgpaRecs.filter((r) => r.department === d.code);

        const dRecordsCount = dGpaRecs.length + dCgpaRecs.length;
        const dUniqueStudents = new Set([
          ...dGpaRecs.map((r) => r.registerNo),
          ...dCgpaRecs.map((r) => r.registerNo),
        ]);

        const dGpas = dGpaRecs.map((r) => r.gpa).filter((g) => g > 0);
        const dAvgGpa = dGpas.length > 0 ? dGpas.reduce((s, g) => s + g, 0) / dGpas.length : 0;

        const dCgpas = dCgpaRecs.map((r) => r.cgpa).filter((c) => c > 0);
        const dAvgCgpa = dCgpas.length > 0 ? dCgpas.reduce((s, c) => s + c, 0) / dCgpas.length : 0;

        departmentOverviews.push({
          code: d.code,
          name: d.name,
          hodName: d.hodName || "Pending Appointment",
          email: d.email || `${d.code.toLowerCase()}hod@rit.edu.in`,
          totalRecords: dRecordsCount,
          totalStudents: dUniqueStudents.size,
          avgGpa: parseFloat(dAvgGpa.toFixed(2)),
          avgCgpa: parseFloat(dAvgCgpa.toFixed(2)),
        });
      }

      departmentOverviews = sortDepartmentsCustom(departmentOverviews);

      // Recent calculations (global)
      const sortedGpa = [...gpaRecs].sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);
      const sortedCgpa = [...cgpaRecs].sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);

      const combinedRecent = [...sortedGpa, ...sortedCgpa]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 10);

      for (const r of combinedRecent) {
        const user = (await ctx.db.get(r.calculatedBy as any)) as any;
        recentRecords.push({
          ...(r as any),
          calculatedBy: { name: user?.name || "Unknown" },
        });
      }
    } else {
      // Department-level View
      const user = await ctx.db.get(args.userId);
      const deptStr = args.department || user?.department;
      if (!deptStr) {
        throw new Error("Department must be specified either via parameters or user profile.");
      }
      const activeDept = deptStr.toUpperCase();

      let gpaRecs = await ctx.db
        .query("gpaRecords")
        .withIndex("by_department", (q) => q.eq("department", activeDept))
        .collect();

      let cgpaRecs = await ctx.db
        .query("cgpaRecords")
        .withIndex("by_department", (q) => q.eq("department", activeDept))
        .collect();

      // If user is dept_admin or staff, they can only see what they calculated
      const isDeptUser = args.role === "dept_admin" || args.role === "staff";
      if (isDeptUser) {
        gpaRecs = gpaRecs.filter((r) => r.calculatedBy === args.userId);
        cgpaRecs = cgpaRecs.filter((r) => r.calculatedBy === args.userId);
      }

      const totalRecords = gpaRecs.length + cgpaRecs.length;
      const uniqueStudents = new Set([
        ...gpaRecs.map((r) => r.registerNo),
        ...cgpaRecs.map((r) => r.registerNo),
      ]);

      const gpas = gpaRecs.map((r) => r.gpa).filter((g) => g > 0);
      const avgGpa = gpas.length > 0 ? gpas.reduce((s, g) => s + g, 0) / gpas.length : 0;

      const cgpas = cgpaRecs.map((r) => r.cgpa).filter((c) => c > 0);
      const avgCgpa = cgpas.length > 0 ? cgpas.reduce((s, c) => s + c, 0) / cgpas.length : 0;

      stats = {
        totalRecords,
        totalStudents: uniqueStudents.size,
        avgGpa: parseFloat(avgGpa.toFixed(2)),
        avgCgpa: parseFloat(avgCgpa.toFixed(2)),
        myRecordsCount: totalRecords,
      };

      // GPA Distribution
      const distMap: Record<string, number> = {
        "9.0 - 10.0 (O)": 0,
        "8.0 - 8.99 (A+)": 0,
        "7.0 - 7.99 (A)": 0,
        "6.0 - 6.99 (B+)": 0,
        "5.0 - 5.99 (B)": 0,
        "Below 5.0 (RA/U)": 0,
      };

      gpaRecs.forEach((r) => {
        const val = r.gpa;
        if (val >= 9.0) distMap["9.0 - 10.0 (O)"]++;
        else if (val >= 8.0) distMap["8.0 - 8.99 (A+)"]++;
        else if (val >= 7.0) distMap["7.0 - 7.99 (A)"]++;
        else if (val >= 6.0) distMap["6.0 - 6.99 (B+)"]++;
        else if (val >= 5.0) distMap["5.0 - 5.99 (B)"]++;
        else distMap["Below 5.0 (RA/U)"]++;
      });

      distribution = Object.keys(distMap).map((range) => ({
        range,
        count: distMap[range],
      }));

      // Semester average trends
      const semMap = new Map<number, { sum: number; count: number }>();
      gpaRecs.forEach((r) => {
        const existing = semMap.get(r.semester);
        if (!existing) {
          semMap.set(r.semester, { sum: r.gpa, count: 1 });
        } else {
          existing.sum += r.gpa;
          existing.count++;
        }
      });

      trends = Array.from(semMap.entries())
        .map(([sem, v]) => ({
          semester: `Sem ${sem}`,
          avgGpa: parseFloat((v.sum / v.count).toFixed(2)),
        }))
        .sort((a, b) => a.semester.localeCompare(b.semester));

      // Rankings
      const rankingStudents = [...cgpaRecs]
        .sort((a, b) => b.cgpa - a.cgpa)
        .slice(0, 10);

      rankings = rankingStudents.map((s, idx) => ({
        rank: idx + 1,
        registerNo: s.registerNo,
        name: s.studentName,
        cgpa: s.cgpa,
        semester: s.semesters.length > 0 ? s.semesters[s.semesters.length - 1].semester : 1,
      }));

      // Recent department records
      const sortedGpa = [...gpaRecs].sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);
      const sortedCgpa = [...cgpaRecs].sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);
      const combinedRecent = [...sortedGpa, ...sortedCgpa]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 10);

      for (const r of combinedRecent) {
        const user = (await ctx.db.get(r.calculatedBy as any)) as any;
        recentRecords.push({
          ...(r as any),
          calculatedBy: { name: user?.name || "Unknown" },
        });
      }
    }

    return {
      stats,
      distribution,
      trends,
      rankings,
      recentRecords,
      departmentOverviews,
    };
  },
});

// Get audit logs
export const getHistory = query({
  args: {
    role: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    let logs = await ctx.db.query("historyLogs").collect();

    // If not super admin, restrict to their own actions
    if (args.role !== "super_admin") {
      logs = logs.filter((l) => l.performedBy === args.userId);
    }

    // Return latest 100 logs
    return logs.sort((a, b) => b.timestamp - a.timestamp).slice(0, 100);
  },
});
