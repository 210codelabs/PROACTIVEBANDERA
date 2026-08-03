import Shell from "@/components/Shell";
import { requireSession } from "@/lib/auth";
import NpiLookup from "@/components/NpiLookup";

export const dynamic = "force-dynamic";

export default async function NpiLookupPage() {
  const user = await requireSession();
  return (
    <Shell user={user} pageTitle="NPI Lookup">
      <div className="p-4">
        <p className="text-sm text-slate-500 mb-4">
          Live data from the official CMS <b>NPPES NPI Registry</b> (free, public). Use it to verify provider
          credentials and to locate any US pharmacy for e-prescribe routing.
        </p>
        <NpiLookup />
      </div>
    </Shell>
  );
}
