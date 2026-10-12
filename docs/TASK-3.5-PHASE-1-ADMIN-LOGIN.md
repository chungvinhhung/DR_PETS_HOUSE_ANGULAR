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

The approved Figma artwork is exported into repository-owned files under `public/assets/admin-login/`. The login page does not depend on short-lived Figma MCP asset URLs at runtime.
