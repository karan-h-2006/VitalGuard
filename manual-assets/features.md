# VitalGuard user-facing feature guide

The application has four account roles: patient, caregiver, doctor, and administrator. Patients, caregivers, and doctors can register publicly; administrators are provisioned separately. This combined flow follows the order a user encounters features, with role-specific pages called out where they appear.

## 1. Access and account setup

- **Sign in** (`/login`, all roles): enter email and password; invalid credentials show an inline error; successful login routes to the role dashboard. The sign-in button disables while submitting.
- **Register** (`/register`, patient/caregiver/doctor): choose account type, email, and password (at least 10 characters); patients may choose a preferred institution, caregivers may optionally enter a patient email, and doctors must select an institution and supply license number and specialization. Doctor applications start pending review. Registration has HTML required-field and email validation.
- **Doctor application pending** (`/doctor/pending`, pending/rejected doctor): see review status, rejection reason and reapplication eligibility; eligible doctors can choose an institution and resubmit license/specialization details.
- **Change password** (`/change-password`, authenticated users requiring a password update or using the route): enter current password and a new password (at least 12 characters); success signs the user out so they can sign in again.

## 2. Dashboard

- **Patient dashboard** (`/patient`): shows assignment status, live severity, latest heart rate, oxygen saturation, temperature and motion, plus history chart controls (vital selector; 24h/7d/30d). Critical, Warning, Watch, and Normal states are displayed with status explanation when available. `Last reading: Never` is shown if no device sample exists. Link to **Who can see my data?** for consent management.
- **Doctor triage dashboard** (`/doctor`): prioritized patient table with patient label/short ID, severity, open alert count and relative last-reading time. Select a row to open live vitals and trend history; generate/download a weekly PDF report; return to the triage list.
- **Caregiver dashboard** (`/caregiver`): when linked patients exist, show their triage view. With no linked patient, submit an access request using patient email and an optional relationship note (up to 500 characters), and review request status. Information is hidden until review and consent.
- **Administrator console** (`/administrator`): section navigation for Overview, Doctor requests, Institutions, Doctors, Patients, Caregiver links, Users, and Audit log. Admin actions show inline success/error feedback and prevent duplicate in-flight actions.
- **Global notifications** (authenticated roles): bell shows unread count, opens notification list, supports marking one/all read, and shows an empty state when caught up.

## 3. Core governance and care actions

- **Doctor requests** (administrator): search pending requests; inspect doctor email, institution, specialization, and license; approve or reject (rejection requires a reason). Approval unlocks doctor access.
- **Institutions** (administrator): search/list institutions; create with name, type (hospital/clinic/institute), and optional city; edit institution name; activate/deactivate. Institution status/preference constrains doctor assignment unless an admin supplies an override reason.
- **Doctors** (administrator): filter approved/suspended doctors, search, suspend with a required reason, or reinstate.
- **Patients** (administrator): list all patients (unassigned first by default); filter All/Unassigned/Assigned, institution, and search. Show preferred institution and current doctor(s), mark primary doctor, assign an approved doctor, transfer between doctors, unassign a doctor, and optionally override institution preference with a reason.
- **Caregiver links** (administrator): review pending link requests and approve/reject (reason on rejection); create a direct caregiver-patient link by IDs. Approval can require patient consent.
- **Patient access controls** (patient): review pending caregiver consent requests and grant/deny them; inspect active caregivers and revoke access.
- **Caregiver link request** (caregiver): request access to a registered patient; view pending/approved/rejected status.
- **Users** (administrator): search users, review role/account status and reinstate suspended non-doctor accounts; doctors are managed in the Doctors section.
- **Audit log** (administrator): search entries, filter actor/action/date range, see resolved actor/target labels and IDs, and expand before/after details.

## 4. Alerts, readings, and reports

- Device/simulator readings include heart rate, SpO2, temperature, and motion. Patients see current readings and a time-series chart; doctors/caregivers see severity-prioritized triage rows.
- An abnormal sample can raise Critical/Warning severity and open-alert count. Severity ordering is Critical > Warning > Watch > Normal.
- Patient detail lets the user select the vital and history window. A user with doctor access can generate and download a weekly PDF report.
- Assignment and governance updates can trigger in-app notifications; configured email delivery uses sandbox logging when external email is not configured.

## 5. Settings and privacy

- Patients manage caregiver consent and revoke existing access from **Who can see my data?**.
- Users update their password through **Change your password** when that flow is enabled for their account.
- There is no separate user-facing profile or device-settings page in the current route tree.

## 6. Sign out

- **Sign out** is available in the shared header for every authenticated role. It calls the logout endpoint, clears local session state, and returns to sign-in.

## Capture scope notes

Current routes are `/login`, `/register`, `/change-password`, `/patient`, `/patient/access`, `/caregiver`, `/doctor`, `/doctor/pending`, and `/administrator`. The administrator sections are client-side tabs rather than separate URLs. The app has no upload input in its current UI. Hardware and email delivery are not needed for manual captures; screenshots use fabricated account/data fixtures and local mock API responses.
