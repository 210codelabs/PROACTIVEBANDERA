"use client";

export default function LogoutButton() {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    // Hard navigation to the public landing so no authenticated view is restored.
    window.location.replace("/");
  }
  return (
    <button onClick={logout} className="text-xs text-slate-500 hover:text-slate-900 ml-1" title="Sign out" data-testid="staff-logout-btn">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 12H3m0 0l4-4m-4 4l4 4M21 5v14a2 2 0 01-2 2h-6"/></svg>
    </button>
  );
}
