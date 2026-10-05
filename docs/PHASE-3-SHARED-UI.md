# Phase 3 - Shared UI Foundation

## Goal

Create a small reusable UI baseline in `shared/components` and prove that standalone shared components can be imported by the application shell.

## Implemented components

```text
src/app/shared/components/
├── button/
│   ├── button.component.ts
│   ├── button.component.html
│   └── button.component.scss
├── loading/
│   ├── loading.component.ts
│   ├── loading.component.html
│   └── loading.component.scss
└── page-title/
    ├── page-title.component.ts
    ├── page-title.component.html
    └── page-title.component.scss
```

## Design decisions

- Components are standalone Angular components.
- Components use `ChangeDetectionStrategy.OnPush`.
- Styles are component-scoped SCSS.
- No business/domain behavior is allowed in shared UI.
- Tailwind is intentionally not introduced in this phase; the shared API should remain usable regardless of the later styling layer.
- The root component imports all three shared components as a compile-time integration proof.

## Component contracts

### ButtonComponent

Inputs:

- `type`: `button | submit | reset`
- `variant`: `primary | secondary`
- `disabled`: boolean
- `loading`: boolean

Button content is supplied through `ng-content`.

### LoadingComponent

Input:

- `label`: visible and screen-reader status text

### PageTitleComponent

Inputs:

- `title`: required
- `subtitle`: optional

## Phase 3 Definition of Done

- [x] Reusable button component created.
- [x] Reusable loading component created.
- [x] Reusable page-title component created.
- [x] Components are standalone and OnPush.
- [x] Shared components contain no business logic.
- [x] Root application imports and renders the shared components.
- [x] Shared component conventions documented.
- [ ] `npm run build` verified locally after pulling Phase 3.
- [ ] Shared component demo verified in browser.

Phase 3 implementation is complete. Local verification remains before the phase is marked fully complete.
