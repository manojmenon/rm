🎯 Goal

Design and implement a full-stack enterprise Product Roadmap Management System with:
	•	Backend → Go (Golang)
	•	API → REST (or GraphQL optional)
	•	ORM → GORM
	•	Database → PostgreSQL with JSONB
	•	Frontend → Node.js + TypeScript
	•	UI → React/Next.js preferred
	•	Timeline/Gantt roadmap visualization
	•	Enterprise RBAC
	•	Multi-product support
	•	Dependency tracking
	•	Support lifecycle phases
	•	Multi-year planning (5–10 years)

System should be production-ready, scalable, multi-tenant capable, and structured with clean architecture.

⸻

📐 Architecture Requirements

Design using:

Backend (Go)
	•	Go 1.22+
	•	Gin or Fiber framework
	•	GORM ORM
	•	PostgreSQL driver
	•	JWT authentication
	•	Clean architecture
	•	Service layer
	•	Repository pattern
	•	DTOs
	•	Middleware for RBAC
	•	OpenAPI/Swagger docs

Frontend (TypeScript)
	•	Next.js or React
	•	TypeScript strict mode
	•	Tailwind or MUI
	•	Gantt/timeline library:
	•	vis-timeline OR
	•	dhtmlx-gantt OR
	•	custom SVG timeline
	•	State management (React Query / Zustand)
	•	Auth guards

Database

PostgreSQL with:
	•	JSONB for custom milestones
	•	indexes on date fields
	•	foreign keys
	•	soft deletes

⸻

👥 Roles & Permissions (RBAC)

Implement strict role-based access.

Roles

Admin
	•	Full CRUD on everything
	•	Approve/reject product creation
	•	Change any roadmap dates
	•	Delete products
	•	Manage users
	•	Assign product owners

Product Owner
	•	CRUD only their products
	•	Edit milestones and dates
	•	Manage dependencies
	•	Cannot delete product
	•	Cannot approve new products

User
	•	View products
	•	Request product creation
	•	Cannot modify roadmaps

⸻

🧩 Core Features

1. Product Lifecycle Management

Each product contains:
	•	name
	•	version
	•	description
	•	owner_id
	•	custom milestones
	•	support phases
	•	dependencies
	•	roadmap timeline

⸻

2. Milestones & Support Phases (Dynamic)

Milestones must be configurable per product, not hardcoded.

Examples:
	•	Alpha
	•	Beta
	•	Preview
	•	GA
	•	End of Normal Support
	•	Extended Support
	•	Paid Support

Each milestone:
	•	label
	•	start_date
	•	end_date
	•	color
	•	type
	•	metadata (JSONB)

⸻

3. Dependencies

Products/milestones can depend on others:
	•	Finish → Start
	•	Start → Start
	•	Finish → Finish

When parent date changes:
👉 auto-reschedule dependents

⸻

4. Roadmap View

Frontend must provide:
	•	Gantt timeline
	•	Multi-year zoom
	•	drag to move
	•	dependency lines
	•	color by phase
	•	filters
	•	grouping by product/owner
	•	export to CSV/Excel/PDF

⸻

5. Product Creation Workflow

Flow:

User → requests product
Admin → approves
System → assigns owner

Deletion:
👉 admin only

Database Schema

Use PostgreSQL + JSONB.

⸻

users

id (uuid)
name
email
password_hash
role (admin | owner | user)
created_at

products


id
name
version
description
owner_id (FK users)
status (pending | approved | archived)
metadata jsonb
created_at

milestones

id
product_id
label
start_date
end_date
type
color
extra jsonb

dependencies

id
source_milestone_id
target_milestone_id
type (FS/SS/FF)


product_requests


id
requested_by
name
description
status (pending/approved/rejected)


Security Requirements
	•	JWT auth
	•	refresh tokens
	•	password hashing (bcrypt)
	•	middleware RBAC checks
	•	audit logs
	•	soft deletes
	•	row-level checks (owners only see theirs)

⸻

🔄 Backend API Examples

Auth

POST /auth/login
POST /auth/register

Products

GET /products
POST /products
PUT /products/:id
DELETE /products/:id (admin only)

Milestones
GET /products/:id/milestones
POST /milestones
PUT /milestones/:id

Dependencies
POST /dependencies
Requests


POST /product-requests
PUT /product-requests/:id/approve

Business Rules

Implement:

Rule 1

Owner can edit only owned products

Rule 2

Admin can override everything

Rule 3

Users cannot modify roadmap

Rule 4

Dependencies auto-shift children

Rule 5

Milestones are dynamic JSONB

Rule 6

Deletion = admin only

⸻

🧠 Backend Design Guidelines

Generate:

/cmd/server
/internal
  /models
  /repositories
  /services
  /handlers
  /middleware
  /auth
  /migrations
  
  Use:
	•	context
	•	dependency injection
	•	unit tests
	•	migrations (golang-migrate)

 Frontend Requirements

Create:

Pages:
	•	Dashboard
	•	Products list
	•	Product roadmap view
	•	Requests
	•	Admin panel

Components:
	•	Gantt chart
	•	milestone editor
	•	dependency editor
	•	role guards

Features:
	•	drag & drop
	•	color phases
	•	zoom years/quarters
	•	CSV import/export

