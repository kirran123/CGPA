import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import bcrypt from "bcryptjs";
import { syncHodForDept } from "./departments";

// Seed default super admin if none exists
export const seedSuperAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", "admin@rit.edu.in"))
      .unique();

    if (!existing) {
      const salt = bcrypt.genSaltSync(12);
      const hashedPassword = bcrypt.hashSync("admin123", salt);
      await ctx.db.insert("users", {
        name: "Super Admin",
        email: "admin@rit.edu.in",
        password: hashedPassword,
        role: "super_admin",
        permissions: ["FULL_ACCESS"],
        status: "Active",
        firstLogin: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      console.log("Seeded default super admin: admin@rit.edu.in / admin123");
      return true;
    }
    return false;
  },
});

// Authentication Login
export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const emailLower = args.email.toLowerCase().trim();
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", emailLower))
      .unique();

    if (!user) {
      throw new Error("Invalid email or password");
    }

    if (user.status === "Inactive") {
      throw new Error("User account is inactive");
    }

    const isMatch = bcrypt.compareSync(args.password, user.password);
    if (!isMatch) {
      throw new Error("Invalid email or password");
    }

    // Return user info and a mock token (frontend uses it to store in localstorage)
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department || "",
      permissions: user.permissions || [],
      status: user.status,
      token: `convex_session_${user._id}_${Date.now()}`,
    };
  },
});

// Get staff list
export const getStaff = query({
  args: {},
  handler: async (ctx) => {
    const allUsers = await ctx.db.query("users").collect();
    // Exclude super_admins or return all for admin dashboard
    return allUsers
      .filter((u) => u.role !== "super_admin")
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

// Create Staff Member
export const createStaff = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    employeeId: v.optional(v.string()),
    mobile: v.optional(v.string()),
    password: v.string(),
    role: v.union(v.literal("dept_admin"), v.literal("staff")),
    department: v.string(),
    designation: v.optional(v.string()),
    permissions: v.array(v.string()),
    status: v.optional(v.union(v.literal("Active"), v.literal("Inactive"))),
  },
  handler: async (ctx, args) => {
    const emailLower = args.email.toLowerCase().trim();
    
    // Check if user already exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", emailLower))
      .unique();

    if (existing) {
      throw new Error("Email already registered");
    }

    const salt = bcrypt.genSaltSync(12);
    const hashedPassword = bcrypt.hashSync(args.password, salt);

    const userId = await ctx.db.insert("users", {
      name: args.name,
      email: emailLower,
      employeeId: args.employeeId,
      mobile: args.mobile,
      password: hashedPassword,
      role: args.role,
      department: args.department,
      designation: args.designation,
      permissions: args.permissions,
      status: args.status ?? "Active",
      firstLogin: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    if (args.department) {
      await syncHodForDept(ctx, args.department);
    }

    return userId;
  },
});

// Update Staff Member
export const updateStaff = mutation({
  args: {
    id: v.id("users"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    employeeId: v.optional(v.string()),
    mobile: v.optional(v.string()),
    password: v.optional(v.string()),
    role: v.optional(v.union(v.literal("dept_admin"), v.literal("staff"))),
    department: v.optional(v.string()),
    designation: v.optional(v.string()),
    permissions: v.optional(v.array(v.string())),
    status: v.optional(v.union(v.literal("Active"), v.literal("Inactive"))),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.id);
    if (!user) {
      throw new Error("User not found");
    }

    const updates: Partial<typeof user> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.employeeId !== undefined) updates.employeeId = args.employeeId;
    if (args.mobile !== undefined) updates.mobile = args.mobile;
    if (args.role !== undefined) updates.role = args.role;
    if (args.department !== undefined) updates.department = args.department;
    if (args.designation !== undefined) updates.designation = args.designation;
    if (args.permissions !== undefined) updates.permissions = args.permissions;
    if (args.status !== undefined) updates.status = args.status;

    if (args.email !== undefined) {
      const emailLower = args.email.toLowerCase().trim();
      if (emailLower !== user.email) {
        const existing = await ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", emailLower))
          .unique();
        if (existing) {
          throw new Error("Email already registered");
        }
        updates.email = emailLower;
      }
    }

    if (args.password !== undefined && args.password !== "") {
      const salt = bcrypt.genSaltSync(12);
      updates.password = bcrypt.hashSync(args.password, salt);
    }

    updates.updatedAt = Date.now();
    await ctx.db.patch(args.id, updates);

    // Sync HOD for previous and new departments
    if (user.department) {
      await syncHodForDept(ctx, user.department);
    }
    if (updates.department && updates.department !== user.department) {
      await syncHodForDept(ctx, updates.department);
    }

    return args.id;
  },
});

// Delete Staff
export const deleteStaff = mutation({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.id);
    if (!user) {
      throw new Error("User not found");
    }
    await ctx.db.delete(args.id);

    if (user.department) {
      await syncHodForDept(ctx, user.department);
    }

    return { success: true };
  },
});
