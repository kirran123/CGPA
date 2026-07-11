# 🚀 Migration Guide: Shifting from Render (Express/Node.js/MongoDB) to Convex

This guide outlines the step-by-step process to migrate the **RIT Academic Portal** backend from **Render + MongoDB Atlas** to **Convex** (convex.dev). 

## Why Convex?
- **Zero Server Overhead**: Replaces Express servers and database clustering with a serverless, real-time backend.
- **Auto-Syncing React State**: State updates automatically when data changes (no manual polling or refetching).
- **Fast V8 Environment + Node.js Actions**: Run standard database work instantly in V8, and switch to Node.js actions for heavy lifting like PDF generation and file processing.
- **Built-in Storage**: Replaces MongoDB binary storage or S3 with a simple asset storage API.

---

## Architecture Comparison

```
[Current Stack]: Browser ──> Vercel (React/Vite) ──> Render (Express API) ──> MongoDB Atlas
[Convex Stack]:  Browser ──> Vercel (React/Vite) ──> Convex (Queries, Mutations, Actions, DB)
```

---

## 🛠️ Step 1: Initialize Convex in Your Project

Convex sits directly inside your frontend repository as a folder named `convex/`.

1. Open PowerShell in `C:\Users\kishore ST\Desktop\CGPA\frontend` and install the Convex client:
   ```powershell
   npm install convex
   ```

2. Initialize your Convex project. This will prompt you to log into Convex and create a new project:
   ```powershell
   npx convex dev
   ```
   *This command will create a `convex/` directory in your frontend folder and generate a local `.env.local` containing your Convex URL.*

---

## 🗄️ Step 2: Define the Database Schema (`convex/schema.ts`)

Convex uses a schema definition file to enforce types and index data. We'll translate your Mongoose models into Convex tables.

Create a new file `convex/schema.ts`:

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users Table (Replaces User.js)
  users: defineTable({
    name: v.string(),
    employeeId: v.optional(v.string()),
    email: v.string(),
    mobile: v.optional(v.string()),
    password: v.string(), // Hashed password (if using custom auth)
    role: v.union(v.literal("super_admin"), v.literal("dept_admin"), v.literal("staff")),
    department: v.optional(v.string()),
    designation: v.optional(v.string()),
    permissions: v.array(v.string()),
    status: v.union(v.literal("Active"), v.literal("Inactive")),
    firstLogin: v.optional(v.boolean()),
    createdAt: v.number(), // Unix millisecond timestamp
    updatedAt: v.number(),
  })
  .index("by_email", ["email"])
  .index("by_department", ["department"]),

  // Departments Table (Replaces Department.js)
  departments: defineTable({
    name: v.string(),
    code: v.string(), // Unique department code, e.g., "IT", "CSE"
    description: v.optional(v.string()),
    hodName: v.optional(v.string()),
    email: v.optional(v.string()),
    status: v.union(v.literal("Active"), v.literal("Inactive")),
    createdAt: v.number(),
  }).index("by_code", ["code"]),

  // Subjects Table (Replaces Subject.js)
  subjects: defineTable({
    code: v.string(),
    name: v.string(),
    credits: v.number(),
    semester: v.number(),
    department: v.string(),
    regulation: v.string(),
  })
  .index("by_code_dept", ["code", "department"])
  .index("by_dept_sem_reg", ["department", "semester", "regulation"]),

  // GPA Records Table (Replaces GpaRecord.js)
  gpaRecords: defineTable({
    studentName: v.string(),
    registerNo: v.string(),
    semester: v.number(),
    regulation: v.string(),
    department: v.string(),
    subjects: v.array(
      v.object({
        subjectCode: v.string(),
        subjectName: v.string(),
        credits: v.number(),
        grade: v.string(),
        gradePoint: v.number(),
        creditPoints: v.number(),
      })
    ),
    totalCredits: v.number(),
    totalPoints: v.number(),
    gpa: v.number(),
    cgpa: v.optional(v.number()),
    calculatedBy: v.id("users"),
    isBulk: v.boolean(),
    batchName: v.optional(v.string()),
    batchId: v.optional(v.string()),
    pdfStorageId: v.optional(v.string()), // References Convex file storage
    createdAt: v.number(),
  })
  .index("by_student", ["registerNo", "semester", "department"])
  .index("by_batch", ["batchId"])
  .index("by_department", ["department"]),

  // CGPA Records Table (Replaces CgpaRecord.js)
  cgpaRecords: defineTable({
    studentName: v.string(),
    registerNo: v.string(),
    department: v.string(),
    regulation: v.string(),
    semesters: v.array(
      v.object({
        semester: v.number(),
        gpa: v.number(),
        credits: v.number(),
      })
    ),
    totalCredits: v.number(),
    cgpa: v.number(),
    calculatedBy: v.id("users"),
    isBulk: v.boolean(),
    pdfStorageId: v.optional(v.string()),
    createdAt: v.number(),
  })
  .index("by_registerNo", ["registerNo"])
  .index("by_department", ["department"]),

  // Grade Settings Table (Replaces GradeSetting.js)
  gradeSettings: defineTable({
    department: v.string(),
    regulation: v.string(),
    semester: v.number(),
    grades: v.array(
      v.object({
        grade: v.string(),
        points: v.number(),
      })
    ),
  }).index("by_dept_reg_sem", ["department", "regulation", "semester"]),

  // Audit Logs (Replaces HistoryLog.js)
  historyLogs: defineTable({
    action: v.string(),
    details: v.string(),
    performedBy: v.id("users"),
    performedByName: v.string(),
    department: v.optional(v.string()),
    timestamp: v.number(),
  }).index("by_department", ["department"]),

  // Regulations Table (Replaces Regulation.js)
  regulations: defineTable({
    name: v.string(),
    createdAt: v.number(),
  }).index("by_name", ["name"]),
});
```

---

## 🔐 Step 3: Implement Authentication

You have two choices for authentication:

### Option A: Clerk Auth (Recommended)
Clerk is fully integrated with Convex. It handles signups, logins, MFA, password resets, and session management automatically.
1. Sign up on [clerk.com](https://clerk.com).
2. Configure Clerk authentication in `convex/auth.config.ts`.
3. Wrap your frontend in `<ClerkProvider>` and `<ConvexProviderWithClerk>`.
4. In Convex functions, check `ctx.auth.getUserIdentity()` to get the logged-in user.

### Option B: Custom Email/Password Authentication (Saves UI migration time)
If you want to keep the existing custom email/password flow without rewriting the login form:
1. Store hashed passwords in the `users` table.
2. Build Convex mutations for logging in and checking user credentials using `bcryptjs`.
3. Create a JWT in a Convex action or use custom session tokens stored in a `sessions` table.

Here is how you can implement password checking as a custom mutation in `convex/auth.ts`:

```typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { Crypto } from "crypto"; // built-in Node library or standard bcrypt

