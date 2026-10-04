// Imports the payroll history from the Excel workbook; a dry run unless --commit is given:
// npm run import-excel -w @agrosalas/backend -- <file.xlsx> [--aliases alias.json] [--out summary.md] [--commit --user email]
import { readFileSync, writeFileSync } from 'node:fs'
import { eq } from 'drizzle-orm'
import { users } from '../../src/db/schema.js'
import type { Db } from '../../src/types.js'
import { describeDatabase } from './database.js'
import { loadSheets, type LoadResult } from './load.js'
import { applyAlias, DEFAULT_ALIASES, normalizeName, parseAliases, similarNames, unusedAliases } from './names.js'
import { parseSheet, type ParsedSheet } from './parse-sheet.js'
import { readXlsx } from './read-xlsx.js'
import { SHEETS } from './sheets.js'
import { buildSummary, findNegatives } from './summary.js'

const USAGE =
  'Uso: npm run import-excel -w @agrosalas/backend -- <ruta.xlsx> [--aliases alias.json] [--out resumen.md] [--commit --user correo]'

type Args = { file: string; aliasesFile?: string; out?: string; commit: boolean; user?: string }

class UsageError extends Error {}

function parseArgs(argv: string[]): Args {
  const args: Args = { file: '', commit: false }
  const valueOf = (index: number, flag: string): string => {
    const value = argv[index]
    if (value === undefined || value.startsWith('--')) throw new UsageError(`Falta el valor de ${flag}.`)
    return value
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg === '--commit') args.commit = true
    else if (arg === '--aliases') args.aliasesFile = valueOf(++i, arg)
    else if (arg === '--out') args.out = valueOf(++i, arg)
    else if (arg === '--user') args.user = valueOf(++i, arg)
    else if (arg.startsWith('--')) throw new UsageError(`Opción desconocida: ${arg}`)
    else if (args.file === '') args.file = arg
    else throw new UsageError(`Sobra el argumento: ${arg}`)
  }
  if (args.file === '') throw new UsageError('Falta la ruta del archivo .xlsx.')
  if (args.commit && !args.user) throw new UsageError('--commit necesita --user con el correo de un administrador.')
  return args
}

/** The file maps a name as written to the unified one or to `dni:<8 digits>`; it lives outside the repository. */
function readAliases(path: string | undefined): Record<string, string> {
  if (!path) return { ...DEFAULT_ALIASES }
  return { ...DEFAULT_ALIASES, ...parseAliases(JSON.parse(readFileSync(path, 'utf8'))) }
}

/** What the load did, with the reused workers (and which existing one) and the created ones. */
function loadDetail(result: LoadResult): string {
  return [
    `Carga terminada: ${result.workers} trabajador(es) nuevo(s), ${result.payrolls} planilla(s), ${result.records} registro(s) de asistencia, ${result.items} concepto(s), ${result.payments} pago(s).`,
    '',
    `## Trabajadores reutilizados (${result.reused.length})`,
    '',
    ...(result.reused.length > 0 ? result.reused.map(({ name, worker }) => `- ${name} → ${worker}`) : ['Ninguno.']),
    '',
    `## Trabajadores creados (${result.created.length})`,
    '',
    ...(result.created.length > 0 ? result.created.map((name) => `- ${name}`) : ['Ninguno.']),
  ].join('\n')
}

/** The user who imports: must exist, be active and be an administrator. */
async function findImporter(db: Db, email: string): Promise<{ id: string; email: string }> {
  const [user] = await db.select().from(users).where(eq(users.email, email))
  if (!user) throw new Error(`No existe un usuario con el correo ${email}.`)
  if (!user.active) throw new Error(`El usuario ${email} está inactivo.`)
  if (user.role !== 'admin') throw new Error(`El usuario ${email} no es administrador.`)
  return user
}

async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv)
  const aliases = readAliases(args.aliasesFile)
  const workbook = readXlsx(readFileSync(args.file))

  const sheets: ParsedSheet[] = SHEETS.map((config) => {
    const grid = workbook.get(config.sheet)
    if (!grid) throw new Error(`Falta la hoja "${config.sheet}" en el archivo.`)
    return parseSheet(config, grid, aliases)
  })

  const workers = sheets.flatMap((sheet) => sheet.workers)
  const aliasesUsed = new Map<string, [string, string]>()
  for (const worker of workers) {
    const raw = normalizeName(worker.rawName)
    if (applyAlias(raw, aliases) !== raw) aliasesUsed.set(raw, [raw, worker.name])
  }
  const summary = buildSummary(sheets, {
    similar: similarNames(workers.map((worker) => worker.name)),
    aliasesUsed: [...aliasesUsed.values()],
    unusedAliases: unusedAliases(aliases, workers.map((worker) => worker.rawName)),
    mode: args.commit ? 'commit' : 'dry-run',
  })

  const save = (text: string) => {
    if (!args.out) return
    writeFileSync(args.out, text)
    console.log(`Resumen guardado en ${args.out}`)
  }

  if (!args.commit) {
    console.log(summary)
    save(summary)
    const negatives = findNegatives(sheets)
    if (negatives.length > 0) {
      console.error(`⚠ Hay ${negatives.length} monto(s) o minutos negativo(s): la carga se rechazaría mientras existan.`)
    }
    return 0
  }

  // Imported here, lazily, so a dry run never reads DATABASE_URL nor opens a connection.
  const [{ createDb }, { readEnv }] = await Promise.all([import('../../src/db/client.js'), import('../../src/env.js')])
  const databaseUrl = readEnv().DATABASE_URL
  // Says where it is about to write before anything else touches that database.
  console.log(describeDatabase(databaseUrl))
  const { db, close } = createDb(databaseUrl)
  try {
    const importer = await findImporter(db, args.user!)
    console.log(summary)
    const result = await loadSheets(db, importer.id, sheets)
    const detail = loadDetail(result)
    console.log(detail)
    // Only a load that went through leaves a summary file behind.
    save(`${summary}\n${detail}\n`)
    return 0
  } finally {
    await close()
  }
}

try {
  process.exitCode = await main(process.argv.slice(2))
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  if (error instanceof UsageError) console.error(USAGE)
  process.exitCode = 1
}
