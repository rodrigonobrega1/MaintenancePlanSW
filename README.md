# MaintenancePlanSW
Maintenance Plan and Dashboard

## Run locally

```bash
npm install
npm run dev
```

The application uses the workbook in `public/MAINTENANCE PLANS WITH ORDERS.XLSX` as its maintenance-plan data source.

## Priority Portal

The Priority Portal is now a native screen inside this app (sidebar → "Priority Portal"), so it deploys together with the rest of the app on GitHub Pages. It lets you write a free-form "brain dump", extracts action items with Google Gemini (`gemini-2.5-flash`) when you provide your own API key, and falls back to a local deterministic parser otherwise. Tasks and your API key are stored only in the browser's `localStorage` — nothing is sent to a server or committed to source control.

To enable Gemini extraction, open the Priority Portal screen and click "Set Gemini key" to paste your own key.

### Legacy Streamlit prototype

An earlier Python/Streamlit prototype of the Priority Portal (`app.py`, `productivity_portal/`, `data/tasks.json`) remains in the repository for reference but is no longer the primary implementation and cannot run on GitHub Pages:

```bash
python -m pip install -r requirements.txt
streamlit run app.py --server.address 0.0.0.0 --server.port 8501
```

