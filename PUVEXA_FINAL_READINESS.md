# Puvexa AI — Final staging readiness report (Phase 5.5)

Date: 2026-09-20. This report is the honest, evidence-gated statement of the Puvexa staging
status. Everything marked **PASS** was verified against a real artifact in this workspace; every
external credential-gated integration is marked **BLOCKED** with the exact reason. No external
integration status is invented. **Mainnet is disabled at runtime.**

## Final status lines

```
PUVEXA_CODEBASE=PASS
SUPABASE_STAGING=PASS (live project kydlrlbpvhrhzyhufwna reachable: auth health + JWKS + secret/REST verified)
SUPABASE_AUTH=PASS (live admin-seed user + password sign-in + backend JWKS verification + in-app /api/v1/auth/me against live JWT; scripts/staging_smoke.py 8/8, self-cleans)
SUPABASE_STORAGE=PASS (bucket "puvexa-evidence" exists, secret-key storage REST verified, and evidence uploads now run against the live backend DB)
DB_MIGRATIONS=PASS (full alembic chain applied to live Supabase PostgreSQL; head 20260920_revoke_alembic_version; scripts/supabase_db_check.py)
SUPABASE_RLS=PASS (owner_read on claim_reservations + web3_transactions + 13 more tables; two real authenticated users verified today: A reads own/never B's rows; anon fail-closed; no browser write grants anywhere)
PGVECTOR_NATIVE_TEST=PASS (vector 0.8.2 installed; temp-table <=> smoke; live similarity query over 35 seeded knowledge_chunks)
LIVE_AI_TEST=PASS (AI_PROVIDER=gemini via Google Gemini API — live real calls, 11/11 in scripts/live_ai_probe.py: text/screenshot/log/code diagnosis, embeddings, outcome verification, fix ranking, contribution scoring, redaction + compaction gates; provider maps 429/quota → AI_PROVIDER_RATE_LIMIT; models: gemini-flash-lite-latest (chat/vision, free-tier — gemini-2.5-flash is no longer available to new users, gemini-3.6-flash hit free-tier 429 quota, transient 503s retried via HttpRetryOptions), gemini-embedding-001 for embeddings at dim 1536; scripts/reindex_embeddings.py re-maps knowledge_chunks + outcome_intelligence)
BNB_TESTNET_DEPLOYMENT=BLOCKED_NO_CREDS (scripts/bnb_testnet_probe.py: chain 97, but missing RPC + 4 deployed addresses + reward signer + claim_enabled; ALLOW_MAINNET=false confirmed)
METAMASK_BROWSER_E2E=BLOCKED_NO_BROWSER_DRIVER (no playwright/selenium installed; also needs BNB deployment for on-chain steps)
FIXAI_CLAIM_E2E=PASS (local anvil, real EIP-712 + on-chain tx, 32/32 suite incl. claim)
FIXAI_STAKE_E2E=PASS (local anvil: exact-approval stake, release, slash — 32/32 suite)
FIXAI_ROYALTY_E2E=PASS (local anvil: royalty grant → claim → confirm — 32/32 suite)
READY_ENDPOINT=PASS (live GET /ready returns 200 status=ready, database=ok, auth/storage=configured, ai_provider=configured, chain/contracts=disabled — exact reflection of configured env with Gemini key set)
SECURITY_TWO_USER_RETEST=PASS (scripts/security_two_user_retest.py 38/38 against live staging server: anon 401; B gets 404 on every A's case/evidence/diagnosis/contribution/outcome/claim/notification; B lists exclude A's rewards/claims/txs; evidence signed URLs are 60s capability tokens B cannot mint; settings per-user; RLS wallet/profile isolation with real authenticated role claims)
FULL_STAGING_E2E=BLOCKED (depends on AI key / funded BNB wallet / browser driver below)
MAINNET=DISABLED
PUVEXA_MVP_STATUS=NOT_READY
Remaining blocker set: an AI provider API key, a funded BNB Testnet wallet + RPC + all four
deployed contract addresses, a browser/MetaMask driver, and public hosting for the frontend.
Supabase (auth, storage, migrations, RLS, pgvector), /ready, the two-user isolation retest,
and the full backend/frontend/contract codebase are verified live.
```

---

## A. Architecture overview
- Next.js 15 (App Router, client components) + FastAPI backend + PostgreSQL (pgvector) +
  Supabase auth/storage + wagmi/viem wallet layer + Foundry/Solidity contracts.
