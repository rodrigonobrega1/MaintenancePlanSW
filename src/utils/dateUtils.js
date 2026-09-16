// Utilities for day-based overdue calculations used by the priority queue.

/**
 * Returns how many whole calendar days have passed since a task was created.
 * Both dates have their time zeroed out so only full days are counted.
 * @param {string} dataCriacaoISO - ISO date string (e.g. "2026-09-10").
 * @returns {number} Whole days elapsed since creation (0 if same day or in the future).
 */
export function calcularDiasAtraso(dataCriacaoISO) {
  const criacao = new Date(dataCriacaoISO)
  if (Number.isNaN(criacao.getTime())) return 0

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  criacao.setHours(0, 0, 0, 0)

  const diffDias = Math.floor((hoje - criacao) / (1000 * 60 * 60 * 24))
  return diffDias > 0 ? diffDias : 0
}
