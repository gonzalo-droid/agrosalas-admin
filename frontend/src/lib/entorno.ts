// Error de una instalación incompleta (falta una variable NEXT_PUBLIC_*): no es un fallo de red ni de la API.
export class ErrorDeConfiguracion extends Error {
  name = 'ErrorDeConfiguracion'
}

// Comprueba las variables al usarlas (no al importar el módulo), para que el build y las pruebas
// funcionen sin ellas. Next solo incrusta las NEXT_PUBLIC_* escritas literalmente como
// process.env.NOMBRE, así que quien llama pasa los valores ya leídos.
export function variablesRequeridas<T extends Record<string, string | undefined>>(variables: T): { [K in keyof T]: string } {
  const faltan = Object.entries(variables)
    .filter(([, valor]) => !valor)
    .map(([nombre]) => nombre)
  if (faltan.length > 0) {
    throw new ErrorDeConfiguracion(
      `Falta configurar ${faltan.join(', ')}. Cópialas de frontend/.env.example a frontend/.env.local y reinicia el panel.`,
    )
  }
  return variables as { [K in keyof T]: string }
}
