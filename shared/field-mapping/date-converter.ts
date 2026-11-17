export type DateFormatPattern = 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY';

export interface ParsedDateParts {
  year: number;
  month: number;
  day: number;
}

export function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

/**
 * Parses a canonical ISO YYYY-MM-DD date string safely.
 * Returns null if malformed or not a valid calendar date (e.g., 2023-02-29).
 */
export function parseIsoDate(iso: string): ParsedDateParts | null {
  if (!iso || typeof iso !== 'string') return null;
  const trimmed = iso.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isValidCalendarDate(year, month, day)) return null;
  return {year, month, day};
}

/**
 * Detects the expected target date format of a form field from its type, placeholder, label, or pattern.
 */
export function detectExpectedDateFormat(fieldMeta: {
  inputType?: string;
  placeholder?: string;
  label?: string;
  description?: string;
}): DateFormatPattern {
  if (fieldMeta.inputType?.toLowerCase() === 'date') {
    return 'YYYY-MM-DD';
  }
  const combined = `${fieldMeta.placeholder || ''} ${fieldMeta.label || ''} ${fieldMeta.description || ''}`.toLowerCase();
  if (combined.includes('mm/dd/yyyy') || combined.includes('mm-dd-yyyy')) {
    return 'MM/DD/YYYY';
  }
  if (combined.includes('dd/mm/yyyy') || combined.includes('dd-mm-yyyy') || combined.includes('দিন/মাস/বছর')) {
    return 'DD/MM/YYYY';
  }
  if (combined.includes('yyyy-mm-dd') || combined.includes('yyyy/mm/dd')) {
    return 'YYYY-MM-DD';
  }
  // Bangladesh Teletalk forms commonly use DD/MM/YYYY for text date fields if unspecified,
  // whereas native <input type="date"> requires YYYY-MM-DD.
  return 'DD/MM/YYYY';
}

/**
 * Converts a canonical YYYY-MM-DD date into the target format without mutating the source value.
 */
export function convertIsoDateToTarget(
  isoDate: string,
  targetFormat: DateFormatPattern,
): {ok: true; formatted: string; format: DateFormatPattern} | {ok: false; reason: string} {
  const parts = parseIsoDate(isoDate);
  if (!parts) {
    return {ok: false, reason: 'Invalid or non-calendar ISO date'};
  }
  const yyyy = String(parts.year).padStart(4, '0');
  const mm = String(parts.month).padStart(2, '0');
  const dd = String(parts.day).padStart(2, '0');

  switch (targetFormat) {
    case 'YYYY-MM-DD':
      return {ok: true, formatted: `${yyyy}-${mm}-${dd}`, format: targetFormat};
    case 'DD/MM/YYYY':
      return {ok: true, formatted: `${dd}/${mm}/${yyyy}`, format: targetFormat};
    case 'MM/DD/YYYY':
      return {ok: true, formatted: `${mm}/${dd}/${yyyy}`, format: targetFormat};
  }
}

/**
 * Calculates exact service duration in years, months, days from actual start & end dates.
 */
export function calculateServiceDuration(
  startDateIso: string,
  endDateIso: string | null,
  referenceDateIso?: string,
): {years: number; months: number; days: number; totalDays: number; formattedEn: string; formattedBn: string} | null {
  const start = parseIsoDate(startDateIso);
  if (!start) return null;

  const endStr =
    endDateIso && endDateIso.trim()
      ? endDateIso.trim()
      : referenceDateIso || new Date().toISOString().slice(0, 10);
  const end = parseIsoDate(endStr);
  if (!end) return null;

  const startMs = Date.UTC(start.year, start.month - 1, start.day);
  const endMs = Date.UTC(end.year, end.month - 1, end.day);
  if (endMs < startMs) return null;

  let years = end.year - start.year;
  let months = end.month - start.month;
  let days = end.day - start.day;

  if (days < 0) {
    const prevMonthLastDay = new Date(Date.UTC(end.year, end.month - 1, 0)).getUTCDate();
    days += prevMonthLastDay;
    months -= 1;
  }
  if (months < 0) {
    months += 12;
    years -= 1;
  }

  const totalDays = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24));
  const enParts: string[] = [];
  if (years > 0) enParts.push(`${years} yr${years > 1 ? 's' : ''}`);
  if (months > 0) enParts.push(`${months} mo${months > 1 ? 's' : ''}`);
  if (days > 0 || enParts.length === 0) enParts.push(`${days} day${days !== 1 ? 's' : ''}`);

  const bnParts: string[] = [];
  if (years > 0) bnParts.push(`${years} বছর`);
  if (months > 0) bnParts.push(`${months} মাস`);
  if (days > 0 || bnParts.length === 0) bnParts.push(`${days} দিন`);

  return {
    years,
    months,
    days,
    totalDays,
    formattedEn: enParts.join(' '),
    formattedBn: bnParts.join(' '),
  };
}
