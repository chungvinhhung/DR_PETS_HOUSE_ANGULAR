# Dr. Pet's House Angular Frontend

Angular frontend for **Dr. Pet's House - Pet Clinic & E-commerce System**.

> This repository is the new frontend source of truth for the project.  
> The previous React/Vite repository is retained only as a legacy/reference implementation for UI, business flows, routes, and API behavior.

## Phase 0 Architecture Decisions

| Area | Decision |
| --- | --- |
| Framework | Angular 22 |
| Language | TypeScript |
| Angular architecture | Standalone Components |
| Package manager | npm |
| Routing | Angular Router with nested/lazy routes |
| HTTP | Angular HttpClient |
| App structure | One Angular app with separate Customer and Admin shells |
| Styling | Tailwind CSS + component-scoped styles |
| State management | Angular services/signals first; no NgRx until a real need is identified |
| API flow | Component -> Domain Service -> HttpClient -> Backend |
| Auth | Bearer access token + Auth Guard + Admin/Role Guard skeleton |
| Error handling | Centralized HTTP interceptor/error mapping |

## Workspace

Phase 1 Angular workspace is now scaffolded on:

```text
feature/angular-shared-foundation
```

Baseline:

- Angular 22.2.1
- TypeScript 6.0.3
- Standalone Components
- Angular Router
- SCSS
- Client-side rendering
- npm

Local setup:

```bash
nvm use
npm install
npm start
```

Build check:

```bash
npm run build
```

See `docs/PHASE-1-WORKSPACE.md` for the Phase 1 verification checklist.

## Planned Application Structure

```text
src/app/
├── core/
│   ├── guards/
│   ├── interceptors/
│   ├── services/
│   ├── models/
│   ├── constants/
│   └── utils/
├── shared/
│   ├── components/
│   ├── directives/
│   └── pipes/
├── layouts/
│   ├── customer-layout/
│   └── admin-layout/
├── features/
│   ├── auth/
│   ├── home/
│   ├── products/
│   ├── booking/
│   ├── pets/
│   ├── orders/
│   └── admin/
├── app.component.ts
├── app.config.ts
└── app.routes.ts
```

## Routing Strategy

Customer routes use the Customer shell:

```text
/
├── /
├── /products
├── /booking
├── /pets
└── /orders
```

Admin routes use the Admin shell:

```text
/admin
├── /admin/dashboard
├── /admin/orders
└── /admin/appointments
```

## Branch Strategy

```text
main
  ↑
develop
  ↑
feature/*
```

- `main`: stable/demo-ready code.
- `develop`: integration branch.
- `feature/*`: work branches created from `develop`.
- Do not develop directly on `main`.
- Prefer Pull Requests from feature branches into `develop`.

Task 2.7 branch:

```text
feature/angular-shared-foundation
```

## Code Conventions

Use `kebab-case` for Angular files.

```text
customer-layout.component.ts
auth.service.ts
auth.guard.ts
auth.interceptor.ts
user.model.ts
```

Rules:

- Components must not call `HttpClient` directly.
- Feature components call domain services.
- Domain services call backend APIs through Angular HTTP infrastructure.
- Reusable UI belongs in `shared/`.
- App-wide singleton/infrastructure code belongs in `core/`.
- Business functionality belongs in `features/`.
- Do not hard-code backend URLs in components or services.
- Do not commit real tokens, passwords, secrets, or production credentials.

## Backend Contract Status

The backend contract is **not yet frozen**. Before implementing authentication and production API integration, the team must confirm:

- API base URL and API prefix.
- Login endpoint and response shape.
- Access-token field and expiration behavior.
- Refresh-token mechanism and endpoint.
- Whether refresh tokens use cookies and whether credentials are required.
- Role values such as `ADMIN`, `CUSTOMER`, and `DOCTOR`.
- Standard success/error response format.
- CORS requirements.

See `docs/BACKEND-CONTRACT.md`.

## Documentation

- `docs/PHASE-0-ARCHITECTURE.md` - architecture decisions and Phase 0 Definition of Done.
- `docs/PHASE-1-WORKSPACE.md` - Angular workspace setup and verification.
- `docs/BACKEND-CONTRACT.md` - backend questions that must be confirmed before auth/API integration.
- `CONTRIBUTING.md` - branch, naming, and contribution conventions.

## Current Status

- Phase 0: architecture/repository baseline complete.
- Phase 1: workspace scaffold, local run, and production build verified; package-lock commit pending.
- Task branch: `feature/angular-shared-foundation`.
