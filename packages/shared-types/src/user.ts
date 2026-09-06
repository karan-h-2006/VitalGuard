import type { IsoDateTime } from './iso-date-time.js';

export const USER_ROLES = [
  'patient',
  'caregiver',
  'doctor',
  'administrator',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface User {
  id: string;
  role: UserRole;
  email: string;
  phoneNumber?: string | null;
  createdAt?: IsoDateTime;
}
