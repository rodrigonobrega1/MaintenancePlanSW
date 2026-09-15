from __future__ import annotations

import difflib
from datetime import date
from typing import Any

import streamlit as st

from productivity_portal.ai_parser import extract_tasks
from productivity_portal.task_store import load_tasks, refresh_overdue_days, save_tasks

st.set_page_config(
    page_title="Priority Portal",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded",
)

PRIORITY_META = {
    "P1": {"label": "Critical", "color": "#e05252", "soft": "#fff0f0", "description": "Immediate attention"},
    "P2": {"label": "Important", "color": "#d88b35", "soft": "#fff7e8", "description": "Plan this week"},
    "P3": {"label": "Backlog", "color": "#6483a2", "soft": "#eef5fb", "description": "Keep moving"},
}


def inject_styles() -> None:
    st.markdown(
        """
        <style>
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap');
        :root { --ink:#27313a; --muted:#7d8992; --line:#e4e8eb; --panel:#ffffff; --accent:#d9823b; }
        html, body, [class*="css"] { font-family:'DM Sans', sans-serif; color:var(--ink); }
        .stApp { background:linear-gradient(135deg,#f7f8fa 0%,#f1f3f5 52%,#fbfaf8 100%); }
        [data-testid="stSidebar"] { background:#272c32; border-right:1px solid #3d434a; }
        [data-testid="stSidebar"] * { color:#e9ecef; }
        [data-testid="stSidebar"] .stButton button { background:transparent; border:0; color:#c4c9ce; text-align:left; }
        [data-testid="stSidebar"] .stButton button:hover { background:#383e45; color:white; }
        h1, h2, h3 { font-family:'Space Grotesk', sans-serif !important; letter-spacing:-.4px; }
        h1 { font-size:2rem !important; }
        .portal-eyebrow { color:#b86932; text-transform:uppercase; letter-spacing:1.2px; font-size:.68rem; font-weight:700; margin-bottom:.4rem; }
        .hero-copy { color:#7d8992; margin-top:-.5rem; }
        .source-badge { display:flex; align-items:center; gap:10px; padding:9px 12px; border:1px solid #dfe5e8; border-radius:7px; background:#fff; margin:1rem 0; }
        .source-badge strong { color:#4e5b65; font-size:.85rem; }
        .source-badge span { color:#99a2aa; font-size:.72rem; }
        .live-dot { width:7px; height:7px; border-radius:50%; background:#63a979; display:inline-block; margin-left:auto; }
        .metric-card { background:#fff; border:1px solid var(--line); border-radius:8px; padding:15px; box-shadow:0 5px 18px #27313a08; min-height:105px; }
        .metric-card small { color:#8c969e; text-transform:uppercase; letter-spacing:.6px; font-size:.63rem; font-weight:700; }
        .metric-card strong { display:block; color:#303a43; font:600 1.7rem 'Space Grotesk'; margin:.2rem 0; }
        .metric-card span { color:#99a2aa; font-size:.7rem; }
        .panel-card { background:#fff; border:1px solid var(--line); border-radius:8px; padding:14px; box-shadow:0 5px 18px #27313a08; }
        .lane-title { color:#7e8992; text-transform:uppercase; letter-spacing:.9px; font-size:.66rem; font-weight:700; margin:1rem 0 .5rem; }
        .priority-card { background:#fff; border:1px solid var(--line); border-left:4px solid var(--priority-color); border-radius:7px; padding:12px; margin-bottom:9px; box-shadow:0 4px 12px #27313a08; }
        .priority-card .task-top { display:flex; justify-content:space-between; align-items:center; gap:8px; }
        .priority-card .task-title { color:#303a43; font-weight:700; font-size:.88rem; }
        .priority-pill { display:inline-flex; padding:3px 7px; border-radius:11px; background:var(--priority-soft); color:var(--priority-color); font-size:.63rem; font-weight:700; }
        .priority-card .task-action { color:#77838c; font-size:.75rem; margin:.35rem 0 .65rem; }
        .task-meta { display:flex; flex-wrap:wrap; gap:10px; color:#95a0a8; font-size:.66rem; }
        .task-meta b { color:#5a6670; }
        .overdue-badge { color:#bd4545; background:#fff0f0; border-radius:4px; padding:3px 6px; font-weight:700; font-size:.66rem; }
        .empty-state { text-align:center; color:#96a0a8; padding:2rem 1rem; border:1px dashed #d7dde1; border-radius:7px; background:#fff; }
        .stButton button { border-radius:5px; font-weight:600; }
        .stTextArea textarea, .stTextInput input, .stSelectbox select { border-radius:6px; }
        .ai-note { padding:8px 10px; border-radius:5px; color:#687681; background:#eef3f6; font-size:.72rem; }
        .stTabs [data-baseweb="tab-list"] { gap:18px; }
        .stTabs [data-baseweb="tab"] { font-weight:600; }
        @media print {
          [data-testid="stSidebar"], header, .no-print { display:none !important; }
          .stApp { background:white !important; }
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def similarity(left: str, right: str) -> float:
    return difflib.SequenceMatcher(None, left.lower(), right.lower()).ratio()


def merge_extracted_tasks(existing: list[dict[str, Any]], extracted: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result = [dict(task) for task in existing]
    for incoming in extracted:
        match = next(
            (task for task in result if task["status"] == "pendente" and similarity(task["titulo"], incoming["titulo"]) >= 0.72),
            None,
        )
        if match:
            match["historico_repeticoes"] = int(match.get("historico_repeticoes", 1)) + 1
            match["dias_em_atraso"] = max(match.get("dias_em_atraso", 0), incoming.get("dias_em_atraso", 0))
            if incoming.get("prioridade") == "P1":
                match["prioridade"] = "P1"
        else:
            result.append(incoming)
    return result


def render_task_card(task: dict[str, Any]) -> None:
    meta = PRIORITY_META[task["prioridade"]]
    overdue = task["dias_em_atraso"]
    overdue_markup = f'<span class="overdue-badge">{overdue} days accumulated</span>' if overdue > 0 and task["status"] == "pendente" else ""
    repetitions = task.get("historico_repeticoes", 1)
    st.markdown(
        f"""
        <div class="priority-card" style="--priority-color:{meta['color']};--priority-soft:{meta['soft']}">
          <div class="task-top"><span class="task-title">{task['titulo']}</span><span class="priority-pill">{task['prioridade']} · {meta['label']}</span></div>
          <div class="task-action">{task['descricao_acao']}</div>
          <div class="task-meta"><span>Estimate: <b>{task['tempo_estimado']}</b></span><span>Created: <b>{task['data_criacao']}</b></span><span>Repeated: <b>{repetitions}x</b></span>{overdue_markup}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def main() -> None:
    inject_styles()
    if "tasks" not in st.session_state:
        st.session_state.tasks = refresh_overdue_days(load_tasks())
    if "last_ai_source" not in st.session_state:
        st.session_state.last_ai_source = "Waiting for analysis"

    tasks = st.session_state.tasks
    pending = [task for task in tasks if task["status"] == "pendente"]
    completed = [task for task in tasks if task["status"] == "concluido"]
    overdue = [task for task in pending if task["dias_em_atraso"] > 0]
    critical = [task for task in pending if task["prioridade"] == "P1"]

    with st.sidebar:
        st.markdown("## ⚡ Priority Portal")
        st.caption("Personal productivity control room")
        st.divider()
        st.markdown("### Workspace")
        st.write("🧠 Brain Dump")
        st.write("🎯 Priority Queue")
        st.write("📚 Task History")
        st.divider()
        st.caption("AI engine")
        st.caption(st.session_state.last_ai_source)
        if st.button("↻ Refresh overdue days", use_container_width=True):
            st.session_state.tasks = refresh_overdue_days(st.session_state.tasks)
            save_tasks(st.session_state.tasks)
            st.rerun()

    st.markdown('<div class="portal-eyebrow">AI-assisted personal productivity</div>', unsafe_allow_html=True)
    st.title("Priority Portal")
    st.markdown('<p class="hero-copy">Turn unstructured thoughts into a focused, actionable priority queue.</p>', unsafe_allow_html=True)

    st.markdown(
        f'<div class="source-badge"><strong>Persistent task store</strong><span>{len(tasks)} tasks · {len(pending)} pending · data/tasks.json</span><span class="live-dot"></span></div>',
        unsafe_allow_html=True,
    )

    metrics = st.columns(4)
    for column, label, value, detail in zip(
        metrics,
        ("Critical tasks", "Accumulated days", "Pending tasks", "Completed tasks"),
        (len(critical), sum(task["dias_em_atraso"] for task in overdue), len(pending), len(completed)),
        ("P1 attention", "Across pending work", "All active tasks", "Closed items"),
    ):
        with column:
            st.markdown(f'<div class="metric-card"><small>{label}</small><strong>{value}</strong><span>{detail}</span></div>', unsafe_allow_html=True)

    st.markdown("## Brain Dump")
    st.caption("Write naturally. Gemini will extract action items, priorities, estimates, and first steps.")
    with st.form("brain_dump_form", clear_on_submit=True):
        dump = st.text_area(
            "Daily notes",
            height=150,
            placeholder="Example: The safety audit is blocking the line restart. I need to call maintenance, review the open permit, and send the updated checklist before Friday.",
            label_visibility="collapsed",
        )
        submitted = st.form_submit_button("⚡ Analyze Brain Dump", type="primary", use_container_width=True)

    if submitted:
        if not dump.strip():
            st.warning("Add a few notes before running the analysis.")
        else:
            with st.spinner("Extracting actionable work..."):
                extracted, source = extract_tasks(dump, pending)
            if extracted:
                st.session_state.tasks = refresh_overdue_days(merge_extracted_tasks(tasks, extracted))
                save_tasks(st.session_state.tasks)
                st.session_state.last_ai_source = f"{source} · {len(extracted)} extracted tasks"
                st.success(f"Added {len(extracted)} actionable task(s) to the priority queue.")
                st.rerun()
            else:
                st.info("No actionable tasks were found in that note.")

    st.markdown("## Priority Queue")
    st.caption("P1 is immediate attention, P2 is important this week, and P3 is useful backlog work.")
    tabs = st.tabs(["All active", "P1 · Critical", "P2 · Important", "P3 · Backlog", "Completed"])
    tab_sets = [
        pending,
        [task for task in pending if task["prioridade"] == "P1"],
        [task for task in pending if task["prioridade"] == "P2"],
        [task for task in pending if task["prioridade"] == "P3"],
        completed,
    ]
    tab_keys = ["all-active", "p1-critical", "p2-important", "p3-backlog", "completed"]
    for tab_key, tab, selected_tasks in zip(tab_keys, tabs, tab_sets):
        with tab:
            if not selected_tasks:
                st.markdown('<div class="empty-state">No tasks in this view.</div>', unsafe_allow_html=True)
            else:
                columns = st.columns(3)
                for index, task in enumerate(sorted(selected_tasks, key=lambda item: (item["status"] == "concluido", item["prioridade"], -item["dias_em_atraso"]))):
                    with columns[index % 3]:
                        render_task_card(task)
                        if task["status"] == "pendente":
                            if st.button("Mark complete", key=f"complete-{tab_key}-{task['id']}", use_container_width=True):
                                task["status"] = "concluido"
                                task["dias_em_atraso"] = 0
                                st.session_state.tasks = tasks
                                save_tasks(tasks)
                                st.rerun()
                        else:
                            if st.button("Reopen", key=f"reopen-{tab_key}-{task['id']}", use_container_width=True):
                                task["status"] = "pendente"
                                st.session_state.tasks = refresh_overdue_days(tasks)
                                save_tasks(st.session_state.tasks)
                                st.rerun()


if __name__ == "__main__":
    main()
