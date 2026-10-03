import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// The API is deployed as plain ESM ("type": "module"): Node does not add extensions, so every relative
// import must be written with its final extension (./env.js, ./routes/index.js). Vercel keeps the
// specifiers as written; tsx, vitest and TypeScript (moduleResolution: Bundler) resolve .js to .ts.
const root = join(import.meta.dirname, '..')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return path.endsWith('.ts') ? [path] : []
  })
}

function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

// Static forms (from '…', import '…', export * from '…') and dynamic import('…').
const specifierPattern = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"](\.{1,2}(?:\/[^'"]*)?)['"]/g

function offenders(file: string): string[] {
  const text = withoutComments(readFileSync(file, 'utf8'))
  return [...text.matchAll(specifierPattern)]
    .map((match) => match[1]!)
    .filter((specifier) => !specifier.endsWith('.js'))
    .map((specifier) => `${relative(root, file)}: '${specifier}'`)
}

describe('ESM imports', () => {
  it('end every relative specifier of the deployed code in .js', () => {
    const files = [join(root, 'index.ts'), ...sourceFiles(join(root, 'src'))]
    const bad = files.flatMap(offenders)
    expect(bad, `Relative imports without .js:\n${bad.join('\n')}`).toEqual([])
  })
})
