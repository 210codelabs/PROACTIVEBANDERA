"use client";

import { useI18n } from "@/components/i18n/I18nProvider";

export default function PortalLogoutButton() {
  const { t } = useI18n();

  async function logout() {
    await fetch("/api/portal/auth/logout", { method: "POST" });
    window.location.replace("/portal/login");
  }

  return (
    <button className="btn-secondary" onClick={logout} data-testid="portal-logout-btn">{t("common.signOut")}</button>
  );
}
