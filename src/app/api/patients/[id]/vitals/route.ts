import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";

function num(x: any): number | null {
  if (x === undefined || x === null || x === "") return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const b = await req.json();
  const heightCm = num(b.heightCm);
  const weightKg = num(b.weightKg);
  let bmi: number | null = null;
  if (heightCm && weightKg && heightCm > 0) {
    const h = heightCm / 100;
    bmi = +(weightKg / (h * h)).toFixed(1);
  }
  const created = await db.vital.create({
    data: {
      patientId: id,
      systolic: num(b.systolic) as any,
      diastolic: num(b.diastolic) as any,
      pulse: num(b.pulse) as any,
      temperatureC: num(b.temperatureC),
      spo2: num(b.spo2) as any,
      respRate: num(b.respRate) as any,
      weightKg, heightCm, bmi,
      painScore: num(b.painScore) as any,
    },
  });
  return NextResponse.json({ ok: true, vital: created });
}
