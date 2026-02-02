# Backend tests

Go tests for the backend (`backend/cmd/server`, `backend/internal/*`).

## Run from repo root

```bash
# All packages
make test-backend
# or: cd app/backend && go test ./...

# With coverage
cd backend && go test -cover ./...

# Verbose
cd app/backend && go test -v ./...

# Single package (e.g. internal/logger)
cd app/backend && go test ./internal/logger/...
```

Tests are co-located with code as `*_test.go` in `backend/internal/`. This directory can hold shared test helpers or integration test scripts that need a running DB.

## Adding unit tests

Create `app/backend/internal/<package>/<name>_test.go` and run `cd app/backend && go test ./internal/<package>/...` to run only that package.
