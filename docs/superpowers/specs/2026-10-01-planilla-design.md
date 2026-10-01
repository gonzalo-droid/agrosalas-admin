# Planilla — diseño

- **Fecha:** 2026-10-01
- **Proyecto:** `agrosalas_admin` (panel interno de Agrosalas Perú, separado del sitio público `agrosalas-app`)
- **Estado:** diseño acordado en conversación; quedan los supuestos de la sección 16
- **Módulos futuros (fuera de este spec):** inventario, compras y ventas

## 1. Contexto y objetivo

Hoy la planilla se lleva en un Excel con una hoja por periodo. Cada hoja tiene los días en columnas y, por trabajador, cuatro horas por día (ingreso y salida de mañana, ingreso y salida de tarde), el total de horas, las horas normales y extra, y el monto del día. Al final de la fila están el total, lo cancelado y lo pendiente.

Problemas del Excel:

- Las fórmulas se copian a mano y se rompen. En las columnas del martes la jornada apunta a una celda vacía y todas las horas se pagan como extra (unos S/ 12.50 de más por trabajador ese día).
- Los pagos parciales, las evidencias y los datos de Yape quedan en celdas sueltas.
- No hay datos del trabajador más allá del nombre, ni control de quién edita.
- No se puede registrar desde el celular en planta.

Objetivo: reemplazar ese Excel por un sistema web que registre trabajadores, asistencia diaria y pagos, calcule los montos de forma consistente y muestre el costo por semana, mes, área y campaña.

Este spec incluye la base del panel (login, roles, estructura del repo), porque planilla es el primer módulo que la necesita.

## 2. Alcance

### Incluye

- Login, perfil y roles (administrador, gerencia, contabilidad, coordinador).
- Catálogos: áreas, turnos, campañas, cargos con sus tarifas de referencia, grupos de trabajadores, usuarios.
- Trabajadores: ficha, cargo, grupos y métodos de pago (Yape, Plin, cuentas bancarias).
- Asistencia diaria con cuatro marcas, faltas y permisos, carga en bloque.
- Cálculo de horas normales, horas extra y monto por día.
- Planillas semanales (temporales) y mensuales (contrato), creadas a mano con nombre y campaña, con lista, detalle y cierre.
- Conceptos adicionales: bono, descuento, destajo, sueldo.
- Pagos parciales con evidencia (imagen o PDF) y saldo pendiente.
- Recibo imprimible por trabajador y planilla.
- Reportes de costo por semana, mes, área y campaña, con exportación a Excel.
- Registro de auditoría.
- Migración del historial del Excel.

### No incluye

- Descuentos de ley (AFP/ONP, EsSalud), boletas formales, PLAME.
- Producción (cajas por batch) y costo de personal por caja: va con inventario.
- Cálculo automático de destajo a partir de producción.
- Que los trabajadores entren al sistema.
- Uso sin conexión, app móvil nativa, segundo factor de autenticación.
- Otros idiomas (solo español).
- Redirección desde el sitio público hacia el panel (se hará después).

## 3. Arquitectura

Un repo con dos proyectos y despliegues independientes:

```
agrosalas_admin/
  backend/    API REST (TypeScript, Hono, Zod, Drizzle)
  frontend/   Next.js 16 (App Router), Tailwind, shadcn/ui, TanStack Query
  docs/
```

| Parte | Responsabilidad |
|---|---|
| `backend/` | Toda la lógica de negocio: cálculo, permisos, cierre, pagos, reportes, auditoría. Único componente que habla con la base de datos. |
| `frontend/` | Pantallas. Solo consume la API; no importa Drizzle ni toca Postgres. |
| Supabase | Postgres, Auth (login) y Storage (evidencias de pago). |

Decisiones:

- **Autenticación.** El frontend inicia sesión con Supabase Auth (`@supabase/ssr`) y envía el token de acceso como `Authorization: Bearer` en cada llamada. El backend valida el JWT contra las claves públicas de Supabase y carga el usuario (rol y áreas) desde la tabla `usuarios`. El alta pública está desactivada: los usuarios los crea el administrador.
- **Base de datos cerrada.** RLS activado en todas las tablas y sin políticas: las claves públicas de Supabase no pueden leer ni escribir nada. El backend se conecta como rol privilegiado por el pooler en modo transacción (Drizzle + `postgres` con `prepare: false`).
- **Tipos compartidos.** El frontend usa el cliente RPC de Hono (`hc<AppType>`) importando solo el tipo de la API mediante npm workspaces. Los esquemas Zod viven en el backend.
- **Dinero y tiempo.** El cálculo usa enteros: minutos y céntimos. Las fechas se interpretan siempre en `America/Lima`.
- **Entornos.** Dos proyectos Supabase: desarrollo y producción.
- **Despliegue.** Frontend y backend en Vercel como dos proyectos, con dominios `admin.agrosalasperu.com` y `api.agrosalasperu.com`. El plan Hobby de Vercel no admite uso comercial: si la cuenta no es Pro, la API se aloja en Cloudflare Workers (Hono corre igual). Se decide al desplegar.
- **Verificación.** GitHub Actions ejecuta pruebas, lint y tipos en cada PR.

