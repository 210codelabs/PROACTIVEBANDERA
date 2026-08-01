import { requireSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import CatalogManager from "@/components/CatalogManager";

export default async function CatalogsSettingsPage() {
  const user = await requireSession();
  return (
    <Shell user={user} pageTitle="Clinical Catalogs">
      <div className="mb-4">
        <h1 className="text-lg font-bold text-slate-900">Clinical Catalogs</h1>
        <p className="text-sm text-slate-500">
          Manage the dropdown value sets used across registration, allergies, problems, orders, encounters,
          billing and immunizations. Add, edit, or deactivate values — changes apply everywhere instantly.
        </p>
      </div>
      <CatalogManager />
    </Shell>
  );
}
