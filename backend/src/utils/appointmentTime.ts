export function formatAppointmentTime(value?: string): string {
  if (!value?.trim()) return 'Por coordinar';
  const match = value.trim().match(/^(\d{1,2}):([0-5]\d)(?::[0-5]\d)?(?:\s*-\s*(\d{1,2}):([0-5]\d)(?::[0-5]\d)?)?$/);
  if (!match) return value;
  const convert = (hours: string, minutes: string) => {
    const hour = Number(hours);
    if (hour > 23) return `${hours}:${minutes}`;
    return `${hour % 12 || 12}:${minutes} ${hour >= 12 ? 'p. m.' : 'a. m.'}`;
  };
  const start = convert(match[1], match[2]);
  return match[3] ? `${start} - ${convert(match[3], match[4])}` : start;
}
