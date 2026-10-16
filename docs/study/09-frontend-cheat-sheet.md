# 09 — Frontend Cheat Sheet

**Project:** VitalGuard — Remote Patient Telemetry & Critical Care Monitoring  
**Candidate:** Rohan (241IT064, `@rniszn`, B.Tech IT, National Institute of Technology Karnataka)  
**Evaluation Material:** React 18, React Router v6, Real-Time WebSocket & Frontend Architecture

---

## 1. Application Route Map

The VitalGuard Single Page Application (SPA) is built with **React 18**, **Vite**, **TypeScript**, and **Tailwind CSS**. Client-side routing is orchestrated using **React Router v6** (`apps/web/src/app.tsx`).

| Route Path             | Authorized Roles               | Primary Component & Location                                             | What the User Sees & Interacts With                                                                                                                                                                                                                                                             |
| :--------------------- | :----------------------------- | :----------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`/`**                | Public (Unauthenticated) / Any | `LandingPage`<br>(`features/landing/landing-page.tsx`)                   | High-fidelity marketing portal featuring live telemetry value proposition, hero marquee, architecture diagrams, role cards, FAQ accordion, and CTA buttons to `/login` or `/register`. If already authenticated, automatically redirects to `/${user.role}`.                                    |
| **`/login`**           | Public (Unauthenticated)       | `LoginPage`<br>(`features/auth/login-page.tsx`)                          | Credential entry form (email + password). Handles session expiration notifications (`?expired=true`), redirect return URLs (`?returnUrl=...`), error banners, and link to registration.                                                                                                         |
| **`/register`**        | Public (Unauthenticated)       | `RegisterPage`<br>(`features/auth/register-page.tsx`)                    | Multi-role registration form allowing users to sign up as `patient`, `caregiver`, or `doctor` (capturing medical license number, specialization, and hospital affiliation).                                                                                                                     |
| **`/change-password`** | Authenticated (Forced)         | `ChangePasswordPage`<br>(`features/auth/change-password-page.tsx`)       | Mandatory password update screen triggered when `must_change_password` is set to `true` (e.g., initial administrator credential issuance). Blocks all portal navigation until completed.                                                                                                        |
| **`/patient`**         | `patient`                      | `PatientPage`<br>(`features/patient/patient-page.tsx`)                   | **Patient Telemetry Workstation:** Live WebSocket streaming vitals cards (Heart Rate, SpO2, Temperature, Motion), severity badges, Recharts historical interactive line charts (24h/7d/30d), and doctor assignment alerts.                                                                      |
| **`/patient/access`**  | `patient`                      | `PatientAccessPage`<br>(`features/patient/patient-access-page.tsx`)      | **Patient Privacy & Consent Portal:** Transparent list of assigned clinicians and approved caregivers. Allows granting or denying pending caregiver access requests, and revoking caregiver links.                                                                                              |
| **`/doctor`**          | `doctor` (Approved)            | `DoctorPage`<br>(`features/doctor/doctor-page.tsx`)                      | **Doctor Clinical Triage Workstation:** Tabular list of assigned patients sorted by severity urgency (`Critical` $\rightarrow$ `Warning` $\rightarrow$ `Watch` $\rightarrow$ `Normal`), open alert counters, one-click PDF weekly report generator/downloader, and patient telemetry drilldown. |
| **`/doctor/pending`**  | `doctor` (Pending/Rejected)    | `DoctorPendingPage`<br>(`features/doctor/doctor-pending-page.tsx`)       | Informational screen informing newly registered physicians that their medical license is under administrative verification. Displays rejection reason and reapplication form if rejected.                                                                                                       |
| **`/caregiver`**       | `caregiver`                    | `CaregiverPage`<br>(`features/caregiver/caregiver-page.tsx`)             | **Caregiver Monitoring Portal:** Simplified triage view of linked family members/patients, active vital statuses, outgoing link request submission form, and request tracking badges (`Pending Admin`, `Awaiting Patient Consent`, `Approved`).                                                 |
| **`/administrator`**   | `administrator`                | `AdministratorPage`<br>(`features/administrator/administrator-page.tsx`) | **Governance & Clinical Ops Console:** 8 management tabs: Overview counters, Doctor approvals, Institution directory, Doctor management, Patient directory & doctor assignment, Caregiver request reviews, User account suspension/reinstatement, and Security Audit Log.                       |
| **`/design`**          | Developer only (Dev mode)      | `DesignPage`<br>(`features/design/design-page.tsx`)                      | Component sandbox displaying UI primitives (Buttons, Badges, Cards, Modals, Tables, Skeletons, Alerts) across light and dark color schemes.                                                                                                                                                     |
| **`*`** (Wildcard)     | Any                            | `DashboardRedirect`<br>(`apps/web/src/app.tsx`)                          | Catch-all wildcard redirecting authenticated users to their role workspace `/${user.role}` or unauthenticated guests to `/`.                                                                                                                                                                    |

