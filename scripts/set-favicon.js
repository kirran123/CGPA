const fs = require("fs");
const path = require("path");

const sourceTransparent = "C:\\Users\\kishore ST\\.gemini\\antigravity\\brain\\b5ed4c4f-1d2a-4ad4-b428-17700396a4a6\\rit_logo_transparent_1783766380954.png";
const sourceOriginal    = "C:\\Users\\kishore ST\\.gemini\\antigravity\\brain\\b5ed4c4f-1d2a-4ad4-b428-17700396a4a6\\media__1783765374636.jpg";
const destPng = "c:\\Users\\kishore ST\\Desktop\\CGPA\\frontend\\public\\favicon.png";
const destIco = "c:\\Users\\kishore ST\\Desktop\\CGPA\\frontend\\public\\favicon.ico";
const destLogo = "c:\\Users\\kishore ST\\Desktop\\CGPA\\frontend\\public\\rit-logo.jpg";

try {
  if (fs.existsSync(sourceTransparent)) {
    fs.copyFileSync(sourceTransparent, destPng);
    fs.copyFileSync(sourceTransparent, destIco);
    console.log("✅ Copied transparent logo to favicon.png and favicon.ico!");
  } else {
    console.error("❌ Transparent favicon source not found:", sourceTransparent);
  }

  if (fs.existsSync(sourceOriginal)) {
    fs.copyFileSync(sourceOriginal, destLogo);
    console.log("✅ Copied original RIT logo to public/rit-logo.jpg!");
  } else {
    console.error("❌ Original logo source not found:", sourceOriginal);
  }
} catch (err) {
  console.error("❌ Copy failed:", err.message);
}
