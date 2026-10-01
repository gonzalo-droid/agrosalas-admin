CREATE TYPE "public"."accion_auditoria" AS ENUM('crear', 'editar', 'eliminar');--> statement-breakpoint
CREATE TYPE "public"."estado_trabajador" AS ENUM('activo', 'cesado');--> statement-breakpoint
CREATE TYPE "public"."modalidad" AS ENUM('temporal', 'contrato');--> statement-breakpoint
CREATE TYPE "public"."rol" AS ENUM('admin', 'gerencia', 'contabilidad', 'coordinador');--> statement-breakpoint
CREATE TYPE "public"."tipo_metodo_pago" AS ENUM('yape', 'plin', 'cuenta_bancaria');--> statement-breakpoint
CREATE TYPE "public"."tipo_pago" AS ENUM('por_hora', 'mensual');--> statement-breakpoint
CREATE TABLE "areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "areas_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
ALTER TABLE "areas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "auditoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"accion" "accion_auditoria" NOT NULL,
	"entidad" text NOT NULL,
	"entidad_id" uuid NOT NULL,
	"antes" jsonb,
	"despues" jsonb,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auditoria" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "campanas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"fecha_inicio" date,
	"fecha_fin" date,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campanas_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
ALTER TABLE "campanas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cargos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"tipo_pago" "tipo_pago" NOT NULL,
	"tarifa_hora" numeric(10, 4),
	"tarifa_hora_extra" numeric(10, 4),
	"sueldo_mensual" numeric(10, 2),
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cargos_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
ALTER TABLE "cargos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "grupo_trabajadores" (
	"grupo_id" uuid NOT NULL,
	"trabajador_id" uuid NOT NULL,
	CONSTRAINT "grupo_trabajadores_grupo_id_trabajador_id_pk" PRIMARY KEY("grupo_id","trabajador_id")
);
--> statement-breakpoint
ALTER TABLE "grupo_trabajadores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "grupos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"temporal" boolean DEFAULT false NOT NULL,
	"fecha_inicio" date,
	"fecha_fin" date,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grupos_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
ALTER TABLE "grupos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trabajador_metodos_pago" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trabajador_id" uuid NOT NULL,
	"tipo" "tipo_metodo_pago" NOT NULL,
	"numero" text NOT NULL,
	"banco" text,
	"cci" text,
	"titular" text NOT NULL,
	"principal" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trabajador_metodos_pago" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trabajadores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dni" text,
	"nombres" text NOT NULL,
	"apellidos" text NOT NULL,
	"telefono" text,
	"correo" text,
	"direccion" text,
	"emergencia_nombre" text,
	"emergencia_telefono" text,
	"area_id" uuid,
	"cargo_id" uuid,
	"turno_id" uuid,
	"modalidad" "modalidad" NOT NULL,
	"fecha_ingreso" date,
	"estado" "estado_trabajador" DEFAULT 'activo' NOT NULL,
	"notas" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trabajadores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "turnos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"hora_inicio" time NOT NULL,
	"hora_fin" time NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "turnos_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
ALTER TABLE "turnos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "usuario_areas" (
	"usuario_id" uuid NOT NULL,
	"area_id" uuid NOT NULL,
	CONSTRAINT "usuario_areas_usuario_id_area_id_pk" PRIMARY KEY("usuario_id","area_id")
);
--> statement-breakpoint
ALTER TABLE "usuario_areas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY NOT NULL,
	"correo" text NOT NULL,
	"nombre" text NOT NULL,
	"rol" "rol" NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_correo_unique" UNIQUE("correo")
);
--> statement-breakpoint
ALTER TABLE "usuarios" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grupo_trabajadores" ADD CONSTRAINT "grupo_trabajadores_grupo_id_grupos_id_fk" FOREIGN KEY ("grupo_id") REFERENCES "public"."grupos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grupo_trabajadores" ADD CONSTRAINT "grupo_trabajadores_trabajador_id_trabajadores_id_fk" FOREIGN KEY ("trabajador_id") REFERENCES "public"."trabajadores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trabajador_metodos_pago" ADD CONSTRAINT "trabajador_metodos_pago_trabajador_id_trabajadores_id_fk" FOREIGN KEY ("trabajador_id") REFERENCES "public"."trabajadores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trabajadores" ADD CONSTRAINT "trabajadores_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trabajadores" ADD CONSTRAINT "trabajadores_cargo_id_cargos_id_fk" FOREIGN KEY ("cargo_id") REFERENCES "public"."cargos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trabajadores" ADD CONSTRAINT "trabajadores_turno_id_turnos_id_fk" FOREIGN KEY ("turno_id") REFERENCES "public"."turnos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_areas" ADD CONSTRAINT "usuario_areas_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_areas" ADD CONSTRAINT "usuario_areas_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auditoria_entidad_idx" ON "auditoria" USING btree ("entidad","entidad_id");--> statement-breakpoint
CREATE UNIQUE INDEX "metodo_principal_unico" ON "trabajador_metodos_pago" USING btree ("trabajador_id") WHERE principal;--> statement-breakpoint
CREATE UNIQUE INDEX "trabajadores_dni_unico" ON "trabajadores" USING btree ("dni");--> statement-breakpoint
CREATE INDEX "trabajadores_area_idx" ON "trabajadores" USING btree ("area_id");