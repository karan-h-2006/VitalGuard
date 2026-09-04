export const DEVICE_REGISTRATION_STATUSES = [
  'registered',
  'de-registered',
] as const;

export type DeviceRegistrationStatus =
  (typeof DEVICE_REGISTRATION_STATUSES)[number];

export interface Device {
  id: string;
  patientId: string;
  registrationStatus: DeviceRegistrationStatus;
}
