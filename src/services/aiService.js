// AI service that turns a free-form "brain dump" into structured, prioritized tasks
// using OpenRouter's free tier, with a deterministic local fallback.

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL_NAME = 'openrouter/free'

const SYSTEM_PROMPT = `Você é um assistente de produtividade executiva.
Analise o "brain dump" do usuário e extraia apenas tarefas acionáveis.
Responda SOMENTE com um JSON estritamente no formato abaixo, sem markdown e sem texto adicional:
{"novas_tarefas": [{"titulo": "Nome objetivo da tarefa", "prioridade": "P1" | "P2" | "P3", "acao_imediata": "Primeiro passo prático"}]}
Regras: P1 é urgente/hoje/alto impacto, P2 é médio impacto, P3 é rotina; nunca invente tarefas que não estejam no texto; seja objetivo e conciso.`

// Resolves the OpenRouter key: an explicit override wins, otherwise fall back to the
// build-time env var. NOTE: on a static host (e.g. GitHub Pages) any VITE_ env var is
// baked into the public JS bundle and is visible to every visitor, so for production use
// prefer letting each user paste their own key at runtime (stored only in localStorage).
function resolveApiKey(apiKeyOverride) {
  if (apiKeyOverride) return apiKeyOverride
  try {
    return import.meta.env.VITE_OPENROUTER_API_KEY || ''
  } catch {
    return ''
  }
}

function inferirPrioridade(texto) {
  const lower = texto.toLowerCase()
  if (/(urgente|critico|crítico|hoje|imediato|bloqueado|parada)/.test(lower)) return 'P1'
  if (/(importante|essa semana|prazo|em breve)/.test(lower)) return 'P2'
  return 'P3'
}

// Deterministic local parser used when no API key is configured or the request fails.
function processarLocalmente(brainDumpTexto) {
  const blocos = brainDumpTexto
    .split(/\n+|;+/)
    .map((linha) => linha.replace(/^[\s\-•\t]+/, '').trim())
    .filter(Boolean)

  return blocos.map((bloco) => {
    const [primeiraParte, ...resto] = bloco.split(':')
    const titulo = (primeiraParte || bloco).trim().slice(0, 120)
    const acao = resto.length
      ? resto.join(':').trim().slice(0, 240)
      : `Definir o primeiro passo prático para: ${bloco}`.slice(0, 240)

    return {
      titulo: titulo.charAt(0).toUpperCase() + titulo.slice(1),
      prioridade: inferirPrioridade(bloco),
      acao_imediata: acao,
    }
  })
}

/**
 * Sends a brain dump to OpenRouter's free model and returns structured, prioritized tasks.
 * Falls back to a deterministic local parser when no API key is set or the request fails.
 * @param {string} brainDumpTexto - Raw, unstructured text describing pending work.
 * @param {Array} tarefasPendentes - Existing pending tasks, used as context to avoid duplicates.
 * @param {string} [apiKeyOverride] - Optional runtime API key (e.g. from a settings field),
 *   takes precedence over VITE_OPENROUTER_API_KEY.
 * @returns {Promise<{ novas_tarefas: Array, fonte: string }>}
 */
export async function processarPrioridades(brainDumpTexto, tarefasPendentes = [], apiKeyOverride = '') {
  const apiKey = resolveApiKey(apiKeyOverride)

  if (!apiKey) {
    return { novas_tarefas: processarLocalmente(brainDumpTexto), fonte: 'Parser local (sem chave configurada)' }
  }

  const userPrompt = `Brain dump:\n${brainDumpTexto}\n\nTarefas pendentes existentes (evite duplicar, a menos que o texto claramente repita uma delas):\n${JSON.stringify(tarefasPendentes.map((tarefa) => tarefa.titulo))}`

  try {
    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      }),
    })

    if (!response.ok) throw new Error(`OpenRouter request failed with status ${response.status}`)

    const payload = await response.json()
    const rawContent = payload?.choices?.[0]?.message?.content || ''
    const cleaned = rawContent.replace(/```json/gi, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    const novasTarefas = Array.isArray(parsed.novas_tarefas) ? parsed.novas_tarefas : []

    if (!novasTarefas.length) throw new Error('OpenRouter returned no tasks')

    return { novas_tarefas: novasTarefas, fonte: 'OpenRouter (openrouter/free)' }
  } catch (error) {
    return { novas_tarefas: processarLocalmente(brainDumpTexto), fonte: 'Parser local (OpenRouter indisponível)' }
  }
}
