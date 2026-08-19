import { requireSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import JellyBeans from "@/components/JellyBeans";
import SpecialtiesClient from "./SpecialtiesClient";

export const dynamic = "force-dynamic";

export default async function SpecialtiesPage() {
  const user = await requireSession();
  return (
    <Shell user={user} pageTitle="Specialties" jellyBeans={<JellyBeans />}>
      <SpecialtiesClient />
    </Shell>
  );
}