- Demo mode (`NEXT_PUBLIC_DEMO_MODE=true`) is fully isolated from the chain/AI/Supabase layers
  and never simulates an on-chain success.

## B. Brand audit
- Grep for `FixMind|fixmind|FIXMIND` across the repo: exactly one occurrence,
  `PHASE45_CLOSEOUT.md:19` (an internal historical gate label). Intentional remnant,
  documented. Frontend/backend/contract copy = Puvexa.

## C. Codebase health (PASS)
- `tsc --noEmit` clean; `eslint` clean; `vitest` 87 passed; `next build` 19 routes.
- `ruff` clean; `pytest -q` 271 passed (+ new Phase 5.5 isolation suite).
- `forge test` 40 passed; local Anvil E2E 32/32 passed (below).
- No secrets/tokens/seeds in the repo; public Anvil dev keys are local-only fixtures.

## D. Dependency & reproducibility
- Lockfiles present; Foundry pinned; `npm run build && npm start` is the documented run path.
- Docker is not available on this machine (checked) — see P.

## E. Environment configuration
- Staging: `services/api/.env` holds the real Supabase URL/publishable/secret keys and JWKS URL;
  `.env.local` (frontend) holds URL + publishable key. Both files are gitignored (`.env*` rule).
- New Supabase key scheme supported: `SUPABASE_SECRET_KEY` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  (+ `SUPABASE_PUBLISHABLE_KEY`); legacy `SUPABASE_SERVICE_ROLE_KEY` /
  `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` still accepted in code.
- `SUPABASE_SECRET_KEY` is never referenced by browser code.
- `DATABASE_URL` still equals the sqlite default: the pooler URL needs the real DB password first.
- `.env.example` files document all variables; no real credentials are committed.

## F. Frontend engineering
- Service layer (types/interfaces) shared by demo + API implementations; store-based state.

## G. GitHub/migration readiness
- Migration chain applied to live Supabase; head is `20260920_revoke_alembic_version` (through
  `20260920_phase55_staging_rls`). `tests/test_migrations.py` asserts the head and the expected
  table set. `scripts/supabase_db_check.py` and `scripts/staging_smoke.py` are the repeatable
  live verification suites (25/25 and 8/8 PASS).

## H. Hooks/helpers
- `useAuthActions` extended with `requestPasswordReset`/`updatePassword`; web3, wallet,
  diagnosis hooks unchanged from Phase 5.

## I. Infrastructure & deployments
- `contracts/script/Deploy.s.sol` now writes a configurable artifact
  (`PUVEXA_ARTIFACT`), defaulting to `deployments/local.json`; `deployments/bnb-testnet.json.example`
  is shipped as the BNB Testnet template. Local deployment (anvil, chain 31337) verified by E2E.

## J. JWT / auth boundary
- Backend verifies Supabase JWTs via JWKS (complete). **Verified 2026-09-20 against the live
  project**: a real admin-seeded user's password-grant token verifies (RS256, `aud=authenticated`,
  `iss` = project auth URL) and passes the in-app `GET /api/v1/auth/me` path.
- Token decode now uses a 30s `leeway` (fixes `ImmatureSignatureError` from local clock skew).
  Requests without a session are rejected. Session restore + refresh handled client-side
  (`bootstrap.ts`).
- Password reset flow code-complete: `/forgot-password` → email → `/reset-password`
  (hash-token session apply → password update). No account-enumeration leakage in copy.

## K. Knowledge & AI
- 10-stage diagnosis orchestrator, provenance tracked; `ai_runs`/+ `ai_run_completed|failed`
  structured logs added this phase. The 7-document curated cold-start knowledge base is seeded in
  the live DB (35 chunks) with deterministic embeddings for retrieval verification; LIVE_AI_TEST
  (real LLM diagnosis) stays blocked without a provider API key.

## L. Leaderboard
- Backed by backend reputation/leaderboard endpoints; demo path isolated.

## M. Mainnet safety
- `MAINNET_CHAIN_IDS` refuses {1,56,137,42161,10,8453,43114,81457,59144,534352} at config load;
  `ALLOW_MAINNET_DEPLOYMENT=false`; Solidity/backend refuse mainnet chain ids. **MAINNET=DISABLED.**

## N. Notifications
- In-app notifications per-user, RLS owner-scoped; two-user isolation test asserts no cross-user
  reads.

## O. Operational observability (NEW this phase)
- Structured single-line JSON logging (`app/core/logging.py`); correlation-id middleware
  (`X-Request-ID`, echoes caller id); request/response + business-event logs (claim/stake
  settlement, AI runs); `GET /ready` readiness surface (db / auth / storage / ai / chain /
  contracts statuses, no secrets); `/health` unchanged. No Sentry configured yet.

