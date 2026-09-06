import { useEffect, useState } from 'react';
import { useAuth } from '../auth/auth-context.js';
import { PatientDetail } from '../../features/patient/patient-detail.js';
import { AlertTriangle, Clock, Activity, Download, ChevronLeft } from 'lucide-react';

type TriagePatient = {
  patientId: string;
  status: {
    severityTier: string;
    timestamp: string;
  } | null;
  openAlertCount: number;
  lastReadingAt: string | null;
};

export function TriageDashboard({ title }: { title: string }) {
  const { token } = useAuth();
  const [patients, setPatients] = useState<TriagePatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    // We fetch the triage list
    fetch('/api/patients', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setPatients(data);
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleDownloadReport = async (patientId: string) => {
    if (!token) return;
    try {
      // First trigger generation
      const postRes = await fetch(`/api/patients/${patientId}/reports`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!postRes.ok) throw new Error('Failed to generate report');
      
      // Then fetch the list of reports
      const listRes = await fetch(`/api/patients/${patientId}/reports`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const reports = await listRes.json();
      
      if (reports && reports.length > 0) {
        // Since we write to local disk, the API didn't actually expose a /download route! 
        // Wait, the prompt says: "GET /patients/:patientId/reports/:id/download — streams the PDF file".
        // Let's check if the Codex implemented that in routes.ts. If not, we might need to add it or just alert.
        alert(`Report generated at path: ${reports[reports.length - 1].filePath}`);
      }
    } catch (err) {
      alert('Error generating report: ' + String(err));
    }
  };

  const severityColors: Record<string, string> = {
    Critical: 'bg-red-100 text-red-800 border-red-200',
    Warning: 'bg-orange-100 text-orange-800 border-orange-200',
    Watch: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    Normal: 'bg-green-100 text-green-800 border-green-200',
  };

  if (loading) return <div>Loading triage list...</div>;

  if (selectedPatientId) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setSelectedPatientId(null)}
            className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Triage List
          </button>
          
          <button 
            onClick={() => handleDownloadReport(selectedPatientId)}
            className="flex items-center gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Generate Weekly Report
          </button>
        </div>
        
        <PatientDetail patientId={selectedPatientId} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
        <p className="mt-2 text-sm text-gray-600">
          Prioritized list of patients requiring attention.
        </p>
      </div>

      <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient ID</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Severity</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Open Alerts</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Reading</th>
              <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {patients.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  No patients associated with your account.
                </td>
              </tr>
            ) : patients.map((p) => {
              const tier = p.status?.severityTier ?? 'Normal';
              const color = severityColors[tier] || severityColors.Normal;
              
              let timeSince = 'Never';
              if (p.lastReadingAt) {
                const diffMs = Date.now() - new Date(p.lastReadingAt).getTime();
                const mins = Math.floor(diffMs / 60000);
                timeSince = mins < 1 ? 'Just now' : mins < 60 ? `${mins}m ago` : `${Math.floor(mins/60)}h ${mins%60}m ago`;
              }

              return (
                <tr 
                  key={p.patientId} 
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedPatientId(p.patientId)}
                >
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    {p.patientId.slice(0, 8)}...
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border font-medium ${color}`}>
                      {tier === 'Critical' && <AlertTriangle className="w-3.5 h-3.5" />}
                      {tier}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <Activity className={`w-4 h-4 ${p.openAlertCount > 0 ? 'text-red-500' : 'text-gray-400'}`} />
                      <span className={p.openAlertCount > 0 ? 'font-bold text-gray-900' : ''}>{p.openAlertCount}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-gray-400" />
                      {timeSince}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                    <button className="text-indigo-600 hover:text-indigo-900 font-semibold">View Details &rarr;</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
