# System Architecture

## 1. High-Level Architecture (C4-Lite System Context)

The School Management System is structured as a **modular monolith** with clear domain boundaries, layered separation of concerns, and shared type contracts between client and server.

```mermaid
flowchart TD
    subgraph ClientLayer["Client Layer (apps/web)"]
        Browser["Next.js App Router (Port 3000)"]
    end

    subgraph ServerLayer["Server Layer (apps/api)"]
        Proxy["Next.js /api Proxy Rewrite"]
        ExpressApp["Express API (Port 5000)"]
        AuthZ["Central Policy Module (can)"]
        Controllers["Controllers"]
        Services["Domain Services (Business Logic)"]
        Repositories["Scoped Repositories"]
    end

    subgraph DataLayer["Data & Persistence"]
        MongoDB[("MongoDB 7.0 Single-Node Replica Set (rs0)")]
    end

    Browser -->|Same-Origin HTTP / Cookies| Proxy
    Proxy -->|Proxies /api/*| ExpressApp
    ExpressApp --> AuthZ
    AuthZ --> Controllers
    Controllers --> Services
    Services --> Repositories
    Repositories --> MongoDB
```

---

## 2. Request Lifecycle & Layering

All backend operations strictly adhere to unidirectional flow:
```
Routes → Middleware (Auth/Request-ID) → Policy (AuthZ) → Controller → Service (Transaction) → Repository → MongoDB
```

```mermaid
sequenceDiagram
    autonumber
    participant UI as Next.js Web UI
    participant Route as Express Route & Middleware
    participant Policy as AuthZ Policy (can)
    participant Ctrl as Controller
    participant Svc as Service (Domain Logic)
    participant Repo as Scoped Repository
    participant DB as MongoDB (Replica Set rs0)
    participant Audit as Audit Service

    UI->>Route: HTTP Request (Cookie / Idempotency-Key)
    Route->>Route: Attach X-Request-ID & Verify JWT
    Route->>Policy: can(user, action, resource)
    alt Unauthorized Role
        Policy-->>UI: 403 Forbidden
    else Allowed
        Route->>Ctrl: invokeAction(req, res)
        Ctrl->>Svc: execute(dto)
        Note over Svc,DB: Open Mongo Session & Transaction
        Svc->>Repo: query / mutate within session
        alt Out of Tenant/Scope Record
            Repo-->>Svc: null
            Svc-->>UI: 404 Not Found (No existence leak)
        else In Scope
            Repo->>DB: findOneAndUpdate / insert
            DB-->>Repo: document
            Svc->>Audit: recordAuditLog(actor, change) [same tx]
            Audit->>DB: insertAuditLog
            Svc-->>Ctrl: result DTO
            Ctrl-->>UI: 200 OK / 201 Created (RFC 7807 on error)
        end
    end
```

---

## 3. Why a Modular Monolith?

1. **Transactional Integrity:** Academic and financial workflows (e.g. invoice generation with ledger entries, attendance bulk recording, exam locking with snapshots) require ACID guarantees across related records. A single MongoDB replica set connection avoids distributed transaction overhead (2PC/Sagas).
2. **Operational Simplicity:** A single deployable unit on free cloud hosting (Render for API, Vercel for Web, Atlas for DB) eliminates multi-service network latency, orchestration complexity, and distributed tracing costs.
3. **Traceability:** Student evaluation requires tracing requests from UI to database within minutes. Strict repository layering guarantees predictable debugging.

---

## 4. Concurrency & Data Integrity Strategy

| Business Rule | Integrity Mechanism | Automated Verification |
|---|---|---|
| **A1: Teacher Scoping** | Repository-level scoped queries automatically filter by assigned section/subject; returns `404` for out-of-scope resources. | `apps/api/tests/integration/attendance-access.test.ts` |
| **A2: Attendance Deduplication** | Unique compound index `(student_id, date, session)` + transactional idempotent bulk upsert (`PUT`). | Concurrency test with 50 parallel requests |
| **A3: Immutable Exam Results** | Grading scheme configuration is copied into `exams.grading_snapshot` upon transition to `LOCKED`. Pure-function calculations with integer hundredths. | Hand-computed unit test suite with boundary and absent conditions |
| **A4: Guardian Isolation** | Repository filters match student against verified guardian links in JWT token scope; returns `404` for unlinked students. | Multi-child switching and cross-family URL test |
| **A5: Financial Ledger Balance** | Append-only ledger; outstanding balances calculated as `invoiced - paid = sum(ledger)`. Invoices use version-checked atomic updates. | Concurrency payment test + ledger reconciliation check |

