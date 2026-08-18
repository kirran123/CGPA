import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ─────────────────────────────────────────────────────────────────────────────
// CORE HELPER: Fetch total credits per semester from the subjects curriculum.
// This is the single source of truth for semester credits.
// If new subjects are added/updated for a regulation, this automatically
// reflects the latest totals — no stored credits are ever trusted.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchSemesterCreditsFromDB(
  ctx: any,
  department: string,
  regulation: string
): Promise<Map<number, number>> {
  const deptUpper = department.trim().toUpperCase();
  const regUpper = regulation.trim().toUpperCase();

  const semCreditsMap = new Map<number, number>();

  // 1. Check authoritative semesterCredits table
  const configuredCredits = await ctx.db
    .query("semesterCredits")
    .withIndex("by_dept_reg", (q: any) =>
      q.eq("department", deptUpper).eq("regulation", regUpper)
    )
    .collect();

  for (const c of configuredCredits) {
    if (c.totalCredits > 0) {
      semCreditsMap.set(c.semester, c.totalCredits);
    }
  }

  // 2. Fall back to subjects table for any unconfigured semesters
  const subjects = await ctx.db
    .query("subjects")
    .withIndex("by_dept_sem_reg", (q: any) => q.eq("department", deptUpper))
    .filter((q: any) => q.eq(q.field("regulation"), regUpper))
    .collect();

  for (const s of subjects) {
    if (!semCreditsMap.has(s.semester)) {
      semCreditsMap.set(s.semester, (semCreditsMap.get(s.semester) || 0) + (s.credits || 0));
    }
  }
  return semCreditsMap;
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE HELPER: Given GPA entries and a semCreditsMap from DB,
// compute weighted CGPA = Σ(GPA_i × Credits_i) / Σ(Credits_i)
// Falls back to simple average if no credits exist in the DB.
// ─────────────────────────────────────────────────────────────────────────────
function computeWeightedCGPA(
  semesterGpas: Array<{ semester: number; gpa: number }>,
  semCreditsMap: Map<number, number>
): { cgpa: number; totalCredits: number; semesters: Array<{ semester: number; gpa: number; credits: number }> } {
  let gpaSum = 0;
  let totalWeightedPoints = 0;
  let totalCredits = 0;
  let semCount = 0;

  const semesters = semesterGpas.map(({ semester, gpa }) => {
    const credits = semCreditsMap.get(semester) || 0;
    if (gpa > 0) {
      gpaSum += gpa;
      semCount++;
      if (credits > 0) {
        totalCredits += credits;
        totalWeightedPoints += gpa * credits;
      }
    }
    return { semester, gpa, credits };
  });

  const cgpa = totalCredits > 0
    ? parseFloat((totalWeightedPoints / totalCredits).toFixed(2))
    : (semCount > 0 ? parseFloat((gpaSum / semCount).toFixed(2)) : 0);

  return { cgpa, totalCredits, semesters };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: sync/create gpaRecords rows from semester list.
// Credits stored in gpaRecords are always the DB-fetched semester totals.
// ─────────────────────────────────────────────────────────────────────────────
async function syncGpaFromSemesters(
  ctx: any,
  registerNo: string,
  studentName: string,
  department: string,
  regulation: string,
  semesters: Array<{ semester: number; gpa: number; credits: number }>,
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
      totalCredits: s.credits,                       // DB-fetched credits
      totalPoints: parseFloat(((s.gpa) * (s.credits)).toFixed(2)),
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

// ─────────────────────────────────────────────────────────────────────────────
// calculateSingle — CGPA mutation from manual GPA entry per semester.
// Credits are ALWAYS read from the subjects database; values passed by
// the frontend are ignored.
// ─────────────────────────────────────────────────────────────────────────────
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
    let registerNo = (args.registerNo || "").trim().toUpperCase();

    const officialStudent = registerNo
      ? await ctx.db
          .query("students")
          .withIndex("by_registerNo", (q) => q.eq("registerNo", registerNo))
          .first()
      : null;

    let studentName = officialStudent ? officialStudent.name : args.studentName?.trim() || "";
    if (!studentName.trim()) {
      const records = await ctx.db.query("cgpaRecords").withIndex("by_department", (q) => q.eq("department", activeDept)).collect();
      studentName = `Student${records.length + 1}`;
    }
    if (!registerNo.trim()) registerNo = `AUTO-${activeDept}-${Date.now()}`;

    // Always fetch credits from the subjects curriculum
    const semCreditsMap = await fetchSemesterCreditsFromDB(ctx, activeDept, regUpper);

    const semesterGpas = args.semesters.map((s) => ({ semester: s.semester, gpa: s.gpa || 0 }));
    const { cgpa, totalCredits, semesters: formattedSemesters } = computeWeightedCGPA(semesterGpas, semCreditsMap);

    const existing = await ctx.db.query("cgpaRecords")
      .withIndex("by_registerNo", (q) => q.eq("registerNo", registerNo))
      .filter((q) => q.eq(q.field("department"), activeDept))
      .first();

    const recordData = {
      studentName, registerNo, department: activeDept, regulation: regUpper,
      semesters: formattedSemesters, totalCredits, cgpa,
      calculatedBy: args.userId, isBulk: false, createdAt: Date.now(),
    };

    let recordId;
    if (existing) { await ctx.db.patch(existing._id, recordData); recordId = existing._id; }
    else { recordId = await ctx.db.insert("cgpaRecords", recordData); }

    await syncGpaFromSemesters(ctx, registerNo, studentName, activeDept, regUpper, formattedSemesters, args.userId, false);

    const user = await ctx.db.get(args.userId);
    await ctx.db.insert("historyLogs", {
      action: "Calculate CGPA",
      details: `Calculated CGPA (${cgpa}) for ${studentName} (${registerNo}) across ${formattedSemesters.length} semesters`,
      performedBy: args.userId,
      performedByName: user?.name || "Unknown",
      department: activeDept,
      timestamp: Date.now(),
    });
    return { ...(await ctx.db.get(recordId)), calculatedBy: { name: user?.name || "Unknown" } };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// getRecords — Query all students and compute CGPA dynamically using
// database-fixed semester credits. Credits stored in records are overridden.
// ─────────────────────────────────────────────────────────────────────────────
export const getRecords = query({
  args: { department: v.optional(v.string()), batch: v.optional(v.string()), userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const deptUpper = args.department ? args.department.toUpperCase() : undefined;

    let students = await ctx.db.query("students").collect();
    if (deptUpper) {
      students = students.filter((s) => s.department.toUpperCase() === deptUpper);
    }
    if (args.batch) {
      students = students.filter((s) => s.batch === args.batch);
    }

    let cgpaRecords = await ctx.db.query("cgpaRecords").collect();
    if (deptUpper) {
      cgpaRecords = cgpaRecords.filter((r) => r.department.toUpperCase() === deptUpper);
    }
    if (args.userId) {
      cgpaRecords = cgpaRecords.filter((r) => r.calculatedBy === args.userId);
    }

    let gpaRecords = await ctx.db.query("gpaRecords").collect();
    if (deptUpper) {
      gpaRecords = gpaRecords.filter((r) => r.department.toUpperCase() === deptUpper);
    }

    // Pre-load all semesterCredits & subjects to build credits maps per (dept, regulation)
    const allSemesterCredits = await ctx.db.query("semesterCredits").collect();
    const allSubjects = await ctx.db.query("subjects").collect();
    const subjectCreditCache = new Map<string, Map<number, number>>();

    for (const c of allSemesterCredits) {
      const cacheKey = `${c.department.toUpperCase()}__${c.regulation.toUpperCase()}`;
      if (!subjectCreditCache.has(cacheKey)) subjectCreditCache.set(cacheKey, new Map());
      const m = subjectCreditCache.get(cacheKey)!;
      if (c.totalCredits > 0) {
        m.set(c.semester, c.totalCredits);
      }
    }

    for (const s of allSubjects) {
      const cacheKey = `${s.department.toUpperCase()}__${s.regulation.toUpperCase()}`;
      if (!subjectCreditCache.has(cacheKey)) subjectCreditCache.set(cacheKey, new Map());
      const m = subjectCreditCache.get(cacheKey)!;
      if (!m.has(s.semester)) {
        m.set(s.semester, (m.get(s.semester) || 0) + (s.credits || 0));
      }
    }

    const cgpaRecordMap = new Map<string, any>();
    for (const r of cgpaRecords) {
      const key = r.registerNo.trim().toUpperCase();
      const prev = cgpaRecordMap.get(key);
      if (!prev || (r.createdAt || 0) > (prev.createdAt || 0)) {
        cgpaRecordMap.set(key, r);
      }
    }

    const out: any[] = [];

    for (const st of students) {
      const regUpper = st.registerNo.trim().toUpperCase();
      const rec = cgpaRecordMap.get(regUpper);
      const stReg = (rec?.regulation || st.regulation || "R2021").toUpperCase();
      const stDept = (rec?.department || st.department || "").toUpperCase();
      const cacheKey = `${stDept}__${stReg}`;
      const semCreditsMap = subjectCreditCache.get(cacheKey) || new Map<number, number>();

      // Gather all GPA records for this student
      const stGpaRecs = gpaRecords.filter((r) => r.registerNo.trim().toUpperCase() === regUpper);
      const semGpaMap = new Map<number, any>();

      // Populate from stored cgpaRecord first
      if (rec?.semesters) {
        for (const s of rec.semesters) {
          if (s.gpa > 0) {
            semGpaMap.set(s.semester, { semester: s.semester, gpa: s.gpa });
          }
        }
      }

      // Override/append from gpaRecords if newer
      for (const r of stGpaRecs) {
        if (r.gpa > 0) {
          const existing = semGpaMap.get(r.semester);
          if (!existing || (r.createdAt || 0) > (existing.createdAt || 0)) {
            semGpaMap.set(r.semester, { semester: r.semester, gpa: r.gpa, createdAt: r.createdAt || 0 });
          }
        }
      }

      const mergedGpas = Array.from(semGpaMap.values())
        .sort((a, b) => a.semester - b.semester)
        .map((s) => ({ semester: s.semester, gpa: s.gpa }));

      // Compute CGPA using database-fixed semester credits
      const { cgpa: computedCgpa, totalCredits, semesters: mergedSemesters } = computeWeightedCGPA(mergedGpas, semCreditsMap);

      if (rec) {
        const user = rec.calculatedBy ? ((await ctx.db.get(rec.calculatedBy as any)) as any) : null;
        out.push({
          ...rec,
          studentName: st.name,
          batch: st.batch,
          regulation: stReg,
          semesters: mergedSemesters,
          totalCredits,
          cgpa: computedCgpa,
          calculatedBy: { name: user?.name || "System" },
        });
      } else if (mergedSemesters.length > 0) {
        out.push({
          _id: st._id,
          studentName: st.name,
          registerNo: regUpper,
          department: stDept,
          batch: st.batch,
          regulation: stReg,
          semesters: mergedSemesters,
          totalCredits,
          cgpa: computedCgpa,
          isBulk: false,
          createdAt: st.createdAt || Date.now(),
          calculatedBy: { name: "System (Auto)" },
        });
      } else {
        out.push({
          _id: st._id,
          studentName: st.name,
          registerNo: regUpper,
          department: stDept,
          batch: st.batch,
          regulation: stReg,
          semesters: [],
          totalCredits: 0,
          cgpa: 0,
          isBulk: false,
          createdAt: st.createdAt || Date.now(),
          calculatedBy: { name: "Pending" },
        });
      }
    }

    return out.sort((a, b) => (b.cgpa !== a.cgpa ? b.cgpa - a.cgpa : a.registerNo.localeCompare(b.registerNo)));
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// getById — fetch a single CGPA record, recompute with DB credits.
// ─────────────────────────────────────────────────────────────────────────────
export const getById = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const raw = await ctx.db.get(args.id as any).catch(() => null);
    const r = raw as any;

    if (r && r.registerNo && r.cgpa !== undefined) {
      // It's a direct cgpaRecord — recompute with DB credits
      const dept = r.department || "CSE";
      const reg = r.regulation || "R2021";
      const semCreditsMap = await fetchSemesterCreditsFromDB(ctx, dept, reg);
      const semGpas = (r.semesters || []).map((s: any) => ({ semester: s.semester, gpa: s.gpa }));
      const { cgpa, totalCredits, semesters } = computeWeightedCGPA(semGpas, semCreditsMap);
      const user = r.calculatedBy ? ((await ctx.db.get(r.calculatedBy as any).catch(() => null)) as any) : null;
      return { ...r, semesters, totalCredits, cgpa, calculatedBy: { name: user?.name || "Unknown" } };
    }

    // Might be a student ID — build CGPA from GPA records
    const student = r as any;
    if (!student || !student.registerNo) return null;
    const regUpper = student.registerNo.trim().toUpperCase();
    const dept = student.department || "CSE";
    const reg = student.regulation || "R2021";

    const allGpaRecs = await ctx.db.query("gpaRecords").collect();
    const stGpa = allGpaRecs.filter((g) => g.registerNo.trim().toUpperCase() === regUpper);
    const semMap = new Map<number, any>();
    for (const g of stGpa) {
      if (g.gpa > 0) {
        const ex = semMap.get(g.semester);
        if (!ex || (g.createdAt || 0) > (ex.createdAt || 0)) semMap.set(g.semester, g);
      }
    }

    const semGpas = Array.from(semMap.values())
      .sort((a, b) => a.semester - b.semester)
      .map((g) => ({ semester: g.semester, gpa: g.gpa }));

    const semCreditsMap = await fetchSemesterCreditsFromDB(ctx, dept, reg);
    const { cgpa, totalCredits, semesters } = computeWeightedCGPA(semGpas, semCreditsMap);

    return {
      _id: args.id,
      studentName: student.name,
      registerNo: regUpper,
      department: dept,
      regulation: reg,
      semesters,
      totalCredits,
      cgpa,
      calculatedBy: { name: "System (Auto)" },
    };
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

export const getByRegNo = query({
  args: { registerNo: v.string(), department: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const regUpper = args.registerNo.trim().toUpperCase();
    let records = await ctx.db.query("cgpaRecords").collect();
    records = records.filter((r) => r.registerNo.trim().toUpperCase() === regUpper);
    if (args.department) {
      records = records.filter((r) => r.department.toUpperCase() === args.department!.trim().toUpperCase());
    }
    if (records.length === 0) return null;
    return records.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// updateRecord — recompute CGPA using DB credits, ignore any credits in input.
// ─────────────────────────────────────────────────────────────────────────────
export const updateRecord = mutation({
  args: {
    id: v.string(),
    studentName: v.optional(v.string()),
    registerNo: v.optional(v.string()),
    semesters: v.optional(v.array(v.object({ semester: v.number(), gpa: v.number(), credits: v.optional(v.number()) }))),
    cgpa: v.optional(v.number()),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    let record: any = await ctx.db.get(args.id as any);
    let student: any = null;

    if (!record) {
      student = await ctx.db.get(args.id as any);
      if (student) {
        const existing = await ctx.db.query("cgpaRecords").collect();
        record = existing.find((r) => r.registerNo.trim().toUpperCase() === student.registerNo.trim().toUpperCase());
      }
    }

    const name = args.studentName?.trim() || record?.studentName || student?.name || "Student";
    const regNo = args.registerNo?.trim().toUpperCase() || record?.registerNo || student?.registerNo || "";
    const dept = record?.department || student?.department || "CSE";
    const reg = record?.regulation || student?.regulation || "R2021";

    // Fetch DB credits for recomputation
    const semCreditsMap = await fetchSemesterCreditsFromDB(ctx, dept, reg);

    const rawSemesters = (args.semesters || record?.semesters || []);
    const semGpas = rawSemesters.map((s: any) => ({ semester: s.semester, gpa: s.gpa || 0 }));
    const { cgpa: finalCgpa, totalCredits, semesters: formattedSemesters } = computeWeightedCGPA(semGpas, semCreditsMap);

    if (record) {
      await ctx.db.patch(record._id, {
        studentName: name,
        registerNo: regNo,
        semesters: formattedSemesters,
        totalCredits,
        cgpa: finalCgpa,
      });
    } else {
      await ctx.db.insert("cgpaRecords", {
        studentName: name,
        registerNo: regNo,
        department: dept,
        regulation: reg,
        semesters: formattedSemesters,
        totalCredits,
        cgpa: finalCgpa,
        calculatedBy: args.userId,
        isBulk: false,
        createdAt: Date.now(),
      });
    }

    if (args.semesters && regNo) {
      const gpaRecs = await ctx.db.query("gpaRecords").collect();
      for (const semObj of formattedSemesters) {
        if (semObj.gpa > 0) {
          const match = gpaRecs.find(
            (g) => g.registerNo.trim().toUpperCase() === regNo && g.semester === semObj.semester
          );
          if (match) {
            await ctx.db.patch(match._id, {
              gpa: semObj.gpa,
              studentName: name,
              totalCredits: semObj.credits,          // DB-fetched credits
              totalPoints: parseFloat((semObj.gpa * semObj.credits).toFixed(2)),
            });
          } else {
            await ctx.db.insert("gpaRecords", {
              studentName: name,
              registerNo: regNo,
              department: dept,
              semester: semObj.semester,
              regulation: reg,
              subjects: [],
              totalCredits: semObj.credits,           // DB-fetched credits
              totalPoints: parseFloat((semObj.gpa * semObj.credits).toFixed(2)),
              gpa: semObj.gpa,
              calculatedBy: args.userId,
              isBulk: false,
              createdAt: Date.now(),
            });
          }
        }
      }
    }

    const user = await ctx.db.get(args.userId);
    await ctx.db.insert("historyLogs", {
      action: "Update CGPA Record",
      details: `Updated CGPA & Semester records for ${name} (${regNo})`,
      performedBy: args.userId,
      performedByName: user?.name || "Unknown",
      department: dept,
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

export const deleteRecord = mutation({
  args: { id: v.string(), userId: v.id("users") },
  handler: async (ctx, args) => {
    let record: any = await ctx.db.get(args.id as any);
    let studentReg = "";

    if (!record) {
      const student: any = await ctx.db.get(args.id as any);
      if (student) {
        studentReg = student.registerNo;
        const existing = await ctx.db.query("cgpaRecords").collect();
        record = existing.find((r) => r.registerNo.trim().toUpperCase() === student.registerNo.trim().toUpperCase());
      }
    } else {
      studentReg = record.registerNo;
    }

    if (record) {
      await ctx.db.delete(record._id);
    }

    if (studentReg) {
      const gpaRecs = await ctx.db.query("gpaRecords").collect();
      const studentGpaRecs = gpaRecs.filter((r) => r.registerNo.trim().toUpperCase() === studentReg.trim().toUpperCase());
      for (const gr of studentGpaRecs) {
        await ctx.db.delete(gr._id);
      }
    }

    const user = await ctx.db.get(args.userId);
    await ctx.db.insert("historyLogs", {
      action: "Delete CGPA Record",
      details: `Deleted CGPA & GPA records for ${record?.studentName || studentReg} (${studentReg})`,
      performedBy: args.userId,
      performedByName: user?.name || "Unknown",
      department: record?.department || "N/A",
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// bulkInsert — Called by cgpaActions after bulk processing.
// Credits are already fetched from DB at this stage (done in the action).
// ─────────────────────────────────────────────────────────────────────────────
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

      const officialStudent = await ctx.db
        .query("students")
        .withIndex("by_registerNo", (q) => q.eq("registerNo", regUpper))
        .first();

      const resolvedName = officialStudent ? officialStudent.name : rec.studentName.trim();

      const existing = await ctx.db.query("cgpaRecords")
        .withIndex("by_registerNo", (q) => q.eq("registerNo", regUpper))
        .filter((q) => q.eq(q.field("department"), deptUpper))
        .first();

      const data = { ...rec, studentName: resolvedName, registerNo: regUpper, department: deptUpper, createdAt: Date.now() };
      if (existing) await ctx.db.patch(existing._id, data);
      else await ctx.db.insert("cgpaRecords", data);

      await syncGpaFromSemesters(ctx, regUpper, resolvedName, deptUpper, rec.regulation, rec.semesters, args.userId, true);
    }
    const user = await ctx.db.get(args.userId);
    await ctx.db.insert("historyLogs", {
      action: "Bulk Calculate CGPA",
      details: `Bulk calculated CGPA for ${args.records.length} students`,
      performedBy: args.userId,
      performedByName: user?.name || "Unknown",
      department,
      timestamp: Date.now(),
    });
    return { count: args.records.length };
  },
});
