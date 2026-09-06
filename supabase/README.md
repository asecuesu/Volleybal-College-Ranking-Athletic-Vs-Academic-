# Shared research cache for the Sara Volleyball Recruiting Explorer

This backend makes setter-height and international-aid research persistent across all visitors and avoids paying for/re-running the same AI research repeatedly.

## Files

- `migrations/001_school_research_cache.sql` — creates the shared cache table.
- `functions/research-school/index.ts` — cache-first Edge Function.

## Cache behavior

- Setter research stays fresh for 120 days.
- International-aid research stays fresh for 270 days.
- A normal Research click checks the database first. If a fresh row exists, the stored result is returned and the AI research worker is not called.
- A Refresh click explicitly bypasses freshness and researches again.
- The function also supports `{"action":"list"}` so the web app can preload all saved research when it opens.

## Security

The browser never receives a Supabase service-role key. Writes are performed inside the Edge Function using `SUPABASE_SERVICE_ROLE_KEY`. The table permits public reads, while there is no public insert/update/delete policy. CORS is restricted to the published GitHub Pages origin plus local development origins.

## Deployment

1. Apply `migrations/001_school_research_cache.sql` to the Supabase project.
2. Deploy the `research-school` Edge Function.
3. Set the function's `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables (Supabase provides these to deployed functions in normal deployments).
4. Put the deployed function URL into `sara-app/shared-config.js` as `window.SARA_SHARED_RESEARCH_URL`.

Once that URL is set, `sara-app/research-v3.js` automatically switches from per-browser fallback storage to shared cache-first behavior.
