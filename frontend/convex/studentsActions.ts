"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const bulkUpload = action({
  args: {
    storageId: v.string(),
    department: v.string(),
    batch: v.string(),
    regulation: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const blob = await ctx.storage.get(args.storageId);
    if (!blob) throw new Error("File not found in storage");
    const arrayBuffer = await blob.arrayBuffer();

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

    const students: any[] = [];
    for (const row of rawData) {
      const registerNo = pick(row, "registerno", "register_no", "reg_no", "regno", "rollno", "roll_no", "register number").toUpperCase();
      const name = pick(row, "name", "studentname", "student_name", "student name", "fullname");
      if (!registerNo || !name) continue;

      const dept = pick(row, "department", "dept") || args.department;
      const batch = pick(row, "batch", "batchname", "year") || args.batch;
      const reg = pick(row, "regulation", "reg") || args.regulation || "R2021";

      students.push({
        name,
        registerNo,
        department: dept.toUpperCase(),
        batch,
        regulation: reg.toUpperCase(),
      });
    }

    if (!students.length) throw new Error("No valid student records found in the uploaded file");
    const result = (await ctx.runMutation(api.students.bulkInsert, { students })) as any;
    await ctx.storage.delete(args.storageId);
    return result;
  },
});
