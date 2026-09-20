# Puvexa AI — Frontend UI

Premium, dark-first AI troubleshooting platform with Web3 FIX-token rewards.
Built with Next.js 16.3.5, React 19, Tailwind CSS 4, shadcn v4 (Base UI), Zustand and Framer Motion.

The app runs in **demo mode** by default: every flow (auth, diagnosis, verification, rewards,
wallet) is fully interactive and backed by an in-memory + `localStorage` state layer. No backend
is required.

When `NEXT_PUBLIC_DEMO_MODE` is **not** `"true"`, the same UI is driven by a production layer:
a Supabase Auth session plus the Puvexa FastAPI backend (`services/api`). `src/lib/services/index.ts`
is the single swap point — demo implementations are used in demo mode, API-backed implementations
in production.

## Demo credentials

```
Email:    alex@puvexa.ai
Password: demo1234
```

Set `NEXT_PUBLIC_DEMO_MODE=true` in `.env.local` (already provided). The public `/demo` route
walks through the whole loop — Problem → Analyze → Match → Recommend → Try → Verify → Learn →
Reward — without signing in.

## Pages

| Route | Description |
|---|---|
| `/` | Landing page — hero, features, how it works, token economy, testimonials, FAQ |
| `/demo` | Public animated product walkthrough (no auth) |
| `/login` | Auth — sign in (pre-filled demo credentials) |
| `/signup` | Auth — create account |
| `/forgot-password` | Auth — password reset |
| `/dashboard` | App — KPIs, recent diagnoses, contributions, rewards snapshot, leaderboard, next actions |
| `/diagnose` | App — New Diagnosis wizard (input → analyzing stages → ranked fixes) |
| `/diagnose/[caseId]` | App — diagnosis result: ranked fixes, try-fix checklist, verification, reward |
| `/diagnosis` | App — redirect to `/diagnose` |
| `/cases` | App — cases list with status/category/search filters |
| `/cases/[id]` | App — same diagnosis result view for any case (including newly created) |
| `/notifications` | App — full notification list with mark-read |
| `/contribute` | App — open tasks with stake/reward ranges, difficulty filters, contribution history |
| `/rewards` | App — Web3 wallet balance, claim/stake, transactions, reward history |
| `/leaderboard` | App — weekly/monthly/all-time rankings, top-3 podium, streaks, reward pool |
| `/profile` | App — public profile, stats, contributions, achievements, wallet, streak |
| `/settings` | App — appearance, notifications, profile, privacy, demo controls, danger zone |

## Architecture

A single service interface layer powers every screen. Demo implementations are fully local;
production implementations call the FastAPI backend through a Supabase-authenticated API client.

```
UI components ──► hooks (src/lib/hooks) ──► services (src/lib/services) ──► state (src/lib/state)
                                                    │
                                    ┌───────────────┴────────────────┐
                                    ▼                               ▼
                          services/demo.ts                 services/api/* (production)
                          demo seed data                   apiFetch(client.ts) → FastAPI
                          (src/lib/demo/*)                  supabase.ts → auth/session
                                                             mappers.ts → API ⇄ domain
```

- **`src/lib/demo/*`** — pure seed data + shared types (`types.ts` is the single source of truth).
- **`src/lib/state/*`** — Zustand stores with `persist` (auth, cases, rewards, wallet, notifications,
  leaderboard, tour ui). Persisted through the SSR-safe `safeStorage` wrapper.
- **`src/lib/services/*`** — `AuthService`, `DiagnosisService`, `CaseService`, `RewardService`,
  `WalletService`, `ContributionService`, `LeaderboardService`, `NotificationService`,
  `ProfileService`. `services/demo.ts` implements them locally; `services/index.ts` selects demo
  or API backing via `isDemoMode`.
- **`src/lib/api/*`** — production layer. `client.ts` is the fetch wrapper (`apiFetch`, `ApiError`,
  30s timeout, bearer token injection, error-envelope parsing). `supabase.ts` wraps the Supabase
  client and auth helpers. `mappers.ts` converts API responses (source of truth: `services/api`
  routes.py/schemas) into demo types. `services.ts` implements every service contract against the
  backend and hydrates the Zustand stores. `bootstrap.ts` restores a persisted Supabase session on
  boot and watches auth state.
