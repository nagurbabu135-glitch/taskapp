import { Router } from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Task from "../models/Task.js";
import { auth, signToken } from "../middleware/auth.js";

const router = Router();
const SAMPLE_TASKS = [
  "Review quarterly goals and set priorities",
  "Draft project proposal for client",
  "Prepare slides for Monday standup",
  "Reply to team emails"
];

function validateCredentials(username, password) {
  if (!username || username.trim().length < 3) return "Username must be at least 3 characters.";
  if (!password || password.length < 6) return "Password must be at least 6 characters.";
  return null;
}

router.post("/signup", async (req, res) => {
  try {
    const username = (req.body.username || "").trim().toLowerCase();
    const password = req.body.password || "";
    const error = validateCredentials(username, password);
    if (error) return res.status(400).json({ error });

    const existing = await User.findOne({ username });
    if (existing) return res.status(409).json({ error: "Username already taken." });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, passwordHash });

    await Task.create(SAMPLE_TASKS.map((text) => ({ userId: user._id, text, done: false, doneAt: null })));

    const token = signToken(user._id);
    res.status(201).json({ token, username: user.username });
  } catch (err) {
    console.error("signup", err);
    res.status(500).json({ error: "Could not create account." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const username = (req.body.username || "").trim().toLowerCase();
    const password = req.body.password || "";
    if (!username || !password) return res.status(400).json({ error: "Username and password are required." });

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: "Incorrect username or password." });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: "Incorrect username or password." });

    const token = signToken(user._id);
    res.json({ token, username: user.username });
  } catch (err) {
    console.error("login", err);
    res.status(500).json({ error: "Login failed." });
  }
});

router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ error: "Account not found." });
    res.json({ username: user.username });
  } catch (err) {
    console.error("me", err);
    res.status(500).json({ error: "Session check failed." });
  }
});

export default router;
