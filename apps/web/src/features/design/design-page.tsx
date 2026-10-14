import { useState } from 'react';
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  Select,
  Textarea,
  Modal,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Skeleton,
  EmptyState,
  Alert,
  Stat,
} from '../../components/ui/index.js';
import { Activity, Heart, Inbox } from 'lucide-react';

export function DesignPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [alertVisible, setAlertVisible] = useState(true);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-16">
      {/* Header */}
      <div className="border-b border-slate-200 pb-8 dark:border-slate-800">
        <Badge variant="bracketed">VitalGuard Design System</Badge>
        <h1 className="mt-2 font-sans text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Component Primitives & Tokens
        </h1>
        <p className="mt-2 text-base text-slate-600 dark:text-slate-400">
          Reference-inspired, clinical-grade UI primitives with accessible
          semantics, micro-labels, and roll interactions.
        </p>
      </div>

      {/* Buttons */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="bracketed">01</Badge>
          <h2 className="font-sans text-2xl font-bold text-slate-900 dark:text-slate-100">
            Buttons
          </h2>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Pill-shaped action buttons with optional text-roll animation on hover
          and loading spinners.
        </p>
        <div className="flex flex-wrap items-center gap-4 p-6 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <Button variant="primary" rollEffect>
            Primary Roll
          </Button>
          <Button variant="secondary" rollEffect>
            Secondary Roll
          </Button>
          <Button variant="outline" rollEffect>
            Outline Roll
          </Button>
          <Button variant="ghost">Ghost Button</Button>
          <Button variant="danger">Danger Action</Button>
          <Button variant="primary" loading>
            Loading
          </Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Heart className="h-3.5 w-3.5" />}
          >
            Small Icon
          </Button>
          <Button variant="primary" size="lg" rollEffect>
            Large CTA
          </Button>
        </div>
      </section>

      {/* Badges & Severity */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="bracketed">02</Badge>
          <h2 className="font-sans text-2xl font-bold text-slate-900 dark:text-slate-100">
            Badges & Severity
          </h2>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Bracketed micro-labels and semantic severity indicators with WCAG AA
          compliance (4.5:1+) and dedicated icons.
        </p>
        <div className="flex flex-wrap items-center gap-4 p-6 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <Badge variant="bracketed">telemetry 01</Badge>
          <Badge variant="bracketed">step 02</Badge>
          <Badge variant="default">Default Pill</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="teal">Teal Highlight</Badge>
          <Badge severity="normal" />
          <Badge severity="watch" />
          <Badge severity="warning" />
          <Badge severity="critical" />
        </div>
      </section>

      {/* Cards */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="bracketed">03</Badge>
          <h2 className="font-sans text-2xl font-bold text-slate-900 dark:text-slate-100">
            Cards
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card hoverEffect>
            <CardHeader>
              <Badge variant="bracketed" className="mb-2">
                Metric Card
              </Badge>
              <CardTitle>Heart Rate Sensor</CardTitle>
              <CardDescription>
                Continuous optical photoplethysmography
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono text-slate-900 dark:text-slate-100">
                72 bpm
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Normal sinus rhythm detected
              </p>
            </CardContent>
            <CardFooter>
              <Badge severity="normal" />
              <Button size="sm" variant="ghost">
                Details
              </Button>
            </CardFooter>
          </Card>

          <Card hoverEffect>
            <CardHeader>
              <Badge variant="bracketed" className="mb-2">
                Alert Card
              </Badge>
              <CardTitle>Oxygen Saturation</CardTitle>
              <CardDescription>
                Peripheral capillary saturation (SpO2)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono text-rose-600">
                89%
              </div>
              <p className="mt-1 text-xs text-rose-600">
                Hypoxemia threshold breached (&lt; 90%)
              </p>
            </CardContent>
            <CardFooter>
              <Badge severity="critical" />
              <Button size="sm" variant="danger">
                Triage Now
              </Button>
            </CardFooter>
          </Card>

          <Card hoverEffect>
            <CardHeader>
              <Badge variant="bracketed" className="mb-2">
                System Status
              </Badge>
              <CardTitle>MQTT Telemetry Ingestion</CardTitle>
              <CardDescription>Kafka broker & stream analytics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono text-teal-600">
                5.2s
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Median ingest latency
              </p>
            </CardContent>
            <CardFooter>
              <Badge variant="teal">Connected</Badge>
              <Button size="sm" variant="outline">
                Inspect
              </Button>
            </CardFooter>
          </Card>
        </div>
      </section>

      {/* Form Controls */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="bracketed">04</Badge>
          <h2 className="font-sans text-2xl font-bold text-slate-900 dark:text-slate-100">
            Form Controls
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <Input
            label="Email address"
            placeholder="doctor@hospital.org"
            leftIcon={<Activity className="h-4 w-4" />}
          />
          <Input
            label="Password (with toggle)"
            type="password"
            placeholder="••••••••••••"
            helperText="Minimum 12 characters"
          />
          <Input
            label="Input with Validation Error"
            error="License number is required for doctor verification"
            defaultValue="INVALID"
          />
          <Select
            label="User Role"
            options={[
              { label: 'Doctor (Clinical Staff)', value: 'doctor' },
              { label: 'Patient (Self-Monitoring)', value: 'patient' },
              { label: 'Caregiver (Family / Proxy)', value: 'caregiver' },
            ]}
          />
          <div className="md:col-span-2">
            <Textarea
              label="Clinical Notes"
              placeholder="Enter clinical assessment or caregiver relationship note..."
              helperText="Maximum 500 characters"
            />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="bracketed">05</Badge>
          <h2 className="font-sans text-2xl font-bold text-slate-900 dark:text-slate-100">
            Animated Stats
          </h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <Stat
            value={4}
            tag="coverage"
            label="Continuous vital streams tracked"
            animate
          />
          <Stat
            value={5}
            unit="s"
            tag="interval"
            label="Ingestion & rule evaluation cycle"
            animate
          />
          <Stat
            value={4}
            tag="governance"
            label="Granular role access domains"
            animate
          />
          <Stat
            value={3}
            tag="alerting"
            label="Hierarchical severity triage tiers"
            animate
          />
        </div>
      </section>

      {/* Table */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="bracketed">06</Badge>
          <h2 className="font-sans text-2xl font-bold text-slate-900 dark:text-slate-100">
            Table
          </h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead>Heart Rate</TableHead>
              <TableHead>SpO2</TableHead>
              <TableHead>Temperature</TableHead>
              <TableHead>Triage Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">PT-8402 (Jane Doe)</TableCell>
              <TableCell className="font-mono">74 bpm</TableCell>
              <TableCell className="font-mono">98%</TableCell>
              <TableCell className="font-mono">36.8 °C</TableCell>
              <TableCell>
                <Badge severity="normal" />
              </TableCell>
              <TableCell>
                <Button size="sm" variant="outline">
                  Review
                </Button>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">
                PT-9130 (Alex Smith)
              </TableCell>
              <TableCell className="font-mono text-rose-600 font-bold">
                128 bpm
              </TableCell>
              <TableCell className="font-mono text-rose-600 font-bold">
                91%
              </TableCell>
              <TableCell className="font-mono">38.4 °C</TableCell>
              <TableCell>
                <Badge severity="critical" />
              </TableCell>
              <TableCell>
                <Button size="sm" variant="danger">
                  Escalate
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </section>

      {/* Tabs & Accordion */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="bracketed">07</Badge>
          <h2 className="font-sans text-2xl font-bold text-slate-900 dark:text-slate-100">
            Tabs & Accordion
          </h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Tabs Variations</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="overview" variant="bracketed">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="vitals">Live Vitals</TabsTrigger>
                  <TabsTrigger value="audit">Audit Log</TabsTrigger>
                </TabsList>
                <TabsContent value="overview">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Bracketed tabs inspired by checkpointresearch navigation
                    aesthetic.
                  </p>
                </TabsContent>
                <TabsContent value="vitals">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Real-time telemetry streams rendered with high-contrast
                    sparklines.
                  </p>
                </TabsContent>
                <TabsContent value="audit">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Immutable event log recording all role actions and
                    administrative reviews.
                  </p>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>FAQ Accordion</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" defaultValue="item-1">
                <AccordionItem value="item-1">
                  <AccordionTrigger>
                    How often are patient vitals ingested?
                  </AccordionTrigger>
                  <AccordionContent>
                    Telemetry is sampled at ~5-second intervals via MQTT,
                    verified by streaming consumers, and checked against alert
                    thresholds in real time.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                  <AccordionTrigger>
                    Can caregivers view data without patient consent?
                  </AccordionTrigger>
                  <AccordionContent>
                    No. Every caregiver link request requires explicit approval
                    by an administrator and two-way verification before any
                    clinical metrics are accessible.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Modal, Alert & Skeleton */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="bracketed">08</Badge>
          <h2 className="font-sans text-2xl font-bold text-slate-900 dark:text-slate-100">
            Feedback, Dialog & Loading
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Accessible Modal</CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="primary" onClick={() => setModalOpen(true)}>
                Open Test Modal
              </Button>
            </CardContent>
          </Card>

          <Card className="space-y-3">
            <CardTitle>Skeleton Shimmer</CardTitle>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-full" />
          </Card>

          <Card>
            <EmptyState
              icon={<Inbox className="h-6 w-6" />}
              title="No Pending Requests"
              description="All caregiver access and doctor onboarding requests have been reviewed."
            />
          </Card>
        </div>

        {alertVisible && (
          <Alert
            variant="warning"
            title="Clinical Alert Notice"
            onClose={() => setAlertVisible(false)}
          >
            VitalGuard is a student/team research project and not a certified
            medical device. Never use it for life-critical clinical decisions.
          </Alert>
        )}
      </section>

      {/* Modal Instance */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Approve Doctor Application"
        description="Verify Dr. Sarah Connor for Memorial Health System"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setModalOpen(false)}>
              Confirm Approval
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
          <p>
            License ID:{' '}
            <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
              MED-99482-ON
            </span>
          </p>
          <p>
            Specialization:{' '}
            <span className="font-medium text-slate-900 dark:text-slate-100">
              Cardiology
            </span>
          </p>
          <p>
            Approving will grant clinical triage access to patients assigned
            within this hospital.
          </p>
        </div>
      </Modal>
    </div>
  );
}
