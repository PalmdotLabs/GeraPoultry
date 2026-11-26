export interface CallbackAuth {
  exchangeCodeForSession(code: string): Promise<{ error: unknown }>;
  verifyOtp(input: {
    token_hash: string;
    type: 'invite' | 'recovery';
  }): Promise<{ error: unknown }>;
}

/** Accept only the two password-setup email flows or a PKCE exchange. */
export async function verifyAuthCallback(
  params: URLSearchParams,
  auth: CallbackAuth,
): Promise<boolean> {
  for (const key of ['code', 'token_hash', 'type']) {
    if (params.getAll(key).length > 1) return false;
  }
  const code = params.get('code');
  const tokenHash = params.get('token_hash');
  const type = params.get('type');
  if (code && !tokenHash && !type) {
    return !(await auth.exchangeCodeForSession(code)).error;
  }
  if (!code && tokenHash && (type === 'invite' || type === 'recovery')) {
    return !(await auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }
  return false;
}
