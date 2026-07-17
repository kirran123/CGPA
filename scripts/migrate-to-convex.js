#!/usr/bin/env node
/**
 * migrate-to-convex.js
 * ─────────────────────────────────────────────────────────────────────────
 * One-time migration script: MongoDB (Render) → Convex
 *
 * Usage (from the project root):
 *   node scripts/migrate-to-convex.js
 *
 * Requirements:
 *   - backend/node_modules must exist  (mongoose is used from there)
 *   - Set MONGO_URI and CONVEX_URL below, or export them as environment vars
 * ─────────────────────────────────────────────────────────────────────────
 */

"use strict";

// ── Configuration ─────────────────────────────────────────────────────────
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://digicertify:digicertify30@digicertify.klw4qlw.mongodb.net/cgpa?appName=DigiCertify";

const CONVEX_URL =
  process.env.CONVEX_URL || "https://aromatic-crow-956.convex.cloud";

// Chunk size for batched mutations (Convex has a 8MB per-call limit)
const CHUNK = 50;

// ── Load mongoose from backend ─────────────────────────────────────────────
const path = require("path");
const mongoose = require(path.join(__dirname, "../backend/node_modules/mongoose"));

// ── Convex HTTP helper ─────────────────────────────────────────────────────
const https = require("https");
const http = require("http");