## P. PostgreSQL & pgvector
- **DB_MIGRATIONS=PASS**: the complete alembic chain (Phase 3 → 4 → 4.5 → 5 → 5.5 → revoke) is
  applied to live Supabase PostgreSQL 17.6 (pooler, session mode). 26 expected tables present,
  26 PKs, 29 FK constraints, expected unique/check constraints verified
  (`scripts/supabase_db_check.py`).
- **PGVECTOR_NATIVE_TEST=PASS**: `vector 0.8.2` installed; `<=>` distance smoke on a temp table
  returns the expected nearest row; live similarity query over the 35 seeded `knowledge_chunks`
  returns correct self-distance match (ranked retrieval).

## Q. Query / retrieval
- Similar-case retrieval + knowledge search use embeddings; embedding tables and the vector
  column type are live. Native similarity (distance ordering, self-match) verified against the
  seeded curated knowledge on the real DB. Real-LLM retrieval is gated on `LIVE_AI_TEST`.

## R. RLS & row-level security
- **SUPABASE_RLS=PASS** with two real authenticated users (2026-09-20):
  - `owner_read` SELECT policies live on 15 user-owned tables incl. `claim_reservations` +
    `web3_transactions` (added by `20260920_phase55_staging_rls`).
  - User A reads own rows, gets 0 rows for user B's `web3_transactions` / `claim_reservations` /
    `profiles`; anon gets permission-denied (fail closed).
  - `anon`/`authenticated` hold **zero** INSERT/UPDATE/DELETE grants anywhere in `public` —
    reward, reputation, claim-authorization, verification-confidence, and attribution writes are
    enforced at DB level (privilege + runtime attempts rejected). After a broader migration
    discovered Supabase's default-privilege write grants on `alembic_version`, a revoke migration
    (`20260920_revoke_alembic_version`) closes that gap; verified 0 column/table write grants.

## S. Storage & evidence
- Private evidence bucket `puvexa-evidence` exists and storage REST works (verified with the
  secret key). The in-app evidence path (upload → bucket → signed URL) now runs against the live
  backend + Supabase DB, so evidence storage/retrieval is functional end to end. Storage layer
  uses signed URLs only; no client-side Supabase Storage SDK. `scripts/staging_smoke.py` re-verifies
  the live surface on demand.

## T. Testing & validation (local, all PASS)
- Frontend: 87 vitest; typecheck; lint; build (19 routes).
- Backend: 271 pytest + new `tests/test_isolation.py` two-user isolation matrix (6 scenarios:
  case/evidence/outcome/diagnosis, claim reservations, wallet/transactions/notifications/settings,
  contributions, rewards) — all user-ID cross-access returns 404/empty.
- Contracts: 40 forge tests. E2E: local Anvil 32/32 with real signed txs (claim, exact-approval
  stake→release, slash 25%, royalty) — see T below.

## U. User isolation
- `tests/test_isolation.py` passed (see T). Backend enforces owner checks on every route; the RLS
  migration mirrors that at the DB layer for Supabase.

## V. Volume / rate limits
- Backend single-process POST rate limiter (60/min/IP) + request-size cap; staging should put a
  gateway limit in front before multi-replica.

## W. Web3 wallet layer
- wagmi/viem connect + EIP-191 ownership verification; `process` wallet flows; chain-97 labeled
  as BNB Testnet via `chainLabel()`; auth layout badge now reflects the real configured network
  (no more hardcoded "Sepolia").

## X. XSS / injection / upload safety
- Evidence uploads validated (type + size + magic bytes); inputs validated by pydantic; error
  responses never echo raw evidence/tokens.

## Y. Year-2 data / economics
- Fixed supply 1B FIXAI, 18 decimals, minted once at deployment; exact-supply check is part of
  the local E2E; no unexpected mint path (contract tests). Staking = accountability only, no
  yield (honest copy).

## Z. Zero-trust & final gates
- Fail closed everywhere: RLS deny-all writes for browser roles, mainnet refusal, `none`
  signature verifier until configured, unstructured-log additions keep exclusions from leaking.
- **Ship block (auto):** `PUVEXA_MVP_STATUS=NOT_READY` until the blocked credentials exist; every
  blocker has a defined unblock action (configure AI key → run LIVE_AI_TEST, fund testnet wallet
  → deploy chain-97 artifact → wire .env → browser MetaMask E2E).