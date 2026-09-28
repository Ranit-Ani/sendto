# SendTo

Share files and text with a 6-digit code. No account needed.

Send something, get a code like `482731`, hand the code to whoever needs it. They
type it in and get exactly what you sent. Optional password, expiry and view limit.

---

## Requirements

- **Node 20 or newer** (`node -v`). Install the current LTS from https://nodejs.org if needed.
- **A MongoDB Atlas cluster** (the free M0 tier is enough). Stores share codes, file metadata, limits and counters.
- **A Google account with Drive** and a Google Cloud OAuth client. Stores the uploaded files.

There is no local database and no local file storage: the server keeps nothing on disk.

## One-time setup

### 1. MongoDB Atlas

1. Create a free cluster, then a database user (Database Access).
2. Network Access: allow your server's IP. On Render, where the IP changes, use `0.0.0.0/0` and rely on the strong database password.
3. Connect > Drivers > copy the connection string and put the database name in it:
   `mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/sendto?retryWrites=true&w=majority`

### 2. Google Drive (OAuth)

1. In https://console.cloud.google.com create a project and **enable the Google Drive API**.
2. **OAuth consent screen**: choose External, fill in the app name and your email, and add your own Google account as a test user.
3. **Credentials > Create credentials > OAuth client ID**, application type **Desktop app**. Copy the client ID and secret into `.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
4. Run `npm run google:auth`, open the printed link, and approve. The script prints `GOOGLE_REFRESH_TOKEN` and `GOOGLE_DRIVE_FOLDER_ID`; add both to `.env`.
5. **Publish the app** (OAuth consent screen > *Publish app*, status "In production"). While it is in "Testing", Google expires refresh tokens after 7 days and uploads will start failing. The `drive.file` scope needs no Google verification review; you will just see an "unverified app" warning once while signing in.

Access is limited to the `drive.file` scope: SendTo can only see files and the folder it created itself, never the rest of your Drive. The folder and files are **never shared or made public**; every download goes through the server after the receiver unlocks the code. To use a folder you already created by hand, run `npm run google:auth -- --full-drive` instead (a wider scope) and set `GOOGLE_DRIVE_FOLDER_ID` to that folder's id.

## Run it

```bash
npm install
npm run build             # compiles client/ into public/ — see note below
cp .env.example .env      # then fill in the values (see One-time setup above)
npm start
```

On Windows PowerShell, `cp` works, but if it complains use
`Copy-Item .env.example .env`.

Open http://localhost:3000

`npm run dev` restarts the server when you edit a **backend** file (anything
under `src/`). It does not rebuild the frontend — see below.

> **`npm start` never builds the frontend.** It only runs `server.js`, which
> serves whatever static files already exist in `public/`. If you edit anything
> in `client/` and just re-run `npm install && npm start`, you will keep seeing
> the old UI forever, because nothing regenerated `public/`. Always run
> `npm run build` after changing the frontend, *before* starting the server.

### Frontend (React)

The UI lives in `client/` — a Vite + React app. `npm run build` (from the
project root) installs the client's own dependencies and compiles it straight
into `public/`, which the Express server serves as-is.

```bash
npm run build          # builds the React app into public/
```

**How to confirm the build actually picked up your changes:** open
`public/index.html` and look at the `<script src="/assets/index-XXXXXXXX.js">`
line. That hash changes on every successful build. If you edit a component,
rebuild, and the hash in that filename is identical to before, the build did
not run — check the terminal output for errors instead of re-running `npm start`.

While actively working on the UI, run the API and the Vite dev server side by
side instead of rebuilding by hand every time — the Vite dev server hot-reloads
on save:

```bash
npm start               # terminal 1 — API on :3000
npm run client:dev      # terminal 2 — Vite dev server, proxies /api to :3000
```

### Settings

Everything lives in `.env` (see `.env.example`) and is read once in `src/config.js`.

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | `3000` | Port the server listens on |
| `SESSION_SECRET` | random | Signs download tokens. **Set this.** If it is left random, every restart invalidates links receivers already opened. |
| `MONGODB_URI` | *required* | MongoDB Atlas connection string |
| `MONGODB_DB_NAME` | from URI | Optional database name override |
| `GOOGLE_CLIENT_ID` | *required* | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | *required* | Google OAuth client secret |
| `GOOGLE_REFRESH_TOKEN` | *required* | From `npm run google:auth` |
| `GOOGLE_DRIVE_FOLDER_ID` | auto | Private Drive folder for uploads. If empty, a folder named `GOOGLE_DRIVE_FOLDER_NAME` is found or created on first upload. |
| `GOOGLE_DRIVE_FOLDER_NAME` | `SendTo Uploads` | Name used for the auto-created folder |
| `MAX_FILE_SIZE` | `104857600` (100 MB) | Per-file upload limit |
| `MAX_FILES` | `10` | Files per share |
| `MAX_TEXT_LENGTH` | `500000` | Characters per text share |
| `DEFAULT_EXPIRY_MINUTES` | `1440` (24 h) | Used when the sender leaves expiry blank |
| `MAX_EXPIRY_MINUTES` | `43200` (30 d) | Longest expiry a sender can pick |

The server refuses to start, with a message naming the missing variable, if `MONGODB_URI` or any `GOOGLE_*` credential is unset.

If you raise `MAX_FILE_SIZE` or `MAX_FILES`, change the two matching constants at
the top of `client/src/pages/SendFiles.jsx` (`MAX_SIZE`, `MAX_FILES`) so the
browser rejects oversized files before uploading them, then `npm run build`.

---

## How it fits together

```
Browser (React SPA, built with Vite, compiled into public/)
   |  fetch / XMLHttpRequest
   v
