export interface MobileEnvironment {
  supabaseUrl: string;
  supabasePublishableKey: string;
  apiUrl: string;
}

const readHttpUrl = (value: string | undefined, name: string): string => {
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  try {
    const parsed = new URL(value);
    if (
      (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') ||
      parsed.username ||
      parsed.password ||
      (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:')
    ) {
      throw new Error('Unsupported or insecure URL');
    }
    return value.replace(/\/+$/, '');
  } catch {
    throw new Error(`${name} must be a valid HTTP or HTTPS URL.`);
  }
};

export const getMobileEnvironment = (): MobileEnvironment => {
  const supabasePublishableKey =
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabasePublishableKey) {
    throw new Error('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not configured.');
  }

  return {
    supabaseUrl: readHttpUrl(
      process.env.EXPO_PUBLIC_SUPABASE_URL,
      'EXPO_PUBLIC_SUPABASE_URL',
    ),
    supabasePublishableKey,
    apiUrl: readHttpUrl(
      process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
      'EXPO_PUBLIC_API_URL',
    ),
  };
};