---

## 2. Authentication Flow in the Browser

VitalGuard implements a secure client-side authentication lifecycle integrating React Context, base64url token decoding, custom DOM event buses, and custom fetch interceptors.

```
[ User Enters Credentials ]
            │
            ▼
POST /api/auth/login ──────────► [ Fastify Backend (Argon2id Verification) ]
            │                                     │
            ◄─────────────────────────────────────┘
     Returns JWT Token
            │
            ▼
[ LocalStorage.setItem('vitalguard_token', token) ]
            │
            ▼
[ AuthProvider: decodeToken(token) ] ──► Validates signature format,
            │                            role enum & exp * 1000 > Date.now()
            ▼
[ Set User State: { userId, role } ]
            │
            ▼
[ React Router Redirect: /${user.role} ]
            │
            ├─────────────────────────────────────────┐
            │                                         │
            ▼ (Normal Authenticated Request)          ▼ (Token Expires / Revoked)
   apiFetch('/api/patients/...')              apiFetch('/api/patients/...')
   Injects: Bearer <token>                    Returns: HTTP 401 Unauthorized
            │                                         │
            ▼                                         ▼
   Receives JSON Data                         Dispatches window Event:
                                              'vitalguard:session-expired'
                                                      │
                                                      ▼
                                              AuthProvider Event Listener Catches Event
                                                      │
                                                      ▼
                                              logout() -> Clears State & LocalStorage
                                                      │
                                                      ▼
                                              window.location.href = '/login?expired=true'
```

### Step-by-Step Breakdown

1. **Submission & Token Receipt:** The user submits email and password on `/login`. The API responds with a signed JWT and user metadata.
2. **Persistence:** The token is stored in browser storage via `localStorage.setItem('vitalguard_token', token)`.
3. **Client-Side Decoding & Verification:** `AuthProvider` parses the token's payload segment using base64url decoding (`atob(payload.replace(/-/g, '+').replace(/_/g, '/'))`). It extracts `sub` (User UUID) and `role`, verifying that the token has not expired (`exp * 1000 > Date.now()`).
4. **Role Redirect:** React Router automatically navigates the user to their designated portal (`/${user.role}`).
5. **Authenticated Fetching via `apiFetch`:** All outgoing HTTP requests pass through the custom `apiFetch` wrapper (`apps/web/src/shared/api-fetch.ts`), which automatically attaches the `Authorization: Bearer <token>` header and ensures JSON content types.
6. **Session Expiration Event Handling:** If any authenticated API call returns `HTTP 401 Unauthorized`:
   - `apiFetch` dispatches a custom browser DOM event: `window.dispatchEvent(new CustomEvent('vitalguard:session-expired', { detail: { pathname: ... } }))`.
   - `AuthProvider` catches the event, resets state, deletes `vitalguard_token` from `localStorage`, and executes a hard redirect to `/login?expired=true&returnUrl=<path>`.
