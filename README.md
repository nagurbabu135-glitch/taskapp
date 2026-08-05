# TaskLoop — Daily Task App

A mobile-friendly, installable **Progressive Web App (PWA)** for daily recurring tasks, backed by a **MongoDB + Node.js/Express API**.

Key behaviors:
- **User accounts** — username + password login. Your tasks are stored per-user in MongoDB.
- **Stay logged in** — sessions last until you tap **Logout** (no automatic logout).
- **24-hour auto-reset** — every task you complete comes back as "new" after 24 hours, so your daily list always repeats.
- **Two daily reminders** — default 5:00 AM and 8:00 PM (configurable) with **customizable sound + volume**.
- **Works offline** — cached by a service worker; tasks are synced when the server is reachable.
- **Installable** — add to home screen on Android and iPhone.

---

## Project Structure

```
taskapp/
├── index.html            # App UI + all app logic (login, tasks, reminders)
├── manifest.webmanifest  # PWA manifest (name, icons, standalone mode)
├── sw.js                 # Service worker (offline cache + push + notifications)
├── icon-192.png          # App icon 192x192
├── icon-512.png          # App icon 512x512 (also maskable)
├── apple-touch-icon.png  # iOS home-screen icon 180x180
├── README.md             # This file
└── backend/
    ├── server.js         # Express server entry (auto-starts MongoDB if needed)
    ├── package.json      # Dependencies
    ├── .env.example      # Config template (copy to .env)
    ├── models/
    │   ├── User.js       # User schema (username, password hash)
    │   └── Task.js       # Task schema (text, done, doneAt, owner)
    ├── routes/
    │   ├── auth.js       # signup / login / me endpoints
    │   └── tasks.js      # task CRUD endpoints
    ├── middleware/
    │   └── auth.js       # JWT verification
    └── .gitignore
```

---

## Architecture

```
  +---------------------------+          +------------------------------+
  |        Frontend (PWA)     |  HTTPS   |        Backend (API)         |
  |      index.html + sw.js   | -------> |      backend/server.js       |
  |  - login / signup screen  |          |  - auth (JWT, bcrypt)        |
  |  - task list + reminders  |          |  - tasks CRUD               |
  +------------+--------------+          +--------------+---------------+
               |                                        |
        localStorage                              mongoose
   (session token, settings,                     (driver)
    offline task cache)                              |
               |                                     v
               |                           +----------------------+
               +------ reminders --------->|       MongoDB       |
         (Notification Triggers,           |  users + tasks docs |
          in-app chime)                    +----------------------+
```

### Components and responsibilities

| Component | File | Responsibility |
|---|---|---|
| App UI & logic | `index.html` | Login/signup, rendering tasks, add/complete/delete, filters, reminders, sound |
| Session storage | `localStorage` | JWT token (`taskloop.token`), username (`taskloop.user`), settings, offline task cache |
| API server | `backend/server.js` | Express app, CORS, JSON, health check, auto-starts local MongoDB if it is not running |
| Auth | `backend/routes/auth.js` + `middleware/auth.js` | Username/password signup & login, bcrypt hashing, 365-day JWT (no auto logout) |
| Task API | `backend/routes/tasks.js` | Per-user task create/read/update/delete + clear-completed |
| Database | MongoDB | `users` and `tasks` collections; tasks scoped to their owner via `userId` |
| Offline | `sw.js` | Serves the app shell offline; task data cached locally and re-synced |

---

## Data flow

### Login / session (persistent until logout)
```
App opens
  └─> token in localStorage?
       ├─ no  ─> show login screen
       └─ yes ─> GET /api/auth/me
                  ├─ 200 ─> session restored, load tasks
                  └─ 401 ─> show login screen (only if token was revoked)

User logs in or signs up
  └─> POST /api/auth/login (or /signup)
       └─> returns { token, username }  (JWT valid 365 days)
            └─> stored in localStorage -> stays logged in across restarts
                 └─> only removed when user taps "Logout"
```

### Task lifecycle (server-authoritative)
```
User adds task
  └─> POST /api/tasks { text }  →  saved in MongoDB (owner = logged-in user)

User completes task
  └─> PUT /api/tasks/:id { done: true }  →  doneAt = now
       └─> after 24 h the app/client resets it: PUT { done: false }

Data is also cached in localStorage for offline use; on reload the app
refetches from the API and overwrites the cache.
```

### Reminder lifecycle (unchanged)
- Android/Chrome: **Notification Triggers** pre-schedules 60 days of 5 AM / 8 PM notifications (work with the app closed).
- While open: a 30-second timer fires the chime + notification (uses the selected sound preset and volume).

---

## Backend setup

### 1. Install & run locally (recommended for personal use)

1. **MongoDB** — already runs as a Windows service. The backend also auto-starts it if it is stopped, so **you never need to open MongoDB Compass**.
2. From `taskapp/backend/`:
   ```
   npm install
   npm start
   ```
   → API starts on `http://localhost:4000`. It connects to `mongodb://127.0.0.1:27017/taskloop` automatically.

### 2. Point the app at the backend

Open the app and edit the **Server** field:
- PC: `http://localhost:4000/api`
- Phone (same Wi-Fi): `http://<your-PC-IP>:4000/api` (e.g. `http://192.168.0.101:4000/api`)

Then tap **Save**. (The URL is stored in `localStorage` as `taskloop.api`.)

### 3. Use MongoDB Atlas (optional, for use anywhere)

1. Create a free cluster at https://www.mongodb.com/atlas
2. In `backend/`, copy `.env.example` to `.env` and set:
   ```
   MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/taskloop
   JWT_SECRET=<a-long-random-string>
   PORT=4000
   CLIENT_ORIGIN=https://nagurbabu135-glitch.github.io
   ```
3. Run `npm start`.

> Hosting the API on a service like Render gives you a permanent HTTPS URL to use from anywhere.

---

## API reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | no | Create account `{ username, password }` → `{ token, username }` (seeds 4 sample tasks) |
| POST | `/api/auth/login` | no | Log in → `{ token, username }` |
| GET | `/api/auth/me` | yes | Verify session → `{ username }` |
| GET | `/api/tasks` | yes | List current user's tasks |
| POST | `/api/tasks` | yes | Create task `{ text }` |
| PUT | `/api/tasks/:id` | yes | Update `{ text?, done?, doneAt? }` |
| DELETE | `/api/tasks/:id` | yes | Delete one task |
| DELETE | `/api/tasks/completed` | yes | Delete all completed tasks |

---

## Hosting the frontend (GitHub Pages)

Already live at: **https://nagurbabu135-glitch.github.io/taskapp/**

To update it after changes, push from the repo root:
```
git add .
git commit -m "update"
git push
```

---

## Roadmap / possible extensions

- Host the API on a free server (Render) for access from anywhere.
- Web Push (ntfy.sh / Firebase) for closed-app reminders on iPhone.
- Per-task "repeat daily" toggle.
- Task priorities and due dates.
