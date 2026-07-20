#!/usr/bin/env node
/**
 * migrate-sql-subjects.js
 * ─────────────────────────────────────────────────────────────────────────
 * Reads three SQL files (depts.sql, hours.sql, courses.sql),
 * sanitizes credits, maps departments and regulations (regulation_id=5 maps to R2026),
 * and imports them into Convex.
 *
 * Usage:
 *   node scripts/migrate-sql-subjects.js
 * ─────────────────────────────────────────────────────────────────────────
 */

"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

// ── 1. Parse Convex URL ──────────────────────────────────────────────────
let CONVEX_URL = process.env.CONVEX_URL ? process.env.CONVEX_URL.trim() : undefined;

if (!CONVEX_URL) {
  // Try loading from frontend/.env.local or frontend/.env
  const paths = [
    path.join(__dirname, "../frontend/.env.local"),
    path.join(__dirname, "../frontend/.env"),
    path.join(__dirname, "../.env")
  ];
  for (const envPath of paths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      const match = content.match(/VITE_CONVEX_URL\s*=\s*(https?:\/\/[^\s]+)/) ||
                    content.match(/CONVEX_URL\s*=\s*(https?:\/\/[^\s]+)/);
      if (match) {
        CONVEX_URL = match[1].trim();
        console.log(`📡 Loaded Convex URL from ${path.basename(envPath)}: ${CONVEX_URL}`);
        break;
      }
    }
  }
}

if (!CONVEX_URL) {
  CONVEX_URL = "https://aromatic-crow-956.convex.cloud";
  console.log(`📡 Using fallback Convex URL: ${CONVEX_URL}`);
}

// ── 2. Convex Helper ─────────────────────────────────────────────────────
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

// ── 3. Parse SQL Helper functions ─────────────────────────────────────────
function parseSqlInserts(sqlText, tableName) {
  const regex = new RegExp(`INSERT INTO\\s+\`?${tableName}\`?(?:\\s*\\([^)]*\\))?\\s*VALUES`, 'gi');
  let match;
  const allRows = [];
  
  while ((match = regex.exec(sqlText)) !== null) {
    let index = regex.lastIndex;
    let inQuote = false;
    let quoteChar = null;
    let valuesStr = "";
    
    while (index < sqlText.length) {
      const char = sqlText[index];
      if (inQuote) {
        if (char === quoteChar) {
          if (sqlText[index - 1] === '\\') {
            valuesStr += char;
          } else {
            inQuote = false;
            valuesStr += char;
          }
        } else {
          valuesStr += char;
        }
      } else {
        if (char === "'" || char === '"') {
          inQuote = true;
          quoteChar = char;
          valuesStr += char;
        } else if (char === ';') {
          break;
        } else {
          valuesStr += char;
        }
      }
      index++;
    }
    
    let depth = 0;
    let rowStart = -1;
    inQuote = false;
    quoteChar = null;
    
    for (let i = 0; i < valuesStr.length; i++) {
      const char = valuesStr[i];
      if (inQuote) {
        if (char === quoteChar && valuesStr[i - 1] !== '\\') {
          inQuote = false;
        }
      } else {
        if (char === "'" || char === '"') {
          inQuote = true;
          quoteChar = char;
        } else if (char === '(') {
          if (depth === 0) {
            rowStart = i + 1;
          }
          depth++;
        } else if (char === ')') {
          depth--;
          if (depth === 0 && rowStart !== -1) {
            const rowText = valuesStr.slice(rowStart, i);
            allRows.push(parseRowValues(rowText));
            rowStart = -1;
          }
        }
      }
    }
  }
  return allRows;
}

function parseRowValues(rowText) {
  const values = [];
  let currentVal = "";
  let inQuote = false;
  let quoteChar = null;
  
  for (let i = 0; i < rowText.length; i++) {
    const char = rowText[i];
    if (inQuote) {
      if (char === quoteChar && rowText[i - 1] !== '\\') {
        inQuote = false;
      } else {
        currentVal += char;
      }
    } else {
      if (char === "'" || char === '"') {
        inQuote = true;
        quoteChar = char;
      } else if (char === ',') {
        values.push(cleanVal(currentVal));
        currentVal = "";
      } else {
        currentVal += char;
      }
    }
  }
  values.push(cleanVal(currentVal));
  return values;
}

function cleanVal(str) {
  str = str.trim();
  if (str.toUpperCase() === 'NULL') return null;
  // Strip starting/ending quotes if present in raw form
  if ((str.startsWith("'") && str.endsWith("'")) || (str.startsWith('"') && str.endsWith('"'))) {
    str = str.slice(1, -1);
  }
  return str;
}

