const dateFormatter = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

export function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return `${dateFormatter.format(date)} UTC`;
}

export function AdminTimestamp({ value }: { value: string }) {
  return <time dateTime={value}>{formatDate(value)}</time>;
}
