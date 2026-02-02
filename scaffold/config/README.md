# Config

Centralized configuration and environment examples for the Product Roadmap stack.

## Layout

- **env/** – Environment variable examples (copy to `.env` or service-specific location).
- **metrics/** – Prometheus scrape config.
- **logs/** – Loki and Promtail configs.
- **traces/** – Tempo and OpenTelemetry Collector configs.
- **grafana/** – Grafana provisioning (datasources) and dashboard JSONs.

## Usage

- **Docker Compose:** The deploy compose file mounts files from `scaffold/config/` (see `scaffold/deploy/docker-compose/`).
- **VM / local:** Copy `env/*.example` to your runtime location and point each service at the relevant config file.
