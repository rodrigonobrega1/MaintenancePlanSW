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
  pdf.roundedRect(x, y, width, 7, 1.5, 1.5, 'F')
  let cursor = x
  parts.forEach(([, count, color]) => {
    if (!count || !summary.total) return
    const segmentWidth = (count / summary.total) * width
    pdf.setFillColor(...color)
    pdf.rect(cursor, y, segmentWidth, 7, 'F')
    cursor += segmentWidth
  })
  pdf.setTextColor(85, 93, 100)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  parts.forEach(([label, count], index) => pdf.text(`${label}: ${count}`, x + index * 38, y + 13))
}

const STATUS_ORDER_LEGEND = [
  ['Completed', [46, 125, 74]],
  ['Not Started', [189, 103, 92]],
  ['Parts Requested', [217, 130, 59]],
  ['Started', [77, 127, 209]],
]

function statusCounts(summary) {
  return { Completed: summary.completed, 'Not Started': summary.notStarted, 'Parts Requested': summary.partsRequested, Started: summary.started }
}

// Draws a ring/donut chart made of many short colored strokes (jsPDF has no native arc primitive).
function drawPdfRingChart(pdf, cx, cy, radius, lineWidth, summary) {
  const counts = statusCounts(summary)
  const total = summary.total || 1
  let angle = -90
  pdf.setLineWidth(lineWidth)
  STATUS_ORDER_LEGEND.forEach(([label, color]) => {
    const count = counts[label] || 0
    if (!count) return
    const sweep = (count / total) * 360
    const steps = Math.max(1, Math.round(sweep / 4))
    for (let step = 0; step < steps; step += 1) {
      const a0 = (angle + (sweep * step) / steps) * Math.PI / 180
      const a1 = (angle + (sweep * (step + 1)) / steps) * Math.PI / 180
      pdf.setDrawColor(...color)
      pdf.line(cx + Math.cos(a0) * radius, cy + Math.sin(a0) * radius, cx + Math.cos(a1) * radius, cy + Math.sin(a1) * radius)
    }
    angle += sweep
  })
  pdf.setLineWidth(.2)
}

// Draws a semicircular completion gauge (0% on the left, 100% on the right).
function drawPdfGauge(pdf, cx, cy, radius, lineWidth, percentage) {
  const steps = 48
  const filledSteps = Math.round((percentage / 100) * steps)
  pdf.setLineWidth(lineWidth)
  for (let step = 0; step < steps; step += 1) {
    const a0 = (180 - (180 * step) / steps) * Math.PI / 180
    const a1 = (180 - (180 * (step + 1)) / steps) * Math.PI / 180
    pdf.setDrawColor(...(step < filledSteps ? [77, 127, 209] : [227, 230, 233]))
    pdf.line(cx + Math.cos(a0) * radius, cy + Math.sin(a0) * radius, cx + Math.cos(a1) * radius, cy + Math.sin(a1) * radius)
  }
  pdf.setLineWidth(.2)
  pdf.setTextColor(150, 157, 163); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(5.6)
  pdf.text('0.0%', cx - radius - 1, cy + 5)
  pdf.text('100.0%', cx + radius - 7, cy + 5)
  pdf.setTextColor(45, 52, 58); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9)
  const label = `${percentage}%`
  pdf.text(label, cx - pdf.getTextWidth(label) / 2, cy - 1)
}

// Renders one Power BI-style scorecard: donut + legend on the left, completion gauge on the right.
function drawDmsCard(pdf, x, y, width, height, title, summary) {
  pdf.setFillColor(249, 250, 251); pdf.setDrawColor(228, 231, 234); pdf.setLineWidth(.4)
  pdf.roundedRect(x, y, width, height, 2, 2, 'FD')
  pdf.setTextColor(45, 52, 58); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.text(title, x + 6, y + 9)

  const dividerX = x + width * 0.6
  pdf.setDrawColor(232, 235, 237); pdf.setLineWidth(.3); pdf.line(dividerX, y + 6, dividerX, y + height - 5)

  pdf.setTextColor(140, 146, 153); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(5.6)
  pdf.text('ACTION DISTRIBUTION', x + 6, y + 15)
  pdf.text('BY STATUS', x + 6, y + 19)

  const donutRadius = Math.min(13, height / 4.4)
  const donutCx = x + 17; const donutCy = y + height / 2 + 4
  drawPdfRingChart(pdf, donutCx, donutCy, donutRadius, 5, summary)
  pdf.setTextColor(45, 52, 58); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11)
  const totalLabel = String(summary.total)
  pdf.text(totalLabel, donutCx - pdf.getTextWidth(totalLabel) / 2, donutCy + 1.5)

  const counts = statusCounts(summary)
  let legendY = donutCy - donutRadius + 2
  STATUS_ORDER_LEGEND.forEach(([label, color]) => {
    const count = counts[label] || 0
    if (!count) return
    pdf.setFillColor(...color); pdf.circle(donutCx + donutRadius + 6, legendY - 1, 1, 'F')
    pdf.setTextColor(80, 88, 95); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6)
    pdf.text(`${label} ${count}`, donutCx + donutRadius + 9, legendY)
    legendY += 5.4
  })

  pdf.setTextColor(140, 146, 153); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(5.6)
  pdf.text('COMPLETION RATE', dividerX + 6, y + 15)
  drawPdfGauge(pdf, dividerX + (width - (dividerX - x)) / 2, y + height / 2 + 6, Math.min(12, (width - (dividerX - x)) / 2 - 8), 4.4, summary.completionRate)
}

