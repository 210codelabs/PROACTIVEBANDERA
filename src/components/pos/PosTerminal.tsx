"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fmtMoney } from "@/lib/utils";

type Product = {
  id: string;
  sku: string;
  name: string;
  category: string;
  retailPriceCents: number;
  quantityOnHand: number;
  taxable: boolean;
};

type ServiceOption = { code: string; name: string };

type CartLine = {
  key: string;
  itemId: string | null;
  kind: "product" | "service";
  sku: string | null;
  description: string;
  unitPriceCents: number;
  qty: number;
  taxable: boolean;
  maxQty: number | null;
};

const PAYMENT_METHODS: Array<{ value: "card" | "cash" | "hsa-fsa" | "on-account"; label: string }> = [
  { value: "card", label: "Card" },
  { value: "cash", label: "Cash" },
  { value: "hsa-fsa", label: "HSA / FSA" },
  { value: "on-account", label: "On account" },
];

const TAX_RATE = 0.07;

export default function PosTerminal({ products, services }: { products: Product[]; services: ServiceOption[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payment, setPayment] = useState<(typeof PAYMENT_METHODS)[number]["value"]>("card");
  const [patientName, setPatientName] = useState("");
  const [discountInput, setDiscountInput] = useState("");
  const [tenderedInput, setTenderedInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  // Manual / service line entry
  const [svcCode, setSvcCode] = useState(services[0]?.code ?? "");
  const [svcPrice, setSvcPrice] = useState("");

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  }, [products, query]);

  function addProduct(p: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.itemId === p.id);
      if (existing) {
        return prev.map((l) => (l.itemId === p.id ? { ...l, qty: Math.min(l.qty + 1, l.maxQty ?? l.qty + 1) } : l));
      }
      return [
        ...prev,
        { key: p.id, itemId: p.id, kind: "product", sku: p.sku, description: p.name, unitPriceCents: p.retailPriceCents, qty: 1, taxable: p.taxable, maxQty: p.quantityOnHand },
      ];
    });
  }

  function addService() {
    const svc = services.find((s) => s.code === svcCode);
    const cents = Math.round(Number(svcPrice) * 100);
    if (!svc || !Number.isFinite(cents) || cents <= 0) {
      setMessage({ tone: "err", text: "Choose a service and enter a valid price." });
      return;
    }
    setMessage(null);
    setCart((prev) => [
      ...prev,
      { key: `${svc.code}-${prev.length}`, itemId: null, kind: "service", sku: svc.code, description: svc.name, unitPriceCents: cents, qty: 1, taxable: false, maxQty: null },
    ]);
    setSvcPrice("");
  }

  function setQty(key: string, qty: number) {
    setCart((prev) => prev.flatMap((l) => {
      if (l.key !== key) return [l];
      const next = Math.max(0, l.maxQty != null ? Math.min(qty, l.maxQty) : qty);
      return next === 0 ? [] : [{ ...l, qty: next }];
    }));
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }

  const subtotalCents = cart.reduce((sum, l) => sum + l.unitPriceCents * l.qty, 0);
  const discountCents = Math.min(Math.max(0, Math.round(Number(discountInput) * 100) || 0), subtotalCents);
  const discountRatio = subtotalCents > 0 ? (subtotalCents - discountCents) / subtotalCents : 1;
  const taxableBase = cart.reduce((sum, l) => sum + (l.taxable ? l.unitPriceCents * l.qty : 0), 0);
  const taxCents = Math.round(taxableBase * discountRatio * TAX_RATE);
  const totalCents = subtotalCents - discountCents + taxCents;
  const tenderedCents = tenderedInput ? Math.round(Number(tenderedInput) * 100) : totalCents;
  const changeCents = Math.max(0, tenderedCents - totalCents);

  async function checkout() {
    if (cart.length === 0) {
      setMessage({ tone: "err", text: "Cart is empty." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/pos/sales", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lines: cart.map((l) => ({ itemId: l.itemId, kind: l.kind, sku: l.sku, description: l.description, qty: l.qty, unitPriceCents: l.unitPriceCents })),
          paymentMethod: payment,
          patientName: patientName || null,
          discountCents,
          amountTenderedCents: tenderedCents,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Sale failed.");
      setMessage({ tone: "ok", text: `Sale ${json.sale.number} completed · ${fmtMoney(json.sale.totalCents)}${json.sale.changeCents ? ` · change ${fmtMoney(json.sale.changeCents)}` : ""}` });
      setCart([]);
      setDiscountInput("");
      setTenderedInput("");
      setPatientName("");
      router.refresh();
    } catch (err) {
      setMessage({ tone: "err", text: err instanceof Error ? err.message : "Sale failed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Catalog */}
      <section className="lg:col-span-2 card overflow-hidden">
        <header className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
          <span className="font-semibold text-slate-900">Catalog</span>
          <input className="input ml-auto max-w-xs" placeholder="Search product or SKU" value={query} onChange={(e) => setQuery(e.target.value)} />
        </header>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {filteredProducts.length === 0 && <div className="col-span-full text-center text-slate-500 py-8">No matching products.</div>}
          {filteredProducts.map((p) => {
            const out = p.quantityOnHand <= 0;
            return (
              <button
                key={p.id}
                onClick={() => !out && addProduct(p)}
                disabled={out}
                className={`text-left rounded-lg ring-1 p-3 transition ${out ? "bg-slate-50 ring-slate-200 opacity-60 cursor-not-allowed" : "bg-white ring-slate-200 hover:ring-indigo-300 hover:shadow-sm"}`}
              >
                <div className="text-sm font-medium text-slate-900 line-clamp-2">{p.name}</div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-semibold text-indigo-700">{fmtMoney(p.retailPriceCents)}</span>
                  <span className={`text-[11px] ${out ? "text-rose-600" : "text-slate-400"}`}>{out ? "Out" : `${p.quantityOnHand} left`}</span>
                </div>
              </button>
            );
          })}
        </div>
        {services.length > 0 && (
          <div className="px-4 pb-4">
            <div className="rounded-lg bg-slate-50 ring-1 ring-slate-200 p-3 flex flex-wrap items-end gap-2">
              <div className="text-xs font-semibold text-slate-600 w-full">Add a service / custom line</div>
              <select className="input max-w-[260px]" value={svcCode} onChange={(e) => setSvcCode(e.target.value)}>
                {services.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select>
              <input className="input max-w-[140px]" type="number" placeholder="Price ($)" value={svcPrice} onChange={(e) => setSvcPrice(e.target.value)} />
              <button onClick={addService} className="chip bg-indigo-100 text-indigo-800 ring-indigo-200 hover:bg-indigo-200">Add</button>
            </div>
          </div>
        )}
      </section>

      {/* Cart */}
      <section className="card overflow-hidden flex flex-col">
        <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Cart</header>
        <div className="flex-1 divide-y divide-slate-100 max-h-[340px] overflow-y-auto">
          {cart.length === 0 && <div className="px-4 py-10 text-center text-slate-400 text-sm">Tap products to add them.</div>}
          {cart.map((l) => (
            <div key={l.key} className="px-4 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">{l.description}</div>
                  <div className="text-[11px] text-slate-500">{fmtMoney(l.unitPriceCents)} each{l.taxable ? " · taxable" : ""}</div>
                </div>
                <button onClick={() => removeLine(l.key)} className="text-slate-400 hover:text-rose-600 text-xs">Remove</button>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <button onClick={() => setQty(l.key, l.qty - 1)} className="h-6 w-6 rounded ring-1 ring-slate-200 text-slate-600 hover:bg-slate-100">−</button>
                <span className="w-8 text-center text-sm font-semibold">{l.qty}</span>
                <button onClick={() => setQty(l.key, l.qty + 1)} className="h-6 w-6 rounded ring-1 ring-slate-200 text-slate-600 hover:bg-slate-100">+</button>
                <span className="ml-auto text-sm font-semibold text-slate-900">{fmtMoney(l.unitPriceCents * l.qty)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-200 p-4 space-y-2 text-sm">
          <input className="input" placeholder="Patient / customer (optional)" value={patientName} onChange={(e) => setPatientName(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <input className="input" type="number" placeholder="Discount ($)" value={discountInput} onChange={(e) => setDiscountInput(e.target.value)} />
            <input className="input" type="number" placeholder="Tendered ($)" value={tenderedInput} onChange={(e) => setTenderedInput(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PAYMENT_METHODS.map((m) => (
              <button key={m.value} onClick={() => setPayment(m.value)} className={`chip ${payment === m.value ? "bg-indigo-100 text-indigo-800 ring-indigo-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>{m.label}</button>
            ))}
          </div>
          <dl className="space-y-1 pt-1 text-slate-600">
            <Row label="Subtotal" value={fmtMoney(subtotalCents)} />
            {discountCents > 0 && <Row label="Discount" value={`−${fmtMoney(discountCents)}`} />}
            <Row label="Tax (7%)" value={fmtMoney(taxCents)} />
            <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-base font-bold text-slate-900">
              <span>Total</span><span>{fmtMoney(totalCents)}</span>
            </div>
            {tenderedInput && changeCents > 0 && <Row label="Change" value={fmtMoney(changeCents)} />}
          </dl>
          {message && <p className={`text-xs ${message.tone === "ok" ? "text-emerald-700" : "text-rose-600"}`}>{message.text}</p>}
          <button onClick={checkout} disabled={busy || cart.length === 0} className="btn-primary w-full">{busy ? "Processing..." : `Charge ${fmtMoney(totalCents)}`}</button>
        </div>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span><span>{value}</span>
    </div>
  );
}