⸻

🚀 Bonus Features (Optional but recommended)
	•	Excel import
	•	Mermaid export
	•	Slack notifications
	•	Audit trail
	•	Multi-tenant orgs
	•	GraphQL
	•	Real-time updates (WebSocket)

⸻

🧪 Testing

Require:
	•	backend unit tests
	•	integration tests
	•	frontend component tests
	•	seed scripts

⸻

🎯 Deliverables

Generate:
	•	Full Go backend
	•	Full TypeScript frontend
	•	Docker compose
	•	Postgres schema
	•	migrations
	•	seed data
	•	README
	•	Makefile


The generated code MUST:

Architecture
	•	follow Clean/Hexagonal architecture
	•	repository pattern
	•	service layer
	•	dependency injection
	•	no business logic in handlers
	•	interface-driven design

Code quality
	•	lintable
	•	testable
	•	unit tests
	•	integration tests
	•	structured logs only (no fmt.Println)
	•	context propagation

Security
	•	bcrypt password hashing
	•	JWT + refresh tokens
	•	RBAC middleware
	•	input validation
	•	SQL injection safe (ORM only)
	•	rate limiting
	•	audit trail for every write operation

Scalability
	•	stateless services
	•	horizontal scaling ready
	•	pagination everywhere
	•	proper indexes

🔐 Enterprise Features (MUST IMPLEMENT)

⸻

1️⃣ Audit Logging (MANDATORY)

Every mutating action must generate an audit record:

Actions to log
	•	create
	•	update
	•	delete
	•	approval
	•	login
	•	permission change
	•	milestone change
	•	dependency change

⸻

Audit Table


audit_logs
-----------
id (uuid)
timestamp
user_id
action
entity_type
entity_id
old_data jsonb
new_data jsonb
metadata jsonb
ip_address
user_agent
trace_id

Requirements

Backend MUST:
	•	automatically intercept writes via middleware/service
	•	diff old vs new state
	•	store JSONB
	•	include trace_id from OpenTelemetry
	•	non-blocking (async queue or goroutine)
	•	cannot fail business logic if audit fails


Observability (MANDATORY)

System MUST implement full OpenTelemetry.

⸻

Tracing

Instrument:
	•	HTTP requests
	•	DB queries
	•	external calls
	•	business services

Use:

go.opentelemetry.io/otel

Export:
→ OTLP → OpenTelemetry Collector → Grafana/Tempo

⸻

Metrics

Expose:

App metrics


http_requests_total
http_request_duration_seconds
db_query_duration_seconds
product_created_total
milestone_updates_total
audit_events_total
login_attempts_total
active_users



Business metrics

products_count
milestones_count
dependencies_count
roadmap_changes_total
support_phase_active

Logs

Structured logs:
	•	zap or zerolog
	•	JSON format
	•	trace_id correlation

⸻

⸻

🧭 Grafana Requirements

Generate:

1. Prometheus config

2. OpenTelemetry collector config

3. Grafana dashboard JSON

Dashboard must include:

Panels

System
	•	request rate
	•	latency p95
	•	errors
	•	DB time

Business
	•	products created per month
	•	roadmap changes
	•	support phases active
	•	user activity

Audit
	•	audit events per minute
	•	admin actions
	•	owner actions
	•	failed logins

⸻

⸻

📦 Provide These Files

Generate code AND these infra files:

docker-compose.yml
otel-collector.yaml
prometheus.yml
grafana-dashboard.json



Backend Implementation Instructions

Generate:

⸻

Middleware

AuthMiddleware
RBACMiddleware
AuditMiddleware
TelemetryMiddleware
RequestIDMiddleware


Example Audit Logging Code (must be generated)

func (s *AuditService) Log(ctx context.Context, entry AuditEntry) {
    go func() {
        s.db.Create(&entry)
    }()
}


Example OpenTelemetry Setup (must be generated)

tp := sdktrace.NewTracerProvider(
    sdktrace.WithBatcher(exporter),
    sdktrace.WithResource(resource.NewWithAttributes(
        semconv.ServiceName("roadmap-service"),
    )),
)
otel.SetTracerProvider(tp)

Frontend Observability

Frontend must:
	•	send telemetry via OTEL web SDK
	•	measure page loads
	•	measure API calls
	•	send metrics to collector

⸻

Required

Generate:

React hook example

import { trace } from "@opentelemetry/api"

export const useTrace = () => {
  const tracer = trace.getTracer("frontend")

  const startSpan = (name: string) => {
    return tracer.startSpan(name)
  }

  return { startSpan }
}


⸻

📈 Grafana Dashboard JSON

Generate a complete dashboard JSON that shows:
	•	request latency
	•	audit events
	•	roadmap changes
	•	product count
	•	error rates

It must be importable into Grafana directly.

⸻

⸻

🧠 Deliverables

The code generator MUST output:

✅ Go backend
✅ TypeScript frontend
✅ migrations
✅ audit service
✅ otel setup
✅ prometheus metrics
✅ docker compose stack
✅ grafana dashboard json
✅ README

⸻

⸻

🔥 Final Instruction to Code Generator

At the end of this prompt, you must:

👉 generate the entire project skeleton with working enterprise-grade code, not pseudocode.

All files must be complete and runnable.


