"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
type Platform = "android-chrome" | "desktop-chrome" | "ios" | "mac-safari" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1);
  if (isIOS) return "ios";
  if (/Android/.test(ua)) return "android-chrome";
  if (/Macintosh/.test(ua)) {
    // Safari on Mac -> use Add to Dock; Chrome/Edge on Mac use native prompt
    const isSafari = /^((?!chrome|android|crios|edg).)*safari/i.test(ua);
    return isSafari ? "mac-safari" : "desktop-chrome";
  }
  return "desktop-chrome";
}

export default function PWAController() {
  const pathname = usePathname();
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => { setInstalled(true); setDeferred(null); setShowHelp(false); };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    if (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone) {
      setInstalled(true);
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function handleClick() {
    if (deferred) {
      await deferred.prompt();
      try { await deferred.userChoice; } catch {}
      setDeferred(null);
    } else {
      setShowHelp(true);
    }
  }

  if (installed || pathname?.startsWith("/kiosk")) return null;

  return (
    <>
      <button
        onClick={handleClick}
        className="fixed bottom-6 left-4 z-40 inline-flex items-center gap-2 rounded-full bg-white text-brand-800 ring-1 ring-brand-200 shadow-lg px-4 py-2.5 text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
      >
        <svg className="h-4 w-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
        </svg>
        Install App
      </button>

      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowHelp(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Install Proactive Clinic</h3>
              <button onClick={() => setShowHelp(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <HelpSteps platform={platform} />
            <button onClick={() => setShowHelp(false)} className="mt-5 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function HelpSteps({ platform }: { platform: Platform }) {
  const blocks: Record<Platform, { en: string[]; es: string[] }> = {
    ios: {
      en: ["Open this site in Safari.", "Tap the Share button (square with an up arrow).", "Choose “Add to Home Screen”.", "Tap “Add” — the app icon appears on your Home Screen."],
      es: ["Abra este sitio en Safari.", "Toque el botón Compartir (cuadro con flecha hacia arriba).", "Elija “Agregar a inicio”.", "Toque “Agregar” — el ícono aparecerá en su pantalla de inicio."],
    },
    "mac-safari": {
      en: ["In Safari, open the File menu (or the Share button).", "Choose “Add to Dock”.", "The app opens in its own window from the Dock.", "Tip: in Chrome/Edge, use the Install icon in the address bar."],
      es: ["En Safari, abra el menú Archivo (o el botón Compartir).", "Elija “Añadir al Dock”.", "La app se abrirá en su propia ventana desde el Dock.", "Consejo: en Chrome/Edge use el ícono Instalar de la barra de direcciones."],
    },
    "android-chrome": {
      en: ["Open the browser menu (⋮).", "Tap “Install app” or “Add to Home screen”.", "Confirm to add Proactive Clinic to your device."],
      es: ["Abra el menú del navegador (⋮).", "Toque “Instalar app” o “Agregar a pantalla de inicio”.", "Confirme para agregar Proactive Clinic a su dispositivo."],
    },
    "desktop-chrome": {
      en: ["Click the Install icon in the address bar (a monitor with a down arrow).", "Or open the ⋮ menu → “Install Proactive Clinic…”.", "Confirm — it opens as its own desktop app."],
      es: ["Haga clic en el ícono Instalar de la barra de direcciones (monitor con flecha).", "O abra el menú ⋮ → “Instalar Proactive Clinic…”.", "Confirme — se abrirá como app de escritorio."],
    },
    other: {
      en: ["Open your browser menu and look for “Install app” or “Add to Home screen”."],
      es: ["Abra el menú del navegador y busque “Instalar app” o “Agregar a inicio”."],
    },
  };
  const b = blocks[platform];
  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="mb-1 font-semibold text-slate-700">English</p>
        <ol className="list-decimal space-y-1 pl-5 text-slate-600">{b.en.map((s, i) => <li key={i}>{s}</li>)}</ol>
      </div>
      <div>
        <p className="mb-1 font-semibold text-slate-700">Español</p>
        <ol className="list-decimal space-y-1 pl-5 text-slate-600">{b.es.map((s, i) => <li key={i}>{s}</li>)}</ol>
      </div>
    </div>
  );
}
