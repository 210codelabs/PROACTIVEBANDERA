"use client";

import { useEffect, useState } from "react";
import { getPwaState, subscribePwa, promptInstall } from "@/lib/pwa";

type Platform = "android-chrome" | "desktop-chrome" | "ios" | "mac-safari" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1);
  if (isIOS) return "ios";
  if (/Android/.test(ua)) return "android-chrome";
  if (/Macintosh/.test(ua)) {
    const isSafari = /^((?!chrome|android|crios|edg).)*safari/i.test(ua);
    return isSafari ? "mac-safari" : "desktop-chrome";
  }
  return "desktop-chrome";
}

export default function InstallAppButton() {
  const [state, setState] = useState(() => getPwaState());
  const [platform, setPlatform] = useState<Platform>("other");
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setState(getPwaState());
    return subscribePwa(() => setState(getPwaState()));
  }, []);

  async function handleClick() {
    const result = await promptInstall();
    if (result === "unavailable") setShowHelp(true);
  }

  if (state.installed) return null;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title="Install Proactive Clinic as an app"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/10 text-teal-100 font-semibold ring-1 ring-white/15 hover:bg-white/15 transition"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
        </svg>
        <span className="hidden sm:inline">Install App</span>
        <span className="sm:hidden">Install</span>
      </button>

      {showHelp && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setShowHelp(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl text-left" onClick={(e) => e.stopPropagation()}>
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
