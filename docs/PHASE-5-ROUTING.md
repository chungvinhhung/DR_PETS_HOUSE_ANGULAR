# Phase 5 - Routing

## Goal

Wire real Angular routes through the Customer and Admin shells while keeping business pages as lightweight migration placeholders.

## Route tree

```text
/
├── /                  -> CustomerLayout -> HomePage
├── /products          -> CustomerLayout -> ProductsPage
├── /booking           -> CustomerLayout -> BookingPage
├── /pets              -> CustomerLayout -> PetsPage
├── /orders            -> CustomerLayout -> OrdersPage
└── /admin
    ├── /admin          -> redirect /admin/dashboard
    ├── /admin/dashboard
    ├── /admin/orders
    └── /admin/appointments
```

Unknown routes redirect to `/`.

## Lazy loading

Both layouts and every route page use Angular `loadComponent`. This prevents the application root from eagerly importing feature pages.

## Shell navigation

Phase 4 navigation placeholders are now real Angular router links:

- Customer navigation uses `RouterLink` and `RouterLinkActive`.
- Admin navigation uses `RouterLink` and `RouterLinkActive`.
- Active links expose `aria-current="page"`.
- Admin includes a route back to the Customer site.

## Migration placeholders

The routed page components are intentionally minimal. They prove that the route tree and shared component imports work without prematurely migrating React business screens.

The placeholders should be replaced feature-by-feature during later migration tasks.

## Phase 5 Definition of Done

- [x] Application root reduced to the top-level `router-outlet`.
- [x] Customer routes nested under CustomerLayout.
- [x] Admin routes nested under AdminLayout.
- [x] `/admin` redirects to `/admin/dashboard`.
- [x] Customer and Admin navigation use Angular Router.
- [x] Active route state is wired.
- [x] Route pages use lazy `loadComponent`.
- [x] Unknown routes have a fallback.
- [x] Routed placeholders reuse `PageTitleComponent`.
- [ ] `npm run build` verified locally after pulling Phase 5.
- [ ] Customer routes verified in browser.
- [ ] Admin routes verified in browser.

Phase 5 implementation is complete. Local build and browser verification remain before the phase is marked fully complete.
