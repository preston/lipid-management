// Author: Preston Lee

import { formatFhirDateTime } from './fhir-datetime';

describe('formatFhirDateTime', () => {
  it('returns null for empty values', () => {
    expect(formatFhirDateTime(null)).toBeNull();
    expect(formatFhirDateTime(undefined)).toBeNull();
    expect(formatFhirDateTime('')).toBeNull();
    expect(formatFhirDateTime('   ')).toBeNull();
  });

  it('formats FHIR date-only values without UTC day shift', () => {
    const formatted = formatFhirDateTime('2025-01-15');
    expect(formatted).toBeTruthy();
    expect(formatted).not.toContain('2025-01-15');
    expect(formatted).toMatch(/2025/);
    expect(formatted).toMatch(/15|Jan/);
  });

  it('formats year-month and year-only values', () => {
    expect(formatFhirDateTime('2025-01')).toMatch(/2025/);
    expect(formatFhirDateTime('2025')).toBe(
      new Date(2025, 0, 1).toLocaleDateString(undefined, { year: 'numeric' }),
    );
  });

  it('formats FHIR dateTimes with date and time', () => {
    const formatted = formatFhirDateTime('2025-01-15T14:30:00Z');
    expect(formatted).toBeTruthy();
    expect(formatted).toMatch(/2025/);
  });

  it('returns the original string when unparseable', () => {
    expect(formatFhirDateTime('not-a-date')).toBe('not-a-date');
  });
});
