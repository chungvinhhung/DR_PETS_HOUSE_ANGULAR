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


## HTTP foundation

`services/api-client.service.ts` is the low-level HTTP boundary for domain services.

Rules:

- Feature components do not inject `HttpClient` directly.
- Domain services may depend on `ApiClientService`.
- `ApiClientService` reads the API base URL from Angular environment configuration.
- The base URL is intentionally blank until the backend contract is confirmed.
- Calling the API client without a configured base URL fails fast instead of silently targeting the frontend origin.
- Authentication headers, refresh behavior, and centralized error mapping are added in Phase 7.