- **`src/lib/hooks`** — React bindings (`useCurrentUser`, `useCases`, `useRewards`, `useWallet`,
  `useNotifications`, `useContributions`, `useLeaderboard`, `useDiagnosis`, `useTour`).
- **`src/lib/data.ts`** — re-exports demo data + types so screens import from one place.

### Key flows

- **Diagnosis (demo):** `startDiagnosis(input)` runs `findAnalysisFor()` keyword mapping (hydration,
  Wi-Fi, Python, Excel/XLOOKUP, Docker) and creates a `Suggested` case, then redirects to
  `/diagnose/[caseId]`.
- **Diagnosis (production):** `startDiagnosis(input)` POSTs `/api/v1/cases`, runs
  `/cases/{id}/diagnose`, then reads `/cases/{id}` and redirects to `/cases/[id]`. Status surface
  as `Needs Verification` until the backend reaches a state the reactor can act on.
- **Try → verify (demo):** pick a ranked fix (`Applied`) → tick steps → submit outcome (`Monitoring`,
  24h observation) → advance the simulated window → `Verified`/`Failed` and the reward unlocks.
- **Try → verify (production):** the same UI flows through the real endpoints
  (`/attempts`, `/outcomes`, `/rewards/ledger`-backed state). Applying a fix before the backend
  transitions the case to `suggested` returns the documented `INVALID_TRANSITION` — the UI syncs
  back to server state and explains the gap.
- **Rewards:** verified outcomes add claimable FIX; claiming moves it to the balance and records a
  transaction (demo). In production, claim/stake/wallet interactions show an honest "web3 arrives
  after wallet verification and smart contract deployment" notice; verified amounts are tracked
  off-chain via `/api/v1/rewards/summary`.
- **Session restore (production):** `AuthGate` calls `restoreSession()` (Supabase session →
  `hydrateWorkspace()` reading dashboard-backed endpoints) and subscribes to auth changes; logout
  clears every local store.

### Verification language

The UI never shows chain-of-thought. It surfaces high-level stages only — Understanding context →
Checking evidence → Comparing similar cases → Evaluating outcomes → Ranking fixes — with case
statuses `Suggested · Applied · Monitoring · Verified · Partially Verified · Failed · Needs Verification`.
In production the analyzing panel drops simulated stage progress and shows an honest
"server-side review" state; the server owns reward/reputation amounts and no client-supplied
`user_id` is ever trusted.

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout (fonts, metadata, ThemeProvider, SplashScreen, Toaster)
│   ├── page.tsx                # Landing page (server → LandingPage client component)
│   ├── globals.css             # Design system: oklch tokens, keyframes, utilities
│   ├── demo/                   # Public demo experience (own layout, no auth gate)
│   ├── (auth)/                 # Centered glass-card auth layout (login / signup / forgot)
│   └── (app)/                  # Auth-gated app: layout wraps AuthGate → AppShell
│       ├── dashboard, diagnose, diagnose/[caseId], diagnosis, cases, cases/[id],
│       ├── notifications, contribute, rewards, leaderboard, profile, settings
├── components/
│   ├── ui/                     # shadcn v4 Base UI primitives
│   ├── shared/                 # icon, motion, status-badge, token-badge, case-card, empty-state, etc.
│   ├── app-shell/              # AppShell + command palette + auth gate
│   ├── brand/                  # FixGlyph + Logo + SplashScreen
│   ├── diagnose/               # DiagnoseWizard, AnalyzingPanel, DiagnosisResult, VerificationPanel
│   ├── demo/                   # DemoWorkflow (stage machine + sidebar stepper)
│   ├── landing/ dashboard/ cases/ contribute/ rewards/ leaderboard/ profile/ settings/ auth/
│   └── product-tour.tsx        # 5-step onboarding tour
└── lib/
    ├── demo/                   # Seed data + types + keyword analysis mapping
    ├── api/                    # Production layer: client, supabase, mappers, services, bootstrap
    ├── state/                  # Zustand stores + storage helpers
    ├── services/               # Service interfaces + demo implementations + factory
    ├── hooks/                  # React bindings over services/stores
    ├── data.ts, format.ts, motion.ts, feedback.ts, utils.ts