function exportDmsWeeklyPdf(rows, notes) {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const machines = [...new Set(rows.map((row) => row.machine))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  const pageToken = '{total_pages_count_string}'
  const drawHeader = (title, subtitle) => {
    pdf.setTextColor(37, 40, 45); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(17); pdf.text(title, 12, 15)
    pdf.setTextColor(110, 118, 125); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.text(subtitle, 12, 22)
    pdf.setDrawColor(217, 130, 59); pdf.setLineWidth(.7); pdf.line(12, 26, 285, 26)
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
  const drawTable = (items, startY) => {
    const headers = [['Status', 14], ['Machine', 44], ['Activity', 68], ['Date added', 170], ['Days open', 196], ['H&S', 218], ['Engineer / Notes', 234]]
    pdf.setFillColor(239, 241, 244); pdf.rect(12, startY, 273, 8, 'F')
    pdf.setTextColor(70, 78, 85); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6.5)
    headers.forEach(([label, x]) => pdf.text(label, x, startY + 5.5))
    items.forEach((row, index) => {
      const y = startY + 14 + index * 8
      const color = row.status === 'Completed' ? [46, 125, 74] : row.status === 'Not Started' ? [189, 103, 92] : row.status === 'Parts Requested' ? [217, 130, 59] : [77, 127, 209]
      pdf.setDrawColor(235, 238, 240); pdf.line(12, y + 2.5, 285, y + 2.5)
      pdf.setTextColor(...color); pdf.setFont('helvetica', 'bold'); pdf.text(row.status.slice(0, 18), 14, y)
      pdf.setTextColor(65, 72, 78); pdf.setFont('helvetica', 'normal'); pdf.text(row.machine.slice(0, 14), 44, y)
      pdf.setFont('helvetica', 'bold'); pdf.text(row.title.slice(0, 52), 68, y)
      pdf.setFont('helvetica', 'normal'); pdf.text(formatDate(row.dateAdded), 170, y); pdf.text(String(row.daysOpen), 196, y); pdf.text(row.healthSafety || 'No', 218, y)
      pdf.text(`${row.engineer}${row.engineeringNotes ? ` · ${row.engineeringNotes}` : ''}`.slice(0, 31), 234, y)
    })
  }

  const overall = summaryFor(rows)
  const cardsData = [
    ...machines.map((machine) => ({ title: machine, summary: summaryFor(rows.filter((row) => row.machine === machine)) })),
    { title: 'ALL', summary: overall },
  ]
  const cols = 3
  const cardGap = 6
  const cardWidth = (273 - cardGap * (cols - 1)) / cols
  const cardHeight = 54
  const rowsPerPage = 2
  let cardIndex = 0
  let firstOverviewPage = true
  while (cardIndex < cardsData.length) {
    if (!firstOverviewPage) pdf.addPage()
    drawHeader(
      firstOverviewPage ? 'DMS Board Weekly Report' : 'DMS Board Weekly Report (continued)',
      `${rows.length} activities across ${machines.length} production lines · Issued ${new Date().toLocaleDateString('en-GB')}`
    )
    const gridStartY = firstOverviewPage ? 68 : 34
    if (firstOverviewPage) drawKpis(overall, 32)
    pdf.setTextColor(45, 52, 58); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11)
    pdf.text(firstOverviewPage ? 'Action distribution by production line' : 'Action distribution by production line (continued)', 12, gridStartY - 6)

    const pageCards = cardsData.slice(cardIndex, cardIndex + rowsPerPage * cols)
    pageCards.forEach((card, index) => {
      const col = index % cols
      const row = Math.floor(index / cols)
      const x = 12 + col * (cardWidth + cardGap)
      const y = gridStartY + row * (cardHeight + cardGap)
      drawDmsCard(pdf, x, y, cardWidth, cardHeight, card.title, card.summary)
    })
    cardIndex += pageCards.length
    firstOverviewPage = false
    drawFooter()
  }

  machines.forEach((machine) => {
    const machineRows = sortRows(rows.filter((row) => row.machine === machine))
    const summary = summaryFor(machineRows)
    const pages = Math.ceil(machineRows.length / 17) || 1
    for (let page = 0; page < pages; page += 1) {
      pdf.addPage()
      drawHeader(`DMS Board · ${machine}`, `${summary.total} actions · ${summary.completionRate}% completed · Status-priority order${pages > 1 ? ` · Page ${page + 1}/${pages}` : ''}`)
      if (page === 0) {
        drawKpis(summary, 32)
        drawStatusBar(pdf, 12, 62, 160, summary)
        if (notes[machine]) {
          pdf.setTextColor(45, 52, 58); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.text('LINE PRIORITIES & FEEDBACK', 180, 66)
          pdf.setFont('helvetica', 'normal'); pdf.setTextColor(90, 98, 105); pdf.setFontSize(7)
          pdf.text(pdf.splitTextToSize(notes[machine], 101).slice(0, 4), 180, 72)
        }
        drawTable(machineRows.slice(0, 13), 88)
      } else {
        drawTable(machineRows.slice(page * 17 - 4, page * 17 + 13), 34)
      }
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
