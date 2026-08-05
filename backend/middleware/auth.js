import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "taskloop-dev-secret-change-me";

export function signToken(userId) {
  return jwt.sign({ sub: userId.toString() }, JWT_SECRET, { expiresIn: "365d" });
}

export function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not logged in" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: "Session expired" });
  }
}
