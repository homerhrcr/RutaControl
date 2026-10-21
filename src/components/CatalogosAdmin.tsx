import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DEFINICIONES, useOpciones, type DefCatalogo } from "@/lib/catalogos";
import { mover, ordenar, validarEtiqueta } from "@/lib/catalogos-logica";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ArrowDown, ArrowUp, Lock, Star } from "lucide-react";
import { toast } from "sonner";

type Fila = { id: string; codigo: string; etiqueta: string; descripcion: string | null; activo: boolean; orden: number; predeterminado: boolean; protegido: boolean };

const CAMPOS_TABLA: Record<string, string> = {
  categorias: "id, nombre, descripcion, activo, orden, predeterminado",
  categorias_gasto: "id, nombre, descripcion, activo, orden, predeterminado",
  rutas: "id, nombre, activo, orden",
};

function useFilas(def: DefCatalogo) {
  const { organizacionActiva } = useAuth();
  const opciones = useOpciones(def.tipo === "opciones" ? (def.key as never) : undefined);
  const tabla = useQuery({
    queryKey: ["catalogo", def.key, "admin", organizacionActiva?.id],
    enabled: def.tipo === "tabla" && !!organizacionActiva,
    queryFn: async () => {
      const { data, error } = await supabase.from(def.key as any).select(CAMPOS_TABLA[def.key]);
      if (error) throw error;
      return (data as any[]).map((r): Fila => ({ id: r.id, codigo: r.id, etiqueta: r.nombre, descripcion: r.descripcion ?? null, activo: r.activo, orden: r.orden, predeterminado: !!r.predeterminado, protegido: false }));
    },
  });
  const filas: Fila[] = def.tipo === "tabla" ? tabla.data ?? [] : (opciones.data ?? []).map((o) => o as Fila);
  return ordenar(filas);
}

function refrescar(qc: ReturnType<typeof useQueryClient>) {
  for (const k of ["catalogo_opciones", "catalogo", "categorias", "rutas", "productos", "gastos", "dashboard"]) qc.invalidateQueries({ queryKey: [k] });
}

async function guardar(def: DefCatalogo, id: string, cambios: Partial<Fila>) {
  if (def.tipo === "opciones") return supabase.from("catalogo_opciones").update(cambios as any).eq("id", id);
  const { etiqueta, ...resto } = cambios;
  const payload: any = { ...resto };
  if (etiqueta !== undefined) payload.nombre = etiqueta;
  if (def.key === "rutas") { delete payload.descripcion; delete payload.predeterminado; }
  return supabase.from(def.key as any).update(payload).eq("id", id);
}

/** Cuenta los registros que usan una opción, para impedir borrarla. */
async function enUso(def: DefCatalogo, f: Fila): Promise<number> {
  const contar = async (t: string, col: string, v: string) => {
    const { count } = await supabase.from(t as any).select("id", { count: "exact", head: true }).eq(col, v);
    return count ?? 0;
  };
  if (def.key === "motivo_devolucion") return contar("devoluciones_detalle", "motivo", f.codigo);
  if (def.key === "categorias_gasto") return contar("gastos", "categoria", f.etiqueta);
  if (def.key === "categorias") return contar("productos", "categoria_id", f.id);
  if (def.key === "rutas") return (await contar("clientes", "ruta_id", f.id)) + (await contar("cliente_rutas", "ruta_id", f.id)) + (await contar("ventas", "ruta_id", f.id));
  return 0;
}