```

## Design System

**Dark-first.** All surfaces are built on oklch tokens defined in `globals.css`.

- **Primary:** violet/indigo (`--color-primary`); **Accents:** cyan, success green, warning amber, info blue.
- **Typography:** Inter (`--font-sans`) body, Space Grotesk (`--font-heading`) headings.
- **Animation tokens:** `animate-float`, `animate-aurora`, `animate-shimmer`, `animate-signal`, `animate-spin-slow`, `animate-gradient-x`, `animate-marquee`, `animate-scan`, `animate-rise`, `animate-pulse-glow`.
- **Utilities:** `text-gradient`, `text-gradient-strong`, `glass-panel`, `bg-grid-faint`, `no-scrollbar`, `scrollbar-thin`, `mask-fade-x`, `card-hover`, `noise`.
- **Primitives:** shadcn v4 "base-nova" on `@base-ui/react`. Import `cn` from `"cn"`. Use the
  `render` prop (not `asChild`) for custom elements.

## Scripts

```bash
npm run dev          # http://localhost:3000
npm run build        # production build (Turbopack + TypeScript check)
npm run lint         # eslint
npm test             # vitest (single run)
npm run test:watch   # vitest watch
npx tsc --noEmit     # standalone type check
```

## Testing

Vitest + jsdom + Testing Library, configured in `vitest.config.ts` (with `NEXT_PUBLIC_DEMO_MODE=true`
injected and the `@/` alias resolved).
- `src/lib/services/demo.test.ts` — auth login/signup/logout, diagnosis keyword mapping and case
  creation, case progression through verification, reward claiming, staking, wallet
  connect/verify/disconnect, and contribution submission against the demo layer.
- `src/lib/services/factory.test.ts` — asserts the service factory resolves to demo providers in
  demo mode, that `startDiagnosis` is async across implementations, and that the demo wallet
  provider never exposes chain verification methods.
- `src/lib/api/mappers.test.ts` — unit tests for status/profile/case/reward/leaderboard/notification/
  contribution mappers against API-shaped fixtures.
- `src/lib/web3/config.test.ts` — web3 config demo/testnet/local modes, mainnet refusal, address
  sanitizing, trust labels.
- `src/lib/web3/mappers.test.ts` — wei/decimal helpers, challenge/transaction/status mappers.
- `src/lib/web3/flows.test.ts` — claim flow (happy path, deadline expiry, revert, error mapping),
  wallet verification, stake flow (approval skip/required/revert, stake revert, errors).
- `src/lib/state/wallet.test.ts` — wallet store state transitions (connected/verified/wrong
  network/error, resolve, disconnect).

## Production Configuration

Set these in `.env.local` (demo requires none of them):

```
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000    # FastAPI backend (services/api)
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

The backend must be running and migrated (see `services/api`); Supabase must issue JWTs with the
`authenticated` audience so `get_current_user`/`verify_token` can resolve the caller.

## Production Readiness (honesty rules)

- No simulated AI: the analyzing panel and timeline say so in production; diagnosis results come
  from the backend's verified/fix workflow (`source_type` guarded in routes).
- The frontend never invents reward/reputation numbers; it renders `/api/v1/rewards/summary`,
  `/rewards/history`, `/profile/stats` and `/leaderboard` as-is.
- Web3 claiming/staking (Phase 5) is real but opt-in: with `NEXT_PUBLIC_WEB3_*` unset the UI
  shows an honest "on-chain claiming is not configured" state; no simulated "Claim successful"
  ever appears in production. Verified FIX is tracked off-chain until then.

## Phase 4 / 4.5 / 5 local closeouts

