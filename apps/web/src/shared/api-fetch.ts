export type ApiFetchOptions = RequestInit & {
  skipAuthHandling?: boolean;
};

export async function apiFetch(
  input: RequestInfo | URL,
  init: ApiFetchOptions = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body === undefined || init.body === null) {
    headers.delete('Content-Type');
  } else if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(input, { ...init, headers });

  if (init.skipAuthHandling) {
    return response;
  }

  const isAuthenticated =
    headers.has('Authorization') ||
    (typeof Request !== 'undefined' &&
      input instanceof Request &&
      input.headers.has('Authorization'));

  // 1. Only HTTP 401 on an authenticated request may trigger session expiration
  if (response.status === 401 && isAuthenticated) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('vitalguard:session-expired', {
          detail: {
            pathname: window.location.pathname,
            message: 'Session expired, please log in again.',
          },
        }),
      );
    }
  }

  // 2. HTTP 403 with code PASSWORD_CHANGE_REQUIRED must redirect to /change-password, never log out
  if (response.status === 403 && isAuthenticated) {
    try {
      const cloned = response.clone();
      const body = await cloned.json();
      if (body?.code === 'PASSWORD_CHANGE_REQUIRED') {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('vitalguard:password-change-required'),
          );
        }
      }
    } catch {
      // Not JSON or empty body - ignore
    }
  }

  // 3. 403, 404, 422, 500 must NEVER clear the session; caller handles UI display
  return response;
}
