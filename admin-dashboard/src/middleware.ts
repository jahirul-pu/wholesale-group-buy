import { auth } from "@/auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isProfileRoute = req.nextUrl.pathname.startsWith('/profile');

  // If trying to access a profile route and not logged in, redirect to home
  if (isProfileRoute && !isLoggedIn) {
    return Response.redirect(new URL('/', req.nextUrl));
  }
});

export const config = {
  matcher: ["/profile/:path*"],
};