## 4. Roles y permisos

| Acción | Administrador | Gerencia | Contabilidad | Coordinador |
|---|---|---|---|---|
| Configuración (usuarios, áreas, turnos, campañas, cargos y tarifas, grupos) | Sí | No | No | No |
| Ver trabajadores | Todos | Todos | Todos | Solo de sus áreas, sin datos bancarios ni tarifas |
| Crear y editar trabajadores | Sí | No | Sí | No |
| Registrar y corregir asistencia | Sí | No | Sí | Solo de sus áreas, en planillas abiertas |
| Ver montos (tarifas, totales, pagos) | Sí | Sí | Sí | No |
| Conceptos y pagos | Sí | No | Sí | No |
| Cerrar planilla | Sí | No | Sí | No |
| Reabrir planilla | Sí | No | No | No |
| Reportes | Sí | Sí | Sí | No |
| Ver auditoría | Sí | No | No | No |

Reglas:

- Los permisos se aplican en el backend. Para el coordinador, la API no envía los campos de dinero ni los datos bancarios; no basta con ocultarlos en pantalla.
- Un coordinador tiene una o más áreas asignadas.

Que el coordinador vea horas pero no montos es un supuesto (sección 16).

## 5. Modelo de datos

> **Nombres.** Las secciones 5 y 9 todavía usan los nombres en español con los que se diseñó el modelo. Desde el 2026-10-01 el código, la base y la API se escriben en inglés: el nombre que vale es el de la sección 17, que trae la equivalencia de cada tabla, campo, valor y ruta.

Todas las tablas llevan `id` (uuid), `creado_en` y `actualizado_en`.

### `usuarios`

| Campo | Tipo | Nota |
|---|---|---|
| `id` | uuid | Igual al id del usuario en Supabase Auth |
| `nombre` | texto | |
| `rol` | enum | `admin`, `gerencia`, `contabilidad`, `coordinador` |
| `activo` | booleano | |

`usuario_areas (usuario_id, area_id)` asigna áreas a los coordinadores.

### Catálogos

- `areas (nombre, activo)`. Iniciales: Producción, Etiquetado, Almacén. Editable.
- `cargos (nombre, tipo_pago, tarifa_hora, tarifa_hora_extra, sueldo_mensual, activo)`. Es donde viven las tarifas de referencia. `tipo_pago` es `por_hora` o `mensual`. Ejemplos: Operario S/ 6.25 y S/ 7.81; Estibador S/ 10.00 y S/ 12.50; Mecánico S/ 30.00 y S/ 37.50.
- `grupos (nombre, temporal, fecha_inicio?, fecha_fin?)` y `grupo_trabajadores (grupo_id, trabajador_id)`. Un grupo (por ejemplo "Turno noche" o una cuadrilla armada por unos días) sirve para cargar varios trabajadores a una planilla de una vez. Un trabajador puede estar en varios grupos.
- `turnos (nombre, hora_inicio, hora_fin)`. Iniciales: Día, Noche. Solo referencial, no interviene en el cálculo.
- `campanas (nombre, fecha_inicio, fecha_fin, activa)`. Ejemplo: "Contenedor Chile".

### `trabajadores`

| Campo | Obligatorio | Nota |
|---|---|---|
| `dni` | Sí al crear desde la app | Único cuando existe. Los migrados del Excel quedan sin DNI y marcados como pendientes |
| `nombres`, `apellidos` | Sí | |
| `telefono`, `correo`, `direccion` | No | |
| `emergencia_nombre`, `emergencia_telefono` | No | |
| `area_id`, `cargo_id`, `turno_id` | No | El cargo aporta las tarifas de referencia |
| `modalidad` | Sí | `temporal` o `contrato` |
| `fecha_ingreso` | No | |
| `estado` | Sí | `activo` o `cesado` |
| `notas` | No | |

El trabajador no guarda tarifas propias: la referencia es la de su cargo y el valor real queda en cada registro de asistencia.

### `trabajador_metodos_pago`

Cero o más por trabajador; todos opcionales.

| Campo | Nota |
|---|---|
| `trabajador_id` | |
| `tipo` | `yape`, `plin` o `cuenta_bancaria` |
| `numero` | Celular o número de cuenta |
| `banco`, `cci` | Solo para cuenta bancaria |
| `titular` | Puede ser otra persona |
| `principal` | Uno por trabajador; es el que se propone al pagar |

### `planillas`

| Campo | Nota |
|---|---|
| `nombre` | Lo escribe quien la crea. Ejemplo: "Semana 39 · Contenedor Chile" |
| `tipo` | `semanal` (temporales) o `mensual` (contrato) |
| `fecha_inicio`, `fecha_fin` | Se proponen de lunes a domingo, o el mes completo; son editables |
| `campana_id` | Opcional. Una sola campaña por planilla |
| `estado` | `abierta` o `cerrada` |
| `creada_por`, `cerrada_por`, `cerrada_en` | |

