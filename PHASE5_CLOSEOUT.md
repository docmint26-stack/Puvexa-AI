# Phase 5 closeout report — Web3 reward economy frontend

Date: 2026-09-20. **Status: local engineering gate is fully green, including a real local
Anvil end-to-end run (32/32 checks PASS).** Production remains conditioned on the external
blockers listed below (no live Supabase project, no trusted wallet-signature verifier, full
browser MetaMask click-through not yet driven). Mainnet is refused at runtime.

LIVE_AI_TEST=BLOCKED_NO_API_KEY

Phase 5 adds the production Web3 layer that Phase 4.5 deferred: wagmi/viem wallet connect +
ownership verification on the frontend, real claim/stake dialogs over the backend `/api/v1/web3/*`
API, `OnChainHistory` rendering of claim reservations and settlement transactions, and local
Solidity contracts tested with Foundry. Demo mode (`NEXT_PUBLIC_DEMO_MODE=true`) stays fully
isolated: it never calls the chain layer, never fakes "Claim successful", and signs nothing.

## GO/NO-GO gate (local verification)

| # | Gate item | Verification evidence | Verdict |
| --- | --- | --- | --- |
| 1 | Frontend typecheck clean | `tsc --noEmit` passes (`contracts` excluded — vendored Foundry tooling, not app code) | **GO** |
| 2 | Frontend lint clean | `eslint` exits 0; vendored `contracts/**` ignored in `eslint.config.mjs` | **GO** |
| 3 | Frontend tests green | `vitest run`: **87 passed** across 10 files (42 baseline + 45 new web3 tests) | **GO** |
| 4 | Production build | `next build` (Turbopack) compiles, 19 routes | **GO** |
| 5 | Backend suite green | `pytest -q`: **271 passed** (incl. full request-signature settlement flow) | **GO** |
| 6 | Backend lint clean | `ruff check .` clean | **GO** |
| 7 | Smart contracts green | `forge test`: **40 passed** across 4 suites (token, distributor, registry, stake vault) | **GO** |
| 8 | Web3 config refuses mainnet | chain ids {1,56,137,42161,10,8453,43114,81457,59144,534352} throw at load | **GO** |
| 9 | Demo mode is isolated | config forces `mode: demo, enabled: false`; `useWeb3Identity().demo` gates every wallet/claim/stake dialog; demo wallet service exposes no `requestChallenge`/`verifyOwnership` | **GO** |
| 10 | No fake successes | flows reach `confirmed`/`locked` only after wallet receipt + backend confirmation; failures surface `correct` error codes; no simulated success path in production | **GO** |
| 11 | No seed/private-key access | UI copy states so explicitly; only wallet *signature* is requested | **GO** |
| 12 | Component → service layering | components call `src/lib/hooks/web3.ts` / `useWallet()`; chain actions live in `src/lib/web3/actions.ts`; REST state only via `src/lib/api/web3.ts` | **GO** |
| 13 | Stake copy honesty | rewards + stake dialog describe accountability ("no yield is paid"); yield/APR copy removed in this phase | **GO** |
| 14 | Claim amount honesty | production claimable list built from ledger history `status == "unlocked"` with an `id`; dialog explains Puvexa signs exactly the authorized amount | **GO** |
| 15 | Local Anvil E2E green | `services/api/scripts/e2e_web3.py`: fresh anvil + `Deploy.s.sol` deploy + in-process backend (`web3_claim_enabled=true`) + real signed txs — **32 passed, 0 failed** (see below) | **GO** |
| 16 | Stake approval is exact-amount | `StakeFlowDeps.approve(spender, amount, tokenAddress)`; dialog text and flows tests assert a `5 FIX` stake approves exactly `5 FIX` (no unlimited allowance) | **GO** |

## What shipped

### Contracts (`contracts/`, Foundry + Solidity)
- `src/PuvexaFIXAI.sol` — ERC-20 FIX token with 18 decimals.
- `src/ContributionRegistry.sol` — contribution lifecycle + settlement authority.
- `src/ContributionStakeVault.sol` — accountability stakes: lock on stake, release on verify,
  slash on reversal, partial slash splitting.
- `src/RewardDistributor.sol` — EIP-712 claim signatures with deadline + user-chain binding.
- `test/*.t.sol` — 40 tests incl. settlement exactly-once fuzzing and double-release/slash reverts.
- `script/Deploy.s.sol` — one-shot full deploy (token→registry→vault→distributor, funds
  distributor, env overrides `PUVEXA_*`, writes `deployments/local.json` with all addresses).

### Frontend Web3 layer (`src/lib/web3/*`, `src/components/web3/*`)
- `config.ts` — env-driven config; demo/testnet/local modes; `isDemoMode()`; mainnet rejection;
  `networkIdentity()` trust labels (LOCAL / TESTNET / DEMO); explorer URL helpers.
