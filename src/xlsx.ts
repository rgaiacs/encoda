/**
 * Compiler for Microsoft Excel.
 *
 * Also acts as base implementation for other spreadsheet-like formats
 * including `ods` and `csv`. Uses [`js-xlsx`]()`https://github.com/SheetJS/js-xlsx) to
 * parse and dump spreadsheets and transforms to/from the it's
 * (Common Spreadsheet Format)[https://github.com/SheetJS/js-xlsx#common-spreadsheet-format]
 * and Stencila schema instances.
 */

import stencila from '@stencila/schema'
import * as xlsx from 'xlsx'
import { load, VFile } from './vfile'

export const mediaTypes = [
  // spell-checker: disable
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  // spell-checker: enable
]

export async function parse(file: VFile): Promise<stencila.Node> {
  let workbook = xlsx.read(file.contents, {
    type: 'buffer'
  })
  return parseWorkbook(workbook)
}

export async function unparse(
  node: stencila.Node,
  filePath?: string,
  format: string = 'xlsx'
): Promise<VFile> {
  const workbook = unparseNode(node)
  const buffer = xlsx.write(workbook, {
    type: format === 'csv' ? 'string' : 'buffer',
    bookType: format as xlsx.BookType
  })
  return load(buffer)
}

// WorkBook <-> Node

function parseWorkbook(
  workbook: xlsx.WorkBook
): stencila.Table | stencila.Datatable | stencila.Collection {
  const parts: Array<stencila.Table | stencila.Datatable> = []
  for (let name of workbook.SheetNames) {
    let sheet = workbook.Sheets[name]

    // Parse all cells and if any have a formula, comments etc, then
    // treat this sheet as a Table
    let dataOnly = true
    let cells: any = {}
    for (let [key, cell] of Object.entries(sheet)) {
      if (key.startsWith('!')) continue
      if (cell.f) dataOnly = false
      cells[key] = cell
    }

    // Create a part for this sheet
    let part = (dataOnly ? parseDatatable : parseTable)(name, cells)

    // If this is the only sheet then simply return the
    // part, otherwise add it to the list of parts.
    if (workbook.SheetNames.length === 1) return part
    else parts.push(part)
  }

  const collection: stencila.Collection = {
    type: 'Collection',
    parts
  }
  return collection
}

function unparseNode(node: stencila.Node): xlsx.WorkBook {
  if (!node || typeof node !== 'object' || !node.hasOwnProperty('type')) {
    throw new Error('Unable to unparse node')
  }
  node = node as stencila.Thing

  let sheetNames: Array<string> = []
  let sheets: { [key: string]: xlsx.WorkSheet } = {}
  if (node.type === 'Collection') {
    const collection = node as stencila.Collection
    if (collection.parts && collection.parts.length > 0) {
      sheets = {}
      let index = 1
      for (let part of collection.parts) {
        let name = part.name || `Sheet${index}`
        sheetNames.push(name)
        sheets[name] = unparseTableOrDatatable(part)
        index += 1
      }
    } else {
      // xlsx.Workbooks must have at least one sheet
      let name = node.name || 'Empty'
      sheetNames.push(name)
      sheets[name] = {}
    }
  } else {
    let name = node.name || 'Sheet1'
    sheetNames.push(name)
    sheets[name] = unparseTableOrDatatable(node)
  }

  const workbook: xlsx.WorkBook = {
    SheetNames: sheetNames,
    Sheets: sheets
  }
  return workbook
}

function unparseTableOrDatatable(node: stencila.Table | stencila.Datatable) {
  if (node.type === 'Table') return unparseTable(node)
  else if (node.type === 'Datatable') return unparseDatatable(node)
  else throw new Error(`Unhandled node type "${node.type}"`)
}

// Worksheet <-> Table

function parseTable(
  name: string,
  cells: { [key: string]: xlsx.CellObject }
): stencila.Table {
  return {
    type: 'Table',
    name,
    cells: Object.entries(cells).map(function([key, cell]): stencila.TableCell {
      return {
        type: 'TableCell',
        name: key,
        position: cellNameToPosition(key),
        content: [parseCell(cell)]
      }
    })
  }
}

function unparseTable(table: stencila.Table) {
  const sheet: xlsx.WorkSheet = {}
  let cells = table.cells
  if (cells) {
    let maxCol = 0
    let maxRow = 0
    for (let cell of cells) {
      let [col, row] = cell.position
      if (col > maxCol) maxCol = col
      if (row > maxRow) maxRow = row
      let name = cellPositionToName(cell.position)
      let cellObject = unparseCell(cell.content[0] || null)
      sheet[name] = cellObject
    }
    sheet['!ref'] = `A1:${cellPositionToName([maxCol, maxRow])}`
  } else {
    throw new Error(`TODO: handle tables with rows instead of cells`)
  }
  return sheet
}

// Worksheet <-> Datatable

