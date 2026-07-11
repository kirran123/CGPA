const fs = require("fs");
const path = require("path");

const imagePath = "C:\\Users\\kishore ST\\.gemini\\antigravity\\brain\\b5ed4c4f-1d2a-4ad4-b428-17700396a4a6\\media__1783765374636.jpg";
const htmlPath = "c:\\Users\\kishore ST\\Desktop\\CGPA\\scripts\\favicon-helper.html";

try {
  if (!fs.existsSync(imagePath)) {
    console.error("❌ Source image not found");
    process.exit(1);
  }

  const base64Image = fs.readFileSync(imagePath).toString("base64");
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Favicon Helper</title>
</head>
<body style="background: #111; color: white; font-family: sans-serif; padding: 20px;">
  <h2>Processing Logo...</h2>
  <canvas id="canvas" style="display:none;"></canvas>
  <textarea id="output" style="width: 100%; height: 300px; margin-top: 20px;"></textarea>
  <script>
    const img = new Image();
    img.src = "data:image/jpeg;base64,${base64Image}";
    img.onload = () => {
      const canvas = document.getElementById('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw image
      ctx.drawImage(img, 0, 0);
      
      // Remove white background
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];
        
        // If color is close to white, make it transparent
        if (r > 235 && g > 235 && b > 235) {
          data[i+3] = 0; // Alpha
        }
      }
      
      ctx.putImageData(imgData, 0, 0);
      
      // Output as transparent PNG base64
      const base64Png = canvas.toDataURL('image/png').split(',')[1];
      document.getElementById('output').value = base64Png;
      document.body.appendChild(document.createTextNode("✅ Processing complete!"));
    };
  </script>
</body>
</html>
  `;

  fs.writeFileSync(htmlPath, htmlContent);
  console.log("✅ Created scripts/favicon-helper.html");
} catch (err) {
  console.error("❌ Failed:", err.message);
}
