# Local MongoDB, Authentication, and Decks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace browser-only deck persistence with a local MongoDB-backed account system where each signed-in user can manage only their own decks.

**Architecture:** Keep the React/Vite client, add an Express API in the same TypeScript project, and run MongoDB in a separate Docker container named `riftbound`. Better Auth owns credential/session storage in MongoDB; deck routes resolve ownership from the server-side session. No browser data migration or card-catalog ingestion is part of this change. Do not create or populate a `cards` collection until its source and schema are chosen.

**Tech Stack:** React, TypeScript, Vite, Express, Better Auth, MongoDB Node driver, Docker Compose, Vitest, Testing Library, Supertest, MongoDB Memory Server.

---

## File Map

- Create `docker-compose.yml` for the MongoDB service, localhost-only port binding, health check, credentials, and persistent named volume.
- Create `.env.example`; modify `.gitignore` to keep real env files out of Git.
- Create `server/config.ts` and `server/config.test.ts` for validated server-only environment configuration.
- Create `server/database/mongo.ts` for one shared `MongoClient` connection and shutdown; create `server/test/mongo-test-db.ts` for isolated test database lifecycle.
- Create `server/auth.ts` for Better Auth with its MongoDB adapter; create `server/auth.test.ts` for real auth endpoint integration tests.
- Create `server/app.ts` for auth endpoints, health check, and deck routes; add `server/app.test.ts` for Mongo health failure; create `server/index.ts` for config, database lifecycle, and listening.
- Create `server/decks/deck-repository.ts`, `server/decks/deck-routes.ts`, and `server/decks/deck-api.test.ts` for user-scoped deck persistence and API integration tests.
- Create `src/auth/auth-client.ts` and `src/auth/AuthPanel.tsx`; add `src/auth/AuthPanel.test.tsx`; modify `src/styles.css` for the auth form.
- Create `src/decks/deck-api.ts` and `src/decks/deck-api.test.ts` for browser API calls.
- Modify `src/App.tsx`, `src/App.test.tsx`, and `src/decks/DeckLibrary.tsx` to use the authenticated API and server-backed deck IDs.
- Delete `src/decks/deck-storage.ts` and `src/decks/deck-storage.test.ts`; no runtime code should continue using the legacy deck-storage key.
- Modify `package.json`, `pnpm-lock.yaml`, `vite.config.ts`, and `README.md` for scripts, dependencies, local proxy, and setup instructions.

## Task 1: Environment Validation and Mongo Container

**Files:** Create `server/config.ts`, `server/config.test.ts`, `docker-compose.yml`, `.env.example`; modify `.gitignore`, `package.json`.

- [x] **Step 1: Write failing config tests**

Create `server/config.test.ts` with these cases:

```ts
import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const validEnvironment = {
  MONGO_URI: 'mongodb://riftbound:local-only@127.0.0.1:27017/riftbound?authSource=admin',
  BETTER_AUTH_SECRET: 'local-test-secret-at-least-32-characters-long',
  APP_ORIGIN: 'http://localhost:5173',
  API_PORT: '3001'
};

describe('loadConfig', () => {
  it('parses a valid local environment', () => {
    expect(loadConfig(validEnvironment)).toEqual({
      mongoUri: validEnvironment.MONGO_URI,
      betterAuthSecret: validEnvironment.BETTER_AUTH_SECRET,
      appOrigin: validEnvironment.APP_ORIGIN,
      apiPort: 3001
    });
  });

  it('rejects a missing Mongo URI', () => {
    expect(() => loadConfig({ ...validEnvironment, MONGO_URI: '' })).toThrow(/MONGO_URI/);
  });

  it('rejects a short Better Auth secret', () => {
    expect(() => loadConfig({ ...validEnvironment, BETTER_AUTH_SECRET: 'short' })).toThrow(/BETTER_AUTH_SECRET/);
  });

  it('rejects a non-local app origin and an invalid API port', () => {
    expect(() => loadConfig({ ...validEnvironment, APP_ORIGIN: 'https://example.com' })).toThrow(/APP_ORIGIN/);
    expect(() => loadConfig({ ...validEnvironment, API_PORT: '0' })).toThrow(/API_PORT/);
  });
});
```

