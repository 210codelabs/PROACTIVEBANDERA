"use client";

import { useEffect } from "react";
import { initPwa } from "@/lib/pwa";

// Root-level PWA bootstrap: registers the service worker and captures the
// install prompt early. The user-facing "Install App" control now lives in the
// topbar (see InstallAppButton).
export default function PWAController() {
  useEffect(() => {
    initPwa();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return null;
}