function parseDatatable(
  name: string,
  cells: { [key: string]: xlsx.CellObject }
): stencila.Datatable {
  // Convert the list of cells to a list of columns with values
  const columns: Array<any> = []
  for (let [key, cell] of Object.entries(cells)) {
    let [column, row] = cellNameToPosition(key)
    let values = columns[column]
    if (!values) {
      values = []
      columns[column] = values
    }
    values[row] = parseCell(cell)
  }
  // If the first value in each column is a string then
  // treat them as names (and thus remove them from) the
  // values. Otherwise, use automatic, alphabetic names.
  let names: Array<string | undefined> = []
  for (const column of columns) {
    if (typeof column[0] === 'string') {
      names.push(column[0])
    } else {
      break
    }
  }
  if (names.length === columns.length) {
    for (const column of columns) {
      column.shift()
    }
  } else {
    names = columns.map((column, index) => columnIndexToName(index))
  }

  const datatable: stencila.Datatable = {
    type: 'Datatable',
    name,
    columns: columns.map(function(column, index): stencila.DatatableColumn {
      return {
        type: 'DatatableColumn',
        name: names[index],
        values: column
      }
    })
  }
  return datatable
}

function unparseDatatable(datatable: stencila.Datatable) {
  const sheet: xlsx.WorkSheet = {}
  let columns = datatable.columns
  if (columns) {
    let columnIndex = 0
    let rowIndex = 0
    for (let column of columns) {
      let columnName = columnIndexToName(columnIndex)
      // Name cell
      sheet[`${columnName}1`] = { t: 's', v: column.name }
      // Value cells
      let values = column.values
      if (values) {
        rowIndex = 0
        for (let value of values) {
          const cellObject = unparseCell(value)
          if (cellObject) sheet[`${columnName}${rowIndex + 2}`] = cellObject
          rowIndex += 1
        }
      }
      columnIndex += 1
    }
    sheet['!ref'] = `A1:${columnIndexToName(columnIndex - 1)}${rowIndex + 1}`
  }
  return sheet
}

// CellObject <-> Node

function parseCell(cell: xlsx.CellObject): stencila.Node {
  let value = cell.v
  if (value) {
    if (value instanceof Date) {
      value = value.toISOString()
    }
  }

  if (cell.f) {
    const expression: stencila.Expression = {
      type: 'Expression',
      programmingLanguages: ['excel'],
      text: cell.f.trim()
    }
    if (value) expression.value = value
    return expression
  } else {
    return value || null
  }
}

function unparseCell(node: stencila.Node): xlsx.CellObject | null {
  if (node === null) return null
  if (typeof node === 'boolean') return { t: 'b', v: node }
  if (typeof node === 'number') return { t: 'n', v: node }
  if (typeof node === 'string') return { t: 's', v: node }

  if (!Array.isArray(node) && node.type) {
    switch (node.type) {
      case 'Expression': {
        const expr = node as stencila.Expression
        const cell: xlsx.CellObject = { t: 'b', f: expr.text }
        if (expr.value) {
          const value = unparseCell(expr.value)
          if (value) {
            cell.t = value.t
            cell.v = value.v
          }
        }
        return cell
      }
    }
  }
  throw new Error(`Unhandled node type`)
}

/**
 * Convert a column index (e.g. `27`) into a name (e.g. `AA`)
 *
 * Thanks to https://stackoverflow.com/a/182924.
 *
 * @param index The column index
 */
export function columnIndexToName(index: number) {
  let name = ''
  let dividend = index + 1
  while (dividend > 0) {
    let modulo = (dividend - 1) % 26
    name = String.fromCharCode(65 + modulo) + name
    dividend = Math.floor((dividend - modulo) / 26)
  }
  return name
}

/**
 * Convert a column name (e.g. `AA`) into an index (e.g. `27`)
 *
 * Thanks to https://stackoverflow.com/a/46173864.
 *
 * @param name The column name
 */
export function columnNameToIndex(name: string) {
  let index = 0
  for (let position = 0; position < name.length; position++) {
    index = name[position].charCodeAt(0) - 64 + index * 26
  }
  return index - 1
}

/**
 * Convert a cell name e.g. `A2` to a position e.g. `[0, 1]`
 *
 * @param name The name of the cell
 */
export function cellNameToPosition(name: string): [number, number] {
  const match = name.match(/^([A-Z]+)([1-9][0-9]*)$/)
  if (!match) throw new Error(`Unexpected cell name "${name}".`)
  const column = columnNameToIndex(match[1])
  const row = parseInt(match[2], 10) - 1
  return [column, row]
}

/**
 * Convert a cell position e.g. `[0, 1]` to a name e.g. `A2`
 *
 * @param position The position of the cell
 */
export function cellPositionToName(position: [number, number]): string {
  return `${columnIndexToName(position[0])}${position[1] + 1}`
}
