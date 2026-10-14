# CampusPulse

**Your campus. Your voice.** An anonymous campus issue reporting platform that groups duplicate complaints into one prioritised ticket, so the problems that affect the most students rise to the top.

Built by a two-person first-year team for the first-year IEEE hackathon, where it was judged by senior students. Stack: React 18, TypeScript, Vite, Tailwind CSS.

<!-- Add 3-4 screenshots in docs/screenshots/ and embed them here, e.g.
![Dashboard](docs/screenshots/dashboard.png) -->

## The problem

On a campus, a broken fan or a leaking ceiling gets reported ten different ways to ten different people, or not at all, because students fear being identified or don't know who to tell. Maintenance staff then see noise instead of a clear list of what matters most.

## What it does

- **Anonymous reporting.** No account is needed. A student submits a report in seconds and gets a reference code (`CP-2026-XXXX`).
- **Smart duplicate grouping.** Each new report is compared with active issues. If it matches an existing one, it is merged into that ticket and the report count goes up. Otherwise a new ticket is created.
- **Top 5 recurring issues.** A live ranking with relative urgency bars.
- **Transparent status timeline.** `Pending → Under Review → In Progress → Resolved`, with public notes from maintenance staff.
- **Admin console.** Update statuses, add notes, merge duplicate tickets, and split reports that were grouped wrongly.
- **Fair ranking.** One report or upvote per device per issue, so rankings can't be inflated by spamming.

## How the grouping engine works

The engine lives in [`src/services/groupingEngine.ts`](src/services/groupingEngine.ts) and uses no external APIs. For a new report, it scores every unresolved issue in this order:

1. **Category** must match exactly (Electrical, Plumbing, and so on), otherwise the issue is skipped.
2. **Building** must match after normalisation.
3. **Room** numbers are extracted (`Room 204`, `LH-204` and `204` all become `204`). Two different room numbers rule out a match.
4. **Text similarity.** Titles and descriptions are tokenised, stop words are removed, and synonyms are collapsed (`dripping` → `leak`, `rattling` → `broken`, `toilet` → `washroom`). The overlap is measured with the Jaccard index.
5. **Score** = keyword overlap + weighted Jaccard + building bonus + room bonus. At 55% confidence or higher, the report joins the existing issue.

Admins can always correct the result by splitting or merging tickets, so a wrong guess costs one click.

## Run it locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # type-check and production build
npm test         # end-to-end workflow tests (no browser needed)
```

### Demo admin login

Click **Admin** in the navbar and sign in with:

| Account | Email | Password |
|---|---|---|
| Chief Facilities Administrator | `admin@campuspulse.edu` | `CampusPulse@Demo2026` |
| Estate Maintenance Desk | `estate@campuspulse.edu` | `CampusPulse@Demo2026` |

These are demo credentials for this public repository, not real accounts. To use your own password, copy `.env.example` to `.env` and set `VITE_ADMIN_PASSWORD_SHA256` to the SHA-256 hash of your password.

The app starts empty. Use **Load Sample Demo Data** in the banner to fill it with 18 realistic reports across 7 campus buildings.

## Tests

`test_workflows.ts` runs the data layer and auth service in Node and checks:

- the app starts with zero issues and no leftover demo data
- a first report creates an issue
- the same student can't spam the same issue or upvote it twice
- different students reporting the same problem are grouped (81% confidence in the test case)
- Top 5 ranking is correct
- the old plaintext `admin` password is rejected, and a valid admin can resolve an issue
- data survives a reload (localStorage persistence)

## Project structure

```
src/
├── components/     UI: dashboard cards, report form, explorer, admin panel
├── services/
│   ├── db.ts              localStorage-backed store with reactive updates
│   ├── auth.ts            demo admin authentication (hashed, see limitations)
│   └── groupingEngine.ts  duplicate detection and scoring
├── data/demoData.ts       optional sample dataset
└── types/                 Issue, Report, StatusHistory, AdminUser
test_workflows.ts          end-to-end tests for the data layer
```

## Known limitations

This was built for a hackathon, so it is a front-end prototype rather than a production system.

- **No backend.** Data is stored in the browser's localStorage, so each browser sees its own data.
- **Admin login is client-side.** It is hashed rather than stored in plaintext, but anyone with dev tools can bypass it. A real deployment needs server-side authentication with salted password hashes, rate limiting, and signed sessions.
- **Anti-spam is per device.** It relies on a device identifier kept in the browser, which a determined user can clear.
- **Grouping is rule-based.** It is a transparent heuristic with a hand-written synonym list, not a trained model.

## What I'd build next

- A real backend (Node + Postgres) with server-side auth and image storage
- Embedding-based similarity to replace the synonym list
- Email or SMS updates to reporters through anonymous tracking codes
- An analytics view for recurring problem locations and average time to resolve

## What I learned

- Designing a scoring rule that people can understand and correct, rather than a black box
- Modelling state so that merges and splits stay consistent (issues, reports, timeline history)
- Treating security honestly, including where a prototype's guarantees end
