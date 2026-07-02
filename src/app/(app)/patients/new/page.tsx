import { requireSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import NewPatientForm from "./NewPatientForm";

export default async function NewPatientPage() {
  const user = await requireSession();
  return (
    <Shell user={user} pageTitle="New Patient">
      <NewPatientForm />
    </Shell>
  );
}
