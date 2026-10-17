import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, ShoppingCart, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Producto = { id: string; nombre: string; precio: number; categoria_id: string | null; agotado: boolean };
type Datos = { empresa: string; cliente: string; productos: Producto[]; categorias: { id: string; nombre: string }[] };

export const Route = createFileRoute("/telegram/catalogo")({
  head: () => ({
    meta: [
      { title: "Catálogo y pedidos — Ruta Directo" },
      { name: "description", content: "Haz tu pedido desde Telegram con el catálogo de Ruta Directo." },
      { property: "og:title", content: "Catálogo y pedidos — Ruta Directo" },
      { property: "og:description", content: "Haz tu pedido desde Telegram con el catálogo de Ruta Directo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
    scripts: [{ src: "https://telegram.org/js/telegram-web-app.js" }],
  }),
  component: Catalogo,
});

const crc = (n: number) => new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC", maximumFractionDigits: 0 }).format(n);
const manana = () => new Date(Date.now() - 6 * 3600000 + 86400000).toISOString().slice(0, 10);

function Catalogo() {
  const [{ c, s }, setAcceso] = useState({ c: "", s: "" });
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState("");
  const [cat, setCat] = useState("todas");
  const [carrito, setCarrito] = useState<Record<string, number>>({});
  const [verCarrito, setVerCarrito] = useState(false);
  const [fecha, setFecha] = useState(manana());
  const [notas, setNotas] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);
  const [pedidoId] = useState(() => crypto.randomUUID());

  useEffect(() => { const q = new URLSearchParams(window.location.search); setAcceso({ c: q.get("c") ?? "", s: q.get("s") ?? "" }); }, []);
  useEffect(() => {
    if (!c) return;
    const tg = (window as any).Telegram?.WebApp; tg?.ready?.(); tg?.expand?.();
    fetch(`/api/public/telegram/catalogo?c=${encodeURIComponent(c)}&s=${encodeURIComponent(s)}`)
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setDatos(j); })
      .catch((e) => setError(e.message || "No se pudo cargar el catálogo"));
  }, [c, s]);

  const items = useMemo(() => (datos?.productos ?? []).filter((p) => carrito[p.id]).map((p) => ({ ...p, cantidad: carrito[p.id] })), [datos, carrito]);
  const total = items.reduce((t, i) => t + i.precio * i.cantidad, 0);
  const visibles = (datos?.productos ?? []).filter((p) => cat === "todas" || p.categoria_id === cat);
  const cambiar = (id: string, d: number) => setCarrito((x) => { const n = Math.max(0, (x[id] ?? 0) + d); const y = { ...x }; if (n) y[id] = n; else delete y[id]; return y; });

  async function enviar() {
    setEnviando(true); setError("");
    try {
      const r = await fetch("/api/public/telegram/catalogo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ c, s, id: pedidoId, fecha_entrega: fecha, notas, items: items.map((i) => ({ producto_id: i.id, cantidad: i.cantidad })) }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error);
      setListo(true);
    } catch (e: any) { setError(e.message || "No se pudo enviar"); } finally { setEnviando(false); }
  }

  if (listo) return (
    <main className="min-h-screen grid place-items-center p-6 text-center bg-background text-foreground">
      <div className="space-y-3"><CheckCircle2 className="mx-auto size-14 text-primary" />
        <h1 className="text-xl font-bold">¡Pedido recibido!</h1>
        <p className="text-muted-foreground">Te enviamos la confirmación por Telegram. Entrega: {fecha}.</p>
        <Button onClick={() => (window as any).Telegram?.WebApp?.close?.()}>Cerrar</Button></div>
    </main>
  );
  if (!datos) return <main className="min-h-screen grid place-items-center p-6 text-center bg-background text-muted-foreground">{error || "Cargando catálogo…"}</main>;

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border p-4">
        <h1 className="text-lg font-bold">{datos.empresa}</h1>
        <p className="text-sm text-muted-foreground">Hola, {datos.cliente}</p>
        {!verCarrito && <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {[{ id: "todas", nombre: "Todos" }, ...datos.categorias].map((k) => (
            <button key={k.id} onClick={() => setCat(k.id)} className={`shrink-0 rounded-full border px-3 py-1 text-sm ${cat === k.id ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>{k.nombre}</button>
          ))}</div>}
      </header>

      {verCarrito ? (
        <section className="p-4 space-y-3">
          <h2 className="font-semibold">Tu pedido</h2>
          {items.map((i) => (
            <div key={i.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
              <div><p className="font-medium">{i.nombre}</p><p className="text-sm text-muted-foreground">{i.cantidad} × {crc(i.precio)}</p></div>
              <Cantidad n={i.cantidad} onMas={() => cambiar(i.id, 1)} onMenos={() => cambiar(i.id, -1)} />
            </div>))}
          <label className="block text-sm">Fecha de entrega
            <input type="date" min={manana()} value={fecha} onChange={(e) => setFecha(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background p-2" /></label>
          <label className="block text-sm">Indicaciones (opcional)
            <textarea maxLength={500} value={notas} onChange={(e) => setNotas(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background p-2" rows={3} /></label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button variant="outline" className="w-full" onClick={() => setVerCarrito(false)}>Seguir agregando</Button>
        </section>
      ) : (
        <section className="p-4 grid gap-3 sm:grid-cols-2">
          {visibles.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
              <div><p className="font-medium">{p.nombre}</p><p className="text-sm text-primary font-semibold">{crc(p.precio)}</p>{p.agotado && <p className="text-xs text-muted-foreground">Sujeto a disponibilidad</p>}</div>
              {carrito[p.id] ? <Cantidad n={carrito[p.id]} onMas={() => cambiar(p.id, 1)} onMenos={() => cambiar(p.id, -1)} />
                : <Button size="sm" onClick={() => cambiar(p.id, 1)}>Agregar</Button>}
            </div>))}
          {!visibles.length && <p className="text-muted-foreground">No hay productos en esta categoría.</p>}
        </section>
      )}

      {items.length > 0 && <footer className="fixed inset-x-0 bottom-0 border-t border-border bg-background p-3">
        {verCarrito
          ? <Button className="w-full h-12" disabled={enviando} onClick={enviar}>{enviando ? "Enviando…" : `Confirmar pedido • ${crc(total)}`}</Button>
          : <Button className="w-full h-12" onClick={() => setVerCarrito(true)}><ShoppingCart className="mr-2 size-4" />Ver pedido ({items.length}) • {crc(total)}</Button>}
      </footer>}
    </main>
  );
}

function Cantidad({ n, onMas, onMenos }: { n: number; onMas: () => void; onMenos: () => void }) {
  return <div className="flex items-center gap-2">
    <Button size="icon" variant="outline" className="size-8" onClick={onMenos} aria-label="Menos"><Minus className="size-4" /></Button>
    <span className="w-6 text-center font-semibold">{n}</span>
    <Button size="icon" variant="outline" className="size-8" onClick={onMas} aria-label="Más"><Plus className="size-4" /></Button>
  </div>;
}
