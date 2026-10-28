<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## HASi Control Plane
- The backend is self-hosted (Node/Fastify + own PostgreSQL via Docker Compose) and lives in `hasi-api/`; never use Lovable Cloud/Supabase/Firebase — the user requires a self-hosted database.
- The admin panel in `src/` talks to that API only through `src/lib/api.ts` (base URL from VITE_HASI_API_URL or the login-screen setting); keep auth tokens out of SSR because the session lives in the browser.
- `hasi-api/` has its own package.json, tsconfig and tests; it is not part of the Vite build.
