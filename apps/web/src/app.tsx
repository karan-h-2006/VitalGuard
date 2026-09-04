import { Navigate, Route, Routes } from 'react-router-dom';
import { AdministratorPage } from './features/administrator/administrator-page.js';
import { CaregiverPage } from './features/caregiver/caregiver-page.js';
import { DoctorPage } from './features/doctor/doctor-page.js';
import { PatientPage } from './features/patient/patient-page.js';
import { AppLayout } from './shared/layout/app-layout.js';

export function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/patient" element={<PatientPage />} />
        <Route path="/caregiver" element={<CaregiverPage />} />
        <Route path="/doctor" element={<DoctorPage />} />
        <Route path="/administrator" element={<AdministratorPage />} />
        <Route path="*" element={<Navigate replace to="/patient" />} />
      </Routes>
    </AppLayout>
  );
}
