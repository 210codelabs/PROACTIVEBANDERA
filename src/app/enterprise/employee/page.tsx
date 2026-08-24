import { requireEmployeeSession } from "@/lib/employeeAuth";
import EmployeePortal from "./EmployeePortal";

export const dynamic = "force-dynamic";

export default async function EmployeeHome() {
  const s = await requireEmployeeSession();
  return <EmployeePortal name={s.name} companyName={s.companyName} />;
}