`planilla_trabajadores (planilla_id, trabajador_id)` lista quiénes participan en la planilla.

### `asistencias`

Una por trabajador y fecha (único).

| Campo | Nota |
|---|---|
| `trabajador_id`, `fecha`, `planilla_id` | La fecha es la del ingreso, en hora de Lima |
| `tipo` | `trabajado`, `falta`, `permiso`, `descanso_medico` |
| `ingreso_1`, `salida_1`, `ingreso_2`, `salida_2` | timestamptz. El segundo tramo es opcional |
| `minutos_trabajados`, `minutos_normales`, `minutos_extra` | Enteros |
| `extra_editada` | Verdadero si el encargado cambió las horas extra sugeridas |
| `tarifa_hora`, `tarifa_hora_extra` | Copiadas del cargo del trabajador al crear; editables por registro |
| `monto_centimos` | Entero |
| `area_id`, `modalidad` | Copia del valor del trabajador ese día |
| `nota`, `registrado_por` | |
| `origen`, `revisar` | `origen = 'excel'` para lo migrado; `revisar` marca registros dudosos |

### `conceptos`

`(planilla_id, trabajador_id, tipo, monto_centimos, nota, registrado_por)`. Tipos: `sueldo`, `bono`, `destajo` (suman) y `descuento` (resta).

### `pagos`

`(planilla_id, trabajador_id, fecha, monto_centimos, medio, metodo_detalle, evidencia_ruta?, nota, registrado_por)`. `medio` es `yape`, `plin`, `transferencia` o `efectivo`; `metodo_detalle` copia el número y el titular usados, para que el historial no cambie si luego se edita el método del trabajador.

### `auditoria`

`(usuario_id, accion, entidad, entidad_id, antes jsonb, despues jsonb, creado_en)`. El backend escribe una fila por cada creación, edición o eliminación de trabajadores, asistencias, conceptos, pagos, planillas y usuarios.

## 6. Reglas de cálculo

Módulo puro en `backend/` (sin acceso a base de datos), con pruebas unitarias.

1. `minutos_trabajados = (salida_1 − ingreso_1) + (salida_2 − ingreso_2)`. El refrigerio es el hueco entre tramos y no se paga. Con un solo tramo, solo cuenta el primero.
2. Si una salida es menor que su ingreso, se asume que es del día siguiente (turno de noche). El registro pertenece a la fecha del primer ingreso.
3. Jornada: 480 minutos.
4. Horas extra sugeridas: `max(0, minutos_trabajados − 480)`. El encargado puede cambiar `minutos_extra` a cualquier valor entre 0 y `minutos_trabajados`; `minutos_normales` es la diferencia.
5. Las tarifas de referencia se definen por cargo en Configuración (Operario S/ 6.25, Estibador S/ 10.00, Mecánico S/ 30.00 por hora, cada uno con su hora extra). Al crear un registro se copian las del cargo del trabajador; ambas son editables en cada registro, lo que cubre trabajos mejor pagados, domingos, feriados y acuerdos puntuales. Al crear un cargo, la hora extra se propone como normal × 1.25.
6. `monto = minutos_normales × tarifa_hora ÷ 60 + minutos_extra × tarifa_hora_extra ÷ 60`, redondeado al céntimo (mitad hacia arriba). Se paga al minuto, sin redondear las horas.
7. Cada registro guarda sus tarifas. Cambiar la tarifa de un cargo, o el cargo de un trabajador, no altera registros anteriores.
8. Faltas, permisos y descansos médicos tienen monto 0.
9. Personal con contrato: registra asistencia igual, pero el monto de cada día es 0. Su pago es el concepto `sueldo` de la planilla mensual.

Ejemplo: ingreso 7:10, salida 13:00, regreso 14:00, salida 18:30. Son 350 + 270 = 620 minutos: 480 normales y 140 extra. Monto = 8 × 6.25 + (140 ÷ 60) × 7.8125 = 50.00 + 18.23 = **S/ 68.23**.

**Diferencia con el Excel:** el Excel usa 1500.4 ÷ 30 ÷ 8 = 6.2517 por hora; aquí el cargo Operario se configura con 6.25 exacto (jornal de S/ 50 ÷ 8). La diferencia es de un céntimo por jornada.

## 7. Planillas

Las planillas se crean a mano (administrador o contabilidad) con el formulario "Nueva planilla":

- **Nombre.** Se propone uno ("Semana 41 · Contenedor Chile") y se puede cambiar.
- **Tipo.** Semanal para temporales, mensual para personal con contrato.
- **Fechas.** Se proponen de lunes a domingo (o el mes completo) y se pueden cambiar.
- **Campaña.** Opcional, una por planilla. Es la etiqueta que se ve en la lista y la que usan los reportes.
- **Trabajadores.** Se agregan con un buscador (nombre o DNI) y quedan como etiquetas que se pueden quitar, o se cargan en bloque desde un grupo: la planilla anterior, un grupo creado en Configuración (por ejemplo "Turno noche") o todos los temporales activos. Se pueden agregar y quitar mientras la planilla esté abierta.

