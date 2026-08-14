import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { CLINIC } from "@/lib/intake/forms";

// Parse "City, ST 12345" from the clinic address for the geolocation fallback.
function clinicCityState(): { city: string; state: string } {
  const m = /^\s*([^,]+),\s*([A-Za-z]{2})\b/.exec(CLINIC.addr2 || "");
  if (m) return { city: m[1].trim(), state: m[2].toUpperCase() };
  return { city: "San Antonio", state: "TX" };
}

const US_STATES: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO",
  Connecticut: "CT", Delaware: "DE", "District of Columbia": "DC", Florida: "FL", Georgia: "GA",
  Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY",
  Louisiana: "LA", Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI", Minnesota: "MN",
  Mississippi: "MS", Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH",
  "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND",
  Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT", Virginia: "VA",
  Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY",
};

const stateCode = (name: string) => US_STATES[name] || (name.length === 2 ? name.toUpperCase() : name.slice(0, 2).toUpperCase());

// Simple in-memory cache (coords rounded to ~1km) with a 24h TTL.
type Entry = { at: number; data: any };
const cache = new Map<string, Entry>();
const TTL = 24 * 60 * 60 * 1000;

// GET /api/geo/reverse?lat=&lon=  -> { city, state, stateName, source }
// GET /api/geo/reverse?clinic=1   -> clinic city/state fallback
export async function GET(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  if (searchParams.get("clinic") === "1") {
    const c = clinicCityState();
    return NextResponse.json({ city: c.city, state: c.state, stateName: c.state, source: "clinic" });
  }

  const lat = parseFloat(searchParams.get("lat") || "");
  const lon = parseFloat(searchParams.get("lon") || "");
  if (isNaN(lat) || isNaN(lon)) return NextResponse.json({ error: "lat and lon required" }, { status: 400 });

  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json({ ...hit.data, cached: true });

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;
    const r = await fetch(url, {
      headers: { "User-Agent": "ProactiveClinic-EHR/1.0 (support@proactiveclinics.com)", "Accept-Language": "en" },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) throw new Error(`nominatim ${r.status}`);
    const d = await r.json();
    const a = d.address || {};
    const city = a.city || a.town || a.village || a.municipality || a.county || a.state_district || "";
    const stateName = a.state || "";
    const data = { city, state: stateName ? stateCode(stateName) : "", stateName, source: "osm" };
    cache.set(key, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (e: any) {
    const c = clinicCityState();
    return NextResponse.json({ city: c.city, state: c.state, stateName: c.state, source: "fallback", note: String(e?.message || e).slice(0, 120) });
  }
}
