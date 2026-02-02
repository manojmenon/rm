# Environment examples

Copy the needed `.example` files to `.env` (or service-specific paths) and set values.

- **backend.env.example** → Backend and seed (DB, JWT, LOG, OTEL).
- **frontend.env.example** → Frontend (BACKEND_URL, NEXT_PUBLIC_API_URL).
- **database.env.example** → Postgres container or external DB.
- **observability.env.example** → Grafana password and optional overrides.

For Docker Compose, a single root `.env` can combine variables; the compose file reads it.
