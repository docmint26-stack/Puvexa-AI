# Phase 4.5 closeout report

Date: 2026-09-18. **Status: local security-audit gate is fully green (25/25).**
Production deployment remains conditioned on the external environment blockers listed below
(no live API key, no native Docker/PostgreSQL runtime, no Supabase project). Phase 5 Web3
work remains out of scope; claim reservations are future-proofing infrastructure only.

LIVE_AI_TEST=BLOCKED_NO_API_KEY

All Phase 4.5 verification runs locally without Supabase and without a live AI key.
The default AI provider is `unconfigured`/`mock` and honestly refuses unavailable behavior.
Wallet verification never fakes chain confirmation: without a configured verifier the service
returns `503 WALLET_SIGNATURE_UNAVAILABLE`.

## GO/NO-GO gate (25 items) — all PASS (local verification)

| # | Gate item | Verification evidence | Verdict |
| --- | --- | --- | --- |
| 1 | Brand migration FixMind -> Puvexa end to end | `package.json` name `puvexa-ai`, `PuvexaIntelligenceService`, Puvexa UI labels; no Firebase introduced | **GO** |
| 2 | Repo/workspace integrity | Parent folder and migration filenames unchanged; stable internal identifiers preserved | **GO** |
| 3 | Backend suite green | `pytest -q`: **249 passed** (208 prior + 41 new Phase 4.5) | **GO** |
| 4 | Backend lint clean | `ruff check .` clean | **GO** |
| 5 | Frontend tests green | `vitest run`: 42 passed across 6 files | **GO** |
| 6 | Frontend typecheck clean | `tsc --noEmit` passes | **GO** |
| 7 | Production build | `next build` (16.3.5/Turbopack) compiles, 19 routes | **GO** |
| 8 | Rewards not client-forgeable | no `POST /rewards` route (404/405); amount/status/idempotency_key server-authoritative | **GO** |
| 9 | Reward idempotency | canonical keys `accepted_fix:{fix}:{user}`, `royalty:{usage}:{contributor}`, `verified_outcome:{outcome}`; repeat grant no-op, single row | **GO** |
| 10 | Reputation idempotency | repeat grant -> exactly 1 `ReputationEvent`, score 50, level derived server-side | **GO** |
| 11 | Creator attribution ownership | non-creator set_creator -> `403 CREATOR_MISMATCH` | **GO** |
| 12 | Attribution percentage rules | total > 100% -> `409 OWNERSHIP_EXCEEDS_100`; share 0 / >1 / bogus type -> 422; creator share forced to exactly 100% | **GO** |
| 13 | Attribution upsert idempotency | single row per (fix, contributor, type); `list_for_fix` returns 1 row | **GO** |
| 14 | Duplicate contribution (content hash) | API analyze flags `fraud_risk >= 0.5`, recommendation != accept | **GO** |
| 15 | Paraphrased duplicate (semantic) | engine deterministic check_duplicate_fix similarity >= 0.7; API `duplicate_probability >= 0.5` | **GO** |
| 16 | Verification strength honesty | strong = verified, weak = partially_verified, conflicting evidence = inconclusive; no fabricated strength | **GO** |
| 17 | Success-rate threshold | below `MIN_SUCCESS_RATE_SAMPLE=5` -> `None` + "Not enough verified outcomes yet"; at/above exact rates 100/80/20% | **GO** |
| 18 | Prompt-injection defense | evidence wrapped in `<USER_EVIDENCE_DATA>`; injected close-tag sanitized to `[TAG_FILTERED]`; grounded facts isolated | **GO** |
| 19 | Cross-user evidence isolation | evidence list/detail/download all 404 for non-owner; no text leakage | **GO** |
| 20 | Cross-user reward isolation | history/summary owner-scoped; cross-user `cancel_reward` -> 404, reward stays claimable | **GO** |
| 21 | Wallet nonce replay + expiry | replay -> `409 WALLET_NONCE_REPLAY`; expired -> `410 WALLET_NONCE_EXPIRED` | **GO** |
| 22 | Wallet never accepts unverified signatures | forged signature with default verifier -> `503 WALLET_SIGNATURE_UNAVAILABLE`; no chain confirmation faked | **GO** |
| 23 | Claim reservation state machine | idempotent reserve, cross-user reserve -> 404, release restores claimable, full flow reserved/signed/submitted/failed/reserved, invalid transition -> 409, confirm requires explicit `tx_hash` (`409 MISSING_TX_HASH`) | **GO** |
| 24 | Admin contribution review | accept requires admin (403 FORBIDDEN); happy path atomically creates fix + creator attribution 100% + claimable reward (canonical key) + 50 reputation; accept idempotent; accepted review frozen (`409 REVIEW_STARTED`); reject flow | **GO** |
| 25 | Audit trail completeness | `wallet_challenge_issued`, `future_claim_reserved`, `contribution_rejected` recorded in `AuditEvent` | **GO** |

