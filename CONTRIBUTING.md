# Contributing

## Branch Workflow

Start new work from `develop`.

```bash
git checkout develop
git pull origin develop
git checkout -b feature/<short-task-name>
```

Examples:

```text
feature/angular-shared-foundation
feature/auth
feature/booking
feature/product-catalog
feature/pet-management
```

Open a Pull Request into `develop` when the feature is ready.

Do not develop directly on `main`.

## Commit Style

Use short, scoped commit messages where possible.

Examples:

```text
feat: add customer layout shell
feat: add auth interceptor skeleton
fix: correct admin route guard
docs: document frontend conventions
refactor: move shared button into shared components
```

## Angular File Naming

Use kebab-case:

```text
booking-page.component.ts
booking.service.ts
auth.guard.ts
error.interceptor.ts
appointment.model.ts
```

## Folder Responsibilities

- `core/`: app-wide infrastructure and singleton concerns.
- `shared/`: reusable UI/directives/pipes with no feature ownership.
- `layouts/`: Customer/Admin shells.
- `features/`: business features and pages.

Avoid importing feature-specific code into `core/` or generic `shared/` code.

## HTTP Rule

Pages/components must not call `HttpClient` directly.

Expected flow:

```text
Component -> Domain Service -> ApiClientService -> HttpClient -> Backend
```

## Pull Request Minimum Checks

Before opening a PR:

- Application compiles.
- Build passes.
- No secrets are committed.
- New routes are reachable.
- Shared code is placed in the correct layer.
- API URLs are not hard-coded in components.
- Relevant README/docs are updated when architecture changes.