Express  ->  routes/shares.js       request handling, tokens, downloads
             services/shareService  create, unlock, view counting, cleanup
             services/driveService  Google Drive: upload, stream, delete
             services/exportService text -> txt/md/html/csv/json/pdf/docx
             middleware/upload.js   streams each upload straight into Drive
             db.js + models/Share   MongoDB Atlas via Mongoose
```

MongoDB holds one `shares` collection. Each document has the 6-digit `code`
(unique index), `type`, the text content or a `files` array, the password hash,
`maxViews`, `expiresAt`, and the counters `views` and `downloads` (the download
counter is also kept per file). Each entry in `files` stores the original name,
MIME type, size and the **Google Drive file ID**. The Drive ID never leaves the
server, and the file bytes never touch the server's disk: uploads are streamed
into Drive while they arrive and downloads are streamed back out of it.

### The sharing flow

1. The sender posts text or files. The server picks an unused 6-digit code,
   hashes the password if there is one, and returns the code plus a share link.
2. The receiver enters the code. `GET /api/shares/:code` says what kind of share
   it is and whether a password is needed — without counting a view.
3. `POST /api/shares/:code/open` checks the password, counts one view, and returns
   the content along with a signed token valid for 20 minutes.
4. Downloads and exports require that token, so a view is counted once per
   unlock rather than once per download.

Expired and used-up shares are deleted from Google Drive and MongoDB on boot and
every five minutes after that. Used-up shares get a one-hour grace period so a
download that is already running can finish. A share's database record is only
removed once its Drive files are gone, so a temporary Drive outage never leaves
orphaned files: the next cleanup run retries.

### Security notes

- Passwords are hashed with bcrypt and never returned to the browser.
- Uploads are stored in Drive under random names and the folder is never shared,
  so nothing is publicly reachable; the only way to read a file is through this
  server with a valid code (and password, if set).
- Download tokens are HMAC-signed and expire.
- Code lookups are rate limited to 40 attempts per minute per IP, which makes
  guessing your way through a million codes impractical. If you run more than one
  server process, move that limiter (`src/middleware/rateLimit.js`) to Redis.
- Files are served as attachments, never rendered inline, so an uploaded HTML
  file cannot run scripts on your domain.

---

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/shares/text` | Share text. JSON: `text`, optional `password`, `maxViews`, `expiryHours`, `expiryMinutes` |
| `POST` | `/api/shares/files` | Share files. Multipart: `files` plus the same options |
| `GET` | `/api/shares/:code` | Type and whether a password is needed. Does not count a view |
| `POST` | `/api/shares/:code/open` | Unlock. JSON: `password`, `type`. Counts one view, returns a token |
| `GET` | `/api/shares/:code/files/:fileId?token=` | Download one file |
| `GET` | `/api/shares/:code/export?format=&token=` | Download the text as `txt`, `md`, `html`, `csv`, `json`, `pdf` or `docx` |
| `GET` | `/api/formats` | Formats the receiver can pick from |
| `GET` | `/api/health` | Health check |

Errors come back as `{ "error": { "code": "WRONG_PASSWORD", "message": "..." } }`.
The browser branches on `code`; the `message` is written to be shown as-is.

---

## Text conversion

`.txt` and `.md` keep the text byte for byte. `.html` wraps it in a readable page
with the markup escaped. `.json` gives you the text plus a line array. `.csv`
splits on tabs into real columns when the text has tabs, otherwise writes one
quoted row per line.

`.pdf` uses the bundled DejaVu Sans Mono in `assets/fonts`, which covers Latin,
Cyrillic, Greek and common symbols. It has no CJK glyphs, so Japanese, Chinese
and Korean come out blank **in PDF only** — they are fine in every other format.
To fix that, drop a CJK font into `assets/fonts` and point `PDF_FONT` in
`src/services/exportService.js` at it.

---

## Changing the look

