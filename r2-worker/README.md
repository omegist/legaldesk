# Legal Diary R2 Worker

This Worker keeps Vault documents private. The R2 bucket must **not** be exposed through an `r2.dev` public URL or a public custom domain.

## Deploy after rotating the exposed credentials

1. Install Wrangler in this folder: `npm install --save-dev wrangler @cloudflare/workers-types`.
2. Edit `wrangler.jsonc` and replace `https://YOUR-APP-DOMAIN.example` with the deployed frontend URL. Do not use a wildcard origin.
3. Create the bucket once: `npx wrangler r2 bucket create legal-diary-vault --location=apac`.
4. Add the two Worker secrets interactively (never put them in a file or the frontend):
   - `npx wrangler secret put SUPABASE_URL`
   - `npx wrangler secret put SUPABASE_PUBLISHABLE_KEY`
5. Deploy: `npx wrangler deploy`.
6. Put the resulting `https://...workers.dev` URL in the frontend deployment environment as `VITE_R2_WORKER_URL`, then rebuild the frontend.

The Worker authenticates every request using the logged-in Supabase user's bearer token. Each user can read, upload, and delete only files under their own R2 prefix.

## CORS policy

The policy is enforced in the Worker. Its allowed origins are the exact comma-separated `ALLOWED_ORIGINS` values in `wrangler.jsonc`. Replace the placeholder production domain before deployment. It allows only `GET`, `POST`, `DELETE`, and `OPTIONS`, and only the `Authorization`, `Content-Type`, and `X-File-Name` request headers.
