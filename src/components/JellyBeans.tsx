import Link from "next/link";

export default function JellyBeans({ patientId }: { patientId?: string }) {
  return (
    <>
      <Link href="/schedule" prefetch={false} className="jb jb-blue" title="Open schedule"><Dot/>Schedule</Link>
      <Link href={patientId ? `/patients/${patientId}/encounters/new` : "/encounters"} prefetch={false} className="jb jb-green" title="New encounter"><Dot/>Encounter</Link>
      <Link href={patientId ? `/patients/${patientId}/orders/new?type=rx` : "/orders"} prefetch={false} className="jb jb-violet" title="New Rx"><Dot/>Rx</Link>
      <Link href={patientId ? `/patients/${patientId}/orders/new?type=lab` : "/orders"} prefetch={false} className="jb jb-amber" title="Lab order"><Dot/>Labs</Link>
      <Link href={patientId ? `/patients/${patientId}/orders/new?type=imaging` : "/orders"} prefetch={false} className="jb jb-rose" title="Imaging"><Dot/>Imaging</Link>
      <Link href="/billing" prefetch={false} className="jb jb-slate" title="Billing"><Dot/>Billing</Link>
    </>
  );
}

function Dot() {
  return <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />;
}
