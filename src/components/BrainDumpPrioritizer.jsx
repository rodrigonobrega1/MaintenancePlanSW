// Brain Dump prioritization screen: turns unstructured notes into a P1/P2/P3 task
// queue, using OpenRouter's free tier for extraction and a deterministic overdue counter.
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, KeyRound, LoaderCircle, Pencil, Sparkles, Trash2, X, Zap } from 'lucide-react'
import { processarPrioridades } from '../services/aiService'
import { calcularDiasAtraso } from '../utils/dateUtils'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const TASKS_STORAGE_KEY = 'fieldmark-brain-dump-tasks'
const API_KEY_STORAGE_KEY = 'fieldmark-openrouter-api-key'

const CATEGORIAS = [
  { chave: 'P1', titulo: '🚨 P1 - Urgente (Hoje)', tone: 'red' },
  { chave: 'P2', titulo: '📌 P2 - Médio Impacto', tone: 'orange' },
  { chave: 'P3', titulo: '⚡ P3 - Rotina', tone: 'blue' },
]

function carregarTarefas() {
  try {
    const salvas = JSON.parse(localStorage.getItem(TASKS_STORAGE_KEY) || '[]')
    return Array.isArray(salvas) ? salvas : []
  } catch {
    return []
  }
}

function gerarId() {
  return `tarefa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export default function BrainDumpPrioritizer() {
  const [tarefas, setTarefas] = useState(() => carregarTarefas())
  const [brainDump, setBrainDump] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [mensagem, setMensagem] = useState('Aguardando análise.')
  const [apiKey, setApiKey] = useState(() => { try { return localStorage.getItem(API_KEY_STORAGE_KEY) || '' } catch { return '' } })
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [showApiKeyPanel, setShowApiKeyPanel] = useState(false)
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured)
  const [authMode, setAuthMode] = useState('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [cloudLoaded, setCloudLoaded] = useState(false)

  useEffect(() => {
    if (!supabase) return undefined
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) { setSession(data.session); setAuthLoading(false) }
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => { mounted = false; listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!supabase || !session?.user) {
      setCloudLoaded(false)
      return
    }
    let mounted = true
    const loadCloudData = async () => {
      const [{ data: cloudTasks }, { data: settings }] = await Promise.all([
        supabase.from('priority_tasks').select('*').order('data_criacao', { ascending: false }),
        supabase.from('priority_settings').select('openrouter_api_key').maybeSingle(),
      ])
      if (!mounted) return
      if (cloudTasks) setTarefas(cloudTasks.map((task) => ({ id: task.id, titulo: task.titulo, prioridade: task.prioridade, acao: task.acao, dataCriacao: task.data_criacao, status: task.status })))
      if (settings?.openrouter_api_key) setApiKey(settings.openrouter_api_key)
      setCloudLoaded(true)
    }
    loadCloudData()
    return () => { mounted = false }
  }, [session])

  useEffect(() => {
    try { localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tarefas)) } catch {}
    if (supabase && session?.user && cloudLoaded) {
      supabase.from('priority_tasks').upsert(tarefas.map((task) => ({
        id: task.id, user_id: session.user.id, titulo: task.titulo, prioridade: task.prioridade,
        acao: task.acao, data_criacao: task.dataCriacao, status: task.status,
      }))).then()
    }
  }, [tarefas, session, cloudLoaded])

  const pendentes = useMemo(() => tarefas.filter((tarefa) => tarefa.status === 'pendente'), [tarefas])
  const concluidas = useMemo(() => tarefas.filter((tarefa) => tarefa.status === 'concluido'), [tarefas])

  const handleAnalisar = async () => {
    if (!brainDump.trim()) return
    setCarregando(true)
    try {
      const { novas_tarefas: novasTarefas, fonte } = await processarPrioridades(brainDump, pendentes, apiKey)
      if (!novasTarefas.length) {
        setMensagem('Nenhuma tarefa acionável foi encontrada nesse texto.')
        return
      }
      const agora = new Date().toISOString()
      const criadas = novasTarefas.map((tarefa) => ({
        id: gerarId(),
        titulo: tarefa.titulo || 'Tarefa sem título',
        prioridade: ['P1', 'P2', 'P3'].includes(tarefa.prioridade) ? tarefa.prioridade : 'P2',
        acao: tarefa.acao_imediata || 'Definir o primeiro passo prático.',
        dataCriacao: agora,
        status: 'pendente',
      }))
      setTarefas((atual) => [...criadas, ...atual])
      setMensagem(`${fonte} · ${criadas.length} tarefa${criadas.length === 1 ? '' : 's'} adicionada${criadas.length === 1 ? '' : 's'}`)
      setBrainDump('')
    } finally {
      setCarregando(false)
    }
  }

  const marcarConcluida = (id) => {
    setTarefas((atual) => atual.map((tarefa) => tarefa.id === id ? { ...tarefa, status: 'concluido' } : tarefa))
  }

  const reabrirTarefa = (id) => {
    setTarefas((atual) => atual.map((tarefa) => tarefa.id === id ? { ...tarefa, status: 'pendente' } : tarefa))
  }

  const deletarTarefa = (id) => {
    setTarefas((atual) => atual.filter((tarefa) => tarefa.id !== id))
    if (supabase && session?.user) supabase.from('priority_tasks').delete().eq('id', id).eq('user_id', session.user.id).then()
  }

  const editarTarefa = (id, changes) => {
    setTarefas((atual) => atual.map((tarefa) => tarefa.id === id ? { ...tarefa, ...changes } : tarefa))
  }

  const handleSalvarApiKey = () => {
    const trimmed = apiKeyDraft.trim()
    setApiKey(trimmed)
    try { localStorage.setItem(API_KEY_STORAGE_KEY, trimmed) } catch {}
    if (supabase && session?.user) supabase.from('priority_settings').upsert({ user_id: session.user.id, openrouter_api_key: trimmed, updated_at: new Date().toISOString() }).then()
    setApiKeyDraft('')
    setShowApiKeyPanel(false)
  }

  const handleRemoverApiKey = () => {
    setApiKey('')
    try { localStorage.removeItem(API_KEY_STORAGE_KEY) } catch {}
    if (supabase && session?.user) supabase.from('priority_settings').delete().eq('user_id', session.user.id).then()
  }

  const handleAuth = async (event) => {
    event.preventDefault()
    setAuthMessage('')
    const result = authMode === 'login'
      ? await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })
      : await supabase.auth.signUp({ email: authEmail, password: authPassword })
    if (result.error) setAuthMessage(result.error.message)
    else setAuthMessage(authMode === 'login' ? 'Login realizado.' : 'Conta criada. Verifique seu e-mail se a confirmação estiver ativada.')
  }

  return (
    <div className="page-wrap plan-dashboard-page priority-portal-page">
      {!isSupabaseConfigured && <div className="upload-error"><AlertTriangle size={15} />Supabase ainda não foi configurado neste ambiente.</div>}
      {isSupabaseConfigured && !session && !authLoading && (
        <section className="plan-filter-panel no-print priority-auth-panel">
          <div className="filter-title"><KeyRound size={16} /><strong>Access your Priority Portal</strong><span>Sign in to keep tasks and settings synchronized across devices.</span></div>
          <form className="priority-auth-form" onSubmit={handleAuth}>
            <input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="Email" required />
            <input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="Password" minLength={6} required />
            <button className="button button-primary" type="submit">{authMode === 'login' ? 'Sign in' : 'Create account'}</button>
            <button className="button button-secondary" type="button" onClick={() => setAuthMode((mode) => mode === 'login' ? 'signup' : 'login')}>{authMode === 'login' ? 'Create account' : 'Back to sign in'}</button>
          </form>
          {authMessage && <p className="auth-message">{authMessage}</p>}
        </section>
      )}
      <div className="plan-dashboard-head">
        <div>
          <div className="eyebrow">Priorização diária com IA</div>
          <h1>Brain Dump &amp; Priorização</h1>
          <p>Descarregue suas ideias e deixe a IA organizar o que é urgente, importante e rotina.</p>
        </div>
        <div className="intro-actions no-print">
          <button className="button button-secondary" onClick={() => setShowApiKeyPanel((current) => !current)}>
            <KeyRound size={15} />{apiKey ? 'Chave OpenRouter configurada' : 'Configurar chave OpenRouter'}
          </button>
        </div>
        {session && <div className="intro-actions no-print"><span className="account-label">{session.user.email}</span><button className="button button-secondary" onClick={() => supabase.auth.signOut()}>Sign out</button></div>}
      </div>

      <div className="plan-source-strip">
        <div className="file-icon">AI</div>
        <div>
          <strong>{apiKey ? 'OpenRouter · openrouter/free' : 'Parser local (sem chave configurada)'}</strong>
          <span>{mensagem}</span>
        </div>
        <span className="live-pill"><i />{apiKey ? 'IA' : 'Local'}</span>
      </div>

      {showApiKeyPanel && (
        <section className="plan-filter-panel no-print">
          <div className="filter-title">
            <KeyRound size={16} />
            <strong>Chave da API OpenRouter</strong>
            <span>Fica salva apenas neste navegador (localStorage) · nunca é enviada ao repositório ou a terceiros além da própria OpenRouter.</span>
          </div>
          <div className="plan-filter-controls">
            <label>
              <span>API key</span>
              <div className="select-wrap">
                <input
                  type="password"
                  value={apiKeyDraft}
                  onChange={(event) => setApiKeyDraft(event.target.value)}
                  placeholder="Cole sua chave sk-or-..."
                  style={{ border: 0, outline: 0, width: '100%', background: 'transparent' }}
                />
              </div>
            </label>
            <button className="button button-primary" disabled={!apiKeyDraft.trim()} onClick={handleSalvarApiKey}>Salvar chave</button>
            {apiKey && <button className="button button-secondary" onClick={handleRemoverApiKey}>Remover chave</button>}
          </div>
        </section>
      )}

      <div className="plan-kpi-grid" style={{ marginTop: 0, marginBottom: 18 }}>
        <div className="plan-kpi plan-kpi-red">
          <div className="plan-kpi-icon"><AlertTriangle size={17} /></div>
          <div><strong>{pendentes.filter((tarefa) => tarefa.prioridade === 'P1').length}</strong><span>P1 urgentes</span><small>Atenção imediata</small></div>
        </div>
        <div className="plan-kpi plan-kpi-orange">
          <div className="plan-kpi-icon"><Sparkles size={17} /></div>
          <div><strong>{pendentes.reduce((soma, tarefa) => soma + calcularDiasAtraso(tarefa.dataCriacao), 0)}</strong><span>Dias acumulados</span><small>Somatório de atraso</small></div>
        </div>
        <div className="plan-kpi plan-kpi-blue">
          <div className="plan-kpi-icon"><Zap size={17} /></div>
          <div><strong>{pendentes.length}</strong><span>Tarefas pendentes</span><small>Todas as categorias</small></div>
        </div>
        <div className="plan-kpi plan-kpi-green">
          <div className="plan-kpi-icon"><Check size={17} /></div>
          <div><strong>{concluidas.length}</strong><span>Tarefas concluídas</span><small>Itens encerrados</small></div>
        </div>
      </div>

      <section className="plan-filter-panel no-print">
        <div className="filter-title">
          <Sparkles size={16} />
          <strong>Descarrego de Ideias / Brain Dump</strong>
          <span>Escreva naturalmente — a IA extrai itens de ação, prioridade e o primeiro passo.</span>
        </div>
        <textarea
          className="notes-textarea priority-dump-textarea"
          rows={4}
          value={brainDump}
          onChange={(event) => setBrainDump(event.target.value)}
          placeholder="Ex.: A auditoria de segurança está travando o restart da linha. Preciso ligar para a manutenção, revisar a permissão em aberto e enviar o checklist atualizado até sexta."
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <button className="button button-primary" disabled={!brainDump.trim() || carregando} onClick={handleAnalisar}>
            {carregando ? <LoaderCircle size={15} className="spin" /> : <Zap size={15} />}
            {carregando ? 'Analisando...' : '🤖 Analisar e Priorizar com IA'}
          </button>
        </div>
      </section>

      {CATEGORIAS.map(({ chave, titulo, tone }) => {
        const tarefasCategoria = pendentes
          .filter((tarefa) => tarefa.prioridade === chave)
          .sort((a, b) => calcularDiasAtraso(b.dataCriacao) - calcularDiasAtraso(a.dataCriacao))
        return (
          <section key={chave} className="priority-category-section">
            <div className="dashboard-section-heading">
              <div><span className="section-kicker">Categoria</span><h2>{titulo}</h2></div>
              <span className="scope-count">{tarefasCategoria.length}</span>
            </div>
            <div className="maintenance-plan-cards priority-task-cards">
              {tarefasCategoria.map((tarefa) => (
                <TarefaCard key={tarefa.id} tarefa={tarefa} tone={tone} onConcluir={marcarConcluida} onDeletar={deletarTarefa} onEditar={editarTarefa} />
              ))}
              {!tarefasCategoria.length && <div className="empty-dashboard">Nenhuma tarefa nesta categoria.</div>}
            </div>
          </section>
        )
      })}

      <section className="priority-category-section">
        <div className="dashboard-section-heading">
          <div><span className="section-kicker">Histórico</span><h2>✅ Concluídas</h2></div>
          <span className="scope-count">{concluidas.length}</span>
        </div>
        <div className="maintenance-plan-cards priority-task-cards">
          {concluidas.map((tarefa) => (
            <TarefaCard key={tarefa.id} tarefa={tarefa} tone="green" onReabrir={reabrirTarefa} onDeletar={deletarTarefa} onEditar={editarTarefa} />
          ))}
          {!concluidas.length && <div className="empty-dashboard">Nenhuma tarefa concluída ainda.</div>}
        </div>
      </section>
    </div>
  )
}

function TarefaCard({ tarefa, tone, onConcluir, onReabrir, onDeletar, onEditar }) {
  const [editando, setEditando] = useState(false)
  const [titulo, setTitulo] = useState(tarefa.titulo)
  const [acao, setAcao] = useState(tarefa.acao)
  const [prioridade, setPrioridade] = useState(tarefa.prioridade)
  const concluida = tarefa.status === 'concluido'
  const diasAtraso = concluida ? 0 : calcularDiasAtraso(tarefa.dataCriacao)
  const stateTone = concluida ? 'on-track' : prioridade === 'P1' ? 'critical' : prioridade === 'P2' ? 'overdue' : 'due-soon'

  const iniciarEdicao = () => {
    setTitulo(tarefa.titulo)
    setAcao(tarefa.acao)
    setPrioridade(tarefa.prioridade)
    setEditando(true)
  }

  const salvarEdicao = () => {
    if (!titulo.trim()) return
    onEditar(tarefa.id, { titulo: titulo.trim(), acao: acao.trim(), prioridade })
    setEditando(false)
  }

  return (
    <article className={`maintenance-plan-card priority-task-card card-${stateTone}`}>
      <div className="plan-card-top">
        <label className="priority-task-checkbox">
          <input
            type="checkbox"
            checked={concluida}
            onChange={() => (concluida ? onReabrir?.(tarefa.id) : onConcluir?.(tarefa.id))}
          />
          <span>{concluida ? 'Concluída' : 'Marcar como concluída'}</span>
        </label>
        <span className={`plan-state state-${stateTone}`}><i />{tarefa.prioridade}</span>
      </div>
      {editando ? (
        <div className="priority-task-edit-form">
          <input value={titulo} onChange={(event) => setTitulo(event.target.value)} aria-label="Task title" />
          <textarea value={acao} onChange={(event) => setAcao(event.target.value)} rows={3} aria-label="Immediate action" />
          <label><span>Categoria</span><select value={prioridade} onChange={(event) => setPrioridade(event.target.value)}><option value="P1">P1 - Urgente</option><option value="P2">P2 - Médio impacto</option><option value="P3">P3 - Rotina</option></select></label>
          <div className="priority-task-edit-actions">
            <button className="button button-primary note-small-btn" onClick={salvarEdicao}><Check size={13} />Salvar</button>
            <button className="button button-secondary note-small-btn" onClick={() => setEditando(false)}><X size={13} />Cancelar</button>
          </div>
        </div>
      ) : (
        <><h3>{tarefa.titulo}</h3><p>{tarefa.acao}</p></>
      )}
      <div className="plan-card-meta">
        <span><small>Criada em</small><strong>{new Date(tarefa.dataCriacao).toLocaleDateString('pt-BR')}</strong></span>
      </div>
      {diasAtraso > 0 && <div className="delay-badge"><AlertTriangle size={13} />⚠️ {diasAtraso} dia{diasAtraso === 1 ? '' : 's'} em atraso</div>}
      <div className="priority-task-footer no-print">
        <div className="priority-task-actions">
          {!editando && <button className="icon-button note-action-btn note-edit-btn" onClick={iniciarEdicao} aria-label="Editar tarefa" title="Editar tarefa"><Pencil size={13} /></button>}
          <button className="icon-button note-action-btn note-delete-btn" onClick={() => onDeletar(tarefa.id)} aria-label="Excluir tarefa" title="Excluir tarefa">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </article>
  )
}
