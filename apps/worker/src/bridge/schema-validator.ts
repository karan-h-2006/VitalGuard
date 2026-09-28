import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { ErrorObject } from 'ajv';
import type { VitalSample } from '@vitalguard/shared-types';

export interface VitalSampleValidator {
  validate(
    payload: unknown,
  ): { valid: true; sample: VitalSample } | { valid: false; reason: string };
}

export function resolveVitalSampleSchemaPath(
  fromUrl: string = import.meta.url,
): string {
  let directory = dirname(fileURLToPath(fromUrl));
  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = join(directory, 'schemas', 'vital-sample.schema.json');
    if (existsSync(candidate)) {
      return candidate;
    }
    directory = dirname(directory);
  }
  throw new Error(
    'Could not locate schemas/vital-sample.schema.json from the worker process',
  );
}

export async function loadVitalSampleValidator(): Promise<VitalSampleValidator> {
  const schema = JSON.parse(
    await readFile(resolveVitalSampleSchemaPath(), 'utf8'),
  ) as object;
  // @ts-expect-error - ESM interop for Ajv2020 constructor
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  // @ts-expect-error - ESM interop for addFormats callable
  addFormats(ajv);
  const validate = ajv.compile<VitalSample>(schema);

  return {
    validate(payload: unknown) {
      if (validate(payload)) {
        return { valid: true, sample: payload as VitalSample };
      }
      return { valid: false, reason: formatErrors(validate.errors) };
    },
  };
}

function formatErrors(errors: ErrorObject[] | null | undefined): string {
  return (errors ?? [])
    .map(
      (error) =>
        `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`,
    )
    .join('; ');
}
