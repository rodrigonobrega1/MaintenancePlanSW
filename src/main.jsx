import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import * as XLSX from 'xlsx'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  Copy,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Filter,
  FileDown,
  LayoutDashboard,
  ListFilter,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  StickyNote,
  Trash2,
  Info,
  Upload,
  WandSparkles,
  Wrench,
  X,
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
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Maintenance plan', icon: ClipboardCheck },
]

const dashboardReportStorageKey = 'fieldmark-dashboard-report'

function App() {
  const [activeView, setActiveView] = useState('Dashboard')
  const [tasks, setTasks] = useState(initialTasks)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All tasks')
  const [showModal, setShowModal] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [sourcePlans, setSourcePlans] = useState([])
  const [sourceLoading, setSourceLoading] = useState(true)
  const [sourceError, setSourceError] = useState('')
  const [dashboardReport, setDashboardReport] = useState(null)
  const [dashboardUploadError, setDashboardUploadError] = useState('')
  const [dashboardUploadLoading, setDashboardUploadLoading] = useState(false)

  useEffect(() => {
    try {
      const savedReport = localStorage.getItem(dashboardReportStorageKey)
      if (savedReport) setDashboardReport(JSON.parse(savedReport))
    } catch {
      localStorage.removeItem(dashboardReportStorageKey)
    }
  }, [])

  useEffect(() => {
    fetch('/MAINTENANCE%20PLANS%20WITH%20ORDERS.XLSX')
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load the workbook')
        return response.arrayBuffer()
      })
      .then((buffer) => setSourcePlans(normalizeWorkbook(buffer)))
      .catch(() => setSourceError('The maintenance workbook could not be loaded.'))
      .finally(() => setSourceLoading(false))
  }, [])

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
          <span>fieldmark</span>
          <button className="mobile-close icon-button" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={19} /></button>
        </div>
        <div className="workspace-switcher">
          <div className="workspace-avatar">N</div>
          <div><strong>Northstar Plant</strong><span>Operations workspace</span></div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">Workspace</div>
        <nav>
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${activeView === label ? 'active' : ''}`} onClick={() => navigate(label)}>
              <Icon size={17} /><span>{label}</span>{label === 'Maintenance plan' && <span className="nav-count">24</span>}
            </button>
          ))}
        </nav>
        <div className="nav-label settings-label">Manage</div>
        <button className="nav-item"><Settings2 size={17} /><span>Assets</span></button>
        <button className="nav-item"><CalendarDays size={17} /><span>Calendar</span></button>
        <div className="sidebar-bottom">
          <div className="help-card"><Sparkles size={17} /><div><strong>Maintenance health</strong><span>Everything is running smoothly.</span></div></div>
          <div className="profile-row"><div className="profile-avatar">JD</div><div><strong>Jordan Davis</strong><span>Plant manager</span></div><MoreHorizontal size={17} /></div>
        </div>
      </aside>

      <main className="main-content">
          <header className="topbar">
          <button className="mobile-menu icon-button" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Northstar Plant</span><span>/</span><strong>{activeView}</strong></div>
          <div className="top-actions"><button className="icon-button notification" aria-label="Notifications"><Bell size={18} /><i /></button><div className="top-avatar">JD</div></div>
        </header>

        {activeView === 'Dashboard' ? (
          <Dashboard tasks={tasks} report={dashboardReport} uploadError={dashboardUploadError} uploading={dashboardUploadLoading} onUpload={handleDashboardUpload} onNavigate={() => navigate('Maintenance plan')} onComplete={markComplete} />
        ) : (
          <MaintenancePlan sourcePlans={sourcePlans} loading={sourceLoading} error={sourceError} onAdd={() => setShowModal(true)} />
        )}
      </main>
      {showModal && <AddTaskModal onClose={() => setShowModal(false)} onAdd={(newTask) => { setTasks((current) => [{ ...newTask, id: Date.now() }, ...current]); setShowModal(false) }} />}
    </div>
  )
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

function toDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function inferFrequency(description, dates) {
  const text = description.toLowerCase()
  if (text.includes('daily') || text.includes('day')) return 'Daily'
  if (text.includes('weekly') || text.includes('week')) return 'Weekly'
  if (text.includes('monthly') || text.includes('month')) return 'Monthly'
  if (text.includes('quarter')) return 'Quarterly'
  if (text.includes('6 monthly') || text.includes('6 month') || text.includes('biannual')) return 'Biannual'
  if (text.includes('annual') || text.includes('annually') || text.includes('12m') || text.includes('year')) return 'Annual'
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
  const machineNames = [...new Set(records.map((record) => record.machine))].sort()
  const machines = machineNames.map((machine) => {
    const items = records.filter((record) => record.machine === machine)
    const done = items.filter((record) => record.completionDate).length
    return { machine, total: items.length, completed: done, rate: items.length ? Math.round((done / items.length) * 100) : 0, priority: ['EMBA', 'Gopfert', '205'].some((priorityMachine) => machine.toLowerCase().includes(priorityMachine.toLowerCase())) }
  }).sort((a, b) => b.rate - a.rate || b.completed - a.completed || a.machine.localeCompare(b.machine))
  return { fileName, total: records.length, completed: completed.length, pending: records.length - completed.length, rate: records.length ? Math.round((completed.length / records.length) * 100) : 0, monthly, frequencies, machines }
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

function DashboardReport({ report }) {
  const priorityMachines = report.machines.filter((machine) => machine.priority)
  return <div className="dashboard-report"><div className="report-source"><div className="file-icon">XLS</div><div><strong>{report.fileName}</strong><span>{report.total.toLocaleString()} maintenance records analyzed from completion date</span></div><span className="report-badge">Live analysis</span></div><div className="metric-grid report-metrics"><MetricCard label="Completed orders" value={report.completed.toLocaleString()} delta={`${report.rate}%`} detail="completion rate" icon={Check} tone="green" chart="completion" /><MetricCard label="Not completed" value={report.pending.toLocaleString()} delta={`${100 - report.rate}%`} detail="still open or missing date" icon={AlertTriangle} tone="orange" chart="overdue" /><MetricCard label="Overall compliance" value={`${report.rate}%`} delta="Completion date" detail="all maintenance periods" icon={Activity} tone="blue" chart="tasks" /><MetricCard label="Priority machines" value={priorityMachines.length} delta="Attention" detail="EMBA · Gopfert · 205" icon={Wrench} tone="purple" chart="uptime" /></div><div className="donut-grid"><section className="panel report-panel"><div className="panel-heading"><div><h2>Completed vs not completed</h2><p>All maintenance records in the uploaded file</p></div></div><OverallCompletionChart report={report} /></section><PlanStatusDonut /></div><section className="panel report-panel machine-panel"><div className="panel-heading"><div><h2>Machine / line compliance</h2><p>All machines · highest to lowest compliance · priority assets highlighted</p></div></div><div className="machine-list">{report.machines.map((machine) => <MachineRow key={machine.machine} machine={machine} />)}</div></section><section className="panel evolution-panel"><div className="panel-heading"><div><h2>Monthly compliance evolution</h2><p>January — December, based on completion date</p></div><span className="chart-legend"><i className="completed-key" />Completed <i className="pending-key" />Not completed <i className="pareto-key" />Pareto</span></div><div className="monthly-chart-wrap"><div className="monthly-chart">{report.monthly.map((month) => <div className="month-column" key={month.label}><div className="month-bars"><div className="month-bar completed-bar" style={{ height: `${Math.max(month.total ? (month.completed / Math.max(...report.monthly.map((item) => item.total), 1)) * 100 : 0, 3)}%` }} title={`${month.completed} completed`} /><div className="month-bar pending-bar" style={{ height: `${Math.max(month.total ? ((month.total - month.completed) / Math.max(...report.monthly.map((item) => item.total), 1)) * 100 : 0, 3)}%` }} title={`${month.total - month.completed} not completed`} /></div><span>{month.label}</span><small>{month.rate}%</small></div>)}</div><ParetoLine monthly={report.monthly} /></div></section></div>
}

function PlanStatusDonut() {
  return <section className="panel report-panel"><div className="panel-heading"><div><h2>Plan status</h2><p>Maintenance by type</p></div></div><div className="overall-completion"><div className="overall-donut plan-status-donut"><div><strong>84%</strong><span>Complete</span></div></div><div className="overall-legend"><div><i className="completed-key" /><span>Preventive</span><strong>62%</strong></div><div><i className="status-blue-key" /><span>Compliance</span><strong>18%</strong></div><div><i className="pending-key" /><span>Calibration</span><strong>12%</strong></div><div className="overall-total">Other 8%</div></div></div></section>
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

function MaintenancePlan({ sourcePlans, loading, error, onAdd }) {
  const [lineFilter, setLineFilter] = useState('All lines / machines')
  const [frequencyFilter, setFrequencyFilter] = useState('All periods')
  const [scheduled, setScheduled] = useState({})
  const [generatedKeys, setGeneratedKeys] = useState({})
  const [weekStart, setWeekStart] = useState(getMonday(new Date('2026-09-10')))
    const [showShutdowns, setShowShutdowns] = useState(true)
  const [generationMessage, setGenerationMessage] = useState('')
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [copyNote, setCopyNote] = useState(null)
  const [notes, setNotes] = useState({})
  useEffect(() => {
    const openGenerator = () => setShowGenerateModal(true)
    window.addEventListener('open-auto-generate', openGenerator)
    return () => window.removeEventListener('open-auto-generate', openGenerator)
  }, [])
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

  if (loading) return <div className="page-wrap loading-state"><div className="loading-spinner" /><h2>Reading maintenance workbook</h2><p>Preparing plans, completion history, and weekly schedule.</p></div>
  if (error) return <div className="page-wrap loading-state"><AlertTriangle size={28} /><h2>Workbook unavailable</h2><p>{error}</p></div>

  return <div className="page-wrap plan-page"><PageIntro eyebrow="Maintenance plan / weekly builder" title="Build your maintenance week" description="Drag a plan from the library into a day. Completion history is calculated from the workbook." />
    <div className="workbook-note"><FileSpreadsheetIcon /><span>Imported from <strong>MAINTENANCE PLANS WITH ORDERS.XLSX</strong></span><span className="record-count">{sourcePlans.length} plans · {totalOrders.toLocaleString()} orders</span></div>
    <div className="shutdown-note"><div className="shutdown-note-title"><Info size={16} /><strong>Machine shutdown windows</strong><button className="icon-button" onClick={() => setShowShutdowns((current) => !current)} aria-label="Toggle shutdown details">{showShutdowns ? <ChevronDown size={16} /> : <ArrowUpRight size={16} />}</button></div>{showShutdowns && <div className="shutdown-grid"><ShutdownItem day="Monday" machine="202" /><ShutdownItem day="Tuesday" machine="EMBA" /><ShutdownItem day="Wednesday" machine="Gopfert" /><ShutdownItem day="Thursday" machine="205" /><ShutdownItem day="Friday · morning" machine="115" /><ShutdownItem day="Friday · afternoon" machine="102" /><ShutdownItem day="Friday · night" machine="616 and 201" /><ShutdownItem day="Saturday & Sunday" machine="MPG (172 and 170)" /></div>} {!showShutdowns && <span className="shutdown-summary">Mon 202 · Tue EMBA · Wed Gopfert · Thu 205 · Fri 115 / 102 / 616 + 201 · Weekend MPG 172 + 170</span>}</div>
    {generationMessage && <div className="generation-message"><WandSparkles size={15} />{generationMessage}<button className="icon-button" onClick={() => setGenerationMessage('')}><X size={14} /></button></div>}
    <div className="plan-summary"><div><strong>{sourcePlans.length}</strong><span>Total plans</span></div><div><strong className="summary-green">{lines.length}</strong><span>Lines / machines</span></div><div><strong className="summary-orange">{scheduledCount}</strong><span>Placed this week</span></div><div><strong className="summary-red">{totalOrders ? Math.round((completedOrders / totalOrders) * 100) : 0}%</strong><span>Orders completed</span></div><div className="summary-progress"><span>{totalOrders ? Math.round((completedOrders / totalOrders) * 100) : 0}% completion from history</span><div><i style={{ width: `${totalOrders ? Math.round((completedOrders / totalOrders) * 100) : 0}%` }} /></div></div></div>
    <div className="planner-layout"><aside className="plan-library"><div className="library-heading"><div><h2>Plan library</h2><p>{filteredPlans.length} plans available</p></div><ListFilter size={17} /></div><div className="library-filters"><div className="library-filter"><span>Line / machine</span><select value={lineFilter} onChange={(event) => setLineFilter(event.target.value)}><option>All lines / machines</option>{lines.map((line) => <option key={line}>{line}</option>)}</select></div><div className="library-filter"><span>Period</span><select value={frequencyFilter} onChange={(event) => setFrequencyFilter(event.target.value)}><option>All periods</option><option>Daily</option><option>Weekly</option><option>Monthly</option><option>Quarterly</option><option>Biannual</option><option>Annual</option></select></div></div><div className="library-list">{filteredPlans.map((plan) => <PlanLibraryCard key={plan.id} plan={plan} onDragStart={(event) => { event.dataTransfer.setData('planId', plan.id); event.dataTransfer.effectAllowed = 'move' }} isScheduled={Object.keys(scheduled).some((key) => key.endsWith(`|${plan.id}`))} />)}</div></aside><section className="weekly-board"><YearWeekMap yearWeeks={yearWeeks} selectedWeekKey={weekKey} scheduled={scheduled} notes={notes} onSelect={setWeekStart} /><div className="week-heading"><button className="icon-button week-arrow" onClick={() => moveWeek(-1)} aria-label="Previous week"><ChevronLeft size={19} /></button><div className="week-title"><h2>Week of {formatWeekRange(weekStart)}</h2><p>{weekPlanCount || weekNotes.length ? `${weekPlanCount} plans · ${weekNotes.length} notes in this weekly schedule` : 'Drag plans or notes here to build the weekly schedule'}</p></div><div className="week-controls"><button className="button button-secondary" onClick={() => setShowNoteModal(true)}><StickyNote size={15} />Add note</button><button className="button button-secondary" onClick={clearGeneratedWeek}><Trash2 size={15} />Clear week</button><button className="button button-danger" onClick={clearGeneratedYear}><Trash2 size={15} />Clear year</button><button className="button button-secondary" onClick={() => setWeekStart(getMonday(new Date('2026-09-10')))}><CalendarDays size={16} />Current week</button><button className="icon-button week-arrow" onClick={() => moveWeek(1)} aria-label="Next week"><ChevronRight size={19} /></button></div></div><div className="calendar-grid">{weekDays.map((day, index) => <div className={`day-column ${day.isToday ? 'current-day' : ''}`} key={day.label} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropPlan(event, index)}><div className="day-heading"><span>{day.label}</span><strong>{day.date}</strong>{day.isToday && <i>Today</i>}<small>{getShutdownWindow(day.index)}</small></div><div className="day-dropzone">{weekPlans.filter(([, dayIndex]) => dayIndex === index).map(([key]) => { const plan = sourcePlans.find((item) => item.id === key.split('|')[1]); return plan ? <ScheduledPlanCard key={plan.id} plan={plan} scheduledKey={key} onRemove={() => removeFromCalendar(plan.id)} /> : null })}{weekNotes.filter((note) => note.dayIndex === index).map((note) => <NoteCard key={note.id} note={note} onRemove={() => removeNote(note.id)} />)}<div className="drop-hint"><Plus size={14} /><span>Drop here</span></div></div></div>)}</div></section></div>
    {showNoteModal && <AddNoteModal weekDays={weekDays} onClose={() => setShowNoteModal(false)} onAdd={(text, dayIndex) => { const id = `note-${Date.now()}`; setNotes((current) => ({ ...current, [id]: { id, text, weekKey, dayIndex } })); setShowNoteModal(false) }} />}
    {copyNote && <CopyNoteModal weekDays={weekDays} note={copyNote} onClose={() => setCopyNote(null)} onCopy={(dayIndex) => { const id = `note-${Date.now()}`; setNotes((current) => ({ ...current, [id]: { ...copyNote, id, dayIndex } })); setCopyNote(null) }} />}
    {showGenerateModal && <GeneratePlansModal lines={lines} onClose={() => setShowGenerateModal(false)} onGenerate={generateYear} />}
    <MaintenancePrintReport weekStart={weekStart} weekDays={weekDays} weekPlans={weekPlans} weekNotes={weekNotes} sourcePlans={sourcePlans} />
  </div>
}

function MaintenancePrintReport({ weekStart, weekDays, weekPlans, weekNotes, sourcePlans }) {
  const findPlan = (key) => sourcePlans.find((plan) => plan.id === key.split('|')[1])
  return <article className="maintenance-print-report"><header className="print-report-header"><div><span className="print-kicker">FIELDMARK · OPERATIONS</span><h1>Weekly maintenance plan</h1><p>Week of {formatWeekRange(weekStart)}</p></div><div className="print-report-meta"><strong>Northstar Plant</strong><span>Generated {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span></div></header><section className="print-calendar"><div className="print-section-heading"><h2>Weekly schedule</h2><span>{weekPlans.length} activities · {weekNotes.length} notes</span></div><div className="print-calendar-grid">{weekDays.map((day, index) => <div className="print-day" key={day.label}><div className="print-day-heading"><span>{day.label}</span><strong>{day.date}</strong></div><div className="print-day-items">{weekPlans.filter(([, dayIndex]) => dayIndex === index).map(([key]) => { const plan = findPlan(key); return plan ? <div className={`print-calendar-card print-${plan.frequency.toLowerCase()}`} key={key}><strong>{plan.activity}</strong><span>{plan.machine} · {plan.frequency}</span></div> : null })}{weekNotes.filter((note) => note.dayIndex === index).map((note) => <div className="print-calendar-note" key={note.id}><strong>Note</strong><span>{note.text}</span></div>)}{!weekPlans.some(([, dayIndex]) => dayIndex === index) && !weekNotes.some((note) => note.dayIndex === index) && <small className="print-empty-day">No activities</small>}</div></div>)}</div></section><section className="print-activity-list"><div className="print-section-heading"><h2>Activities by day</h2><span>Maintenance details and completion history</span></div>{weekDays.map((day, index) => { const dayPlans = weekPlans.filter(([, dayIndex]) => dayIndex === index).map(([key]) => findPlan(key)).filter(Boolean); const dayNotes = weekNotes.filter((note) => note.dayIndex === index); return <div className="print-day-list" key={day.label}><div className="print-list-day"><strong>{day.label}</strong><span>{day.date}</span></div><div className="print-list-content">{dayPlans.map((plan) => <div className="print-activity-row" key={plan.id}><div><strong>{plan.activity}</strong><span>{plan.machine} · Plan {plan.planCode}</span></div><span className={`print-frequency print-${plan.frequency.toLowerCase()}`}>{plan.frequency}</span><span>{plan.completedOrders}/{plan.totalOrders} completed</span><span>{plan.lastCompleted ? `Last completed ${formatPrintDate(plan.lastCompleted)}` : 'Not completed'}</span></div>)}{dayNotes.map((note) => <div className="print-note-row" key={note.id}><strong>Note</strong><span>{note.text}</span></div>)}{!dayPlans.length && !dayNotes.length && <div className="print-no-activity">No scheduled activities</div>}</div></div>})}</section><footer className="print-footer">Source: maintenance plan workbook · Completion status is based on Completion date</footer></article>
}

function formatPrintDate(date) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function PlanLibraryCard({ plan, onDragStart, isScheduled }) {
  return <article className={`library-card frequency-${plan.frequency.toLowerCase()} ${isScheduled ? 'is-scheduled' : ''}`} draggable onDragStart={onDragStart}><div className="drag-grip"><span /><span /><span /></div><div className="library-card-body"><div className="card-kicker"><span className={`frequency-dot ${plan.frequency.toLowerCase()}`} />{plan.frequency}<span className="plan-code">{plan.planCode}</span></div><h3>{plan.activity}</h3><p>{plan.machine}</p><div className="card-meta"><span>{plan.completionRate}% complete</span><span className={`mini-status ${plan.status.toLowerCase()}`}>{plan.status}</span></div><div className="progress-line"><i style={{ width: `${plan.completionRate}%` }} /></div></div></article>
}

function YearWeekMap({ yearWeeks, selectedWeekKey, scheduled, notes, onSelect }) {
  return <div className="year-map"><div className="year-map-heading"><div><h3>2026 week map</h3><p>Click any week to view its complete schedule</p></div><div className="year-map-actions"><button className="button button-secondary" onClick={() => window.print()}><FileDown size={14} />Export PDF</button><button className="button button-secondary" onClick={() => window.dispatchEvent(new CustomEvent('open-auto-generate'))}><WandSparkles size={14} />Auto Generate</button><span>{yearWeeks.length} weeks</span></div></div><div className="year-week-grid">{yearWeeks.map((week) => {
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

function AddTaskModal({ onClose, onAdd }) {
  const [title, setTitle] = useState('')
  const [asset, setAsset] = useState('CNC Mill 04')
  const submit = (event) => { event.preventDefault(); if (!title.trim()) return; onAdd({ title, asset, type: 'Preventive', due: 'Sep 24, 2026', frequency: 'Monthly', owner: 'JD', status: 'Scheduled', priority: 'Medium' }) }
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><div className="eyebrow">New work item</div><h2>Add maintenance task</h2></div><button className="icon-button" onClick={onClose}><X size={19} /></button></div><form onSubmit={submit}><label>Task name<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Inspect cooling system" /></label><label>Asset<select value={asset} onChange={(event) => setAsset(event.target.value)}><option>CNC Mill 04</option><option>Compressor A</option><option>Conveyor Line 2</option><option>Packaging Unit 1</option><option>Boiler Room</option></select></label><div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary">Create task</button></div></form></div></div>
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
