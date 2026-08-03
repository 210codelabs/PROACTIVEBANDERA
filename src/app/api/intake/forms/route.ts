import { NextResponse } from "next/server";
import { formSummaries } from "@/lib/intake/forms";

export async function GET() {
  return NextResponse.json({ forms: formSummaries() });
}
