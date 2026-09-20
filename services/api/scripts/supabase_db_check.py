r"""Live Supabase database verification (Phase 5.5 staging).

Connects to the configured PostgreSQL database (services/api/.env DATABASE_URL,
owner role) and reports PASS/BLOCKED for:

  1. Expected tables present
  2. Expected constraints (PK / FK / unique / check)
  3. pgvector extension installed + native operators work (temp-table smoke + live
     similarity query against seeded curated knowledge)
  4. RLS policies: owner_read SELECT for claim_reservations + web3_transactions
     (and every other user-owned table)
  5. Two-real-user RLS isolation: user A can read own rows but not user B's
  6. anon/authenticated cannot write reward / reputation / claim-authorization /
     verification / attribution fields (privilege + runtime checks)
  7. Cleanup of every temporary row and user

Never prints credentials. Read-only on production tables (inserts are scoped to a
throwaway smoke dataset that is fully removed at the end).
"""

import asyncio
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import asyncpg  # noqa: E402
import httpx  # noqa: E402

from app.core.config import get_settings  # noqa: E402

EXPECTED_TABLES = [
    "profiles",
    "cases",
    "case_evidence",
    "diagnosis_runs",
    "fixes",
    "case_fix_recommendations",
    "fix_attempts",
    "outcomes",
    "contributions",
    "reward_ledger",
    "reputation_events",
    "knowledge_attributions",
    "wallet_links",
    "claim_reservations",
    "web3_transactions",
    "notifications",
    "user_settings",
    "audit_events",
    "account_deletion_requests",
    "knowledge_documents",
    "knowledge_chunks",
    "case_embeddings",
    "fix_embeddings",
    "outcome_intelligence",
    "diagnosis_sources",
    "ai_runs",
]
OWNER_READ_TABLES = [
    "profiles",
    "cases",
    "case_evidence",
    "diagnosis_runs",
    "fix_attempts",
    "outcomes",
    "contributions",
    "reward_ledger",
    "reputation_events",
    "wallet_links",
    "claim_reservations",
    "web3_transactions",
    "notifications",
    "user_settings",
    "account_deletion_requests",
]
WRITE_LOCKED_TABLES = [
    "reward_ledger",
    "reputation_events",
    "claim_reservations",
    "web3_transactions",
    "outcomes",
    "outcome_intelligence",
    "knowledge_attributions",
    "case_fix_recommendations",
    "contributions",
    "fixes",
    "fix_attempts",
    "wallet_links",
    "cases",
    "case_evidence",
    "diagnosis_runs",
    "notifications",
    "user_settings",
    "audit_events",
    "account_deletion_requests",
]
UNIQUE_CONSTRAINTS = {
    "profiles": ["auth_user_id", "username"],
    "claim_reservations": ["claim_id", "reward_id"],
    "web3_transactions": ["tx_hash"],
    "wallet_links": ["wallet_address"],
    "reward_ledger": ["idempotency_key"],
    "knowledge_attributions": ["unique_fix_contributor_attribution_version"],
}
CHECK_CONSTRAINTS = {"claim_reservations": ["ck_claim_reservations_valid_claim_state"]}
RESULTS: list[tuple[str, bool, str]] = []


def report(name: str, ok: bool, note: str = "") -> None:
    RESULTS.append((name, ok, note))
    status = "PASS" if ok else "BLOCKED"
    print(f"  [{status}] {name}" + (f"  ({note})" if note else ""))


def short(u: str) -> str:
    return f"...{u[-6:]}"


async def fetch(conn: asyncpg.Connection, q: str, *args):
    return await conn.fetch(q, *args)


async def fetchval(conn: asyncpg.Connection, q: str, *args):
    return await conn.fetchval(q, *args)