Reglas:

- Solo se registra asistencia dentro de una planilla abierta cuyas fechas incluyan ese día, y solo a los trabajadores agregados a esa planilla. Si no hay ninguna, la pantalla de asistencia pide crearla.
- Dos planillas pueden coincidir en fechas (por ejemplo, dos campañas la misma semana con cuadrillas distintas), pero un trabajador solo puede tener un registro de asistencia por fecha, así que no puede estar en dos planillas el mismo día.
- Al crear una planilla mensual se genera un concepto `sueldo` por cada trabajador de contrato incluido (monto editable, por ejemplo para un mes incompleto).
- **Total por trabajador:** suma de montos de asistencia + conceptos que suman − descuentos.
- **Pendiente:** total − pagos. Puede ser negativo (adelanto mayor al total acumulado); se muestra como saldo a favor de la empresa.

Estado que ve el usuario:

| Estado | Condición |
|---|---|
| En curso | Abierta y la fecha de hoy está dentro del periodo |
| Por pagar | Abierta y el periodo ya terminó |
| Cerrada | Cerrada por contabilidad o administrador |

Cierre:

- Bloquea crear, editar y eliminar asistencias, conceptos y pagos de esa planilla.
- Si algún trabajador tiene pendiente distinto de 0, el cierre pide confirmación y muestra la lista.
- Solo el administrador puede reabrir. Cierre y reapertura quedan en auditoría.

Campañas:

- La campaña pertenece a la planilla; todos sus registros y conceptos cuentan para esa campaña.
- El costo de una campaña es la suma de los totales de sus planillas.
- Las planillas mensuales de contrato normalmente no llevan campaña; en los reportes aparecen como "Personal con contrato".

## 8. Pagos y evidencia

- Un pago tiene monto, fecha, medio, nota y evidencia opcional. Al pagar se elige entre los métodos del trabajador (se propone el principal) o efectivo.
- Historial: en la pestaña Pagos de la planilla se ven todos los pagos hechos a cada trabajador en ese periodo; en la ficha del trabajador, sus pagos de todas las planillas.
- La evidencia va a un bucket privado de Supabase Storage. El backend entrega una URL firmada de subida y, para verla, una URL firmada de lectura de corta duración.
- Formatos: JPG, PNG, WebP, PDF. Máximo 5 MB. El frontend comprime las imágenes antes de subir.
- Recibo: página imprimible por trabajador y planilla (detalle por día, conceptos, pagos, pendiente). Se guarda como PDF desde el navegador y se puede compartir desde el celular.

## 9. API

REST bajo `/v1`, con validación Zod en entrada y salida.

| Recurso | Operaciones |
|---|---|
| `/me` | Usuario actual, rol y áreas |
| `/usuarios`, `/areas`, `/turnos`, `/campanas`, `/cargos`, `/grupos` | CRUD (administrador) |
| `/trabajadores` | Listar con filtros (área, modalidad, estado, texto), crear, ver, editar, cesar; métodos de pago (agregar, editar, quitar, marcar principal) |
| `/asistencias` | Listar por fecha y área; `POST /marcar` (ingreso, salida a refrigerio, regreso, salida, con hora actual o indicada); `POST /bloque` (misma marca para varios); editar registro completo; eliminar |
| `/planillas` | Listar (texto, rango de fechas, campaña, estado, tipo); crear; editar nombre, fechas y campaña; agregar y quitar trabajadores; detalle en grilla; cerrar; reabrir; exportar a Excel |
| `/planillas/:id/trabajadores/:tid` | Detalle para el recibo |
| `/conceptos` | Crear, editar, eliminar |
| `/pagos` | Crear, listar, eliminar |
| `/evidencias` | URL firmada de subida y de lectura |
| `/reportes/costos` | Agrupado por semana, mes, área o campaña, en un rango de fechas; exportar a Excel |
| `/auditoria` | Listar (administrador) |

Errores con un formato único: código, mensaje en español y, si aplica, campo.

Todas las listas (planillas, trabajadores, pagos, auditoría) se paginan en el servidor: reciben página y tamaño, y devuelven el total de filas.

## 10. Pantallas

Menú: Asistencia, Planillas, Trabajadores, Reportes, Configuración, y abajo el usuario con acceso a su perfil. Lateral en PC, barra inferior en celular. Los pagos no tienen entrada propia en el menú: son una pestaña dentro de cada planilla. El coordinador solo ve Asistencia, Planillas (sin montos ni pestaña de pagos) y Trabajadores de sus áreas.

Prototipo visual de referencia: https://claude.ai/artifact/CQCMfcsgQu5ceS96UMBXmU (privado, del autor).

