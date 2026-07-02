import { redirect } from "next/navigation";

export default function PortalLoginPage() {
  redirect("/?tab=patient");
}
