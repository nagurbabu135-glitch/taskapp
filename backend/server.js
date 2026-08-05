import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import authRoutes from "./routes/auth.js";
import taskRoutes from "./routes/tasks.js";

const app = express();
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/taskloop";
const LOCAL_DBPATH = process.env.MONGODB_DBPATH || process.env.APPDATA + "/taskloop-mongodb";

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);

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

  app.listen(PORT, () => {
    console.log(`TaskLoop API running on http://localhost:${PORT}`);
    console.log(`MongoDB connected: ${MONGODB_URI}`);
  });
})().catch((err) => {
  console.error("Startup failed:", err.message);
  process.exit(1);
});
