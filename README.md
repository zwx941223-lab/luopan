# DY Monitor Suite

DY Monitor Suite is the first-version internal system for collecting Douyin Compass short-video ranking data, syncing it to a backend, and presenting it in a team-friendly dashboard for operators working on different categories.

## What is included

- `dy-monitor-extension`
  Browser extension for silent category capture. It listens for ranking API requests on Compass pages and requests the next 10 pages silently when triggered.

- `apps/server`
  Express backend with:
  - login and JWT auth
  - category ownership
  - capture upload endpoint for the extension
  - ranking records, hourly diffs, and capture history
  - Excel export

- `apps/web`
  React dashboard with:
  - login
  - overview
  - ranking detail table
  - newcomers view
  - range-shift view
  - capture history
  - basic settings panel

## Local development

### 1. Install dependencies

```bash
cmd /c npm.cmd install
```

### 2. Configure env files

Copy these files before local startup:

- `apps/server/.env.example` -> `apps/server/.env`
- `apps/web/.env.example` -> `apps/web/.env`

### 3. Start backend

```bash
cmd /c npm.cmd run dev:server
```

Backend default URL:

```text
http://localhost:4318
```

### 4. Start frontend

```bash
cmd /c npm.cmd run dev:web
```

Frontend default URL:

```text
http://localhost:5173
```

### 5. Load the extension in Edge

1. Open `edge://extensions`
2. Enable developer mode
3. Click `Load unpacked`
4. Select:

```text
C:\Users\Administrator\OneDrive\文档\lp\dy-monitor-extension
```

### 6. Test account

- `admin / Admin123456`
- `operator-a / Operator123`

## Extension workflow

1. Open the Douyin Compass short-video ranking page.
2. Wait until the page loads at least one ranking response.
3. Click the floating `DY Monitor` button.
4. Fill in:
   - category name
   - category id
   - page limit
5. Start silent capture.
6. The extension will:
   - reuse the captured ranking API request
   - request the next pages silently
   - map the records
   - upload them to the backend

## Current first-version boundaries

Implemented:

- silent capture UI
- API-first paged capture
- category-based upload
- login and role split
- category-scoped dashboard
- hourly newcomer and range-shift analysis
- product jump links
- video modal playback when playable URLs exist
- Excel export

Deferred for later phases:

- production database migration
- full admin CRUD for users/categories
- scheduled unattended capture
- reliable video download button
- stronger API schema adaptation for every Compass response shape
- cloud deployment scripts

## Suggested next deployment phase

For Alibaba Cloud deployment later, the recommended stack is:

- ECS server
- Node.js runtime for backend
- Nginx reverse proxy
- PM2 process management
- MySQL or PostgreSQL if you want to replace the current JSON store

## Notes

- The current backend store is JSON-based for fast first-version delivery.
- The extension is API-first and avoids visible page-by-page pagination whenever the ranking API can be reused.
- If Compass changes its response schema, we may need to expand the mapping logic in `dy-monitor-extension/content/silent-capture.js`.
