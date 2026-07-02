import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";

export async function requireAdminSession() {
  const user = await requireSession();
  if (user.role !== "admin") {
    redirect("/dashboard");
  }
  return user;
}
