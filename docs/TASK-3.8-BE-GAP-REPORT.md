# Task 3.8 — BE readiness / FE integration blockers

Checked: 21 October 2026.
FE repo: `chungvinhhung/DR_PETS_HOUSE_ANGULAR`.
Render base URL: `https://pet-clinic-backend-a4lj.onrender.com/api/v1`.
Read-only probe: [GitHub Actions run #39598641429](https://github.com/chungvinhhung/DR_PETS_HOUSE_ANGULAR/actions/runs/39598641429).

## Verified status

- **Confirmed:** the public Render domain responded `HTTP 503` for the API root and seven common Swagger/OpenAPI/health URLs when requested from a GitHub runner.
- **Confirmed:** FE Staff List, Staff Detail, Staff Forms and Shift views still consume static `STAFF_PREVIEW` / `STAFF_SHIFTS_PREVIEW` fixtures.
- **Confirmed:** prior document `FE_API_HANDOVER_GUIDE.md` (Canonical v5) covers `GET/POST /api/v1/admin/users` and `PUT /api/v1/admin/users/:id/status`/role, but **does not document the Staff/Shift contract**. It is an older artifact; production availability and current behavior are not verified.
- **Not established:** whether the deployed Backend implements Staff/Shift. HTTP 503 is a transport/deployment blocker, **not** evidence of missing endpoint implementation.
- **Do not** map the legacy `/admin/users` list directly to Staff profiles; BA specifically distinguishes internal accounts from Staff records, and Customer must not be upgraded or reused as Staff.

## Request for Backend / BA

| ID | Priority | Capability / question | Minimum API contract needed | Verified status |
|---|---|---|---|---|
| BE-00 | P0/blocker | Restore Render | `/api/v1` accessible; ideally documented health endpoint, example status, CORS + credentials from local admin FE | **Unavailable: HTTP 503** at probe time |
| BE-01 | P0 | Staff list | GET route, query `q,jobRole,branchId,accountStatus,page,limit`, response staffId, employeeCode, fullName, jobRole, assignedBranches, accountStatus, filtered total, today's actual shifts | **No verified contract** |
| BE-02 | P0 | Staff detail | GET by staffId including homeBranch, assignedBranches, internal user reference (if appropriate), contact fields and account status | **No verified contract** |
| BE-03 | P0 | Create Staff and internal account | POST schema, transaction/rollback semantics, owner/admin policy, returned staffId, uniqueness and password requirements; **do not link to Customer** | **No verified contract** |
| BE-04 | P0 | Edit Staff | PUT/PATCH schema, Manager branch-scoped permission, assignment conflicts with existing Shift/Appointment | **No verified contract** |
| BE-05 | P0 | Account status and reset password | Confirm linked internal userId vs staffId mapping, Admin-only block/unblock, reset endpoint, validation and success/error examples; older `/admin/users/:id/status` is documented but not proven usable for Staff | **Partial older user-account documentation** |
| BE-06 | P0 | Shift list / weekly schedule | GET by staffId or branchId and `from,to`; each record has shiftId, staffId, branchId, date, startTime, endTime, status; timezone rules | **No verified contract** |
| BE-07 | P0 | Shift template list | GET templates by branchId; id, label, start/end time; define whether changing templates affects assigned shifts | **No verified contract** |
| BE-08 | P0 | Shift CRUD / weekly assignment | POST/PUT/DELETE or batch endpoint, validation for role, assigned branch, overlap across branches, existing appointments; atomic vs partial success and actionable conflict codes | **No verified contract** |
| BE-09 | P0 | Authorization and validation | ADMIN/MANAGER/STAFF scopes per endpoint, 401/403/404/409/422 examples, RFC 9457 validation and field errors; no inference from mock | **No verified Staff-specific rules** |
| BE-10 | P1 | API documentation and test environment | Swagger/OpenAPI or Postman collection URL/repo, non-secret test accounts via secure channel; examples for happy/error paths | **Not accessible from probe** |

## Minimum acceptance before real FE integration

1. A read-only GET from the deployed Render host returns a service response (not HTTP 503) and can be authenticated via the existing Angular session.
2. BE provides confirmed Staff/Shift paths, request/response schemas, pagination/filters and role requirements; avoid endpoint guessing.
3. FE safely replaces fixtures only for verified operations. Loading, error, empty state and auth/branch scope must be handled.
4. Writes require successful BE response before user feedback; no fake saved state.
5. End-to-end smoke tests with ADMIN/MANAGER test users, including status updates and Shift overlap/Appointment conflicts, pass.
6. Angular CI and UI regression pass before a PR is merged.

## Read-only diagnostic

```bash
node scripts/probe-task-3-8-api.mjs
```

The script uses only unauthenticated GET requests to known documentation URLs. It does not enumerate private endpoints, authenticate or modify data.
