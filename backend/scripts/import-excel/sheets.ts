export type PaymentRule =
  | { kind: 'columns'; columns: string[] } // paid = sum of the numbers in these columns
  | { kind: 'stamp'; columns: string[]; text: string } // paid = the row total when any of these cells contains the text (case-insensitive)

export type SheetConfig = {
  sheet: string
  campaign: string
  rateCells: { hourly: string; overtime: string }
  dayHeaderRow: number
  firstWorkerRow: number
  /** First column of each day block; a day spans 8 columns from there. */
  blocks: string[]
  totalColumn: string
  payment: PaymentRule
}

const common = {
  rateCells: { hourly: 'F19', overtime: 'F20' },
  dayHeaderRow: 22,
  firstWorkerRow: 24,
}

// What each sheet's payment columns mean is a guess that the dry run shows (plan decision 8).
export const SHEETS: SheetConfig[] = [
  {
    ...common,
    sheet: '13 al 19 1era sem',
    campaign: 'Contenedor Chile',
    blocks: ['B', 'J', 'R', 'Z', 'AH', 'AP', 'AX'],
    totalColumn: 'BG',
    payment: { kind: 'columns', columns: ['BH', 'BJ'] },
  },
  {
    ...common,
    sheet: 'SEM 17 20 AL 25',
    campaign: 'Contenedor Chile',
    blocks: ['B', 'J', 'R', 'Z', 'AH', 'AP'],
    totalColumn: 'BG',
    payment: { kind: 'stamp', columns: ['BH', 'BJ'], text: 'CANCELADO' },
  },
  {
    ...common,
    sheet: '9 MAYO',
    campaign: 'Contenedor Chile',
    blocks: ['B'],
    totalColumn: 'I',
    payment: { kind: 'columns', columns: ['M'] },
  },
  {
    ...common,
    sheet: 'ETI 5 AL 10 Junio',
    campaign: 'Etiquetado junio',
    blocks: ['B', 'J', 'R', 'Z', 'AH', 'AP'],
    totalColumn: 'AY',
    payment: { kind: 'columns', columns: ['AZ'] },
  },
]