export const login = mutation({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();

    if (!user || user.status === "Inactive") {
      throw new Error("Invalid credentials or account inactive");
    }

    // In a real implementation, use a library like bcryptjs (inside an Action)
    // to compare the password hash. If correct:
    return {
      userId: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      permissions: user.permissions,
    };
  },
});
```

---

## ⚡ Step 4: Rewrite Express Route Logic to Convex Functions

Express route handlers correspond directly to Convex **Queries** (read operations) and **Mutations** (write operations).

### Example 1: Subject Queries and Mutations (`convex/subjects.ts`)

Instead of writing Mongoose queries, use Convex's database client API.

```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ── GET SUBJECTS ──
export const get = query({
  args: {
    department: v.string(),
    semester: v.optional(v.number()),
    regulation: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("subjects")
      .withIndex("by_code_dept"); // or a custom query index

    // Retrieve and filter
    const subjects = await ctx.db
      .query("subjects")
      .filter((q) => q.eq(q.field("department"), args.department))
      .collect();

    // Perform sorting and additional filtering in JS
    let results = subjects;
    if (args.semester !== undefined) {
      results = results.filter((s) => s.semester === args.semester);
    }
    if (args.regulation !== undefined) {
      results = results.filter((s) => s.regulation === args.regulation);
    }

    return results.sort((a, b) => a.semester - b.semester || a.code.localeCompare(b.code));
  },
});

// ── CREATE SUBJECT ──
export const create = mutation({
  args: {
    code: v.string(),
    name: v.string(),
    credits: v.number(),
    semester: v.number(),
    department: v.string(),
    regulation: v.string(),
    userId: v.id("users"), // passed from frontend or auth state
  },
  handler: async (ctx, args) => {
    // 1. Check duplicate
    const existing = await ctx.db
      .query("subjects")
      .withIndex("by_code_dept", (q) => q.eq("code", args.code.toUpperCase()).eq("department", args.department))
      .unique();

    if (existing) {
      throw new Error("Subject code already exists in this department");
    }

    // 2. Insert Subject
    const subjectId = await ctx.db.insert("subjects", {
      code: args.code.toUpperCase(),
      name: args.name,
      credits: args.credits,
      semester: args.semester,
      department: args.department,
      regulation: args.regulation,
    });

    // 3. Create Audit Log
    const user = await ctx.db.get(args.userId);
    await ctx.db.insert("historyLogs", {
      action: "Create Subject",
      details: `Created subject ${args.name} (${args.code}) in department ${args.department}`,
      performedBy: args.userId,
      performedByName: user?.name || "Unknown",
      department: args.department,
      timestamp: Date.now(),
    });

    return subjectId;
  },
});
```

---

## 📂 Step 5: Handling File Uploads and PDF Generation (Convex Actions)

Convex **Actions** run in a full Node.js environment. You can use any npm packages (like `pdfkit`, `xlsx`, `tesseract.js`) here.

### 5a. File Parsing & Upload Flow
Convex has built-in file storage. Here is the workflow:

1. **Frontend gets an upload URL** from Convex: `ctx.storage.generateUploadUrl()`.
2. **Frontend POSTs the file** directly to that URL.
3. Convex returns a `storageId`.
4. **Frontend calls a Convex Action** with the `storageId`.
5. **The Action downloads the file buffer** internally using `ctx.storage.getStream(storageId)` or `ctx.storage.getBytes(storageId)`, processes it (using `xlsx` or `pdfkit`), writes results to the database, and deletes the temp file.

### Example: Bulk Uploading Excel/PDF subjects (`convex/bulkUpload.ts`)

```typescript
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import XLSX from "xlsx"; // XLSX works fully in Convex Actions!

