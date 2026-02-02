# Grafana dashboards

Import these JSON files via **Grafana → Dashboards → New → Import** (upload or paste):

- **grafana-dashboard.json** – Roadmap Service (request rate, latency, error rate, etc.)
- **technical-stack-dashboard.json** – Technical stack overview, health, Loki logs, Tempo traces
- **data-flow-dashboard.json** – Data flow (request/log/trace pipelines, login/logout)

Datasources (Prometheus, Loki, Tempo) are provisioned from `scaffold/config/grafana/provisioning/datasources/`.
