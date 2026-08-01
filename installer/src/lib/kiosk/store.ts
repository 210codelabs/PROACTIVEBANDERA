import { db } from "@/lib/db";
import {
  KIOSK_SLIDES_KEY,
  defaultKioskConfig,
  normalizeConfig,
  type KioskSlideConfig,
} from "./config";

export async function readKioskConfig(): Promise<KioskSlideConfig[]> {
  try {
    const row = await db.appSetting.findUnique({ where: { key: KIOSK_SLIDES_KEY } });
    if (!row) return defaultKioskConfig();
    return normalizeConfig(row.value);
  } catch {
    return defaultKioskConfig();
  }
}

export async function writeKioskConfig(config: KioskSlideConfig[]): Promise<KioskSlideConfig[]> {
  const normalized = normalizeConfig(config);
  await db.appSetting.upsert({
    where: { key: KIOSK_SLIDES_KEY },
    create: { key: KIOSK_SLIDES_KEY, value: normalized as object },
    update: { value: normalized as object },
  });
  return normalized;
}
