# Features

`features/` contains business functionality.

Current feature boundaries:

```text
admin/      # Back-office and administration
customer/   # Customer-facing web experience
auth/       # Foundation placeholder
```

The original Customer demo route placeholders (`home/`, `products/`, `booking/`, `pets/`, `orders/`) have been retired.
Customer routes are defined in `features/customer/customer.routes.ts`, loaded by `app.routes.ts` through the Customer layout in `layouts/customer/`.

## Feature ownership

A feature may contain its own:

- Pages/components
- Feature-specific services
- Feature-specific models
- Feature-specific routes
- Feature-specific helpers

## Dependency rule

Features may depend on `core/` and `shared/`.

Avoid direct coupling between unrelated features. If code becomes truly reusable, move it to an appropriate shared/core abstraction.
