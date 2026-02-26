import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refrescar la sesión (si existe)
  const { data: { user } } = await supabase.auth.getUser()

  // REGLAS DE SEGURIDAD:
  
  // 1. Si intenta entrar a /plataformas/* y NO está logueado -> Mandar al login
  if (request.nextUrl.pathname.startsWith('/plataformas') && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 2. Si ya está logueado e intenta ir al login -> Mandar al dashboard
  if (request.nextUrl.pathname === '/login' && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role

    if (role === 'admin') {
      return NextResponse.redirect(new URL('/plataformas/admin/dashboard', request.url))
    } else if (role === 'teacher') {
      return NextResponse.redirect(new URL('/plataformas/profesores/dashboard', request.url))
    } else {
      return NextResponse.redirect(new URL('/plataformas/estudiantes/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}