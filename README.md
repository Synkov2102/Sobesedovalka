# Full-stack interview scaffold

Minimal **React (Vite) + NestJS** app for **live coding interviews**: **[Sandpack](https://sandpack.codesandbox.io/)**-powered **multi-file React + TypeScript** editor (Vite template) with file explorer, tabs, and **live preview** in an isolated bundler, plus health check and in-memory **tasks** CRUD. The host app proxies `/api` to the backend.

## Before the interview

1. Clone or copy this repo and run **`npm install`** in the **repository root** (installs root + `frontend` + `backend`).
2. From the root, run **`npm run dev`** — API on [http://localhost:3000](http://localhost:3000), UI on [http://localhost:5173](http://localhost:5173).
3. Open the UI once to confirm **Backend status** is green.
4. Keep **Node** and **npm** versions reasonable (LTS is fine). Close unrelated heavy apps if the machine is slow.

## API (prefix `/api`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | `{ ok, service }` |
| GET | `/api/tasks` | List tasks (newest first) |
| POST | `/api/tasks` | Body: `{ "title": string }` |
| DELETE | `/api/tasks/:id` | Remove a task |

Data is **in memory**; restarting the API clears tasks.

## Live sync (Sandpack + Socket.IO)

The React sandbox syncs open files across browsers via **Socket.IO** on the same Nest process (port **3000**).

1. Start **`npm run dev`** (or backend + frontend separately).
2. Open the UI with the same query string on both machines, e.g.  
   [http://localhost:5173/?room=interview-1](http://localhost:5173/?room=interview-1)  
   (If the second machine is not `localhost`, use your LAN IP for the UI and set **`VITE_COLLAB_WS_URL`** to `http://<server-ip>:3000` in `frontend/.env`.)
3. When the bundler is **running**, edits are broadcast (debounced). New tabs get a **snapshot** of the room after join + announce.

**Presence:** the server assigns a random Russian **«прилагательное + животное»** name per `clientId` (stored in `sessionStorage` so one browser keeps the same id/name until storage is cleared). The UI shows **how many users** are in the room, each person’s **open file** and **line:column**, and **colored carets** (with labels) for others when you are viewing the **same** file.

**Limits:** this is **whole-file** sync (not Yjs/CRDT). If two people type in the **same** file at the **same** time, the last broadcast can win and one side may see a jump. For heavy pair programming, consider **Yjs** + a binding later.

## Typical interview follow-ups

Use these when practicing or when the interviewer says “extend it”:

- **Filter / search** tasks by substring (client-only or query param on `GET`).
- **Pagination** or **lazy load** for `GET /api/tasks`.
- **PATCH** `/api/tasks/:id` to edit title or toggle `done` (add field + validation).
- **Persistence**: SQLite/Postgres/Prisma or TypeORM instead of the in-memory array.
- **Auth**: JWT or session; scope tasks per user.
- **Errors & UX**: toast on failure, optimistic updates, loading skeletons.
- **Tests**: unit tests for service; e2e for one happy path through the API.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | API + UI together |
| `npm run dev:backend` / `npm run dev:frontend` | One side only |
| `npm run build` | Production build both packages |
| `npm test --prefix backend` | Backend unit tests |
| `npm run test:e2e --prefix backend` | Backend e2e (sample health check) |

## Stack notes

- Dev CORS allows `http://localhost:5173`.
- The Vite dev server **proxies** `/api` to `http://localhost:3000`, so the browser calls same-origin `/api/...`.
- For a **production** or **preview** frontend without the proxy, configure a real API base URL (e.g. env + `fetch`) or serve the SPA behind a reverse proxy to the API.
