import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import { AlertTriangle, Check, FileDown, FileSpreadsheet, StickyNote, Upload } from 'lucide-react'

const NOTES_KEY = 'fieldmark-dms-board-notes'
const STATUS_ORDER = { 'Not Started': 0, Started: 1, 'Parts Requested': 2, Completed: 3 }
const STATUS_COLORS = {
  Completed: '#2e7d4a',
  'Not Started': '#bd675c',
  'Parts Requested': '#d9823b',
  Started: '#4d7fd1',
}

function excelDate(value) {
  if (!value) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d).toISOString()
  }
  const parts = String(value).trim().split(/[/-]/)
  if (parts.length === 3) {
    const [month, day, year] = parts.map(Number)
    const fullYear = year < 100 ? 2000 + year : year
    const date = new Date(fullYear, month - 1, day)
    if (!Number.isNaN(date.getTime())) return date.toISOString()
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

function daysOpen(dateAdded, status) {
  if (status === 'Completed' || !dateAdded) return 0
  const start = new Date(dateAdded)
  const today = new Date()
  start.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  return Math.max(0, Math.floor((today - start) / 86400000))
}

function normalizeRows(buffer) {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json(sheet, { defval: '' }).map((row, index) => {
    const status = String(row.Status || 'Not Started').trim() || 'Not Started'
    const dateAdded = excelDate(row['Date added'])
    return {
      id: `dms-${index}-${String(row.Title).slice(0, 20)}`,
      title: String(row.Title || '').trim(),
      machine: String(row.Machine || 'Unassigned').trim() || 'Unassigned',
      dateAdded,
      fixDescription: String(row['Fix Description'] || '').trim(),
      fixedDate: excelDate(row['Fixed Date']),
      status,
      engineeringNotes: String(row['Engineering Notes'] || '').trim(),
      healthSafety: String(row['Health and Safety'] || '').trim(),
      engineer: String(row.Engineer || '').trim(),
      daysOpen: daysOpen(dateAdded, status),
    }
  }).filter((row) => row.title)
}

function sortRows(rows) {
  return [...rows].sort((a, b) => a.machine.localeCompare(b.machine, undefined, { numeric: true }) || (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || b.daysOpen - a.daysOpen || a.title.localeCompare(b.title))
}

function summaryFor(rows) {
  const statuses = rows.reduce((result, row) => ({ ...result, [row.status]: (result[row.status] || 0) + 1 }), {})
  const completed = statuses.Completed || 0
  return {
    total: rows.length,
    completed,
    notStarted: statuses['Not Started'] || 0,
    started: statuses.Started || 0,
    partsRequested: statuses['Parts Requested'] || 0,
    healthSafety: rows.filter((row) => row.healthSafety.toLowerCase() === 'yes').length,
    completionRate: rows.length ? Math.round((completed / rows.length) * 100) : 0,
    avgDaysOpen: rows.filter((row) => row.status !== 'Completed').length
      ? Math.round(rows.filter((row) => row.status !== 'Completed').reduce((sum, row) => sum + row.daysOpen, 0) / rows.filter((row) => row.status !== 'Completed').length)
      : 0,
  }
}

function loadNotes() {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY) || '{}') } catch { return {} }
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('en-GB') : '—'
}

function drawStatusBar(pdf, x, y, width, summary) {
  const parts = [
    ['Completed', summary.completed, [46, 125, 74]],
    ['Not Started', summary.notStarted, [189, 103, 92]],
    ['Parts Requested', summary.partsRequested, [217, 130, 59]],
    ['Started', summary.started, [77, 127, 209]],
  ]
  pdf.setFillColor(235, 238, 240)
  pdf.roundedRect(x, y, width, 7, 2, 2, 'F')
  let cursor = x
  parts.forEach(([, count, color]) => {
    if (!count || !summary.total) return
    const segmentWidth = (count / summary.total) * width
    pdf.setFillColor(...color)
    pdf.rect(cursor, y, segmentWidth, 7, 'F')
    cursor += segmentWidth
  })
  let legendX = x
  const legendY = y + 13
  parts.forEach(([label, count, color]) => {
    pdf.setFillColor(...color); pdf.rect(legendX, legendY - 2.6, 2.6, 2.6, 'F')
    pdf.setTextColor(85, 93, 100); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.text(label, legendX + 4, legendY)
    const labelWidth = pdf.getTextWidth(label)
    pdf.setTextColor(45, 52, 58); pdf.setFont('helvetica', 'bold'); pdf.text(String(count), legendX + 6 + labelWidth, legendY)
    legendX += 6 + labelWidth + pdf.getTextWidth(String(count)) + 11
  })
}