7. **Forced Password Change Interception:** If the backend returns `HTTP 403 Forbidden` with body `{ code: 'PASSWORD_CHANGE_REQUIRED' }`:
   - `apiFetch` fires `window.dispatchEvent(new CustomEvent('vitalguard:password-change-required'))`.
   - `AuthProvider` preserves the session token but redirects the user to `/change-password` until the credential is updated.

---

## 3. Role-Based Routing Architecture

Route security in VitalGuard is enforced through a nested layout hierarchy in `apps/web/src/app.tsx` and the declarative `<ProtectedRoute>` guard (`apps/web/src/shared/auth/protected-route.tsx`).

### Routing Structure

```tsx
<Routes>
  {/* Public Unauthenticated Routes */}
  <Route path="/" element={<RootRoute />} />
  <Route path="/login" element={<LoginPage />} />
  <Route path="/register" element={<RegisterPage />} />

  {/* Outer Security Gate: Requires Authenticated Token & User */}
  <Route element={<ProtectedRoute />}>
    <Route element={<AppLayout />}>
      {/* Role-Specific Workstations */}
      <Route
        path="/patient"
        element={
          <ProtectedRoute allowedRoles={['patient']}>
            <PatientPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/caregiver"
        element={
          <ProtectedRoute allowedRoles={['caregiver']}>
            <CaregiverPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/doctor"
        element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <DoctorPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/doctor/pending"
        element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <DoctorPendingPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/administrator"
        element={
          <ProtectedRoute allowedRoles={['administrator']}>
            <ErrorBoundary level="admin" overviewPath="/administrator">
              <AdministratorPage />
            </ErrorBoundary>
          </ProtectedRoute>
        }
      />

      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route
        path="/patient/access"
        element={
          <ProtectedRoute allowedRoles={['patient']}>
            <PatientAccessPage />
          </ProtectedRoute>
        }
      />

      {/* Wildcard Role Redirect */}
      <Route path="*" element={<DashboardRedirect />} />
    </Route>
  </Route>
</Routes>
```

### Guard Logic in `ProtectedRoute`

1. **Authentication Check:** If `!token || !user`, immediately renders `<Navigate to="/login" replace />`.
2. **Password Change Guard:** If `mustChangePassword === true`, forces navigation to `/change-password`.
3. **Doctor Verification Sub-state:**
   - If `user.role === 'doctor'`, the guard queries `/api/doctors/me/application`.
   - If the doctor's status is `pending` or `rejected`, any attempt to visit `/doctor` is automatically redirected to `/doctor/pending`.
   - Conversely, if an approved doctor attempts to visit `/doctor/pending`, they are redirected to `/doctor`.
4. **Role Authorization Check:** If `allowedRoles` is configured and does not contain `user.role`, the guard prevents unauthorized cross-role access and redirects the user to their own portal (`/${user.role}`).

---

## 4. Key React Components & Shared Hooks