- [x] **Step 2: Run the config test and confirm RED**

Run: `pnpm exec vitest run server/config.test.ts`
Expected: FAIL because `server/config.js` does not exist.

- [x] **Step 3: Implement validated config and env loading**

Add `zod` and `dotenv`. `loadConfig(environment)` validates a Mongo URI, a secret with at least 32 characters, a localhost HTTP origin, and an integer API port from 1 through 65535. Export a `ServerConfig` type inferred from the schema. Do not read `import.meta.env` or any `VITE_*` secret on the server.

- [x] **Step 4: Run config tests and confirm GREEN**

Run: `pnpm exec vitest run server/config.test.ts`
Expected: 4 tests pass.

- [x] **Step 5: Add the Docker Compose service and env template**

Use the official Mongo `8.0` image with `container_name: riftbound`, `MONGO_INITDB_ROOT_USERNAME` and `MONGO_INITDB_ROOT_PASSWORD` sourced from `.env`, `127.0.0.1:${MONGO_PORT:-27018}:27017`, a named `riftbound_mongo_data:/data/db` volume, and a `mongosh` ping health check authenticated against `admin`. Do not add `down -v` to any package script.

`.env.example` defines `MONGO_ROOT_USERNAME`, `MONGO_ROOT_PASSWORD`, `MONGO_PORT`, `MONGO_URI`, `BETTER_AUTH_SECRET`, `APP_ORIGIN`, and `API_PORT`, with local-only example values and a clear instruction to replace the sample secret/password before sharing the machine. `.gitignore` ignores `.env` and `.env.*` while allowing `.env.example`.

- [x] **Step 6: Validate Compose without starting or deleting containers**

Run: `Copy-Item .env.example .env` only when `.env` does not exist, then `docker compose config --quiet`.
Expected: exit code 0 and no Compose validation errors. Never overwrite an existing `.env`.

## Task 2: Mongo Connection and Better Auth API

**Files:** Create `server/database/mongo.ts`, `server/auth.ts`, `server/app.ts`, `server/index.ts`, `server/auth.test.ts`; modify `package.json`, `tsconfig.json`, `vitest.config.ts`.

- [x] **Step 1: Add failing authentication integration tests**

Use `mongodb-memory-server` to create an isolated MongoDB for the test file, connect through the same `MongoClient` factory as the app, and use Supertest against the Express app. Add these tests with these assertions:

- `registers an account and returns an authenticated session cookie`: POST `/api/auth/sign-up/email`; expect success and a `set-cookie` header; GET `/api/auth/get-session` with that cookie; expect the created email and id.
- `rejects a duplicate email without creating a second account`: submit the same normalized email twice; expect the second response to be non-2xx and the Mongo `user` collection to contain one matching email.
- `rejects unknown-email and wrong-password login without revealing which check failed`: make both sign-in requests; expect the same status and public error message.
- `logs in and clears the session on logout`: sign up; sign in; verify the cookie returns a session; POST `/api/auth/sign-out`; verify a subsequent session request with the old cookie is unauthenticated.

Set `Origin` to `http://localhost:5173` on requests. Use unique test addresses under `@example.test`; never use a personal address or the persistent local database in this suite. Put `// @vitest-environment node` at the top of each `server/**/*.test.ts` file.

- [x] **Step 2: Run auth tests and confirm RED**

Run: `pnpm exec vitest run server/auth.test.ts`
Expected: FAIL because the Mongo connection, auth instance, and Express app are not implemented.

- [x] **Step 3: Add server dependencies and test runtime**

Add runtime dependencies `express`, `mongodb`, `better-auth`, `@better-auth/mongo-adapter`, `dotenv`, and `zod`. Add development dependencies `tsx`, `concurrently`, `supertest`, `@types/express`, `@types/supertest`, and `mongodb-memory-server`. Preserve the existing pnpm lockfile and ESM module type. Extend the Vitest include globs to `src/**/*.test.{ts,tsx}` and `server/**/*.test.ts`, and include `server/**/*.ts` in TypeScript typechecking.

