import { createCookieSessionStorage } from "@remix-run/node";

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__sso_session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [
      process.env.SESSION_SECRET || "sso-test-secret-change-in-production",
    ],
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60, // 1 hour
  },
});

export const { getSession, commitSession, destroySession } = sessionStorage;
