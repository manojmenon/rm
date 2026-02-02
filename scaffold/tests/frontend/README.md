# Frontend tests

Lint and optional unit/e2e tests for the Next.js frontend.

## Run from repo root

```bash
# Lint only (current)
make test-frontend
# or: cd frontend && npm run lint

# If npm test is added (Jest/Vitest):
cd frontend && npm test
```

## Current setup

- **Lint:** ESLint via `npm run lint` (see `frontend/package.json`).
- **Unit/e2e:** Add Jest, Vitest, or Playwright in `app/frontend/` and add a `test` script; then run from here or via `make test-frontend` (extend Makefile to run `npm test`).
