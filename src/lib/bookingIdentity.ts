export function matchesBookingIdentity(patient: { dob: Date; postalCode: string | null }, dob: string, postalCode: string): boolean {
  const zip = postalCode.trim();
  const storedZip = patient.postalCode?.trim() || "";
  return /^\d{5}$/.test(zip) && /^\d{5}(?:-\d{4})?$/.test(storedZip)
    && storedZip.slice(0, 5) === zip
    && patient.dob.toISOString().slice(0, 10) === dob;
}