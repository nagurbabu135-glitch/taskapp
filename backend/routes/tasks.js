import { Router } from "express";
import Task from "../models/Task.js";
import { auth } from "../middleware/auth.js";

const router = Router();
router.use(auth);

function toPlain(task) {
  return {
    id: task._id.toString(),
    text: task.text,
    done: task.done,
    doneAt: task.doneAt ? task.doneAt.toISOString() : null,
    createdAt: task.createdAt.toISOString()
  };
}

router.get("/", async (req, res) => {
  try {
    const tasks = await Task.find({ userId: req.userId }).sort({ createdAt: 1 });
    res.json(tasks.map(toPlain));
  } catch (err) {
    console.error("list", err);
    res.status(500).json({ error: "Could not load tasks." });
  }
});

router.post("/", async (req, res) => {
  try {
    const text = (req.body.text || "").trim();
    if (!text) return res.status(400).json({ error: "Task text is required." });
    if (text.length > 120) return res.status(400).json({ error: "Task is too long (max 120 characters)." });

    const task = await Task.create({ userId: req.userId, text, done: false, doneAt: null });
    res.status(201).json(toPlain(task));
  } catch (err) {
    console.error("create", err);
    res.status(500).json({ error: "Could not create task." });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.userId });
    if (!task) return res.status(404).json({ error: "Task not found." });

    if (typeof req.body.text === "string") task.text = req.body.text.trim();
    if (typeof req.body.done === "boolean") {
      task.done = req.body.done;
      task.doneAt = req.body.done ? new Date() : null;
    }
    if (req.body.doneAt !== undefined) task.doneAt = req.body.doneAt ? new Date(req.body.doneAt) : null;

    await task.save();
    res.json(toPlain(task));
  } catch (err) {
    console.error("update", err);
    res.status(500).json({ error: "Could not update task." });
  }
});

router.delete("/completed", async (req, res) => {
  try {
    await Task.deleteMany({ userId: req.userId, done: true });
    res.json({ ok: true });
  } catch (err) {
    console.error("clear", err);
    res.status(500).json({ error: "Could not clear completed tasks." });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const result = await Task.deleteOne({ _id: req.params.id, userId: req.userId });
    if (result.deletedCount === 0) return res.status(404).json({ error: "Task not found." });
    res.json({ ok: true });
  } catch (err) {
    console.error("delete", err);
    res.status(500).json({ error: "Could not delete task." });
  }
});

export default router;
