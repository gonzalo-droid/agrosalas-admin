// Qué ve y qué puede tocar cada rol en la ficha de un trabajador. La API es la que aplica los permisos;
// esto solo evita mostrar botones que fallarían o secciones vacías.
export type Rol = 'admin' | 'gerencia' | 'contabilidad' | 'coordinador'
export type Acceso = 'editar' | 'ver' | 'ocultar'

const EDITAN = ['admin', 'contabilidad']

export const puedeCrearTrabajador = (rol: Rol) => EDITAN.includes(rol)

export function vistaTrabajador(rol: Rol): { editarFicha: boolean; metodosPago: Acceso; grupos: Exclude<Acceso, 'ocultar'> } {
  if (EDITAN.includes(rol)) return { editarFicha: true, metodosPago: 'editar', grupos: 'editar' }
  // La API no manda los métodos de pago (datos bancarios) al coordinador.
  return { editarFicha: false, metodosPago: rol === 'gerencia' ? 'ver' : 'ocultar', grupos: 'ver' }
}

// Texto de un selector en modo lectura: el nombre de la opción elegida.
export function nombreOpcion(lista: { id: string; nombre: string }[] | undefined, id: string) {
  if (!id) return 'Sin asignar'
  return lista?.find((x) => x.id === id)?.nombre ?? '…'
}

export const TIPO_METODO = { yape: 'Yape', plin: 'Plin', cuenta_bancaria: 'Cuenta bancaria' } as const
export type TipoMetodo = keyof typeof TIPO_METODO

// "Cuenta bancaria BCP 191-1234": para confirmar antes de quitarlo y para nombrar los botones de cada fila.
export const descripcionMetodo = (m: { tipo: TipoMetodo; banco: string | null; numero: string }) =>
  [TIPO_METODO[m.tipo], m.banco, m.numero].filter(Boolean).join(' ')