See [PHASE4_CLOSEOUT.md](PHASE4_CLOSEOUT.md), [PHASE45_CLOSEOUT.md](PHASE45_CLOSEOUT.md)
(security gate, 25 items) and [PHASE5_CLOSEOUT.md](PHASE5_CLOSEOUT.md) (Web3 reward economy,
14 local gate items) for architecture, validation evidence, known blockers and the Supabase
production checklists.

### Web3 (Phase 5)

The production Web3 layer lives in `src/lib/web3/*` (config, wagmi client, chain actions,
mappers, state machines) and `src/components/web3/*` (wallet panel, network badge,
claim/stake dialogs, on-chain history). The backend exposes `/api/v1/web3/*` claim/stake
endpoints and `/api/v1/wallet/*` challenge/verify with EIP-191 signatures. Contracts are in
`contracts/` (Foundry; 40 passing tests) and are not part of the Next.js build.

Set these only to engage real on-chain flows (chain id 31337 Anvil development; mainnet
chain ids are rejected at config load):

```
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_WEB3_ENV=local
NEXT_PUBLIC_WEB3_CHAIN_ID=31337
NEXT_PUBLIC_WEB3_RPC_URL=http://127.0.0.1:8545
NEXT_PUBLIC_FIXAI_TOKEN_ADDRESS=<token-contract>
NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS=<distributor-contract>
NEXT_PUBLIC_STAKE_VAULT_ADDRESS=<vault-contract>
NEXT_PUBLIC_CONTRIBUTION_REGISTRY_ADDRESS=<registry-contract>
```

Trust labels (LOCAL / TESTNET / DEMO) come from `networkIdentity()`; the wallet panel never
asks for a seed phrase or private key — only a signing challenge. See
[PHASE5_CLOSEOUT.md](PHASE5_CLOSEOUT.md) for the local Anvil dev walkthrough and the
remaining production blockers (Supabase project, trusted signature verifier).

### Local Anvil walkthrough (Web3 end-to-end)

Requirements: Foundry (`forge`/`anvil`, verify with `forge --version`; on this machine they live
under `C:\Users\PK\.foundry\bin`) and the backend venv (`services/api/.venv`).

The one-command E2E boots everything and asserts the whole on-chain economy:

```powershell
Set-Location services/api
.\.venv\Scripts\python.exe scripts/e2e_web3.py
```

This runs a fresh `anvil` node (chain 31337), deploys all contracts via
`contracts/script/Deploy.s.sol` (writing `contracts/deployments/local.json`), starts the
backend in-process with `WEB3_CLAIM_ENABLED=true`, and exercises: wallet challenge→EIP-191
verify; claim prepare (signed EIP-712) → real on-chain `claim` tx → confirm; duplicate-prepare
exclusivity; **exact-amount** token approval + stake → release; slash (25%) → return; royalty
grant → claim; and claim/transaction history. Expected result: `32 passed, 0 failed`.

Manual equivalent (when the automatic harness is not what you want):

```powershell
# Terminal 1 — chain + deploy (filled into deployments/local.json)
anvil --port 8545 --chain-id 31337
cd contracts
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 -vv

# Terminal 2 — backend with web3 claim enabled
cd ..\services\api
$env:DATABASE_URL = 'sqlite+aiosqlite:///./puvexa.db'
$env:WEB3_CLAIM_ENABLED = 'true'
$env:WALLET_SIGNATURE_VERIFIER = 'eip191'
$env:WEB3_CHAIN_ID = '31337'
$env:WEB3_TESTNET_RPC_URL = 'http://127.0.0.1:8545'
$env:WEB3_TOKEN_ADDRESS = '<token from local.json>'
$env:WEB3_DISTRIBUTOR_ADDRESS = '<distributor from local.json>'
$env:WEB3_STAKE_VAULT_ADDRESS = '<stakeVault from local.json>'
$env:WEB3_REGISTRY_ADDRESS = '<registry from local.json>'
$env:WEB3_REWARD_SIGNER_PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' # anvil account 2
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload

# Terminal 3 — frontend in LOCAL web3 mode
Set-Location ../..
npm.cmd run dev   # NEXT_PUBLIC_WEB3_ENV=local + addresses from local.json
```

