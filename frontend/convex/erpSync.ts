import { mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// Mutation to upsert departments
export const saveDepartments = mutation({
  args: {
    departments: v.array(
      v.object({
        name: v.string(),
        code: v.string(),
        status: v.union(v.literal("Active"), v.literal("Inactive")),
      })
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0;
    let updated = 0;
    for (const dept of args.departments) {
      const codeUpper = dept.code.toUpperCase().trim();
      const existing = await ctx.db
        .query("departments")
        .withIndex("by_code", (q) => q.eq("code", codeUpper))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          name: dept.name,
          status: dept.status,
        });
        updated++;
      } else {
        const defaultEmail = `${codeUpper.toLowerCase()}hod@rit.edu.in`;
        await ctx.db.insert("departments", {
          name: dept.name,
          code: codeUpper,
          status: dept.status,
          hodName: "Pending Appointment",
          email: defaultEmail,
          createdAt: Date.now(),
        });
        inserted++;
      }
    }
    return { inserted, updated };
  },
});

// Mutation to upsert regulations
export const saveRegulations = mutation({
  args: {
    regulations: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    let inserted = 0;
    let skipped = 0;
    for (const reg of args.regulations) {
      const nameUpper = reg.toUpperCase().trim();
      if (!nameUpper) continue;
      const existing = await ctx.db
        .query("regulations")
        .withIndex("by_name", (q) => q.eq("name", nameUpper))
        .unique();

      if (!existing) {
        await ctx.db.insert("regulations", {
          name: nameUpper,
          createdAt: Date.now(),
        });
        inserted++;
      } else {
        skipped++;
      }
    }
    return { inserted, skipped };
  },
});

// Mutation to import NEW subjects from ERP only.
// Uses an erpSyncedKeys seen-key table: once an ERP subject key is recorded,
// it is NEVER re-imported — even if the record was locally deleted or edited.
// Format of key: "CODE|DEPT|REGULATION"
export const saveSubjects = mutation({
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
    let inserted = 0;
    let skipped = 0;
    for (const sub of args.subjects) {
      const codeUpper = sub.code.toUpperCase().trim();
      const deptUpper = sub.department.toUpperCase().trim();
      const regUpper = sub.regulation.toUpperCase().trim();
      const seenKey = `${codeUpper}|${deptUpper}|${regUpper}`;

      // Check if we have ever processed this ERP record before
      const alreadySeen = await ctx.db
        .query("erpSyncedKeys")
        .withIndex("by_resource_key", (q) =>
          q.eq("resource", "subjects").eq("key", seenKey)
        )
        .first();

      if (alreadySeen) {
        // This ERP record was already processed once — skip unconditionally.
        // Local edits/deletions are fully protected.
        skipped++;
        continue;
      }

      // Brand-new ERP record — insert into subjects and mark as seen
      await ctx.db.insert("subjects", {
        code: codeUpper,
        name: sub.name,
        credits: sub.credits,
        semester: sub.semester,
        department: deptUpper,
        regulation: regUpper,
      });
      await ctx.db.insert("erpSyncedKeys", { resource: "subjects", key: seenKey });
      inserted++;
    }
    return { inserted, skipped };
  },
});

