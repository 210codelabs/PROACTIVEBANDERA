"use client";
import { openApptWidget } from "@/lib/apptEvents";

type Provider = { id: string; firstName: string; lastName: string; credential: string | null };
type Service = { id: string; name: string; durationMin: number; category: string; homeEligible: boolean };

// Thin launcher for the global draggable Appointment widget (mounted in Shell).
export default function NewApptButton({ day, providerId }: { providers?: Provider[]; services?: Service[]; day: string; providerId?: string }) {
  return (
    <button
      className="btn-primary"
      onClick={() => openApptWidget({ mode: "new", day, providerId })}
    >
      + New Appointment
    </button>
  );
}
