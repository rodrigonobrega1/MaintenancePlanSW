from __future__ import annotations

import json
import os
import re
import uuid
from datetime import date
from typing import Any

from dotenv import load_dotenv

load_dotenv()

MODEL_NAME = "gemini-2.5-flash"
PRIORITIES = {"P1", "P2", "P3"}


def _fallback_priority(text: str) -> str:
    lowered = text.lower()
    if any(word in lowered for word in ("urgent", "critical", "today", "asap", "blocked", "incident")):
        return "P1"
    if any(word in lowered for word in ("important", "soon", "this week", "deadline")):
        return "P2"
    return "P3"


def _fallback_parse(dump: str) -> list[dict[str, Any]]:
    chunks = [chunk.strip(" -•\t") for chunk in re.split(r"\n+|[;]+", dump) if chunk.strip()]
    tasks = []
    for chunk in chunks:
        title = chunk.split(":", 1)[0].strip().capitalize()
        action = chunk.split(":", 1)[1].strip() if ":" in chunk else f"Define the first practical step for: {chunk}."
        tasks.append({
            "id": str(uuid.uuid4()),
            "titulo": title[:120],
            "descricao_acao": action[:240],
            "prioridade": _fallback_priority(chunk),
            "tempo_estimado": "30 min",
            "data_criacao": date.today().isoformat(),
            "status": "pendente",
            "dias_em_atraso": 0,
            "historico_repeticoes": 1,
        })
    return tasks


def _normalise_ai_task(task: dict[str, Any]) -> dict[str, Any]:
    priority = str(task.get("prioridade", "P2")).upper()
    return {
        "id": str(uuid.uuid4()),
        "titulo": str(task.get("titulo") or "Untitled task").strip(),
        "descricao_acao": str(task.get("descricao_acao") or "Define the first practical action.").strip(),
        "prioridade": priority if priority in PRIORITIES else "P2",
        "tempo_estimado": str(task.get("tempo_estimado") or "30 min").strip(),
        "data_criacao": date.today().isoformat(),
        "status": "pendente",
        "dias_em_atraso": 0,
        "historico_repeticoes": 1,
    }


def extract_tasks(dump: str, pending_tasks: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], str]:
    """Extract actionable tasks with Gemini, falling back to a local parser."""
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return _fallback_parse(dump), "Local parser"

    try:
        from google import genai

        client = genai.Client(api_key=api_key)
        prompt = f"""You are an executive productivity assistant.
Analyze the user's brain dump and extract only actionable tasks.
Return ONLY valid JSON with this exact shape: {{"tasks": [{{"titulo": "...", "descricao_acao": "...", "prioridade": "P1|P2|P3", "tempo_estimado": "..."}}]}}
Rules: write every field in English; keep titles concise; P1 means urgent or high consequence, P2 means important, P3 means useful but deferrable; do not invent tasks.
Brain dump:
{dump}

Existing pending tasks for context. Avoid duplicating an existing task unless the brain dump clearly repeats it:
{json.dumps(pending_tasks, ensure_ascii=False)}"""
        response = client.models.generate_content(model=MODEL_NAME, contents=prompt)
        raw = response.text.strip().replace("```json", "").replace("```", "").strip()
        data = json.loads(raw)
        tasks = [_normalise_ai_task(item) for item in data.get("tasks", []) if isinstance(item, dict)]
        return tasks, "Gemini"
    except Exception:
        return _fallback_parse(dump), "Local parser fallback"
