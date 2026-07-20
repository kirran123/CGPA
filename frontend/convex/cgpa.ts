import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

async function syncGpaFromSemesters(
  ctx: any,
  registerNo: string,
  studentName: string,
  department: string,
  regulation: string,
  semesters: Array<{ semester: number; gpa: number; credits?: number }>,
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
      totalCredits: s.credits || existingGpa?.totalCredits || 0,
      totalPoints: parseFloat(((s.gpa || 0) * (s.credits || existingGpa?.totalCredits || 0)).toFixed(2)),
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

    let officialStudent = registerNo
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

    await syncGpaFromSemesters(ctx, registerNo, studentName, activeDept, regUpper, formattedSemesters, args.userId, false);

    const user = await ctx.db.get(args.userId);
    await ctx.db.insert("historyLogs", { action: "Calculate CGPA", details: `Calculated CGPA (${cgpa}) for ${studentName} (${registerNo}) across ${formattedSemesters.length} semesters`, performedBy: args.userId, performedByName: user?.name || "Unknown", department: activeDept, timestamp: Date.now() });
    return { ...(await ctx.db.get(recordId)), calculatedBy: { name: user?.name || "Unknown" } };
  },
});

export const getRecords = query({
  args: { department: v.optional(v.string()), userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const deptUpper = args.department ? args.department.toUpperCase() : undefined;

    let students = await ctx.db.query("students").collect();
    if (deptUpper) {
      students = students.filter((s) => s.department.toUpperCase() === deptUpper);
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

      // Gather all GPA records for this student
      const stGpaRecs = gpaRecords.filter((r) => r.registerNo.trim().toUpperCase() === regUpper);
      const semGpaMap = new Map<number, any>();

      // Populate from stored cgpaRecord first if available
      if (rec && rec.semesters) {
        for (const s of rec.semesters) {
          if (s.gpa > 0) {
            semGpaMap.set(s.semester, { semester: s.semester, gpa: s.gpa, credits: s.credits || 0 });
          }
        }
      }

      // Override / append from gpaRecords if available and newer/present
      for (const r of stGpaRecs) {
        if (r.gpa > 0) {
          const existing = semGpaMap.get(r.semester);
          if (!existing || (r.createdAt || 0) > (existing.createdAt || 0)) {
            semGpaMap.set(r.semester, { semester: r.semester, gpa: r.gpa, credits: r.totalCredits || 0 });
          }
        }
      }

      const mergedSemesters = Array.from(semGpaMap.values()).sort((a, b) => a.semester - b.semester);

      let gpaSum = 0;
      let semCount = 0;
      let totalCredits = 0;

      for (const s of mergedSemesters) {
        if (s.gpa > 0) {
          gpaSum += s.gpa;
          semCount++;
          totalCredits += s.credits || 0;
        }
      }

      const computedCgpa = semCount > 0 ? parseFloat((gpaSum / semCount).toFixed(2)) : (rec?.cgpa || 0);

      if (rec) {
        const user = rec.calculatedBy ? ((await ctx.db.get(rec.calculatedBy as any)) as any) : null;
        out.push({
          ...rec,
          studentName: st.name,
          regulation: rec.regulation || st.regulation || "R2021",
          semesters: mergedSemesters,
          totalCredits: totalCredits > 0 ? totalCredits : rec.totalCredits || 0,
          cgpa: computedCgpa,
          calculatedBy: { name: user?.name || "System" },
        });
      } else if (mergedSemesters.length > 0) {
        out.push({
          _id: st._id,
          studentName: st.name,
          registerNo: regUpper,
          department: st.department.toUpperCase(),
          regulation: st.regulation || "R2021",
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
          department: st.department.toUpperCase(),
          regulation: st.regulation || "R2021",
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

export const getById = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    // First try as a direct cgpaRecord
    const raw = await ctx.db.get(args.id as any).catch(() => null);
    const r = raw as any;
    if (r && r.registerNo && r.cgpa !== undefined) {
      const user = r.calculatedBy ? ((await ctx.db.get(r.calculatedBy as any).catch(() => null)) as any) : null;
      return { ...r, calculatedBy: { name: user?.name || "Unknown" } };
    }
    // It might be a student ID — build CGPA from GPA records
    const student = r as any;
    if (!student || !student.registerNo) return null;
    const regUpper = student.registerNo.trim().toUpperCase();
    const allGpaRecs = await ctx.db.query("gpaRecords").collect();
    const stGpa = allGpaRecs.filter((g) => g.registerNo.trim().toUpperCase() === regUpper);
    const semMap = new Map<number, any>();
    for (const g of stGpa) {
      if (g.gpa > 0) {
        const ex = semMap.get(g.semester);
        if (!ex || (g.createdAt || 0) > (ex.createdAt || 0)) semMap.set(g.semester, g);
      }
    }
    const semesters = Array.from(semMap.values()).sort((a, b) => a.semester - b.semester).map((g) => ({ semester: g.semester, gpa: g.gpa, credits: g.totalCredits || 0 }));
    let gpaSum = 0, semCount = 0, totalCredits = 0;
    for (const s of semesters) { if (s.gpa > 0) { gpaSum += s.gpa; semCount++; totalCredits += s.credits; } }
    const cgpa = semCount > 0 ? parseFloat((gpaSum / semCount).toFixed(2)) : 0;
    return {
      _id: args.id,
      studentName: student.name,
      registerNo: regUpper,
      department: student.department,
      regulation: student.regulation || "R2021",
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

    const formattedSemesters = (args.semesters || record?.semesters || []).map((s: any) => ({
      semester: s.semester,
      gpa: s.gpa,
      credits: s.credits || 0,
    }));

    let finalCgpa = args.cgpa !== undefined ? args.cgpa : record?.cgpa || 0;
    if (args.semesters !== undefined) {
      let sum = 0, count = 0;
      for (const s of formattedSemesters) {
        if (s.gpa > 0) {
          sum += s.gpa;
          count++;
        }
      }
      finalCgpa = count > 0 ? parseFloat((sum / count).toFixed(2)) : 0;
    }

    if (record) {
      await ctx.db.patch(record._id, {
        studentName: name,
        registerNo: regNo,
        semesters: formattedSemesters,
        cgpa: finalCgpa,
      });
    } else {
      await ctx.db.insert("cgpaRecords", {
        studentName: name,
        registerNo: regNo,
        department: dept,
        regulation: reg,
        semesters: formattedSemesters,
        totalCredits: formattedSemesters.reduce((acc: number, s: any) => acc + (s.credits || 0), 0),
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
              totalCredits: semObj.credits || match.totalCredits,
            });
          } else {
            await ctx.db.insert("gpaRecords", {
              studentName: name,
              registerNo: regNo,
              department: dept,
              semester: semObj.semester,
              regulation: reg,
              subjects: [],
              totalCredits: semObj.credits || 0,
              totalPoints: 0,
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
    await ctx.db.insert("historyLogs", { action: "Bulk Calculate CGPA", details: `Bulk calculated CGPA for ${args.records.length} students`, performedBy: args.userId, performedByName: user?.name || "Unknown", department, timestamp: Date.now() });
    return { count: args.records.length };
  },
});