## Validation evidence

- New suite: `services/api/tests/test_phase45_security.py` (41 tests) covering the 14 required
  security properties plus the admin accept/reject flow and audit events.
- `tests/conftest.py` TRUNCATE list includes `claim_reservations` (FK order: after
  `wallet_links`, before `notifications`/`reward_ledger`).
- Full commands (from `services/api` / repo root):

```powershell
.\.venv\Scripts\python.exe -m pytest -q        # 249 passed
.\.venv\Scripts\python.exe -m ruff check .     # clean
npm.cmd test                                   # 42 passed
npm.cmd run typecheck                          # clean
npm.cmd run lint                               # clean
npm.cmd run build                              # compiles
```

## Notes on behavior verified against the implementation

- Test SQLite enforces foreign keys; profiles must exist before rows referencing
  `profiles.id`. SQLite test DB uses `Base.metadata.create_all`, so model-declared constraints
  still apply. The migration-only constraints `valid_claim_state` and
  `unique_fix_contributor_attribution_version` are PostgreSQL/checks via Alembic only.
- `ReputationEvent`/`RewardLedger` reference-id columns are UUID-typed; idempotency keys are
  plain colon-delimited strings and are not UUIDs.
- `build_user_evidence_block` sanitizes injected `</USER_EVIDENCE_DATA>` closers to
  `[TAG_FILTERED]`; `build_grounded_context_block` reads the `content` key and wraps facts in
  `<GROUNDED_TECHNICAL_FACTS>`.
- `check_duplicate_fix` scans only `Fix` rows (not `Contribution` rows); duplicate/paraphrase
  tests create a matching fix row and run engine-level deterministic checks under `AI_PROVIDER=mock`.
- `FixRanker(min_sample)`/`calculate_success_metrics` return `(None, "Not enough verified
  outcomes yet")` below the sample and `{int(rate*100)}% verified success across {sample}
  outcomes` otherwise.

## Limits and production blockers (not counted in the 25-item local gate)

- LIVE_AI_TEST=BLOCKED_NO_API_KEY: no live AI quality evidence; mock/deterministic baseline only.
- BLOCKED_NO_LOCAL_RUNTIME: native PostgreSQL/pgvector execution, native RLS smoke, and the
  web3_storage trigger paths remain unverified without Docker.
- Supabase production configuration (project, storage bucket, auth JWT/JWKS, RLS) is not
  performed here. Local deterministic tests and the frontend demo do not need it.
- Admin acceptance grants a claimable `accepted_fix` reward; payout/claim settlement requires
  `web3_claim_enabled=True` and a trusted verifier in production.

## Next recommendation

Close Phase 4.5 locally: gate passed. Then, before production enablement, run the Supabase
production checklist below; add an API key only for a separate, explicitly enabled live
evaluation. Keep Phase 5 Web3 deferred unless claim payout is explicitly scoped.

## Supabase production checklist

Extends the [README future Supabase migration](README.md#future-supabase-migration) steps.

1. Create a Supabase project.
2. Apply existing Alembic migrations to its PostgreSQL database, including
   `20260918_phase45_web3_readiness` (wallet_links, claim_reservations, idempotency columns).
3. Confirm PostgreSQL-only constraints were created on real PG:
   `valid_claim_state` and `unique_fix_contributor_attribution_version`.
4. Enable/verify pgvector (1536 embeddings) and run the native retrieval smoke test
   (`python -m app.scripts.smoke_retrieval --require-postgres`).
5. Configure the private evidence storage bucket with owner-scoped access and signed URLs.
6. Configure Supabase Auth and the backend JWT issuer/JWKS values; keep
   `deps.get_current_user` keyed on the Supabase subject UUID.
7. Add RLS policies on `claim_reservations`: owner-only select/update/delete; scoped grants
   for the service role during Signed/Confirm webhooks.
8. Set environment: `web3_claim_enabled=false` (or true only with a real verifier),
   `MIN_SUCCESS_RATE_SAMPLE=5`, `AI_PROVIDER=openai` with a key for live evaluation only,
   explicit CORS origins, and backend/storage secrets in Supabase.
9. Test admin accept/reject under live auth: creator-only attribution creation, atomic
   fix + attribution + reward + reputation, and the frozen-review state (`409 REVIEW_STARTED`).
10. Verify owner isolation end to end: evidence endpoints, rewards history/summary, and
    claim reservation cross-user rejection all return 404 for non-owners.