const recipient = 'rodrigo.nobrega@smurfitwestrock.co.uk'
const senderName = 'Priority Portal - Maintenance Planning'
const londonFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function londonParts() {
  const parts = Object.fromEntries(londonFormatter.formatToParts(new Date()).map(({ type, value }) => [type, value]))
  return { hour: Number(parts.hour), minute: Number(parts.minute), date: `${parts.year}-${parts.month}-${parts.day}` }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] || character)
}

async function supabaseRest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  if (!response.ok) throw new Error(await response.text())
  return response.status === 204 ? null : response.json()
}

Deno.serve(async (request) => {
  const cronSecret = Deno.env.get('PRIORITY_CRON_SECRET')
  const requestSecret = request.headers.get('x-priority-cron-secret')
  if (!cronSecret || requestSecret !== cronSecret) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const now = londonParts()
  if (now.hour !== 10 || now.minute >= 15) {
    return Response.json({ skipped: true, reason: 'Outside 10:00 Europe/London window', londonTime: now })
  }

  const resendKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')
  if (!resendKey || !fromEmail) return Response.json({ error: 'Missing RESEND_API_KEY or RESEND_FROM_EMAIL' }, { status: 500 })

  const alreadySent = await supabaseRest(`priority_reminder_log?select=id&reminder_date=eq.${now.date}&limit=1`)
  if (alreadySent) return Response.json({ skipped: true, reason: 'Reminder already sent today', date: now.date })

  const tasks = await supabaseRest('priority_tasks?select=titulo,acao,data_criacao&prioridade=eq.P1&status=eq.pendente&order=data_criacao.asc')
  if (!tasks?.length) return Response.json({ sent: false, reason: 'No pending P1 tasks', date: now.date })

  const rows = tasks.map((task, index) => `<tr><td style="padding:10px;border-bottom:1px solid #e5e7eb;color:#6b7280">${index + 1}</td><td style="padding:10px;border-bottom:1px solid #e5e7eb"><strong>${escapeHtml(task.titulo)}</strong><br><span style="color:#6b7280">${escapeHtml(task.acao || '')}</span></td></tr>`).join('')
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${senderName} <${fromEmail}>`,
      to: [recipient],
      subject: `Priority Portal: ${tasks.length} P1 action${tasks.length === 1 ? '' : 's'} require attention`,
      html: `<div style="font-family:Arial,sans-serif;max-width:680px;color:#25282d"><h1 style="font-size:22px">Priority Portal reminder</h1><p>There ${tasks.length === 1 ? 'is' : 'are'} <strong>${tasks.length} pending P1 action${tasks.length === 1 ? '' : 's'}</strong> requiring attention today.</p><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:10px;background:#f3f4f6">#</th><th style="text-align:left;padding:10px;background:#f3f4f6">Action</th></tr></thead><tbody>${rows}</tbody></table><p style="color:#6b7280;font-size:12px">Sent at 10:00 Europe/London by ${senderName}.</p></div>`,
    }),
  })
  if (!response.ok) return Response.json({ error: await response.text() }, { status: 502 })

  await supabaseRest('priority_reminder_log', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ reminder_date: now.date, task_count: tasks.length }) })
  return Response.json({ sent: true, taskCount: tasks.length, date: now.date })
})
