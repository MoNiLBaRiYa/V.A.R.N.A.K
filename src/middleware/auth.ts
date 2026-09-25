import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function validateApiSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Exclude health check or public routes from mandatory session
  if (pathname === '/api/v1/health' || pathname.startsWith('/api/auth')) {
    return null;
  }

  // Intercept all protected /api/v1/* endpoints
  if (pathname.startsWith('/api/v1/')) {
    // Check for Auth.js session cookie
    const sessionToken =
      request.cookies.get('__Secure-authjs.session-token')?.value ||
      request.cookies.get('authjs.session-token')?.value ||
      request.cookies.get('next-auth.session-token')?.value ||
      request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!sessionToken) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Authentication session required to access /api/v1 endpoints',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }
  }

  return null;
}