In production the backend refuses mainnet chain ids at runtime and `ALLOW_MAINNET_DEPLOYMENT`
stays `false`; the demo mode never simulates on-chain results.

### BNB Testnet staging playbook (chain 97)

Staging targets BNB Smart Chain Testnet (chain id 97). The deploy script writes a
chain-id-keyed artifact so a testnet deploy never clobbers the local one:

```powershell
cd contracts
# Funded testnet deployer key; NEVER use prod keys. Roles via PUVEXA_* env overrides.
$env:PUVEXA_ARTIFACT = 'deployments/bnb-testnet.json'   # keep local.json untouched
forge script script/Deploy.s.sol --rpc-url https://data-seed-prebsc-1-s1.bnbchain.org:8545 `
  --broadcast --private-key 0x<funded-testnet-deployer-key> -vv
```

Then copy `deployments/bnb-testnet.json.example` values into `deployments/bnb-testnet.json`
(or let the script fill them) and wire the backend/frontend `.env` (chain `97`,
`NEXT_PUBLIC_WEB3_ENV=` anything but `local`, signer = `PUVEXA_REWARD_SIGNER`). Verify the
deploy on [BscScan Testnet](https://testnet.bscscan.com); confirm the exact fixed supply
(1B FIXAI, 18 decimals) before enabling `WEB3_CLAIM_ENABLED=true`. Mainnet remains refused.

### Local PostgreSQL and pgvector (PowerShell)

Run from `puvexa-ai`. Docker Engine/Desktop must be installed and running.
Set development values in the shell (or copy the PostgreSQL entries from `.env.example`
into a local `.env`; do not commit real credentials):

```powershell
$env:POSTGRES_DB = 'puvexa'
$env:POSTGRES_USER = 'puvexa'
$env:POSTGRES_PASSWORD = 'replace-with-a-local-development-password'
$env:POSTGRES_PORT = '5432'
docker compose up -d
Set-Location services/api
$env:DATABASE_URL = 'postgresql+asyncpg://puvexa:replace-with-a-local-development-password@localhost:5432/puvexa'
$env:AI_PROVIDER = 'mock'
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m app.scripts.seed_dev
.\.venv\Scripts\python.exe -m app.scripts.seed_knowledge
.\.venv\Scripts\python.exe -m app.scripts.smoke_retrieval --require-postgres
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Use a URL-encoded password in `DATABASE_URL`. The database port binds to loopback.
The image is `pgvector/pgvector:pg16`; database, user, password and port are environment
variables. Migration `20260918_phase4_intelligence` enables `vector` on PostgreSQL.
Existing vector columns use 1536 dimensions. A different dimension requires an explicit
schema migration and re-embedding all indexed content, not just changing an environment value.

Without Docker, use the verified SQLite fallback:

