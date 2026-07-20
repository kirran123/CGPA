import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users Table
  users: defineTable({
    name: v.string(),
    employeeId: v.optional(v.string()),
    email: v.string(),
    mobile: v.optional(v.string()),
    password: v.string(), // Hashed password
    role: v.union(v.literal("super_admin"), v.literal("dept_admin"), v.literal("staff")),
    department: v.optional(v.string()),
    designation: v.optional(v.string()),
    permissions: v.array(v.string()),
    status: v.union(v.literal("Active"), v.literal("Inactive")),
    firstLogin: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_department", ["department"]),

  // Departments Table
  departments: defineTable({
    name: v.string(),
    code: v.string(), // e.g., "IT", "CSE"
    description: v.optional(v.string()),
    hodName: v.optional(v.string()),
    email: v.optional(v.string()),
    status: v.union(v.literal("Active"), v.literal("Inactive")),
    createdAt: v.number(),
  }).index("by_code", ["code"]),

  // Subjects Table
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

  // GPA Records Table
  gpaRecords: defineTable({
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
    .index("by_student", ["registerNo", "semester", "department"])
    .index("by_batch", ["batchId"])
    .index("by_department", ["department"]),

  // CGPA Records Table
  cgpaRecords: defineTable({
    studentName: v.string(),
    registerNo: v.string(),
    department: v.string(),
    regulation: v.optional(v.string()),
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
    createdAt: v.number(),
  })
    .index("by_registerNo", ["registerNo"])
    .index("by_department", ["department"]),

  // Grade Settings Table
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

  // Audit Logs
  historyLogs: defineTable({
    action: v.string(),
    details: v.string(),
    performedBy: v.id("users"),
    performedByName: v.string(),
    department: v.optional(v.string()),
    timestamp: v.number(),
  }).index("by_department", ["department"]),

  // Regulations Table
  regulations: defineTable({
    name: v.string(),
    createdAt: v.number(),
  }).index("by_name", ["name"]),

  // Students Table (Master Roster)
  students: defineTable({
    name: v.string(),
    registerNo: v.string(),
    department: v.string(),
    batch: v.string(), // e.g. "2023-2027"
    regulation: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_registerNo", ["registerNo"])
    .index("by_department", ["department"])
    .index("by_dept_batch", ["department", "batch"]),
});
