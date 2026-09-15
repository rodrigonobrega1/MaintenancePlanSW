import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import * as XLSX from 'xlsx'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  Copy,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Download,
  Filter,
  FileDown,
  FileSpreadsheet,
  GanttChart,
  KeyRound,
  LayoutDashboard,
  ListFilter,
  LoaderCircle,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  StickyNote,
  Trash2,
  Info,
  Upload,
  WandSparkles,
  Wrench,
  X,
  Zap,
} from 'lucide-react'
import './styles.css'

const initialTasks = [
  { id: 1, title: 'Inspect hydraulic pressure', asset: 'CNC Mill 04', type: 'Preventive', due: 'Today', frequency: 'Weekly', owner: 'LM', status: 'Due today', priority: 'High' },
  { id: 2, title: 'Replace air filter', asset: 'Compressor A', type: 'Preventive', due: 'Sep 13, 2026', frequency: 'Monthly', owner: 'JR', status: 'Scheduled', priority: 'Medium' },
  { id: 3, title: 'Check safety interlocks', asset: 'Conveyor Line 2', type: 'Compliance', due: 'Sep 14, 2026', frequency: 'Quarterly', owner: 'AS', status: 'Scheduled', priority: 'High' },
  { id: 4, title: 'Lubricate drive chain', asset: 'Packaging Unit 1', type: 'Preventive', due: 'Sep 15, 2026', frequency: 'Weekly', owner: 'MK', status: 'Scheduled', priority: 'Low' },
  { id: 5, title: 'Calibrate temperature sensor', asset: 'Boiler Room', type: 'Calibration', due: 'Sep 17, 2026', frequency: 'Biannual', owner: 'JR', status: 'Scheduled', priority: 'Medium' },
  { id: 6, title: 'Inspect emergency stop', asset: 'CNC Mill 02', type: 'Compliance', due: 'Sep 18, 2026', frequency: 'Monthly', owner: 'LM', status: 'Scheduled', priority: 'High' },
]

const navItems = [
  { label: 'Maintenance Plan View', icon: LayoutDashboard },
  { label: 'Logbook', icon: ClipboardCheck },
  { label: 'Priority Portal', icon: Zap },
]

const dashboardReportStorageKey = 'fieldmark-dashboard-report'
const maintenanceScheduleStorageKey = 'fieldmark-maintenance-schedule'
const teamNotesStorageKey = 'fieldmark-team-notes'
const priorityTasksStorageKey = 'fieldmark-priority-tasks'
const geminiApiKeyStorageKey = 'fieldmark-gemini-api-key'

async function downloadPdf(selector, fileName) {
  const element = document.querySelector(selector)
  if (!element) return
  const previous = { display: element.style.display, position: element.style.position, left: element.style.left, top: element.style.top, visibility: element.style.visibility }
  Object.assign(element.style, { display: 'block', position: 'fixed', left: '-10000px', top: '0', visibility: 'visible', width: '1120px' })
  try {
    const canvas = await html2canvas(element, { scale: 1.5, backgroundColor: '#ffffff', useCORS: true })
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width, canvas.height] })
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height)
    pdf.save(fileName)
  } finally {
    Object.assign(element.style, previous)
  }
}

function pdfHeader(pdf, title, subtitle) {
  pdf.setTextColor(217, 130, 59)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(22)
  pdf.text(title, 16, 19)
  pdf.setDrawColor(217, 130, 59)
  pdf.setLineWidth(0.8)
  pdf.line(16, 24, 281, 24)
  pdf.setTextColor(90, 96, 103)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.text(subtitle, 16, 33)
}

function exportDashboardPdf(report, pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }), save = true) {
  pdfHeader(pdf, 'Maintenance dashboard report', `${report.fileName} · ${report.total.toLocaleString()} analyzed records`)
  const cards = [['Completed orders', report.completed, `${report.rate}%`], ['Not completed', report.pending, `${100 - report.rate}%`], ['Overall compliance', `${report.rate}%`, 'Completion date'], ['Priority machines', report.machines.filter((machine) => machine.priority).length, 'Attention']]
  cards.forEach(([label, value, detail], index) => {
    const x = 16 + index * 66
    pdf.setFillColor(248, 249, 250); pdf.roundedRect(x, 42, 61, 31, 2, 2, 'F')
    pdf.setTextColor(90, 96, 103); pdf.setFontSize(9); pdf.text(label, x + 5, 50)
    pdf.setTextColor(37, 40, 45); pdf.setFontSize(20); pdf.text(String(value), x + 5, 62)
    pdf.setTextColor(196, 105, 48); pdf.setFontSize(9); pdf.text(detail, x + 5, 69)
  })
  pdf.setTextColor(37, 40, 45); pdf.setFontSize(14); pdf.text('Completed vs not completed', 20, 89); pdf.text('Plan status by criticality', 160, 89)
  drawPdfDonut(pdf, 61, 123, report.rate, [217, 130, 59], 'Compliance')
  pdf.setFontSize(10); pdf.setTextColor(90, 96, 103); pdf.text(`Completed: ${report.completed.toLocaleString()}`, 91, 117); pdf.text(`Not completed: ${report.pending.toLocaleString()}`, 91, 128)
  drawPdfRiskBars(pdf, 160, 105, report.riskSummary || [])
  pdf.setTextColor(145, 151, 157); pdf.setFontSize(9); pdf.text('Completion status is based on Completion date.', 16, 197)
  pdf.addPage()
  pdfHeader(pdf, 'Monthly compliance evolution', `${report.fileName} · completion date analysis`)
  pdf.setTextColor(37, 40, 45); pdf.setFontSize(15); pdf.text('Completed and pending maintenance by month', 18, 51)
  drawPdfMonthly(pdf, 24, 68, report.monthly)
  pdf.setTextColor(145, 151, 157); pdf.setFontSize(9); pdf.text('Orange bars show completed records. Gray bars show the monthly total.', 18, 193)
  if (save) pdf.save('maintenance-dashboard-report.pdf')
}

function drawPdfDonut(pdf, x, y, percentage, color, label) {
  const segments = 96
  const completedSegments = Math.round((percentage / 100) * segments)
  pdf.setLineWidth(7)
  for (let index = 0; index < segments; index += 1) {
    const start = -Math.PI / 2 + (index / segments) * Math.PI * 2
    const end = -Math.PI / 2 + ((index + 1) / segments) * Math.PI * 2
    pdf.setDrawColor(...(index < completedSegments ? color : [232, 213, 194]))
    pdf.line(x + Math.cos(start) * 17, y + Math.sin(start) * 17, x + Math.cos(end) * 17, y + Math.sin(end) * 17)
  }
  pdf.setTextColor(37, 40, 45); pdf.setFontSize(16); pdf.text(`${percentage}%`, x - 8, y + 2)
  pdf.setTextColor(130, 136, 142); pdf.setFontSize(8); pdf.text(label, x - 9, y + 9)
}

function drawPdfRiskBars(pdf, x, y, items) {
  const colors = { 'Low risk': [105, 115, 125], 'Medium risk': [215, 164, 95], 'High risk': [217, 130, 59], Critical: [189, 103, 92] }
  const maximum = Math.max(...items.map((item) => item.count), 1)
  const orderedItems = [...items].sort((a, b) => ['Critical', 'High risk', 'Medium risk', 'Low risk'].indexOf(a.risk) - ['Critical', 'High risk', 'Medium risk', 'Low risk'].indexOf(b.risk))
  orderedItems.forEach((item, index) => {
    const rowY = y + index * 18
    pdf.setTextColor(75, 82, 89); pdf.setFontSize(10); pdf.text(item.risk, x, rowY)
    pdf.setFillColor(235, 237, 239); pdf.roundedRect(x + 38, rowY - 6, 70, 8, 1.5, 1.5, 'F')
    pdf.setFillColor(...(colors[item.risk] || colors['Low risk'])); pdf.roundedRect(x + 38, rowY - 6, 70 * (item.count / maximum), 8, 1.5, 1.5, 'F')
    pdf.setTextColor(75, 82, 89); pdf.setFontSize(10); pdf.text(String(item.count), x + 114, rowY)
  })
}

function drawPdfMonthly(pdf, x, y, monthly) {
  const max = Math.max(...monthly.map((month) => month.total), 1)
  monthly.forEach((month, index) => {
    const barHeight = (month.total / max) * 92
    const completedHeight = (month.completed / max) * 92
    const barX = x + index * 21
    pdf.setFillColor(224, 228, 231); pdf.roundedRect(barX, y + 95 - barHeight, 12, barHeight, 1, 1, 'F')
    pdf.setFillColor(217, 130, 59); pdf.roundedRect(barX, y + 95 - completedHeight, 12, completedHeight, 1, 1, 'F')
    pdf.setTextColor(115, 122, 128); pdf.setFontSize(8); pdf.text(month.label, barX, y + 106)
    pdf.setTextColor(74, 132, 91); pdf.setFontSize(8); pdf.text(`${month.rate}%`, barX, y + 115)
  })
}

function exportCriticalPdf(plans, pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }), save = true) {
  const ordered = [...plans].sort((a, b) => ['Low risk', 'Medium risk', 'High risk', 'Critical'].indexOf(a.riskStage) - ['Low risk', 'Medium risk', 'High risk', 'Critical'].indexOf(b.riskStage))
  pdfHeader(pdf, 'Critical maintenance matrix', `${plans.length} plans · ordered by risk and completion`)
  const headers = ['Activity / machine', 'Low risk', 'Medium risk', 'High risk', 'Critical']
  const widths = [108, 36, 36, 36, 36]
  let x = 12; pdf.setFillColor(239, 240, 241); pdf.rect(12, 35, 252, 10, 'F'); pdf.setTextColor(75, 82, 89); pdf.setFontSize(7)
  headers.forEach((header, index) => { pdf.text(header, x + 3, 41); x += widths[index] })
  ordered.forEach((plan, index) => {
    if (index > 0 && index % 18 === 0) {
      pdf.addPage()
      pdfHeader(pdf, 'Critical maintenance matrix', `${plans.length} plans · continued`)
      x = 12
      pdf.setFillColor(239, 240, 241); pdf.rect(12, 35, 252, 10, 'F'); pdf.setTextColor(75, 82, 89); pdf.setFontSize(8)
      headers.forEach((header, headerIndex) => { pdf.text(header, x + 3, 41); x += widths[headerIndex] })
    }
    const y = 45 + (index % 18) * 8.4; x = 12
    pdf.setDrawColor(232, 234, 236); pdf.line(12, y + 7, 264, y + 7)
    pdf.setTextColor(43, 48, 53); pdf.setFontSize(8); pdf.text(plan.activity.slice(0, 42), x + 3, y + 4); pdf.setTextColor(125, 132, 138); pdf.setFontSize(7); pdf.text(`${plan.machine} · ${plan.frequency}`, x + 3, y + 6.5); x += widths[0]
    ;['Low risk', 'Medium risk', 'High risk', 'Critical'].forEach((risk, riskIndex) => { if (plan.riskStage === risk) { pdf.setFillColor(...({ 'Low risk': [105, 115, 125], 'Medium risk': [215, 164, 95], 'High risk': [217, 130, 59], Critical: [189, 103, 92] }[risk])); pdf.roundedRect(x + 4, y + 1, 27, 6, 1, 1, 'F'); pdf.setTextColor(255, 255, 255); pdf.setFontSize(6.5); pdf.text(plan.delayDays > 0 ? `${plan.delayDays}d late` : 'Completed', x + 7, y + 5) } x += widths[riskIndex + 1] })
  })
  if (save) pdf.save('critical-view-report.pdf')
}

function exportPlanDashboardPdf({ plans, line, notes = [], shutdownDate = '' }) {
  const ordered = [...plans].sort((a, b) => b.daysOverdue - a.daysOverdue || b.delayDays - a.delayDays || (a.nextDue || 0) - (b.nextDue || 0))
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = 297
  const cardWidth = 87
  const cardHeight = 38
  const cardGap = 6
  const pageToken = '{total_pages_count_string}'

  const statusColor = (plan) => {
    if (plan.daysOverdue > 30 || plan.criticality === 'Critical') return [201, 104, 95]
    if (plan.daysOverdue > 0 || plan.criticality === 'Due soon') return [223, 157, 85]
    return [103, 168, 118]
  }

  const shutdownLabel = shutdownDate ? formatPrintDate(shutdownDate) : 'Date to be defined'

  const drawHeader = (title, subtitle) => {
    pdf.setTextColor(37, 40, 45)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(18)
    pdf.text(title, 12, 14)

    pdf.setFontSize(8)
    pdf.setTextColor(185, 106, 53)
    pdf.setFont('helvetica', 'bold')
    pdf.text(`LINE / MACHINE: ${line.toUpperCase()}`, 12, 20)

    pdf.setTextColor(80, 88, 95)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`MAINTENANCE SHUTDOWN DATE: ${shutdownLabel.toUpperCase()}`, 110, 20)
    pdf.text(`ISSUED: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`, 232, 20)

    pdf.setDrawColor(220, 224, 228)
    pdf.setLineWidth(0.6)
    pdf.line(12, 23, pageWidth - 12, 23)

    if (subtitle) {
      pdf.setTextColor(110, 118, 125)
      pdf.setFontSize(8)
      pdf.text(subtitle, 12, 28)
    }
  }

  const drawFooter = () => {
    const page = pdf.getNumberOfPages()
    pdf.setTextColor(140, 146, 153)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.text(`Maintenance Planning · Plant Operational Report · Line: ${line} · Shutdown Date: ${shutdownLabel}`, 12, 203)
    pdf.text(`Page ${page} of ${pageToken}`, pageWidth - 32, 203)
  }

  // --- PAGE 1: Top Priority Cards ---
  const topCards = ordered.slice(0, 12)
  drawHeader(
    'Top Priority Maintenance Plans',
    `Top ${topCards.length} prioritized plans from active queue · Complete list of all ${ordered.length} plans continues on next pages`
  )

  topCards.forEach((plan, index) => {
    const column = index % 3
    const row = Math.floor(index / 3)
    const x = 12 + column * (cardWidth + cardGap)
    const y = 31 + row * (cardHeight + 3)
    const color = statusColor(plan)
    const isOverdue = plan.daysOverdue > 0

    pdf.setFillColor(252, 252, 251)
    pdf.setDrawColor(...color)
    pdf.setLineWidth(1)
    pdf.roundedRect(x, y, cardWidth, cardHeight, 2, 2, 'FD')

    pdf.setTextColor(90, 98, 105)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.text(plan.frequency, x + 6, y + 8)

    pdf.setTextColor(...color)
    pdf.setFontSize(8)
    const badgeText = isOverdue ? `${plan.daysOverdue}d overdue` : plan.criticality === 'Due soon' ? 'Due soon' : 'On track'
    pdf.text(badgeText, x + (cardWidth - 6 - pdf.getTextWidth(badgeText)), y + 8)

    pdf.setTextColor(47, 55, 61)
    pdf.setFontSize(10)
    pdf.text(plan.activity.slice(0, 31), x + 6, y + 17)

    pdf.setTextColor(125, 133, 140)
    pdf.setFontSize(8)
    pdf.text(`${plan.machine} · ${plan.planCode}`.slice(0, 38), x + 6, y + 24)
    pdf.text(`Last: ${plan.lastCompleted ? formatPrintDate(plan.lastCompleted) : 'Not completed'}`, x + 6, y + 30)
    pdf.text(`Next: ${plan.nextDue ? formatPrintDate(plan.nextDue) : 'To be planned'}`, x + 6, y + 35)
  })

  drawFooter()

  // --- PAGE 2+: Full List of ALL Plans for the Selected Line ---
  const rowsPerPage = 15
  const totalListPages = Math.ceil(ordered.length / rowsPerPage) || 1

  const tableColumns = [
    { label: 'Rank', x: 15 },
    { label: 'Activity / Maintenance Task', x: 30 },
    { label: 'Machine / Tag', x: 130 },
    { label: 'Frequency', x: 172 },
    { label: 'Plan Code', x: 196 },
    { label: 'Due Date / Overdue Status', x: 226 },
    { label: 'Severity', x: 268 },
  ]

  for (let p = 0; p < totalListPages; p++) {
    pdf.addPage()
    drawHeader(
      'Complete Maintenance Plan Portfolio',
      `Complete list of all ${ordered.length} plans for ${line} · Ordered by delay and criticality (Page ${p + 1} of ${totalListPages})`
    )

    const listStart = 33
    // Table header background
    pdf.setFillColor(239, 241, 244)
    pdf.rect(12, listStart, 273, 8, 'F')
    pdf.setTextColor(70, 78, 85)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7.5)
    tableColumns.forEach((col) => pdf.text(col.label, col.x, listStart + 5.5))

    const pagePlans = ordered.slice(p * rowsPerPage, (p + 1) * rowsPerPage)
    pagePlans.forEach((plan, idx) => {
      const overallIndex = p * rowsPerPage + idx
      const rowY = listStart + 13 + idx * 8.5
      const color = statusColor(plan)
      const isOverdue = plan.daysOverdue > 0

      pdf.setDrawColor(235, 238, 240)
      pdf.setLineWidth(0.4)
      pdf.line(12, rowY + 2.5, 285, rowY + 2.5)

      pdf.setTextColor(145, 151, 157)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7)
      pdf.text(String(overallIndex + 1).padStart(2, '0'), 15, rowY)

      pdf.setTextColor(45, 52, 58)
      pdf.setFont('helvetica', 'bold')
      pdf.text(plan.activity.slice(0, 56), 30, rowY)

      pdf.setTextColor(100, 108, 115)
      pdf.setFont('helvetica', 'normal')
      pdf.text(plan.machine.slice(0, 22), 130, rowY)
      pdf.text(plan.frequency, 172, rowY)
      pdf.text(plan.planCode.slice(0, 15), 196, rowY)

      if (isOverdue) {
        pdf.setTextColor(...color)
        pdf.setFont('helvetica', 'bold')
        pdf.text(`${plan.daysOverdue}d overdue (${plan.nextDue ? formatPrintDate(plan.nextDue) : 'No date'})`.slice(0, 28), 226, rowY)
      } else {
        pdf.setTextColor(100, 108, 115)
        pdf.setFont('helvetica', 'normal')
        pdf.text(plan.nextDue ? `Due ${formatPrintDate(plan.nextDue)}` : 'To be planned', 226, rowY)
      }

      pdf.setTextColor(...color)
      pdf.setFont('helvetica', 'bold')
      const sevLabel = isOverdue ? (plan.daysOverdue > 30 ? 'Critical' : 'Overdue') : (plan.criticality === 'Due soon' ? 'Due soon' : 'On track')
      pdf.text(sevLabel, 268, rowY)
    })

    // If on the last page and notes exist, print notes section if space allows or add page
    if (p === totalListPages - 1 && notes && notes.length > 0) {
      const lastRowY = listStart + 13 + pagePlans.length * 8.5
      if (lastRowY <= 145) {
        const notesStartY = Math.max(lastRowY + 6, 138)
        const availableHeight = 198 - notesStartY

        pdf.setFillColor(254, 252, 246)
        pdf.setDrawColor(217, 130, 59)
        pdf.setLineWidth(0.8)
        pdf.roundedRect(12, notesStartY, 273, Math.min(52, availableHeight), 2, 2, 'FD')

        pdf.setTextColor(185, 106, 53)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(10.5)
        pdf.text(`TEAM OPERATIONAL NOTES & SHIFT INSTRUCTIONS (${notes.length})`, 16, notesStartY + 7)

        pdf.setTextColor(45, 52, 58)
        pdf.setFontSize(9)
        notes.slice(0, 4).forEach((note, nIdx) => {
          const dateStr = note.createdAt ? formatPrintDate(note.createdAt) : ''
          const tag = `[${note.line === 'All production lines' ? 'Global' : note.line}]`
          const yPos = notesStartY + 15 + nIdx * 8

          pdf.setTextColor(185, 106, 53)
          pdf.setFont('helvetica', 'bold')
          pdf.text(`• ${tag}`, 16, yPos)

          pdf.setTextColor(45, 52, 58)
          pdf.setFont('helvetica', 'normal')
          const textOffset = 16 + pdf.getTextWidth(`• ${tag} `)
          pdf.text(`${note.text}`.slice(0, 110), textOffset, yPos)

          if (dateStr) {
            pdf.setTextColor(125, 133, 140)
            pdf.setFontSize(7.5)
            pdf.text(`(${dateStr})`, 252, yPos)
            pdf.setFontSize(9)
          }
        })
      } else {
        // Overflow to dedicated notes page
        pdf.addPage()
        drawHeader(
          'Team Operational Notes & Shift Instructions',
          `Directives and operational reminders for ${line} · Shutdown: ${shutdownLabel}`
        )

        const notesStartY = 33
        pdf.setFillColor(254, 252, 246)
        pdf.setDrawColor(217, 130, 59)
        pdf.setLineWidth(0.8)
        pdf.roundedRect(12, notesStartY, 273, Math.min(156, 18 + notes.length * 15), 2, 2, 'FD')

        pdf.setTextColor(185, 106, 53)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(11)
        pdf.text(`TEAM OPERATIONAL NOTES & SHIFT INSTRUCTIONS (${notes.length})`, 16, notesStartY + 8.5)

        pdf.setTextColor(45, 52, 58)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(9.5)
        notes.forEach((note, nIdx) => {
          const dateStr = note.createdAt ? formatPrintDate(note.createdAt) : ''
          const tag = `[${note.line === 'All production lines' ? 'Global' : note.line}]`
          const yPos = notesStartY + 18 + nIdx * 14
          pdf.setTextColor(185, 106, 53)
          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(9)
          pdf.text(`• ${tag}`, 16, yPos)

          pdf.setTextColor(45, 52, 58)
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(9.5)
          const textOffset = 16 + pdf.getTextWidth(`• ${tag} `)
          pdf.text(`${note.text}`, textOffset, yPos)

          if (dateStr) {
            pdf.setTextColor(125, 133, 140)
            pdf.setFontSize(8)
            pdf.text(`(${dateStr})`, 250, yPos)
          }
        })
      }
    }

    drawFooter()
  }

  pdf.putTotalPages(pageToken)
  pdf.save(`maintenance-plan-dashboard-${line.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`)
}

