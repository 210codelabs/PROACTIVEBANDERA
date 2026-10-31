// Proactive Clinic locations shown on the landing page "Talk to Our Team"
// section. Coordinates are approximate (used to pick the closest clinic);
// the map refines the pin from the street address at runtime.
export type ClinicLocation = {
  id: string;
  name: string;
  street: string;
  suite: string;
  cityLine: string;
  address: string; // full single-line address (maps / directions)
  phones: string[];
  lat: number;
  lng: number;
};

export const CLINIC_LOCATIONS: ClinicLocation[] = [
  {
    id: "arlington",
    name: "Arlington",
    street: "1154 W Pioneer Parkway",
    suite: "Suite 1154",
    cityLine: "Arlington, TX 76013",
    address: "1154 W Pioneer Parkway, Suite 1154, Arlington, TX 76013",
    phones: ["(682) 442-1129", "(682) 489-5975"],
    lat: 32.6952,
    lng: -97.1268,
  },
  {
    id: "sa-austin-hwy",
    name: "San Antonio",
    street: "1533 Austin Hwy",
    suite: "Suite 103",
    cityLine: "San Antonio, TX 78218",
    address: "1533 Austin Hwy, Suite 103, San Antonio, TX 78218",
    phones: ["(210) 842-9941", "(210) 727-2517"],
    lat: 29.4936,
    lng: -98.4232,
  },
  {
    id: "houston",
    name: "Houston",
    street: "6666 Harwin Dr",
    suite: "Suite 460",
    cityLine: "Houston, TX 77036",
    address: "6666 Harwin Dr, Suite 460, Houston, TX 77036",
    phones: ["(832) 712-1975", "(832) 963-7080"],
    lat: 29.7186,
    lng: -95.5036,
  },
  {
    id: "sa-bandera",
    name: "San Antonio",
    street: "8103 Bandera Rd",
    suite: "Suite 102",
    cityLine: "San Antonio, TX 78250",
    address: "8103 Bandera Rd, Suite 102, San Antonio, TX 78250",
    phones: ["(210) 500-2914", "(726) 247-6191"],
    lat: 29.50485,
    lng: -98.64155,
  },
];

/** Great-circle distance in miles. */
export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function closestClinic(pos: { lat: number; lng: number }): { clinic: ClinicLocation; miles: number } {
  let best = CLINIC_LOCATIONS[0];
  let bestD = Infinity;
  for (const c of CLINIC_LOCATIONS) {
    const d = milesBetween(pos, c);
    if (d < bestD) { bestD = d; best = c; }
  }
  return { clinic: best, miles: bestD };
}

export const telHref = (p: string) => `tel:+1${p.replace(/\D/g, "")}`;

export const findClinic = (id?: string | null) => CLINIC_LOCATIONS.find((c) => c.id === id) || null;
