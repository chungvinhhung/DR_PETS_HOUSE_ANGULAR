# Task 3.5 — Final Verification (FE Admin)

## Scope

Frontend Admin portion of WBS 3.5 Auth / User / Role / Permission.

Backend implementation is out of scope. FE consumes the backend contract from branch `feat/p0-auth-rbac`.

## Implemented

### Authentication
- Admin login UI from Figma.
- `POST /api/v1/auth/login`.
- Access token kept in memory.
- HttpOnly refresh cookie via `withCredentials: true`.
- Bearer token interceptor.
- Automatic `TOKEN_EXPIRED` refresh + failed-request retry.
- Session restore after browser reload using `/auth/refresh` + `/auth/me`.
- Logout via `POST /api/v1/auth/logout`.
- Login honors a safe internal `returnUrl` for protected Admin routes.

### Authorization / RBAC
- Auth guard for `/admin/**`.
- Role guard driven by route `data.roles`.
- Dedicated `/admin/forbidden` 403 page.
- Back-office roles: ADMIN, MANAGER, STAFF.
- Customer is blocked from Admin routes.
- `/admin/users` is limited to ADMIN + MANAGER.
- Manager management controls are hidden; backend branch scoping remains authoritative.
- ADMIN-only UI controls for internal-account creation, role/sub-role changes, and account status changes.

### Account / profile
- `GET /auth/me`.
- `PUT /auth/me`.
- Profile updates synchronize the current in-memory user/header.

### Admin user management
- `GET /admin/users`.
- `POST /admin/users`.
- `PUT /admin/users/:id/status`.
- `PUT /admin/users/:id/role`.
- Internal-account form validation mirrors backend phone/password rules.
- Current signed-in account does not expose self role/status controls in FE.

### Assets
- Approved Admin Login Figma artwork is stored under `public/assets/admin-login/`.
- Runtime code contains no short-lived Figma MCP asset URLs.

## Verification matrix

| Case | Expected result | Status |
| --- | --- | --- |
| Admin valid login | 200, session created, redirect to dashboard | Verified manually |
| Admin logout | Refresh session revoked/cleared and redirect to login | Verified manually |
| Browser reload while authenticated | Refresh cookie restores access token + user | Implemented; final smoke |
| Customer enters Admin area | Redirect to `/admin/forbidden` | Verified manually |
| Manager opens Users & Roles | Scoped list only; no create/role/status controls | Verified manually |
| Manager branch scope | Only backend-authorized branch users visible | Verified manually |
| Admin profile update | Name/email saved and header synchronized | Verified manually |
| Unauthenticated direct `/admin/**` | Redirect to login with safe `returnUrl` | Final smoke |
| Invalid login form input | Client validation blocks invalid request | Implemented |
| Invalid internal account input | Phone/email/password validation blocks invalid request | Implemented |
| Expired access token | Refresh once, rotate token, retry original request | Implemented; timed smoke |
| Refresh failure | Clear local session and redirect to login | Implemented |
| Wrong role on `/admin/users` | 403 route handling | Implemented |

## Security boundary

Frontend authorization is a UX/navigation layer only. Backend remains authoritative for:
- unauthorized / forbidden responses,
- system role and staff sub-role,
- branch scope,
- ownership,
- assignment,
- account status,
- token/session validity.

The current backend branch does not expose standalone permission CRUD endpoints, so FE does not invent a permission-management API.

## Final commands

```powershell
npm ci
npm run build
npm run start:admin
```

Admin FE: `http://localhost:3001`

Local backend contract: `http://localhost:8080/api/v1`

## Manual smoke accounts

Use the demo credentials provided by the backend seed for ADMIN, MANAGER, STAFF and CUSTOMER. Do not commit real secrets or local backend `.env` files.
