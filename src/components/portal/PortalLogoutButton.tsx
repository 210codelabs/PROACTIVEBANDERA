"use client";

import { useRouter } from "next/navigation";

export default function PortalLogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/portal/auth/logout", { method: "POST" });
    router.push("/portal/login");
    router.refresh();
  }

  return (
    <button className="btn-secondary" onClick={logout}>Sign out</button>
  );
}
