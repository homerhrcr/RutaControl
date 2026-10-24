import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Store, Search, ScanBarcode, Plus, Minus, Trash2, Banknote, CreditCard, Smartphone, UserRound, Receipt, LockKeyhole, History } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { enviarComprobantePorCorreo } from "@/lib/correo-comprobante.functions";
import { useClientes, useInvalidate, registrarVenta, type CartItem } from "@/lib/data";
import { useProductosCliente, useListasPrecios, usePreciosProductos } from "@/lib/listas-precios";
import { listaVigente, fechaComercial, resolverPrecio } from "@/lib/precios";
import { useCargasCamion, usePendientesCamion, descontarPendientes, disponibleCamion } from "@/lib/carga-camion";
import { allOps, queueVenta, useOfflineQueue, type VentaParams } from "@/lib/offline";
import { useCajasPOS, useVentasPOS } from "@/lib/pos";
import { receptorVacio, totalPOS, validarReceptorPOS, vueltoPOS, type DatosPOS, type ReceptorPOS } from "@/lib/pos-calculos";
import { buscarPorCodigo, useLectorPistola, avisoLectura } from "@/lib/codigo-barras";
import { supabase } from "@/integrations/supabase/client";
import { formatCRC, formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/PageHeader";
import { EscanerCamara } from "@/components/EscanerCamara";
import { Tiquete, type TiqueteData } from "@/components/Tiquete";
import { DireccionCliente } from "@/components/DireccionCliente";
import { OpcionSelect } from "@/components/OpcionSelect";

export const Route = createFileRoute("/_authenticated/pos")({
  head: () => ({ meta: [
    { title: "Punto de Venta — Ruta Directo" }, { name: "description", content: "Mostrador para ferias y locales: caja, ventas, clientes y comprobantes de Ruta Directo." },
    { property: "og:title", content: "Punto de Venta — Ruta Directo" }, { property: "og:description", content: "Cobros y control de caja para ferias y locales." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: POSPage,
});
function Selector({ label, value, onChange, children }: {label:string; value:string; onChange:(s:string)=>void; children:React.ReactNode}) {
  return <div className="min-w-0 space-y-1.5"><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className="w-full min-w-0 [&>span]:truncate"><SelectValue /></SelectTrigger><SelectContent>{children}</SelectContent></Select></div>;
}
function POSPage() {
  const { user, nombre, organizacionActiva, roles, isAdmin, loading } = useAuth();
  const { online, count } = useOfflineQueue();
  const invalidate = useInvalidate();
  const { data:cajas=[], error:cajasError } = useCajasPOS();
  const caja = cajas.find(c=>c.estado==="abierta");
  const [verCaja,setVerCaja]=useState<string>();
  const { data:ventas=[] } = useVentasPOS(verCaja ?? caja?.id);
  const { data:ventasAbiertas=[] } = useVentasPOS(caja?.id);
  const { data:cargas=[] } = useCargasCamion();
  const { data:pendientesCamion=[] } = usePendientesCamion();
  const { data:clientes=[] } = useClientes();
  const { data:listas=[] } = useListasPrecios();
  const { data:precios=[] } = usePreciosProductos();
  const [clienteId,setClienteId]=useState("");
  const [receptor,setReceptor]=useState<ReceptorPOS>({...receptorVacio});
  const carga=cargas.find(c=>c.id===caja?.carga_id);
  const { data:productos=[], listo, error:preciosError } = useProductosCliente(clienteId || undefined,carga?.ruta_id ?? null);
  const stockCamion=carga ? descontarPendientes(carga,pendientesCamion) : [];
  const {data:pendientes=[]}=useQuery({queryKey:["pos-pendientes",organizacionActiva?.id,user?.id,count],networkMode:"always",queryFn:async()=> (await allOps()).filter(o=>o.entity==="ventas"&&(o.payload as VentaParams).pos?.organization_id===organizacionActiva?.id).map(o=>o.payload as VentaParams)});
  const [cart,setCart]=useState<Record<string,CartItem>>({});
  const [search,setSearch]=useState("");
  const [categoria,setCategoria]=useState("todas");
  const [camara,setCamara]=useState(false);
  const [clienteDialog,setClienteDialog]=useState(false);
  const [clienteSearch,setClienteSearch]=useState("");
  const [documento,setDocumento]=useState<DatosPOS["documento"]>("interno");
  const [medio,setMedio]=useState<DatosPOS["medio"]>("efectivo");
  const [recibido,setRecibido]=useState("");
  const [cobrar,setCobrar]=useState(false);
  const [busy,setBusy]=useState(false);
  const busyRef=useRef(false);
  const [tiquete,setTiquete]=useState<TiqueteData|null>(null);
  const [modalidad,setModalidad]=useState("feria");
  const [nombreCaja,setNombreCaja]=useState("");
  const [fuente,setFuente]=useState("camion");
  const [fuenteId,setFuenteId]=useState("");
  const [listaId,setListaId]=useState("");
  const [fondo,setFondo]=useState("0");
  const [cerrar,setCerrar]=useState(false);
  const [contado,setContado]=useState("");
  const items=Object.values(cart);
  const total=totalPOS(items);
  const confirmadas=new Set(ventas.map(v=>v.id));
  const pendientesCaja=pendientes.filter(p=>p.pos?.caja_id===caja?.id&&!confirmadas.has(p.id??""));
  const mostrador=useMemo(()=>productos.map(p=>{
    const info=caja?.carga_id ? p.precioInfo : resolverPrecio({producto:p,clienteId:clienteId||null,rutaId:null,listas,precios,listaClienteId:caja?.lista_id,fecha:fechaComercial()});
    // useProductosCliente already resolves general specials; a POS list replaces only its non-special fallback.
    const resuelto=!caja?.carga_id && ["especial_general","conflicto"].includes(p.precioInfo.fuente) ? p.precioInfo : info;
    const precioInfo=!caja?.carga_id && !["especial_general","conflicto"].includes(resuelto.fuente) && (resuelto.fuente==="general" || !listaVigente(listas.find(l=>l.id===caja?.lista_id),fechaComercial())) ? {...resuelto,valido:false,mensaje:"Sin precio vigente en la lista del mostrador"} : resuelto;
    const reservadoLocal=pendientes.filter(v=>!v.carga_id&&v.pos?.organization_id===organizacionActiva?.id).flatMap(v=>v.items).filter(i=>i.producto_id===p.id).reduce((s,i)=>s+i.cantidad,0);
    const libre=caja?.carga_id ? disponibleCamion(stockCamion.find(d=>d.producto_id===p.id) ?? {producto_id:p.id,preventa:0,extra:0,vendido:0,merma:0,devuelto:0}) : Math.max(0,Number(p.existencia)-reservadoLocal);
    return {...p,precio:precioInfo.precio,precioInfo,libre};
  }),[productos,caja,clienteId,listas,precios,stockCamion,pendientes,organizacionActiva?.id]);
  useEffect(()=>{
    if(!listo) return;
    setCart(prev=>{let cambio=false;const next=Object.fromEntries(Object.entries(prev).flatMap(([id,i])=>{const p=mostrador.find(x=>x.id===id);if(!p?.precioInfo.valido){cambio=true;return [];}if(p.precio!==i.precio)cambio=true;return [[id,{...i,precio:p.precio}]];}));return cambio?next:prev;});
  },[productos,clienteId,caja?.lista_id,listo,listas,precios]);
  const categorias=[...new Set(productos.map(p=>p.categorias?.nombre).filter((s):s is string=>!!s))];
  function add(id:string,delta:number) {
    const p=mostrador.find(p=>p.id===id); if(!p||!caja) return;
    if(!p.precioInfo.valido) return toast.error(p.precioInfo.mensaje);
    const qty=(cart[id]?.cantidad??0)+delta;
    if(qty>p.libre) return toast.error("No hay más unidades disponibles");
    setCart(prev=>{const next={...prev}; if(qty<=0) delete next[id]; else next[id]={producto_id:id,nombre:p.nombre,precio:p.precio,cantidad:qty}; return next;});
  }
  function leer(codigo:string){ const p=buscarPorCodigo(mostrador,codigo); avisoLectura(!!p); if(!p) return toast.error("Código no registrado"); add(p.id,1); setSearch(""); }
  useLectorPistola(!!caja&&!cobrar&&!clienteDialog&&!tiquete&&!busy,leer);
  const efectivo=ventas.filter(v=>(v.pos_datos as unknown as DatosPOS)?.medio==="efectivo").reduce((s,v)=>s+Number(v.total),0);
  const efectivoAbierto=ventasAbiertas.filter(v=>(v.pos_datos as unknown as DatosPOS)?.medio==="efectivo").reduce((s,v)=>s+Number(v.total),0);
  const esperado=Number(caja?.fondo??0)+efectivoAbierto;
  const ventaValida=items.length>0&&items.every(i=>{const p=mostrador.find(x=>x.id===i.producto_id);return p&&p.precioInfo.valido&&i.precio===p.precio&&i.cantidad<=p.libre;});
  async function abrir(){ if(!online) return toast.error("Necesita conexión para abrir caja");setBusy(true);try{
    const {error}=await supabase.rpc("pos_abrir_caja",{p:{nombre:nombreCaja,modalidad,carga_id:fuente==="camion"?fuenteId:null,lista_id:fuente==="local"?listaId:null,fondo:Number(fondo)} });if(error) throw error;
    invalidate(["pos-cajas"]);setVerCaja(undefined);
  }catch(e){toast.error(e instanceof Error?e.message:(e as {message?:string})?.message??"No se pudo abrir caja");}finally{setBusy(false);}}
  function limpiar(){setCart({});setClienteId("");setReceptor({...receptorVacio});setDocumento("interno");setRecibido("");setSearch("");setCobrar(false);}
  const enviarCorreo=useServerFn(enviarComprobantePorCorreo);
  async function guardar(){
    if(busyRef.current||!caja||!user||!organizacionActiva||!ventaValida) return;
    const error=validarReceptorPOS(documento,receptor);if(error)return toast.error(error);
    let vuelto=0;try{if(medio==="efectivo") vuelto=vueltoPOS(total,Number(recibido));}catch(e){return toast.error((e as Error).message);}
    busyRef.current=true;setBusy(true);
    const id=crypto.randomUUID();const fecha=new Date().toISOString();
    const pos:DatosPOS={caja_id:caja.id,organization_id:organizacionActiva.id,documento,medio,recibido:medio==="efectivo"?Number(recibido):total,correo:receptor.correo.trim(),receptor:{...receptor}};
    const params:VentaParams={id,cliente_id:clienteId||null,ruta_id:carga?.ruta_id??null,carga_id:caja.carga_id,vendedor_id:user.id,items,descuento:0,metodo:"contado",pos};
    let local=false;
    try{
      if(!online){await queueVenta(params);local=true;}else{
        try{await registrarVenta(params);}catch(e){if(!/fetch|network|timeout|conex/i.test((e as {message?:string})?.message??""))throw e;await queueVenta(params);local=true;}
      }
      setTiquete({venta_id:id,cliente_id:clienteId||undefined,fecha,cliente_nombre:receptor.nombre||"Consumidor final",vendedor:nombre,items,subtotal:total,descuento:0,total,metodo:"contado",pos:{...pos,vuelto,pendiente:local}});
      if(!local&&pos.correo){enviarCorreo({data:{venta_id:id,correo:pos.correo}}).then(r=>r.enviado?toast.success(`Comprobante enviado a ${pos.correo}`):toast.error(r.motivo==="bloqueado"?"Ese correo no acepta mensajes":"No se pudo enviar el correo")).catch(()=>toast.error("No se pudo enviar el correo"));}
      limpiar();invalidate(["ventas","pos-ventas","productos","cargas_camion","pos-pendientes"]);toast.success(local?"Venta guardada sin conexión":"Venta registrada");
    }catch(e){toast.error((e as {message?:string})?.message??"No se pudo registrar la venta");}finally{busyRef.current=false;setBusy(false);}
  }
  async function cerrarCaja(){if(!caja||!online||pendientesCaja.length) return toast.error("Sincronice todas las ventas antes de cerrar");setBusy(true);try{const {error}=await supabase.rpc("pos_cerrar_caja",{p:{id:caja.id,contado:Number(contado)}});if(error)throw error;setCerrar(false);setVerCaja(caja.id);invalidate(["pos-cajas"]);toast.success("Caja cerrada");}catch(e){toast.error((e as {message?:string})?.message??"No se pudo cerrar");}finally{setBusy(false);}}
  if(!loading&&!isAdmin&&!roles.includes("vendedor"))return <div><PageHeader title="Punto de Venta"/><p className="p-6 text-muted-foreground">Solo administradores y vendedores pueden operar el mostrador.</p></div>;
  return <div className="min-w-0">
    <PageHeader title="Punto de Venta" subtitle={caja?`${caja.nombre} · ${caja.modalidad==='feria'?'Feria':'Local'} · ${online?'En línea':'Sin conexión'}`:organizacionActiva?.nombre} action={caja&&<Button variant="outline" onClick={()=>setCerrar(true)}><LockKeyhole className="mr-2 h-4 w-4"/>Cerrar caja</Button>}/>
    <div className="border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">Comprobantes internos · Hacienda: pendiente de conexión · Correo automático: pendiente de configurar</div>
    <Tabs defaultValue="venta" className="min-w-0 p-4 md:p-5"><TabsList><TabsTrigger value="venta"><Store className="mr-2 h-4 w-4"/>Mostrador</TabsTrigger><TabsTrigger value="historico"><History className="mr-2 h-4 w-4"/>Histórico de caja</TabsTrigger></TabsList>
      <TabsContent value="venta">
      {cajasError&&<p role="alert" className="text-destructive">No se pudieron cargar las cajas.</p>}
      {!caja?<section className="mx-auto max-w-xl space-y-5 py-8"><div><Store className="mb-3 h-9 w-9 text-primary"/><h2 className="text-xl font-bold">Abrir caja</h2></div>
        <div className="grid grid-cols-2 gap-2">{["feria","local"].map(m=><Button key={m} variant={modalidad===m?"default":"outline"} onClick={()=>setModalidad(m)}>{m==='feria'?'Feria':'Local'}</Button>)}</div>
        <div className="space-y-1.5"><Label htmlFor="pos-nombre">Nombre del puesto o local</Label><Input id="pos-nombre" value={nombreCaja} onChange={e=>setNombreCaja(e.target.value)}/></div>
        <Selector label="Inventario" value={fuente} onChange={v=>{setFuente(v);setFuenteId("");}}><SelectItem value="camion">Carga de camión</SelectItem><SelectItem value="local">Existencias en bodega / local</SelectItem></Selector>
        {fuente==='camion'?<Selector label="Carga disponible" value={fuenteId||"ninguna"} onChange={setFuenteId}><SelectItem value="ninguna" disabled>Seleccione carga</SelectItem>{cargas.filter(c=>c.estado==='en_ruta'&&(c.vendedor_id===user?.id||isAdmin)).map(c=><SelectItem key={c.id} value={c.id}>{c.rutas?.nombre} · {c.vehiculo} · {c.fecha}</SelectItem>)}</Selector>:<div><Selector label="Lista de precios del mostrador" value={listaId||"ninguna"} onChange={setListaId}><SelectItem value="ninguna" disabled>Seleccione lista</SelectItem>{listas.filter(l=>listaVigente(l,fechaComercial())).map(l=><SelectItem key={l.id} value={l.id}>{l.nombre}</SelectItem>)}</Selector>{isAdmin&&<Link to="/administracion" className="text-xs text-primary">Administrar precios</Link>}</div>}
        <div className="space-y-1.5"><Label htmlFor="pos-fondo">Fondo inicial de efectivo</Label><Input id="pos-fondo" type="number" min="0" inputMode="decimal" value={fondo} onChange={e=>setFondo(e.target.value)}/></div>
        <Button className="h-12 w-full" disabled={busy||!online||!nombreCaja.trim()||(fuente==='camion'?!fuenteId:!listaId)||Number(fondo)<0} onClick={abrir}>Abrir caja</Button>
      </section>:<div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0"><div className="mb-4 flex gap-2"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input aria-label="Buscar producto" placeholder="Buscar producto o código…" className="pl-9" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&buscarPorCodigo(mostrador,search)){e.preventDefault();leer(search);}}}/></div><Button variant="outline" size="icon" aria-label="Leer con cámara" onClick={()=>setCamara(true)}><ScanBarcode className="h-5 w-5"/></Button></div>
          <div className="mb-4 flex flex-wrap gap-2">{['todas',...categorias].map(c=><Button size="sm" variant={categoria===c?'secondary':'ghost'} key={c} onClick={()=>setCategoria(c)}>{c==='todas'?'Todos':c}</Button>)}</div>
          {!listo&&<p className="py-8 text-muted-foreground">{preciosError?'No se pudieron cargar los precios':'Cargando productos…'}</p>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">{mostrador.filter(p=>(categoria==='todas'||p.categorias?.nombre===categoria)&&`${p.nombre} ${p.codigo} ${p.codigo_barras}`.toLowerCase().includes(search.toLowerCase())).map(p=><Button key={p.id} variant="outline" disabled={!listo||!p.precioInfo.valido||p.libre<=(cart[p.id]?.cantidad??0)} onClick={()=>add(p.id,1)} className="h-auto min-h-32 flex-col items-start justify-between gap-2 whitespace-normal rounded-lg bg-card p-3 text-left"><span className="text-sm font-semibold">{p.nombre}</span><span className="text-lg font-bold text-primary">{p.precioInfo.valido?formatCRC(p.precio):'Sin precio'}</span><span className={`text-xs ${p.libre<=3?'text-destructive':'text-muted-foreground'}`}>Disponible: {p.libre}</span></Button>)}</div>
          {listo&&mostrador.length===0&&<p className="py-10 text-muted-foreground">No hay productos activos.</p>}
        </section>
        <section className="min-w-0 border-t pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0"><div className="mb-4 flex items-center justify-between"><h2 className="font-bold">Venta actual</h2><Button size="icon" variant="ghost" title="Vaciar venta" aria-label="Vaciar venta" onClick={()=>{if(items.length&&window.confirm('¿Vaciar la venta actual?'))limpiar();}}><Trash2 className="h-4 w-4"/></Button></div>
          <Button variant="outline" className="mb-4 h-auto w-full justify-start gap-2 whitespace-normal py-3 text-left" onClick={()=>setClienteDialog(true)}><UserRound className="h-4 w-4 shrink-0"/>{receptor.nombre||'Consumidor final'}</Button>
          <div className="min-h-28 space-y-3">{!items.length&&<p className="py-6 text-center text-sm text-muted-foreground">Sin productos</p>}{items.map(i=><div key={i.producto_id} className="border-b pb-3"><div className="mb-2 flex justify-between gap-2 text-sm"><span>{i.nombre}</span><span className="shrink-0 font-bold">{formatCRC(i.precio*i.cantidad)}</span></div><div className="flex items-center gap-2"><Button size="icon" variant="outline" className="h-8 w-8" aria-label={`Quitar ${i.nombre}`} onClick={()=>add(i.producto_id,-1)}><Minus className="h-3 w-3"/></Button><Input type="number" min="0" step="0.01" inputMode="decimal" aria-label={`Cantidad ${i.nombre}`} className="h-8 w-20 text-center" value={i.cantidad} onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n)&&n>=0)add(i.producto_id,n-i.cantidad);}}/><Button size="icon" variant="outline" className="h-8 w-8" aria-label={`Agregar ${i.nombre}`} onClick={()=>add(i.producto_id,1)}><Plus className="h-3 w-3"/></Button><span className="ml-auto text-xs text-muted-foreground">{formatCRC(i.precio)} c/u</span></div></div>)}</div>
          <div className="my-5 flex justify-between text-2xl font-black"><span>Total</span><span>{formatCRC(total)}</span></div><Button className="h-14 w-full gap-2 text-lg" disabled={busy||!listo||!ventaValida} onClick={()=>{setRecibido(String(total));setCobrar(true);}}><Banknote className="h-5 w-5"/>Cobrar</Button>
          <p className="mt-3 text-xs text-muted-foreground">{carga?`${carga.rutas?.nombre} · ${carga.vehiculo}`:listas.find(l=>l.id===caja.lista_id)?.nombre}{pendientesCaja.length>0?` · ${pendientesCaja.length} ventas pendientes`:''}</p>
        </section>
      </div>}
      </TabsContent>
      <TabsContent value="historico"><div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]"><section className="space-y-2">{cajas.map(c=><Button key={c.id} variant={(verCaja??caja?.id)===c.id?'secondary':'outline'} className="h-auto w-full flex-col items-start whitespace-normal p-3 text-left" onClick={()=>setVerCaja(c.id)}><span>{c.nombre} · {c.estado}</span><span className="text-xs text-muted-foreground">{formatDateTime(c.apertura)}</span>{c.estado==='cerrada'&&<span className="text-xs">Diferencia: {formatCRC(Number(c.diferencia))}</span>}</Button>)}{!cajas.length&&<p className="text-muted-foreground">No hay cajas registradas.</p>}</section><section className="min-w-0"><div className="mb-4 flex flex-wrap gap-5"><p>Ventas: <strong>{formatCRC(ventas.reduce((s,v)=>s+Number(v.total),0))}</strong></p><p>Efectivo: <strong>{formatCRC(efectivo)}</strong></p></div>{ventas.map(v=>{const d=v.pos_datos as unknown as DatosPOS&{vuelto:number};return <div key={v.id} className="flex items-center justify-between gap-3 border-b py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{d?.receptor?.nombre||'Consumidor final'}</p><p className="text-xs text-muted-foreground">{formatDateTime(v.fecha)} · {d?.medio}</p>{d?.correo&&<p className="text-xs text-muted-foreground">Correo: {d.correo}</p>}</div><strong className="shrink-0 text-sm">{formatCRC(v.total)}</strong><Button variant="outline" size="icon" aria-label="Ver comprobante" onClick={()=>setTiquete({venta_id:v.id,cliente_id:v.cliente_id??undefined,cliente_nombre:d?.receptor?.nombre||'Consumidor final',fecha:v.fecha,items:v.detalle_ventas.map(i=>({producto_id:i.producto_id??i.id,nombre:i.nombre_producto,cantidad:Number(i.cantidad),precio:Number(i.precio_unitario)})),subtotal:Number(v.subtotal),descuento:Number(v.descuento),total:Number(v.total),metodo:'contado',pos:{...d,pendiente:false}})}><Receipt className="h-4 w-4"/></Button></div>;})}</section></div></TabsContent>
    </Tabs>
    <EscanerCamara open={camara} onClose={()=>setCamara(false)} onCodigo={leer}/>
    <Dialog open={clienteDialog} onOpenChange={setClienteDialog}><DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto"><DialogHeader><DialogTitle>Cliente del comprobante</DialogTitle></DialogHeader>
      <Input aria-label="Buscar cliente" placeholder="Nombre, cédula o teléfono…" value={clienteSearch} onChange={e=>setClienteSearch(e.target.value)}/>
      {clienteSearch&&<div className="max-h-40 overflow-y-auto">{clientes.filter(c=>c.activo&&`${c.nombre} ${c.identificacion??''} ${c.telefono??''}`.toLowerCase().includes(clienteSearch.toLowerCase())).slice(0,8).map(c=><Button key={c.id} variant="ghost" className="h-auto w-full justify-start whitespace-normal text-left" onClick={()=>{setClienteId(c.id);setReceptor({nombre:c.nombre,tipo_identificacion:c.tipo_identificacion||'01',identificacion:c.identificacion||'',correo:c.correo_fe||'',telefono:c.telefono||'',provincia:c.provincia||'',canton:c.canton||'',distrito:c.distrito||'',direccion:c.direccion||''});setClienteSearch('');setDocumento('nombre');}}>{c.nombre} · {c.identificacion}</Button>)}</div>}
      <div className="grid gap-3 sm:grid-cols-2">{([['nombre','Nombre / razón social'],['identificacion','Identificación'],['correo','Correo del cliente'],['telefono','Teléfono']] as const).map(([key,label])=><div key={key} className="space-y-1.5"><Label htmlFor={`pos-${key}`}>{label}</Label><Input id={`pos-${key}`} type={key==='correo'?'email':'text'} value={receptor[key]} onChange={e=>{setReceptor(r=>({...r,[key]:e.target.value}));if(key==='nombre')setDocumento(e.target.value?'nombre':'interno');}}/></div>)}</div>
      <OpcionSelect catalogo="tipo_identificacion" label="Tipo de identificación" value={receptor.tipo_identificacion} onChange={v=>setReceptor(r=>({...r,tipo_identificacion:v}))}/>
      <details><summary className="cursor-pointer text-sm text-primary">Dirección del cliente</summary><div className="mt-3 space-y-3"><DireccionCliente value={receptor} onChange={d=>setReceptor(r=>({...r,...d}))}/><Input aria-label="Otras señas" placeholder="Otras señas" value={receptor.direccion} onChange={e=>setReceptor(r=>({...r,direccion:e.target.value}))}/></div></details>
      <p className="text-xs text-muted-foreground">Correo automático pendiente de activar. Los datos quedan guardados en este comprobante.</p>
      <div className="flex gap-2"><Button variant="outline" onClick={()=>{setClienteId('');setReceptor({...receptorVacio});setDocumento('interno');setClienteDialog(false);}}>Consumidor final</Button><Button className="flex-1" onClick={()=>{const error=validarReceptorPOS(documento,receptor);if(error)return toast.error(error);setClienteDialog(false);}}>Confirmar datos</Button></div>
    </DialogContent></Dialog>
    <Dialog open={cobrar} onOpenChange={o=>!busy&&setCobrar(o)}><DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto"><DialogHeader><DialogTitle>Cobrar venta</DialogTitle></DialogHeader><p className="text-center text-4xl font-black">{formatCRC(total)}</p><p className="text-center text-sm text-muted-foreground">{receptor.nombre||'Consumidor final'}</p>
      <div className="grid grid-cols-3 gap-2">{([{key:'efectivo',label:'Efectivo',icon:Banknote},{key:'tarjeta',label:'Tarjeta',icon:CreditCard},{key:'sinpe',label:'SINPE',icon:Smartphone}] as const).map(m=><Button key={m.key} variant={medio===m.key?'default':'outline'} className="h-16 flex-col gap-1" onClick={()=>setMedio(m.key)}><m.icon className="h-5 w-5"/>{m.label}</Button>)}</div>
      {medio==='efectivo'?<><Label htmlFor="pos-recibido">Efectivo recibido</Label><Input id="pos-recibido" type="number" inputMode="decimal" min="0" value={recibido} onChange={e=>setRecibido(e.target.value)} className="h-12 text-xl"/><div className="flex flex-wrap gap-2">{[total,2000,5000,10000,20000].filter((n,i,a)=>n>=total&&a.indexOf(n)===i).map(n=><Button key={n} size="sm" variant="outline" onClick={()=>setRecibido(String(n))}>{formatCRC(n)}</Button>)}</div><div className="flex justify-between text-xl font-bold"><span>Vuelto</span><span className="text-success">{formatCRC(Math.max(0,Number(recibido)-total))}</span></div></>:<p className="text-sm text-muted-foreground">Monto a confirmar: {formatCRC(total)}</p>}
      <Selector label="Comprobante" value={documento} onChange={v=>setDocumento(v as DatosPOS['documento'])}><SelectItem value="interno">Tiquete interno</SelectItem><SelectItem value="nombre" disabled={!receptor.nombre}>Comprobante a nombre</SelectItem><SelectItem value="electronica" disabled>Factura electrónica · no habilitada</SelectItem></Selector>
      <p className="text-xs text-muted-foreground">No es un documento electrónico autorizado por Hacienda.{receptor.correo?` Correo: ${receptor.correo} · se enviará el comprobante automáticamente.`:''}</p>
      <Button className="h-12 w-full text-base" disabled={busy||!ventaValida||(medio==='efectivo'&&Number(recibido)<total)} onClick={guardar}>{busy?'Guardando…':'Confirmar cobro'}</Button>
    </DialogContent></Dialog>
    <Dialog open={cerrar} onOpenChange={setCerrar}><DialogContent><DialogHeader><DialogTitle>Cerrar caja</DialogTitle></DialogHeader><p>Fondo inicial: <strong>{formatCRC(Number(caja?.fondo??0))}</strong></p><p>Ventas en efectivo: <strong>{formatCRC(efectivo)}</strong></p><p>Efectivo esperado: <strong>{formatCRC(esperado)}</strong></p><Label htmlFor="pos-contado">Efectivo contado</Label><Input id="pos-contado" type="number" inputMode="decimal" min="0" value={contado} onChange={e=>setContado(e.target.value)}/><p>Diferencia: <strong>{formatCRC(Number(contado)-esperado)}</strong></p>{pendientesCaja.length>0&&<p className="text-warning">Hay ventas sin sincronizar. No puede cerrar todavía.</p>}<Button disabled={busy||!online||!!pendientesCaja.length||!contado||Number(contado)<0} onClick={cerrarCaja}>Confirmar cierre</Button></DialogContent></Dialog>
    <Tiquete data={tiquete} open={!!tiquete} onClose={()=>setTiquete(null)}/>
  </div>;
}
