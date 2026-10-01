export const ETIQUETA_ENTIDAD: Record<string, string> = {
  trabajadores: 'Trabajadores',
  trabajador_metodos_pago: 'Métodos de pago',
  usuarios: 'Usuarios',
  cargos: 'Cargos',
  grupos: 'Grupos',
  areas: 'Áreas',
  turnos: 'Turnos',
  campanas: 'Campañas',
}

const IGNORADAS = new Set(['id', 'creadoEn', 'actualizadoEn'])
// Datos personales y bancarios: la auditoría solo deja ver el final.
const SENSIBLES = new Set(['dni', 'telefono', 'direccion', 'emergenciaTelefono', 'numero', 'cci'])

const esObjeto = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor)

function mostrar(clave: string, valor: unknown): string {
  if (valor === null || valor === undefined) return '—'
  const texto = typeof valor === 'string' ? valor : JSON.stringify(valor)
  if (!SENSIBLES.has(clave)) return texto
  return texto.length <= 4 ? '••••' : `••••${texto.slice(-4)}`
}

// Resumen legible de una fila de auditoría. Nunca devuelve el JSON completo ni datos personales completos.
export function resumenCambio(accion: 'crear' | 'editar' | 'eliminar', antes: unknown, despues: unknown): string {
  if (accion === 'editar' && esObjeto(antes) && esObjeto(despues)) {
    const claves = [...new Set([...Object.keys(antes), ...Object.keys(despues)])].filter((k) => !IGNORADAS.has(k))
    const cambios = claves
      .filter((k) => JSON.stringify(antes[k] ?? null) !== JSON.stringify(despues[k] ?? null))
      .map((k) => `${k}: ${mostrar(k, antes[k])} → ${mostrar(k, despues[k])}`)
    return cambios.length > 0 ? cambios.join('; ') : 'Sin cambios'
  }

  const fila = accion === 'eliminar' ? antes : accion === 'crear' ? despues : (despues ?? antes)
  if (!esObjeto(fila)) return '—'
  const campos = Object.entries(fila)
    .filter(([k, v]) => !IGNORADAS.has(k) && v !== null && v !== undefined)
    .map(([k, v]) => `${k}: ${mostrar(k, v)}`)
  return campos.length > 0 ? campos.join('; ') : '—'
}
