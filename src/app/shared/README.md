# Shared Layer

`shared/` contains reusable presentation building blocks with no ownership by one business feature.

## Appropriate content

- Reusable UI components
- Generic directives
- Generic pipes

Examples:

```text
components/button/
components/loading/
components/page-title/
directives/
pipes/
```

## Rule

A component belongs in `shared/` only when it is reusable across multiple features or shells.

Feature-specific UI should stay inside its feature folder.
