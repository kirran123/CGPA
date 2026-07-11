const https = require("https");
const CONVEX_URL = "https://successful-cuttlefish-940.convex.cloud";

function convexQuery(fnPath, args = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ path: fnPath, format: "json", args });
    const url = new URL(`${CONVEX_URL}/api/query`);
    const req = https.request(
      {
        hostname: url.hostname,
        port: 443,
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

async function run() {
  try {
    const stats = await convexQuery("migrations:getStatus");
    console.log("STATUS:", JSON.stringify(stats));
  } catch (err) {
    console.log("ERROR:", err.message);
  }
}

run();