// Lightweight student roster import — no CGPA recalculation (avoids 32k doc limit).
// Uses erpSyncedKeys seen-key table: once a register number is recorded,
// it is never re-imported even if locally deleted.
export const saveStudents = mutation({
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
    let inserted = 0;
    let skipped = 0;
    const now = Date.now();
    for (const s of args.students) {
      const regNoUpper = s.registerNo.trim().toUpperCase();
      const deptUpper = s.department.trim().toUpperCase();
      const regVal = s.regulation ? s.regulation.trim().toUpperCase() : "R2021";
      const seenKey = regNoUpper;

      // Check seen-key table first
      const alreadySeen = await ctx.db
        .query("erpSyncedKeys")
        .withIndex("by_resource_key", (q) =>
          q.eq("resource", "students").eq("key", seenKey)
        )
        .first();

      if (alreadySeen) {
        skipped++;
        continue;
      }

      // Brand-new student from ERP — insert and mark as seen
      await ctx.db.insert("students", {
        name: s.name.trim(),
        registerNo: regNoUpper,
        department: deptUpper,
        batch: s.batch.trim(),
        regulation: regVal,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("erpSyncedKeys", { resource: "students", key: seenKey });
      inserted++;
    }
    return { inserted, skipped };
  },
});

// Action to perform fetching and coordination
export const syncData = action({
  args: {
    token: v.string(),
    syncDepartments: v.boolean(),
    syncRegulations: v.boolean(),
    syncSubjects: v.boolean(),
    syncStudents: v.boolean(),
  },
  handler: async (ctx, args) => {
    const API_BASE = "https://api.ritrjpm.edu.in/backend/api/academic";
    const token = args.token.trim();
    
    const logs: string[] = [];
    const results = {
      departments: { fetched: 0, inserted: 0, updated: 0, failed: 0 },
      regulations: { fetched: 0, inserted: 0, skipped: 0, failed: 0 },
      subjects: { fetched: 0, inserted: 0, skipped: 0, failed: 0 },
      students: { fetched: 0, inserted: 0, failed: 0 },
    };

    // Helper for paginated fetches
    async function fetchResource(resource: string) {
      let rows: any[] = [];
      let cursor = "";
      let more = true;
      let pageCount = 0;
      
      logs.push(`Starting fetch for resource: ${resource}`);
      while (more && pageCount < 50) {
        const url = `${API_BASE}/fetch.php?resource=${resource}&limit=1000&since=${encodeURIComponent(cursor)}`;
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch ${resource}: HTTP ${response.status}`);
        }
        const data = await response.json();
        if (data.rows && Array.isArray(data.rows)) {
          rows.push(...data.rows);
        }
        cursor = data.next_cursor || "";
        more = data.has_more === true || data.has_more === "true";
        pageCount++;
      }
      logs.push(`Successfully fetched ${rows.length} rows for ${resource}`);
      return rows;
    }

    try {
      // 1. Fetch departments to build lookup table (always needed)
      let deptMap: Record<number | string, string> = {};
      let fetchedDepts: any[] = [];
      
      try {
        fetchedDepts = await fetchResource("departments");
        for (const row of fetchedDepts) {
          const id = row.id;
          const label = String(row.department_label || row.Department_code || "").trim().toUpperCase();
          if (id && label) {
            deptMap[id] = label;
          }
        }
      } catch (err: any) {
        logs.push(`Error fetching departments: ${err.message}`);
        if (args.syncDepartments) results.departments.failed = 1;
      }

      if (args.syncDepartments && fetchedDepts.length > 0) {
        const mappedDepts = fetchedDepts
          .map((row) => {
            const code = String(row.department_label || row.Department_code || "").trim().toUpperCase();
            const name = String(row.Department || row.degree_department || "").trim();
            const status = (row.is_active === 1 || row.is_active === "1" ? "Active" : "Inactive") as "Active" | "Inactive";
            return { name, code, status };
          })
          .filter((d) => d.code && d.name);

        results.departments.fetched = mappedDepts.length;
        
        const chunkSize = 100;
        for (let i = 0; i < mappedDepts.length; i += chunkSize) {
          const chunk = mappedDepts.slice(i, i + chunkSize);
          const res = await ctx.runMutation(api.erpSync.saveDepartments, { departments: chunk });
          results.departments.inserted += res.inserted;
          results.departments.updated += res.updated;
        }
        logs.push(`Departments Sync Complete. Inserts: ${results.departments.inserted}, Updates: ${results.departments.updated}`);
      }

      // 2. Fetch regulations to build lookup table (always needed)
      let regMap: Record<number | string, string> = {};
      let fetchedRegs: any[] = [];

      function mapRegulationFallback(regulationId: any) {
        const id = parseInt(regulationId, 10);
        if (isNaN(id)) return "R2021";
        if (id === 2) return "R2021";
        if (id === 3) return "R2025";
        if (id === 5) return "R2026";
        return `R20${id < 10 ? '0' + id : id}`;
      }

      try {
        fetchedRegs = await fetchResource("regulations");
        for (const row of fetchedRegs) {
          const id = row.id;
          const rawName = String(row.regulation || row.name || row.regulation_name || "").trim();
          let name = rawName.toUpperCase();
          if (name && /^\d+$/.test(name)) {
            name = "R" + name;
          }
          if (id && name) {
            regMap[id] = name;
          }
        }
      } catch (err: any) {
        logs.push(`Error fetching regulations: ${err.message}`);
        if (args.syncRegulations) results.regulations.failed = 1;
      }

      if (args.syncRegulations && fetchedRegs.length > 0) {
        const mappedRegs = fetchedRegs
          .map((row) => {
            const rawName = String(row.regulation || row.name || "").trim();
            let name = rawName.toUpperCase();
            if (name && /^\d+$/.test(name)) {
              name = "R" + name;
            }
            return name;
          })
          .filter((name) => name);

        results.regulations.fetched = mappedRegs.length;

        const res = await ctx.runMutation(api.erpSync.saveRegulations, { regulations: mappedRegs });
        results.regulations.inserted = res.inserted;
        results.regulations.skipped = res.skipped;
        logs.push(`Regulations Sync Complete. Inserts: ${results.regulations.inserted}, Skipped: ${results.regulations.skipped}`);
      }

      // 3. Sync Subjects/Courses
      if (args.syncSubjects) {
        try {
          const fetchedCourses = await fetchResource("courses");
          const fetchedHours = await fetchResource("course_hours");

          const creditsMap: Record<number | string, number> = {};
          for (const row of fetchedHours) {
            const courseId = row.course_id || row.id;
            const credits = parseFloat(row.credits);
            if (courseId !== undefined && !isNaN(credits)) {
              creditsMap[courseId] = credits;
            }
          }

          const mappedSubjects = fetchedCourses
            .map((row) => {
              const code = String(row.course_code || "").trim().toUpperCase();
              const name = String(row.title || "").trim();
              const semester = parseInt(row.semester, 10) || 1;
              
              const erpDeptId = row.department_id;
              const department = deptMap[erpDeptId] || "GEN";

              const erpRegId = row.regulation_id;
              const regulation = regMap[erpRegId] || mapRegulationFallback(erpRegId);

              const credits = creditsMap[row.id] !== undefined ? creditsMap[row.id] : 3;

              return { code, name, credits, semester, department, regulation };
            })
            .filter((sub) => sub.code && sub.name);

          results.subjects.fetched = mappedSubjects.length;

          const chunkSize = 100;
          for (let i = 0; i < mappedSubjects.length; i += chunkSize) {
            const chunk = mappedSubjects.slice(i, i + chunkSize);
            const res = await ctx.runMutation(api.erpSync.saveSubjects, { subjects: chunk });
            results.subjects.inserted += res.inserted;
            results.subjects.skipped += res.skipped;
          }
          logs.push(`Subjects Sync Complete. New: ${results.subjects.inserted}, Already existed (preserved): ${results.subjects.skipped}`);
        } catch (err: any) {
          logs.push(`Error fetching subjects/course hours: ${err.message}`);
          results.subjects.failed = 1;
        }
      }

      // 4. Sync Students
      if (args.syncStudents) {
        try {
          const fetchedStudents = await fetchResource("students");

          const pick = (r: any, ...keys: string[]) => {
            for (const k of keys) {
              const found = Object.keys(r).find((rk) => rk.trim().toLowerCase() === k.toLowerCase());
              if (found && String(r[found]).trim()) return String(r[found]).trim();
            }
            return "";
          };

          const mappedStudents = fetchedStudents
            .map((row) => {
              const registerNo = pick(row, "register_number", "register_no", "reg_no", "regno", "roll_no", "rollno", "registerNo").toUpperCase();
              const name = pick(row, "name", "student_name", "studentName", "fullname");
              
              if (!registerNo || !name) return null;

              const erpDeptId = pick(row, "department_id", "dept_id");
              let department = deptMap[erpDeptId] || pick(row, "department", "dept", "department_code");
              department = String(department || "GEN").trim().toUpperCase();

              const erpRegId = pick(row, "regulation_id", "reg_id");
              let regulation = regMap[erpRegId] || pick(row, "regulation", "reg");
              if (!regulation && erpRegId) {
                regulation = mapRegulationFallback(erpRegId);
              }
              regulation = String(regulation || "R2021").trim().toUpperCase();

              const rawBatch = pick(row, "batch", "batch_name", "batchname", "academic_year", "year_of_admission", "year");
              let batch = String(rawBatch || "").trim();
              if (batch && /^\d{4}$/.test(batch)) {
                const startYear = parseInt(batch, 10);
                batch = `${startYear}-${startYear + 4}`;
              } else if (!batch) {
                batch = "2023-2027";
              }

              return { name, registerNo, department, batch, regulation };
            })
            .filter((s) => s !== null) as any[];

          results.students.fetched = mappedStudents.length;

          const chunkSize = 100;
          for (let i = 0; i < mappedStudents.length; i += chunkSize) {
            const chunk = mappedStudents.slice(i, i + chunkSize);
            // Use lightweight saveStudents — no CGPA recalculation per student,
            // which avoids the 32k document-read limit in Convex transactions.
            const res = await ctx.runMutation(api.erpSync.saveStudents, { students: chunk });
            results.students.inserted += res.inserted;
          }
          logs.push(`Students Sync Complete. New: ${results.students.inserted}, Already existed: ${mappedStudents.length - results.students.inserted}`);
        } catch (err: any) {
          logs.push(`Error fetching students: ${err.message}`);
          results.students.failed = 1;
        }
      }

    } catch (err: any) {
      logs.push(`Critical Sync Failure: ${err.message}`);
    }

    return {
      success: true,
      logs,
      results,
    };
  },
});
