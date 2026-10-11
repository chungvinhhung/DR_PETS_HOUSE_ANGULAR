# Task 3.5 — Phase 1 Admin Login UI

Phase 1 implements the Admin Login page as a standalone Angular feature.

## Route

`/admin/login`

## Included

- Standalone Angular component
- Reactive form foundation
- Identifier and password fields
- Show/hide password interaction
- Client-side required/min-length validation
- Responsive Admin Login composition based on the approved Figma reference
- Dedicated `start:admin` script using port 3001 (matches current Backend CORS handover)

## Deferred to Phase 2+

- Real `POST /api/v1/auth/login` integration
- Backend error-code mapping
- Access-token session handling
- Refresh-token flow
- Route guards / RBAC enforcement

## Visual asset note

The page structure, proportions, palette and interaction match the Figma reference. The exact proprietary logo/mascot artwork is represented by a lightweight frontend-safe placeholder in this first UI phase; replace it with exported repository-owned Figma assets during visual polish before final acceptance.