| Component / Hook                     | Source File                                                                   | Core Purpose & Architectural Responsibility                                                                                                                                       |
| :----------------------------------- | :---------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`AuthProvider`**                   | `shared/auth/auth-context.tsx`<br>`shared/auth.tsx`                           | Global authentication provider. Manages token lifecycle, user state, decoded role, session expiry events, password-change flags, and doctor approval loading states.              |
| **`useAuth()`**                      | `shared/auth/auth-context.tsx`                                                | Custom React Hook exposing `{ token, user, login, logout, mustChangePassword, doctorApplication }` to any tree component. Throws error if consumed outside `AuthProvider`.        |
| **`apiFetch`**                       | `shared/api-fetch.ts`                                                         | Centralized `fetch` wrapper. Automatically injects `Authorization: Bearer <token>`, enforces JSON content negotiation, and emits decoupled session expiry DOM events on HTTP 401. |
| **`PatientPage` & `PatientDetail`**  | `features/patient/patient-page.tsx`<br>`features/patient/patient-detail.tsx`  | Telemetry workstation. Opens WebSocket stream to `/api/ws`, manages Recharts historical plots, renders biometric summary cards, and handles live threshold alerts.                |
| **`DoctorPage` & `TriageDashboard`** | `features/doctor/doctor-page.tsx`<br>`shared/components/triage-dashboard.tsx` | Clinical triage table. Displays linked patients sorted by severity rank (`Critical` $\rightarrow$ `Normal`), open alerts, and report generation controls.                         |
| **`AdministratorPage`**              | `features/administrator/administrator-page.tsx`                               | Comprehensive multi-tab governance console: doctor licensing, caregiver review, hospital registry, user suspension, and security audit log.                                       |
| **`CaregiverPage`**                  | `features/caregiver/caregiver-page.tsx`                                       | Simplified telemetry dashboard for caregivers with an integrated link-request submission form and consent tracking badges.                                                        |
| **`LandingPage`**                    | `features/landing/landing-page.tsx`                                           | Modern, responsive landing page with dynamic rotating ticker words, marquee banner, system architecture preview, and role-based feature summaries.                                |
| **`ErrorBoundary`**                  | `components/ui/error-boundary.tsx`                                            | React class-based error boundary (`componentDidCatch`, `getDerivedStateFromError`) trapping uncaught render errors with retry and dashboard-recovery options.                     |
| **`AppLayout` & `Footer`**           | `shared/layout/app-layout.tsx`<br>`shared/layout/footer.tsx`                  | Top-level application shell providing navigation bar, role-specific badge indicators, user email display, logout trigger, and responsive clinical footer.                         |
| **UI Design System**                 | `components/ui/index.ts`                                                      | Accessible, unified primitives: `Button`, `Badge`, `Card`, `Modal`, `Table`, `Skeleton`, `Stat`, `Alert`, `Input`, `Select`, `Accordion`.                                         |

---

## 5. WebSocket Integration in the Frontend

To present low-latency telemetry updates without overwhelming the browser or exhausting API server connections, `PatientDetail` connects directly to the Fastify WebSocket gateway (`apps/api/src/features/dashboard/routes.ts`).

### Connection & Subscription Lifecycle

```tsx
// Excerpt from apps/web/src/features/patient/patient-detail.tsx
const ws = useRef<WebSocket | null>(null);

useEffect(() => {
  if (!token) return;

  // 1. Construct WebSocket URL with current origin and auth token
  const socketUrl = new URL('/api/ws', window.location.origin);
  socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  socketUrl.searchParams.set('token', token);

  // 2. Establish connection
  ws.current = new WebSocket(socketUrl.toString());

  // 3. Send subscription message on handshake completion
  ws.current.onopen = () => {
    ws.current?.send(JSON.stringify({ type: 'subscribe', patientId }));
  };

  // 4. Handle streaming telemetry updates
  ws.current.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'subscribed' || data.type === 'error') return;

      const nextStatus =
        data.status ?? (data.severityTier && data.latestVitals ? data : null);
      if (nextStatus) {
        setStatus(nextStatus); // Reactive state update triggers UI refresh
        clearInterval(pollInterval); // Cancel initial polling once WS is active
        if (nextStatus.device) setDevice(nextStatus.device);
      }
    } catch (e) {
      console.error('Failed to parse WS message', e);
    }
  };

  // 5. Cleanup on unmount or patient change
  return () => {
    clearInterval(pollInterval);
    if (ws.current) ws.current.close();
  };
}, [patientId, token]);
```

### Why a Polling Fallback is Used

Before the WebSocket handshake completes or if the patient has not yet transmitted an initial reading over MQTT, `PatientDetail` executes an initial `fetch('/api/patients/:id/vitals/latest')` and sets a short 3-second `setInterval` poll. The moment the first push frame arrives over WebSocket, `clearInterval(pollInterval)` is called, seamlessly transitioning the workstation to pure real-time streaming.

---

## 6. State Management Approach

### Architectural Decision: No Redux, No Zustand

VitalGuard intentionally avoids heavy external state management libraries (Redux, MobX, Zustand) in favor of **native React Context combined with localized component state**:

