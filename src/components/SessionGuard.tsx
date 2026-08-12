"use client";

import { useEffect, useRef } from "react";

// Compliance: rolling idle session. Keeps the server session sliding while the
// user is active, forces sign-out after inactivity, and — importantly — if ANY
// authenticated /api call comes back 401 (e.g. the session expired while this
// tab was backgrounded in another window), it bounces the user straight to the
// login screen instead of leaving actions silently failing.
const IDLE_LIMIT_MS = 30 * 60 * 1000;
const REFRESH_THROTTLE_MS = 60 * 1000;
const CHECK_INTERVAL_MS = 15 * 1000;

export default function SessionGuard({
  refreshUrl,
  logoutUrl,
  redirectTo,
}: {
  refreshUrl: string;
  logoutUrl: string;
  redirectTo: string;
}) {
  const lastActivity = useRef(Date.now());
  const lastRefresh = useRef(0);
  const loggedOut = useRef(false);

  useEffect(() => {
    async function forceLogout(reason?: "expired" | "idle") {
      if (loggedOut.current) return;
      loggedOut.current = true;
      try {
        await fetch(logoutUrl, { method: "POST", keepalive: true });
      } catch {
        /* ignore network errors on logout */
      }
      // On an expired-session 401 mid-action, send the user to login and return
      // them to where they were afterwards; on plain idle, use the configured target.
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(reason === "expired" ? `/login?next=${next}` : (redirectTo || `/login?next=${next}`));
    }

    async function refresh() {
      const now = Date.now();
      if (now - lastRefresh.current < REFRESH_THROTTLE_MS) return;
      lastRefresh.current = now;
      try {
        const res = await fetch(refreshUrl, { method: "POST", cache: "no-store" });
        if (res.status === 401) forceLogout("expired");
      } catch {
        /* ignore */
      }
    }

    function onActivity() {
      if (loggedOut.current) return;
      lastActivity.current = Date.now();
      refresh();
    }

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    // Detect an expired session on ANY authenticated API call and redirect to login.
    const origFetch = window.fetch.bind(window);
    const patched = (async (input: any, init?: any) => {
      const res = await origFetch(input, init);
      try {
        if (res.status === 401) {
          const raw = typeof input === "string" ? input : (input?.url || "");
          const u = new URL(raw, window.location.origin);
          if (
            u.origin === window.location.origin &&
            u.pathname.startsWith("/api/") &&
            !u.pathname.startsWith("/api/auth/") &&
            !u.pathname.startsWith("/api/portal/")
          ) {
            forceLogout("expired");
          }
        }
      } catch {
        /* ignore */
      }
      return res;
    }) as typeof window.fetch;
    window.fetch = patched;

    // Slide the session immediately on mount.
    refresh();

    const interval = setInterval(() => {
      if (Date.now() - lastActivity.current >= IDLE_LIMIT_MS) forceLogout("idle");
    }, CHECK_INTERVAL_MS);

    // If the page is restored from the back/forward cache, revalidate the session.
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) refresh();
    };
    window.addEventListener("pageshow", onPageShow);

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      clearInterval(interval);
      window.removeEventListener("pageshow", onPageShow);
      if (window.fetch === patched) window.fetch = origFetch;
    };
  }, [refreshUrl, logoutUrl, redirectTo]);

  return null;
}