Relación entre asistencia y planilla: la asistencia es el registro de un trabajador en un día (horas y monto); la planilla es el periodo que agrupa esos registros, más los conceptos y los pagos, y da el total a pagar. "Asistencia" en el menú es el atajo para marcar el día de hoy; escribe en la misma planilla que se ve en "Planillas".

1. **Login y perfil.** Inicio de sesión con correo y contraseña, recuperación de contraseña por correo, y "Mi perfil" (nombre, rol y áreas en solo lectura, cambio de contraseña, cerrar sesión).
2. **Asistencia del día** (prioridad celular). Selector de planilla (por defecto, la abierta que incluye hoy), filtro por área, botón "Marcar ingreso a todos". Cada fila tiene un solo botón con el siguiente paso (ingreso, refrigerio, regreso, salida). Editar abre el registro completo, incluido marcar falta o permiso. Las marcas se reflejan al instante y se reintentan si la conexión falla.
3. **Planillas (lista).** Una fila por planilla: nombre y fechas, etiqueta de campaña, tipo, número de personas, total, pagado, pendiente, estado. Filtros por texto, rango de fechas, campaña y estado. Arriba: pendiente acumulado, planillas por pagar, pagado en el mes. Botón "Nueva planilla" que abre el formulario de la sección 7.
4. **Planilla (detalle semanal)** (prioridad PC). Grilla como el Excel: trabajadores en filas, días en columnas con horas normales y extra, y columnas Total, Pagado, Pendiente. Totales por día y por semana. Clic en una celda abre el registro del día. Acciones: exportar, cerrar.
5. **Trabajadores.** Lista con búsqueda y filtros; ficha con datos, cargo (con su tarifa de referencia), grupos, métodos de pago (varios, con botón para agregar Yape, Plin o cuenta bancaria) e historial de planillas y pagos. Los migrados sin DNI se señalan como pendientes.
6. **Pagos (pestaña de la planilla).** Saldo de cada trabajador, historial de pagos del periodo con su evidencia, formulario de nuevo pago que propone el pendiente y el método principal, recibo. La planilla tiene tres pestañas: Asistencia, Pagos y Trabajadores.
7. **Reportes.** Ver sección 11.
8. **Configuración.** Cargos y tarifas de referencia, grupos de trabajadores, áreas, turnos, campañas, usuarios y roles, auditoría.

Las listas de planillas y trabajadores llevan paginador (filas por página, anterior, siguiente, número de página) y muestran el total de filas.

Dirección visual: misma identidad que el sitio (verde de marca para lo activo y pagado, ámbar para pendiente y horas extra, rojo para faltas), tipografía Inter, fondo claro, sin adornos.

## 11. Reportes

La sección Reportes se organiza por módulo (Planilla ahora; Inventario, Compras y Ventas cuando existan), con un selector de módulo arriba y las pestañas de cada módulo debajo. Este spec solo define los de Planilla.

Todos con rango de fechas y exportación a Excel.

| Reporte | Contenido |
|---|---|
| Costo por semana | Total, horas normales y extra de cada semana de lunes a domingo, según la fecha de cada asistencia; los conceptos cuentan en la semana en que empieza su planilla |
| Costo por mes | Igual, agrupado por mes; incluye sueldos de contrato |
| Costo por área | Total y horas por área en el rango |
| Costo por campaña | Costo total de cada campaña, días trabajados, personas, horas normales y extra, pagado y pendiente; detalle por planilla y por trabajador |
| Detalle por trabajador | Días, horas, monto, pagos y pendiente en el rango |

## 12. Migración del Excel

Script en `backend/scripts/` que recibe la ruta del archivo. El Excel no se guarda en el repo.

- **Hojas a migrar:** "13 al 19 1era sem" (13–19 abr 2026), "SEM 17 20 AL 25" (20–25 abr), "9 MAYO" (9 may), "ETI 5 AL 10 Junio" (5–10 jun).
- **Hojas omitidas:** "ejemplo 43" y "Hoja1" (duplicados), "SE DEBE" y "PRDUC X DIA" (producción).
- **Trabajadores:** se crean por nombre, sin DNI ni cargo, con modalidad temporal y estado activo. Los nombres casi iguales entre hojas se listan para unificarlos a mano.
- **Asistencias:** se importan las cuatro horas y el monto tal como está en el Excel, con `origen = 'excel'`. No se recalculan, porque es lo que se pagó.
- **Días con la fórmula errada** (toda la jornada como extra): se importan con `revisar = true`.
- **Pagos:** se importan desde las columnas de cancelado y abonos. La fecha de pago del Excel no es fiable, así que se usa el último día del periodo y se anota "migrado".
- **Planillas y campañas:** cada hoja migrada se convierte en una planilla con el nombre de la hoja. "ETI 5 AL 10 Junio" se asigna a una campaña "Etiquetado junio"; el resto a "Contenedor Chile".
- **Modo de prueba:** el script primero genera un resumen (trabajadores, registros, totales por hoja comparados con los del Excel) sin escribir nada. Solo se ejecuta la carga real después de revisar ese resumen.

