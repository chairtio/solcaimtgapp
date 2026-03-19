## Supabase Wallet Leak Hardening Checklist

### 1) Immediately rotate secrets (do this first)
1. Rotate `SUPABASE_SERVICE_ROLE_KEY`.
2. Rotate Telegram `TELEGRAM_BOT_TOKEN`.
3. Invalidate/rotate any other secrets that could have enabled service-role access (e.g. if you run server containers/CI with cached env vars).

Notes:
- The goal is to ensure that even if an attacker obtained any previous secret material, they cannot keep calling privileged Supabase code.

### 2) Confirm `encrypted_private_key` is never selectable/exfiltratable
1. Verify your admin endpoints (and any internal APIs) do **not** select/return `wallets.encrypted_private_key`.
2. Add an additional safety layer in the DB:
   - Prefer storing `encrypted_private_key` in a separate table/view that is only readable by server-side code.
   - Or create a `wallets_public` view that omits `encrypted_private_key` and ensure non-admin queries use that view.
3. Audit code for any remaining `select(...encrypted_private_key...)` or CSV/JSON exports that include it.

### 3) Ensure RLS is truly enforced for user operations
1. Confirm RLS is enabled on `wallets` and on any tables that contain wallet metadata:
   - `ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;`
2. Verify you have policies that scope by *validated* identity only (for example `request.jwt.claims.telegram_id`).
3. Confirm you are not unintentionally bypassing RLS in user-facing code paths.
4. Add negative tests:
   - Given user A, attempt to query wallet rows for user B using the *user auth path* and verify it returns `0` rows.

### 4) Ensure you never use the Supabase service role from the browser
1. Make sure `supabaseAdmin` (service role) is only created/used on the server.
2. Avoid importing server-only modules into client components.
3. Where possible:
   - Use Next.js Server Actions or route handlers (`app/api/.../route.ts`) for any service-role usage.
4. Add a build-time guard:
   - Confirm the service role key is not present in client bundles (search the built output).

### 5) Validate Telegram initData and bind it to internal Supabase identity
1. Validate `window.Telegram.WebApp.initData` server-side using HMAC with `TELEGRAM_BOT_TOKEN`.
2. Map Telegram user -> internal `users.id` on the server.
3. Do not trust client-provided `userId` for any wallet read/write.
4. Ensure all wallet operations verify that the `publicKey` belongs to the derived internal user.

### 6) Database permissions and views
1. Ensure your anon/user roles cannot bypass RLS via elevated privileges.
2. If you use Postgres SECURITY DEFINER functions, ensure:
   - they still enforce user scoping internally (never “return all”)
   - they do not accept attacker-controlled filters without strict validation

### 7) Operational monitoring
1. Enable/query audit logs for:
   - reads of `wallets` (especially by privileged roles)
   - any admin/export routes
2. Add alerting for unusual access patterns (e.g. high-rate exports, repeated 403/500 spikes).

### 8) Data recovery posture
If you believe `encrypted_private_key` might have been exposed:
1. Treat it as compromised.
2. Rotate/re-encrypt where applicable (depends on your encryption key scheme in `src/lib/crypto.ts`).
3. Consider a “key rotation” migration plan and re-provision wallets if you can’t guarantee keys remain safe.