- [x] **Step 4: Implement shared Mongo lifecycle**

`connectMongo(uri)` creates one `MongoClient`, awaits `connect()`, and returns `{ client, db, close }`. The auth adapter and deck repository receive that same `Db`; tests pass an isolated database name. Startup must not listen before the connection succeeds. The test helper creates `MongoMemoryServer`, connects `MongoClient`, exposes a unique `Db`, and closes both resources in `afterAll`.

- [x] **Step 5: Implement Better Auth and Express routes**

Configure Better Auth with `mongodbAdapter(db)` (omit the optional client so the local standalone Mongo container does not require replica-set transactions), email/password enabled, the documented default minimum password length of 8, `baseURL: appOrigin`, and `trustedOrigins: [appOrigin]`. The auth factory takes the DB and validated config so integration tests can use MongoMemoryServer. Mount `toNodeHandler(auth)` at `/api/auth/*splat` before JSON body middleware. Add `GET /api/health` returning `{ status: 'ok' }` only after Mongo is ready. Export `createApp({ auth, db })` so tests do not bind a fixed port.

The Better Auth configuration must have this shape:

```ts
betterAuth({
  database: mongodbAdapter(db),
  baseURL: config.appOrigin,
  secret: config.betterAuthSecret,
  trustedOrigins: [config.appOrigin],
  emailAndPassword: { enabled: true, minPasswordLength: 8 }
});
```

- [x] **Step 6: Run auth integration tests and confirm GREEN**

Run: `pnpm exec vitest run server/auth.test.ts`
Expected: registration, login, session, logout, and duplicate-email tests pass using the ephemeral Mongo server.

## Task 3: User-Owned Deck API

**Files:** Create `server/decks/deck-repository.ts`, `server/decks/deck-routes.ts`, `server/decks/deck-api.test.ts`; modify `server/app.ts` and shared deck types if necessary.

- [x] **Step 1: Write failing owner-isolation tests**

Add integration cases for unauthenticated access, empty list for a new account, create/list/update/delete by owner, a spoofed `ownerId` in the request body, and a second account attempting to read/update/delete the first account's deck. Assert all unauthenticated operations return `401`, the new user's list is `{ decks: [] }`, the owner's CRUD succeeds, and foreign/missing IDs both return `404` with identical response bodies. Expected contract:

```ts
GET    /api/decks       -> 200 { decks: SavedDeck[] }
POST   /api/decks       -> 201 { deck: SavedDeck }
PUT    /api/decks/:id   -> 200 { deck: SavedDeck }
DELETE /api/decks/:id   -> 204
```

The deck response has a string `id`, `name`, `cards`, and `sourceText`; it never returns internal `userId`. Requests without a session return `401`. A foreign or missing id returns the same `404` response.

- [x] **Step 2: Run deck tests and confirm RED**

Run: `pnpm exec vitest run server/decks/deck-api.test.ts`
Expected: FAIL because the deck repository and routes are absent.

- [x] **Step 3: Implement deck repository ownership in every query**

Store documents in `decks` with `ownerId`, name, cards, sourceText, createdAt, and updatedAt. `listByOwner` filters `{ ownerId }`; `updateByOwner` and `deleteByOwner` filter both `{ _id, ownerId }`. Generate the Mongo ObjectId server-side and serialize it as `id`. Every repository method takes `ownerId` as a required argument; never add a method that queries by `_id` alone.

The ownership predicate for updates and deletes is always combined:

```ts
const result = await collection.updateOne(
  { _id: new ObjectId(id), ownerId },
  { $set: { name, cards, sourceText, updatedAt: new Date() } }
);
```

- [x] **Step 4: Implement session-protected routes**

For each route, call `auth.api.getSession({ headers: fromNodeHeaders(req.headers) })`. Return `401` before repository access when there is no session. Validate request bodies (`name` trimmed, 1-80 characters; non-empty `sourceText`; cards array with supported section, positive integer quantity, and non-empty card name). Ignore/reject any client `ownerId` field; derive ownership only from `session.user.id`.