- `client.ts` — wagmi config with safe fallbacks (chain 31337, local RPC) + SSR-safe storage.
- `actions.ts` — connect, disconnect, `reconnectWallets`, signing, balance/allowance reads,
  approve, claim/stake submission, receipt waiting, chain switching, error mapping.
- `mappers.ts` — `mapClaimReservation`, `mapWalletChallenge`, `mapWeb3Transaction`,
  `mapWeb3Status`, wei/bigint helpers, `contributionIdBytes32`.
- `flows.ts` — testable state machines: `runClaimFlow` (prepare→sign→submit→receipt→confirm,
  deadline-expiry guard), `runStakeFlow` (allowance check→**exact-amount** approval-if-needed→
  stake→confirm), `runWalletVerificationFlow` (challenge→sign→verify). Stake approvals pass the
  exact stake amount (`approve(spender, amount, tokenAddress)` → `approveTokens`, no
  `approveUnlimited`) — asserted in `flows.test.ts`.
- `src/lib/state/wallet.ts` — zustand wallet store (connected/verified/wrong-network/error +
  `resolveError`) shared by UI.
- `src/lib/hooks/web3.ts` — `useWeb3Identity`, `useWeb3Status`, `useWalletBalance`,
  `useWalletAllowance`, `useWeb3History`, `useWalletVerification`, `useClaimFlow`, `useStakeFlow`.
- Components — `web3-provider` (wagmi + react-query, mounted in root layout),
  `wallet-panel`/`network-badge` (app bar), `claim-flow-dialog`, `stake-dialog`,
  `onchain-history`.
- `rewards-content.tsx` — off-chain/on-chain split; production claim list sourced from ledger
  history (`unlocked` + `id`); accountability staking card (no yield copy); demo keeps its
  simulated dialogs behind `demo`.
- `contribute-content.tsx` — production flow now creates the contribution, then opens
  `StakeDialog` for the on-chain accountability stake (`onLocked` drives the success notice).
- `eslint.config.mjs` — vendored `contracts/**` added to ignores; `services/**` already ignored.
- `tsconfig.json` — `contracts` excluded from app typecheck (Foundry lib is not Next app code).

### Backend (`services/api`, Phase 5 economy)
- `POST /api/v1/wallet/challenge` + `verify` with EIP-191 message
  `"Puvexa wallet verification\nchain-id:{id}\naddress:{addr}\nnonce:{nonce}"` and the
  `wallet_signature_verifier=none` default.
- `POST /api/v1/web3/claims/prepare|confirm`, `POST /api/v1/web3/stakes/confirm`,
  `GET /api/v1/web3/status|token|claims|transactions`.
- Settlement routes `POST /api/v1/web3/stakes/{id}/release|slash` (+ `Web3StakeSettleCreate`)
  over `confirm_stake_settlement` release/slash event decode.
- `EIP191SignatureVerifier`; migrations `20260918_phase5_web3_economy.py`.
- `scripts/e2e_web3.py` — local Anvil E2E harness: boots `anvil` (chain 31337), deploys via
  `Deploy.s.sol`, runs the backend in-process with `WEB3_CLAIM_ENABLED=true`, and drives the full
  economy with real accounts/signatures (details below).

## End-to-end (local Anvil) — 32/32 PASS

`services/api/scripts/e2e_web3.py` (run from `services/api` with `.\.venv\Scripts\python.exe`):

1. Spawns a fresh `anvil` node; waits for RPC; deploys all contracts through
   `contracts/script/Deploy.s.sol` (`DEPLOYER` = anvil account 1, `REWARD_SIGNER` = account 2)
   and writes `contracts/deployments/local.json`.
2. Boots the FastAPI app in-process on a fresh SQLite DB with `get_identity` overridden (no
   Supabase project needed); seeds dev data from `app.scripts.seed_dev`.
3. Exercises: wallet challenge→EIP-191 sign→verify (message-contract asserted); claim
   prepare (signed EIP-712) → real `RewardDistributor.claim` tx on anvil → confirm (ledger
   `claimed_onchain`, balances +8 FIX, distributor paid); **duplicate prepare → 409**;
   treasury funds wallet; stake with **exact 5 FIX approval** (on-chain allowance == 5 FIX) →
   lock; admin release → +5 returned, on-chain state RELEASED, vault balance 0; second stake →
   admin slash at 25% → 1.25 slashed / 3.75 returned, on-chain SLASHED, slash vault +1.25;
   royalty grant (1 FIX) → prepare → claim → confirm → no re-prepare; claim + transaction
   history exposed.

Result: `32 passed, 0 failed`. Covers the Phase 5 gate items with real signed transactions on a
running chain; the only remaining manual step is an in-browser MetaMask click-through.

## Tests (all local)

