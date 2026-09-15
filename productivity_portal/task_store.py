from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path
from typing import Any

TASKS_PATH = Path(__file__).resolve().parents[1] / "data" / "tasks.json"


def _today() -> date:
    return date.today()


def _parse_date(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def _days_since_creation(created: str) -> int:
    return max(0, (_today() - _parse_date(created)).days)


def _normalise_task(task: dict[str, Any]) -> dict[str, Any]:
    created = str(task.get("data_criacao") or _today().isoformat())
    status = task.get("status") if task.get("status") in {"pendente", "concluido"} else "pendente"
    priority = task.get("prioridade") if task.get("prioridade") in {"P1", "P2", "P3"} else "P2"
    return {
        "id": str(task.get("id") or ""),
        "titulo": str(task.get("titulo") or "Untitled task").strip(),
        "descricao_acao": str(task.get("descricao_acao") or "Define the first practical action.").strip(),
        "prioridade": priority,
        "tempo_estimado": str(task.get("tempo_estimado") or "30 min").strip(),
        "data_criacao": created,
        "status": status,
        "dias_em_atraso": int(task.get("dias_em_atraso") or (0 if status == "concluido" else _days_since_creation(created))),
        "historico_repeticoes": max(1, int(task.get("historico_repeticoes") or 1)),
    }


def load_tasks() -> list[dict[str, Any]]:
    TASKS_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not TASKS_PATH.exists():
        save_tasks([])
        return []
    try:
        payload = json.loads(TASKS_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    return [_normalise_task(task) for task in payload if isinstance(task, dict)]


def save_tasks(tasks: list[dict[str, Any]]) -> None:
    TASKS_PATH.parent.mkdir(parents=True, exist_ok=True)
    clean_tasks = [_normalise_task(task) for task in tasks]
    TASKS_PATH.write_text(json.dumps(clean_tasks, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def refresh_overdue_days(tasks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    refreshed = []
    for task in tasks:
        item = dict(task)
        item["dias_em_atraso"] = 0 if item.get("status") == "concluido" else _days_since_creation(item["data_criacao"])
        refreshed.append(_normalise_task(item))
    return refreshed