function exportLogbookCsv(records, lineFilter) {
  const headers = ['#', 'Line / Machine', 'Maintenance Plan', 'Item Code', 'Description', 'Call No.', 'Scheduled Start Date', 'Completion Date', 'Order', 'Status']
  const rows = records.map((r, i) => [
    i + 1,
    `"${(r.line || '').replace(/"/g, '""')}"`,
    `"${(r.planCode || '').replace(/"/g, '""')}"`,
    `"${(r.itemCode || '').replace(/"/g, '""')}"`,
    `"${(r.description || '').replace(/"/g, '""')}"`,
    `"${(r.callNo || '').replace(/"/g, '""')}"`,
    r.scheduledDate ? formatPrintDate(r.scheduledDate) : '',
    r.completionDate ? formatPrintDate(r.completionDate) : '',
    `"${(r.order || '').replace(/"/g, '""')}"`,
    r.status,
  ])
  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `maintenance-logbook-${lineFilter.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function exportWeeklyPdf({ weekStart, weekDays, weekPlans, weekNotes, sourcePlans }, pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }), save = true) {
  pdfHeader(pdf, 'Weekly maintenance plan', `Week of ${formatWeekRange(weekStart)}`)
  const findPlan = (key) => sourcePlans.find((plan) => plan.id === key.split('|')[1])
  const colWidth = 38; weekDays.forEach((day, index) => { const x = 12 + index * colWidth; pdf.setFillColor(239, 240, 241); pdf.rect(x, 36, colWidth - 2, 10, 'F'); pdf.setTextColor(65, 72, 78); pdf.setFontSize(8); pdf.text(day.label, x + 3, 42); pdf.setFontSize(7); pdf.text(String(day.date), x + 28, 42) })
  weekDays.forEach((day, index) => { const x = 12 + index * colWidth; let y = 51; const plans = weekPlans.filter(([, dayIndex]) => dayIndex === index).map(([key]) => findPlan(key)).filter(Boolean); plans.forEach((plan) => { pdf.setFillColor(255, 244, 232); pdf.roundedRect(x + 2, y, colWidth - 6, 17, 1, 1, 'F'); pdf.setTextColor(48, 53, 58); pdf.setFontSize(7); pdf.text(plan.activity.slice(0, 27), x + 4, y + 6); pdf.setTextColor(115, 122, 128); pdf.setFontSize(6); pdf.text(`${plan.machine} · ${plan.frequency}`, x + 4, y + 11); y += 20 }); weekNotes.filter((note) => note.dayIndex === index).forEach((note) => { pdf.setFillColor(255, 249, 233); pdf.rect(x + 2, y, colWidth - 6, 15, 'F'); pdf.setTextColor(115, 82, 51); pdf.setFontSize(7); pdf.text(note.text.slice(0, 30), x + 4, y + 8); y += 18 }) })
  pdf.addPage()
  pdfHeader(pdf, 'Selected weekly activities', `Week of ${formatWeekRange(weekStart)} · ${weekPlans.length} activities · ${weekNotes.length} notes`)
  pdf.setTextColor(37, 40, 45); pdf.setFontSize(14); pdf.text('Activity details', 16, 48)
  let y = 58
  const details = weekPlans.map(([key, dayIndex]) => ({ plan: findPlan(key), day: weekDays[dayIndex] })).filter(({ plan }) => plan).sort((a, b) => a.plan.machine.localeCompare(b.plan.machine) || a.day.index - b.day.index || a.plan.activity.localeCompare(b.plan.activity))
  const columns = [
    ['Day', 16, 23], ['Line / machine', 39, 34], ['Activity', 73, 86], ['Frequency', 159, 24], ['Plan', 183, 35], ['Orders', 218, 25], ['Status', 243, 38],
  ]
  pdf.setFillColor(239, 240, 241); pdf.rect(16, 54, 265, 10, 'F')
  pdf.setTextColor(75, 82, 89); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7)
  columns.forEach(([label, columnX]) => pdf.text(label, columnX + 2, 60))
  let tableRow = 0
  details.forEach(({ plan, day }) => {
    if (tableRow > 0 && tableRow % 15 === 0) {
      pdf.addPage()
      pdfHeader(pdf, 'Selected weekly activities', `Week of ${formatWeekRange(weekStart)} · continued`)
      pdf.setFillColor(239, 240, 241); pdf.rect(16, 45, 265, 10, 'F')
      pdf.setTextColor(75, 82, 89); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7)
      columns.forEach(([label, columnX]) => pdf.text(label, columnX + 2, 51))
      tableRow = 0
    }
    const rowY = 55 + tableRow * 7.2
    pdf.setFillColor(tableRow % 2 ? 250 : 245, tableRow % 2 ? 251 : 247, tableRow % 2 ? 252 : 249); pdf.rect(16, rowY, 265, 7.2, 'F')
    pdf.setTextColor(70, 77, 84); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5)
    pdf.text(`${day.label} ${day.date}`, 18, rowY + 4.7)
    pdf.text(plan.machine.slice(0, 18), 41, rowY + 4.7)
    pdf.text(plan.activity.slice(0, 43), 75, rowY + 4.7)
    pdf.text(plan.frequency, 161, rowY + 4.7)
    pdf.text(plan.planCode.slice(0, 19), 185, rowY + 4.7)
    pdf.text(`${plan.completedOrders}/${plan.totalOrders} · ${plan.completionRate}%`, 220, rowY + 4.7)
    pdf.text(plan.status, 245, rowY + 4.7)
    tableRow += 1
  })
  if (weekNotes.length) {
    if (tableRow > 12) {
      pdf.addPage()
      pdfHeader(pdf, 'Selected weekly activities', `Week of ${formatWeekRange(weekStart)} · notes`)
      tableRow = 0
    }
    let notesY = 58 + tableRow * 7.2
    pdf.setTextColor(115, 82, 51); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.text('Notes', 16, notesY)
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7)
    weekNotes.forEach((note, index) => {
      if (index > 0 && index % 18 === 0) {
        pdf.addPage()
        pdfHeader(pdf, 'Selected weekly activities', `Week of ${formatWeekRange(weekStart)} · notes continued`)
        notesY = 47
      }
      pdf.text(`${weekDays[note.dayIndex].label} ${weekDays[note.dayIndex].date}: ${note.text}`.slice(0, 115), 16, notesY + 7 + (index % 18) * 6)
    })
  }
  if (save) pdf.save('weekly-maintenance-plan.pdf')
}

function exportMaintenancePlanReport({ weekStart, weekDays, plans, notes, filters }) {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const generatedAt = new Date()
  const totalOrders = plans.reduce((sum, plan) => sum + plan.totalOrders, 0)
  const completedOrders = plans.reduce((sum, plan) => sum + plan.completedOrders, 0)
  const compliance = totalOrders ? Math.round((completedOrders / totalOrders) * 100) : 0
  const overdue = plans.filter((plan) => plan.status === 'Overdue').length
  const critical = plans.filter((plan) => plan.status === 'Overdue' && plan.completionRate === 0).length
  const pageToken = '{total_pages_count_string}'
  const footer = () => {
    const page = pdf.getNumberOfPages()
    pdf.setTextColor(120, 128, 136); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7)
    pdf.text(`Maintenance Planning · Operational confidentiality · Page ${page} of ${pageToken}`, 16, 202)
  }
  const header = (continued = false) => {
    pdf.setTextColor(34, 79, 122); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(18)
    pdf.text('TECHNICAL REPORT - PREVENTIVE / PREDICTIVE MAINTENANCE PLAN', 16, 16)
    pdf.setDrawColor(34, 79, 122); pdf.setLineWidth(0.7); pdf.line(16, 21, 281, 21)
    pdf.setTextColor(86, 96, 106); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8)
    pdf.text(`Generated: ${generatedAt.toLocaleString('en-GB')} · Issuer: Maintenance Planning · Plan version: ${filters.fileName}`, 16, 28)
    pdf.text(`${continued ? 'Continued · ' : ''}Planning period: ${formatWeekRange(weekStart)}`, 16, 34)
  }
  const drawFilters = () => {
    pdf.setFillColor(241, 245, 248); pdf.roundedRect(16, 39, 265, 17, 2, 2, 'F')
    pdf.setTextColor(34, 79, 122); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.text('ACTIVE FILTERS', 21, 46)
    pdf.setTextColor(76, 84, 92); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8)
    pdf.text(`Area / line: ${filters.line}   Equipment / tag: ${filters.line}   Type: Preventive / predictive`, 21, 51)
    pdf.text(`Frequency: ${filters.frequency}   Period: ${formatWeekRange(weekStart)}   Status: Selected weekly tasks`, 21, 55)
  }
  const drawKpis = () => {
    const cards = [['Plans / tasks', plans.length, 'Mapped'], ['Compliance', `${compliance}%`, `${completedOrders}/${totalOrders} orders`], ['Completed on record', completedOrders, 'Completion date'], ['Overdue / critical', `${overdue} / ${critical}`, 'Attention'], ['Estimated hours', 'Not provided', 'Workbook field unavailable']]
    cards.forEach(([label, value, detail], index) => {
      const x = 16 + index * 53
      pdf.setFillColor(index === 3 && overdue ? 255 : 248, index === 3 && overdue ? 240 : 249, index === 3 && overdue ? 238 : 250); pdf.roundedRect(x, 61, 49, 22, 1.5, 1.5, 'F')
      pdf.setTextColor(76, 84, 92); pdf.setFontSize(7); pdf.text(label, x + 3, 67)
      pdf.setTextColor(index === 3 && overdue ? 178 : 34, index === 3 && overdue ? 65 : 79, index === 3 && overdue ? 58 : 122); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(value === 'Not provided' ? 8 : 13); pdf.text(String(value), x + 3, 75)
      pdf.setTextColor(120, 128, 136); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6); pdf.text(detail, x + 3, 80)
    })
  }
  const columns = [['Day', 16], ['Plan ID', 37], ['Equipment / tag', 62], ['Task / route', 91], ['Type', 151], ['Cycle', 174], ['Last execution', 195], ['Next due', 220], ['Priority', 244], ['Status', 264]]
  const drawTableHeader = (y) => {
    pdf.setFillColor(34, 79, 122); pdf.rect(16, y - 5, 265, 9, 'F'); pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6.5)
    columns.forEach(([label, x]) => pdf.text(label, x, y))
  }
  header(); drawFilters(); drawKpis(); pdf.setTextColor(34, 79, 122); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.text('MAINTENANCE TASK ROUTE', 16, 94); drawTableHeader(103)
  let row = 0
  plans.forEach((plan) => {
    if (row > 0 && row % 12 === 0) { footer(); pdf.addPage(); header(true); drawTableHeader(45); row = 0 }
    const dayIndex = plan.dayIndex ?? 0
    const day = weekDays[dayIndex]
    const y = (row === 0 ? 108 : 108) + row * 7
    const isAlert = plan.status === 'Overdue' || plan.completionRate === 0
    pdf.setFillColor(...(isAlert ? [255, 244, 242] : row % 2 ? [248, 250, 252] : [255, 255, 255])); pdf.rect(16, y - 5, 265, 7, 'F')
    pdf.setTextColor(isAlert ? 160 : 65, isAlert ? 60 : 73, isAlert ? 55 : 82); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.3)
    const values = [`${day?.label || ''} ${day?.date || ''}`, plan.planCode, plan.machine, plan.activity, 'Preventive', plan.frequency, plan.lastCompleted ? formatPrintDate(plan.lastCompleted) : 'Not completed', plan.lastScheduled ? formatPrintDate(plan.lastScheduled) : 'Planned', isAlert ? 'High' : 'Medium', plan.status]
    values.forEach((value, index) => pdf.text(String(value).slice(0, index === 3 ? 34 : 18), columns[index][1], y))
    row += 1
  })
  if (!plans.length) { pdf.setTextColor(100, 108, 116); pdf.setFontSize(9); pdf.text('No maintenance tasks match the active filters for this week.', 18, 112) }
  if (notes.length) { pdf.setTextColor(34, 79, 122); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.text('Operational notes', 16, Math.min(194, 114 + row * 7)); notes.slice(0, 8).forEach((note, index) => { pdf.setTextColor(80, 88, 96); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.text(`${weekDays[note.dayIndex]?.label || ''}: ${note.text}`.slice(0, 120), 18, Math.min(199, 121 + row * 7 + index * 5)) }) }
  footer(); pdf.putTotalPages(pageToken); pdf.save('maintenance-plan-technical-report.pdf')
}

function exportFullReportPdf({ dashboardReport, sourcePlans, timelinePlans, machine }) {
  if (!dashboardReport) {
    window.alert('Attach an Excel workbook in Dashboard before generating the full report.')
    return
  }
  const savedSchedule = JSON.parse(localStorage.getItem(maintenanceScheduleStorageKey) || '{}')
  const weekStart = savedSchedule.weekStart ? new Date(savedSchedule.weekStart) : getMonday(new Date('2026-09-10'))
  const scheduled = savedSchedule.scheduled || {}
  const notes = savedSchedule.notes || {}
  const weekDays = getWeekDays(weekStart)
  const weekKey = formatDateKey(weekStart)
  const weekPlans = Object.entries(scheduled).filter(([key]) => key.startsWith(`${weekKey}|`))
  const weekNotes = Object.values(notes).filter((note) => note.weekKey === weekKey)
  const criticalPlans = timelinePlans.filter((plan) => machine === 'All lines / machines' || plan.machine === machine)
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  exportDashboardPdf(dashboardReport, pdf, false)
  pdf.addPage()
  exportWeeklyPdf({ weekStart, weekDays, weekPlans, weekNotes, sourcePlans }, pdf, false)
  pdf.addPage()
  exportCriticalPdf(criticalPlans, pdf, false)
  pdf.save('fieldmark-full-maintenance-report.pdf')
}

function App() {
  const [activeView, setActiveView] = useState('Maintenance Plan View')
  const [tasks, setTasks] = useState(initialTasks)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All tasks')
  const [showModal, setShowModal] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [sourcePlans, setSourcePlans] = useState([])
  const [sourceLoading, setSourceLoading] = useState(true)
  const [sourceError, setSourceError] = useState('')
  const [sourceFileName, setSourceFileName] = useState('MAINTENANCE PLANS WITH ORDERS.XLSX')
  const [sourceUploadLoading, setSourceUploadLoading] = useState(false)
  const [dashboardReport, setDashboardReport] = useState(null)
  const [dashboardUploadError, setDashboardUploadError] = useState('')
  const [dashboardUploadLoading, setDashboardUploadLoading] = useState(false)
  const [timelinePlans, setTimelinePlans] = useState([])
  const [timelineLoading, setTimelineLoading] = useState(true)
  const [timelineError, setTimelineError] = useState('')
  const [timelineFileName, setTimelineFileName] = useState('MAINTENANCE PLANS WITH ORDERS.XLSX')
  const [logbookRecords, setLogbookRecords] = useState([])
  const [criticalReportPlans, setCriticalReportPlans] = useState([])
  useEffect(() => {
    try {
      const savedReport = localStorage.getItem(dashboardReportStorageKey)
      if (savedReport) setDashboardReport(JSON.parse(savedReport))
    } catch {
      localStorage.removeItem(dashboardReportStorageKey)
    }
  }, [])

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}MAINTENANCE%20PLANS%20WITH%20ORDERS.XLSX`)
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load the workbook')
        return response.arrayBuffer()
      })
      .then((buffer) => {
        setSourcePlans(normalizeWorkbook(buffer))
        setTimelinePlans(normalizeTimelineWorkbook(buffer))
        setLogbookRecords(normalizeLogbookRecords(buffer))
      })
      .catch(() => {
        setSourceError('The maintenance workbook could not be loaded.')
        setTimelineError('The maintenance workbook could not be loaded.')
      })
      .finally(() => {
        setSourceLoading(false)
        setTimelineLoading(false)
      })
  }, [])

  const handleTimelineUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setTimelineLoading(true)
    setTimelineError('')
    try {
      const buffer = await file.arrayBuffer()
      setTimelinePlans(normalizeTimelineWorkbook(buffer))
      setLogbookRecords(normalizeLogbookRecords(buffer))
      setSourcePlans(normalizeWorkbook(buffer))
      setTimelineFileName(file.name)
      setSourceFileName(file.name)
    } catch {
      setTimelineError('The selected file could not be analyzed. Check that it is a valid Excel workbook.')
    } finally {
      setTimelineLoading(false)
      event.target.value = ''
    }
  }

  const handleMaintenanceUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setSourceUploadLoading(true)
    setSourceError('')
    try {
      const buffer = await file.arrayBuffer()
      setSourcePlans(normalizeWorkbook(buffer))
      setTimelinePlans(normalizeTimelineWorkbook(buffer))
      setSourceFileName(file.name)
    } catch {
      setSourceError('The selected file could not be analyzed. Check that it is a valid Excel workbook.')
    } finally {
      setSourceUploadLoading(false)
      event.target.value = ''
    }
  }

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    const matchesQuery = `${task.title} ${task.asset} ${task.type}`.toLowerCase().includes(query.toLowerCase())
    const matchesFilter = filter === 'All tasks' || task.status === filter || task.priority === filter
    return matchesQuery && matchesFilter
  }), [tasks, query, filter])

  const markComplete = (id) => {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, status: 'Completed', due: 'Completed' } : task))
  }

  const navigate = (label) => {
    setActiveView(label)
    setMobileNav(false)
  }

  const handleDashboardUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setDashboardUploadLoading(true)
    setDashboardUploadError('')
    try {
      const report = analyzeDashboardWorkbook(await file.arrayBuffer(), file.name)
      setDashboardReport(report)
      localStorage.setItem(dashboardReportStorageKey, JSON.stringify(report))
    } catch (uploadError) {
      setDashboardUploadError('The selected file could not be analyzed. Check that it is a valid Excel workbook.')
    } finally {
      setDashboardUploadLoading(false)
      event.target.value = ''
    }
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark"><Wrench size={17} strokeWidth={2.5} /></div>
          <span>Maintenance Planning</span>
          <button className="mobile-close icon-button" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={19} /></button>
        </div>
        <div className="nav-label">Workspace</div>
        <nav>
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${activeView === label ? 'active' : ''}`} onClick={() => navigate(label)}>
              <Icon size={17} /><span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        <header className="topbar no-print">
          <button className="mobile-menu icon-button" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <div className="breadcrumbs"><strong>{activeView}</strong></div>
        </header>

        {activeView === 'Logbook' ? (
          <Logbook
            records={logbookRecords}
            loading={timelineLoading}
            error={timelineError}
            fileName={timelineFileName}
            onUpload={handleTimelineUpload}
          />
        ) : activeView === 'Priority Portal' ? (
          <PriorityPortal />
        ) : (
          <MaintenancePlanDashboard
            plans={timelinePlans}
            loading={timelineLoading}
            error={timelineError}
            fileName={timelineFileName}
            onUpload={handleTimelineUpload}
            onExport={(plans, line, notes, shutdownDate) => {
              setCriticalReportPlans(plans)
              exportPlanDashboardPdf({ plans, line, notes, shutdownDate })
            }}
          />
        )}
      </main>
      {showModal && <AddTaskModal onClose={() => setShowModal(false)} onAdd={(newTask) => { setTasks((current) => [{ ...newTask, id: Date.now() }, ...current]); setShowModal(false) }} />}
    </div>
  )
}

const priorityMeta = {
  P1: { label: 'Critical', tone: 'red', description: 'Immediate attention' },
  P2: { label: 'Important', tone: 'orange', description: 'Plan this week' },
  P3: { label: 'Backlog', tone: 'blue', description: 'Keep moving' },
}

function loadPriorityTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(priorityTasksStorageKey) || '[]')
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

function savePriorityTasks(tasks) {
  try { localStorage.setItem(priorityTasksStorageKey, JSON.stringify(tasks)) } catch {}
}

function daysSinceCreation(dateStr) {
  const created = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(created.getTime())) return 0
  return Math.max(0, Math.floor((new Date() - created) / 86400000))
}

function refreshPriorityOverdue(tasks) {
  return tasks.map((task) => ({
    ...task,
    daysOverdue: task.status === 'completed' ? 0 : daysSinceCreation(task.createdDate),
  }))
}

function similarityScore(a, b) {
  const wordsA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean))
  const wordsB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean))
  if (!wordsA.size || !wordsB.size) return 0
  let overlap = 0
  wordsA.forEach((word) => { if (wordsB.has(word)) overlap += 1 })
  return overlap / Math.max(wordsA.size, wordsB.size)
}

function inferPriorityFromText(text) {
  const lowered = text.toLowerCase()
  if (/(urgent|critical|today|asap|blocked|incident|down)/.test(lowered)) return 'P1'
  if (/(important|soon|this week|deadline)/.test(lowered)) return 'P2'
  return 'P3'
}

function localFallbackParse(dump) {
  const chunks = dump.split(/\n+|;+/).map((chunk) => chunk.replace(/^[\s\-•\t]+/, '').trim()).filter(Boolean)
  return chunks.map((chunk) => {
    const [firstPart, ...rest] = chunk.split(':')
    const title = (firstPart || chunk).trim().slice(0, 120)
    const actionStep = rest.length ? rest.join(':').trim().slice(0, 240) : `Define the first practical step for: ${chunk}.`.slice(0, 240)
    return {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: title.charAt(0).toUpperCase() + title.slice(1),
      actionStep,
      priority: inferPriorityFromText(chunk),
      estimatedTime: '30 min',
      createdDate: new Date().toISOString().slice(0, 10),
      status: 'pending',
      daysOverdue: 0,
      repeatCount: 1,
    }
  })
}

async function extractTasksWithGemini(dump, pendingTasks, apiKey) {
  if (!apiKey) return { tasks: localFallbackParse(dump), source: 'Local parser (no API key set)' }
  const prompt = `You are an executive productivity assistant.
