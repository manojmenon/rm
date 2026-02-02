# Infra

Infrastructure automation for running the roadmap stack. Reserved for future **Ansible** (or similar) playbooks and roles to provision and update the environment needed for:

- **Docker** – install and configure Docker Engine.
- **Docker Compose** – install and configure Docker Compose.
- **VM / bare metal** – install dependencies (Go, Node, Postgres, optional observability), users, and config for running the app via `scaffold/deploy/vm/` (e.g. `setEnv.sh`, systemd units).

Run playbooks from this directory or from repo root; document inventory and usage in this README as they are added.
