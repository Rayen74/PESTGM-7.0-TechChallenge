import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/request';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Read auth token and role from cookies
  const token = request.cookies.get('steg_token')?.value;
  const role = request.cookies.get('steg_role')?.value;

  // Protect admin routes
  if (pathname.startsWith('/admin')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    if (role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/citizen', request.url));
    }
  }

  // Protect citizen routes
  if (pathname.startsWith('/citizen')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // If already authenticated and accessing login, register, or forgot-password, redirect to portal
  if (pathname === '/login' || pathname === '/register' || pathname === '/forgot-password') {
    if (token) {
      if (role === 'ADMIN') {
        return NextResponse.redirect(new URL('/admin', request.url));
      } else {
        return NextResponse.redirect(new URL('/citizen', request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/citizen/:path*', '/login', '/register', '/forgot-password'],
};
