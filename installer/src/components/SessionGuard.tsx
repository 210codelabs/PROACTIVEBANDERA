"use client";

import { useEffect, useRef } from "react";

// Compliance: force logout after 5 minutes of inactivity, and keep the server
// session sliding while the user is active. Mount only inside authenticated views.
const IDLE_LIMIT_MS = 5 * 60 * 1000;
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
    async function forceLogout() {
      if (loggedOut.current) return;
      loggedOut.current = true;
      try {
        await fetch(logoutUrl, { method: "POST", keepalive: true });
      } catch {
        /* ignore network errors on logout */
      }
      window.location.replace(redirectTo);
    }

    async function refresh() {
      const now = Date.now();
      if (now - lastRefresh.current < REFRESH_THROTTLE_MS) return;
      lastRefresh.current = now;
      try {
        const res = await fetch(refreshUrl, { method: "POST", cache: "no-store" });
        if (res.status === 401) forceLogout();
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

    // Slide the session immediately on mount.
    refresh();

    const interval = setInterval(() => {
      if (Date.now() - lastActivity.current >= IDLE_LIMIT_MS) forceLogout();
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
    };
  }, [refreshUrl, logoutUrl, redirectTo]);

  return null;
}