function exportDmsWeeklyPdf(rows, notes) {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const machines = [...new Set(rows.map((row) => row.machine))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  const pageToken = '{total_pages_count_string}'
  const drawHeader = (title, subtitle) => {
    pdf.setTextColor(37, 40, 45); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(17); pdf.text(title, 12, 15)
    pdf.setTextColor(110, 118, 125); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.text(subtitle, 12, 22)
  }
  const drawFooter = () => {
    pdf.setTextColor(145, 151, 157); pdf.setFontSize(7)
    pdf.text('Maintenance Planning · DMS Board Weekly Report', 12, 203)
    pdf.text(`Page ${pdf.getNumberOfPages()} of ${pageToken}`, 258, 203)
  }
  const drawKpis = (summary, y) => {
    const cards = [
      ['TOTAL ACTIONS', summary.total], ['COMPLETED', summary.completed], ['OPEN / PENDING', summary.total - summary.completed],
      ['AVG DAYS OPEN', summary.avgDaysOpen], ['H&S ACTIONS', summary.healthSafety], ['COMPLETION RATE', `${summary.completionRate}%`],
    ]
    const gap = 4; const width = (273 - gap * 5) / 6
    cards.forEach(([label, value], index) => {
      const x = 12 + index * (width + gap)
      pdf.setFillColor(249, 250, 251); pdf.setDrawColor(226, 229, 232); pdf.roundedRect(x, y, width, 22, 1.5, 1.5, 'FD')
      pdf.setTextColor(125, 133, 140); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6); pdf.text(label, x + 4, y + 7)
      pdf.setTextColor(45, 52, 58); pdf.setFontSize(13); pdf.text(String(value), x + 4, y + 17)
    })
  }
  // Full-width feedback panel, matching the on-screen "Priorities & feedback" box.
  const drawPrioritiesBox = (note, y) => {
    const lines = pdf.splitTextToSize(note, 261)
    const boxHeight = 15 + lines.length * 5
    pdf.setFillColor(250, 248, 245); pdf.setDrawColor(217, 130, 59); pdf.setLineWidth(1.2)
    pdf.line(12, y, 12, y + boxHeight)
    pdf.setFillColor(250, 248, 245); pdf.setDrawColor(228, 231, 234); pdf.setLineWidth(.4)
    pdf.roundedRect(13, y, 272, boxHeight, 1.5, 1.5, 'FD')
    pdf.setTextColor(185, 106, 53); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.5); pdf.text('Priorities & feedback', 19, y + 8)
    pdf.setTextColor(60, 68, 75); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9)
    pdf.text(lines, 19, y + 15)
    return boxHeight
  }
  // Activity table matching the on-screen column order for a single production line.
  const drawTable = (items, startY) => {
    const headers = [['Status', 14], ['Activity', 44], ['Date added', 170], ['Days open', 198], ['Fix / Engineering notes', 222], ['H&S', 268], ['ENG', 278]]
    pdf.setFillColor(239, 241, 244); pdf.rect(12, startY, 273, 8, 'F')
    pdf.setTextColor(70, 78, 85); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6.5)
    headers.forEach(([label, x]) => pdf.text(label, x, startY + 5.5))
    items.forEach((row, index) => {
      const y = startY + 14 + index * 8
      const color = row.status === 'Completed' ? [46, 125, 74] : row.status === 'Not Started' ? [189, 103, 92] : row.status === 'Parts Requested' ? [217, 130, 59] : [77, 127, 209]
      pdf.setDrawColor(235, 238, 240); pdf.line(12, y + 2.5, 285, y + 2.5)
      pdf.setTextColor(...color); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6.5); pdf.text(row.status.slice(0, 16), 14, y)
      pdf.setTextColor(45, 52, 58); pdf.setFontSize(7.5); pdf.text(row.title.slice(0, 62), 44, y)
      pdf.setTextColor(65, 72, 78); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5)
      pdf.text(formatDate(row.dateAdded), 170, y); pdf.text(String(row.daysOpen), 198, y)
      pdf.text((row.fixDescription || row.engineeringNotes || '—').slice(0, 26), 222, y)
      pdf.text(row.healthSafety || 'No', 268, y); pdf.text((row.engineer || '—').slice(0, 6), 278, y)
    })
  }

  // --- Summary pages first: scorecards, then overall and per-line distribution charts ---
  const overall = summaryFor(rows)
  drawHeader('DMS Board Weekly Report — Summary', `${rows.length} activities across ${machines.length} production lines · Issued ${new Date().toLocaleDateString('en-GB')}`)
  drawKpis(overall, 32)

  // Overall performance card: rounded panel with an accent rail, visually separated from the per-line rows below.
  const overallCardY = 60; const overallCardHeight = 32
  pdf.setFillColor(250, 248, 245); pdf.setDrawColor(217, 130, 59); pdf.setLineWidth(1.4)
  pdf.line(12, overallCardY, 12, overallCardY + overallCardHeight)
  pdf.setFillColor(250, 249, 246); pdf.setDrawColor(232, 224, 213); pdf.setLineWidth(.5)
  pdf.roundedRect(13.5, overallCardY, 271.5, overallCardHeight, 2, 2, 'FD')
  pdf.setTextColor(185, 106, 53); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6.5); pdf.text('OVERALL PERFORMANCE', 20, overallCardY + 10)
  pdf.setTextColor(45, 52, 58); pdf.setFontSize(13); pdf.text('All production lines', 20, overallCardY + 20)
  drawStatusBar(pdf, 100, overallCardY + 9, 180, overall)

  let cursorY = overallCardY + overallCardHeight + 16
  const rowHeight = 24
  machines.forEach((machine) => {
    if (cursorY + rowHeight > 195) {
      drawFooter()
      pdf.addPage()
      drawHeader('DMS Board Weekly Report — Summary', `${rows.length} activities across ${machines.length} production lines`)
      cursorY = 34
    }
    const summary = summaryFor(rows.filter((row) => row.machine === machine))
    pdf.setTextColor(140, 146, 153); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6.5); pdf.text('PRODUCTION LINE', 12, cursorY - 6)
    pdf.setTextColor(45, 52, 58); pdf.setFontSize(11); pdf.text(machine, 12, cursorY + 1)
    pdf.setTextColor(110, 118, 125); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7)
    pdf.text(`${summary.total} actions · ${summary.completionRate}% completed · ${summary.avgDaysOpen} average days open`, 12, cursorY + 7)
    drawStatusBar(pdf, 95, cursorY - 7, 190, summary)
    pdf.setDrawColor(238, 240, 241); pdf.setLineWidth(.3); pdf.line(12, cursorY + 12, 285, cursorY + 12)
    cursorY += rowHeight
  })
  drawFooter()

  // --- Production-line pages next: header, priorities & feedback, activity table ---
  machines.forEach((machine) => {
    const machineRows = sortRows(rows.filter((row) => row.machine === machine))
    const summary = summaryFor(machineRows)
    const note = notes[machine]
    const firstPageRows = note ? 11 : 15
    const otherPageRows = 18
    const totalPages = Math.max(1, 1 + Math.ceil(Math.max(0, machineRows.length - firstPageRows) / otherPageRows))
    let consumed = 0
    for (let page = 0; page < totalPages; page += 1) {
      pdf.addPage()
      drawHeader(`DMS Board · ${machine}`, `${summary.total} actions · ${summary.completionRate}% completed · Status-priority order${totalPages > 1 ? ` · Page ${page + 1}/${totalPages}` : ''}`)
      let tableStartY = 34
      if (page === 0 && note) tableStartY = 34 + drawPrioritiesBox(note, 34) + 8
      const rowsThisPage = page === 0 ? firstPageRows : otherPageRows
      drawTable(machineRows.slice(consumed, consumed + rowsThisPage), tableStartY)
      consumed += rowsThisPage
      drawFooter()
    }
  })

  pdf.putTotalPages(pageToken)
  pdf.save('dms-board-weekly-report.pdf')
}

