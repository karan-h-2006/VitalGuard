/**
 * Links a patient to the clinician and caregiver(s) who may see their data
 * and receive escalations. Persistence primary key is deferred to the
 * Phase 1 schema — this shape matches the OpenAPI contract.
 */
export interface Association {
  patientId: string;
  doctorId: string;
  caregiverIds: string[];
}