Use a shared session helper with this control flow:

```ts
const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
if (!session) return res.status(401).json({ error: 'UNAUTHENTICATED' });
const ownerId = session.user.id;
```

- [x] **Step 5: Run the deck API tests and confirm GREEN**

Run: `pnpm exec vitest run server/decks/deck-api.test.ts`
Expected: all CRUD and second-user isolation cases pass against isolated MongoDB.

## Task 4: Browser Authentication and API Client

**Files:** Create `src/auth/auth-client.ts`, `src/auth/AuthPanel.tsx`, `src/auth/AuthPanel.test.tsx`, `src/decks/deck-api.ts`, `src/decks/deck-api.test.ts`; modify `vite.config.ts`.

- [x] **Step 1: Write failing AuthPanel tests**

Mock only the auth-client module in the test file. Verify that the registration view submits `{ name, email, password }` to `authClient.signUp.email`, the login view submits `{ email, password }` to `authClient.signIn.email`, switching modes preserves accessible labels, and returned auth errors are shown without exposing server details.

- [x] **Step 2: Run AuthPanel tests and confirm RED**

Run: `pnpm exec vitest run src/auth/AuthPanel.test.tsx`
Expected: FAIL because the auth panel and client do not exist.

- [x] **Step 3: Add auth client and registration/login UI**

Use `createAuthClient` from `better-auth/react`; keep the default `/api/auth` base path on the same Vite origin. Build compact email/password forms consistent with the existing dark simulator UI. Registration asks for display name, email, password, and confirmation; login asks for email and password. No email verification, password reset, OAuth, or browser-stored tokens. The registration handler returns early when passwords differ and otherwise calls `authClient.signUp.email({ name, email, password })`; the login handler calls `authClient.signIn.email({ email, password })`. Show the signed-in user's display name/email in the app header and call `authClient.signOut()` from a visible `Sair` button.

- [x] **Step 4: Run AuthPanel tests and confirm GREEN**

Run: `pnpm exec vitest run src/auth/AuthPanel.test.tsx`
Expected: all form and error-state tests pass.

- [x] **Step 5: Write failing deck API client tests**

Inject a `fetch` implementation into the deck API client and verify GET/POST/PUT/DELETE paths, JSON bodies, same-origin credentials, response parsing, and conversion of non-2xx responses into a typed error. The API client never reads or writes `localStorage`.

- [x] **Step 6: Run deck API client tests and confirm RED**

Run: `pnpm exec vitest run src/decks/deck-api.test.ts`
Expected: FAIL because the API client is absent.

- [x] **Step 7: Implement typed deck API client and Vite proxy**

Expose `listDecks()`, `createDeck(draft)`, `updateDeck(id, draft)`, and `deleteDeck(id)`. Use `fetch('/api/decks', { credentials: 'same-origin', ... })`. The shared request helper throws `DeckApiError(status, message)` for non-2xx responses and does not log bodies or credentials. Proxy `/api` from Vite to `http://127.0.0.1:3001`:

```ts
server: {
  proxy: { '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true } }
}
```

- [x] **Step 8: Run the client tests and confirm GREEN**

Run: `pnpm exec vitest run src/decks/deck-api.test.ts`
Expected: all request and error conversion tests pass.

## Task 5: Replace Local Deck Persistence in the UI

**Files:** Modify `src/App.tsx`, `src/App.test.tsx`, `src/decks/DeckLibrary.tsx`, `src/decks/types.ts`; delete `src/decks/deck-storage.ts` and `src/decks/deck-storage.test.ts`.

- [x] **Step 1: Write failing app integration tests**

Mock `authClient.useSession` and the typed deck API at module boundaries. Add these tests: `shows authentication while signed out`; `loads an empty API deck list for a signed-in user`; `shows the session user and signs out`; `creates and renders a deck using the returned server id`; `updates the selected deck with PUT`; `deletes through the API`; `keeps imported text visible after a save error`; and `does not read or clear the legacy deck-storage key`. Seed the legacy key before the last test and assert it still has exactly the seeded value after render.

- [x] **Step 2: Run app tests and confirm RED**

