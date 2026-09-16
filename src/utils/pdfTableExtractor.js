// Extracts DMS Dashboard board-task rows (ID, Machine, Description, Status, Days Open...)
// from an uploaded PDF, so they can be turned into Team Operational Notes automatically.
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

const HEADER_KEYWORDS = ['id', 'machine', 'description', 'status', 'days open']
const Y_TOLERANCE = 2.5

// Reconstructs visual text lines from raw positioned text items on a PDF page.
async function getPageLines(page) {
  const textContent = await page.getTextContent()
  const items = textContent.items
    .map((item) => ({ str: item.str, x: item.transform[4], y: item.transform[5] }))
    .filter((item) => item.str.trim())

  const lines = []
  items.forEach((item) => {
    let line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= Y_TOLERANCE)
    if (!line) {
      line = { y: item.y, items: [] }
      lines.push(line)
    }
    line.items.push(item)
  })

  lines.sort((a, b) => b.y - a.y)
  lines.forEach((line) => line.items.sort((a, b) => a.x - b.x))
  return lines
}

function isHeaderLine(line) {
  const text = line.items.map((item) => item.str.toLowerCase()).join(' ')
  const matches = HEADER_KEYWORDS.filter((keyword) => text.includes(keyword))
  return matches.length >= 3
}

// Maps each header token (ID, Machine, Description, Status, Days Open) to its x position.
function findColumnStarts(headerLine) {
  const columns = {}
  headerLine.items.forEach((item) => {
    const key = item.str.trim().toLowerCase()
    if (key === 'id') columns.id = item.x
    else if (key === 'machine') columns.machine = item.x
    else if (key === 'description') columns.description = item.x
    else if (key === 'status') columns.status = item.x
    else if (key.includes('days')) columns.daysOpen = item.x
  })
  return columns
}

function assignColumn(x, sortedColumns) {
  let assigned = sortedColumns[0]?.[0] || null
  sortedColumns.forEach(([name, start]) => {
    if (x >= start - 5) assigned = name
  })
  return assigned
}

function buildRow(line, columns) {
  const sortedColumns = Object.entries(columns).sort((a, b) => a[1] - b[1])
  const row = {}
  line.items.forEach((item) => {
    const column = assignColumn(item.x, sortedColumns)
    if (!column) return
    row[column] = row[column] ? `${row[column]} ${item.str}`.trim() : item.str.trim()
  })
  return row
}

/**
 * Reads a DMS Dashboard-style PDF and returns board-task rows grouped by machine.
 * @param {File} file - The uploaded PDF file.
 * @returns {Promise<Array<{ machine: string, rows: Array<{ id, machine, description, status, daysOpen }> }>>}
 */
export async function extractDmsNotesFromPdf(file) {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const rows = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const lines = await getPageLines(page)
    const headerIndex = lines.findIndex(isHeaderLine)
    if (headerIndex === -1) continue

    const columns = findColumnStarts(lines[headerIndex])
    if (!columns.description) continue

    for (let i = headerIndex + 1; i < lines.length; i += 1) {
      const text = lines[i].items.map((item) => item.str).join(' ').trim()
      if (!text) continue
      if (/^total\b/i.test(text)) break

      const row = buildRow(lines[i], columns)
      if (row.id && /^\d+$/.test(row.id) && row.description) {
        rows.push({
          id: row.id,
          machine: row.machine || '',
          description: row.description,
          status: row.status || '',
          daysOpen: row.daysOpen || '',
        })
      }
    }
  }

  if (!rows.length) {
    throw new Error('No DMS board rows were found in this PDF. Make sure the table with ID/Machine/Description/Status columns is visible.')
  }

  const grouped = new Map()
  rows.forEach((row) => {
    const key = row.machine || 'All production lines'
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(row)
  })

  return Array.from(grouped.entries()).map(([machine, machineRows]) => ({ machine, rows: machineRows }))
}
