import { sql } from 'drizzle-orm'
import {
  boolean, date, index, jsonb, numeric, pgEnum, pgTable, primaryKey, text, time, timestamp, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core'

const marcas = {
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}

export const rolEnum = pgEnum('rol', ['admin', 'gerencia', 'contabilidad', 'coordinador'])
export const modalidadEnum = pgEnum('modalidad', ['temporal', 'contrato'])
export const estadoTrabajadorEnum = pgEnum('estado_trabajador', ['activo', 'cesado'])
export const tipoPagoEnum = pgEnum('tipo_pago', ['por_hora', 'mensual'])
export const tipoMetodoPagoEnum = pgEnum('tipo_metodo_pago', ['yape', 'plin', 'cuenta_bancaria'])
export const accionAuditoriaEnum = pgEnum('accion_auditoria', ['crear', 'editar', 'eliminar'])

// id = id del usuario en Supabase Auth
export const usuarios = pgTable('usuarios', {
  id: uuid('id').primaryKey(),
  correo: text('correo').notNull().unique(),
  nombre: text('nombre').notNull(),
  rol: rolEnum('rol').notNull(),
  activo: boolean('activo').notNull().default(true),
  ...marcas,
}).enableRLS()

export const areas = pgTable('areas', {
  id: uuid('id').primaryKey().defaultRandom(),
  nombre: text('nombre').notNull().unique(),
  activo: boolean('activo').notNull().default(true),
  ...marcas,
}).enableRLS()

export const usuarioAreas = pgTable(
  'usuario_areas',
  {
    usuarioId: uuid('usuario_id').notNull().references(() => usuarios.id, { onDelete: 'cascade' }),
    areaId: uuid('area_id').notNull().references(() => areas.id),
  },
  (t) => [primaryKey({ columns: [t.usuarioId, t.areaId] })],
).enableRLS()

export const turnos = pgTable('turnos', {
  id: uuid('id').primaryKey().defaultRandom(),
  nombre: text('nombre').notNull().unique(),
  horaInicio: time('hora_inicio').notNull(),
  horaFin: time('hora_fin').notNull(),
  activo: boolean('activo').notNull().default(true),
  ...marcas,
}).enableRLS()

export const campanas = pgTable('campanas', {
  id: uuid('id').primaryKey().defaultRandom(),
  nombre: text('nombre').notNull().unique(),
  fechaInicio: date('fecha_inicio'),
  fechaFin: date('fecha_fin'),
  activo: boolean('activo').notNull().default(true),
  ...marcas,
}).enableRLS()

export const cargos = pgTable('cargos', {
  id: uuid('id').primaryKey().defaultRandom(),
  nombre: text('nombre').notNull().unique(),
  tipoPago: tipoPagoEnum('tipo_pago').notNull(),
  tarifaHora: numeric('tarifa_hora', { precision: 10, scale: 4, mode: 'number' }),
  tarifaHoraExtra: numeric('tarifa_hora_extra', { precision: 10, scale: 4, mode: 'number' }),
  sueldoMensual: numeric('sueldo_mensual', { precision: 10, scale: 2, mode: 'number' }),
  activo: boolean('activo').notNull().default(true),
  ...marcas,
}).enableRLS()

export const grupos = pgTable('grupos', {
  id: uuid('id').primaryKey().defaultRandom(),
  nombre: text('nombre').notNull().unique(),
  temporal: boolean('temporal').notNull().default(false),
  fechaInicio: date('fecha_inicio'),
  fechaFin: date('fecha_fin'),
  activo: boolean('activo').notNull().default(true),
  ...marcas,
}).enableRLS()

export const trabajadores = pgTable(
  'trabajadores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dni: text('dni'),
    nombres: text('nombres').notNull(),
    apellidos: text('apellidos').notNull(),
    telefono: text('telefono'),
    correo: text('correo'),
    direccion: text('direccion'),
    emergenciaNombre: text('emergencia_nombre'),
    emergenciaTelefono: text('emergencia_telefono'),
    areaId: uuid('area_id').references(() => areas.id),
    cargoId: uuid('cargo_id').references(() => cargos.id),
    turnoId: uuid('turno_id').references(() => turnos.id),
    modalidad: modalidadEnum('modalidad').notNull(),
    fechaIngreso: date('fecha_ingreso'),
    estado: estadoTrabajadorEnum('estado').notNull().default('activo'),
    notas: text('notas'),
    ...marcas,
  },
  (t) => [uniqueIndex('trabajadores_dni_unico').on(t.dni), index('trabajadores_area_idx').on(t.areaId)],
).enableRLS()

export const grupoTrabajadores = pgTable(
  'grupo_trabajadores',
  {
    grupoId: uuid('grupo_id').notNull().references(() => grupos.id, { onDelete: 'cascade' }),
    trabajadorId: uuid('trabajador_id').notNull().references(() => trabajadores.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.grupoId, t.trabajadorId] })],
).enableRLS()

export const trabajadorMetodosPago = pgTable(
  'trabajador_metodos_pago',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    trabajadorId: uuid('trabajador_id').notNull().references(() => trabajadores.id, { onDelete: 'cascade' }),
    tipo: tipoMetodoPagoEnum('tipo').notNull(),
    numero: text('numero').notNull(),
    banco: text('banco'),
    cci: text('cci'),
    titular: text('titular').notNull(),
    principal: boolean('principal').notNull().default(false),
    ...marcas,
  },
  (t) => [uniqueIndex('metodo_principal_unico').on(t.trabajadorId).where(sql`principal`)],
).enableRLS()

export const auditoria = pgTable(
  'auditoria',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    usuarioId: uuid('usuario_id').notNull().references(() => usuarios.id),
    accion: accionAuditoriaEnum('accion').notNull(),
    entidad: text('entidad').notNull(),
    entidadId: uuid('entidad_id').notNull(),
    antes: jsonb('antes'),
    despues: jsonb('despues'),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('auditoria_entidad_idx').on(t.entidad, t.entidadId)],
).enableRLS()
