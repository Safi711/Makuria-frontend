import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/workspace",
  "/matters",
  // «/case-mapper» was here until 2026-09-28. It is now PUBLIC, by Safi's
  // decision: «المستشار القانوني الذكي» is the reason the site exists, it is
  // linked from the main navigation on every page, and a visitor who clicked
  // that link was redirected to /login. A locked front door on the one tool
  // the site is built around.
  //
  // Nothing is given away by opening it: the page reads the same public
  // corpus as /search and /laws, through the same anon key under the same
  // RLS policies, and writes nothing. Saving an analysis to a matter stays
  // behind /matters, which is still protected.
  "/quick-check",
  "/practical-law",
  "/alerts",
];

/**
 * Refreshes the Supabase session on every request and gates the
 * authenticated Lawyer Workspace routes. Public research routes
 * (/, /laws, /cases, /search, /principles, /case-mapper) are never
 * touched here.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => path === p || path.startsWith(p + "/")
  );

  if (isProtected && !data.user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", path);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
