const LOCAL_ORIGIN = 'http://fieldbook.local';

export function safeLocalDestination(
  value: string | null | undefined,
  fallback = '/dashboard',
): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return fallback;
  }

  try {
    const destination = new URL(value, LOCAL_ORIGIN);
    if (destination.origin !== LOCAL_ORIGIN) {
      return fallback;
    }

    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return fallback;
  }
}
