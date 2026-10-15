# Feature Modules

Each bounded context (auth, governance, patients, devices, dashboard, health) is encapsulated in its own directory here. HTTP handlers, domain helpers, schemas, and tests remain colocated within each feature module rather than scattered across a global controllers tree.

## Available Modules

- **`auth/`**: User registration (patients, caregivers, doctors), login authentication, in-memory rate limiting, Argon2id password hashing, JWT creation & verification, `/auth/me`, and mandatory first-login password changes.
- **`governance/`**: Administrator governance routes, institutional management, doctor license review (approve/reject/suspend/reinstate), patient-to-doctor assignment and inter-institutional transfer, caregiver link approvals, user account suspension/reinstate, admin audit log streaming, and simulation scenario injection.
- **`patients/`**: Patient profiles, doctor associations, caregiver consent management, and customizable vital threshold bands (`GET`/`PUT /patients/:patientId/thresholds`).
- **`devices/`**: IoT device registration status, automatic simulated device provisioning on patient registration, and internal discovery endpoint (`GET /internal/simulated-devices`) secured via `SIMULATOR_SERVICE_TOKEN`.
- **`dashboard/`**: Real-time vital summaries, historical time-series queries (24h, 7d, 30d), clinical triage patient rosters, weekly PDF clinical report generation & download, and WebSocket streaming gateway (`GET /ws`).
- **`health/`**: System health check endpoint (`GET /health`).