```powershell
Set-Location services/api
$env:DATABASE_URL = 'sqlite+aiosqlite:///./puvexa.db'
$env:AI_PROVIDER = 'mock'
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m app.scripts.seed_dev
.\.venv\Scripts\python.exe -m app.scripts.seed_knowledge
.\.venv\Scripts\python.exe -m app.scripts.smoke_retrieval
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

In a second terminal, from `puvexa-ai`:

```powershell
npm.cmd run dev
```

`npm.cmd` avoids Windows PowerShell execution-policy restrictions on `npm.ps1`.
The local demo (`NEXT_PUBLIC_DEMO_MODE=true`) needs neither Supabase nor an AI key.
Production authentication still uses Supabase; without a project, authenticated API flows
are exercised through isolated test identities. No insecure authentication bypass is added.
The backend, database, evaluation, and frontend demo all run locally without Supabase.

### Provider configuration and no-key behavior

Backend settings are in `services/api/.env.example`. Use `AI_PROVIDER=unconfigured`
(or `AI_PROVIDER=openai` with no key) for honest unavailable responses. Use `AI_PROVIDER=mock`
explicitly for deterministic development only. `AI_MODEL`, `AI_VISION_MODEL`,
`AI_EMBEDDING_MODEL`, `AI_EMBEDDING_DIMENSION` (legacy alias `AI_EMBEDDING_DIM`),
`AI_TIMEOUT_SECONDS`, `AI_RATE_LIMIT_PER_DAY`, `AI_MAX_EVIDENCE_CHARS`, `MAX_UPLOAD_MB`,
and `MIN_SUCCESS_RATE_SAMPLE=5` are configurable. Cost estimates are opt-in through
`AI_COST_TRACKING_ENABLED` and operator-supplied per-million input/output prices.
The existing diagnosis/embedding requests use the bounded HTTP transport and `AI_RETRY_COUNT`.
Logs/code and ranking use explicit local deterministic engines. Unsupported image analysis
fails honestly rather than returning mock output; no new external image transmission was added.

No key: server startup and DB remain available; a diagnosis is `unavailable` with
`AI_PROVIDER_NOT_CONFIGURED`. The production UI says "AI diagnosis is not configured in
this environment." It offers Retry and Back to Case, with no demo-answer fallback.

LIVE_AI_TEST=BLOCKED_NO_API_KEY

### Diagnosis, trust and statistics

`ApiDiagnosisService.startDiagnosis(input, { onStage, caseId, signal })` creates a case
(or retries the existing case), starts diagnosis, polls `/diagnoses/{id}/status`, stops
on completed/failed/unavailable, and loads recommendations plus sources. The analyzing
panel uses actual server stage/progress. Polling is bounded and lives outside page JSX.
Case detail refresh restores confidence and provenance after reload.

The result separates Puvexa confidence (a heuristic composite, not a success rate) from
verified outcomes. The breakdown includes evidence completeness, context match, retrieval
strength, source authority, historical outcome strength and AI agreement. It is not a
calibrated probability or guarantee. Below the server-supplied minimum sample, the UI says
"Insufficient verified outcome data" and "Based on X verified outcome(s)". It never computes
a missing rate from counts. Eligible outcomes exclude provisional self-report resolutions.

Trust labels normalize AI Suggestion to **AI Suggested** and Outcome-Backed Fix to
**Outcome-Backed**; official/curated labels retain their provenance. Verification claims
must originate from backend assessments. The expandable "Why Puvexa recommends this"
shows the stored explanation. Source cards expose curated titles/URLs and outcome pattern
labels, never another user's raw logs, images, code, or outcome identifiers.

Cold start uses seven curated documents (including hydration, Python imports, Docker port
collisions, Git conflicts, Windows Wi-Fi regression, and Excel XLOOKUP) with source links.
Seeding is idempotent and creates no user counts or verified success statistics.

### Validation and offline quality evaluation

```powershell
Set-Location services/api
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m app.scripts.evaluate_ai
.\.venv\Scripts\python.exe -m app.scripts.smoke_retrieval
Set-Location ../..
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

The evaluation has 30 explicit rubrics across React/Next.js, Python, Node.js, Docker, Git,
Windows, networking, Excel, VS Code and Supabase. It compares held-out inputs with separate
cold-start documents, reports precision@3, root-cause/fix relevance, category accuracy,
safety, schema validity, unsupported-claim and verifier-selection proxies. Results are
labeled **MOCK/DETERMINISTIC BASELINE**. They are not live AI quality measurements.
Inspect `services/api/evaluation-baseline.json`; low coverage scores remain visible.

### Future Supabase migration

1. Create a Supabase project.
2. Apply the existing Alembic migrations to its PostgreSQL database.
3. Enable/verify pgvector and run the native retrieval smoke test.
4. Configure the private evidence storage bucket and owner-scoped access.
5. Configure Supabase Auth and JWT issuer/JWKS values.
6. Add backend secrets and frontend public environment keys.
7. Enable RLS on `claim_reservations` (owner-only; service role for Signed/Confirm webhooks)
   and verify the PostgreSQL-only constraints `valid_claim_state` and
   `unique_fix_contributor_attribution_version` from the Phase 4.5 migration.
8. Switch production database/storage configuration; verify owner isolation and RLS.

Phase 5 adds the Web3 reward economy (wallet verification, on-chain claim/stake dialogs,
Foundry contracts) — see the Web3 section above. No Firebase architecture is included.
