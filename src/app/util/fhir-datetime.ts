// Author: Preston Lee

/**
 * Format a FHIR date or dateTime for display.
 * Date-only values stay calendar-local (avoids UTC day-shift); dateTimes use locale medium + short time.
 */
export function formatFhirDateTime(value: string | undefined | null): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const dateOnly = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(trimmed);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = dateOnly[2] != null ? Number(dateOnly[2]) : 1;
    const day = dateOnly[3] != null ? Number(dateOnly[3]) : 1;
    const local = new Date(year, month - 1, day);
    if (Number.isNaN(local.getTime())) {
      return trimmed;
    }
    if (dateOnly[3] == null && dateOnly[2] == null) {
      return local.toLocaleDateString(undefined, { year: 'numeric' });
    }
    if (dateOnly[3] == null) {
      return local.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
    }
    return local.toLocaleDateString(undefined, { dateStyle: 'medium' });
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return trimmed;
  }
  return parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
