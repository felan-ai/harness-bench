# Storzy benchmark fixture

Storzy is a deterministic Next.js 16 e-commerce demo used by Felan evaluations.

- Routes are `/` (login), `/inventory`, `/cart`, `/checkout`, and
  `/checkout-complete`; API routes live under `/api` and use the in-memory store
  in `lib/api-store.ts`.
- `@/*` resolves from the fixture root.
- Keep credentials and environment-specific values out of the repository.
- Do not replace the package manager or regenerate the lockfile for application
  changes.
- Package commands are `pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm lint`,
  and `pnpm start`.
- The benchmark runtime provides dependencies through the existing
  `node_modules` link. `pnpm build` intentionally uses webpack because Next.js
  Turbopack rejects dependency symlinks outside the workspace root. Do not
  reinstall dependencies unless the task changes them.
