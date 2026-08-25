"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const CLINIC = {
  lat: 29.50485,
  lng: -98.64155,
  label: "Proactive Clinic — 8103 Bandera Rd, Suite 102, San Antonio, TX 78250",
  address: "8103 Bandera Rd, Suite 102, San Antonio, TX 78250",
};

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

// Load the Google Maps JS API (alpha channel for Photorealistic 3D Maps) once.
let mapsPromise: Promise<any> | null = null;
function loadMaps(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  const w = window as any;
  if (w.google && w.google.maps) return Promise.resolve(w.google);
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise((resolve, reject) => {
    if (!MAPS_KEY) {
      reject(new Error("Missing Google Maps API key"));
      return;
    }
    const cbName = "__initGmaps3d";
    (window as any)[cbName] = () => resolve((window as any).google);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&v=alpha&libraries=maps3d,routes,geometry&loading=async&callback=${cbName}`;
    s.async = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return mapsPromise;
}

type Step = { html: string; distance: string };

// Detect hardware-accelerated WebGL2. Photorealistic 3D Maps refuse to render
// on software renderers (SwiftShader/llvmpipe) or when WebGL2 is unavailable.
function has3dSupport(): boolean {
  try {
    if (typeof document === "undefined") return false;
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") as WebGL2RenderingContext | null;
    if (!gl) return false;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = ext ? String(gl.getParameter((ext as any).UNMASKED_RENDERER_WEBGL)) : "";
    if (/swiftshader|llvmpipe|software|angle \(google, vulkan.*swiftshader/i.test(renderer)) return false;
    return true;
  } catch {
    return false;
  }
}

export default function MapNav() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [eta, setEta] = useState<{ dist: string; dur: string } | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [fallbackSrc, setFallbackSrc] = useState<string>("");

  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const map3dRef = useRef<any>(null);
  const flyTimerRef = useRef<any>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // dragging
  const dragRef = useRef<{ dx: number; dy: number; dragging: boolean }>({ dx: 0, dy: 0, dragging: false });
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const stopFly = () => {
    const f: any = flyTimerRef.current;
    if (f) {
      if (typeof f.cancel === "function") f.cancel();
      else clearTimeout(f);
      flyTimerRef.current = null;
    }
  };

  const cleanup = useCallback(() => {
    stopFly();
    if (map3dRef.current && mapHostRef.current && map3dRef.current.parentNode === mapHostRef.current) {
      try {
        mapHostRef.current.removeChild(map3dRef.current);
      } catch {
        /* noop */
      }
    }
    map3dRef.current = null;
  }, []);

  const openDirectionsTab = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      CLINIC.address
    )}&travelmode=driving`;
    window.open(url, "_blank", "noopener");
  };

  // Animate camera flying along the route for a car-navigation feel.
  // Advances only after each camera move finishes (event-driven) so moves
  // never interrupt each other — no jumpy re-zooming. Zoom stays constant.
  const flyAlong = useCallback((google: any, map3d: any, path: any[]) => {
    const spherical = google.maps.geometry.spherical;
    const total = path.length;
    if (total < 2) return;

    // Sample the route down to a handful of smooth waypoints.
    const MAX_WAYPOINTS = 12;
    const stepN = Math.max(1, Math.floor(total / MAX_WAYPOINTS));
    const points: any[] = [];
    for (let k = 0; k < total; k += stepN) points.push(path[k]);
    if (points[points.length - 1] !== path[total - 1]) points.push(path[total - 1]);

    const RANGE = 500; // constant zoom the whole way
    const TILT = 66;
    const DUR = 2600;

    let idx = 0;
    let handler: ((e: any) => void) | null = null;
    let backup: any = null;

    const clearWait = () => {
      if (handler) map3d.removeEventListener("gmp-animationend", handler);
      handler = null;
      if (backup) clearTimeout(backup);
      backup = null;
    };

    const flyNext = () => {
      if (!map3dRef.current) {
        clearWait();
        return;
      }
      if (idx >= points.length) {
        clearWait();
        // Gentle final overview of the clinic.
        map3d.flyCameraTo({
          endCamera: {
            center: { lat: CLINIC.lat, lng: CLINIC.lng, altitude: 30 },
            tilt: 60,
            range: 900,
            heading: 0,
          },
          durationMillis: 2800,
        });
        return;
      }
      const cur = points[idx];
      const look = points[Math.min(idx + 1, points.length - 1)];
      const heading = spherical.computeHeading(cur, look);

      // Advance when the fly finishes; backup timer in case the event is missed.
      clearWait();
      handler = () => {
        clearWait();
        idx += 1;
        flyNext();
      };
      map3d.addEventListener("gmp-animationend", handler, { once: true });
      backup = setTimeout(() => {
        clearWait();
        idx += 1;
        flyNext();
      }, DUR + 400);

      map3d.flyCameraTo({
        endCamera: {
          center: { lat: cur.lat(), lng: cur.lng(), altitude: 20 },
          tilt: TILT,
          range: RANGE,
          heading,
        },
        durationMillis: DUR,
      });
    };

    // Register cleanup so stopFly()/cleanup() cancels pending waits.
    flyTimerRef.current = { cancel: clearWait } as any;
    flyNext();
  }, []);

  const initNav = useCallback(async () => {
    setError("");
    setSteps([]);
    setEta(null);
    setFallbackSrc("");
    setStatus("Loading 3D map…");
    let google: any;
    try {
      google = await loadMaps();
    } catch {
      // Hard fallback to a 2D directions embed inside the panel.
      setStatus("");
      setFallbackSrc(
        `https://maps.google.com/maps?saddr=&daddr=${encodeURIComponent(
          CLINIC.address
        )}&t=h&output=embed`
      );
      setError("3D maps unavailable — showing standard directions.");
      return;
    }

    let maps3d: any;
    try {
      maps3d = await google.maps.importLibrary("maps3d");
    } catch {
      setStatus("");
      setFallbackSrc(
        `https://maps.google.com/maps?saddr=&daddr=${encodeURIComponent(
          CLINIC.address
        )}&t=h&output=embed`
      );
      setError("Photorealistic 3D Tiles not enabled for this key — showing standard directions.");
      return;
    }

    const { Map3DElement, Polyline3DElement, Marker3DElement, AltitudeMode, MapMode } = maps3d;

    const geoOpts: PositionOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 };

    // Shared: get the visitor location + driving route, populate ETA & steps.
    const getRoute = (): Promise<{ path: any[]; origin: { lat: number; lng: number } } | null> =>
      new Promise((resolve) => {
        if (!navigator.geolocation) {
          resolve(null);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          async (pos2) => {
            const origin = { lat: pos2.coords.latitude, lng: pos2.coords.longitude };
            setStatus("Calculating route…");
            try {
              const routesLib: any = await google.maps.importLibrary("routes");
              const ds = new routesLib.DirectionsService();
              const res = await ds.route({
                origin,
                destination: CLINIC.address,
                travelMode: google.maps.TravelMode.DRIVING,
              });
              const route = res.routes[0];
              const leg = route.legs[0];
              setEta({ dist: leg.distance?.text || "", dur: leg.duration?.text || "" });
              setSteps(
                (leg.steps || []).map((st: any) => ({
                  html: st.instructions || "",
                  distance: st.distance?.text || "",
                }))
              );
              resolve({ path: route.overview_path as any[], origin });
            } catch {
              resolve(null);
            }
          },
          () => resolve(null),
          geoOpts
        );
      });

    // Graceful degradation: no hardware 3D → 2D satellite directions embed,
    // but still surface the live turn-by-turn steps + ETA in the panel.
    if (!has3dSupport()) {
      setStatus("Getting your location…");
      const r = await getRoute();
      setStatus("");
      const saddr = r ? `${r.origin.lat},${r.origin.lng}` : "";
      setFallbackSrc(
        `https://maps.google.com/maps?saddr=${encodeURIComponent(saddr)}&daddr=${encodeURIComponent(
          CLINIC.address
        )}&t=h&output=embed`
      );
      if (!r) {
        setError(
          "Turn-by-turn needs location access, and 3D needs a graphics-capable browser. Showing the clinic map — use “Open in Google Maps” for directions."
        );
      } else {
        setError("This device can’t render 3D maps — showing satellite directions with turn-by-turn steps.");
      }
      return;
    }

    // Build the 3D map centered on the clinic.
    const map3d = new Map3DElement({
      center: { lat: CLINIC.lat, lng: CLINIC.lng, altitude: 30 },
      range: 1500,
      tilt: 60,
      heading: 0,
      mode: MapMode?.HYBRID ?? "HYBRID",
    });
    map3d.style.width = "100%";
    map3d.style.height = "100%";
    map3dRef.current = map3d;
    if (mapHostRef.current) {
      mapHostRef.current.innerHTML = "";
      mapHostRef.current.appendChild(map3d);
    }

    // Destination marker.
    try {
      const destMarker = new Marker3DElement({
        position: { lat: CLINIC.lat, lng: CLINIC.lng, altitude: 20 },
        altitudeMode: AltitudeMode.RELATIVE_TO_GROUND,
        label: "Proactive Clinic",
      });
      map3d.append(destMarker);
    } catch {
      /* marker optional */
    }

    const showClinicOnly = (msg?: string) => {
      if (msg) setError(msg);
      setStatus("");
      map3d.flyCameraTo({
        endCamera: {
          center: { lat: CLINIC.lat, lng: CLINIC.lng, altitude: 30 },
          tilt: 62,
          range: 800,
          heading: 0,
        },
        durationMillis: 2500,
      });
    };

    setStatus("Getting your location…");
    const r = await getRoute();
    if (!r) {
      showClinicOnly(
        "Location unavailable — showing the clinic in 3D. Use “Open in Google Maps” for directions."
      );
      return;
    }

    setStatus("");
    const path = r.path;
    const coords = path.map((p) => ({ lat: p.lat(), lng: p.lng(), altitude: 6 }));
    try {
      const poly = new Polyline3DElement({
        path: coords,
        strokeColor: "#2563eb",
        strokeWidth: 11,
        altitudeMode: AltitudeMode.RELATIVE_TO_GROUND,
      });
      map3d.append(poly);
    } catch {
      /* polyline optional */
    }
    try {
      const originMarker = new Marker3DElement({
        position: { ...r.origin, altitude: 20 },
        altitudeMode: AltitudeMode.RELATIVE_TO_GROUND,
        label: "You",
      });
      map3d.append(originMarker);
    } catch {
      /* noop */
    }

    // Start the car-navigation fly-through.
    flyAlong(google, map3d, path);
  }, [flyAlong]);

  // (Re)initialize when the panel opens.
  useEffect(() => {
    if (open && !minimized) {
      // slight delay so the host div has size
      const t = setTimeout(() => initNav(), 120);
      return () => clearTimeout(t);
    }
    if (!open) {
      cleanup();
    }
    return undefined;
  }, [open, minimized, initNav, cleanup]);

  // Drag handlers
  const onDragStart = (e: React.MouseEvent) => {
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top, dragging: true };
    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", onDragEnd);
  };
  const onDragMove = (e: MouseEvent) => {
    if (!dragRef.current.dragging) return;
    setPos({ x: e.clientX - dragRef.current.dx, y: e.clientY - dragRef.current.dy });
  };
  const onDragEnd = () => {
    dragRef.current.dragging = false;
    window.removeEventListener("mousemove", onDragMove);
    window.removeEventListener("mouseup", onDragEnd);
  };

  const panelStyle: React.CSSProperties = pos
    ? { top: pos.y, left: pos.x, right: "auto", bottom: "auto" }
    : {};

  return (
    <>
      {/* Clickable map preview */}
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setMinimized(false);
        }}
        className="group relative block w-full h-full min-h-[300px] text-left focus:outline-none"
        aria-label="Open 3D navigation to the clinic"
      >
        <iframe
          title="Proactive Clinic location map"
          src="https://maps.google.com/maps?saddr=&daddr=8103%20Bandera%20Rd,%20Suite%20102,%20San%20Antonio,%20TX%2078250&t=h&output=embed"
          className="w-full h-full min-h-[300px] pointer-events-none"
          style={{ border: 0 }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
        <span className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-100 transition-opacity">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-lg group-hover:bg-brand-700 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Start 3D Navigation
          </span>
        </span>
      </button>

      {/* Floating navigation panel */}
      {open && (
        <div
          ref={panelRef}
          style={panelStyle}
          className={`fixed z-[1000] ${
            pos ? "" : "bottom-6 right-6"
          } w-[min(92vw,460px)] rounded-2xl border border-slate-700 bg-slate-900 text-white shadow-2xl overflow-hidden`}
        >
          {/* Header (drag handle) */}
          <div
            onMouseDown={onDragStart}
            className="flex items-center justify-between gap-2 px-4 py-3 bg-slate-950/80 cursor-move select-none border-b border-slate-800"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l3 6 6 .5-4.5 4 1.5 6L12 15l-6 3.5L7.5 12.5 3 8.5 9 8z" />
                </svg>
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold leading-tight">3D Navigation</div>
                <div className="truncate text-[11px] text-slate-400">to Proactive Clinic</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMinimized((m) => !m)}
                className="rounded-md p-1.5 hover:bg-slate-800"
                aria-label={minimized ? "Expand" : "Minimize"}
                title={minimized ? "Expand" : "Minimize"}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  {minimized ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h16v16H4z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                  )}
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 hover:bg-slate-800"
                aria-label="Close"
                title="Close"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {!minimized && (
            <div>
              {/* Map / fallback host */}
              <div className="relative h-[300px] w-full bg-slate-800">
                {fallbackSrc ? (
                  <iframe
                    title="Directions"
                    src={fallbackSrc}
                    className="h-full w-full"
                    style={{ border: 0 }}
                    loading="lazy"
                  />
                ) : (
                  <div ref={mapHostRef} className="h-full w-full" />
                )}
                {status && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60">
                    <div className="flex items-center gap-2 rounded-full bg-slate-950/80 px-4 py-2 text-sm">
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      {status}
                    </div>
                  </div>
                )}
              </div>

              {/* ETA / distance */}
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-800 bg-slate-950/60">
                {eta ? (
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="text-lg font-bold leading-none text-emerald-400">{eta.dur}</div>
                      <div className="text-[11px] text-slate-400">est. time</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold leading-none">{eta.dist}</div>
                      <div className="text-[11px] text-slate-400">distance</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400">
                    {error ? "" : "Grant location access for turn-by-turn directions."}
                  </div>
                )}
                <button
                  type="button"
                  onClick={openDirectionsTab}
                  className="shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold hover:bg-brand-700"
                >
                  Open in Google Maps
                </button>
              </div>

              {error && (
                <div className="px-4 py-2 text-xs text-amber-300 bg-amber-900/20 border-t border-amber-900/40">
                  {error}
                </div>
              )}

              {/* Turn-by-turn steps */}
              {steps.length > 0 && (
                <div className="max-h-[180px] overflow-y-auto border-t border-slate-800 px-4 py-2">
                  <ol className="space-y-2">
                    {steps.map((st, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-sm">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div
                            className="text-slate-200 [&_b]:font-semibold"
                            dangerouslySetInnerHTML={{ __html: st.html }}
                          />
                          {st.distance && <div className="text-[11px] text-slate-500">{st.distance}</div>}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
