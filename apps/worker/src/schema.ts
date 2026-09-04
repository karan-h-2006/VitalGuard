/**
 * Re-exports the Drizzle schema table definitions from apps/api.
 *
 * Why not put the schema in packages/shared-types?
 * The schema depends on drizzle-orm (a runtime dependency), which would
 * require adding drizzle-orm to shared-types' dependencies. shared-types
 * is intentionally a pure-TypeScript, zero-runtime-dependency package.
 *
 * Why not import directly from apps/api in consumer/ingest.ts?
 * That works at runtime but violates TypeScript's rootDir setting, which
 * prevents cross-app imports from compiling cleanly. This re-export shim
 * keeps the import path within the worker's src/ tree.
 *
 * When the project grows, consider:
 *   - A packages/db-schema package (separate from shared-types) that holds
 *     the Drizzle schema as a proper workspace dependency.
 *   - Generating Drizzle types from a database introspection step and
 *     publishing them as a package artifact.
 */

// Resolved at runtime via tsx; the relative path crosses workspace boundary
// which is fine for tsx/Node.js but requires tsconfig path mapping for tsc.
export {
  vitalReadings,
  users,
  devices,
  associations,
  associationCaregivers,
  baselines,
  thresholds,
  alerts,
  auditLog,
} from '../../api/src/db/schema.js';
