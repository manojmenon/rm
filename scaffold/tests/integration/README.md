# Integration tests

Smoke and integration tests that require running services.

## Smoke test (from repo root)

```bash
# Start stack first (Docker Compose or local backend + frontend)
make docker-up
# or: make run-backend-dev (terminal 1) + make run-frontend (terminal 2)

# Then run smoke test
make smoke-test
```

This checks:

- Backend: `GET /api/health` returns `{"status":"ok","db":"ok"}`
- Frontend: `GET http://localhost:3000/` returns 200

## Manual integration

1. Start the full stack (`make docker-up` or run backend + frontend + Postgres).
2. Open http://localhost:3000, log in (e.g. superadmin@example.com / admin123).
3. Exercise products, roadmap, notifications, admin pages.
4. Optionally run `make smoke-test` after changes.

## Optional: API integration tests

You can add scripts (e.g. shell or Go) in this directory that call the API (login, list products, etc.) and assert on responses. Run them with the stack up.
