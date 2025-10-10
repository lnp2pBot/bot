# Repository Guidelines

## Project Structure & Module Organization
- `app.ts` bootstraps the Telegram bot and Mongo connection; keep startup logic centralized there.
- `bot/` houses commands, scenes, and middleware modules; pair new flows with text updates under `locales/`.
- Background jobs, data models, and shared helpers live in `jobs/`, `models/`, and `util/`; assets and docs sit in `images/` and `docs/`.
- TypeScript builds to `dist/` (read-only); specs mirror runtime code under `tests/` for quick navigation.

## Build, Test, and Development Commands
- `npm install` refreshes dependencies after changes to `package*.json`.
- `npm run dev` runs the `predev` TypeScript build then watches `dist/app` with nodemon.
- `npm start` executes the production path (`prestart` → `tsc`) and launches the compiled bot.
- Quality gates: `npm run lint`, `npm run format`, and `npm test` (Mocha via `tsconfig.test.json`).

## Coding Style & Naming Conventions
- Prettier enforces 2-space indentation, semicolons, and single quotes; run it before committing.
- ESLint Standard plus TypeScript rules guard the codebase; address warnings instead of disabling them.
- Use camelCase for functions/variables, PascalCase for classes, and descriptive locale keys (`locales/*.json`).

## Testing Guidelines
- Write Mocha + Chai specs in `tests/**`, suffixing files with `.spec.ts` and mirroring source layout.
- Prefer unit isolation with proxyquire/sinon; integration flows belong in `tests/ln/`.
- Ensure `npm test` passes and add fixtures in `tests/bot/mocks/` when altering localization or jobs.

## Commit & Pull Request Guidelines
- Commit summaries stay concise sentence case, optionally referencing PRs or issues (`Late payment flow (#705)`).
- Keep changes scoped; split schema or config adjustments into dedicated commits.
- PRs require behaviour notes, linked issues, and proof of lint/test runs (screenshots for user-facing traces).

## Environment & Configuration
- Copy `.env-sample` to `.env`; never commit actual credentials and document new variables in PRs.
- Use `Dockerfile` and `DEPLOY_DIGITALOCEAN.md` when rehearsing deployment; confirm `npm start` succeeds inside the image.
- Scrub secrets and Telegram transcripts before sharing logs or support artifacts in the repository.
