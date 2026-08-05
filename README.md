# TaskLoop — Daily Task App

A mobile-friendly, installable **Progressive Web App (PWA)** for daily recurring tasks.

Key behaviors:
- **24-hour auto-reset** — every task you complete comes back as "new" after 24 hours, so your daily list always repeats.
- **Two daily reminders** — default 5:00 AM and 8:00 PM (configurable).
- **Works offline** — cached by a service worker.
- **Installable** — add to home screen on Android and iPhone.

---

## Project Structure

```
taskapp/
├── index.html            # App UI + all app logic (single-page)
├── manifest.webmanifest  # PWA manifest (name, icons, standalone mode)
├── sw.js                 # Service worker (offline cache + push + notifications)
├── icon-192.png          # App icon 192x192
├── icon-512.png          # App icon 512x512 (also maskable)
├── apple-touch-icon.png  # iOS home-screen icon 180x180
└── README.md             # This file
```

---

## Architecture

```
                         +------------------------------+
                         |         index.html           |
                         |   UI (render + filters)      |
                         |   Task logic (24h reset)     |
                         |   Reminder scheduler         |
                         +--------------+---------------+
                                        |
                    localStorage        |        Service Worker
                 +----------------------+----------------------+
                 |                                             |
                 v                                             v
      +---------------------+                     +------------------------+
      |  taskloop.todos     |                     |        sw.js           |
      |  taskloop.settings  |                     |  offline cache (v1)    |
      +---------------------+                     |  push handler          |
                                                  |  notification click    |
                                                  +-----------+------------+
                                                              |
                                                              v
                                                  +------------------------+
                                                  | Notification Triggers  |
                                                  | (scheduled local notes)|
                                                  +------------------------+
```

### Components and responsibilities

| Component | File | Responsibility |
|---|---|---|
| UI & app logic | `index.html` | Rendering tasks, add/complete/delete, filters, progress bar, settings UI |
| Data storage | `localStorage` | Tasks under `taskloop.todos`, reminder settings under `taskloop.settings` |
| Offline caching | `sw.js` | Serves the app shell when offline; network-first for navigation, cache-first for assets |
| Background reminders | `sw.js` + `Notification Triggers` | Pre-schedules 60 days of 5 AM / 8 PM notifications that fire even when the app is closed (Chrome/Android) |
| In-app fallback | `index.html` | While the app is open, a 30-second timer fires the chime + notification at reminder times |
| Installability | `manifest.webmanifest` + icons | Enables "Add to Home Screen" with a standalone window |

---

## Data flow

### Task lifecycle
```
User adds task
   └─> saved to localStorage  (taskloop.todos)
        └─> rendered by render()

User completes task
   └─> done = true, doneAt = Date.now()
        └─> UI shows countdown badge "resets in 23h 40m"
             └─> when now - doneAt >= 24h  →  done = false, doneAt = null
                  └─> task appears as a fresh, open task (auto-repeat)
```

### Reminder lifecycle (Android / Chrome)
```
App opened (or settings changed)
   └─> refreshScheduled()
        └─> clears old taskloop-daily-* scheduled notes
             └─> registers 60 days x 2 slots via
                  reg.showNotification(..., { showTrigger: new TimestampTrigger(...) })
                   └─> OS fires notification even if app is closed
```

### Reminder lifecycle (fallback while app is open)
```
setInterval (every 30s)
   └─> checkInAppReminder()
        └─> if current time == 05:00 or 20:00 → chime + Notification
```

---

## Scheduling logic (index.html)

- `loadTodos()` / `saveTodos()` — persistence for the task list.
- `resetExpired()` — scans for tasks whose `doneAt` is older than 24 h and resets them. Runs on load and every 30 s.
- `refreshScheduled()` — the "no-server push": uses the **Notification Triggers API** (`TimestampTrigger`) to schedule ~120 local notifications 60 days ahead. No backend required.
- `checkInAppReminder()` — in-browser fallback that only works while the app is open.
- `playChime()` — Web Audio chime for immediate/test notifications.

---

## How to host it (free) — GitHub Pages

1. Go to https://github.com and create a new repository (e.g. `taskloop`).
2. On your PC, run:
   ```
   git init
   git add .
   git commit -m "TaskLoop PWA"
   git remote add origin https://github.com/<YOUR-USERNAME>/taskloop.git
   git push -u origin main
   ```
3. In the repo on GitHub: **Settings → Pages → Source → Branch: main → / (root) → Save**.
4. Your app is live at `https://<YOUR-USERNAME>.github.io/taskloop/`.

> HTTPS is required for installs, the service worker, and scheduled notifications — GitHub Pages provides it automatically.

---

## Install on your phone

### Android (Chrome)
1. Open `https://<YOUR-USERNAME>.github.io/taskloop/` in Chrome.
2. Tap the **Install** button (or the browser menu → "Add to Home screen").
3. Open the app from the home screen, turn on **Daily reminders**, and allow notifications.
4. Optional: for closed-app reminders in older Chrome versions, enable the flag `chrome://flags/#enable-notification-triggers` and restart.

### iPhone (Safari)
1. Open the same URL in Safari.
2. Tap **Share → Add to Home Screen** → Add.
3. Open from the home screen, enable reminders, and allow notifications.
   - Reminders fire while the app is open. Reminders while closed on iPhone require a push server (Web Push) — the service worker already contains a `push` handler ready for that.

---

## Local testing (optional)

```
npx serve taskapp
```
then open `http://localhost:3000` — service worker and scheduling work on `localhost`.

---

## Roadmap / possible extensions

- Web Push via a free service (ntfy.sh / Firebase) for true closed-app reminders on iPhone.
- Per-task "repeat daily" toggle instead of app-wide 24 h reset.
- Task priorities and due dates.