export function CatalogoEditor({ def, onRenamed }: { def: DefCatalogo; onRenamed?: (anterior: string, nuevo: string) => void }) {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const filas = useFilas(def);
  const [nueva, setNueva] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const conDescripcion = def.key !== "rutas";
  const conPredet = def.key !== "rutas";
  const permiteNuevas = def.tipo === "tabla" || def.key === "motivo_devolucion";

  async function ejecutar(p: PromiseLike<{ error: any }>, ok: string) {
    setBusy(true);
    const { error } = await p;
    setBusy(false);
    if (error) { toast.error(error.message); return false; }
    refrescar(qc); toast.success(ok); return true;
  }

  async function agregar() {
    const err = validarEtiqueta(filas, nueva);
    if (err) return toast.error(err);
    const etiqueta = nueva.trim();
    const orden = filas.length + 1;
    const p = def.tipo === "opciones"
      ? supabase.from("catalogo_opciones").insert({ catalogo: def.key, codigo: etiqueta, etiqueta, orden } as any)
      : supabase.from(def.key as any).insert({ nombre: etiqueta, orden } as any);
    if (await ejecutar(p, "Opción agregada")) setNueva("");
  }

  async function renombrar(f: Fila) {
    const err = validarEtiqueta(filas, texto, f.id);
    if (err) return toast.error(err);
    const etiqueta = texto.trim();
    const ok = await ejecutar(guardar(def, f.id, { etiqueta, ...(conDescripcion ? { descripcion: desc.trim() || null } : {}) }), "Opción actualizada");
    if (!ok) return;
    if (def.key === "categorias_gasto" && etiqueta !== f.etiqueta) {
      await supabase.from("gastos").update({ categoria: etiqueta }).eq("categoria", f.etiqueta);
      onRenamed?.(f.etiqueta, etiqueta);
    }
    setEditando(null);
  }

  async function reordenar(f: Fila, delta: -1 | 1) {
    const nuevos = mover(filas, f.id, delta).filter((n) => filas.find((x) => x.id === n.id)?.orden !== n.orden);
    setBusy(true);
    for (const n of nuevos) {
      const { error } = await guardar(def, n.id, { orden: n.orden });
      if (error) { setBusy(false); return toast.error(error.message); }
    }
    setBusy(false); refrescar(qc);
  }

  async function predet(f: Fila) {
    setBusy(true);
    const actual = filas.find((x) => x.predeterminado);
    if (actual && actual.id !== f.id) await guardar(def, actual.id, { predeterminado: false });
    setBusy(false);
    await ejecutar(guardar(def, f.id, { predeterminado: actual?.id !== f.id }), "Predeterminada actualizada");
  }

  async function borrar(f: Fila) {
    const usos = await enUso(def, f);
    if (usos > 0) {
      if (confirm(`"${f.etiqueta}" está en uso en ${usos} registro(s) y no se puede eliminar. ¿Desea desactivarla para que no se ofrezca en registros nuevos?`))
        await ejecutar(guardar(def, f.id, { activo: false }), "Opción desactivada");
      return;
    }
    if (!confirm(`¿Eliminar "${f.etiqueta}"?`)) return;
    const p = def.tipo === "opciones" ? supabase.from("catalogo_opciones").delete().eq("id", f.id) : supabase.from(def.key as any).delete().eq("id", f.id);
    const { error } = await p;
    if (error) {
      if (confirm("Hay registros que la utilizan. ¿Desea desactivarla en su lugar?")) await ejecutar(guardar(def, f.id, { activo: false }), "Opción desactivada");
      return;
    }
    refrescar(qc); toast.success("Opción eliminada");
  }

  return (
    <div className="space-y-3">
      {def.restriccion && <p className="flex gap-2 rounded-md border border-dashed p-2 text-xs text-muted-foreground"><Lock className="h-4 w-4 shrink-0" />{def.restriccion}</p>}
      {isAdmin && permiteNuevas && (
        <div className="flex gap-2">
          <Input value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Nueva opción" maxLength={80}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregar(); } }} />
          <Button onClick={agregar} disabled={busy}>Agregar</Button>
        </div>
      )}
      <div className="max-h-[28rem] space-y-1 overflow-y-auto rounded-md border p-2">
        {filas.map((f, i) => (
          <div key={f.id} className="rounded px-2 py-1.5 hover:bg-muted/60">
            {editando === f.id ? (
              <div className="space-y-2">
                <Input value={texto} onChange={(e) => setTexto(e.target.value)} className="h-8" maxLength={80} autoFocus aria-label="Nombre" />
                {conDescripcion && <Input value={desc} onChange={(e) => setDesc(e.target.value)} className="h-8" placeholder="Descripción (opcional)" aria-label="Descripción" />}
                <div className="flex gap-2"><Button size="sm" disabled={busy} onClick={() => renombrar(f)}>Guardar</Button><Button size="sm" variant="ghost" onClick={() => setEditando(null)}>Cancelar</Button></div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className={`text-sm ${f.activo ? "" : "text-muted-foreground line-through"}`}>
                    {f.etiqueta}{f.predeterminado && <Badge variant="secondary" className="ml-2">Predeterminada</Badge>}
                    {f.protegido && <span className="ml-2 text-xs text-muted-foreground">código {f.codigo}</span>}
                  </div>
                  {f.descripcion && <p className="text-xs text-muted-foreground">{f.descripcion}</p>}
                </div>
                {isAdmin && (
                  <>
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Subir" disabled={busy || i === 0} onClick={() => reordenar(f, -1)}><ArrowUp className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Bajar" disabled={busy || i === filas.length - 1} onClick={() => reordenar(f, 1)}><ArrowDown className="h-4 w-4" /></Button>
                    {conPredet && <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Predeterminada" disabled={busy || !f.activo} onClick={() => predet(f)}><Star className={`h-4 w-4 ${f.predeterminado ? "fill-current" : ""}`} /></Button>}
                    <Switch checked={f.activo} aria-label={`Activa ${f.etiqueta}`} disabled={busy || (f.protegido && (def.key === "destino_devolucion" || def.key === "metodo_pago"))}
                      onCheckedChange={(v) => ejecutar(guardar(def, f.id, { activo: v, ...(v ? {} : { predeterminado: false }) }), v ? "Opción activada" : "Opción desactivada")} />
                    <Button size="sm" variant="ghost" onClick={() => { setEditando(f.id); setTexto(f.etiqueta); setDesc(f.descripcion ?? ""); }}>Editar</Button>
                    {!f.protegido && <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => borrar(f)}>Eliminar</Button>}
                  </>
                )}
              </div>
            )}
          </div>
        ))}
        {filas.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Sin opciones aún.</p>}
      </div>
    </div>
  );
}