Observación: la hoja "9 MAYO" dice "LUNES 09/05/2026", pero ese día fue sábado. Se usa la fecha.

**Supuestos a confirmar:** la asignación de campañas a las hojas y que las columnas de abono se interpretan como "monto pagado".

## 13. Seguridad y respaldo

- Alta pública desactivada en Supabase Auth.
- CORS de la API limitado al dominio del panel.
- Secretos solo en variables de entorno del backend; el frontend solo conoce la URL y la clave pública de Supabase y la URL de la API.
- Bucket de evidencias privado.
- Respaldo: copia semanal automática de la base (tarea programada con `pg_dump` hacia un almacenamiento privado) o plan Pro de Supabase con copias diarias. Se decide al crear el proyecto de producción, tras verificar qué incluye el plan vigente.

## 14. Pruebas

- **Cálculo:** pruebas unitarias del módulo puro (un tramo, dos tramos, turno de noche, extra editada, tarifas distintas, redondeo, contrato).
- **API:** pruebas por endpoint contra una base de pruebas, incluidas las de permisos: cada rol recibe lo que le corresponde y el coordinador nunca recibe campos de dinero.
- **Cierre:** una planilla cerrada rechaza cambios.
- **Migración:** los totales por hoja del modo de prueba coinciden con los del Excel.
- **Frontend:** pruebas de componentes para la grilla semanal y el flujo de marcar asistencia. Las pruebas de punta a punta con Playwright quedan para después.

## 15. Fases de construcción

Cada fase tiene su plan de implementación y deja algo usable.

1. **Base.** Repo, backend y frontend mínimos, Supabase, login, perfil, roles, catálogos (áreas, turnos, campañas, cargos y tarifas, grupos), trabajadores con métodos de pago, auditoría, verificación automática.
2. **Asistencia.** Módulo de cálculo, creación manual de planillas, registro diario, carga en bloque, lista y detalle de planillas.
3. **Pagos.** Conceptos, pagos con evidencia, cierre y reapertura, recibo, planilla mensual de contrato.
4. **Reportes.** Costos por semana, mes, área y campaña; exportación a Excel.
5. **Migración.** Script, revisión del resumen y carga del historial.

## 16. Supuestos pendientes de confirmar

Se toman como valor por defecto y son baratos de cambiar más adelante.

1. El coordinador ve horas pero no montos ni datos bancarios.
2. Cerrar una planilla con saldo pendiente pide confirmación en lugar de impedirse.
3. La tarifa inicial del cargo Operario es S/ 6.25 exacto, no el 6.2517 del Excel.
4. Asignación de campañas a las hojas del Excel e interpretación de las columnas de abono (sección 12).
5. Alojamiento de la API (Vercel Pro o Cloudflare Workers) y forma de respaldo (sección 13).

## 17. Convención de nombres

Decidido el 2026-10-01. Reemplaza la regla "identificadores del dominio en español" de los planes 1A y 1B.

### Qué va en inglés y qué en español

| Va en inglés | Va en español |
|---|---|
| Carpetas y archivos de código | Todo texto que lee una persona en el panel: etiquetas, botones, avisos, títulos |
| Variables, funciones, tipos, clases, componentes y hooks | El `message` de los errores de la API y los mensajes de validación |
| Tablas, columnas, tipos enum, valores enum e índices de la base | Correos que envía el sistema |
| Rutas de la API, parámetros, claves JSON y códigos de error | La prosa de este spec, de los planes y del README |
| Direcciones del panel (`/workers`, `/settings`) | |
| Variables de entorno y scripts de npm | |
| Claves de consulta de TanStack Query | |
| Comentarios del código, nombres de las pruebas y mensajes de commit | |

Reglas:

- Un valor del contrato nunca se muestra tal cual: todo valor enum, nombre de entidad o nombre de campo que llega a la pantalla pasa por un mapa de etiquetas en español (`ROLE_LABEL`, `FIELD_LABEL`, etc.).
- Se conservan los nombres propios peruanos: `dni`, `cci`, `yape`, `plin`.
- Base de datos en `snake_case`; TypeScript y JSON en `camelCase`; archivos y rutas en `kebab-case`; componentes y tipos en `PascalCase`.
- Un booleano cuyo nombre natural es palabra reservada de SQL lleva prefijo `is_` (`is_primary`).

### Glosario del dominio

| Español | Inglés (singular / plural) |
|---|---|
| trabajador | worker / workers |
| usuario | user / users |
| área | area / areas |
| turno | shift / shifts |
| campaña | campaign / campaigns |
| cargo | position / positions |
| grupo | group / groups |
| método de pago | payment method / payment methods |
| auditoría | audit log |
| planilla | payroll / payrolls |
| asistencia | attendance record / attendance |
| concepto | payroll item / payroll items |
| pago | payment / payments |
| evidencia | evidence |
| reporte de costos | cost report |
| perfil | profile |
| configuración | settings |

