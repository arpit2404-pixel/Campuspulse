# CampusPulse

**Your campus. Your voice.** A campus issue-reporting platform that groups duplicate complaints into one ticket, so the problems affecting the most students rise to the top. Reports are stored in a real PostgreSQL database and shared by every visitor.

Started as a first-year IEEE hackathon project (judged by senior students), then extended with a real backend.

**Stack:** React 18 · TypeScript · Vite · Tailwind CSS · Node.js · Express · PostgreSQL (Neon)

**Live demo:** https://campuspulse-vjz5.onrender.com/ (the free server sleeps when idle, so the first load can take about a minute)

**Screenshot** ![alt text](image-1.png)
![alt text](image-2.png)
![alt text](image-3.png)
![alt text](image-4.png)
![alt text](image-5.png)
![alt text](image-6.png)
## The problem

On a campus, one broken fan gets reported ten different ways to ten different people, or not at all. Maintenance staff see noise instead of a clear list of what matters most. CampusPulse collects reports in one place and groups duplicates, so the most widespread problems are obvious.

## What it does

- **Report in seconds, no sign-up.** No name, email or phone number is collected. You get a reference code like `CP-2026-XXXX`.
- **Smart duplicate grouping (server-side).** A new report is compared with open issues (same category and building, room number, keyword overlap with synonyms, Jaccard similarity, 55% threshold). A match joins the existing ticket; otherwise a new ticket is created.
- **Dashboard from real data.** Totals, unresolved/resolved, recent reports, common categories and Top 5 recurring problems are computed from database rows. A new database starts empty and shows zeros.
- **Status timeline.** `Pending → In Progress → Resolved`, with public notes.
- **Admin console.** Log in, change status, merge duplicates, split wrongly grouped reports.
- **Categories:** Infrastructure, Electricity, Water, Cleanliness, Internet, Classroom Equipment, Other.

## Architecture

```
Browser (React)  --/api-->  Express server  --pg-->  Neon PostgreSQL
 src/                        server/
```

- `src/services/api.ts` talks to the API (`VITE_API_URL`, or same origin / Vite proxy).
- `src/services/db.ts` keeps a cache of `GET /api/state`, refreshed on load, after writes, every 30 s and when the tab regains focus.
- `server/src/` has config, validation, similarity engine, security helpers, services and routes. `server/db/schema.sql` is the database schema.
- The database URL lives **only on the server** (`DATABASE_URL`). It is never sent to the browser.

## Run locally (Windows, VS Code)

Needs Node.js 20.12 or newer.

1. **Create a free Neon database** at https://neon.tech (no card needed). Create a project, then copy the connection string from **Connect** (it ends in `?sslmode=require`).
2. In the project folder, copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL` = your Neon connection string
   - `SERVER_SECRET` = a long random string. Generate one: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
3. In a terminal:
   ```powershell
   npm install          # use install, not "npm ci"
   npm run db:setup     # creates the tables (safe to re-run)
   npm run create-admin # asks for an email and password; stores only a salted hash
   ```
4. Open **two** terminals:
   ```powershell
   npm run server       # API on http://localhost:3001
   npm run dev          # website on http://localhost:3000
   ```
5. Open http://localhost:3000, submit a report, and use **Admin** in the navbar to sign in with the account you created.

Never commit `.env`; it is git-ignored. Never put secrets in `VITE_` variables, because those are public.

## API

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/api/health` | anyone | server + database check |
| GET | `/api/state` | anyone | issues, reports, stats |
| POST | `/api/reports` | anyone | submit a report |
| POST | `/api/issues/:id/support` | anyone | "I have this too" |
| POST | `/api/admin/login`, `/logout` | admin | session |
| GET | `/api/admin/me` | admin | current admin |
| PATCH | `/api/issues/:id/status` | admin | change status + note |
| POST | `/api/issues/:id/merge` | admin | merge duplicate tickets |
| POST | `/api/reports/:id/separate` | admin | split a report out |

Errors look like `{"error":{"code","message","fields?","retryAfterSeconds?"}}`.

## Security and spam controls

- Parameterised SQL only; server-side validation, length limits, HTML stripping, rejection of links and repeated-character spam; 20 kB body limit.
- Per-browser limit (3 reports / 3 min) and per-network limit (30 / 10 min), plus an in-memory per-IP rate limiter. One report or support per browser per issue (database-enforced). Duplicate submissions get a clear 409 message.
- The server stores only HMAC hashes of a random browser id and the IP address (keyed with `SERVER_SECRET`); the hashes are never returned by the API.
- Admin passwords are scrypt-hashed; sessions are random tokens stored hashed, expire after 8 hours; login is limited to 5 attempts / 15 min. No admin passwords exist in the code or repository.
- **Honest limits:** this is *not* fully anonymous and *not* spam-proof. The server can link hashes to a browser/network, and someone with many devices or networks can still submit repeatedly. Treat it as a portfolio project, not a hardened production system.

## Tests

```powershell
$env:TEST_DATABASE_URL="postgresql://user:pass@localhost:5432/campuspulse_test"
npm test
```

66 tests (validation, similarity, security helpers, complaint flow, admin/session, route handlers). They need a **separate, disposable** PostgreSQL database because they wipe its tables. Never point them at your real Neon database.

## Free deployment

Recommended: one **Render free Web Service** (serves API + built website) + **Neon free** database.

1. Push the project to GitHub (check `.env` is not included).
2. Render → New Web Service → your repo. Build command: `npm install && npm run build`. Start command: `npm start`.
3. Environment variables on Render: `DATABASE_URL`, `SERVER_SECRET`, `NODE_ENV=production`. Run `npm run db:setup` and `npm run create-admin` once on your own computer against the same Neon database.
4. Open the Render URL; `/api/health` should say the database is connected.

Free-tier limits (as of October 2026; check the providers, they change):
- **Render free web service** sleeps after ~15 min idle, so the first visit after a pause can take about a minute. The site shows a waiting message while it wakes. Don't use Render's free Postgres, which expires after 30 days.
- **Neon free** is permanent, no card, about 1 GB per project; the database suspends when idle and wakes in a moment.

Splitting the site (Netlify/Vercel) from the API (Render) also works: set `VITE_API_URL` at build time and `CORS_ORIGIN` on the server.

## Known limitations

- Tested locally against Neon by the author; the backend test suite runs against a local PostgreSQL. Check `/api/health` after any new deployment.
- Grouping is a rule-based heuristic with a hand-written synonym list.
- Photo upload, anonymous-contact options and the "Under Review" status were removed in the backend version (no file storage; no contact details collected).
- Footer contact details are placeholders; replace them with real ones.

## What I learned

Designing a transparent scoring rule, moving trust from the browser to the server, and being honest about what anonymity and spam protection can and cannot guarantee.