Run: `pnpm exec vitest run src/App.test.tsx`
Expected: FAIL because App still reads the old local-storage module and has no auth gate.

- [x] **Step 3: Make deck saves server-ID-based**

Change `DeckLibrary` save callback to accept a draft without `id` and an optional existing server id. A create request returns the authoritative `SavedDeck`; an edit uses that id. Keep the currently selected deck in component state only and never use browser storage as persistence.

- [x] **Step 4: Gate App on session and load decks from API**

`App` displays a loading state while the session is pending, `AuthPanel` when no user is signed in, and the existing deck/game UI after session resolution. Fetch that user's decks when the session becomes available. Save/delete await API results before updating visible deck state. On `401`, call the auth client's session refetch and then show the login screen if there is no session. Preserve the selected `GameState` in React state exactly as it works now.

- [x] **Step 5: Remove the old deck-storage module and update integration coverage**

Delete only `deck-storage.ts` and its test, remove their imports and `localStorage.clear()` setup from `App.test.tsx`, and retain all other browser storage entries untouched. Update existing game smoke coverage to use the mocked server API and continue checking import, start game, draw, and move.

- [x] **Step 6: Run UI tests and confirm GREEN**

Run: `pnpm exec vitest run src/App.test.tsx src/auth/AuthPanel.test.tsx src/decks/deck-api.test.ts`
Expected: all UI, authentication-state, and API client tests pass.

## Task 6: Developer Commands, Documentation, and End-to-End Verification

**Files:** Modify `package.json`, `README.md`; create/update `vitest.config.ts` and `tsconfig.json` only if needed for server tests.

- [x] **Step 1: Add local development scripts**

Add `dev:api` (`tsx watch server/index.ts`), `dev:web` (existing Vite command), `dev` (`concurrently -k -n api,web "pnpm dev:api" "pnpm dev:web"`), `db:up` (`docker compose up -d`), `db:down` (`docker compose down`, without volume deletion), and `test:api` (`vitest run server/**/*.test.ts`). Keep existing `test`, `typecheck`, and `build` scripts.

- [x] **Step 2: Document first-time local setup**

Update README with these exact first-run commands, without overwriting an existing `.env`:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
pnpm install
pnpm db:up
pnpm dev
```

Document replacing sample local credentials and auth secret before sharing the machine, waiting for `riftbound` health, opening the local Vite URL, and stopping with `pnpm db:down`. Explain that `db:down` preserves the named volume, legacy browser decks are not imported, and card ingestion is deferred.

- [x] **Step 3: Verify container health and persistence**

Run `docker compose config --quiet`, `pnpm db:up`, and `docker inspect --format '{{.State.Health.Status}}' riftbound`.
Expected: health is `healthy`. Restart only the `riftbound` container with `docker restart riftbound`, wait for `healthy`, and verify `mongosh` can authenticate and ping the database. Do not run `docker compose down -v`.

- [x] **Step 4: Run the complete automated checks**

Run `pnpm test`, `pnpm test:api`, `pnpm typecheck`, and `pnpm build`.
Expected: all Vitest suites pass, TypeScript exits 0, and Vite produces the production bundle.

- [x] **Step 5: Verify the browser workflow**

Start with `pnpm dev`, open the printed Vite URL, register a test account using an `example.test` email, save a deck, reload the page, and confirm the deck remains. Sign out, register a second test account, and confirm the first user's deck is not listed. Delete test users/decks only from the newly created local `riftbound` database after verification; leave every unrelated Docker container and volume untouched.

## Spec Coverage Review

- Local Mongo container named `riftbound`, persistent volume, localhost-only port: Task 1 and Task 6.
- Server-only environment values and `.env` exclusion: Task 1 and Task 6.
- Email/password account registration, login, session, logout: Tasks 2 and 4.
- Deck CRUD and strict owner isolation: Tasks 3 and 5.
- No legacy deck migration: Task 5 asserts legacy storage is not read or cleared.
- No card import or scraping: no `cards` collection is created or populated and no network importer is added.
- TDD: every implementation task begins with a failing focused test and has an explicit RED/GREEN command.
