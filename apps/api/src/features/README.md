# Feature modules

Each bounded context (auth, alerts, vitals, users, …) gets a folder here
in later phases. Keep HTTP handlers, domain helpers, and tests for that
feature together — do not introduce a global `/controllers` tree.

`health/` is the only module in Phase 0.