function StatusDistribution({ summary }) {
  const parts = [
    ['Completed', summary.completed], ['Not Started', summary.notStarted],
    ['Parts Requested', summary.partsRequested], ['Started', summary.started],
  ]
  return <div className="dms-status-distribution"><div className="dms-status-bar">{parts.map(([label, count]) => count ? <i key={label} title={`${label}: ${count}`} style={{ width: `${count / summary.total * 100}%`, background: STATUS_COLORS[label] }} /> : null)}</div><div className="dms-status-legend">{parts.map(([label, count]) => <span key={label}><i style={{ background: STATUS_COLORS[label] }} />{label} <b>{count}</b></span>)}</div></div>
}

export default function DmsBoardReport() {
  const [records, setRecords] = useState([])
  const [fileName, setFileName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [notes, setNotes] = useState(loadNotes)
  const [lineFilter, setLineFilter] = useState('All production lines')

  const machines = useMemo(() => [...new Set(records.map((row) => row.machine))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [records])
  const visibleRecords = useMemo(() => sortRows(records.filter((row) => lineFilter === 'All production lines' || row.machine === lineFilter)), [records, lineFilter])
  const overall = useMemo(() => summaryFor(records), [records])

  const upload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true); setError('')
    try {
      setRecords(normalizeRows(await file.arrayBuffer()))
      setFileName(file.name)
    } catch {
      setError('The selected DMS CSV/Excel file could not be analyzed.')
    } finally {
      setUploading(false); event.target.value = ''
    }
  }

  const updateNote = (machine, value) => {
    const updated = { ...notes, [machine]: value }
    setNotes(updated)
    try { localStorage.setItem(NOTES_KEY, JSON.stringify(updated)) } catch {}
  }

  return <div className="page-wrap plan-dashboard-page dms-board-page">
    <div className="plan-dashboard-head">
      <div><div className="eyebrow">Daily management system / action control</div><h1>DMS Board Report</h1><p>Production-line actions, status distribution, priorities and weekly reporting.</p></div>
      <div className="intro-actions no-print">
        <label className="button button-primary upload-button"><Upload size={16} />{uploading ? 'Reading...' : 'Upload DMS Excel'}<input type="file" accept=".csv,.xlsx,.xls" onChange={upload} /></label>
        <button className="button button-secondary" disabled={!records.length} onClick={() => exportDmsWeeklyPdf(records, notes)}><FileDown size={15} />Weekly Report</button>
      </div>
    </div>
    {error && <div className="upload-error"><AlertTriangle size={15} />{error}</div>}
    {!records.length ? <div className="upload-empty"><FileSpreadsheet size={25} /><div><strong>No DMS file attached</strong><p>Upload the DMS activity list in CSV or Excel format to build the board.</p></div></div> : <>
      <div className="plan-source-strip"><div className="file-icon">DMS</div><div><strong>{fileName}</strong><span>{records.length} actions · {machines.length} production lines</span></div><span className="live-pill"><i />Loaded</span></div>
      <section className="plan-filter-panel no-print"><div className="filter-title"><FileSpreadsheet size={15} /><strong>DMS Board Filters</strong><span>View the complete board or focus on one production line.</span></div><div className="plan-filter-controls"><label><span>Production line</span><div className="select-wrap"><select value={lineFilter} onChange={(event) => setLineFilter(event.target.value)}><option>All production lines</option>{machines.map((machine) => <option key={machine}>{machine}</option>)}</select></div></label></div></section>
      <div className="dms-kpi-grid">
        <div><small>Total actions</small><strong>{overall.total}</strong></div><div><small>Completed</small><strong className="kpi-green">{overall.completed}</strong></div><div><small>Open / pending</small><strong className="kpi-red">{overall.total - overall.completed}</strong></div><div><small>Average days open</small><strong>{overall.avgDaysOpen}</strong></div><div><small>H&amp;S actions</small><strong className="kpi-orange">{overall.healthSafety}</strong></div><div><small>Completion rate</small><strong className="kpi-blue">{overall.completionRate}%</strong></div>
      </div>
      <section className="dms-overall-panel"><div><span className="section-kicker">Overall performance</span><h2>All production lines</h2></div><StatusDistribution summary={overall} /></section>
      {machines.filter((machine) => lineFilter === 'All production lines' || machine === lineFilter).map((machine) => {
        const lineRows = visibleRecords.filter((row) => row.machine === machine)
        const summary = summaryFor(lineRows)
        return <section className="dms-line-section" key={machine}>
          <header><div><span className="section-kicker">Production line</span><h2>{machine}</h2><p>{summary.total} actions · {summary.completionRate}% completed · {summary.avgDaysOpen} average days open</p></div><StatusDistribution summary={summary} /></header>
          <div className="dms-line-note no-print"><div><StickyNote size={15} /><strong>Priorities &amp; feedback</strong></div><textarea value={notes[machine] || ''} onChange={(event) => updateNote(machine, event.target.value)} placeholder={`Describe ${machine} priorities, constraints, progress and feedback...`} /></div>
          <div className="dms-table-wrap"><table className="dms-table"><thead><tr><th>Status</th><th>Activity</th><th>Date added</th><th>Days open</th><th>Fix / Engineering notes</th><th>H&amp;S</th><th>Engineer</th></tr></thead><tbody>{lineRows.map((row) => <tr key={row.id}><td><span className="dms-status-pill" style={{ color: STATUS_COLORS[row.status], background: `${STATUS_COLORS[row.status]}16` }}><i style={{ background: STATUS_COLORS[row.status] }} />{row.status}</span></td><td><strong>{row.title}</strong></td><td>{formatDate(row.dateAdded)}</td><td className={row.daysOpen > 14 ? 'overdue-text' : ''}>{row.daysOpen}</td><td>{row.fixDescription || row.engineeringNotes || '—'}</td><td>{row.healthSafety || 'No'}</td><td>{row.engineer || '—'}</td></tr>)}</tbody></table></div>
        </section>
      })}
    </>}
  </div>
}
