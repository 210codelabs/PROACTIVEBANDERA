import { NextResponse } from "next/server";
import { requirePortalSession } from "@/lib/portalAuth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requirePortalSession();

  let patient: any = null;
  let appointments: any[] = [];
  let documents: any[] = [];
  let messages: any[] = [];

  try {
    [patient, appointments, documents, messages] = await Promise.all([
      db.patient.findUnique({
        where: { id: session.patientId },
        select: {
          id: true,
          mrn: true,
          firstName: true,
          lastName: true,
          dob: true,
          email: true,
          phone: true,
          preferredLang: true,
          status: true,
        },
      }),
      db.appointment.findMany({
        where: { patientId: session.patientId },
        include: { provider: true, serviceType: true },
        orderBy: { startsAt: "desc" },
        take: 10,
      }),
      db.document.findMany({
        where: { patientId: session.patientId },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
      db.message.findMany({
        where: { patientId: session.patientId },
        include: { fromUser: true },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
    ]);
  } catch {
    return NextResponse.json({ error: "Portal is temporarily unavailable" }, { status: 503 });
  }

  if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

  return NextResponse.json({ patient, appointments, documents, messages });
}