function Conteo({ def }: { def: DefCatalogo }) {
  const filas = useFilas(def);
  const act = filas.filter((f) => f.activo).length;
  return <span className="text-xs text-muted-foreground">{act} activa(s) · {filas.length - act} inactiva(s)</span>;
}

/** Administración de catálogos: todos los selectores configurables del sistema. */
export function CatalogosAdmin() {
  const [busq, setBusq] = useState("");
  const [sel, setSel] = useState<string>(DEFINICIONES[0].key);
  const lista = useMemo(() => {
    const t = busq.trim().toLowerCase();
    return DEFINICIONES.filter((d) => !t || `${d.titulo} ${d.usadoEn}`.toLowerCase().includes(t));
  }, [busq]);
  const def = DEFINICIONES.find((d) => d.key === sel)!;
  return (
    <div className="grid gap-4 md:grid-cols-[18rem_1fr]">
      <div className="space-y-2">
        <Input value={busq} onChange={(e) => setBusq(e.target.value)} placeholder="Buscar catálogo" aria-label="Buscar catálogo" />
        {lista.map((d) => (
          <button key={d.key} type="button" onClick={() => setSel(d.key)}
            className={`w-full rounded-md border p-3 text-left ${d.key === sel ? "border-primary bg-primary/10" : "hover:bg-muted/60"}`}>
            <p className="text-sm font-semibold">{d.titulo}</p>
            <Conteo def={d} />
          </button>
        ))}
      </div>
      <Card className="space-y-3 p-4">
        <div>
          <h2 className="font-bold">{def.titulo}</h2>
          <p className="text-xs text-muted-foreground">Se usa en: {def.usadoEn}</p>
        </div>
        <CatalogoEditor key={def.key} def={def} />
      </Card>
    </div>
  );
}
