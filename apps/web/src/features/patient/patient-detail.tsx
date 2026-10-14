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
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../shared/auth/auth-context.js';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Select,
  Skeleton,
} from '../../components/ui/index.js';
import type { SeverityLevel } from '../../components/ui/badge.js';

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

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  const severityProp = (status?.severityTier?.toLowerCase() ??
    'normal') as SeverityLevel;

  return (
    <div className="space-y-6">
      {/* Live Vitals Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <Badge variant="bracketed" className="mb-1">
            Telemetry Status
          </Badge>
          <h2 className="font-sans text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Live Vitals
          </h2>
        </div>

        {status && (
          <Badge severity={severityProp} size="md">
            {status.severityTier} Tier
          </Badge>
        )}
      </div>

      {status?.explanation && (
        <Card className="border-l-4 border-l-brand bg-slate-50/50 dark:bg-slate-900/50 py-4">
          <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
            <strong className="font-semibold text-slate-900 dark:text-slate-100 font-mono uppercase text-xs mr-2">
              Status Note:
            </strong>
            {status.explanation}
          </div>
        </Card>
      )}

      {/* Vitals Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <VitalCard
          title="Heart Rate"
          icon={<Heart className="h-4 w-4 text-rose-500" />}
          value={status?.latestVitals?.heart_rate?.value}
          unit="bpm"
        />
        <VitalCard
          title="SpO2"
          icon={<Activity className="h-4 w-4 text-sky-500" />}
          value={status?.latestVitals?.spo2?.value}
          unit="%"
        />
        <VitalCard
          title="Temperature"
          icon={<Thermometer className="h-4 w-4 text-amber-500" />}
          value={status?.latestVitals?.temperature?.value}
          unit="°C"
        />
        <VitalCard
          title="Motion"
          icon={<ActivitySquare className="h-4 w-4 text-purple-500" />}
          value={status?.latestVitals?.motion?.value}
          unit="units"
        />
      </div>

      {/* History & Trends Chart Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-brand" />
              <CardTitle className="text-lg">History &amp; Trends</CardTitle>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Select
                aria-label="Select vital type"
                value={vitalType}
                onChange={(e) => setVitalType(e.target.value)}
                className="w-40 py-1.5 text-xs font-mono"
                options={[
                  { label: 'Heart Rate', value: 'heart_rate' },
                  { label: 'SpO2', value: 'spo2' },
                  { label: 'Temperature', value: 'temperature' },
                  { label: 'Motion', value: 'motion' },
                ]}
              />

              {/* Range Toggle Pills */}
              <div className="flex rounded-full border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-800/60">
                {['24h', '7d', '30d'].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`rounded-full px-3 py-1 font-mono text-xs uppercase tracking-wider transition-all ${
                      range === r
                        ? 'bg-white font-semibold text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="h-[300px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e2e8f0"
                />
                <XAxis
                  dataKey="timestamp"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) =>
                    new Date(val).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  }
                  minTickGap={35}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    fontSize: '12px',
                    fontFamily: 'JetBrains Mono',
                  }}
                  labelFormatter={(val) => new Date(val).toLocaleString()}
                  formatter={(value: number) => [value.toFixed(1), vitalType]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#0284c7"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill: '#0284c7',
                    strokeWidth: 2,
                    stroke: '#ffffff',
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
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
    <Card hoverEffect className="p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between text-slate-500 mb-3">
        <span className="font-mono text-xs uppercase tracking-wider font-medium text-slate-600 dark:text-slate-400">
          {title}
        </span>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-800">
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-2 mt-auto font-mono">
        <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {numericValue !== undefined && Number.isFinite(numericValue)
            ? numericValue.toFixed(1)
            : '--'}
        </span>
        <span className="text-xs font-medium text-slate-500">{unit}</span>
      </div>
    </Card>
  );
}
