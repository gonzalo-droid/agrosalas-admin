export type Valor = string | boolean | string[]
export type Valores = Record<string, Valor>
export type FilaCatalogo = { id: string } & Record<string, unknown>

export type CampoCatalogo = {
  nombre: string
  etiqueta: string
  tipo: 'texto' | 'correo' | 'clave' | 'hora' | 'fecha' | 'numero' | 'casilla' | 'opcion' | 'opciones'
  // Una opción inactiva solo se ofrece al editar una fila que ya la tiene (para poder verla y quitarla).
  opciones?: { valor: string; etiqueta: string; inactiva?: boolean }[]
  obligatorio?: boolean
  soloAlCrear?: boolean
  ayuda?: string
  // Si devuelve false el campo no se muestra, no se exige y se manda como null.
  visibleSi?: (valores: Valores) => boolean
}

export function valorInicial(campo: CampoCatalogo, fila: FilaCatalogo | null): Valor {
  const crudo = fila?.[campo.nombre]
  if (campo.tipo === 'casilla') return Boolean(crudo)
  if (campo.tipo === 'opciones') return Array.isArray(crudo) ? (crudo as string[]) : []
  if (crudo == null) return campo.tipo === 'opcion' ? (campo.opciones?.[0]?.valor ?? '') : ''
  return campo.tipo === 'hora' ? String(crudo).slice(0, 5) : String(crudo)
}

// Los campos que se dibujan en el formulario.
export function camposVisibles(campos: CampoCatalogo[], valores: Valores, esEdicion: boolean): CampoCatalogo[] {
  return campos.filter((c) => !(esEdicion && c.soloAlCrear) && (c.visibleSi?.(valores) ?? true))
}

function paraEnviar(campo: CampoCatalogo, valor: Valor | undefined): unknown {
  if (typeof valor !== 'string') return valor
  // La contraseña se manda tal cual: recortarla cambiaría lo que la persona escribió.
  if (campo.tipo === 'clave') return valor === '' ? null : valor
  const texto = valor.trim()
  if (texto === '') return null
  return campo.tipo === 'numero' ? Number(texto) : texto
}

// Lo que se manda a la API: números como número y vacíos u ocultos como null.
export function cuerpoParaEnviar(campos: CampoCatalogo[], valores: Valores, esEdicion: boolean): Record<string, unknown> {
  const cuerpo: Record<string, unknown> = {}
  for (const c of campos) {
    if (esEdicion && c.soloAlCrear) continue
    const oculto = c.visibleSi ? !c.visibleSi(valores) : false
    cuerpo[c.nombre] = oculto ? null : paraEnviar(c, valores[c.nombre])
  }
  return cuerpo
}

// Aplica un cambio del formulario. `derivar` propone otros campos (p. ej. la hora extra desde la normal)
// solo al crear: al editar pisaría un valor elegido a propósito.
export function aplicarCambio(
  valores: Valores,
  campo: string,
  valor: Valor,
  derivar: ((campo: string, valores: Valores) => Partial<Valores>) | undefined,
  esEdicion: boolean,
): Valores {
  const siguiente = { ...valores, [campo]: valor }
  return esEdicion || !derivar ? siguiente : ({ ...siguiente, ...derivar(campo, siguiente) } as Valores)
}

// Las opciones que se ofrecen: las activas y, al editar, las inactivas que la fila ya tiene (marcadas).
export function opcionesVisibles(campo: CampoCatalogo, fila: FilaCatalogo | null): { valor: string; etiqueta: string }[] {
  const actual = fila?.[campo.nombre]
  const tiene = (valor: string) => (Array.isArray(actual) ? actual.includes(valor) : actual === valor)
  return (campo.opciones ?? [])
    .filter((o) => !o.inactiva || tiene(o.valor))
    .map((o) => ({ valor: o.valor, etiqueta: o.inactiva ? `${o.etiqueta} (inactiva)` : o.etiqueta }))
}
