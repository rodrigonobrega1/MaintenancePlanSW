// Brain Dump prioritization screen: turns unstructured notes into a P1/P2/P3 task
// queue, using OpenRouter's free tier for extraction and a deterministic overdue counter.
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, LoaderCircle, Sparkles, Trash2, Zap } from 'lucide-react'
import { processarPrioridades } from '../services/aiService'
import { calcularDiasAtraso } from '../utils/dateUtils'

const TASKS_STORAGE_KEY = 'fieldmark-brain-dump-tasks'

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

  useEffect(() => {
    try { localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tarefas)) } catch {}
  }, [tarefas])

  const pendentes = useMemo(() => tarefas.filter((tarefa) => tarefa.status === 'pendente'), [tarefas])
  const concluidas = useMemo(() => tarefas.filter((tarefa) => tarefa.status === 'concluido'), [tarefas])

  const handleAnalisar = async () => {
    if (!brainDump.trim()) return
    setCarregando(true)
    try {
      const { novas_tarefas: novasTarefas, fonte } = await processarPrioridades(brainDump, pendentes)
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
  }

  return (
    <div className="page-wrap plan-dashboard-page priority-portal-page">
      <div className="plan-dashboard-head">
        <div>
          <div className="eyebrow">Priorização diária com IA</div>
          <h1>Brain Dump &amp; Priorização</h1>
          <p>Descarregue suas ideias e deixe a IA organizar o que é urgente, importante e rotina.</p>
        </div>
      </div>

      <div className="plan-source-strip">
        <div className="file-icon">AI</div>
        <div>
          <strong>OpenRouter · openrouter/free</strong>
          <span>{mensagem}</span>
        </div>
        <span className="live-pill"><i />IA</span>
      </div>

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
                <TarefaCard key={tarefa.id} tarefa={tarefa} tone={tone} onConcluir={marcarConcluida} onDeletar={deletarTarefa} />
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
            <TarefaCard key={tarefa.id} tarefa={tarefa} tone="green" onReabrir={reabrirTarefa} onDeletar={deletarTarefa} />
          ))}
          {!concluidas.length && <div className="empty-dashboard">Nenhuma tarefa concluída ainda.</div>}
        </div>
      </section>
    </div>
  )
}

function TarefaCard({ tarefa, tone, onConcluir, onReabrir, onDeletar }) {
  const concluida = tarefa.status === 'concluido'
  const diasAtraso = concluida ? 0 : calcularDiasAtraso(tarefa.dataCriacao)
  const stateTone = concluida ? 'on-track' : tone === 'red' ? 'critical' : tone === 'orange' ? 'overdue' : 'due-soon'

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
      <h3>{tarefa.titulo}</h3>
      <p>{tarefa.acao}</p>
      <div className="plan-card-meta">
        <span><small>Criada em</small><strong>{new Date(tarefa.dataCriacao).toLocaleDateString('pt-BR')}</strong></span>
      </div>
      {diasAtraso > 0 && <div className="delay-badge"><AlertTriangle size={13} />⚠️ {diasAtraso} dia{diasAtraso === 1 ? '' : 's'} em atraso</div>}
      <div className="priority-task-footer no-print">
        <div className="priority-task-actions">
          <button className="icon-button note-action-btn note-delete-btn" onClick={() => onDeletar(tarefa.id)} aria-label="Excluir tarefa" title="Excluir tarefa">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </article>
  )
}