Every colour, radius and shadow is a CSS variable at the top of
`client/public/assets/css/styles.css`. Edit the `:root` block to re-skin the
whole app (it holds the dark-theme values, which is the default); the
`[data-theme="light"]` block below it overrides what the light theme changes.
This file is a static asset, not processed by Vite — `npm run build` just
copies it into `public/assets/css/styles.css`, so always edit the copy under
`client/public/`, never the one under the top-level `public/` directly, since
the next build overwrites it.

The header nav is in `client/src/components/Header.jsx` (`NAV_LINKS` array)
and the mobile bottom bar is in `client/src/components/BottomNav.jsx`
(`NAV_ITEMS` array) — add a link by editing both.

---

## Deploying to Render

`render.yaml` in the project root is a ready-made blueprint. Push the project to
GitHub, then in Render choose **New > Blueprint** and pick the repository. It
reads the file, generates `SESSION_SECRET`, and asks you for the secrets marked
`sync: false`: `MONGODB_URI`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`GOOGLE_REFRESH_TOKEN` and `GOOGLE_DRIVE_FOLDER_ID`.

SendTo is stateless now, so **no persistent disk is required**. The blueprint
still says `plan: starter`; the free plan works too, but it sleeps when idle, so
the five-minute cleanup only runs while the service is awake (expired shares are
refused immediately either way and are removed on the next wake-up).

### Setting it up by hand instead

1. **New > Web Service**, connect the repo, runtime **Node**.
2. Build command `npm ci`, start command `npm start`.
3. Add the environment variables from the table above (`SESSION_SECRET`,
   `MONGODB_URI`, the four `GOOGLE_*` values, `NODE_VERSION=24.11.0`).

Do not set `PORT` — Render provides it and the server reads it automatically.

### Uploads and the proxy

Uploads pass through the server on their way to Google Drive, so upload speed is
limited by both your connection and the server's. Render allows large request
bodies by default, so the 100 MB limit works as-is. Free and starter instances
do have a request timeout, so very large uploads over a slow connection can be
cut off; lower `MAX_FILE_SIZE` if your users hit that.

## Deploying anywhere else

Any host that can run Node and reach Atlas and Google works — a VPS, Railway,
Fly.io, or serverless-with-long-requests:

```bash
NODE_ENV=production SESSION_SECRET=<long random string> MONGODB_URI=... npm start
```

Behind nginx, raise the body limit to match `MAX_FILE_SIZE`
(`client_max_body_size 100M;`). Back up nothing locally: your data is in Atlas
and Drive.

## Troubleshooting

**`Startup failed: Missing required environment variable(s)…`**
Fill in `.env` (see *One-time setup*). On Render, set the variables in the
dashboard.

**`MongooseServerSelectionError` on startup.**
Atlas is rejecting the connection. Check the username and password in
`MONGODB_URI` (URL-encode special characters) and that your IP is allowed under
Atlas > Network Access.

**Uploads fail with "Could not reach file storage" or `invalid_grant` in the log.**
The refresh token is invalid or expired. If your Google consent screen is still
in *Testing*, tokens die after 7 days: publish the app and run
`npm run google:auth` again. Also check that the Drive API is enabled.

**`Google did not return a refresh token`.**
Remove SendTo at https://myaccount.google.com/permissions and run
`npm run google:auth` again.

**`EADDRINUSE`.** Port 3000 is taken. Set a different one in `.env`.

**I edited a component / the CSS but the browser still shows the old UI.**
You forgot to build the frontend, which is the single most common issue.
`npm start` does not compile `client/` — it only serves whatever is already in
`public/`. Run `npm run build` from the project root after every frontend
change, then restart `npm start`, then hard-refresh the browser (or open a
private/incognito tab) in case it cached the old JS bundle. To confirm the
build actually ran, check that the hash in `public/index.html`'s
`<script src="/assets/index-XXXXXXXX.js">` changed from before.

## Layout

```
server.js               Express setup, static hosting, cleanup timer
render.yaml             Render blueprint: env vars, health check
.node-version           Node version pin for Render and nvm
scripts/google-auth.js  one-time Google sign-in: prints refresh token + folder id
src/config.js           every tunable, read from the environment
src/db.js               MongoDB (Mongoose) connection
src/models/Share.js     the shares collection schema
src/utils/              code generation, access tokens, error type
src/middleware/         Drive-streaming uploads, rate limiting, error responses
src/services/           share logic, Google Drive access, text conversion
src/routes/shares.js    the API
client/                 React + Vite frontend — source of truth for the UI
  src/pages/            one file per route: SendFiles, ReceiveFiles, SendText, ReceiveText, Home
  src/components/       Header, BottomNav, OptionsFields, ResultCard, etc.
  src/context/          Theme (light/dark) and Toast providers
  public/assets/css/    styles.css — edit this copy, not the one below
public/                 BUILD OUTPUT ONLY — regenerated by `npm run build`;
                         do not hand-edit, it gets overwritten
assets/fonts/           font used for PDF export
```