### Tablas y columnas

Todas las tablas llevan `id`, `created_at` y `updated_at`.

| Tabla (español → inglés) | Columnas (español → inglés) |
|---|---|
| `usuarios` → `users` | `correo` → `email`, `nombre` → `name`, `rol` → `role`, `activo` → `active` |
| `usuario_areas` → `user_areas` | `usuario_id` → `user_id`, `area_id` |
| `areas` → `areas` | `nombre` → `name`, `activo` → `active` |
| `turnos` → `shifts` | `nombre` → `name`, `hora_inicio` → `start_time`, `hora_fin` → `end_time`, `activo` → `active` |
| `campanas` → `campaigns` | `nombre` → `name`, `fecha_inicio` → `start_date`, `fecha_fin` → `end_date`, `activo` → `active` |
| `cargos` → `positions` | `nombre` → `name`, `tipo_pago` → `pay_type`, `tarifa_hora` → `hourly_rate`, `tarifa_hora_extra` → `overtime_rate`, `sueldo_mensual` → `monthly_salary`, `activo` → `active` |
| `grupos` → `groups` | `nombre` → `name`, `temporal` → `temporary`, `fecha_inicio` → `start_date`, `fecha_fin` → `end_date`, `activo` → `active` |
| `grupo_trabajadores` → `group_workers` | `grupo_id` → `group_id`, `trabajador_id` → `worker_id` |
| `trabajadores` → `workers` | `dni`, `nombres` → `first_name`, `apellidos` → `last_name`, `telefono` → `phone`, `correo` → `email`, `direccion` → `address`, `emergencia_nombre` → `emergency_contact_name`, `emergencia_telefono` → `emergency_contact_phone`, `area_id`, `cargo_id` → `position_id`, `turno_id` → `shift_id`, `modalidad` → `employment_type`, `fecha_ingreso` → `hire_date`, `estado` → `status`, `notas` → `notes` |
| `trabajador_metodos_pago` → `worker_payment_methods` | `trabajador_id` → `worker_id`, `tipo` → `type`, `numero` → `number`, `banco` → `bank`, `cci`, `titular` → `holder_name`, `principal` → `is_primary` |
| `auditoria` → `audit_log` | `usuario_id` → `user_id`, `accion` → `action`, `entidad` → `entity`, `entidad_id` → `entity_id`, `antes` → `before`, `despues` → `after` |
| `planillas` → `payrolls` (fase 2) | `nombre` → `name`, `tipo` → `type`, `fecha_inicio` → `start_date`, `fecha_fin` → `end_date`, `campana_id` → `campaign_id`, `estado` → `status`, `creada_por` → `created_by`, `cerrada_por` → `closed_by`, `cerrada_en` → `closed_at` |
| `planilla_trabajadores` → `payroll_workers` (fase 2) | `planilla_id` → `payroll_id`, `trabajador_id` → `worker_id` |
| `asistencias` → `attendance_records` (fase 2) | `trabajador_id` → `worker_id`, `fecha` → `date`, `planilla_id` → `payroll_id`, `tipo` → `type`, `ingreso_1` → `clock_in_1`, `salida_1` → `clock_out_1`, `ingreso_2` → `clock_in_2`, `salida_2` → `clock_out_2`, `minutos_trabajados` → `worked_minutes`, `minutos_normales` → `regular_minutes`, `minutos_extra` → `overtime_minutes`, `extra_editada` → `overtime_edited`, `tarifa_hora` → `hourly_rate`, `tarifa_hora_extra` → `overtime_rate`, `monto_centimos` → `amount_cents`, `area_id`, `modalidad` → `employment_type`, `nota` → `note`, `registrado_por` → `recorded_by`, `origen` → `source`, `revisar` → `needs_review` |
| `conceptos` → `payroll_items` (fase 3) | `planilla_id` → `payroll_id`, `trabajador_id` → `worker_id`, `tipo` → `type`, `monto_centimos` → `amount_cents`, `nota` → `note`, `registrado_por` → `recorded_by` |
| `pagos` → `payments` (fase 3) | `planilla_id` → `payroll_id`, `trabajador_id` → `worker_id`, `fecha` → `date`, `monto_centimos` → `amount_cents`, `medio` → `method`, `metodo_detalle` → `method_detail`, `evidencia_ruta` → `evidence_path`, `nota` → `note`, `registrado_por` → `recorded_by` |

### Valores enum

