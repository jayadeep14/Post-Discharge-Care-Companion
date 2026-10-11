# CALL-E Post-Discharge Care Companion

CALL-E is a post-discharge care coordination application with a hospital dashboard, patient portal, and Python API. Care teams can review patient information, follow-up activity, medication adherence, and readmission risk. Patients can review recovery information, documents, medications, and follow-up calls, and use the chat assistant for education.

The application uses React, TypeScript, and Vite for the frontend; FastAPI for the backend; and Supabase for database access and realtime updates. Optional integrations support CALL-E outbound calls, Gemini-powered education, and a WhatsApp Web bridge.

## Features

- Hospital views for patient records, reports, settings, and readmission risk alerts.
- Patient views for recovery overview, care plans, call history, alerts, documents, medication adherence, and chat.
- API endpoints for outbound follow-up calls, medication education, patient chat, and readmission reports and scoring.
- Scheduled follow-up processing and a Supabase realtime listener started with the API.
- Readmission estimates using the packaged model and feature artifacts in `backend/`.
- Optional WhatsApp webhook and local WhatsApp Web bridge.

## Repository layout

```text
backend/                 FastAPI application, integrations, services, and model artifacts
backend/whatsapp-bridge/ Optional Node.js WhatsApp Web bridge
frontend/                React, TypeScript, and Vite application
supabase/migrations/     SQL migrations for application features
supabase/                Optional readmission development seed data
```

## Requirements

- Python 3.10 or newer
- Node.js and npm
- A Supabase project with the base application schema and required migrations
- Credentials for the integrations you enable

## Configuration

Create `backend/.env`:

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-server-side-supabase-key
CALLE_API_KEY=your-calle-api-key
WEBHOOK_URL=https://your-public-api-host/api/v1/calle/webhook
GEMINI_API_KEY=your-gemini-api-key
APP_ENV=development
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
ENABLE_HSTS=false

# Needed for the WhatsApp webhook and optional local bridge
VERIFY_TOKEN=your-webhook-verification-token
LOCAL_GATEWAY_URL=http://127.0.0.1:3000/send
```

Create `frontend/.env.local` for local development:

```dotenv
VITE_API_URL=http://127.0.0.1:8000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your-supabase-anon-key
```

The frontend uses the Supabase anon key. Keep service role keys and other private credentials on the server, and configure Supabase row-level security before using real patient data. Environment files are excluded from Git.

Apply the SQL files under `supabase/migrations/` in filename order. They add or modify feature tables; they do not create the complete base schema. The backend and frontend also expect the base tables referenced in `backend/database/repository.py` and application screens.

## Run locally

### Backend

From the repository root:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

The health endpoint is `http://127.0.0.1:8000/`. In development, interactive API documentation is at `http://127.0.0.1:8000/docs`; API docs are disabled when `APP_ENV=production`. The backend requires its CALL-E configuration at startup. Gemini-powered chat, medication explanations, and WhatsApp replies require `GEMINI_API_KEY`.

### Frontend

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Vite prints the local URL, normally `http://localhost:5173`.

Available frontend commands from `frontend/`:

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

### Optional WhatsApp bridge

Start the Node bridge in another terminal:

```bash
cd backend/whatsapp-bridge
npm install
node bridge.cjs
```

The bridge listens locally on port 3000 and provides the send endpoint configured by `LOCAL_GATEWAY_URL`. Link a WhatsApp account by scanning its QR code. Configure the WhatsApp webhook URL to point to the Python API's `/webhook` endpoint and set the matching `VERIFY_TOKEN`. The bridge keeps a local linked-device session; treat that session as private.

## Readmission estimates

The backend loads `backend/readmission_model.joblib` and `backend/model_features.joblib`. Patient-specific structured features are read from `ml_feature_sets.hospital_features_json`, and saved estimates are written to `readmission_predictions`. Hospital and patient views use the saved results. The model does not read PDF documents directly; relevant values must be entered or extracted into supported structured fields.

Both model artifacts must be present for scoring, with a compatible scikit-learn version. Missing or unsupported inputs can make a score unavailable. The sample data in `supabase/seed_readmission_samples.sql` is optional development data; its `Readmitted` label is not a model input. Estimates support care coordination and do not replace clinical review.

## Notes

- Local demo sign-in is implemented in `frontend/src/lib/demoAuth.ts`. It is for demos and is not production authentication or access control.
- Automated follow-up jobs run when the FastAPI application starts. Review scheduling and calling configuration before enabling calls against real patients.
- This software supports care coordination and patient education. It does not replace a clinician's judgment or emergency services.
