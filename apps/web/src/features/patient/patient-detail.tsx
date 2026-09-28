import { useEffect, useState, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Activity,
  Heart,
  Thermometer,
  ActivitySquare,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../shared/auth/auth-context.js';

type PatientDetailProps = {
  patientId: string;
};

type VitalsStatus = {
  severityTier: 'Normal' | 'Watch' | 'Warning' | 'Critical';
  latestVitals: {
    heart_rate?: { value: number | string; timestamp?: string };
    spo2?: { value: number | string; timestamp?: string };
    temperature?: { value: number | string; timestamp?: string };
    motion?: { value: number | string; timestamp?: string };
  };
  explanation?: string;
  timestamp: string;
};

type HistoryPoint = {
  timestamp: string;
  value: number;
};

export function PatientDetail({ patientId }: PatientDetailProps) {
  const { token } = useAuth();
  const [status, setStatus] = useState<VitalsStatus | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [range, setRange] = useState('24h');
  const [vitalType, setVitalType] = useState('heart_rate');
  const [loading, setLoading] = useState(true);

  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!token) return;

    let mounted = true;

    // Fetch initial latest vitals
    fetch(`/api/patients/${patientId}/vitals/latest`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (mounted && data && data.status) {
          setStatus(data.status);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    // Connect WebSocket
    const socketUrl = new URL('/api/ws', window.location.origin);
    socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    socketUrl.searchParams.set('token', token);

    ws.current = new WebSocket(socketUrl.toString());
    ws.current.onopen = () => {
      ws.current?.send(JSON.stringify({ type: 'subscribe', patientId }));
    };
    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'subscribed' || data.type === 'error') return;

        const nextStatus =
          data.status ?? (data.severityTier && data.latestVitals ? data : null);
        if (nextStatus) {
          setStatus(nextStatus);

          // Also opportunistically append to history if it matches the current view
          // But only if it's new data to avoid duplication. For simplicity, we can
          // just let it update the current view, and if they change range we refetch.
        }
      } catch (e) {
        console.error('Failed to parse WS message', e);
      }
    };

    return () => {
      mounted = false;
      if (ws.current) ws.current.close();
    };
  }, [patientId, token]);

  useEffect(() => {
    if (!token) return;

    // Fetch history whenever range or vitalType changes
    fetch(
      `/api/patients/${patientId}/vitals/history?range=${range}&vitalType=${vitalType}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.points) {
          setHistory(data.points);
        }
      });
  }, [patientId, token, range, vitalType]);

  const severityColors = {
    Normal: 'bg-green-100 text-green-800 border-green-200',
    Watch: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    Warning: 'bg-orange-100 text-orange-800 border-orange-200',
    Critical: 'bg-red-100 text-red-800 border-red-200 animate-pulse',
  };

  if (loading) return <div>Loading patient data...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Live Vitals</h2>

        {status && (
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-full border ${severityColors[status.severityTier]}`}
          >
            <AlertTriangle className="w-5 h-5" />
            <span className="font-semibold">{status.severityTier}</span>
          </div>
        )}
      </div>

      {status?.explanation && (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-gray-700">
          <strong>Status Note: </strong> {status.explanation}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <VitalCard
          title="Heart Rate"
          icon={<Heart className="w-5 h-5 text-red-500" />}
          value={status?.latestVitals?.heart_rate?.value}
          unit="bpm"
        />
        <VitalCard
          title="SpO2"
          icon={<Activity className="w-5 h-5 text-blue-500" />}
          value={status?.latestVitals?.spo2?.value}
          unit="%"
        />
        <VitalCard
          title="Temperature"
          icon={<Thermometer className="w-5 h-5 text-orange-500" />}
          value={status?.latestVitals?.temperature?.value}
          unit="°C"
        />
        <VitalCard
          title="Motion"
          icon={<ActivitySquare className="w-5 h-5 text-purple-500" />}
          value={status?.latestVitals?.motion?.value}
          unit="units"
        />
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h3 className="text-xl font-semibold text-gray-900">
            History & Trends
          </h3>

          <div className="flex flex-wrap gap-4">
            <select
              value={vitalType}
              onChange={(e) => setVitalType(e.target.value)}
              className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="heart_rate">Heart Rate</option>
              <option value="spo2">SpO2</option>
              <option value="temperature">Temperature</option>
              <option value="motion">Motion</option>
            </select>

            <div className="flex bg-gray-100 rounded-lg p-1">
              {['24h', '7d', '30d'].map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${range === r ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(val) =>
                  new Date(val).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                }
                minTickGap={30}
              />
              <YAxis domain={['auto', 'auto']} />
              <Tooltip
                labelFormatter={(val) => new Date(val).toLocaleString()}
                formatter={(value: number) => [value.toFixed(1), vitalType]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#4f46e5"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function VitalCard({
  title,
  icon,
  value,
  unit,
}: {
  title: string;
  icon: React.ReactNode;
  value?: number | string;
  unit: string;
}) {
  const numericValue = value === undefined ? undefined : Number(value);
  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col">
      <div className="flex items-center gap-2 text-gray-500 mb-3">
        {icon}
        <span className="font-medium">{title}</span>
      </div>
      <div className="flex items-baseline gap-2 mt-auto">
        <span className="text-3xl font-bold text-gray-900">
          {numericValue !== undefined && Number.isFinite(numericValue)
            ? numericValue.toFixed(1)
            : '--'}
        </span>
        <span className="text-gray-500 font-medium">{unit}</span>
      </div>
    </div>
  );
}
