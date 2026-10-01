export type Valor = string | boolean | string[]
export type Valores = Record<string, Valor>
export type FilaCatalogo = { id: string } & Record<string, unknown>

export type CampoCatalogo = {
  nombre: string
  etiqueta: string
  tipo: 'texto' | 'correo' | 'clave' | 'hora' | 'fecha' | 'numero' | 'casilla' | 'opcion' | 'opciones'
  opciones?: { valor: string; etiqueta: string }[]
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
