const LOOSE_DATE_REGEX = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})(?:\s+at\s+(\d{1,2}):(\d{2}))?$/i;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function parseLooseDate(input: string | null | undefined): Date | null {
  if (!input) {
    return null;
  }

  const raw = input.trim();
  if (!raw) {
    return null;
  }

  const match = raw.match(LOOSE_DATE_REGEX);
  if (match) {
    const [, dayStr, monthStr, yearStr, hourStr, minuteStr] = match;
    const day = Number.parseInt(dayStr, 10);
    const month = Number.parseInt(monthStr, 10) - 1;
    const year = Number.parseInt(yearStr, 10);
    const hours = hourStr ? Number.parseInt(hourStr, 10) : 0;
    const minutes = minuteStr ? Number.parseInt(minuteStr, 10) : 0;

    const constructed = new Date(year, month, day, hours, minutes);

    if (
      constructed.getFullYear() === year &&
      constructed.getMonth() === month &&
      constructed.getDate() === day &&
      constructed.getHours() === hours &&
      constructed.getMinutes() === minutes
    ) {
      return constructed;
    }
  }

  const fallback = Number.isNaN(Date.parse(raw)) ? null : new Date(raw);
  return fallback;
}

export function formatDate(value: string | null | undefined): string {
  if (!value || !value.trim()) {
    return 'Без даты';
  }

  const parsed = parseLooseDate(value);
  if (!parsed) {
    return value;
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(parsed);
  } catch (error) {
    console.error('Failed to format date', error);
    return value;
  }
}

export function toDateTimeLocalInputValue(value: string | null | undefined): string {
  const parsed = parseLooseDate(value);
  if (!parsed) {
    return '';
  }

  const year = parsed.getFullYear();
  const month = pad(parsed.getMonth() + 1);
  const day = pad(parsed.getDate());
  const hours = pad(parsed.getHours());
  const minutes = pad(parsed.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function fromDateTimeLocalInput(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const parsed = parseLooseDate(value);
  if (!parsed) {
    return null;
  }

  return parsed.toISOString();
}
