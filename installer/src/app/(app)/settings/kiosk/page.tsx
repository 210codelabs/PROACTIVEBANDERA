import { requireSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import { readKioskConfig } from "@/lib/kiosk/store";
import { KIOSK_SLIDE_CATALOG } from "@/lib/kiosk/config";
import KioskSlidesEditor from "@/components/settings/KioskSlidesEditor";

export const dynamic = "force-dynamic";

export default async function KioskSettingsPage() {
  const user = await requireSession();
  const config = await readKioskConfig();
  return (
    <Shell user={user} pageTitle="Kiosk Slideshow">
      <KioskSlidesEditor initialConfig={config} catalog={KIOSK_SLIDE_CATALOG} />
    </Shell>
  );
}
