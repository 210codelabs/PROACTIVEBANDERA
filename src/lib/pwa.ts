"use client";

// Tiny shared PWA install store. The root PWAController captures the
// `beforeinstallprompt` event as early as possible (it mounts at the app root),
// and the topbar Install button reads/subscribes to this store so it never
// misses the event even though it mounts later inside the shell.

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferredPrompt: BIPEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }

export function initPwa() {
  if (typeof window === "undefined") return;
  if ((window as any).__pwaInit) return;
  (window as any).__pwaInit = true;

  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BIPEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferredPrompt = null;
    emit();
  });
  try {
    if (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone) {
      installed = true;
    }
  } catch { /* ignore */ }
}

export function getPwaState() { return { canPrompt: !!deferredPrompt, installed }; }

export function subscribePwa(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferredPrompt) return "unavailable";
  await deferredPrompt.prompt();
  let outcome: "accepted" | "dismissed" = "dismissed";
  try { const r = await deferredPrompt.userChoice; outcome = (r?.outcome as any) || "dismissed"; } catch { /* ignore */ }
  deferredPrompt = null;
  emit();
  return outcome;
}