```powershell
# frontend (repo root)
npm.cmd run typecheck     # clean
npm.cmd run lint          # clean
npm.cmd test              # 87 passed (10 files)
npm.cmd run build         # compiles, 19 routes

# backend (services/api, .venv)
.\.venv\Scripts\python.exe -m ruff check .       # clean
.\.venv\Scripts\python.exe -m pytest -q          # 271 passed

# contracts (contracts, forge at C:\Users\PK\.foundry\bin)
& "C:\Users\PK\.foundry\bin\forge.exe" test     # 40 passed

# local Anvil end-to-end (services/api)
& ".\.venv\Scripts\python.exe" scripts/e2e_web3.py   # 32 passed, 0 failed
```

New frontend tests: `src/lib/web3/config.test.ts` (demo/testnet/local modes, mainnet refusal,
address sanitizing), `src/lib/web3/mappers.test.ts`, `src/lib/web3/flows.test.ts` (claim happy
path/expiry/revert, verification, stake approval/skip/revert paths), `src/lib/state/wallet.test.ts`
(state transitions), plus demo/api wallet-separation assertions in `services/factory.test.ts`.
Backend: `tests/test_web3.py` covers challenge/verify, claim prepare/confirm, stake confirm and
release/slash settlement.

## Local Web3 dev (Anvil)

```powershell
# One-command full local E2E (anvil + deploy + backend + signed flows) — easiest
Set-Location services/api
.\.venv\Scripts\python.exe scripts/e2e_web3.py

# Manual alternative, terminal 1: chain + deploy (writes deployments/local.json)
cd contracts
& "C:\Users\PK\.foundry\bin\anvil.exe" --port 8545 --chain-id 31337
& "C:\Users\PK\.foundry\bin\forge.exe" script script/Deploy.s.sol `
  --rpc-url http://127.0.0.1:8545 --broadcast `
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 -vv
#   (anvil account 1 = deployer/treasury/admin; account 2 signs rewards by default)

# 2. .env.local
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_WEB3_ENV=local
NEXT_PUBLIC_WEB3_CHAIN_ID=31337
NEXT_PUBLIC_WEB3_RPC_URL=http://127.0.0.1:8545
NEXT_PUBLIC_FIXAI_TOKEN_ADDRESS=<token from local.json>
NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS=<distributor from local.json>
NEXT_PUBLIC_STAKE_VAULT_ADDRESS=<stakeVault from local.json>
NEXT_PUBLIC_CONTRIBUTION_REGISTRY_ADDRESS=<registry from local.json>

# 3. backend (terminal 2) with claim checking on + local verifier
Set-Location services/api
$env:DATABASE_URL = 'sqlite+aiosqlite:///./puvexa.db'
$env:WEB3_CLAIM_ENABLED = 'true'
$env:WALLET_SIGNATURE_VERIFIER = 'eip191'
$env:WEB3_CHAIN_ID = '31337'
$env:WEB3_TESTNET_RPC_URL = 'http://127.0.0.1:8545'
$env:WEB3_TOKEN_ADDRESS = '<token from local.json>'
$env:WEB3_DISTRIBUTOR_ADDRESS = '<distributor from local.json>'
$env:WEB3_STAKE_VAULT_ADDRESS = '<stakeVault from local.json>'
$env:WEB3_REGISTRY_ADDRESS = '<registry from local.json>'
$env:WEB3_REWARD_SIGNER_PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload    # terminal 2

npm.cmd run dev                                               # terminal 3, :3000
```

In MetaMask: import a terminal-1 key, add the `http://127.0.0.1:8545` network (chain id 31337).
Mainnet chain ids are rejected at config load regardless of these envs.

## Limits and production blockers

- **Supabase project not provided** — production API-backed wallet flows are code-complete and
  unit/integration tested, but not exercised against a live project (no project URL/key; SQLite
  locally).
- **No trusted verify verifier** — `wallet_signature_verifier` defaults to `none`, so live
  ownership verification returns honest unavailability until a real verifier (or deployed
  on-chain recovery/EIP-1271 plan) is configured. The frontend surfaces `WALLET_SIGNATURE_UNAVAILABLE`.
- **Anvil automated E2E runs green (32/32), but no in-browser MetaMask click-through yet** — the
  contract + backend paths are verified end-to-end with real signed transactions
  (`scripts/e2e_web3.py`); clicking through Connect → Sign → Claim in MetaMask in a running
  browser against `localhost:3000` is the remaining manual step.
- LIVE_AI_TEST=BLOCKED_NO_API_KEY (unchanged from Phase 4.5).

## Supabase production checklist additions (Phase 5)

1. Apply `20260918_phase5_web3_economy` on the real PostgreSQL/Supabase DB (web3_economy
   state, web3_transactions, claim/stake settlement columns).
2. Set `web3_claim_enabled=true` and a trusted `wallet_signature_verifier`.
3. Store the EIP-712/domain config and contract addresses in the backend web3 settings; mirror
   them to `NEXT_PUBLIC_WEB3_*` on the frontend.
4. Enable RLS on `web3_transactions` (owner-scoped reads; service role for confirm webhooks).
5. Run the release/slash settlement smoke against a real transaction hash on the configured
   testnet before enabling mainnet (which is currently blocked at runtime).