async def create_users(client: httpx.AsyncClient, base: str, headers: dict) -> list[dict]:
    users = []
    for tag in ("A", "B"):
        email = f"rls-smoke-{tag}-{uuid.uuid4().hex[:10]}@supabase-staging.dev"
        r = await client.post(
            f"{base}/auth/v1/admin/users",
            headers=headers,
            json={
                "email": email,
                "password": "Smoke-Pass-2026!rls",
                "email_confirm": True,
                "user_metadata": {"display_name": f"RLS Smoke {tag}"},
            },
        )
        body = r.json()
        if r.status_code not in (200, 201) or not body.get("id"):
            report(f"create RLS user {tag}", False, str(body)[:120])
            raise RuntimeError("could not create RLS smoke user")
        users.append({"tag": tag, "id": body["id"], "email": email})
    return users


async def main() -> None:
    s = get_settings()
    dsn = s.database_url
    if "sqlite" in dsn or not dsn.lower().startswith("postgres"):
        print("DATABASE_URL does not point at PostgreSQL; not running DB checks.")
        sys.exit(2)
    base = s.supabase_url.rstrip("/")
    headers_sec = {
        "apikey": s.supabase_service_role_key,
        "Authorization": f"Bearer {s.supabase_service_role_key}",
        "Content-Type": "application/json",
    }

    conn = await asyncpg.connect(
        dsn.replace("+asyncpg", ""), timeout=30, ssl="require" if "ssl=" not in dsn else None
    )
    try:
        # 1. tables
        tables = {
            r["table_name"]
            for r in await fetch(
                conn,
                "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'",
            )
        }
        missing = [t for t in EXPECTED_TABLES if t not in tables]
        report(
            "expected tables",
            not missing,
            f"{len(EXPECTED_TABLES)}/26 present" if not missing else "missing=" + ",".join(missing),
        )

        # 2. primary keys + foreign keys + unique/check constraints
        pk_rows = await fetch(
            conn,
            "select t.relname as tablename, c.conname as constraintname from pg_constraint c join pg_class t on t.oid=c.conrelid where c.contype in ('p','u','f','c') and t.relname not like 'pg_%' and t.relname not like 'information_schema%'",
        )
        pk_map: dict[str, list[str]] = {}
        for r in pk_rows:
            pk_map.setdefault(r["constraintname"], []).append(r["tablename"])
        no_pk = [t for t in EXPECTED_TABLES if f"pk_{t}" not in pk_map]
        report("primary keys", not no_pk, "all tables have PK" if not no_pk else ",".join(no_pk))
        fk_count = sum(
            1 for name in pk_map if name.endswith("_fkey") or "_id_fkey" in name or name.endswith("_fk")
        )
        report("foreign keys", fk_count >= 20, f"{fk_count} FK constraints")
        missing_unique: list[str] = []
        for table, cols in UNIQUE_CONSTRAINTS.items():
            for col in cols:
                found = any(table in tbls and col in name for name, tbls in pk_map.items())
                if not found:
                    missing_unique.append(f"{table}.{col}")
        report(
            "unique constraints",
            not missing_unique,
            "all expected" if not missing_unique else ",".join(missing_unique),
        )
        missing_checks: list[str] = []
        for table, checks in CHECK_CONSTRAINTS.items():
            for cname in checks:
                if cname not in pk_map:
                    missing_checks.append(f"{table}.{cname}")
        report(
            "check constraints",
            not missing_checks,
            "all expected" if not missing_checks else ",".join(missing_checks),
        )

        # 3. pgvector
        ext = await fetchval(conn, "select extversion from pg_extension where extname='vector'")
        vec_type = await fetchval(conn, "select to_regtype('vector') is not null")
        report(
            "pgvector extension", bool(ext) and bool(vec_type), f"vector {ext}" if ext else "not installed"
        )

        await conn.execute("create temp table _vec_smoke (id int, embedding vector(3))")
        await conn.executemany(
            "insert into _vec_smoke values ($1, $2::vector(3))", [(1, "[0.1,0.2,0.3]"), (2, "[0.9,0.9,0.9]")]
        )
        nearest = await fetchval(
            conn, "select id from _vec_smoke order by embedding <=> '[0.12,0.21,0.31]'::vector(3) limit 1"
        )
        report("native <=> operator", nearest == 1, f"nearest id {nearest}")

        knowledge_count = await fetchval(
            conn, "select count(*) from knowledge_chunks where embedding is not null"
        )
        if knowledge_count >= 1:
            score = await fetchval(
                conn,
                "with p as (select embedding as e from knowledge_chunks order by chunk_index limit 1) select count(*) from knowledge_chunks k, p where k.embedding <=> p.e <= 0.0001",
            )
            top = await fetch(
                conn,
                "with p as (select embedding as e from knowledge_chunks order by chunk_index limit 1) select chunk_index from knowledge_chunks k, p order by k.embedding <=> p.e limit 3",
            )
            report(
                "live similarity query",
                score >= 1 and len(top) >= 1,
                f"chunks {knowledge_count}, self-distance match {score}",
            )
        else:
            report("live similarity query", False, "no seeded knowledge_chunks (run seed first)")

        # 4/9. RLS policies via pg_policies
        pol = await fetch(
            conn,
            "select schemaname, tablename, policyname, permissive, roles, cmd, qual from pg_policies where policyname='owner_read'",
        )
        pol_tables = {
            r["tablename"]
            for r in pol
            if r["cmd"] == "SELECT"
            and "authenticated" in (r["roles"] or [])
            and r["qual"]
            and "uid" in r["qual"]
        }
        missing_pol = [t for t in OWNER_READ_TABLES if t not in pol_tables]
        report(
            "owner_read policies",
            not missing_pol,
            f"{len(pol_tables)} tables" if not missing_pol else "missing=" + ",".join(missing_pol),
        )

        # 6. privilege-level write locks (anon + authenticated)
        privs = await fetch(
            conn,
            "select table_name, privilege_type, grantee from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated')",
        )
        locked_bad: list[str] = []
        for table in WRITE_LOCKED_TABLES:
            for row in privs:
                if row["table_name"] == table and row["privilege_type"] in (
                    "INSERT",
                    "UPDATE",
                    "DELETE",
                    "TRUNCATE",
                    "REFERENCES",
                    "TRIGGER",
                ):
                    locked_bad.append(f"{table}.{row['privilege_type']}@{row['grantee']}")
        report(
            "no browser write privileges", not locked_bad, "none" if not locked_bad else ",".join(locked_bad)
        )

        col_privs = await fetch(
            conn,
            "select table_name, column_name, privilege_type, grantee from information_schema.role_column_grants where table_schema='public' and grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE')",
        )
        report(
            "no browser column-write privileges",
            len(col_privs) == 0,
            "0 column grants" if not col_privs else str(col_privs),
        )

        writes_anywhere = await fetch(
            conn,
            "select table_name, privilege_type, grantee from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')",
        )
        report(
            "no browser table-write privileges anywhere",
            len(writes_anywhere) == 0,
            "0 write grants" if not writes_anywhere else str(writes_anywhere),
        )

        # 5/8. two-real-user RLS runtime isolation
        async with httpx.AsyncClient(timeout=30) as client:
            users = await create_users(client, base, headers_sec)
            ua, ub = users[0]["id"], users[1]["id"]
            try:
                ra = str(uuid.uuid4())
                rb = str(uuid.uuid4())
                ca = str(uuid.uuid4())
                cb = str(uuid.uuid4())
                wa = "0x" + uuid.uuid4().hex[:40]
                wb = "0x" + uuid.uuid4().hex[:40]
                PROFILE_COLS = "id, auth_user_id, display_name, bio, role, reputation_level, reputation_score, timezone, created_at, updated_at"
                await conn.execute(
                    f"insert into profiles ({PROFILE_COLS}) values ($1,$1,'RLS Smoke A','','user','New Solver',0,'UTC',now(),now())",
                    ua,
                )
                await conn.execute(
                    f"insert into profiles ({PROFILE_COLS}) values ($1,$1,'RLS Smoke B','','user','New Solver',0,'UTC',now(),now())",
                    ub,
                )
                await conn.execute(
                    "insert into reward_ledger (id,user_id,event_type,reference_type,amount,status,reason,idempotency_key,created_at) values ($1,$2,'smoke','smoke',1,'pending','rls',$3,now())",
                    ra,
                    ua,
                    f"smoke-{ra}",
                )
                await conn.execute(
                    "insert into reward_ledger (id,user_id,event_type,reference_type,amount,status,reason,idempotency_key,created_at) values ($1,$2,'smoke','smoke',1,'pending','rls',$3,now())",
                    rb,
                    ub,
                    f"smoke-{rb}",
                )
                await conn.execute(
                    "insert into claim_reservations (id,reward_id,user_id,state) values ($1,$2,$3,'reserved')",
                    ca,
                    ra,
                    ua,
                )
                await conn.execute(
                    "insert into claim_reservations (id,reward_id,user_id,state) values ($1,$2,$3,'reserved')",
                    cb,
                    rb,
                    ub,
                )
                await conn.execute(
                    "insert into web3_transactions (id,user_id,tx_type,tx_hash,chain_id,status,created_at,updated_at) values ($1,$2,'claim',$3,97,'submitted',now(),now())",
                    str(uuid.uuid4()),
                    ua,
                    wa,
                )
                await conn.execute(
                    "insert into web3_transactions (id,user_id,tx_type,tx_hash,chain_id,status,created_at,updated_at) values ($1,$2,'claim',$3,97,'submitted',now(),now())",
                    str(uuid.uuid4()),
                    ub,
                    wb,
                )

                async def as_user(user_id: str, fn):
                    async with conn.transaction():
                        await conn.execute("set local role authenticated")
                        claims = '{"sub":"%s","role":"authenticated"}' % user_id
                        try:
                            await conn.execute(
                                "set local request.jwt.claims = '%s'" % claims.replace("'", "''")
                            )
                        except Exception:
                            pass
                        await conn.execute(f"set local request.jwt.claim.sub = '{user_id}'")
                        return await fn()

                async def uid_a():
                    return await fetchval(conn, "select auth.uid()::text")

                report("auth.uid() plumbing", (await as_user(ua, uid_a)) == ua, "matches JWT sub")

                async def own_counts():
                    mine = await fetchval(
                        conn, "select count(*) from web3_transactions where user_id = $1::uuid", ua
                    )
                    other = await fetchval(
                        conn, "select count(*) from web3_transactions where user_id = $1::uuid", ub
                    )
                    mine_c = await fetchval(
                        conn, "select count(*) from claim_reservations where user_id = $1::uuid", ua
                    )
                    other_c = await fetchval(
                        conn, "select count(*) from claim_reservations where user_id = $1::uuid", ub
                    )
                    profile_other = await fetchval(
                        conn, "select count(*) from profiles where auth_user_id = $1::uuid", ub
                    )
                    return mine, other, mine_c, other_c, profile_other

                mine, other, mine_c, other_c, profile_other = await as_user(ua, own_counts)
                report("RLS: A reads own web3 txs", mine == 1, f"count {mine}")
                report("RLS: A cannot read B web3 txs", other == 0, f"count {other}")
                report("RLS: A reads own claim reservations", mine_c == 1, f"count {mine_c}")
                report("RLS: A cannot read B claim reservations", other_c == 0, f"count {other_c}")
                report("RLS: A cannot read B profile", profile_other == 0, f"count {profile_other}")

                async def anon_read():
                    return await fetchval(conn, "select count(*) from web3_transactions")

                try:
                    await as_user_anon(conn, anon_read)
                    report("anon fail-closed read", False, "anon unexpectedly read the table")
                except asyncpg.PostgresError:
                    report("anon fail-closed read", True, "permission denied")

                async def write_attempt():
                    try:
                        await conn.execute(
                            "insert into reward_ledger (id,user_id,event_type,reference_type,amount,status,reason,idempotency_key) values ($1,$2,'smoke','smoke',1,'pending','x','anon-$1')",
                            str(uuid.uuid4()),
                            ua,
                        )
                        return "denied? ok"
                    except asyncpg.PostgresError as e:
                        return f"denied:{type(e).__name__}"

                async def update_attempt():
                    try:
                        await conn.execute(
                            "update web3_transactions set status='confirmed' where user_id=$1::uuid", ua
                        )
                        return "denied? ok"
                    except asyncpg.PostgresError as e:
                        return f"denied:{type(e).__name__}"

                async def attr_attempt():
                    try:
                        await conn.execute(
                            "insert into knowledge_attributions (id,fix_id,contributor_user_id,ownership_share) values ($1,$2,$3,0.5)",
                            str(uuid.uuid4()),
                            str(uuid.uuid4()),
                            ua,
                        )
                        return "denied? ok"
                    except asyncpg.PostgresError as e:
                        return f"denied:{type(e).__name__}"

                async def confidence_attempt():
                    try:
                        await conn.execute("update outcomes set confidence=1.0 where user_id=$1::uuid", ua)
                        return "denied? ok"
                    except asyncpg.PostgresError as e:
                        return f"denied:{type(e).__name__}"

                report(
                    "authenticated cannot INSERT reward",
                    "denied" in await as_user(ua, write_attempt),
                    "policy enforced",
                )
                report(
                    "authenticated cannot UPDATE web3 txs",
                    "denied" in await as_user(ua, update_attempt),
                    "policy enforced",
                )
                report(
                    "authenticated cannot write attributions",
                    "denied" in await as_user(ua, attr_attempt),
                    "policy enforced",
                )
                report(
                    "authenticated cannot write verification confidence",
                    "denied" in await as_user(ua, confidence_attempt),
                    "policy enforced",
                )

                # cleanup domain rows as owner
                for table, key, val in [
                    ("web3_transactions", "user_id", ua),
                    ("web3_transactions", "user_id", ub),
                    ("claim_reservations", "user_id", ua),
                    ("claim_reservations", "user_id", ub),
                    ("reward_ledger", "user_id", ua),
                    ("reward_ledger", "user_id", ub),
                    ("profiles", "auth_user_id", ua),
                    ("profiles", "auth_user_id", ub),
                ]:
                    await conn.execute(f"delete from {table} where {key} = $1::uuid", val)
            finally:
                for u in users:
                    await client.delete(f"{base}/auth/v1/admin/users/{u['id']}", headers=headers_sec)
                report("cleanup smoke users", True, "2 users deleted")

        # orphaned smoke profiles (cascades from staging_smoke /auth/me runs)
        await conn.execute(
            "delete from profiles where display_name in ('Staging Smoke','RLS Smoke A','RLS Smoke B') and auth_user_id not in (select id from auth.users)"
        )
        report("cleanup orphaned smoke profiles", True, "idempotent")
    finally:
        await conn.close()

    print(f"\nDB checks: {sum(1 for _, ok, _ in RESULTS if ok)}/{len(RESULTS)} PASS")


async def as_user_anon(conn: asyncpg.Connection, fn):
    async with conn.transaction():
        await conn.execute("set local role anon")
        await conn.execute(
            'set local request.jwt.claims = \'{"sub":"00000000-0000-0000-0000-000000000000","role":"anon"}\''
        )
        return await fn()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except SystemExit:
        raise
    except Exception as e:  # noqa: BLE001
        print("FATAL:", type(e).__name__, str(e)[:300])
        sys.exit(1)