function convexCall(type, fnPath, args) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ path: fnPath, format: "json", args });
    const url = new URL(`${CONVEX_URL}/api/${type}`);
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.status === "success") resolve(parsed.value);
            else reject(new Error(parsed.errorMessage || JSON.stringify(parsed)));
          } catch (e) {
            reject(new Error(`Parse error: ${data}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

const mutation = (fn, args) => convexCall("mutation", fn, args);
const query = (fn, args) => convexCall("query", fn, args);

function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

function toTs(d) {
  if (!d) return Date.now();
  if (d instanceof Date) return d.getTime();
  if (typeof d === "number") return d;
  return new Date(d).getTime() || Date.now();
}

// ── MongoDB Models (inline schemas, no imports needed) ─────────────────────
const { Schema } = mongoose;

const UserSchema = new Schema({}, { strict: false, collection: "users" });
const DeptSchema = new Schema({}, { strict: false, collection: "departments" });
const SubjectSchema = new Schema({}, { strict: false, collection: "subjects" });
const GpaSchema = new Schema({}, { strict: false, collection: "gparecords" });
const CgpaSchema = new Schema({}, { strict: false, collection: "cgparecords" });
const GradeSchema = new Schema({}, { strict: false, collection: "gradesettings" });
const RegSchema = new Schema({}, { strict: false, collection: "regulations" });
const LogSchema = new Schema({}, { strict: false, collection: "historylogs" });

const User = mongoose.model("MigUser", UserSchema);
const Dept = mongoose.model("MigDept", DeptSchema);
const Subject = mongoose.model("MigSubject", SubjectSchema);
const Gpa = mongoose.model("MigGpa", GpaSchema);
const Cgpa = mongoose.model("MigCgpa", CgpaSchema);
const Grade = mongoose.model("MigGrade", GradeSchema);
const Reg = mongoose.model("MigReg", RegSchema);
const Log = mongoose.model("MigLog", LogSchema);

// ── Main Migration ─────────────────────────────────────────────────────────
async function main() {
  console.log("\n🔗  Connecting to MongoDB…");
  await mongoose.connect(MONGO_URI);
  console.log("✅  MongoDB connected.\n");

  // ── Initial status ──────────────────────────────────────────────────────
  console.log("📊  Current Convex status:");
  const before = await query("migrations:getStatus", {});
  console.log(before);

  // ── 1. Users ────────────────────────────────────────────────────────────
  console.log("\n👥  Migrating users…");
  const mongoUsers = await User.find({}).lean();
  console.log(`    Found ${mongoUsers.length} users in MongoDB`);

  const idMap = {}; // mongoId (string) → Convex ID

  for (const batch of chunk(mongoUsers, CHUNK)) {
    const users = batch.map((u) => ({
      mongoId: String(u._id),
      name: String(u.name || "Unknown"),
      email: String(u.email || "").toLowerCase(),
      password: String(u.password || ""),
      role: ["super_admin", "dept_admin", "staff"].includes(u.role) ? u.role : "staff",
      department: u.department ? String(u.department).toUpperCase() : undefined,
      designation: u.designation ? String(u.designation) : undefined,
      employeeId: u.employeeId ? String(u.employeeId) : undefined,
      mobile: u.mobile ? String(u.mobile) : undefined,
      permissions: Array.isArray(u.permissions) ? u.permissions.map(String) : [],
      status: u.status === "Inactive" ? "Inactive" : "Active",
      firstLogin: !!u.firstLogin,
      createdAt: toTs(u.createdAt),
      updatedAt: toTs(u.updatedAt),
    }));
    const result = await mutation("migrations:importUsers", { users });
    Object.assign(idMap, result);
  }
  console.log(`    ✅  Users migrated. Mapped ${Object.keys(idMap).length} IDs.`);

  // ── Helper: resolve MongoDB ObjectId → Convex ID ──────────────────────
  function resolveUser(mongoIdRef) {
    if (!mongoIdRef) return null;
    const key = String(mongoIdRef._id || mongoIdRef);
    return idMap[key] || null;
  }

  // ── 2. Departments ──────────────────────────────────────────────────────
  console.log("\n🏢  Migrating departments…");
  const mongoDepts = await Dept.find({}).lean();
  console.log(`    Found ${mongoDepts.length} departments`);
  let deptResult = { inserted: 0, skipped: 0 };
  for (const batch of chunk(mongoDepts, CHUNK)) {
    const departments = batch.map((d) => ({
      name: String(d.name || ""),
      code: String(d.code || "").toUpperCase(),
      description: d.description ? String(d.description) : undefined,
      hodName: d.hodName ? String(d.hodName) : undefined,
      email: d.email ? String(d.email) : undefined,
      status: d.status === "Inactive" ? "Inactive" : "Active",
      createdAt: toTs(d.createdAt),
    }));
    const r = await mutation("migrations:importDepartments", { departments });
    deptResult.inserted += r.inserted;
    deptResult.skipped += r.skipped;
  }
  console.log(`    ✅  Departments — inserted: ${deptResult.inserted}, skipped: ${deptResult.skipped}`);

  // ── 3. Regulations ──────────────────────────────────────────────────────
  console.log("\n📋  Migrating regulations…");
  const mongoRegs = await Reg.find({}).lean();
  console.log(`    Found ${mongoRegs.length} regulations`);
  let regResult = { inserted: 0, skipped: 0 };
  for (const batch of chunk(mongoRegs, CHUNK)) {
    const regulations = batch.map((r) => ({
      name: String(r.name || "").toUpperCase(),
      createdAt: toTs(r.createdAt),
    }));
    const r = await mutation("migrations:importRegulations", { regulations });
    regResult.inserted += r.inserted;
    regResult.skipped += r.skipped;
  }
  console.log(`    ✅  Regulations — inserted: ${regResult.inserted}, skipped: ${regResult.skipped}`);

  // ── 4. Grade Settings ───────────────────────────────────────────────────
  console.log("\n⚙️   Migrating grade settings…");
  const mongoGrades = await Grade.find({}).lean();
  console.log(`    Found ${mongoGrades.length} grade setting configs`);
  let gradeResult = { inserted: 0, updated: 0 };
  for (const batch of chunk(mongoGrades, CHUNK)) {
    const settings = batch
      .filter((g) => g.department && g.regulation && g.semester)
      .map((g) => ({
        department: String(g.department).toUpperCase(),
        regulation: String(g.regulation).toUpperCase(),
        semester: parseInt(g.semester) || 1,
        grades: Array.isArray(g.grades)
          ? g.grades.map((gr) => ({
              grade: String(gr.grade || "").toUpperCase(),
              points: parseFloat(gr.points) || 0,
            }))
          : [],
      }));
    if (!settings.length) continue;
    const r = await mutation("migrations:importGradeSettings", { settings });
    gradeResult.inserted += r.inserted;
    gradeResult.updated += r.updated;
  }
  console.log(`    ✅  Grade settings — inserted: ${gradeResult.inserted}, updated: ${gradeResult.updated}`);

  // ── 5. Subjects ─────────────────────────────────────────────────────────
  console.log("\n📚  Migrating subjects…");
  const mongoSubjects = await Subject.find({}).lean();
  console.log(`    Found ${mongoSubjects.length} subjects`);
  let subResult = { inserted: 0, skipped: 0 };
  for (const batch of chunk(mongoSubjects, CHUNK)) {
    const subjects = batch
      .filter((s) => s.code && s.name && s.department)
      .map((s) => ({
        code: String(s.code).toUpperCase(),
        name: String(s.name),
        credits: parseFloat(s.credits) || 0,
        semester: parseInt(s.semester) || 1,
        department: String(s.department).toUpperCase(),
        regulation: String(s.regulation || "R2021").toUpperCase(),
      }));
    if (!subjects.length) continue;
    const r = await mutation("migrations:importSubjects", { subjects });
    subResult.inserted += r.inserted;
    subResult.skipped += r.skipped;
  }
  console.log(`    ✅  Subjects — inserted: ${subResult.inserted}, skipped: ${subResult.skipped}`);

  // ── 6. GPA Records ──────────────────────────────────────────────────────
  console.log("\n📊  Migrating GPA records…");
  const mongoGpa = await Gpa.find({}).lean();
  console.log(`    Found ${mongoGpa.length} GPA records`);
  let gpaResult = { inserted: 0, skipped: 0 };

  // Find the super admin Convex ID as a fallback
  const fallbackAdminId = Object.values(idMap)[0] || null;
  if (!fallbackAdminId) {
    console.warn("    ⚠️  No users migrated yet — GPA records will be skipped.");
  } else {
    for (const batch of chunk(mongoGpa, CHUNK)) {
      const records = batch
        .filter((r) => r.registerNo && r.department)
        .map((r) => {
          const calculatedBy = resolveUser(r.calculatedBy) || fallbackAdminId;
          return {
            studentName: String(r.studentName || "Unknown"),
            registerNo: String(r.registerNo),
            semester: parseInt(r.semester) || 1,
            regulation: r.regulation ? String(r.regulation).toUpperCase() : undefined,
            department: String(r.department).toUpperCase(),
            subjects: Array.isArray(r.subjects)
              ? r.subjects.map((s) => ({
                  subjectCode: String(s.subjectCode || s.subject_code || ""),
                  subjectName: String(s.subjectName || s.subject_name || ""),
                  credits: parseFloat(s.credits) || 0,
                  grade: String(s.grade || ""),
                  gradePoint: parseFloat(s.gradePoint || s.grade_point) || 0,
                }))
              : [],
            totalCredits: parseFloat(r.totalCredits) || 0,
            totalPoints: parseFloat(r.totalPoints) || 0,
            gpa: parseFloat(r.gpa) || 0,
            calculatedBy,
            isBulk: !!r.isBulk,
            batchName: r.batchName ? String(r.batchName) : undefined,
            batchId: r.batchId ? String(r.batchId) : undefined,
            createdAt: toTs(r.createdAt),
          };
        });
      if (!records.length) continue;
      const res = await mutation("migrations:importGpaRecords", { records });
      gpaResult.inserted += res.inserted;
      gpaResult.skipped += res.skipped;
    }
  }
  console.log(`    ✅  GPA Records — inserted: ${gpaResult.inserted}, skipped: ${gpaResult.skipped}`);

  // ── 7. CGPA Records ─────────────────────────────────────────────────────
  console.log("\n🎓  Migrating CGPA records…");
  const mongoCgpa = await Cgpa.find({}).lean();
  console.log(`    Found ${mongoCgpa.length} CGPA records`);
  let cgpaResult = { inserted: 0, skipped: 0 };
  if (fallbackAdminId) {
    for (const batch of chunk(mongoCgpa, CHUNK)) {
      const records = batch
        .filter((r) => r.registerNo && r.department)
        .map((r) => {
          const calculatedBy = resolveUser(r.calculatedBy) || fallbackAdminId;
          return {
            studentName: String(r.studentName || "Unknown"),
            registerNo: String(r.registerNo),
            department: String(r.department).toUpperCase(),
            regulation: r.regulation ? String(r.regulation).toUpperCase() : undefined,
            semesters: Array.isArray(r.semesters)
              ? r.semesters.map((s) => ({
                  semester: parseInt(s.semester) || 1,
                  gpa: parseFloat(s.gpa) || 0,
                  credits: parseFloat(s.credits) || 0,
                }))
              : [],
            totalCredits: parseFloat(r.totalCredits) || 0,
            cgpa: parseFloat(r.cgpa) || 0,
            calculatedBy,
            isBulk: !!r.isBulk,
            createdAt: toTs(r.createdAt),
          };
        });
      if (!records.length) continue;
      const res = await mutation("migrations:importCgpaRecords", { records });
      cgpaResult.inserted += res.inserted;
      cgpaResult.skipped += res.skipped;
    }
  }
  console.log(`    ✅  CGPA Records — inserted: ${cgpaResult.inserted}, skipped: ${cgpaResult.skipped}`);

  // ── 8. History Logs ─────────────────────────────────────────────────────
  console.log("\n📝  Migrating history logs…");
  const mongoLogs = await Log.find({}).sort({ timestamp: 1 }).lean();
  console.log(`    Found ${mongoLogs.length} history logs`);
  let logCount = 0;
  if (fallbackAdminId) {
    for (const batch of chunk(mongoLogs, CHUNK)) {
      const logs = batch
        .filter((l) => l.action)
        .map((l) => ({
          action: String(l.action || ""),
          details: String(l.details || ""),
          performedBy: resolveUser(l.performedBy) || fallbackAdminId,
          performedByName: String(l.performedByName || "Unknown"),
          department: l.department ? String(l.department).toUpperCase() : undefined,
          timestamp: toTs(l.timestamp || l.createdAt),
        }));
      if (!logs.length) continue;
      const res = await mutation("migrations:importHistoryLogs", { logs });
      logCount += res.inserted;
    }
  }
  console.log(`    ✅  History logs — inserted: ${logCount}`);

  // ── Final status ────────────────────────────────────────────────────────
  console.log("\n📊  Final Convex status:");
  const after = await query("migrations:getStatus", {});
  console.log(after);

  console.log("\n✅  Migration complete!\n");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("\n❌  Migration failed:", err.message || err);
  mongoose.disconnect();
  process.exit(1);
});
