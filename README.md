# OGRA — Modern Argo Workflows Dashboard & Backend

OGRA is a modern, lightweight web interface and REST/SSE API backend for managing
[Argo Workflows](https://argoproj.github.io/workflows/) on Kubernetes. Built with Go and React,
OGRA provides real-time event streaming, interactive workflow template execution,
cron schedule management, and streaming pod logs.

---

## Key Features

- **Live Workflow Runs**: Monitor active, succeeded, pending, and failed workflow executions
  with real-time SSE (Server-Sent Events) live log and event streaming.
- **Workflow Templates**: Browse `WorkflowTemplates`, trigger fresh workflow runs with dynamic
  parameter forms, and resubmit previous runs.
- **CronWorkflows**: View scheduled cron jobs, manually trigger immediate runs, and toggle
  suspend/active status.
- **Node Execution Tree & Timeline**: Detailed execution node trees with pod status, error messages,
  and sequential execution timelines.
- **Clipboard & Export Utilities**: Copy workflow status messages, node errors, and live pod log
  streams to clipboard or download as text files.
- **Namespace Filtering**: Filter resources across specific Kubernetes namespaces or view all
  namespaces simultaneously.

---

## Project Structure

```text
ogra/
├── api/
│   ├── crds/                # Argo Workflows CustomResourceDefinitions
│   └── openapi.json         # Compiled OpenAPI 3.0 specification
├── cmd/
│   └── server/              # Go API backend server entrypoint
├── frontend/
│   ├── src/                 # React frontend application
│   │   ├── components/      # UI components (LogStream, Toast, PhaseBadge)
│   │   ├── context/         # React ClusterContext state manager
│   │   ├── pages/           # Page views (WorkflowsList, WorkflowDetail, etc.)
│   │   ├── types/           # Auto-generated TypeScript types
│   │   └── utils/           # API fetch wrappers and time formatting
│   ├── playwright.config.ts # Playwright E2E UI testing configuration
│   └── vite.config.ts       # Vite build configuration
├── internal/
│   ├── api/                 # Auto-generated Go types from OpenAPI schema
│   └── handler/             # HTTP handlers and SSE streaming helpers
├── k8s/
│   ├── examples/            # Example WorkflowTemplates and CronWorkflows
│   └── releases/            # Argo Workflows core deployment manifests
├── profiles/
│   └── kind.nix             # Nix devenv Kind cluster setup profile
├── scripts/
│   └── gen-api-types.py     # Toolchain to generate OpenAPI, Go, and TS types
├── tests/
│   └── e2e/                 # API (Go) and UI (Playwright) E2E test suites
├── devenv.nix               # Nix development environment configuration
└── go.mod                   # Go module definition
```

---

## Getting Started

### Prerequisites

- [Nix](https://nixos.org/) with `devenv` enabled.

### Running the Environment

Start the local Kind Kubernetes cluster, deploy Argo Workflows, and launch the backend and frontend dev servers:

```bash
devenv shell --profile kind --quiet -- devenv up
```

Access the services:

- **Frontend UI**: `http://localhost:3000`
- **Backend API**: `http://localhost:8080`

---

## Development Workflows

### Running Backend Server Individually

```bash
devenv shell --profile kind --quiet -- backend
```

### Running Frontend Development Server

```bash
devenv shell --quiet -- frontend
```

### Regenerating API Schemas & Types

To re-extract OpenAPI 3.0 schemas from `api/crds/` and regenerate both TypeScript
(`frontend/src/types/generated.ts`) and Go (`internal/api/types.go`) types:

```bash
devenv shell --quiet -- gen-api-types
```

---

## Testing & Quality Assurance

### Go API E2E Tests

Run end-to-end API tests against the Kind cluster:

```bash
devenv shell --profile kind --quiet -- go test -v -tags=e2e ./tests/...
```

### Playwright UI E2E Tests

Run Playwright browser integration tests:

```bash
devenv shell --profile kind --quiet -- playwright-test --reporter=line
```

### Testbed Namespace Garbage Collection

Purge test namespaces (`ogra-e2e-test=true`) older than 15 minutes:

```bash
devenv shell --profile kind --quiet -- testbed gc 15m
```

## License

This project is licensed under the MIT License.
