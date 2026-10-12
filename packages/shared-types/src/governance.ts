import type { IsoDateTime } from './iso-date-time.js';

export const INSTITUTION_TYPES = ['hospital', 'clinic', 'institute'] as const;
export type InstitutionType = (typeof INSTITUTION_TYPES)[number];
export const INSTITUTION_STATUSES = ['active', 'inactive'] as const;
export type InstitutionStatus = (typeof INSTITUTION_STATUSES)[number];
export const DOCTOR_APPLICATION_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'suspended',
] as const;
export type DoctorApplicationStatus =
  (typeof DOCTOR_APPLICATION_STATUSES)[number];
export const PATIENT_ASSIGNMENT_STATUSES = ['unassigned', 'assigned'] as const;
export type PatientAssignmentStatus =
  (typeof PATIENT_ASSIGNMENT_STATUSES)[number];
export const CAREGIVER_REQUEST_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'cancelled',
] as const;
export type CaregiverRequestStatus =
  (typeof CAREGIVER_REQUEST_STATUSES)[number];
export const PATIENT_CONSENT_STATUSES = [
  'pending',
  'granted',
  'denied',
  'not_required',
] as const;
export type PatientConsentStatus = (typeof PATIENT_CONSENT_STATUSES)[number];

export interface Institution {
  id: string;
  name: string;
  type: InstitutionType;
  address?: string | null;
  city?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  status: InstitutionStatus;
  createdAt?: IsoDateTime;
}
export interface DoctorProfile {
  userId: string;
  institutionId: string;
  medicalLicenseNo: string;
  specialization: string;
  status: DoctorApplicationStatus;
  submittedAt?: IsoDateTime;
  reviewedBy?: string | null;
  reviewedAt?: IsoDateTime | null;
  rejectionReason?: string | null;
}
export interface PatientProfile {
  userId: string;
  preferredInstitutionId?: string | null;
  assignmentStatus: PatientAssignmentStatus;
  registeredAt?: IsoDateTime;
}
export interface CaregiverLinkRequest {
  id: string;
  caregiverId: string;
  patientId?: string | null;
  status: CaregiverRequestStatus;
  patientConsent: PatientConsentStatus;
  createdAt?: IsoDateTime;
}
export interface Notification {
  id: string;
  recipientId: string;
  type: string;
  title: string;
  body: string;
  payload?: Record<string, unknown> | null;
  readAt?: IsoDateTime | null;
  createdAt?: IsoDateTime;
}
