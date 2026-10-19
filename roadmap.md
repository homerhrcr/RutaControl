# Roadmap
- [x] Listas de precios fijos por clasificación de cliente: Administración → Precios, asignación en Clientes, venta rápida, preventa y catálogo Telegram; caché para uso offline y precios históricos conservados. Doce pruebas aprobadas; creación/asignación/pedido guardado y confirmación de venta verificados con sesión real. Prueba real en Telegram pendiente de publicar y contar con cliente vinculado.
- [x] Carga de Camión: subinventario independiente, preventas más extras, ventas desde camión y cierre con sobrantes; carga, venta idempotente y retorno verificados con sesión real, seis pruebas aprobadas. Cargas y cierres requieren conexión; ventas usan la cola offline.
- [x] Telegram: bot RutaDirectoBot conectado, vinculación voluntaria, confirmaciones y tiquetes, conversación y protecciones implementadas; enlace y controles verificados con sesión real.
- [ ] Activar recepción y probar envío/recepción real de Telegram — bloqueado: receptor público devuelve 404 hasta desplegar los cambios; un cliente debe iniciar el bot mediante su enlace para la prueba real.
- [x] Selección en cascada de provincia, cantón y distrito en clientes; catálogo local, siete pruebas y guardado/lectura verificados.
- [x] Ubicación en clientes como HidroGest: coordenadas, GPS, copiar/pegar y marcar en mapa; guardado verificado, cartografía pendiente de validar en dominio autorizado.
- [x] Fase 1: Devoluciones y merma (reingreso a bodega / merma, rebajo a deuda)
- [x] Fase 2: Preventa (pedidos, carga del camión, entregar y facturar)
- [x] Fase 3a: Datos fiscales (emisor, cédula/correo cliente, CABYS/IVA producto)
- [ ] Fase 3b: Firma y envío a Hacienda — bloqueado: requiere certificado .p12, PIN y usuario/clave ATV del cliente
- [x] Devoluciones y pedidos con cola sin conexión (prueba en dispositivo real pendiente)
- [x] Fotos y descripción por producto devuelto, recomendación de IA y confirmación manual; análisis real verificado en navegador
- [x] Mini App de Telegram: catálogo y pedidos de clientes vinculados (probar con un cliente real)
- [x] Tarjetas de clientes en Iniciar Ruta compactas: una sola línea (45 px), dos columnas en computadora, acciones como iconos; verificado sin texto recortado en computadora y celular

- [x] Telegram pedidos: confirmación explícita "en ruta", aviso de confirmación ya enviada, mensaje adicional del pedido y reenvío controlado
- [x] Datos de empresa con logo en Administración; reportes gerenciales (resumen, rentabilidad por ruta, mermas, cartera, clientes, productos, ventas, gastos) con vista previa PDF y Excel con formato de moneda/números
