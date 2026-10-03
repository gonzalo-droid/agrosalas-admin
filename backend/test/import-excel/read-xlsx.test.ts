import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { readXlsx } from '../../scripts/import-excel/read-xlsx'

const WORKBOOK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Resumen" sheetId="1" r:id="rId1"/><sheet name="Datos &amp; más" sheetId="2" r:id="rId2"/></sheets>
</workbook>`

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`

const SHARED_STRINGS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="2" uniqueCount="2">
<si><t>RAMOS VARGAS,ELENA</t></si>
<si><r><t xml:space="preserve">Hola </t></r><r><rPr><b/></rPr><t>mundo</t></r></si>
</sst>`

const SHEET1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row r="1">
<c r="A1" t="s"><v>0</v></c>
<c r="B1"><v>0.3125</v></c>
<c r="C1" t="str"><f>A1&amp;"x"</f><v>texto calculado</v></c>
<c r="D1" t="e"><v>#VALUE!</v></c>
<c r="E1" s="3"/>
<c r="F1" t="s"><v>1</v></c>
<c r="G1" t="inlineStr"><is><t>en línea</t></is></c>
<c r="H1" t="str"><v>Tom &amp; Jerry &lt;3 &#65;&#x42;</v></c>
</row>
</sheetData></worksheet>`

const SHEET2 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row r="24"><c r="B24"><v>12.5</v></c></row>
</sheetData></worksheet>`

function buildXlsx(): Uint8Array {
  return zipSync({
    'xl/workbook.xml': strToU8(WORKBOOK),
    'xl/_rels/workbook.xml.rels': strToU8(RELS),
    'xl/sharedStrings.xml': strToU8(SHARED_STRINGS),
    'xl/worksheets/sheet1.xml': strToU8(SHEET1),
    'xl/worksheets/sheet2.xml': strToU8(SHEET2),
  })
}

describe('readXlsx', () => {
  it('lists the sheets by name, decoding entities in the names', () => {
    const workbook = readXlsx(buildXlsx())
    expect([...workbook.keys()]).toEqual(['Resumen', 'Datos & más'])
  })

  it('reads shared strings, numbers and formula strings', () => {
    const sheet = readXlsx(buildXlsx()).get('Resumen')!
    expect(sheet.get('A1')).toBe('RAMOS VARGAS,ELENA')
    expect(sheet.get('B1')).toBe(0.3125)
    expect(sheet.get('C1')).toBe('texto calculado')
    expect(sheet.get('G1')).toBe('en línea')
  })

  it('joins the runs of a rich-text shared string', () => {
    const sheet = readXlsx(buildXlsx()).get('Resumen')!
    expect(sheet.get('F1')).toBe('Hola mundo')
  })

  it('skips error cells and cells without a value', () => {
    const sheet = readXlsx(buildXlsx()).get('Resumen')!
    expect(sheet.has('D1')).toBe(false)
    expect(sheet.has('E1')).toBe(false)
  })

  it('decodes named and numeric entities', () => {
    const sheet = readXlsx(buildXlsx()).get('Resumen')!
    expect(sheet.get('H1')).toBe('Tom & Jerry <3 AB')
  })

  it('reads every sheet through the workbook relationships', () => {
    const sheet = readXlsx(buildXlsx()).get('Datos & más')!
    expect(sheet.get('B24')).toBe(12.5)
    expect(sheet.size).toBe(1)
  })

  it('works without a sharedStrings part', () => {
    const bytes = zipSync({
      'xl/workbook.xml': strToU8(WORKBOOK),
      'xl/_rels/workbook.xml.rels': strToU8(RELS),
      'xl/worksheets/sheet1.xml': strToU8(SHEET2),
      'xl/worksheets/sheet2.xml': strToU8(SHEET2),
    })
    expect(readXlsx(bytes).get('Resumen')!.get('B24')).toBe(12.5)
  })
})