1. **Global State is Minimal:** The only truly global application state is **authentication & session identity** (current token, user ID, role, and password-change requirement). React Context (`AuthContext`) handles this natively with zero external dependencies and zero bundle penalty.
2. **Domain Data is View-Scoped:** Telemetry readings, triage patient tables, and admin lists are scoped to specific pages. Storing continuous high-frequency vitals (incoming every 5 seconds) inside a global Redux store causes unnecessary root-level re-render evaluations and boilerplate action-creator overhead.
3. **Component-Local Lifecycle:** Using `useState`, `useEffect`, and `useRef` within `PatientDetail` or `TriageDashboard` ensures that memory is automatically reclaimed when the user navigates away from a patient's view.

---

## 7. Error Handling Strategy

VitalGuard employs a three-tier defensive error handling pattern:

1. **Application & Module Error Boundaries (`ErrorBoundary.tsx`):**
   - Class-based React error boundary implementing `static getDerivedStateFromError` and `componentDidCatch`.
   - Placed at two distinct levels in `app.tsx`:
     - **App Level:** Wraps all routing to catch global rendering crashes, presenting a user-friendly recovery card with a "Reload Application" button.
     - **Admin Level:** Wraps `AdministratorPage` specifically, ensuring that an error in a complex administrative data grid does not crash the entire application, offering a "Return to Admin Overview" reset button.
   - **Crucial Invariant:** Error boundaries log debugging details to the console but **never wipe the user's session token**.
2. **API & Session Error Interception (`apiFetch.ts`):**
   - Centralizes HTTP 401 handling via decoupled custom events (`vitalguard:session-expired`).
   - Prevents cascading unauthenticated API errors by halting execution and redirecting cleanly to `/login`.
   - Distinctly isolates HTTP 403 `PASSWORD_CHANGE_REQUIRED`, routing to `/change-password` without clearing authentication.
3. **Graceful Network & Fallback UI:**
   - Network failure or offline simulator conditions do not freeze the UI. `Skeleton` loading placeholders prevent layout shifting while data loads, and `EmptyState` primitives guide users when no telemetry is found.

---

## 8. Five Key Frontend Design Decisions

1. **JWT Storage in `localStorage`:**
   - _Rationale:_ Allows instant client-side retrieval during initial page load, seamless attachment across both standard `fetch` headers and WebSocket query parameters (`new WebSocket(url?token=...)`), and decoupled deployment from cookie domain policies.
   - _Security Trade-Off:_ Accessible to client-side JavaScript (XSS risk). Mitigated by strict Content Security Policies (CSP), sanitized user inputs, and short token lifespans.
2. **Backend Polling Model for WebSocket (`/ws`):**
   - _Rationale:_ Rather than attaching an active Redis Pub/Sub subscription for every connected browser tab, the API server executes a lightweight timer that queries `readRawStatus(patientId)` from Redis every interval (`WEBSOCKET_POLL_INTERVAL_MS`).
   - _Benefit:_ Drastically simplifies connection management, prevents socket buffer overflows, throttles noisy sensor changes, and guarantees delivery of the latest aggregated state even if intermediate samples fluctuate.
3. **React Context for Authentication:**
   - _Rationale:_ Native to React, lightweight, and requires no external packages. Authentication state transitions (login, logout, token refresh) are low-frequency events, making Context performant without trigger cascades.
4. **Tailwind CSS + Custom UI Design System (`components/ui`):**
   - _Rationale:_ Provides consistent medical design tokens (slate backgrounds, semantic severity colors: emerald for normal, amber for watch, orange for warning, rose for critical), full dark mode support, zero CSS runtime overhead, and pre-built accessible components (`Card`, `Badge`, `Modal`, `Table`).
5. **Separate Dedicated Routes Per Role (`/patient`, `/doctor`, `/caregiver`, `/administrator`):**
   - _Rationale:_ Clear mental model for distinct healthcare personas. Patients need focused biometric graphs; doctors require fast high-density triage tables; caregivers need simplified status summaries; administrators require audit and governance grids. Role-isolated routes simplify access control and eliminate tangled conditional layout code.