| Enum (tipo en la base) | Valores (español → inglés) |
|---|---|
| rol (`user_role`) | `admin`, `gerencia` → `management`, `contabilidad` → `accounting`, `coordinador` → `coordinator` |
| modalidad (`employment_type`) | `temporal` → `temporary`, `contrato` → `contract` |
| estado del trabajador (`worker_status`) | `activo` → `active`, `cesado` → `terminated` |
| tipo de pago del cargo (`pay_type`) | `por_hora` → `hourly`, `mensual` → `monthly` |
| tipo de método de pago (`payment_method_type`) | `yape`, `plin`, `cuenta_bancaria` → `bank_account` |
| acción de auditoría (`audit_action`) | `crear` → `create`, `editar` → `update`, `eliminar` → `delete` |
| tipo de planilla (`payroll_type`, fase 2) | `semanal` → `weekly`, `mensual` → `monthly` |
| estado de planilla (`payroll_status`, fase 2) | `abierta` → `open`, `cerrada` → `closed` |
| tipo de asistencia (`attendance_type`, fase 2) | `trabajado` → `worked`, `falta` → `absence`, `permiso` → `leave`, `descanso_medico` → `medical_leave` |
| tipo de concepto (`payroll_item_type`, fase 3) | `sueldo` → `salary`, `bono` → `bonus`, `destajo` → `piecework`, `descuento` → `deduction` |
| medio de pago (`payment_medium`, fase 3) | `yape`, `plin`, `transferencia` → `transfer`, `efectivo` → `cash` |

El valor `entity` de la auditoría es el nombre de la tabla en inglés (`workers`, `users`, `worker_payment_methods`).

### API

| Español | Inglés |
|---|---|
| `/salud` | `/health` |
| `/v1/me` | `/v1/me` |
| `/v1/usuarios` | `/v1/users` |
| `/v1/areas` | `/v1/areas` |
| `/v1/turnos` | `/v1/shifts` |
| `/v1/campanas` | `/v1/campaigns` |
| `/v1/cargos` | `/v1/positions` |
| `/v1/grupos`, `/v1/grupos/:id/miembros/:trabajadorId` | `/v1/groups`, `/v1/groups/:id/members/:workerId` |
| `/v1/trabajadores`, `/v1/trabajadores/:id/metodos-pago/:metodoId` | `/v1/workers`, `/v1/workers/:id/payment-methods/:methodId` |
| `/v1/auditoria` | `/v1/audit-log` |
| `/v1/asistencias`, `POST /marcar`, `POST /bloque` (fase 2) | `/v1/attendance`, `POST /clock`, `POST /bulk` |
| `/v1/planillas`, `/v1/planillas/:id/trabajadores/:tid` (fase 2) | `/v1/payrolls`, `/v1/payrolls/:id/workers/:workerId` |
| `/v1/conceptos` (fase 3) | `/v1/payroll-items` |
| `/v1/pagos` (fase 3) | `/v1/payments` |
| `/v1/evidencias` (fase 3) | `/v1/evidence` |
| `/v1/reportes/costos` (fase 4) | `/v1/reports/costs` |

- Listas paginadas: reciben `page` y `pageSize` (máximo 100) y devuelven `{ items, total, page, pageSize }`. Las listas sin paginar devuelven `{ items }`.
- Filtros de trabajadores: `search`, `areaId`, `employmentType`, `status`. Filtro de auditoría: `entity`.
- Error: `{ "error": { "code", "message", "field?" } }`. `message` va en español.

| Código de error (español → inglés) | Cuándo |
|---|---|
| `no_autenticado` → `unauthenticated` | Falta el token o no es válido (401) |
| `sin_acceso` → `access_denied` | El usuario no existe en el panel o está desactivado (403) |
| `sin_permiso` → `forbidden` | El rol no permite la acción (403) |
| `no_encontrado` → `not_found` | El registro o la ruta no existe (404) |
| `validacion` → `validation` | Un dato de entrada no es válido (400) |
| `solicitud_invalida` → `invalid_request` | El cuerpo no es JSON válido (400) |
| `referencia_invalida` → `invalid_reference` | Un id enviado no existe (400) |
| `duplicado` → `duplicate` | Ya existe un registro con ese valor (409) |
| `usuario_auth` → `auth_provider_error` | Supabase Auth no pudo crear la cuenta (502) |
| `interno` → `internal` | Error inesperado (500) |

### Direcciones del panel

| Español | Inglés |
|---|---|
| `/login` | `/login` |
| `/recuperar` | `/forgot-password` |
| `/restablecer` | `/reset-password` |
| `/perfil` | `/profile` |
| `/trabajadores`, `/trabajadores/nuevo`, `/trabajadores/[id]` | `/workers`, `/workers/new`, `/workers/[id]` |
| `/configuracion` | `/settings` |
| `/configuracion/cargos`, `/grupos`, `/areas`, `/turnos`, `/campanas`, `/usuarios`, `/auditoria` | `/settings/positions`, `/groups`, `/areas`, `/shifts`, `/campaigns`, `/users`, `/audit-log` |
| Asistencia, Planillas, Reportes (fases 2 a 4) | `/attendance`, `/payrolls`, `/reports` |

### Variables de entorno y scripts

| Español | Inglés |
|---|---|
| `ORIGEN_PANEL` | `PANEL_ORIGIN` |
| `PUERTO` | `PORT` |
| `npm run db:generar` | `npm run db:generate` |
| `npm run db:migrar` | `npm run db:migrate` |
| `npm run crear-admin` | `npm run create-admin` |
