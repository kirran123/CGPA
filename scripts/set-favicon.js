const fs = require("fs");
const path = require("path");

const source = "C:\\Users\\kishore ST\\.gemini\\antigravity\\brain\\b5ed4c4f-1d2a-4ad4-b428-17700396a4a6\\rit_logo_transparent_1783766380954.png";
const destPng = "c:\\Users\\kishore ST\\Desktop\\CGPA\\frontend\\public\\favicon.png";
const destIco = "c:\\Users\\kishore ST\\Desktop\\CGPA\\frontend\\public\\favicon.ico";

try {
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, destPng);
    fs.copyFileSync(source, destIco);
    console.log("✅ Copied RIT logo to favicon.png and favicon.ico successfully!");
  } else {
    console.error("❌ Source file not found:", source);
  }
} catch (err) {
  console.error("❌ Copy failed:", err.message);
}
