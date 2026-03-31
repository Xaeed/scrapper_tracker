import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'parser123'
)

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public paths
  if (
    pathname === '/login' ||
    pathname === '/setup' ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/users/setup')
  ) {
    return NextResponse.next()
  }

  const token = req.cookies.get('session')?.value
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  try {
    const { payload } = await jwtVerify(token, SECRET)

    // Admin-only paths
    if (
      (pathname.startsWith('/admin') || pathname.startsWith('/api/users')) &&
      payload.role !== 'admin'
    ) {
      return NextResponse.redirect(new URL('/jobs', req.url))
    }
  } catch {
    const response = NextResponse.redirect(new URL('/login', req.url))
    response.cookies.delete('session')
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
