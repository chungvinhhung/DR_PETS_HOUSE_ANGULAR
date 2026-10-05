# Core Layer

`core/` contains app-wide infrastructure that should have a single responsibility across the entire Angular application.

## Allowed content

- Guards
- HTTP interceptors
- App-wide services
- App-wide models
- Constants
- Utility helpers

## Dependency rule

`core/` must not depend on feature-specific implementation details.

Good:

```text
features -> core
layouts  -> core
shared   -> core (only when truly generic)
```

Avoid:

```text
core -> features
```

Examples that will be added in later phases:

```text
guards/auth.guard.ts
guards/admin.guard.ts
interceptors/auth.interceptor.ts
interceptors/error.interceptor.ts
services/api.service.ts
services/auth.service.ts
models/api-response.model.ts
```