---

## 9. Comprehensive Frontend Interview Q&A (10 High-Impact Viva Questions)

### Q1: What is React Context, and why is it used for authentication in VitalGuard?

**Answer:** React Context provides a mechanism to pass data through the component tree without manually passing props at every level ("prop drilling"). In VitalGuard, `AuthContext` provides the JWT token, authenticated user metadata (`userId`, `role`), and session methods (`login`, `logout`) globally. It is ideal here because authentication status changes very infrequently (only on login, logout, or session expiry), eliminating the need for bulky external state libraries like Redux while keeping the entire component tree synchronized.

### Q2: Why did you choose not to use Redux or Zustand for state management?

**Answer:** Redux and Zustand introduce boilerplate (actions, reducers, stores) that is unnecessary for VitalGuard. The application's state falls into two categories:

1. **Global State:** Authentication and session identity, which is small and perfectly served by React Context.
2. **Server/Telemetry State:** Real-time sensor readings and clinical tables that are view-specific and stream continuously via WebSocket. Storing high-frequency 5-second telemetry updates in a global Redux store causes unnecessary top-level re-render checks. Component-local state (`useState` + `useRef`) in `PatientDetail` isolates re-renders to only the active telemetry cards and automatically frees memory upon unmounting.

### Q3: How does the live vitals update work end-to-end, from IoT sensor to the React UI?

**Answer:**

1. The edge simulator or sensor samples motion at 10 Hz and vitals, publishing a validated JSON sample every 5 seconds over **MQTT (QoS 1)** to topic `HMS/<device_id>/vitals`.
2. The ingestion worker consumes the sample via RabbitMQ and passes it to the **Worker Analytics Service**.
3. Analytics evaluates thresholds, computes sliding Z-scores against the 7-day baseline, checks correlation rules, determines the severity tier (`Normal`, `Watch`, `Warning`, `Critical`), and writes the latest status envelope to Redis at key `patient:<patientId>:status`.
4. On the frontend, the `PatientDetail` component establishes a **WebSocket** connection to `/api/ws?token=<jwt>` and transmits `{ type: 'subscribe', patientId }`.
5. The API server verifies the token and patient association, polls Redis at intervals, and pushes `{ type: 'status', status: ... }` over the socket whenever the status changes.
6. The browser `ws.onmessage` handler receives the frame, calls `setStatus(nextStatus)`, and React reactively re-renders the biometric stat cards and severity badges.

### Q4: What is a React Error Boundary, and how is it implemented in this codebase?

**Answer:** An Error Boundary is a React class component that catches JavaScript errors anywhere in its child component tree during rendering, in lifecycle methods, and in constructors, preventing the entire application from crashing with a white screen. VitalGuard implements `ErrorBoundary` (`components/ui/error-boundary.tsx`) using `static getDerivedStateFromError(error)` to set error state and `componentDidCatch(error, errorInfo)` to log errors. It is deployed hierarchically: an application-level boundary catches fatal UI crashes, and a dedicated admin-level boundary protects the governance console. Critically, error boundaries in VitalGuard catch UI failures without clearing the user's active session.

### Q5: How do you protect routes and enforce role-based access in React Router?

**Answer:** Protection is enforced declaratively using the `<ProtectedRoute>` wrapper (`shared/auth/protected-route.tsx`). Nested inside `<Routes>`, it inspects `token` and `user` from `useAuth()`. If unauthenticated, it redirects to `/login` via `<Navigate replace />`. If an `allowedRoles` array is provided (e.g., `allowedRoles={['doctor']}`) and does not include `user.role`, it redirects the user to their authorized workspace (`/${user.role}`). It also verifies secondary requirements, such as forcing password changes (`/change-password`) and intercepting unapproved doctor accounts to `/doctor/pending`.

### Q6: What happens step-by-step when a user's session expires or an unauthorized request occurs?

**Answer:**

