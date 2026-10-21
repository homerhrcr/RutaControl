# Administración de catálogos — auditoría y corrección de selectores

## Inventario real encontrado (búsqueda global en el código)

| Campo / pantalla | Origen actual | Tratamiento |
|---|---|---|
| Categoría de producto (Productos) | Catálogo en base de datos | Reutilizar; agregar descripción, activo, orden, predeterminado |
| Categoría de gasto (Gastos, filtros) | Catálogo en base de datos (guarda el nombre) | Igual que arriba; mantiene renombrado en cascada |
| Rutas (Clientes, Pedidos, Devoluciones, Carga, Telegram, Precios especiales) | Tabla de rutas | Ya administrable; agregar activo y orden, ocultar inactivas en registros nuevos |
| Motivo de devolución (Devoluciones y catálogo Telegram) | Lista fija duplicada en 2 archivos | Migrar a catálogo editable único |
| Destino de devolución (Merma / Regresa a bodega) | Lista fija | Código interno protegido: solo se edita la etiqueta |
| Tipo de identificación (Clientes, Facturación) | Lista fija duplicada | Códigos de Hacienda protegidos: solo etiqueta, activo y orden |
| Tarifa de IVA (Productos) | Lista fija | Códigos de Hacienda protegidos: etiqueta, activo, orden, predeterminado |
| Método de pago (contado/crédito) | Enumeración de la base | Protegido: solo etiqueta |
| Rol de usuario (Usuarios) | Enumeración de permisos | Restricción técnica: no editable (seguridad); documentado |
| Ambiente de facturación (Pruebas/Producción) | Lista fija | Restricción técnica: requerido por Hacienda; documentado |
| Filtro de Auditoría (Todas/Ventas/Abonos) | Lista fija de tablas | Restricción técnica: nombres de tablas del sistema |
| Provincia/Cantón/Distrito | Catálogo oficial del IGN | Restricción técnica: división territorial oficial; se mantiene la cascada |
| Clientes, productos, listas de precios, vendedores, créditos | Registros del negocio | Ya se administran en sus propios módulos |

## Qué se construye

1. **Catálogo de opciones por empresa**: una sola fuente para motivos de devolución, destinos, tipos de identificación, tarifas de IVA y métodos de pago. Cada opción tiene código estable, etiqueta, descripción, activa/inactiva, orden, predeterminada y marca de "protegida" (código no editable ni eliminable).
2. **Nueva pestaña "Catálogos" en Administración**: lista de todos los catálogos con módulo/campos que los usan, conteo de activas/inactivas, búsqueda, y por catálogo: agregar, editar etiqueta/descripción, activar/desactivar, reordenar (flechas), marcar predeterminada. Eliminar solo si no hay registros que la usen; si los hay, ofrece desactivar.
3. **Selectores conectados**: todos los campos de la tabla leen del catálogo; las inactivas no se ofrecen en registros nuevos, pero un registro guardado sigue mostrando su valor ("(inactiva)"). El enlace "Administrar" junto al campo abre el catálogo correspondiente.
4. **Valores iniciales**: se cargan las opciones que hoy existen en el código para cada empresa existente (y para empresas nuevas), sin cambiar datos guardados.

## Permisos

- Lectura: cualquier usuario de la empresa. Escritura: solo administradores de esa empresa, validado por las reglas de la base de datos (no solo ocultando botones). Aislamiento por empresa igual que el resto del sistema.
- Las opciones protegidas rechazan cambios de código y eliminación también en la base de datos.

## Pruebas

- Pruebas automáticas de la lógica: inactivas excluidas en nuevos, valor histórico conservado, orden, predeterminada, sin duplicados.
- Prueba real en el navegador: crear, editar, desactivar y reordenar una opción; verificar que aparece en Devoluciones y Productos; vendedor no puede modificar.
- Informe final con resultados reales y pendientes.

## Detalles técnicos

- Migración: tabla `catalogo_opciones` (organization_id, catalogo, codigo, etiqueta, descripcion, activo, orden, predeterminado, protegido; único por empresa+catálogo+código y etiqueta sin mayúsculas), GRANTs, RLS restrictiva por empresa + políticas admin vía `is_admin`, trigger que protege código/eliminación de opciones protegidas, seed por empresa y trigger para empresas nuevas. Columnas aditivas `descripcion, activo, orden, predeterminado` en `categorias`, `categorias_gasto`, `rutas` (activo/orden).
- Hook `useOpciones(catalogo)` cacheado offline; componente compartido `OpcionSelect`; `CatalogSelect` filtra inactivas preservando el valor actual; telegram.catalogo lee motivos desde el servidor.
- Se agrega a `cambios_desde` para sincronización.
