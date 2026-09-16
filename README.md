# MaintenancePlanSW
Maintenance Plan and Dashboard

## Run locally

```bash
npm install
npm run dev
```

The application uses the workbook in `public/MAINTENANCE PLANS WITH ORDERS.XLSX` as its maintenance-plan data source.

## Priority Portal

The Priority Portal is a native screen inside this app (sidebar → "Priority Portal"), so it deploys together with the rest of the app on GitHub Pages. Write a free-form "brain dump" and it extracts action items with priorities (P1/P2/P3) using [OpenRouter](https://openrouter.ai)'s free tier (`openrouter/free`), falling back to a deterministic local parser when no API key is configured or the request fails. Tasks are stored only in the browser's `localStorage` — nothing is sent to a server or committed to source control.

To enable AI extraction, set `VITE_OPENROUTER_API_KEY` in a local `.env` file (see `.env.example`) before running `npm run build`/`npm run dev`. **Note:** this app is a static site (GitHub Pages), so any `VITE_*` variable is compiled into the public JS bundle and is visible to anyone who inspects it — do not use a paid/sensitive key for a publicly deployed build. Without a key, the Priority Portal still works fully offline via its local parser.

### Legacy Streamlit prototype

An earlier Python/Streamlit prototype of the Priority Portal (`app.py`, `productivity_portal/`, `data/tasks.json`) remains in the repository for reference but is no longer the primary implementation and cannot run on GitHub Pages:

```bash
python -m pip install -r requirements.txt
streamlit run app.py --server.address 0.0.0.0 --server.port 8501
```