1. When an authenticated request is made with an expired JWT, the Fastify backend rejects it with `HTTP 401 Unauthorized`.
2. The frontend wrapper `apiFetch` detects `response.status === 401` on an authenticated request.
3. Instead of coupling network logic directly to React components, `apiFetch` dispatches a custom browser event: `window.dispatchEvent(new CustomEvent('vitalguard:session-expired', ...))`.
4. An active `useEffect` listener in `AuthProvider` catches the event, invokes `logout()` (which removes `vitalguard_token` from `localStorage` and resets React user state to `null`), and triggers a redirect to `/login?expired=true&returnUrl=<path>`.
5. The `LoginPage` reads the query parameter and displays an informative banner: _"Session expired, please log in again."_

### Q7: How is the JWT decoded client-side, and what claims are extracted?

**Answer:** The JWT is decoded in `shared/auth/auth-context.tsx` inside `decodeToken(token)` without requiring external libraries:

1. The token string is split by `.` to isolate the payload segment (`token.split('.')[1]`).
2. Base64url characters are normalized to standard Base64 (`replace(/-/g, '+').replace(/_/g, '/')`).
3. `atob()` decodes the Base64 string into a JSON string, parsed with `JSON.parse()`.
4. The function extracts `sub` (User UUID) and `role` (`patient | caregiver | doctor | administrator`).
5. It validates that `exp * 1000 > Date.now()`. If the token is corrupted, has an invalid role, or is expired, it returns `null`.

### Q8: Why is storing JWTs in `localStorage` considered less secure than `httpOnly` cookies, and what are the trade-offs?

**Answer:**

- **Vulnerability:** `localStorage` is accessible to any JavaScript running in the browser context. If an attacker successfully executes a Cross-Site Scripting (XSS) attack, they can read `localStorage.getItem('vitalguard_token')` and exfiltrate the credentials.
- **httpOnly Cookies:** An `httpOnly` cookie cannot be read by JavaScript, completely preventing token exfiltration via XSS.
- **Why VitalGuard used `localStorage`:** It simplifies development and testing across separated ports (Vite on `5173`, API on `3000`), eliminates Cross-Origin Resource Sharing (CORS) cookie domain matching issues, and allows seamless token passing in custom headers (`Authorization: Bearer`) and WebSocket connection query strings (`/api/ws?token=...`). In production, this trade-off is guarded by strict CSP headers, input sanitization, and short token expiration windows.

### Q9: How is conditional and role-based UI rendering achieved across dashboards?

**Answer:** Role-based rendering is achieved at multiple layers:

1. **Route Level:** `ProtectedRoute` prevents mounting components for unauthorized roles.
2. **Navigation Shell Level:** `AppLayout` inspects `user.role` to display appropriate portal titles, badges, and contextual navigation links (e.g., hiding governance tabs from patients).
3. **Component Level:** Components use conditional JSX (`{user.role === 'patient' && ...}`). For example, in `PatientPage`, if the patient's profile has `assignmentStatus === 'unassigned'`, a prominent alert informs them that clinical review is pending. In `CaregiverPage`, outgoing requests display interactive badges reflecting approval and patient privacy consent status.

### Q10: How does the browser WebSocket API work in VitalGuard, and how are disconnections handled?

**Answer:** In `PatientDetail`, the browser instantiates the native WebSocket object with `new WebSocket(url)`. Authentication is passed in the handshake URL query parameter (`?token=...`). Once the connection opens (`onopen`), the client sends a JSON control frame: `{ type: 'subscribe', patientId }`.

- **Message Dispatch:** As frames arrive (`onmessage`), telemetry is parsed and saved into React state.
- **Disconnection Handling:** If the WebSocket connection fails or disconnects, the component relies on its initialization fallback: an asynchronous interval poll (`setInterval` every 3 seconds to `/api/patients/:id/vitals/latest`) that keeps vitals up to date until the socket re-establishes.
- **Cleanup:** In the `useEffect` cleanup return closure, `ws.current.close()` is executed along with `clearInterval`, preventing memory leaks and zombie network sockets when navigating away.
