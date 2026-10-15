import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Input,
  Select,
  Textarea,
  Stat,
  Alert,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from './index.js';

describe('UI Primitives', () => {
  it('renders Button with roll effect and variant classes', () => {
    const markup = renderToStaticMarkup(
      <Button variant="primary" rollEffect>
        Click Me
      </Button>,
    );
    expect(markup).toContain('Click Me');
    expect(markup).toContain('group');
    expect(markup).toContain('bg-brand');
  });

  it('renders Badge in bracketed and severity variants', () => {
    const bracketed = renderToStaticMarkup(
      <Badge variant="bracketed">telemetry</Badge>,
    );
    expect(bracketed).toContain('[');
    expect(bracketed).toContain('telemetry');
    expect(bracketed).toContain(']');

    const critical = renderToStaticMarkup(<Badge severity="critical" />);
    expect(critical).toContain('role="status"');
    expect(critical).toContain('Critical');
    expect(critical).toContain('bg-rose-50');

    const normal = renderToStaticMarkup(<Badge severity="normal" />);
    expect(normal).toContain('Normal');
    expect(normal).toContain('bg-emerald-50');
  });

  it('renders Card with header, title, and content', () => {
    const markup = renderToStaticMarkup(
      <Card hoverEffect>
        <CardHeader>
          <CardTitle>Vitals Telemetry</CardTitle>
        </CardHeader>
        <CardContent>72 bpm</CardContent>
        <CardFooter>Status OK</CardFooter>
      </Card>,
    );
    expect(markup).toContain('Vitals Telemetry');
    expect(markup).toContain('72 bpm');
    expect(markup).toContain('Status OK');
  });

  it('renders Input with accessible error state', () => {
    const markup = renderToStaticMarkup(
      <Input
        id="test-input"
        label="License Number"
        error="Invalid license format"
        defaultValue="123"
      />,
    );
    expect(markup).toContain('License Number');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('Invalid license format');
    expect(markup).toContain('role="alert"');
  });

  it('renders Select and Textarea primitives', () => {
    const select = renderToStaticMarkup(
      <Select
        id="role-select"
        label="Role"
        options={[
          { label: 'Doctor', value: 'doctor' },
          { label: 'Patient', value: 'patient' },
        ]}
      />,
    );
    expect(select).toContain('Role');
    expect(select).toContain('<option value="doctor">Doctor</option>');

    const textarea = renderToStaticMarkup(
      <Textarea id="note" label="Notes" helperText="Max 500 chars" />,
    );
    expect(textarea).toContain('Notes');
    expect(textarea).toContain('Max 500 chars');
  });

  it('renders Stat with unit, label, and micro-tag', () => {
    const markup = renderToStaticMarkup(
      <Stat
        value={4}
        unit="vitals"
        tag="coverage"
        label="Continuous vital streams tracked"
      />,
    );
    expect(markup).toContain('4');
    expect(markup).toContain('vitals');
    expect(markup).toContain('coverage');
    expect(markup).toContain('Continuous vital streams tracked');
  });

  it('renders Alert with severity and role', () => {
    const markup = renderToStaticMarkup(
      <Alert variant="warning" title="Warning Header">
        Threshold reached
      </Alert>,
    );
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('Warning Header');
    expect(markup).toContain('Threshold reached');
  });

  it('renders Table structure', () => {
    const markup = renderToStaticMarkup(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Header</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Data Cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(markup).toContain('Header');
    expect(markup).toContain('Data Cell');
  });
});
