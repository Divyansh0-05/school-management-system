# Phase 1B Walkthrough: Admin UI

## What was built

The web app now provides cookie-based login, logout, change-password, role routing, forbidden/not-found pages, a global error boundary, responsive admin navigation, and placeholder teacher/guardian areas. Admin master data uses one generic TanStack Query table/form manager for all Phase 1B resources. It includes search, pagination, skeleton/empty/error states, create/edit dialogs, Zod-backed react-hook-form validation, deactivation confirmation, retries, disabled pending actions, responsive card-style tables, and accessible labels/error descriptions.

## Request flow

1. An admin opens a resource and submits its dialog.
2. The generic manager validates the resource-specific schema from `packages/shared`, then sends a same-origin `POST` or `PATCH` through the Next rewrite.
3. Express validates and authorizes the request, opens its Mongo transaction, writes the resource and audit row, and returns the standard response.
4. TanStack Query invalidates the resource list; the new row appears without storing tokens in browser storage.

## Three likely live changes

1. Add a resource field: update `configs` in `apps/web/src/components/master-data-manager.tsx` and its shared schema.
2. Change navigation: update `links` in `apps/web/src/components/admin-shell.tsx`.
3. Add a role landing experience: update the matching server page under `apps/web/src/app/teacher` or `guardian`.

## Reviewer Q&A

1. **Where are tokens stored?** Only in the API's httpOnly cookie; the browser never writes tokens to localStorage.
2. **Why one manager?** Resource configuration supplies fields and columns while one tested component keeps loading, mutation, errors, and accessibility behavior consistent.
3. **How does server auth work?** Middleware checks the cookie, then protected layouts call `/auth/me` server-side and enforce the role.
4. **How are API conflicts shown?** The shared problem response is surfaced in the dialog/toast; field-level Zod issues render beside inputs.
5. **How is mobile handled?** The sidebar collapses and tables become labelled cards below 640px while focus outlines remain visible.
