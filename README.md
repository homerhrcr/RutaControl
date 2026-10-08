# Ruta Control

Proyecto: Lácteos La Rivera - Sistema Integral de Ventas y Gestión Comercial

Desarrolla una aplicación web moderna, responsive y profesional para la gestión integral de ventas, clientes, rutas de distribución, cartera de crédito e inventario de Lácteos La Rivera.

Objetivo General

Digitalizar y controlar todo el proceso comercial de la empresa, desde el registro de clientes hasta la facturación, control de créditos, cobranza, rutas de reparto, inventario y reportes gerenciales.

Diseño

Dashboard moderno tipo ERP.

Diseño responsive para celular, tablet y computadora.

Menú lateral dinámico.

Modo claro y oscuro.

Interfaz amigable para vendedores en ruta.

Colores institucionales azul, verde y blanco.

Gráficos estadísticos interactivos.

Roles de Usuario

Administrador

Acceso total al sistema.

Configuración general.

Administración de productos.

Administración de clientes.

Reportes y estadísticas.

Vendedor

Registrar ventas.

Registrar cobros.

Consultar cartera.

Ver clientes de su ruta.

Consultar historial de compras.

Cobrador

Consultar cuentas por cobrar.

Registrar abonos.

Consultar saldos pendientes.

Módulo de Productos

Crear mantenimiento completo para agregar, modificar, activar o desactivar productos.

Campos:

Código

Nombre

Categoría

Precio

Costo

Existencia

Estado

Categorías:

Lácteos

Queso Semiduro Kilo – ₡4.000

Queso Semiduro Medio Kilo – ₡2.000

Queso Ratón Kilo – ₡4.000

Queso Ratón Medio Kilo – ₡2.000

Natilla – ₡1.000

Cuajada – ₡1.000

Yogurt Fresa – ₡2.500

Yogurt Frutas – ₡2.500

Yogurt Natural – ₡2.500

Yogurt Piña y Coco – ₡2.500

Leche de Cabra 1 Litro – ₡2.000

Leche Fresca 1.5 Litros – ₡1.300

Leche Fresca 3 Litros – ₡3.000

Leche Agria 2.5 Litros – ₡2.500

Queso Rayado 200 gramos – ₡1.000

Queso Rayado 500 gramos – ₡2.500

Carnes

Trocitos de Cerdo 1 Kilo – ₡3.500

Chuleta de Cerdo 1 Kilo – ₡3.500

Hogar

Almohada Unidad – ₡5.000

Los productos deben poder modificarse posteriormente sin afectar el historial de ventas.

Módulo de Clientes

Registrar:

Nombre completo

Teléfono

Dirección exacta

Distrito

Cantón

Provincia

Referencia

Fotografía opcional

Geolocalización

Incluir botón:

"Capturar ubicación actual"

Debe guardar:

Latitud

Longitud

Dirección obtenida desde Google Maps

Mostrar ubicación en mapa.

Módulo de Rutas

Crear dos rutas:

Ruta Miércoles

Ruta Sábado

Permitir:

Asignar clientes a rutas.

Reasignar clientes.

Visualizar mapa de ruta.

Ver ventas por ruta.

Módulo de Ventas

Registrar:

Fecha

Cliente

Ruta

Productos

Cantidades

Subtotal

Descuento

Total

Métodos de pago:

Contado

Crédito

Generar comprobante imprimible.

Módulo de Crédito

Cuando la venta sea a crédito:

Registrar:

Fecha de crédito

Monto

Fecha límite

Saldo pendiente

Permitir:

Registrar abonos.

Historial de pagos.

Control de saldo.

Estado:

Al día

Vencido

Cancelado

Mostrar antigüedad de saldos:

0 a 30 días

31 a 60 días

61 a 90 días

Más de 90 días

Módulo de Cobranza

Mostrar:

Clientes con saldo pendiente.

Monto adeudado.

Último pago.

Próximo vencimiento.

Permitir:

Registrar pagos parciales.

Registrar pagos totales.

Generar recibos.

Inventario

Controlar:

Entradas

Salidas

Ajustes

Actualizar automáticamente al realizar ventas.

Mostrar:

Existencias actuales.

Existencias mínimas.

Alertas por faltantes.

Dashboard Gerencial

Mostrar:

Ventas

Hoy

Semana

Mes

Año

Créditos

Crédito activo

Crédito vencido

Cobros realizados

Productos

Más vendidos

Menos vendidos

Clientes

Mejores clientes

Clientes morosos

Rutas

Ventas Ruta Miércoles

Ventas Ruta Sábado

Reportes

Reporte de Ventas

Filtros:

Fecha

Cliente

Producto

Ruta

Reporte de Crédito

Mostrar:

Crédito activo

Crédito vencido

Saldos pendientes

Reporte de Cobranza

Mostrar:

Abonos

Cancelaciones

Morosidad

Reporte por Ruta

Comparar:

