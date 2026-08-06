import "dotenv/config";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import authRoutes from "./routes/auth.js";
import taskRoutes from "./routes/tasks.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = path.join(__dirname, "..");

const app = express();
const PORT = process.env.PORT || 4000;
const WEB_PORT = process.env.WEB_PORT || 8000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/taskloop";
const LOCAL_DBPATH = process.env.MONGODB_DBPATH || process.env.APPDATA + "/taskloop-mongodb";

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use(express.static(STATIC_DIR));

function lanIps() {
  const out = [];
  const VIRTUAL = /virtual|vethernet|vswitch|hyper|wsl|docker|loopback|vmware|vmnet|bluetooth|tap|tun|tailscale|zerotier/i;
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    if (VIRTUAL.test(name)) continue;
    for (const iface of list || []) {
      if (iface.family === "IPv4" && !iface.internal) out.push({ name, address: iface.address });
    }
  }
  return out;
}

app.get("/connect", (_req, res) => {
  const ips = lanIps();
  const cards = ips.map((entry) => {
    const url = `http://${entry.address}:${WEB_PORT}/`;
    return `
      <div style="background:#ffffff;border-radius:16px;padding:22px;text-align:center;box-shadow:0 4px 20px rgba(2,74,134,.12);margin-bottom:18px">
        <div style="font-size:14px;color:#0a7bc4;font-weight:700;margin-bottom:6px">Connect via ${entry.name} (${entry.address})</div>
        <a href="${url}" style="font-size:24px;font-weight:800;color:#0b4f8a;text-decoration:none;word-break:break-all">${url}</a>
        <div style="margin-top:14px">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}" alt="QR code" width="240" height="240" style="border-radius:10px">
        </div>
      </div>`;
  }).join("");
  res.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect your phone to TaskLoop</title></head>
  <body style="margin:0;padding:20px;font-family:Segoe UI,Arial,sans-serif;background:linear-gradient(135deg,#eaf4ff,#dbeafe);min-height:100vh">
    <div style="max-width:560px;margin:0 auto">
      <h1 style="color:#0b4f8a;font-size:24px;margin:8px 0 4px">Connect your phone</h1>
      <p style="color:#37566e;margin:0 0 20px">On your phone: open the camera app and scan a QR code below. Then log in — the Server address fills in automatically.</p>
      ${cards || "<p style='color:#b00020'>No LAN IP found. Make sure Wi-Fi is connected.</p>"}
      <p style="color:#37566e;font-size:13px;line-height:1.6">Your PC's address can change if it reconnects to Wi-Fi. If scanning stops working, reopen this page (<strong>http://localhost:8000/connect</strong> on the PC) to get the new QR code.</p>
    </div>
  </body></html>`);
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

function waitForMongo(attempts = 30) {
  return new Promise((resolve, reject) => {
    const tryOnce = async (left) => {
      try {
        await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 1500 });
        resolve();
      } catch {
        if (left <= 0) return reject(new Error("MongoDB did not come up in time"));
        setTimeout(() => tryOnce(left - 1), 1000);
      }
    };
    tryOnce(attempts);
  });
}

async function startMongo() {
  if (process.env.MONGODB_URI) return;
  if (!existsSync(LOCAL_DBPATH)) mkdirSync(LOCAL_DBPATH, { recursive: true });
  const child = spawn("mongod", ["--dbpath", LOCAL_DBPATH, "--port", "27017", "--bind_ip", "127.0.0.1"], {
    stdio: "ignore",
    detached: true
  });
  child.unref();
  console.log("Auto-starting local MongoDB...");
}

(async () => {
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 2000 });
  } catch {
    await startMongo();
    await waitForMongo();
  }

  const BIND_HOST = process.env.BIND_HOST || "0.0.0.0";

  const apiServer = app.listen(PORT, BIND_HOST, () => {
    console.log(`TaskLoop API running on http://0.0.0.0:${PORT} (all interfaces)`);
    console.log(`MongoDB connected: ${MONGODB_URI}`);
  });

  const webServer = app.listen(WEB_PORT, BIND_HOST, () => {
    console.log(`TaskLoop app + API running on http://0.0.0.0:${WEB_PORT} (all interfaces)`);
    console.log(`Static files served from: ${STATIC_DIR}`);
  });

  apiServer.on("error", (err) => { if (err.code !== "EADDRINUSE") throw err; });
  webServer.on("error", (err) => { if (err.code !== "EADDRINUSE") throw err; });
})().catch((err) => {
  console.error("Startup failed:", err.message);
  process.exit(1);
});
