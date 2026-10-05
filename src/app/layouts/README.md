# Layouts

`layouts/` contains application shells that host nested routes.

Planned shells:

```text
customer-layout/
admin-layout/
```

## Customer shell

Expected composition:

```text
Customer Navbar
      ↓
router-outlet
      ↓
Customer Footer
```

## Admin shell

Expected composition:

```text
Admin Header + Sidebar
          ↓
     router-outlet
```

Layouts should coordinate page chrome and navigation only. Business logic belongs in `features/`.
