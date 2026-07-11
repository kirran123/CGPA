import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get all regulations
export const get = query({
  args: {},
  handler: async (ctx) => {
    const list = await ctx.db.query("regulations").collect();
    return list.sort((a, b) => b.name.localeCompare(a.name)); // Sort descending (e.g. R2021, R2017)
  },
});

// Create a regulation
export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const nameUpper = args.name.toUpperCase().trim();
    const existing = await ctx.db
      .query("regulations")
      .withIndex("by_name", (q) => q.eq("name", nameUpper))
      .unique();

    if (existing) {
      throw new Error("Regulation already exists");
    }

    const regId = await ctx.db.insert("regulations", {
      name: nameUpper,
      createdAt: Date.now(),
    });

    return regId;
  },
});