Analyze the user's brain dump and extract only actionable tasks.
Return ONLY valid JSON with this exact shape: {"tasks": [{"title": "...", "actionStep": "...", "priority": "P1|P2|P3", "estimatedTime": "..."}]}
Rules: write every field in English; keep titles concise; P1 means urgent or high consequence, P2 means important, P3 means useful but deferrable; do not invent tasks.
Brain dump:
${dump}

Existing pending tasks for context. Avoid duplicating an existing task unless the brain dump clearly repeats it:
${JSON.stringify(pendingTasks.map((task) => task.title))}`

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    })
    if (!response.ok) throw new Error(`Gemini request failed with status ${response.status}`)
    const payload = await response.json()
    const rawText = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text).join('') || ''
    const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    const tasks = (parsed.tasks || []).map((task) => ({
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: String(task.title || 'Untitled task').trim(),
      actionStep: String(task.actionStep || 'Define the first practical action.').trim(),
      priority: ['P1', 'P2', 'P3'].includes(task.priority) ? task.priority : 'P2',
      estimatedTime: String(task.estimatedTime || '30 min').trim(),
      createdDate: new Date().toISOString().slice(0, 10),
      status: 'pending',
      daysOverdue: 0,
      repeatCount: 1,
    }))
    if (!tasks.length) throw new Error('Gemini returned no tasks')
    return { tasks, source: 'Gemini · gemini-2.5-flash' }
  } catch (error) {
    return { tasks: localFallbackParse(dump), source: 'Local parser (Gemini unavailable)' }
  }
}

function mergePriorityTasks(existing, extracted) {
  const result = existing.map((task) => ({ ...task }))
  extracted.forEach((incoming) => {
    const match = result.find((task) => task.status === 'pending' && similarityScore(task.title, incoming.title) >= 0.55)
    if (match) {
      match.repeatCount = (match.repeatCount || 1) + 1
      match.daysOverdue = Math.max(match.daysOverdue || 0, incoming.daysOverdue || 0)
      if (incoming.priority === 'P1') match.priority = 'P1'
    } else {
      result.push(incoming)
    }
  })
  return result
}

function PriorityPortal() {
  const [tasks, setTasks] = useState(() => refreshPriorityOverdue(loadPriorityTasks()))
  const [dump, setDump] = useState('')
  const [apiKey, setApiKey] = useState(() => { try { return localStorage.getItem(geminiApiKeyStorageKey) || '' } catch { return '' } })
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [showApiKeyPanel, setShowApiKeyPanel] = useState(false)
  const [loading, setLoading] = useState(false)
  const [lastSource, setLastSource] = useState('Waiting for analysis')
  const [activeTab, setActiveTab] = useState('All active')

  useEffect(() => { savePriorityTasks(tasks) }, [tasks])

  const pending = useMemo(() => tasks.filter((task) => task.status === 'pending'), [tasks])
  const completed = useMemo(() => tasks.filter((task) => task.status === 'completed'), [tasks])
  const critical = useMemo(() => pending.filter((task) => task.priority === 'P1'), [pending])
  const accumulatedDays = useMemo(() => pending.reduce((sum, task) => sum + (task.daysOverdue || 0), 0), [pending])

  const tabs = ['All active', 'P1 · Critical', 'P2 · Important', 'P3 · Backlog', 'Completed']
  const visibleTasks = useMemo(() => {
    if (activeTab === 'Completed') return completed
    if (activeTab === 'P1 · Critical') return pending.filter((task) => task.priority === 'P1')
    if (activeTab === 'P2 · Important') return pending.filter((task) => task.priority === 'P2')
    if (activeTab === 'P3 · Backlog') return pending.filter((task) => task.priority === 'P3')
    return pending
  }, [activeTab, pending, completed])

  const sortedVisibleTasks = useMemo(
    () => [...visibleTasks].sort((a, b) => (a.priority > b.priority ? 1 : a.priority < b.priority ? -1 : (b.daysOverdue || 0) - (a.daysOverdue || 0))),
    [visibleTasks],
  )

  const handleSaveApiKey = () => {
    const trimmed = apiKeyDraft.trim()
    setApiKey(trimmed)
    try { localStorage.setItem(geminiApiKeyStorageKey, trimmed) } catch {}
    setApiKeyDraft('')
    setShowApiKeyPanel(false)
  }

  const handleClearApiKey = () => {
    setApiKey('')
    try { localStorage.removeItem(geminiApiKeyStorageKey) } catch {}
  }

  const handleAnalyze = async () => {
    if (!dump.trim()) return
    setLoading(true)
    try {
      const { tasks: extracted, source } = await extractTasksWithGemini(dump, pending, apiKey)
      if (extracted.length) {
        setTasks(refreshPriorityOverdue(mergePriorityTasks(tasks, extracted)))
        setLastSource(`${source} · ${extracted.length} extracted task${extracted.length === 1 ? '' : 's'}`)
        setDump('')
      } else {
        setLastSource('No actionable tasks were found in that note.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = (id) => {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, status: 'completed', daysOverdue: 0 } : task))
  }

  const handleReopen = (id) => {
    setTasks((current) => refreshPriorityOverdue(current.map((task) => task.id === id ? { ...task, status: 'pending' } : task)))
  }

  const handleDelete = (id) => {
    setTasks((current) => current.filter((task) => task.id !== id))
  }

  return (
    <div className="page-wrap plan-dashboard-page priority-portal-page">
      <div className="plan-dashboard-head">
        <div>
          <div className="eyebrow">AI-assisted personal productivity</div>
          <h1>Priority Portal</h1>
          <p>Turn unstructured notes into a focused, actionable priority queue.</p>
        </div>
        <div className="intro-actions no-print">
          <button className="button button-secondary" onClick={() => setShowApiKeyPanel((current) => !current)}>
            <KeyRound size={15} />{apiKey ? 'Gemini key set' : 'Set Gemini key'}
          </button>
        </div>
      </div>

      <div className="plan-source-strip">
        <div className="file-icon">AI</div>
        <div>
          <strong>{apiKey ? 'Gemini · gemini-2.5-flash' : 'Local parser (no API key set)'}</strong>
          <span>{lastSource}</span>
        </div>
        <span className="live-pill"><i />{apiKey ? 'Gemini' : 'Local'}</span>
      </div>

      {showApiKeyPanel && (
        <section className="plan-filter-panel no-print">
          <div className="filter-title">
            <KeyRound size={16} />
            <strong>Gemini API Key</strong>
            <span>Stored only in this browser's local storage · never committed or sent anywhere except Google's API.</span>
          </div>
          <div className="plan-filter-controls">
            <label>
              <span>API key</span>
              <div className="select-wrap">
                <input
                  type="password"
                  value={apiKeyDraft}
                  onChange={(event) => setApiKeyDraft(event.target.value)}
                  placeholder="Paste your Gemini API key"
                  style={{ border: 0, outline: 0, width: '100%', background: 'transparent' }}
                />
              </div>
            </label>
            <button className="button button-primary" disabled={!apiKeyDraft.trim()} onClick={handleSaveApiKey}>Save key</button>
            {apiKey && <button className="button button-secondary" onClick={handleClearApiKey}>Remove key</button>}
          </div>
        </section>
      )}

      <div className="plan-kpi-grid" style={{ marginTop: 0, marginBottom: 18 }}>
        <PlanKpi icon={AlertTriangle} label="Critical tasks" value={critical.length} tone="red" detail="P1 attention" />
        <PlanKpi icon={Clock3} label="Accumulated days" value={accumulatedDays} tone="orange" detail="Across pending work" />
        <PlanKpi icon={ClipboardCheck} label="Pending tasks" value={pending.length} tone="blue" detail="All active tasks" />
        <PlanKpi icon={Check} label="Completed tasks" value={completed.length} tone="green" detail="Closed items" />
      </div>

      <section className="plan-filter-panel no-print">
        <div className="filter-title">
          <Sparkles size={16} />
          <strong>Brain Dump</strong>
          <span>Write naturally — the assistant extracts action items, priority, and estimates.</span>
        </div>
        <textarea
          className="notes-textarea"
          rows={4}
          value={dump}
          onChange={(event) => setDump(event.target.value)}
          placeholder="Example: The safety audit is blocking the line restart. I need to call maintenance, review the open permit, and send the updated checklist before Friday."
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <button className="button button-primary" disabled={!dump.trim() || loading} onClick={handleAnalyze}>
            <Zap size={15} />{loading ? 'Analyzing...' : 'Analyze Brain Dump'}
          </button>
        </div>
      </section>

      <div className="dashboard-section-heading">
        <div>
          <span className="section-kicker">Priority queue</span>
          <h2>{activeTab}</h2>
          <p>P1 is immediate attention, P2 is important this week, and P3 is useful backlog work.</p>
        </div>
        <span className="scope-count">{sortedVisibleTasks.length}</span>
      </div>

      <div className="priority-tabs no-print">
        {tabs.map((tab) => (
          <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>
        ))}
      </div>

      <div className="maintenance-plan-cards priority-task-cards">
        {sortedVisibleTasks.map((task) => (
          <PriorityTaskCard key={task.id} task={task} onComplete={handleComplete} onReopen={handleReopen} onDelete={handleDelete} />
        ))}
        {!sortedVisibleTasks.length && <div className="empty-dashboard">No tasks in this view.</div>}
      </div>
    </div>
  )
}

function PriorityTaskCard({ task, onComplete, onReopen, onDelete }) {
  const meta = priorityMeta[task.priority] || priorityMeta.P2
  const isCompleted = task.status === 'completed'
  return (
    <article className={`maintenance-plan-card priority-task-card card-${isCompleted ? 'on-track' : task.priority === 'P1' ? 'critical' : task.priority === 'P2' ? 'overdue' : 'due-soon'}`}>
      <div className="plan-card-top">
        <span className="plan-frequency">{meta.label}</span>
        <span className={`plan-state state-${isCompleted ? 'on-track' : task.priority === 'P1' ? 'critical' : task.priority === 'P2' ? 'overdue' : 'due-soon'}`}><i />{task.priority}</span>
      </div>
      <h3>{task.title}</h3>
      <p>{task.actionStep}</p>
      <div className="plan-card-meta">
        <span><small>Estimate</small><strong>{task.estimatedTime}</strong></span>
        <span><small>Created</small><strong>{task.createdDate}</strong></span>
      </div>
      {task.daysOverdue > 0 && !isCompleted && <div className="delay-badge"><AlertTriangle size={13} />{task.daysOverdue} days accumulated</div>}
      <div className="priority-task-footer no-print">
        <span className="repeat-tag">Repeated {task.repeatCount || 1}x</span>
        <div className="priority-task-actions">
          {isCompleted ? (
            <button className="button button-secondary note-small-btn" onClick={() => onReopen(task.id)}><RotateCcw size={13} />Reopen</button>
          ) : (
            <button className="button button-primary note-small-btn" onClick={() => onComplete(task.id)}><Check size={13} />Complete</button>
          )}
          <button className="icon-button note-action-btn note-delete-btn" onClick={() => onDelete(task.id)} aria-label="Delete task" title="Delete task"><Trash2 size={13} /></button>
        </div>
      </div>
    </article>
  )
}

function CriticalPrintReport({ plans }) {
  const ordered = [...plans].sort((a, b) => ['Low risk', 'Medium risk', 'High risk', 'Critical'].indexOf(a.riskStage) - ['Low risk', 'Medium risk', 'High risk', 'Critical'].indexOf(b.riskStage))
  const counts = { total: plans.length, critical: plans.filter((plan) => plan.riskStage === 'Critical').length, overdue: plans.filter((plan) => plan.criticality === 'Overdue').length, completed: plans.filter((plan) => plan.completedOrders === plan.totalOrders && plan.totalOrders > 0).length }
  return <article className="critical-print-report"><header><span>MAINTENANCE PLANNING · MAINTENANCE INTELLIGENCE</span><h1>Critical maintenance matrix</h1><p>Activities ordered from low risk to critical</p></header><div className="critical-print-summary"><div><strong>{counts.total}</strong><span>Total plans</span></div><div><strong>{counts.critical}</strong><span>Critical</span></div><div><strong>{counts.overdue}</strong><span>Overdue</span></div><div><strong>{counts.completed}</strong><span>Fully completed</span></div></div><div className="critical-print-grid"><div className="critical-print-header"><strong>Activity</strong><strong>Low risk</strong><strong>Medium risk</strong><strong>High risk</strong><strong>Critical</strong><strong>Overall / completion</strong></div>{ordered.map((plan) => { const completionRate = plan.totalOrders ? Math.round((plan.completedOrders / plan.totalOrders) * 100) : 0; return <div className={`critical-print-row risk-${plan.riskStage.toLowerCase().replace(' ', '-')}`} key={plan.id}><div><strong>{plan.activity}</strong><span>{plan.machine} · {plan.frequency} · Plan {plan.planCode}</span><i><b style={{ width: `${completionRate}%` }} /></i></div>{['Low risk', 'Medium risk', 'High risk', 'Critical'].map((stage) => <div className={plan.riskStage === stage ? 'print-risk-active' : ''} key={stage}>{plan.riskStage === stage ? `${plan.delayDays > 0 ? `${plan.delayDays}d late` : 'Completed'}` : ''}</div>)}<div><ActivityGauge value={completionRate} /><span>{plan.criticality}</span></div></div>})}</div><footer>Generated from {plans.length} maintenance plans · Completion is based on Completion date</footer></article>
}

function DashboardPrintReport({ report }) {
  return <article className="dashboard-print-report"><header><span>MAINTENANCE PLANNING · OPERATIONS</span><h1>Maintenance dashboard report</h1><p>{report.fileName} · {report.total.toLocaleString()} records analyzed</p></header><div className="dashboard-print-cards"><div><strong>{report.completed.toLocaleString()}</strong><span>Completed orders</span></div><div><strong>{report.pending.toLocaleString()}</strong><span>Not completed</span></div><div><strong>{report.rate}%</strong><span>Overall compliance</span></div><div><strong>{report.machines.filter((machine) => machine.priority).length}</strong><span>Priority machines</span></div></div><div className="dashboard-print-charts"><section><h2>Completed vs not completed</h2><OverallCompletionChart report={report} /></section><PlanStatusBars report={report} /></div><section className="dashboard-print-evolution"><h2>Monthly compliance evolution</h2><div className="print-months">{report.monthly.map((month) => <div key={month.label}><span>{month.label}</span><i style={{ height: `${Math.max(4, month.rate)}%` }} /><b>{month.rate}%</b></div>)}</div></section><footer>Generated from the uploaded maintenance workbook · Completion status is based on Completion date</footer></article>
}

function FullPrintReports({ dashboardReport, sourcePlans, timelinePlans, machine }) {
  if (!dashboardReport) return null
  let savedSchedule = {}
  try { savedSchedule = JSON.parse(localStorage.getItem(maintenanceScheduleStorageKey) || '{}') } catch {}
  const weekStart = savedSchedule.weekStart ? new Date(savedSchedule.weekStart) : getMonday(new Date('2026-09-10'))
  const weekDays = getWeekDays(weekStart)
  const weekKey = formatDateKey(weekStart)
  const scheduled = savedSchedule.scheduled || {}
  const notes = savedSchedule.notes || {}
  const weekPlans = Object.entries(scheduled).filter(([key]) => key.startsWith(`${weekKey}|`))
  const weekNotes = Object.values(notes).filter((note) => note.weekKey === weekKey)
  const criticalPlans = timelinePlans.filter((plan) => machine === 'All lines / machines' || plan.machine === machine)
  return <section className="full-print-reports"><DashboardPrintReport report={dashboardReport} /><MaintenancePrintReport weekStart={weekStart} weekDays={weekDays} weekPlans={weekPlans} weekNotes={weekNotes} sourcePlans={sourcePlans} /><CriticalPrintReport plans={criticalPlans} /></section>
}

function normalizeWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: null })
  const grouped = new Map()
  rows.forEach((row) => {
    const rawDescription = String(row['Maintenance item description'] || '').trim()
    if (!rawDescription) return
    const separator = rawDescription.indexOf(' - ')
    const machine = separator > 0 ? rawDescription.slice(0, separator).trim() : 'General / site-wide'
    const activity = separator > 0 ? rawDescription.slice(separator + 3).trim() : rawDescription
    const key = `${row['Maintenance Plan'] || 'Unassigned'}|${rawDescription}`
    if (!grouped.has(key)) grouped.set(key, { rows: [], machine, activity, rawDescription, planCode: row['Maintenance Plan'] || 'Unassigned' })
    grouped.get(key).rows.push(row)
  })

  return [...grouped.values()].map((group, index) => {
    const scheduled = group.rows.map((row) => toDate(row['Scheduled start date'])).filter(Boolean).sort((a, b) => a - b)
    const completed = group.rows.map((row) => toDate(row['Completion date'])).filter(Boolean).sort((a, b) => b - a)
    const completionRate = group.rows.length ? Math.round((completed.length / group.rows.length) * 100) : 0
    const frequency = inferFrequency(group.rawDescription, scheduled)
    const lastScheduled = scheduled.at(-1)
    const lastCompleted = completed[0]
    const overdue = lastScheduled && !lastCompleted && lastScheduled < new Date('2026-09-10')
    return {
      id: `excel-${index}`,
      machine: group.machine,
      activity: group.activity,
      planCode: group.planCode,
      frequency,
      totalOrders: group.rows.length,
      completedOrders: completed.length,
      completionRate,
      firstScheduled: scheduled[0],
      lastScheduled,
      lastCompleted,
      status: overdue ? 'Overdue' : completionRate === 100 ? 'Completed' : 'Open',
      source: 'MAINTENANCE PLANS WITH ORDERS.XLSX',
    }
  }).sort((a, b) => a.machine.localeCompare(b.machine) || a.activity.localeCompare(b.activity))
}

function normalizeTimelineWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: null })
  const today = new Date()
  const groups = new Map()

  rows.forEach((row) => {
    const rawDescription = String(row['Maintenance item description'] || '').trim()
    if (!rawDescription) return
    const separator = rawDescription.indexOf(' - ')
    const machine = normalizeMachineName(separator > 0 ? rawDescription.slice(0, separator) : 'General / site-wide')
    const activity = separator > 0 ? rawDescription.slice(separator + 3).trim() : rawDescription
    const planCode = String(row['Maintenance Plan'] || 'Unassigned').trim()
    const key = `${planCode}|${rawDescription}`

    if (!groups.has(key)) {
      groups.set(key, { machine, activity, rawDescription, planCode, calls: [] })
    }
    const group = groups.get(key)
    const scheduledDate = toDate(row['Scheduled start date'])
    const completionDate = toDate(row['Completion date'])
    const order = String(row['Order'] || '').trim()
    const callNo = row['MntPlan Call No.']
    group.calls.push({ scheduledDate, completionDate, order, callNo })
  })

  return [...groups.values()].map((group, index) => {
    const scheduledDates = group.calls.map((c) => c.scheduledDate).filter(Boolean)
    const frequency = inferFrequency(group.rawDescription, scheduledDates)
    const periodDays = getPeriodDays(frequency)

    const completedCalls = group.calls
      .filter((c) => c.completionDate)
      .sort((a, b) => b.completionDate - a.completionDate)
    const lastCompleted = completedCalls[0]?.completionDate || null

    const uncompletedCalls = group.calls
      .filter((c) => !c.completionDate && c.scheduledDate)
      .sort((a, b) => a.scheduledDate - b.scheduledDate)

    const totalOrders = group.calls.length
    const completedOrders = completedCalls.length
    const completionRate = totalOrders ? Math.round((completedOrders / totalOrders) * 100) : 0

    let nextDue = null
    let daysOverdue = 0
    let criticality = 'On track'

    if (lastCompleted) {
      const nextDueFromCompletion = addPeriod(lastCompleted, frequency)
      const futureScheduledCall = uncompletedCalls.find((c) => c.scheduledDate > lastCompleted)
      nextDue = futureScheduledCall ? futureScheduledCall.scheduledDate : nextDueFromCompletion

      if (nextDue < today) {
        daysOverdue = Math.max(0, Math.floor((today - nextDue) / 86400000))
        criticality = daysOverdue > 30 ? 'Critical' : 'Overdue'
      } else {
        daysOverdue = 0
        const daysUntilDue = Math.floor((nextDue - today) / 86400000)
        criticality = daysUntilDue <= 14 ? 'Due soon' : 'On track'
      }
    } else {
      const earliestScheduled = uncompletedCalls[0]
      if (earliestScheduled) {
        nextDue = earliestScheduled.scheduledDate
        if (nextDue < today) {
          daysOverdue = Math.max(0, Math.floor((today - nextDue) / 86400000))
          criticality = daysOverdue > 30 ? 'Critical' : 'Overdue'
        } else {
          daysOverdue = 0
          const daysUntilDue = Math.floor((nextDue - today) / 86400000)
          criticality = daysUntilDue <= 14 ? 'Due soon' : 'On track'
        }
      } else {
        criticality = 'On track'
      }
    }

    const delayDays = daysOverdue
    const riskStage = criticality === 'Critical' ? 'Critical' : daysOverdue > 0 ? 'High risk' : criticality === 'Due soon' ? 'Medium risk' : 'Low risk'

    return {
      id: `timeline-${index}`,
      machine: group.machine,
      activity: group.activity,
      planCode: group.planCode,
      frequency,
      lastCompleted,
      lastScheduled: uncompletedCalls[0]?.scheduledDate || group.calls.map((c) => c.scheduledDate).filter(Boolean).sort((a, b) => b - a)[0] || null,
      nextDue,
      daysOverdue,
      delayDays,
      periodDays,
      totalOrders,
      completedOrders,
      completionRate,
      criticality,
      riskStage,
    }
  }).sort((a, b) => b.daysOverdue - a.daysOverdue || b.delayDays - a.delayDays || (a.nextDue || 0) - (b.nextDue || 0))
}

function normalizeLogbookRecords(buffer) {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' })
  return rows.map((row, index) => {
    const rawDescription = String(row['Maintenance item description'] || '').trim()
    const separator = rawDescription.indexOf(' - ')
    const machine = normalizeMachineName(separator > 0 ? rawDescription.slice(0, separator).trim() : 'General / site-wide')
    const activity = separator > 0 ? rawDescription.slice(separator + 3).trim() : rawDescription
    const scheduledDate = toDate(row['Scheduled start date'])
    const completionDate = toDate(row['Completion date'])
    const isCompleted = Boolean(completionDate)
    const isOverdue = scheduledDate && !completionDate && scheduledDate < new Date('2026-09-10')
    const status = isCompleted ? 'Completed' : isOverdue ? 'Overdue' : 'Scheduled'

    return {
      id: `log-${index + 1}`,
      rowNumber: index + 1,
      line: machine,
      itemCode: String(row['Maintenance item'] || '').trim() || '—',
      planCode: String(row['Maintenance Plan'] || '').trim() || 'Unassigned',
      strategy: String(row['Maintenance strategy'] || '').trim() || '—',
      description: rawDescription || '—',
      activity,
      callNo: row['MntPlan Call No.'] !== '' && row['MntPlan Call No.'] !== undefined ? String(row['MntPlan Call No.']) : '—',
      scheduledDate,
      completionDate,
      order: String(row['Order'] || '').trim() || '—',
      status,
    }
  })
}

function addPeriod(date, frequency) {
  if (!date) return null
  const next = new Date(date)
  if (frequency === 'Daily') next.setDate(next.getDate() + 1)
  else if (frequency === 'Weekly') next.setDate(next.getDate() + 7)
  else if (frequency === '6-Weekly') next.setDate(next.getDate() + 42)
  else if (frequency === 'Monthly') next.setMonth(next.getMonth() + 1)
  else if (frequency === 'Quarterly') next.setMonth(next.getMonth() + 3)
  else if (frequency === 'Biannual') next.setMonth(next.getMonth() + 6)
  else if (frequency === 'Annual') next.setFullYear(next.getFullYear() + 1)
  else next.setDate(next.getDate() + 30)
  return next
}

function getNextDueDate(date, frequency) {
  return addPeriod(date, frequency)
}

function getCriticality(daysOverdue) {
  if (daysOverdue > 30) return 'Critical'
  if (daysOverdue > 0) return 'Overdue'
  if (daysOverdue >= -14) return 'Due soon'
  return 'On track'
}

function getPeriodDays(frequency) {
  const map = { Daily: 1, Weekly: 7, '6-Weekly': 42, Monthly: 30, Quarterly: 91, Biannual: 182, Annual: 365 }
  return map[frequency] || 30
}

function getRiskStage(delayDays, periodDays, lastCompleted, lastScheduled) {
  if (!lastScheduled && !lastCompleted) return 'Low risk'
  if (delayDays > periodDays * 2 || delayDays > 30) return 'Critical'
  if (delayDays > 0) return 'High risk'
  return 'Low risk'
}

function toDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function inferFrequency(description, dates = []) {
  const text = (description || '').toLowerCase()
  if (text.includes('daily') || text.includes('day')) return 'Daily'
  if (text.includes('6 weekly') || text.includes('6 week')) return '6-Weekly'
  if (text.includes('weekly') || text.includes('week') || text.includes('ppm check') || text.includes('ppm of tyer')) return 'Weekly'
  if (text.includes('6 monthly') || text.includes('6 month') || text.includes('biannual') || text.includes('6m')) return 'Biannual'
  if (text.includes('3 monthly') || text.includes('3 month') || text.includes('quarter')) return 'Quarterly'
  if (text.includes('monthly') || text.includes('month')) return 'Monthly'
  if (text.includes('annual') || text.includes('annually') || text.includes('12m') || text.includes('12 month') || text.includes('year')) return 'Annual'
  if (dates.length > 1) {
    const intervals = dates.slice(1).map((date, index) => (date - dates[index]) / 86400000).filter((days) => days > 0)
    const average = intervals.length ? intervals.reduce((sum, days) => sum + days, 0) / intervals.length : 0
    if (average <= 9) return 'Weekly'
    if (average <= 45) return 'Monthly'
    if (average <= 110) return 'Quarterly'
    if (average <= 220) return 'Biannual'
  }
  return 'Annual'
}

function analyzeDashboardWorkbook(buffer, fileName) {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: null })
  const records = rows.map((row) => {
    const description = String(row['Maintenance item description'] || '').trim()
    const separator = description.indexOf(' - ')
    const machine = normalizeMachineName(separator > 0 ? description.slice(0, separator).trim() : 'General / site-wide')
    const scheduledDate = toDate(row['Scheduled start date'])
    const completionDate = toDate(row['Completion date'])
    return { machine, description, frequency: inferFrequency(description, scheduledDate ? [scheduledDate] : []), scheduledDate, completionDate }
  }).filter((record) => record.description)
  const completed = records.filter((record) => record.completionDate)
  const monthLabels = Array.from({ length: 12 }, (_, index) => new Date(2026, index, 1).toLocaleDateString('en-US', { month: 'short' }))
  const monthly = monthLabels.map((label, index) => {
    const monthRecords = records.filter((record) => (record.scheduledDate?.getMonth() ?? record.completionDate?.getMonth()) === index)
    const monthCompleted = monthRecords.filter((record) => record.completionDate).length
    return { label, total: monthRecords.length, completed: monthCompleted, rate: monthRecords.length ? Math.round((monthCompleted / monthRecords.length) * 100) : 0 }
  })
  const frequencies = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Biannual', 'Annual'].map((frequency) => {
    const items = records.filter((record) => record.frequency === frequency)
    const done = items.filter((record) => record.completionDate).length
    return { frequency, total: items.length, completed: done, rate: items.length ? Math.round((done / items.length) * 100) : 0 }
  }).filter((item) => item.total)
  const riskSummary = ['Low risk', 'Medium risk', 'High risk', 'Critical'].map((risk) => ({ risk, count: records.filter((record) => {
    const periodDays = getPeriodDays(record.frequency)
    const reference = record.scheduledDate
    const delay = reference ? Math.floor(((record.completionDate || new Date()) - reference) / 86400000) : 0
    return getRiskStage(delay, periodDays, record.completionDate, record.scheduledDate) === risk
  }).length })).filter((item) => item.count)
  const machineNames = [...new Set(records.map((record) => record.machine))].sort()
  const machines = machineNames.map((machine) => {
    const items = records.filter((record) => record.machine === machine)
    const done = items.filter((record) => record.completionDate).length
    return { machine, total: items.length, completed: done, rate: items.length ? Math.round((done / items.length) * 100) : 0, priority: ['EMBA', 'Gopfert', '205'].some((priorityMachine) => machine.toLowerCase().includes(priorityMachine.toLowerCase())) }
  }).sort((a, b) => b.rate - a.rate || b.completed - a.completed || a.machine.localeCompare(b.machine))
  return { fileName, total: records.length, completed: completed.length, pending: records.length - completed.length, rate: records.length ? Math.round((completed.length / records.length) * 100) : 0, monthly, frequencies, machines, riskSummary }
}

function normalizeMachineName(machine) {
  const value = machine.trim()
  if (/^(gop|gopfert)$/i.test(value)) return 'Gopfert (GOP)'
  return value
}

function PageIntro({ eyebrow, title, description, action }) {
  return <div className="page-intro"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>
}

function Dashboard({ tasks, report, uploadError, uploading, onUpload, onNavigate, onComplete }) {
  const dueToday = tasks.filter((task) => task.due === 'Today').length
  const completed = tasks.filter((task) => task.status === 'Completed').length
  const visibleTasks = tasks.filter((task) => task.status !== 'Completed').slice(0, 4)
  return <div className="page-wrap">
    <PageIntro eyebrow="Thursday, September 10, 2026" title="Good morning, Jordan" description="Upload a maintenance workbook to refresh the operational indicators." action={<div className="dashboard-actions"><label className="button button-primary upload-button"><Upload size={17} />{uploading ? 'Analyzing...' : 'Attach Excel'}<input type="file" accept=".xlsx,.xls" onChange={onUpload} /></label></div>} />
    {uploadError && <div className="upload-error"><AlertTriangle size={15} />{uploadError}</div>}
    {report ? <DashboardReport report={report} /> : <div className="upload-empty"><Upload size={25} /><div><strong>No analysis file attached</strong><p>Attach an Excel workbook to see completion, frequency, machine, and monthly compliance indicators.</p></div></div>}
    {!report && <div className="dashboard-grid dashboard-status-only"><section className="panel status-panel"><div className="panel-heading"><div><h2>Plan status</h2><p>Maintenance by type</p></div><button className="icon-button"><MoreHorizontal size={18} /></button></div><div className="donut-wrap"><div className="donut"><div><strong>84%</strong><span>Complete</span></div></div></div><div className="legend"><LegendItem color="var(--green)" label="Preventive" value="62%" /><LegendItem color="var(--blue)" label="Compliance" value="18%" /><LegendItem color="var(--orange)" label="Calibration" value="12%" /><LegendItem color="#dfe4e0" label="Other" value="8%" /></div></section></div>}
    <section className="panel insight-panel"><div className="insight-icon"><Sparkles size={20} /></div><div><h2>One small win this week</h2><p>Preventive maintenance completion is up <strong>6.2%</strong> from last month. Keeping the current rhythm should put your team on track for a record quarter.</p></div><button className="icon-button"><ArrowUpRight size={18} /></button></section>
  </div>
}

function MaintenancePlanDashboard({ plans, loading, error, fileName, onUpload, onExport }) {
  const [lineFilter, setLineFilter] = useState('All production lines')
  const [showReportModal, setShowReportModal] = useState(false)
  const [teamNotes, setTeamNotes] = useState(() => {
    try {
      const saved = localStorage.getItem(teamNotesStorageKey)
      return saved ? JSON.parse(saved) : [
        {
          id: 'note-default-1',
          text: 'Shift Handover: Ensure full safety interlock check before starting scheduled PM.',
          line: 'All production lines',
          createdAt: new Date().toISOString(),
        },
      ]
    } catch {
      return []
    }
  })
  const [newNoteText, setNewNoteText] = useState('')
  const [newNoteLine, setNewNoteLine] = useState('Current line')
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [editingNoteText, setEditingNoteText] = useState('')

  useEffect(() => {
    try {
      localStorage.setItem(teamNotesStorageKey, JSON.stringify(teamNotes))
    } catch {}
  }, [teamNotes])

  const machines = useMemo(() => [...new Set(plans.map((plan) => plan.machine))].sort(), [plans])
  const visiblePlans = useMemo(() => plans.filter((plan) => lineFilter === 'All production lines' || plan.machine === lineFilter), [plans, lineFilter])
  const prioritizedPlans = useMemo(() => [...visiblePlans].sort((a, b) => b.daysOverdue - a.daysOverdue || b.delayDays - a.delayDays || (a.nextDue || 0) - (b.nextDue || 0)), [visiblePlans])

  const filteredNotes = useMemo(() => {
    return teamNotes.filter((n) => lineFilter === 'All production lines' || n.line === 'All production lines' || n.line === lineFilter)
  }, [teamNotes, lineFilter])

  const handleAddNote = (e) => {
    if (e) e.preventDefault()
    const trimmed = newNoteText.trim()
    if (!trimmed) return
    const note = {
      id: `note-${Date.now()}`,
      text: trimmed,
      line: newNoteLine === 'Current line' ? lineFilter : 'All production lines',
      createdAt: new Date().toISOString(),
    }
    setTeamNotes((prev) => [note, ...prev])
    setNewNoteText('')
  }

  const handleDeleteNote = (id) => {
    setTeamNotes((prev) => prev.filter((n) => n.id !== id))
  }

  const handleStartEdit = (note) => {
    setEditingNoteId(note.id)
    setEditingNoteText(note.text)
  }

  const handleSaveEdit = (id) => {
    const trimmed = editingNoteText.trim()
    if (!trimmed) return
    setTeamNotes((prev) => prev.map((n) => n.id === id ? { ...n, text: trimmed, updatedAt: new Date().toISOString() } : n))
    setEditingNoteId(null)
    setEditingNoteText('')
  }

  const handleCancelEdit = () => {
    setEditingNoteId(null)
    setEditingNoteText('')
  }

  if (loading) return <div className="page-wrap loading-state"><div className="loading-spinner" /><h2>Reading maintenance dashboard</h2><p>Preparing equipment plans, execution history, and priorities.</p></div>
  if (error) return <div className="page-wrap loading-state"><AlertTriangle size={28} /><h2>Workbook unavailable</h2><p>{error}</p></div>

  return <div className="page-wrap plan-dashboard-page">
    <div className="plan-dashboard-head">
      <div>
        <div className="eyebrow">Maintenance intelligence / live plan control</div>
        <h1>Maintenance Plan Dashboard</h1>
        <p>Operational monitoring by equipment and production line.</p>
      </div>
      <div className="intro-actions no-print">
        <label className="button button-primary upload-button"><Upload size={17} />Upload Excel<input type="file" accept=".xlsx,.xls" onChange={onUpload} /></label>
        <button className="button button-secondary" onClick={() => setShowReportModal(true)}><FileDown size={15} />Report</button>
      </div>
    </div>
    <div className="plan-source-strip">
      <div className="file-icon">XLS</div>
      <div>
        <strong>{fileName}</strong>
        <span>{plans.length} plans analyzed · execution and due dates</span>
      </div>
      <span className="live-pill"><i />Live</span>
    </div>
    <section className="plan-filter-panel no-print">
      <div className="filter-title">
        <SlidersHorizontal size={16} />
        <strong>Operation Filters</strong>
        <span>Filter maintenance plans by line.</span>
      </div>
      <div className="plan-filter-controls">
        <label>
          <span>Production line</span>
          <div className="select-wrap">
            <Filter size={15} />
            <select value={lineFilter} onChange={(event) => setLineFilter(event.target.value)}>
              <option>All production lines</option>
              {machines.map((machine) => <option key={machine}>{machine}</option>)}
            </select>
            <ChevronDown size={14} />
          </div>
        </label>
        <div className="filter-result">
          <small>Current scope</small>
          <strong>{lineFilter}</strong>
          <span>{visiblePlans.length} maintenance plans · {filteredNotes.length} team notes</span>
        </div>
      </div>
    </section>

    <div className="plan-dashboard-layout">
      <main className="plan-dashboard-main">
        {/* Team Notes Section */}
        <section className="team-notes-section">
          <div className="team-notes-creator no-print">
            <div className="notes-creator-header">
              <div className="notes-creator-title">
                <StickyNote size={15} />
                <strong>Team Operational Notes & Shift Messages</strong>
              </div>
              <div className="notes-target-picker">
                <span>Scope:</span>
                <select value={newNoteLine} onChange={(e) => setNewNoteLine(e.target.value)}>
                  <option value="Current line">Current Line ({lineFilter === 'All production lines' ? 'All Lines' : lineFilter})</option>
                  <option value="All production lines">Global (All Lines)</option>
                </select>
              </div>
            </div>
            <div className="notes-input-row">
              <textarea
                className="notes-textarea"
                placeholder="Type an operational note, shift handover, or priority instruction for the team..."
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    handleAddNote(e)
                  }
                }}
                rows={2}
              />
              <button
                className="button button-primary add-note-submit-btn"
                disabled={!newNoteText.trim()}
                onClick={handleAddNote}
              >
                <Plus size={15} /> Add Note
              </button>
            </div>
          </div>

          {filteredNotes.length > 0 && (
            <div className="team-notes-list">
              {filteredNotes.map((note) => (
                <article key={note.id} className="team-note-card">
                  <div className="team-note-card-top">
                    <div className="team-note-meta">
                      <span className="team-note-line-tag">
                        <StickyNote size={12} />
                        {note.line === 'All production lines' ? 'Global Note' : note.line}
                      </span>
                      <small className="team-note-date">
                        {new Date(note.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </small>
                    </div>
                    <div className="team-note-actions no-print">
                      {editingNoteId === note.id ? (
                        <>
                          <button
                            className="icon-button note-action-btn note-save-btn"
                            onClick={() => handleSaveEdit(note.id)}
                            title="Save note"
                            aria-label="Save note"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            className="icon-button note-action-btn note-cancel-btn"
                            onClick={handleCancelEdit}
                            title="Cancel editing"
                            aria-label="Cancel editing"
                          >
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="icon-button note-action-btn note-edit-btn"
                            onClick={() => handleStartEdit(note)}
                            title="Edit note"
                            aria-label="Edit note"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            className="icon-button note-action-btn note-delete-btn"
                            onClick={() => handleDeleteNote(note.id)}
                            title="Delete note"
                            aria-label="Delete note"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {editingNoteId === note.id ? (
                    <div className="team-note-inline-edit">
                      <textarea
                        value={editingNoteText}
                        onChange={(e) => setEditingNoteText(e.target.value)}
                        rows={2}
                        autoFocus
                      />
                      <div className="team-note-edit-buttons">
                        <button className="button button-primary note-small-btn" onClick={() => handleSaveEdit(note.id)}>
                          Save Note
                        </button>
                        <button className="button button-secondary note-small-btn" onClick={handleCancelEdit}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="team-note-body">{note.text}</p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="dashboard-section-heading">
          <div>
            <span className="section-kicker">Plan portfolio</span>
            <h2>{lineFilter}</h2>
            <p>Cards ordered by urgency, with overdue activities first.</p>
          </div>
          <span className="scope-count">{visiblePlans.length} plans</span>
        </div>
        <div className="maintenance-plan-cards">
          {prioritizedPlans.slice(0, 12).map((plan) => <MaintenancePlanCard key={plan.id} plan={plan} />)}
          {!visiblePlans.length && <div className="empty-dashboard">No plans match the selected filter.</div>}
        </div>
      </main>
      <aside className="priority-panel">
        <div className="priority-panel-heading">
          <div>
            <span className="section-kicker">Priority queue</span>
            <h2>Prioritized activities</h2>
            <p>Criticality and delay order</p>
          </div>
          <span className="priority-count">{prioritizedPlans.length}</span>
        </div>
        <div className="priority-list">
          {prioritizedPlans.slice(0, 10).map((plan, index) => <PriorityActivity key={plan.id} plan={plan} rank={index + 1} />)}
          {!prioritizedPlans.length && <div className="empty-dashboard">No activities in scope.</div>}
        </div>
        <div className="priority-footer">
          <span><i className="status-dot status-red" />Most overdue first</span>
          <ArrowUpRight size={15} />
        </div>
      </aside>
    </div>

    {showReportModal && (
      <ReportShutdownModal
        line={lineFilter}
        plansCount={visiblePlans.length}
        onClose={() => setShowReportModal(false)}
        onGenerate={(shutdownDate) => {
          setShowReportModal(false)
          onExport(visiblePlans, lineFilter, filteredNotes, shutdownDate)
        }}
      />
    )}
  </div>
}

function Logbook({ records, loading, error, fileName, onUpload }) {
  const [lineFilter, setLineFilter] = useState('All production lines')
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const [searchQuery, setSearchQuery] = useState('')
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)

  const lines = useMemo(() => [...new Set(records.map((r) => r.line))].sort(), [records])

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const matchLine = lineFilter === 'All production lines' || record.line === lineFilter
      const matchStatus = statusFilter === 'All statuses' || record.status === statusFilter
      const query = searchQuery.trim().toLowerCase()
      const matchSearch = !query || (
        record.description.toLowerCase().includes(query) ||
        record.planCode.toLowerCase().includes(query) ||
        record.itemCode.toLowerCase().includes(query) ||
        record.order.toLowerCase().includes(query) ||
        record.line.toLowerCase().includes(query)
      )
      return matchLine && matchStatus && matchSearch
    })
  }, [records, lineFilter, statusFilter, searchQuery])

  const totalFiltered = filteredRecords.length
  const totalPages = pageSize === 'All' ? 1 : Math.max(1, Math.ceil(totalFiltered / Number(pageSize)))

  useEffect(() => {
    setCurrentPage(1)
  }, [lineFilter, statusFilter, searchQuery, pageSize])

  const paginatedRecords = useMemo(() => {
    if (pageSize === 'All') return filteredRecords
    const size = Number(pageSize)
    const start = (currentPage - 1) * size
    return filteredRecords.slice(start, start + size)
  }, [filteredRecords, currentPage, pageSize])

  const completedCount = useMemo(() => filteredRecords.filter((r) => r.status === 'Completed').length, [filteredRecords])
  const overdueCount = useMemo(() => filteredRecords.filter((r) => r.status === 'Overdue').length, [filteredRecords])
  const scheduledCount = useMemo(() => filteredRecords.filter((r) => r.status === 'Scheduled').length, [filteredRecords])
  const complianceRate = totalFiltered ? Math.round((completedCount / totalFiltered) * 100) : 0

  if (loading) return <div className="page-wrap loading-state"><div className="loading-spinner" /><h2>Reading maintenance logbook</h2><p>Preparing records, orders, and execution dates.</p></div>
  if (error) return <div className="page-wrap loading-state"><AlertTriangle size={28} /><h2>Workbook unavailable</h2><p>{error}</p></div>

  return (
    <div className="page-wrap logbook-page">
      <div className="plan-dashboard-head">
        <div>
          <div className="eyebrow">Maintenance log & complete history</div>
          <h1>Maintenance Logbook</h1>
          <p>Complete standardized list of all maintenance orders and items from the workbook.</p>
        </div>
        <div className="intro-actions no-print">
          <label className="button button-primary upload-button">
            <Upload size={17} />Upload Excel
            <input type="file" accept=".xlsx,.xls" onChange={onUpload} />
          </label>
          <button className="button button-secondary" onClick={() => exportLogbookCsv(filteredRecords, lineFilter)}>
            <Download size={15} />Export CSV
          </button>
          <button className="button button-secondary" onClick={() => window.print()}>
            <Printer size={15} />Print
          </button>
        </div>
      </div>

      <div className="plan-source-strip">
        <div className="file-icon">XLS</div>
        <div>
          <strong>{fileName}</strong>
          <span>{records.length.toLocaleString()} total workbook records · {totalFiltered.toLocaleString()} matching current filters</span>
        </div>
        <span className="live-pill"><i />Live log</span>
      </div>

      <div className="logbook-kpi-summary">
        <div className="logbook-kpi-card">
          <small>Total Records</small>
          <strong>{totalFiltered.toLocaleString()}</strong>
          <span>in current view</span>
        </div>
        <div className="logbook-kpi-card">
          <small>Completed</small>
          <strong className="kpi-green">{completedCount.toLocaleString()}</strong>
          <span>with completion date</span>
        </div>
        <div className="logbook-kpi-card">
          <small>Overdue</small>
          <strong className="kpi-red">{overdueCount.toLocaleString()}</strong>
          <span>scheduled past due</span>
        </div>
        <div className="logbook-kpi-card">
          <small>Scheduled</small>
          <strong className="kpi-blue">{scheduledCount.toLocaleString()}</strong>
          <span>pending / on track</span>
        </div>
        <div className="logbook-kpi-card">
          <small>Compliance Rate</small>
          <strong className="kpi-orange">{complianceRate}%</strong>
          <span>completed / total</span>
        </div>
      </div>

      <section className="plan-filter-panel no-print">
        <div className="filter-title">
          <SlidersHorizontal size={16} />
          <strong>Logbook Controls & Filters</strong>
          <span>Search and filter all rows by line, status, and keywords.</span>
        </div>
        <div className="logbook-filter-controls">
          <label className="logbook-search-label">
            <span>Search</span>
            <div className="search-field">
              <Search size={15} />
              <input
                type="text"
                placeholder="Search by description, plan, item, order..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="icon-button" onClick={() => setSearchQuery('')} aria-label="Clear search">
                  <X size={14} />
                </button>
              )}
            </div>
          </label>
          <label>
            <span>Production line</span>
            <div className="select-wrap">
              <Filter size={15} />
              <select value={lineFilter} onChange={(e) => setLineFilter(e.target.value)}>
                <option>All production lines</option>
                {lines.map((line) => <option key={line}>{line}</option>)}
              </select>
              <ChevronDown size={14} />
            </div>
          </label>
          <label>
            <span>Status</span>
            <div className="select-wrap">
              <ClipboardCheck size={15} />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option>All statuses</option>
                <option>Completed</option>
                <option>Overdue</option>
                <option>Scheduled</option>
              </select>
              <ChevronDown size={14} />
            </div>
          </label>
          <div className="filter-result">
            <small>Scope</small>
            <strong>{lineFilter === 'All production lines' ? 'All Lines' : lineFilter}</strong>
            <span>{totalFiltered.toLocaleString()} records found</span>
          </div>
        </div>
      </section>

      <div className="logbook-table-panel">
        <div className="logbook-table-wrapper">
          <table className="logbook-table">
            <thead>
              <tr>
                <th style={{ width: '45px' }}>#</th>
                <th style={{ width: '130px' }}>Line / Machine</th>
                <th style={{ width: '110px' }}>Plan Code</th>
                <th style={{ width: '90px' }}>Item Code</th>
                <th>Description / Task</th>
                <th style={{ width: '70px' }}>Call No.</th>
                <th style={{ width: '110px' }}>Scheduled Date</th>
                <th style={{ width: '110px' }}>Completion Date</th>
                <th style={{ width: '90px' }}>Order</th>
                <th style={{ width: '100px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRecords.map((r, i) => (
                <tr key={r.id} className={`logbook-row status-row-${r.status.toLowerCase()}`}>
                  <td className="logbook-cell-num">{pageSize === 'All' ? i + 1 : (currentPage - 1) * Number(pageSize) + i + 1}</td>
                  <td><span className="logbook-line-badge">{r.line}</span></td>
                  <td><code>{r.planCode}</code></td>
                  <td><span className="logbook-item-code">{r.itemCode}</span></td>
                  <td className="logbook-cell-desc"><strong>{r.description}</strong></td>
                  <td className="logbook-cell-center">{r.callNo}</td>
                  <td className="logbook-cell-date">{r.scheduledDate ? formatPrintDate(r.scheduledDate) : '—'}</td>
                  <td className="logbook-cell-date">{r.completionDate ? formatPrintDate(r.completionDate) : '—'}</td>
                  <td><code>{r.order}</code></td>
                  <td>
                    <span className={`logbook-status-badge badge-${r.status.toLowerCase()}`}>
                      <i />{r.status}
                    </span>
                  </td>
                </tr>
              ))}
              {!paginatedRecords.length && (
                <tr>
                  <td colSpan={10} className="empty-table-cell">
                    No logbook records match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="logbook-pagination-bar no-print">
          <div className="pagination-info">
            Showing <strong>{totalFiltered === 0 ? 0 : (currentPage - 1) * (pageSize === 'All' ? totalFiltered : Number(pageSize)) + 1}</strong> to <strong>{pageSize === 'All' ? totalFiltered : Math.min(totalFiltered, currentPage * Number(pageSize))}</strong> of <strong>{totalFiltered.toLocaleString()}</strong> records
          </div>
          <div className="pagination-controls">
            <div className="page-size-selector">
              <span>Rows per page:</span>
              <select value={pageSize} onChange={(e) => setPageSize(e.target.value)}>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="250">250</option>
                <option value="All">All</option>
              </select>
            </div>
            {pageSize !== 'All' && totalPages > 1 && (
              <div className="page-buttons">
                <button
                  className="icon-button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>
                <span>Page {currentPage} of {totalPages}</span>
                <button
                  className="icon-button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function MaintenancePlanCard({ plan }) {
  const isOverdue = plan.daysOverdue > 0
  const state = plan.criticality === 'Critical' ? 'Critical' : isOverdue ? 'Overdue' : plan.criticality === 'Due soon' ? 'Due soon' : 'On track'
  return (
    <article className={`maintenance-plan-card card-${state.toLowerCase().replace(' ', '-')}`}>
      <div className="plan-card-top">
        <span className="plan-frequency">{plan.frequency}</span>
        <span className={`plan-state state-${state.toLowerCase().replace(' ', '-')}`}>
          <i />
          {isOverdue ? `${plan.daysOverdue}d overdue` : state}
        </span>
      </div>
      <h3>{plan.activity}</h3>
      <div className="plan-card-tags">
        <span>{plan.machine}</span>
        <span>{plan.planCode}</span>
      </div>
      <p>Preventive maintenance activity based on the current execution cycle.</p>
      <div className="plan-card-meta">
        <span>
          <small>Last execution</small>
          <strong>{plan.lastCompleted ? formatPrintDate(plan.lastCompleted) : 'Not completed'}</strong>
        </span>
        <span>
          <small>Next planned</small>
          <strong>{plan.nextDue ? formatPrintDate(plan.nextDue) : 'To be planned'}</strong>
        </span>
      </div>
      {isOverdue && (
        <div className="delay-badge">
          <AlertTriangle size={13} />
          {plan.daysOverdue} days overdue
        </div>
      )}
      <div className="plan-card-progress">
        <i><em style={{ width: `${plan.completionRate}%` }} /></i>
      </div>
    </article>
  )
}

function PlanKpi({ icon: Icon, label, value, tone, detail }) {
  return <div className={`plan-kpi plan-kpi-${tone}`}><div className="plan-kpi-icon"><Icon size={17} /></div><div><strong>{value.toLocaleString()}</strong><span>{label}</span><small>{detail}</small></div></div>
}

function PriorityActivity({ plan, rank }) {
  const isOverdue = plan.daysOverdue > 0
  const tone = plan.criticality === 'Critical' ? 'critical' : isOverdue ? 'overdue' : plan.criticality === 'Due soon' ? 'soon' : 'planned'
  const Icon = tone === 'planned' ? CalendarDays : tone === 'soon' ? Clock3 : AlertTriangle
  return (
    <article className={`priority-activity priority-${tone}`}>
      <span className="priority-rank">{String(rank).padStart(2, '0')}</span>
      <div className="priority-icon"><Icon size={15} /></div>
      <div className="priority-activity-content">
        <strong>{plan.activity}</strong>
        <span>{plan.machine}</span>
        <small className={isOverdue ? 'overdue-text' : ''}>
          {isOverdue ? `${plan.daysOverdue} days overdue` : plan.nextDue ? `Due ${formatPrintDate(plan.nextDue)}` : 'Schedule pending'}
        </small>
      </div>
      <ArrowUpRight size={14} />
    </article>
  )
}

function PlanView({ plans, loading, error, fileName, onUpload, onExport }) {
  const [machineFilter, setMachineFilter] = useState('All lines / machines')
  const machines = useMemo(() => [...new Set(plans.map((plan) => plan.machine))].sort(), [plans])
    const visiblePlans = useMemo(() => plans.filter((plan) => machineFilter === 'All lines / machines' || plan.machine === machineFilter).sort((a, b) => b.daysOverdue - a.daysOverdue || a.machine.localeCompare(b.machine)), [plans, machineFilter])
  const timelineGroups = useMemo(() => visiblePlans.reduce((groups, plan) => {
    if (!groups[plan.machine]) groups[plan.machine] = []
    groups[plan.machine].push(plan)
    return groups
  }, {}), [visiblePlans])
  const criticalCount = visiblePlans.filter((plan) => plan.criticality === 'Critical').length
  const overdueCount = visiblePlans.filter((plan) => plan.criticality === 'Overdue').length
  const riskStages = ['Low risk', 'Medium risk', 'High risk', 'Critical']
  const plansByFrequency = useMemo(() => ['Weekly', 'Monthly', 'Quarterly', 'Biannual', 'Annual', 'Daily'].reduce((groups, frequency) => {
    const frequencyPlans = visiblePlans.filter((plan) => plan.frequency === frequency)
    if (frequencyPlans.length) groups.push({ frequency, plans: frequencyPlans })
    return groups
  }, []), [visiblePlans])
  const timelineStart = new Date('2026-01-01T00:00:00')
  const timelineEnd = new Date('2026-12-31T23:59:59')

  if (loading) return <div className="page-wrap loading-state"><div className="loading-spinner" /><h2>Reading maintenance timeline</h2><p>Preparing latest execution and next due dates.</p></div>
  if (error) return <div className="page-wrap loading-state"><AlertTriangle size={28} /><h2>Workbook unavailable</h2><p>{error}</p></div>

  return <div className="page-wrap plan-view-page"><PageIntro eyebrow="Maintenance intelligence" title="Critical view" description="See every maintenance activity ordered from stable to critical." action={<label className="button button-primary upload-button"><Upload size={17} />Upload Excel<input type="file" accept=".xlsx,.xls" onChange={onUpload} /></label>} /><div className="timeline-source"><div className="file-icon">XLS</div><div><strong>{fileName}</strong><span>{plans.length} plans analyzed from scheduled and completion dates</span></div><span className="report-badge">Timeline live</span></div><div className="plan-view-summary"><div><strong>{plans.length}</strong><span>Total plans</span></div><div><strong className="summary-red">{criticalCount}</strong><span>Critical</span></div><div><strong className="summary-orange">{overdueCount}</strong><span>Overdue</span></div><div><strong className="summary-green">{visiblePlans.filter((plan) => plan.criticality === 'On track').length}</strong><span>On track</span></div></div>{(criticalCount || overdueCount) > 0 && <div className="attention-strip"><AlertTriangle size={16} /><strong>Immediate attention</strong><span>{criticalCount + overdueCount} plans need review · start with the red and orange rows below.</span></div>}<div className="plan-view-toolbar"><div><span className="filter-caption">Filter by line / machine</span><div className="select-wrap"><Filter size={16} /><select value={machineFilter} onChange={(event) => setMachineFilter(event.target.value)}><option>All lines / machines</option>{machines.map((machine) => <option key={machine}>{machine}</option>)}</select><ChevronDown size={14} /></div></div><div className="timeline-legend"><span><i className="critical-key" />Critical</span><span><i className="overdue-key" />Overdue</span><span><i className="soon-key" />Due soon</span><span><i className="track-key" />On track</span><span><i className="planned-key" />Planned</span><span><i className="completed-key" />Completed</span></div></div><section className="timeline-panel gantt-panel"><div className="gantt-axis"><div className="gantt-label-axis">Machine / plan</div><div className="gantt-months">{Array.from({ length: 12 }, (_, index) => <span key={index}>{new Date(2026, index, 1).toLocaleDateString('en-US', { month: 'short' })}</span>)}</div><div className="gantt-status-axis">Status</div></div><div className="timeline-list">{Object.entries(timelineGroups).map(([machine, machinePlans]) => <div className="timeline-machine-group" key={machine}><div className="timeline-group-heading"><div><strong>{machine}</strong><span>{machinePlans.length} maintenance {machinePlans.length === 1 ? 'plan' : 'plans'}</span></div><span className={`group-health health-${machinePlans.some((plan) => plan.criticality === 'Critical') ? 'critical' : machinePlans.some((plan) => plan.criticality === 'Overdue' ? 'overdue' : 'track')}`}>{machinePlans.filter((plan) => plan.criticality === 'Critical' || plan.criticality === 'Overdue').length ? 'Needs attention' : 'Healthy'}</span></div>{machinePlans.map((plan) => <PlanTimelineRow plan={plan} timelineStart={timelineStart} timelineEnd={timelineEnd} key={plan.id} />)}</div>)}</div>{!visiblePlans.length && <div className="empty-selection">No plans found for this line or machine.</div>}</section></div>
}

function PlanTimelineRow({ plan, timelineStart, timelineEnd }) {
  const plannedDate = plan.lastScheduled || plan.nextDue
  const plannedPosition = getTimelinePosition(plannedDate, timelineStart, timelineEnd)
  const completedPosition = getTimelinePosition(plan.lastCompleted, timelineStart, timelineEnd)
  const completionRate = plan.totalOrders ? Math.round((plan.completedOrders / plan.totalOrders) * 100) : 0
  return <article className={`timeline-row matrix-row risk-${plan.riskStage.toLowerCase().replace(' ', '-')}`}><div className="gantt-plan-label"><div><strong>{plan.activity}</strong><span>{plan.machine} · {plan.frequency}<div className="activity-progress"><i style={{ width: `${completionRate}%` }} /></div></span></div><small>{completionRate}%</small></div>{['Low risk', 'Medium risk', 'High risk', 'Critical'].map((stage) => <div className={`risk-cell ${plan.riskStage === stage ? 'risk-active' : ''}`} key={stage}>{plan.riskStage === stage && <><span className="risk-marker" /><strong>{plan.delayDays > 0 ? `${plan.delayDays}d late` : plan.lastCompleted ? 'Completed' : 'Pending'}</strong><small>{plan.lastCompleted ? formatPrintDate(plan.lastCompleted) : 'No completion date'}</small><div className="risk-progress"><i style={{ width: `${Math.min(100, Math.round((Math.max(0, plan.delayDays) / Math.max(1, plan.periodDays)) * 100))}%` }} /></div></>}</div>)}</article>
}

function ActivityGauge({ value }) {
  return <span className="activity-gauge" style={{ '--gauge-angle': `${Math.min(100, value) * 1.8}deg` }}><i /><b>{value}%</b></span>
}

function getTimelinePosition(date, start, end) {
  if (!date) return null
  const position = ((new Date(date) - start) / (end - start)) * 100
  return Math.min(100, Math.max(0, position))
}

function DashboardReport({ report }) {
  const priorityMachines = report.machines.filter((machine) => machine.priority)
  return <div className="dashboard-report"><div className="report-source"><div className="file-icon">XLS</div><div><strong>{report.fileName}</strong><span>{report.total.toLocaleString()} maintenance records analyzed from completion date</span></div><span className="report-badge">Live analysis</span></div><div className="metric-grid report-metrics"><MetricCard label="Completed orders" value={report.completed.toLocaleString()} delta={`${report.rate}%`} detail="completion rate" icon={Check} tone="green" chart="completion" /><MetricCard label="Not completed" value={report.pending.toLocaleString()} delta={`${100 - report.rate}%`} detail="still open or missing date" icon={AlertTriangle} tone="orange" chart="overdue" /><MetricCard label="Overall compliance" value={`${report.rate}%`} delta="Completion date" detail="all maintenance periods" icon={Activity} tone="blue" chart="tasks" /><MetricCard label="Priority machines" value={priorityMachines.length} delta="Attention" detail="EMBA · Gopfert · 205" icon={Wrench} tone="purple" chart="uptime" /></div><div className="donut-grid"><section className="panel report-panel"><div className="panel-heading"><div><h2>Completed vs not completed</h2><p>All maintenance records in the uploaded file</p></div></div><OverallCompletionChart report={report} /></section><PlanStatusBars report={report} /></div><section className="panel report-panel machine-panel"><div className="panel-heading"><div><h2>Machine / line compliance</h2><p>All machines · highest to lowest compliance · priority assets highlighted</p></div></div><div className="machine-list">{report.machines.map((machine) => <MachineRow key={machine.machine} machine={machine} />)}</div></section><section className="panel evolution-panel"><div className="panel-heading"><div><h2>Monthly compliance evolution</h2><p>January — December, based on completion date</p></div><span className="chart-legend"><i className="completed-key" />Completed <i className="pending-key" />Not completed <i className="pareto-key" />Pareto</span></div><div className="monthly-chart-wrap"><div className="monthly-chart">{report.monthly.map((month) => <div className="month-column" key={month.label}><div className="month-bars"><div className="month-bar completed-bar" style={{ height: `${Math.max(month.total ? (month.completed / Math.max(...report.monthly.map((item) => item.total), 1)) * 100 : 0, 3)}%` }} title={`${month.completed} completed`} /><div className="month-bar pending-bar" style={{ height: `${Math.max(month.total ? ((month.total - month.completed) / Math.max(...report.monthly.map((item) => item.total), 1)) * 100 : 0, 3)}%` }} title={`${month.total - month.completed} not completed`} /></div><span>{month.label}</span><small>{month.rate}%</small></div>)}</div><ParetoLine monthly={report.monthly} /></div></section></div>
}

function PlanStatusBars({ report }) {
  const items = (report.riskSummary?.length ? report.riskSummary : [{ risk: 'Low risk', count: report.completed }, { risk: 'Medium risk', count: 0 }, { risk: 'High risk', count: 0 }, { risk: 'Critical', count: report.pending }]).sort((a, b) => ['Critical', 'High risk', 'Medium risk', 'Low risk'].indexOf(a.risk) - ['Critical', 'High risk', 'Medium risk', 'Low risk'].indexOf(b.risk))
  const maximum = Math.max(...items.map((item) => item.count), 1)
  return <section className="panel report-panel plan-status-bars"><div className="panel-heading"><div><h2>Plan status</h2><p>Plans by criticality · {report.total.toLocaleString()} total records</p></div></div><div className="status-bar-list">{items.map((item) => <div className={`status-bar-row status-${item.risk.toLowerCase().replace(' ', '-')}`} key={item.risk}><div><strong>{item.risk}</strong><span>{item.count} plans</span></div><div className="status-bar-track"><i style={{ width: `${(item.count / maximum) * 100}%` }} /></div><b>{item.count}</b></div>)}</div></section>
}

function ParetoLine({ monthly }) {
  const highestMonthlyTotal = Math.max(...monthly.map((month) => month.total), 1)
  const points = monthly.map((month, index) => {
    return `${((index + 0.5) * 100) / 12},${100 - (month.completed / highestMonthlyTotal) * 100}`
  }).join(' ')
  return <svg className="pareto-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Completed trend line"><polyline points={points} fill="none" vectorEffect="non-scaling-stroke" /></svg>
}

function OverallCompletionChart({ report }) {
  return <div className="overall-completion"><div className="overall-donut" style={{ '--completion-angle': `${report.rate * 3.6}deg` }}><div><strong>{report.rate}%</strong><span>Compliance</span></div></div><div className="overall-legend"><div><i className="completed-key" /><span>Completed</span><strong>{report.completed.toLocaleString()}</strong></div><div><i className="pending-key" /><span>Not completed</span><strong>{report.pending.toLocaleString()}</strong></div><div className="overall-total">{report.total.toLocaleString()} total records</div></div></div>
}

function FrequencyRow({ item }) {
  return <div className="frequency-row"><div className="frequency-label"><strong>{item.frequency}</strong><span>{item.completed} completed / {item.total - item.completed} not completed</span></div><div className="report-progress"><i style={{ width: `${item.rate}%` }} /></div><b>{item.rate}%</b></div>
}

function MachineRow({ machine }) {
  return <div className={`machine-row ${machine.priority ? 'priority-machine' : ''}`}><div className="machine-name">{machine.priority && <span className="priority-marker" title="Priority machine">!</span>}<strong>{machine.machine}</strong><span>{machine.completed} completed / {machine.total} total</span></div><div className="report-progress"><i style={{ width: `${machine.rate}%` }} /></div><b>{machine.rate}%</b></div>
}

function MetricCard({ label, value, delta, detail, icon: Icon, tone, chart }) {
  return <div className="metric-card"><div className="metric-top"><div className={`metric-icon ${tone}`}><Icon size={18} /></div><span className={`delta ${delta.startsWith('-') ? 'negative' : ''}`}>{delta}</span></div><div className="metric-value">{value}</div><div className="metric-label">{label}</div><div className="metric-detail">{detail}</div><div className={`mini-chart ${chart}`}><span /><span /><span /><span /><span /><span /><span /><span /></div></div>
}

function TaskRow({ task, onComplete }) {
  return <div className="task-row"><button className="check-button" onClick={() => onComplete(task.id)} aria-label={`Mark ${task.title} complete`}><Check size={14} /></button><div className="task-info"><strong>{task.title}</strong><span>{task.asset} <i /> {task.frequency}</span></div><div className={`task-date ${task.due === 'Today' ? 'today' : ''}`}><Clock3 size={14} />{task.due}</div><div className={`priority-dot ${task.priority.toLowerCase()}`} title={`${task.priority} priority`} /></div>
}

function LegendItem({ color, label, value }) { return <div className="legend-item"><span className="legend-color" style={{ background: color }} />{label}<strong>{value}</strong></div> }

function MaintenancePlan({ sourcePlans, loading, error, fileName, onUpload, onAdd }) {
  const [lineFilter, setLineFilter] = useState('All lines / machines')
  const [frequencyFilter, setFrequencyFilter] = useState('All periods')
  const [scheduled, setScheduled] = useState(() => {
    try { return JSON.parse(localStorage.getItem(maintenanceScheduleStorageKey))?.scheduled || {} } catch { return {} }
  })
  const [generatedKeys, setGeneratedKeys] = useState(() => {
    try { return JSON.parse(localStorage.getItem(maintenanceScheduleStorageKey))?.generatedKeys || {} } catch { return {} }
  })
  const [weekStart, setWeekStart] = useState(() => {
    try {
      const savedWeekStart = JSON.parse(localStorage.getItem(maintenanceScheduleStorageKey))?.weekStart
      const parsedWeekStart = savedWeekStart ? new Date(savedWeekStart) : null
      return parsedWeekStart && !Number.isNaN(parsedWeekStart.getTime()) ? parsedWeekStart : getMonday(new Date('2026-09-10'))
    } catch { return getMonday(new Date('2026-09-10')) }
  })
    const [showShutdowns, setShowShutdowns] = useState(true)
  const [generationMessage, setGenerationMessage] = useState('')
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [notes, setNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem(maintenanceScheduleStorageKey))?.notes || {} } catch { return {} }
  })
  const lines = useMemo(() => [...new Set(sourcePlans.map((plan) => plan.machine))].sort(), [sourcePlans])
  const filteredPlans = useMemo(() => sourcePlans.filter((plan) => {
    return (lineFilter === 'All lines / machines' || plan.machine === lineFilter) && (frequencyFilter === 'All periods' || plan.frequency === frequencyFilter)
  }), [sourcePlans, lineFilter, frequencyFilter])
  const scheduledCount = Object.keys(scheduled).length
  const completedOrders = sourcePlans.reduce((sum, plan) => sum + plan.completedOrders, 0)
  const totalOrders = sourcePlans.reduce((sum, plan) => sum + plan.totalOrders, 0)
  const weekDays = getWeekDays(weekStart)
  const weekKey = formatDateKey(weekStart)
  const weekPlans = Object.entries(scheduled).filter(([key]) => key.startsWith(`${weekKey}|`))
  const weekPlanCount = weekPlans.length
  const weekNotes = Object.values(notes).filter((note) => note.weekKey === weekKey)
  const yearWeeks = useMemo(() => getYearWeeks(2026), [])

  useEffect(() => {
    const openGenerator = () => setShowGenerateModal(true)
    window.addEventListener('open-auto-generate', openGenerator)
    return () => window.removeEventListener('open-auto-generate', openGenerator)
  }, [])

  useEffect(() => {
    localStorage.setItem(maintenanceScheduleStorageKey, JSON.stringify({ scheduled, generatedKeys, weekStart: weekStart.toISOString(), notes }))
  }, [scheduled, generatedKeys, weekStart, notes])

  const dropPlan = (event, dayIndex) => {
    event.preventDefault()
    const planId = event.dataTransfer.getData('planId')
    const scheduledKey = event.dataTransfer.getData('scheduledKey')
    const noteId = event.dataTransfer.getData('noteId')
    if (planId) setScheduled((current) => {
      const next = { ...current }
      if (scheduledKey) delete next[scheduledKey]
      next[`${weekKey}|${planId}`] = dayIndex
      return next
    })
    if (planId && scheduledKey && generatedKeys[scheduledKey]) setGeneratedKeys((current) => {
      const next = { ...current }
      delete next[scheduledKey]
      next[`${weekKey}|${planId}`] = true
      return next
    })
    if (noteId) setNotes((current) => ({ ...current, [noteId]: { ...current[noteId], weekKey, dayIndex } }))
  }
  const removeFromCalendar = (planId) => setScheduled((current) => {
    const next = { ...current }
    delete next[`${weekKey}|${planId}`]
    return next
  })
  const removeNote = (noteId) => setNotes((current) => {
    const next = { ...current }
    delete next[noteId]
    return next
  })
  const copyNote = (note) => {
    const id = `note-${Date.now()}`
    setNotes((current) => ({ ...current, [id]: { ...note, id } }))
  }
    const clearGeneratedWeek = () => {
      setScheduled((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${weekKey}|`) || !generatedKeys[key])))
      setGeneratedKeys((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${weekKey}|`))))
      setGenerationMessage(`Cleared auto-generated plans for the week of ${formatWeekRange(weekStart)}.`)
  }
  const clearGeneratedYear = () => {
    if (!window.confirm('Clear every auto-generated plan for 2026? Manual plans and notes will remain.')) return
    setScheduled((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !generatedKeys[key])))
    setGeneratedKeys({})
    setGenerationMessage('Cleared all auto-generated plans for 2026. Manual plans and notes were preserved.')
  }
  const moveWeek = (amount) => setWeekStart((current) => addDays(current, amount * 7))
  const generateYear = (selectedLines) => {
    const selectedPlans = sourcePlans.filter((plan) => selectedLines.includes(plan.machine))
    const generated = generateAnnualSchedule(selectedPlans)
    setScheduled(generated.schedule)
    setGeneratedKeys(Object.fromEntries(Object.keys(generated.schedule).map((key) => [key, true])))
    setGenerationMessage(`Auto-generated ${Object.keys(generated.schedule).length.toLocaleString()} balanced plan occurrences for ${selectedLines.length} selected lines across 2026.`)
    setWeekStart(getMonday(new Date('2026-09-10')))
    setShowGenerateModal(false)
  }
  const handleMaintenanceReport = async () => {
    setReportLoading(true)
    await new Promise((resolve) => window.setTimeout(resolve, 60))
    const findPlan = (key) => sourcePlans.find((plan) => plan.id === key.split('|')[1])
    const plans = weekPlans.map(([key, dayIndex]) => ({ plan: findPlan(key), dayIndex })).filter(({ plan }) => plan).filter(({ plan }) => (lineFilter === 'All lines / machines' || plan.machine === lineFilter) && (frequencyFilter === 'All periods' || plan.frequency === frequencyFilter)).map(({ plan, dayIndex }) => ({ ...plan, dayIndex }))
    try {
      exportMaintenancePlanReport({ weekStart, weekDays, plans, notes: weekNotes, filters: { line: lineFilter, frequency: frequencyFilter, fileName } })
    } finally {
      setReportLoading(false)
    }
  }

  if (loading) return <div className="page-wrap loading-state"><div className="loading-spinner" /><h2>Reading maintenance workbook</h2><p>Preparing plans, completion history, and weekly schedule.</p></div>
  if (error) return <div className="page-wrap loading-state"><AlertTriangle size={28} /><h2>Workbook unavailable</h2><p>{error}</p></div>

  return <div className="page-wrap plan-page"><PageIntro eyebrow="Maintenance plan / weekly builder" title="Build your maintenance week" description="Drag a plan from the library into a day. Completion history is calculated from the workbook." action={<label className="button button-primary upload-button"><Upload size={17} />Upload Excel<input type="file" accept=".xlsx,.xls" onChange={onUpload} /></label>} />
    <div className="workbook-note"><FileSpreadsheetIcon /><span>Imported from <strong>{fileName}</strong></span><span className="record-count">{sourcePlans.length} plans · {totalOrders.toLocaleString()} orders</span></div>
    <div className="shutdown-note"><div className="shutdown-note-title"><Info size={16} /><strong>Machine shutdown windows</strong><button className="icon-button" onClick={() => setShowShutdowns((current) => !current)} aria-label="Toggle shutdown details">{showShutdowns ? <ChevronDown size={16} /> : <ArrowUpRight size={16} />}</button></div>{showShutdowns && <div className="shutdown-grid"><ShutdownItem day="Monday" machine="202" /><ShutdownItem day="Tuesday" machine="EMBA" /><ShutdownItem day="Wednesday" machine="Gopfert" /><ShutdownItem day="Thursday" machine="205" /><ShutdownItem day="Friday · morning" machine="115" /><ShutdownItem day="Friday · afternoon" machine="102" /><ShutdownItem day="Friday · night" machine="616 and 201" /><ShutdownItem day="Saturday & Sunday" machine="MPG (172 and 170)" /></div>} {!showShutdowns && <span className="shutdown-summary">Mon 202 · Tue EMBA · Wed Gopfert · Thu 205 · Fri 115 / 102 / 616 + 201 · Weekend MPG 172 + 170</span>}</div>
    {generationMessage && <div className="generation-message"><WandSparkles size={15} />{generationMessage}<button className="icon-button" onClick={() => setGenerationMessage('')}><X size={14} /></button></div>}
    <div className="plan-summary"><div><strong>{sourcePlans.length}</strong><span>Total plans</span></div><div><strong className="summary-green">{lines.length}</strong><span>Lines / machines</span></div><div><strong className="summary-orange">{scheduledCount}</strong><span>Placed this week</span></div><div><strong className="summary-red">{totalOrders ? Math.round((completedOrders / totalOrders) * 100) : 0}%</strong><span>Orders completed</span></div><div className="summary-progress"><span>{totalOrders ? Math.round((completedOrders / totalOrders) * 100) : 0}% completion from history</span><div><i style={{ width: `${totalOrders ? Math.round((completedOrders / totalOrders) * 100) : 0}%` }} /></div></div></div>
    <div className="planner-layout"><aside className="plan-library"><div className="library-heading"><div><h2>Plan library</h2><p>{filteredPlans.length} plans available</p></div><ListFilter size={17} /></div><div className="library-filters"><div className="library-filter"><span>Line / machine</span><select value={lineFilter} onChange={(event) => setLineFilter(event.target.value)}><option>All lines / machines</option>{lines.map((line) => <option key={line}>{line}</option>)}</select></div><div className="library-filter"><span>Period</span><select value={frequencyFilter} onChange={(event) => setFrequencyFilter(event.target.value)}><option>All periods</option><option>Daily</option><option>Weekly</option><option>Monthly</option><option>Quarterly</option><option>Biannual</option><option>Annual</option></select></div></div><div className="library-list">{filteredPlans.map((plan) => <PlanLibraryCard key={plan.id} plan={plan} onDragStart={(event) => { event.dataTransfer.setData('planId', plan.id); event.dataTransfer.effectAllowed = 'move' }} isScheduled={Object.keys(scheduled).some((key) => key.endsWith(`|${plan.id}`))} />)}</div></aside><section className="weekly-board"><YearWeekMap yearWeeks={yearWeeks} selectedWeekKey={weekKey} scheduled={scheduled} notes={notes} onSelect={setWeekStart} /><div className="week-heading"><button className="icon-button week-arrow" onClick={() => moveWeek(-1)} aria-label="Previous week"><ChevronLeft size={19} /></button><div className="week-title"><h2>Week of {formatWeekRange(weekStart)}</h2><p>{weekPlanCount || weekNotes.length ? `${weekPlanCount} plans · ${weekNotes.length} notes in this weekly schedule` : 'Drag plans or notes here to build the weekly schedule'}</p></div><div className="week-controls"><button className="button button-secondary" onClick={() => setShowNoteModal(true)}><StickyNote size={15} />Add note</button><button className="button button-secondary" onClick={clearGeneratedWeek}><Trash2 size={15} />Clear week</button><button className="button button-danger" onClick={clearGeneratedYear}><Trash2 size={15} />Clear year</button><button className="button button-secondary" disabled={reportLoading} onClick={handleMaintenanceReport}>{reportLoading ? <><LoaderCircle size={16} className="spin" />Generating PDF...</> : <><FileDown size={16} />Export PDF report</>}</button><button className="button button-secondary" onClick={() => setWeekStart(getMonday(new Date('2026-09-10')))}><CalendarDays size={16} />Current week</button><button className="icon-button week-arrow" onClick={() => moveWeek(1)} aria-label="Next week"><ChevronRight size={19} /></button></div></div><div className="calendar-grid">{weekDays.map((day, index) => <div className={`day-column ${day.isToday ? 'current-day' : ''}`} key={day.label} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropPlan(event, index)}><div className="day-heading"><span>{day.label}</span><strong>{day.date}</strong>{day.isToday && <i>Today</i>}<small>{getShutdownWindow(day.index)}</small></div><div className="day-dropzone">{weekPlans.filter(([, dayIndex]) => dayIndex === index).map(([key]) => { const plan = sourcePlans.find((item) => item.id === key.split('|')[1]); return plan ? <ScheduledPlanCard key={plan.id} plan={plan} scheduledKey={key} onRemove={() => removeFromCalendar(plan.id)} /> : null })}{weekNotes.filter((note) => note.dayIndex === index).map((note) => <NoteCard key={note.id} note={note} onRemove={() => removeNote(note.id)} onCopy={() => copyNote(note)} />)}<div className="drop-hint"><Plus size={14} /><span>Drop here</span></div></div></div>)}</div></section></div>
    {showNoteModal && <AddNoteModal weekDays={weekDays} onClose={() => setShowNoteModal(false)} onAdd={(text, dayIndex) => { const id = `note-${Date.now()}`; setNotes((current) => ({ ...current, [id]: { id, text, weekKey, dayIndex } })); setShowNoteModal(false) }} />}
    {showGenerateModal && <GeneratePlansModal lines={lines} onClose={() => setShowGenerateModal(false)} onGenerate={generateYear} />}
  </div>
}

function MaintenancePrintReport({ weekStart, weekDays, weekPlans, weekNotes, sourcePlans }) {
  const findPlan = (key) => sourcePlans.find((plan) => plan.id === key.split('|')[1])
  return <article className="maintenance-print-report"><header className="print-report-header"><div><span className="print-kicker">MAINTENANCE PLANNING · OPERATIONS</span><h1>Weekly maintenance plan</h1><p>Week of {formatWeekRange(weekStart)}</p></div><div className="print-report-meta"><strong>Northstar Plant</strong><span>Generated {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span></div></header><section className="print-calendar"><div className="print-section-heading"><h2>Weekly schedule</h2><span>{weekPlans.length} activities · {weekNotes.length} notes</span></div><div className="print-calendar-grid">{weekDays.map((day, index) => <div className="print-day" key={day.label}><div className="print-day-heading"><span>{day.label}</span><strong>{day.date}</strong></div><div className="print-day-items">{weekPlans.filter(([, dayIndex]) => dayIndex === index).map(([key]) => { const plan = findPlan(key); return plan ? <div className={`print-calendar-card print-${plan.frequency.toLowerCase()}`} key={key}><strong>{plan.activity}</strong><span>{plan.machine} · {plan.frequency}</span></div> : null })}{weekNotes.filter((note) => note.dayIndex === index).map((note) => <div className="print-calendar-note" key={note.id}><strong>Note</strong><span>{note.text}</span></div>)}{!weekPlans.some(([, dayIndex]) => dayIndex === index) && !weekNotes.some((note) => note.dayIndex === index) && <small className="print-empty-day">No activities</small>}</div></div>)}</div></section><section className="print-activity-list"><div className="print-section-heading"><h2>Activities by day</h2><span>Maintenance details and completion history</span></div>{weekDays.map((day, index) => { const dayPlans = weekPlans.filter(([, dayIndex]) => dayIndex === index).map(([key]) => findPlan(key)).filter(Boolean); const dayNotes = weekNotes.filter((note) => note.dayIndex === index); return <div className="print-day-list" key={day.label}><div className="print-list-day"><strong>{day.label}</strong><span>{day.date}</span></div><div className="print-list-content">{dayPlans.map((plan) => <div className="print-activity-row" key={plan.id}><div><strong>{plan.activity}</strong><span>{plan.machine} · Plan {plan.planCode}</span></div><span className={`print-frequency print-${plan.frequency.toLowerCase()}`}>{plan.frequency}</span><span>{plan.completedOrders}/{plan.totalOrders} completed</span><span>{plan.lastCompleted ? `Last completed ${formatPrintDate(plan.lastCompleted)}` : 'Not completed'}</span></div>)}{dayNotes.map((note) => <div className="print-note-row" key={note.id}><strong>Note</strong><span>{note.text}</span></div>)}{!dayPlans.length && !dayNotes.length && <div className="print-no-activity">No scheduled activities</div>}</div></div>})}</section><footer className="print-footer">Source: maintenance plan workbook · Completion status is based on Completion date</footer></article>
}

function formatPrintDate(date) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function PlanLibraryCard({ plan, onDragStart, isScheduled }) {
  return <article className={`library-card frequency-${plan.frequency.toLowerCase()} ${isScheduled ? 'is-scheduled' : ''}`} draggable onDragStart={onDragStart}><div className="drag-grip"><span /><span /><span /></div><div className="library-card-body"><div className="card-kicker"><span className={`frequency-dot ${plan.frequency.toLowerCase()}`} />{plan.frequency}<span className="plan-code">{plan.planCode}</span></div><h3>{plan.activity}</h3><p>{plan.machine}</p><div className="card-meta"><span>{plan.completionRate}% complete</span><span className={`mini-status ${plan.status.toLowerCase()}`}>{plan.status}</span></div><div className="progress-line"><i style={{ width: `${plan.completionRate}%` }} /></div></div></article>
}

function YearWeekMap({ yearWeeks, selectedWeekKey, scheduled, notes, onSelect }) {
  return <div className="year-map"><div className="year-map-heading"><div><h3>2026 week map</h3><p>Click any week to view its complete schedule</p></div><div className="year-map-actions"><button className="button button-secondary" onClick={() => window.dispatchEvent(new CustomEvent('open-auto-generate'))}><WandSparkles size={14} />Auto Generate</button><span>{yearWeeks.length} weeks</span></div></div><div className="year-week-grid">{yearWeeks.map((week) => {
    const planCount = Object.keys(scheduled).filter((key) => key.startsWith(`${week.key}|`)).length
    const noteCount = Object.values(notes).filter((note) => note.weekKey === week.key).length
    const total = planCount + noteCount
    return <button className={`year-week-cell ${selectedWeekKey === week.key ? 'selected' : ''} ${total ? 'has-items' : ''}`} key={week.key} onClick={() => onSelect(week.start)} title={`${week.label}: ${total} scheduled items`}><span>{week.label}</span><small>{week.shortRange}</small>{total > 0 && <strong>{total}</strong>}</button>
  })}</div></div>
}

function ShutdownItem({ day, machine }) {
  return <div className="shutdown-item"><span>{day}</span><strong>{machine}</strong></div>
}

function getMonday(date) {
  const monday = new Date(date)
  const day = monday.getDay() || 7
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() - day + 1)
  return monday
}

function getYearWeeks(year) {
  const firstWeek = getMonday(new Date(`${year}-01-01T00:00:00`))
  return Array.from({ length: 53 }, (_, index) => {
    const start = addDays(firstWeek, index * 7)
    const end = addDays(start, 6)
    return {
      start,
      key: formatDateKey(start),
      label: `W${String(index + 1).padStart(2, '0')}`,
      shortRange: `${start.getDate()} ${start.toLocaleDateString('en-US', { month: 'short' })} – ${end.getDate()} ${end.toLocaleDateString('en-US', { month: 'short' })}`,
    }
  }).filter((week) => week.start.getFullYear() === year || week.start < new Date(`${year + 1}-01-01T00:00:00`))
}

function addDays(date, amount) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function formatDateKey(date) {
  return date.toISOString().slice(0, 10)
}

function formatWeekRange(start) {
  const end = addDays(start, 6)
  const startLabel = start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  const endLabel = end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  return `${startLabel} – ${endLabel}`
}

function getShutdownWindow(dayIndex) {
  return ['202', 'EMBA', 'Gopfert', '205', '115 / 102 / 616 + 201', 'MPG 172 + 170', 'MPG 172 + 170'][dayIndex]
}

function preferredDaysForPlan(plan) {
  const text = `${plan.machine} ${plan.activity}`.toLowerCase()
  if (text.includes('202')) return [0]
  if (text.includes('emba')) return [1]
  if (text.includes('gop') || text.includes('gopf')) return [2]
  if (text.includes('205')) return [3]
  if (text.includes('115')) return [4]
  if (text.includes('102')) return [4]
  if (text.includes('616') || text.includes('201')) return [4]
  if (text.includes('172') || text.includes('170') || text.includes('mpg')) return [5, 6]
  return [0, 1, 2, 3, 4, 5, 6]
}

function isPlanDueInWeek(plan, weekStart, weekIndex) {
  const anchor = plan.firstScheduled || new Date('2026-01-01')
  const frequency = plan.frequency
  const daysSinceAnchor = Math.floor((weekStart - getMonday(anchor)) / 86400000)
  if (weekStart < getMonday(anchor) && frequency !== 'Daily') return false
  if (frequency === 'Daily' || frequency === 'Weekly') return daysSinceAnchor >= 0
  const monthsPerOccurrence = { Monthly: 1, Quarterly: 3, Biannual: 6, Annual: 12 }[frequency] || 12
  const monthDistance = (weekStart.getFullYear() - anchor.getFullYear()) * 12 + weekStart.getMonth() - anchor.getMonth()
  if (monthDistance < 0 || monthDistance % monthsPerOccurrence !== 0) return false
  const occurrenceDate = new Date(anchor)
  occurrenceDate.setMonth(anchor.getMonth() + monthDistance)
  return formatDateKey(getMonday(occurrenceDate)) === formatDateKey(weekStart)
}

function generateAnnualSchedule(plans) {
  const schedule = {}
  const yearStart = getMonday(new Date('2026-01-01'))
  const dayLoads = new Map()
  const weeks = Array.from({ length: 53 }, (_, index) => addDays(yearStart, index * 7)).filter((date) => date.getFullYear() === 2026 || date <= new Date('2026-12-31'))
  weeks.forEach((weekStart, weekIndex) => {
    const weekKey = formatDateKey(weekStart)
    const loads = [0, 0, 0, 0, 0, 0, 0]
    const duePlans = plans.filter((plan) => isPlanDueInWeek(plan, weekStart, weekIndex)).sort((a, b) => a.frequency.localeCompare(b.frequency) || a.machine.localeCompare(b.machine))
    duePlans.forEach((plan, planIndex) => {
      const preferred = preferredDaysForPlan(plan)
      const availablePreferred = preferred.filter((day) => loads[day] < 6)
      const candidates = availablePreferred.length ? availablePreferred : [0, 1, 2, 3, 4, 5, 6].filter((day) => loads[day] < 6)
      if (!candidates.length) return
      const day = candidates[(planIndex + weekIndex) % candidates.length]
      loads[day] += 1
      schedule[`${weekKey}|${plan.id}`] = day
    })
    dayLoads.set(weekKey, loads)
  })
  return { schedule, dayLoads }
}

function ScheduledPlanCard({ plan, scheduledKey, onRemove }) {
  return <article className={`scheduled-card frequency-${plan.frequency.toLowerCase()}`} draggable onDragStart={(event) => { event.dataTransfer.setData('planId', plan.id); event.dataTransfer.setData('scheduledKey', scheduledKey); event.dataTransfer.effectAllowed = 'move' }}><div><strong>{plan.activity}</strong><span>{plan.machine}</span></div><button className="icon-button" onClick={onRemove} aria-label="Remove from day"><X size={14} /></button><small>{plan.frequency} · {plan.completionRate}% history complete</small></article>
}

function NoteCard({ note, onRemove, onCopy }) {
  return <article className="note-card" draggable onDragStart={(event) => { event.dataTransfer.setData('noteId', note.id); event.dataTransfer.effectAllowed = 'move' }}><div className="note-card-top"><StickyNote size={13} /><div><button className="icon-button" onClick={() => onCopy(note)} aria-label="Copy note"><Copy size={13} /></button><button className="icon-button" onClick={onRemove} aria-label="Remove note"><X size={13} /></button></div></div><p>{note.text}</p><small>Drag to move · Copy to another day</small></article>
}

function FileSpreadsheetIcon() { return <span className="file-icon">XLS</span> }

function getWeekDays(date) {
  const monday = getMonday(date)
  const current = new Date('2026-09-10')
  return Array.from({ length: 7 }, (_, index) => {
    const item = new Date(monday)
    item.setDate(monday.getDate() + index)
    return { index, label: item.toLocaleDateString('en-US', { weekday: 'short' }), date: item.getDate(), isToday: item.toDateString() === current.toDateString() }
  })
}

function GeneratePlansModal({ lines, onClose, onGenerate }) {
  const [selectedLines, setSelectedLines] = useState(lines)
  const [query, setQuery] = useState('')
  const visibleLines = lines.filter((line) => line.toLowerCase().includes(query.toLowerCase()))
  const allSelected = lines.length > 0 && selectedLines.length === lines.length

  const toggleLine = (line) => setSelectedLines((current) => current.includes(line) ? current.filter((item) => item !== line) : [...current, line])
  const toggleAll = () => setSelectedLines(allSelected ? [] : lines)

  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal generate-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><div className="eyebrow">Annual schedule builder</div><h2>Choose lines and machines</h2><p className="modal-description">Select the areas that Auto Generate should include for 2026.</p></div><button className="icon-button" onClick={onClose} aria-label="Close selection"><X size={19} /></button></div><div className="generate-toolbar"><div className="search-field"><Search size={16} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search lines or machines..." /></div><button className="text-button" onClick={toggleAll}>{allSelected ? 'Clear all' : 'Select all'}</button></div><div className="selection-count"><strong>{selectedLines.length}</strong> of {lines.length} lines selected</div><div className="line-selection-list">{visibleLines.map((line) => <label className="line-option" key={line}><input type="checkbox" checked={selectedLines.includes(line)} onChange={() => toggleLine(line)} /><span className="custom-checkbox"><Check size={13} /></span><span>{line}</span></label>)}{!visibleLines.length && <div className="empty-selection">No matching lines or machines.</div>}</div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button type="button" className="button button-primary" disabled={!selectedLines.length} onClick={() => onGenerate(selectedLines)}><WandSparkles size={16} />Generate selected plans</button></div></div></div>
}

function AddNoteModal({ weekDays, onClose, onAdd }) {
  const [text, setText] = useState('')
  const [dayIndex, setDayIndex] = useState(0)
  const submit = (event) => {
    event.preventDefault()
    if (text.trim()) onAdd(text.trim(), Number(dayIndex))
  }
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal note-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><div className="eyebrow">Weekly schedule</div><h2>Add a day note</h2><p className="modal-description">Create a reminder and place it on any day of the selected week.</p></div><button className="icon-button" onClick={onClose} aria-label="Close note form"><X size={19} /></button></div><form onSubmit={submit}><label>Note<textarea autoFocus value={text} onChange={(event) => setText(event.target.value)} placeholder="e.g. Confirm spare parts before shutdown" rows="4" /></label><label>Place on<select value={dayIndex} onChange={(event) => setDayIndex(event.target.value)}>{weekDays.map((day) => <option key={day.index} value={day.index}>{day.label} {day.date}</option>)}</select></label><div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary" disabled={!text.trim()}><StickyNote size={15} />Add note</button></div></form></div></div>
}

function CopyNoteModal({ weekDays, note, onClose, onCopy }) {
  const [dayIndex, setDayIndex] = useState(0)
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal note-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><div className="eyebrow">Duplicate note</div><h2>Copy note to another day</h2><p className="modal-description">The original note will stay where it is.</p></div><button className="icon-button" onClick={onClose} aria-label="Close copy form"><X size={19} /></button></div><div className="copy-preview"><StickyNote size={15} /><span>{note.text}</span></div><label>Copy to<select value={dayIndex} onChange={(event) => setDayIndex(event.target.value)}>{weekDays.map((day) => <option key={day.index} value={day.index}>{day.label} {day.date}</option>)}</select></label><div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button type="button" className="button button-primary" onClick={() => onCopy(Number(dayIndex))}><Copy size={15} />Copy note</button></div></div></div>
}

function ReportShutdownModal({ line, plansCount, onClose, onGenerate }) {
  const [shutdownDate, setShutdownDate] = useState('')
  const submit = (event) => {
    event.preventDefault()
    onGenerate(shutdownDate)
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal report-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-heading">
          <div>
            <div className="eyebrow">Export Technical Report</div>
            <h2>Maintenance Shutdown Date</h2>
            <p className="modal-description">
              Specify the planned shutdown date for <strong>{line}</strong> ({plansCount} plans in scope).
            </p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={19} />
          </button>
        </div>

        <form onSubmit={submit} className="report-shutdown-form">
          <label className="shutdown-date-field">
            <span>Machine Shutdown Date</span>
            <div className="date-input-wrap">
              <CalendarDays size={16} />
              <input
                type="date"
                autoFocus
                value={shutdownDate}
                onChange={(event) => setShutdownDate(event.target.value)}
              />
              {shutdownDate && (
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setShutdownDate('')}
                  title="Clear date"
                  aria-label="Clear date"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <small className="shutdown-status-note">
              {shutdownDate ? (
                <>Scheduled for <strong>{formatPrintDate(shutdownDate)}</strong></>
              ) : (
                <>No date selected · Report will state: <strong>Date to be defined</strong></>
              )}
            </small>
          </label>

          <div className="report-summary-box">
            <div>
              <small>Selected Line</small>
              <strong>{line}</strong>
            </div>
            <div>
              <small>Total Plans</small>
              <strong>{plansCount}</strong>
            </div>
            <div>
              <small>Shutdown Status</small>
              <strong className={shutdownDate ? 'text-green' : 'text-orange'}>
                {shutdownDate ? formatPrintDate(shutdownDate) : 'Date to be defined'}
              </strong>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="button button-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button button-primary">
              <FileDown size={15} /> Export PDF Report
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AddTaskModal({ onClose, onAdd }) {
  const [title, setTitle] = useState('')
  const [asset, setAsset] = useState('CNC Mill 04')
  const submit = (event) => { event.preventDefault(); if (!title.trim()) return; onAdd({ title, asset, type: 'Preventive', due: 'Sep 24, 2026', frequency: 'Monthly', owner: 'JD', status: 'Scheduled', priority: 'Medium' }) }
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><div className="eyebrow">New work item</div><h2>Add maintenance task</h2></div><button className="icon-button" onClick={onClose}><X size={19} /></button></div><form onSubmit={submit}><label>Task name<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Inspect cooling system" /></label><label>Asset<select value={asset} onChange={(event) => setAsset(event.target.value)}><option>CNC Mill 04</option><option>Compressor A</option><option>Conveyor Line 2</option><option>Packaging Unit 1</option><option>Boiler Room</option></select></label><div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary">Create task</button></div></form></div></div>
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