Ruta Miércoles

Ruta Sábado

Mostrar:

Cantidad vendida

Ingresos

Productos vendidos

Clientes atendidos

Reporte de Inventario

Entradas

Salidas

Existencias

Todos los reportes deben exportarse a PDF y Excel.

Funciones Adicionales

WhatsApp directo al cliente.

Historial de compras.

Recordatorios automáticos de cobro.

Notificaciones de cuentas vencidas.

Firma digital de entrega.

Adjuntar fotografías de entrega.

Escaneo QR de clientes.

Auditoría de acciones realizadas por usuarios.

Respaldo automático de información.

Base de Datos

Utilizar Supabase.

Tablas sugeridas:

usuarios

roles

clientes

productos

categorias

ventas

detalle_ventas

creditos

abonos

rutas

inventario

movimientos_inventario

reportes

auditoria

Resultado Esperado

Generar una aplicación completamente funcional tipo ERP comercial para distribución de productos lácteos, carnes y productos de hogar, con enfoque en ventas en ruta, control de cartera, cobranza e inventario.  Requisito Crítico: Aplicación Optimizada para Ventas en Ruta

La aplicación será utilizada principalmente desde teléfonos celulares y tabletas Android durante las rutas de reparto, por lo que el diseño debe seguir una filosofía Mobile First.

Rendimiento

El sistema debe ser extremadamente rápido y minimizar la cantidad de clics necesarios para realizar una venta.

Objetivo:

Registrar una venta completa en menos de 30 segundos.

Registrar un cliente frecuente en menos de 15 segundos.

Registrar un abono en menos de 10 segundos.

Interfaz para Ruta

Al iniciar sesión, el vendedor debe ingresar directamente al módulo de ruta del día.

Mostrar:

Clientes programados para la ruta.

Clientes pendientes por visitar.

Clientes ya atendidos.

Saldo pendiente de cada cliente.

Última compra realizada.

Botón de venta rápida.

Venta Rápida

Al seleccionar un cliente:

Mostrar inmediatamente:

Nombre.

Saldo pendiente.

Historial reciente.

Productos más comprados.

Permitir agregar productos mediante:

Botones grandes.

Selección táctil rápida.

Incrementar cantidad con botones + y -.

Búsqueda instantánea.

Evitar formularios extensos.

La venta debe completarse en una sola pantalla.

Productos Favoritos

El sistema debe aprender los productos más vendidos.

Mostrar primero:

Queso Semiduro.

Queso Ratón.

Leche Fresca.

Yogurt.

Natilla.

Cuajada.

Los productos frecuentes deben estar disponibles mediante accesos rápidos.

Facturación Express

Al finalizar la selección:

Botones grandes:

Contado.

Crédito.

Con un solo toque se debe completar la venta.

Cobro Rápido

Si el cliente tiene saldo pendiente:

Mostrar:

Saldo actual.

Botón "Registrar Abono".

El abono debe registrarse en menos de 3 clics.

Funcionamiento Offline

Debido a que algunas rutas pueden tener poca cobertura celular:

La aplicación debe:

Funcionar sin internet.

Guardar ventas localmente.

Sincronizar automáticamente cuando exista conexión.

Evitar pérdida de información.

Navegación Simplificada

Durante la ruta únicamente mostrar:

Clientes

Venta rápida

Cobros

Resumen del día

Ocultar funciones administrativas.

Impresión y Comprobantes

Permitir:

Compartir comprobante por WhatsApp.

Generar comprobante PDF.

Enviar comprobante automáticamente al cliente.

Geolocalización de Entregas

Registrar automáticamente:

Fecha.

Hora.

Coordenadas GPS.

Ubicación de entrega.

Dashboard del Vendedor

Mostrar en tiempo real:

Ventas del día.

Monto cobrado.

Crédito generado.

Clientes visitados.

Clientes pendientes.

Meta diaria.

Indicadores de Eficiencia

Medir:

Tiempo promedio por visita.

Tiempo promedio de facturación.

Ventas por hora.

Rendimiento por ruta.

Clientes atendidos por día.

Experiencia de Usuario

Priorizar siempre:

Velocidad.

Simplicidad.

Uso con una sola mano.

Botones grandes para uso en carretera.

Pocos clics.

Pantallas limpias.

Carga instantánea.

La aplicación debe sentirse similar a una aplicación de repartidores o vendedores de campo, donde cada segundo ahorrado representa más clientes atendidos durante la ruta. Además, yo agregaría una función que suele marcar una gran diferencia en este tipo de negocios: "Venta Repetir Pedido". El vendedor llega donde un cliente, presiona un botón y el sistema carga automáticamente la última compra realizada. Solo ajusta cantidades y factura. Esto puede reducir el tiempo de atención de 30 segundos a menos de 10 segundos por cliente.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://rutacontrol.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cc5f4a56-2277-4d48-8fd8-6bf13c336ce5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