export const parseExcelSubjects = action({
  args: {
    storageId: v.string(),
    department: v.string(),
    regulation: v.string(),
    semester: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // 1. Fetch file from Convex Storage
    const fileBytes = await ctx.storage.getBytes(args.storageId);
    if (!fileBytes) throw new Error("File not found in storage");

    const buffer = Buffer.from(fileBytes);

    // 2. Parse buffer using XLSX
    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

    const parsedSubjects = rows.map((r: any) => {
      // Map columns...
      return {
        code: String(r.Code || r.subjectcode || "").trim().toUpperCase(),
        name: String(r.Name || r.subjectname || "").trim(),
        credits: parseInt(r.Credits || r.credit || 3, 10),
        semester: args.semester || parseInt(r.Semester || r.sem || 1, 10),
      };
    });

    // 3. Save parsed records to Convex DB by calling a mutation internally
    for (const sub of parsedSubjects) {
      if (!sub.code || !sub.name) continue;
      await ctx.runMutation(api.subjects.create, {
        code: sub.code,
        name: sub.name,
        credits: sub.credits,
        semester: sub.semester,
        department: args.department,
        regulation: args.regulation,
        userId: "..." as any, // ID of user performing upload
      });
    }

    // 4. Delete the temporary file from Convex Storage to save space
    await ctx.storage.delete(args.storageId);

    return { processed: parsedSubjects.length };
  },
});
```

---

## 🎨 Step 6: Connect the React Frontend to Convex

### 6a. Wrap Your React App
In your main entry file (e.g. `frontend/src/main.tsx` or `frontend/app/layout.tsx`), hook up the Convex client:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ConvexProvider, ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConvexProvider client={convex}>
      <App />
    </ConvexProvider>
  </React.StrictMode>
);
```

### 6b. Using Convex Hooks in Components
Replace standard REST queries with Convex hooks. This provides automatic real-time updates!

#### Before (REST / `api.ts`):
```tsx
const [subjects, setSubjects] = useState<Subject[]>([]);
useEffect(() => {
  api.getSubjects(department, semester).then(setSubjects);
}, [department, semester]);
```

#### After (Convex Hook):
```tsx
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

const subjects = useQuery(api.subjects.get, { 
  department: "IT", 
  semester: 3 
}); // Automatically updates in real-time when subjects change!
```

#### Running Mutations (Saving Data):
```tsx
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

const createSubject = useMutation(api.subjects.create);

const handleSave = async () => {
  try {
    await createSubject({
      code: "IT3401",
      name: "Software Engineering",
      credits: 3,
      semester: 4,
      department: "IT",
      regulation: "R2021",
      userId: currentUser._id,
    });
    alert("Subject created successfully!");
  } catch (err) {
    alert(err.message);
  }
};
```

---

## 🚀 Step 7: Deploying Convex

1. **Deploy database**:
   Convex builds and runs your backend code automatically when you save. When ready to go to production, run:
   ```powershell
   npx convex deploy
   ```
   This will build your production Convex environment and databases.

2. **Add Environment Variables to Vercel**:
   Go to your **Vercel** dashboard → Settings → Environment Variables. Add:
   - `VITE_CONVEX_URL`: The production URL provided by Convex (e.g., `https://happy-elk-234.convex.cloud`).

3. **Deploy Frontend on Vercel**:
   Vercel will build your static files. Because you are using standard react hooks, Vercel will bundle them and direct all operations to your Convex cloud project.

---

## 📝 Summary Checklist for Migration

- [ ] Install `convex` dependency in frontend project.
- [ ] Initialize Convex with `npx convex dev`.
- [ ] Write `convex/schema.ts` mapping Mongoose types.
- [ ] Set up Authentication (Clerk or custom Convex hashing).
- [ ] Create query files (`convex/subjects.ts`, `convex/gpa.ts`, `convex/analytics.ts`) replacing GET routes.
- [ ] Create mutation files replacing POST/PUT/DELETE routes.
- [ ] Create action files for PDF generation (`pdfkit`) and Excel parsing (`xlsx`).
- [ ] Replace `frontend/lib/api.ts` method references inside pages with `useQuery` / `useMutation` hooks.
- [ ] Deploy to production with `npx convex deploy` and update Vercel env vars.
