"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const bulkUpload = action({
  args: {
    storageId: v.string(),
    department: v.string(),
    regulation: v.string(),
    semester: v.optional(v.number()),
    skipDuplicates: v.boolean(),
  },
  handler: async (ctx, args) => {
    const arrayBuffer = await ctx.storage.get(args.storageId);
    if (!arrayBuffer) throw new Error("File not found in storage");

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const xlsx = require("xlsx");
    const workbook = xlsx.read(new Uint8Array(arrayBuffer), { type: "array" });
    const rawData: any[] = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });

    const pick = (r: any, ...keys: string[]) => {
      for (const k of keys) {
        const found = Object.keys(r).find((rk) => rk.trim().toLowerCase() === k.toLowerCase());
        if (found && String(r[found]).trim()) return String(r[found]).trim();
      }
      return "";
    };

    const subjects: any[] = [];
    for (const row of rawData) {
      const code = pick(row, "code", "subjectcode", "subject_code", "subject code").toUpperCase();
      const name = pick(row, "name", "subjectname", "subject_name", "subject name");
      if (!code || !name) continue;
      subjects.push({
        code,
        name,
        credits: parseInt(pick(row, "credits", "credit")) || 0,
        semester: args.semester !== undefined ? args.semester : (parseInt(pick(row, "semester", "sem")) || 1),
        department: args.department.toUpperCase(),
        regulation: args.regulation.toUpperCase(),
      });
    }

    if (!subjects.length) throw new Error("No valid subjects found in the file");
    const result = await ctx.runMutation(api.subjects.insertBulk, { subjects, skipDuplicates: args.skipDuplicates });
    await ctx.storage.delete(args.storageId);
    return result;
  },
});
