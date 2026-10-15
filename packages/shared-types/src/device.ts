export const DEVICE_REGISTRATION_STATUSES = [
  'registered',
  'de-registered',
] as const;

export type DeviceRegistrationStatus =
  (typeof DEVICE_REGISTRATION_STATUSES)[number];

export const SIM_SCENARIOS = ['normal', 'deteriorating', 'noisy'] as const;
export type SimScenario = (typeof SIM_SCENARIOS)[number];

export interface Device {
  id: string;
  patientId: string;
  registrationStatus: DeviceRegistrationStatus;
  isSimulated?: boolean;
  simScenario?: SimScenario | null;
  createdAt?: string;
}

export interface SimulatedDeviceSummary {
  deviceId: string;
  patientId: string;
  scenario: SimScenario;
}
