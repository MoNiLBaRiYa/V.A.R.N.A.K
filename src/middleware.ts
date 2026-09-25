import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validateApiSession } from '@/middleware/auth';

export async function middleware(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

  // 1. Check authentication for protected /api/v1/* routes
  const authResponse = await validateApiSession(request);
  if (authResponse) {
    authResponse.headers.set('x-correlation-id', correlationId);
    return authResponse;
  }

  // 2. Prepare downstream request headers with correlation ID
  const response = NextResponse.next({
    request: {
      headers: new Headers(request.headers),
    },
  });

  response.headers.set('x-correlation-id', correlationId);

  // 3. Track client IP for rate limiting inspection
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const ip = request.ip || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
    response.headers.set('X-Client-IP', ip);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