function sanitizeCredits(creditStr) {
  if (!creditStr) return 0;
  // Clean all characters except digits and decimal point
  const cleaned = creditStr.replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function mapRegulation(regulationId) {
  const id = parseInt(regulationId, 10);
  if (id === 2) return "R2021";
  if (id === 3) return "R2025";
  if (id === 5) return "R2026";
  // Fallback
  return `R20${id < 10 ? '0' + id : id}`;
}

function normalizeDepartmentCode(code) {
  const c = code.toUpperCase().trim();
  if (c === "AD" || c === "AIDS" || c === "AI&DS" || c === "AI_DS") return ["AD", "AIDS", "AI&DS"];
  if (c === "AM" || c === "AIML" || c.includes("AIML")) return ["AM", "AIML"];
  if (c === "CYBER" || c.includes("CYBER") || c === "A" || c === "CSE (CYBER SECURITY)") return ["CYBER", "CSE (CYBER SECURITY)", "A"];
  return [c];
}

// ── Chunk helper ──────────────────────────────────────────────────────────
function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

// ── Main Execution ────────────────────────────────────────────────────────
async function main() {
  const deptsFilePath = path.join(__dirname, "depts.sql");
  const hoursFilePath = path.join(__dirname, "hours.sql");
  const coursesFilePath = path.join(__dirname, "courses.sql");

  if (!fs.existsSync(deptsFilePath) || !fs.existsSync(hoursFilePath) || !fs.existsSync(coursesFilePath)) {
    console.error("❌ One or more required SQL files are missing in scripts/ folder:");
    console.error(`   depts.sql: ${fs.existsSync(deptsFilePath) ? "Found" : "Missing"}`);
    console.error(`   hours.sql: ${fs.existsSync(hoursFilePath) ? "Found" : "Missing"}`);
    console.error(`   courses.sql: ${fs.existsSync(coursesFilePath) ? "Found" : "Missing"}`);
    process.exit(1);
  }

  console.log("📖 Reading SQL files...");
  const deptsSqlText = fs.readFileSync(deptsFilePath, "utf8");
  const hoursSqlText = fs.readFileSync(hoursFilePath, "utf8");
  const coursesSqlText = fs.readFileSync(coursesFilePath, "utf8");

  // ── Parse Department Table ──
  console.log("Parsing user_accounts_add_department from depts.sql...");
  const deptRows = parseSqlInserts(deptsSqlText, "user_accounts_add_department");
  console.log(`Parsed ${deptRows.length} department rows.`);
  const deptMap = {}; // department_id -> label
  deptRows.forEach((row) => {
    const id = row[0];
    const label = row[4]; // department_label (e.g. 'AD', 'IT')
    if (id && label) {
      deptMap[id] = label.toUpperCase().trim();
    }
  });

  // ── Parse Course Hours Table ──
  console.log("Parsing course_management_coursehours from hours.sql...");
  const hourRows = parseSqlInserts(hoursSqlText, "course_management_coursehours");
  console.log(`Parsed ${hourRows.length} course hours rows.`);
  const courseCreditsMap = {}; // course_id -> credits
  hourRows.forEach((row) => {
    const creditsRaw = row[5]; // credits column
    const courseId = row[6]; // course_id column
    if (courseId !== undefined) {
      courseCreditsMap[courseId] = sanitizeCredits(creditsRaw);
    }
  });

  // ── Parse Course Table ──
  console.log("Parsing course_management_course from courses.sql...");
  const courseRows = parseSqlInserts(coursesSqlText, "course_management_course");
  console.log(`Parsed ${courseRows.length} course rows.`);

  const subjects = [];
  const regulationsToCreate = new Set();

  courseRows.forEach((row) => {
    const id = row[0];
    const code = row[1] ? row[1].toUpperCase().trim() : null;
    const name = row[2] ? row[2].trim() : null;
    const semester = row[4] ? parseInt(row[4], 10) : 1;
    const isActive = row[5];
    const deptId = row[6];
    const regId = row[8];

    // Filter active courses with valid code and name
    if (code && name && isActive == 1) {
      const deptCode = deptMap[deptId] || "GEN";
      const regName = mapRegulation(regId);
      const credits = courseCreditsMap[id] !== undefined ? courseCreditsMap[id] : 3;

      regulationsToCreate.add(regName);
      const deptCodes = normalizeDepartmentCode(deptCode);
      deptCodes.forEach((dCode) => {
        subjects.push({
          code,
          name,
          credits,
          semester: isNaN(semester) ? 1 : semester,
          department: dCode,
          regulation: regName,
        });
      });
    }
  });

  console.log(`Mapped ${subjects.length} active subjects.`);
  console.log(`Detected regulations: ${Array.from(regulationsToCreate).join(", ")}`);

  // ── 4. Import Regulations in Convex ──
  console.log("\n📦 Syncing regulations with Convex...");
  const regulationsArray = Array.from(regulationsToCreate).map((name) => ({
    name: name.toUpperCase(),
    createdAt: Date.now(),
  }));
  
  const regResult = await mutation("migrations:importRegulations", { regulations: regulationsArray });
  console.log(`✅ Regulations sync: inserted ${regResult.inserted}, skipped ${regResult.skipped}.`);

  // ── 5. Import Subjects in Convex ──
  console.log("\n📦 Syncing subjects with Convex...");
  let inserted = 0;
  let skipped = 0;
  const batches = chunk(subjects, 50);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    process.stdout.write(`   Sending batch ${i + 1}/${batches.length}... `);
    try {
      const res = await mutation("migrations:importSubjects", { subjects: batch });
      inserted += res.inserted;
      skipped += res.skipped;
      console.log(`Success (inserted ${res.inserted}, skipped ${res.skipped})`);
    } catch (err) {
      console.log(`❌ Failed: ${err.message}`);
    }
  }

  console.log(`\n🎉 Import complete!`);
  console.log(`   Total inserted: ${inserted}`);
  console.log(`   Total skipped (already existed): ${skipped}`);
}

main().catch((err) => {
  console.error("❌ Script error:", err);
  process.exit(1);
});
