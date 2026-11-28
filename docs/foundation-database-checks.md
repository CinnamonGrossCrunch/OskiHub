# Foundation database checks

These checks are for a disposable local Supabase database or an explicitly
isolated v2 test database. **Do not run against production, v1, or a database
containing real student records.** The script creates synthetic fixtures and
rolls back its transaction, but it intentionally exercises writes and constraints.

Apply both migrations to that isolated database, in order:

1. `supabase/migrations/202611280001_phase1_foundation.sql`
2. `supabase/migrations/202611280002_require_reviewed_rule_guards.sql`

The second migration validates existing deadline rules. If a shift or suppression
rule lacks a meaningful reviewed guard, validation fails and the migration rolls
back. Review those records explicitly; do not manufacture guards or delete rules
just to pass validation. A nonblank expected value or a positive expected revision
is sufficient, and every supplied guard must be valid.

Run the checks with a local Postgres administrator connection that can seed
fixtures and switch to the existing `authenticated` and `anon` roles:

```sh
psql "$FOUNDATION_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/phase1_foundation.sql
```

Keep the connection URL in your environment; do not paste it into the plan,
terminal transcripts, or a commit. The script requires the normal Supabase
`auth.uid()` function and role definitions. It does not create a replacement
authentication system or use a service-role client as the student.

The script:

- seeds synthetic public and separate owner records as the administrator;
- checks guard constraints and same-owner assignment/event relationships;
- switches to `authenticated`, sets synthetic JWT claims separately for both
  owners, and checks visible rows, denied system/public writes, and allowed
  own-override edits;
- rejects cross-owner override references and ownership changes;
- switches to `anon` and checks public visibility/private denial;
- finishes with `ROLLBACK`, retaining neither fixtures nor temporary helpers.

Temporary test helpers use `SECURITY INVOKER`. The only grants supplied by the
script are on its temporary metadata and helper functions. **No privileges on
application tables are granted by the test.** Required reads and own-override
edits must succeed using the database's actual grants and RLS policies. A
permission failure on a required own/public read is a failed check; anonymous
private reads may instead be denied outright.

A successful run prints `phase1 foundation database checks: pass (rolled back)`.
With `ON_ERROR_STOP=1`, any failed assertion exits unsuccessfully; closing that
failed connection rolls back the open transaction. Record the code commit,
applied migration versions, isolated database identity, execution time, and
actual output in the plan log.

## Scope of the evidence

This suite tests ordinary database roles with synthetic JWT claims. It is not a
real Supabase Auth sign-in test and does not prove browser session handling,
personal API caching, deployment bundling, or the complete two-user acceptance
scenario. Those remain separate foundation-gate checks. A local database emulator
may provide useful regression evidence, but its role/grant bootstrap must be
recorded and cannot be reported as a hosted Supabase pass.

Local verification on Nov 28, 2026 used PGlite 0.3.14 in a separate workspace
tool directory; it adds no application dependency. A fresh in-memory database
was bootstrapped with `authenticated` and `anon` roles that have neither
superuser nor `BYPASSRLS`, an `auth.uid()` function reading the synthetic
`request.jwt.claim.sub`, schema/function usage, and default ALL table grants
to those roles. Those synthetic grants exercise the policies; they are not
evidence of the hosted project's actual privileges. Both migrations and the
rollback suite passed, and a post-test query confirmed no fixture courses
remained. On a second fresh database, an existing guardless rule caused the
forward migration to fail with SQLSTATE 23514; rollback retained the original
rule and left no partially installed constraint. The production database and
hosted v2 database were not accessed by these checks.

To inspect existing invalid rules before migration, use an administrator in the
isolated test database:

```sql
select id, version, operation
from public.resolution_rules
where operation in ('shift_days', 'suppress_shift')
  and (
    (expected_value is null and expected_revision is null)
    or (expected_value is not null and expected_value !~ '[^[:space:]]')
    or (expected_revision is not null and expected_revision <= 0)
  );
```

This query omits private rule reasons and source values from diagnostic output.
