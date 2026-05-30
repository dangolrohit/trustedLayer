# CreditKarma — Developer README

This repository contains a Django backend and a Vite + React TypeScript frontend for the CreditKarma demo application.

Folders
- `Backend/` — Django 5.x API, models, services and tests.
- `Frontend/` — Vite + React + TypeScript UI.

Quick setup (Windows)

1) Backend

```powershell
cd Backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
# create a superuser if needed
python manage.py createsuperuser
```

Run backend dev server

```powershell
cd Backend
.\.venv\Scripts\Activate.ps1
python manage.py runserver
```

Run backend tests

```powershell
cd Backend
.\.venv\Scripts\Activate.ps1
python manage.py test
```

Note: If `ModuleNotFoundError: No module named 'django'` appears, ensure you activated the same virtual environment where `requirements.txt` was installed.

Supabase / Production Postgres

This project supports using a Supabase Postgres database for production deployments. To use Supabase (or any external Postgres), set the `DATABASE_URL` environment variable and enable `USE_SUPABASE_POSTGRES` in your `.env` or environment configuration. Example `.env` values:

```
USE_SUPABASE_POSTGRES=True
DATABASE_URL=postgresql://postgres:<password>@db.<your-supabase-host>.supabase.co:5432/postgres
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_STORAGE_BUCKET=bank-statements
```

The Django settings will automatically set `sslmode=require` for Postgres connections. Ensure your Supabase DB user and network rules allow connections from your deployment environment.

2) Frontend

```powershell
cd Frontend
npm install
npm run dev      # local dev server
npm run build    # production bundle
```

Implemented flows (what's included)

- Role-based navigation and guards (`admin`, `loan_department`, `merchant`).
- Merchant onboarding (`/app/onboarding`): psychometric -> behavioral -> social (guarantor) flows; submits to the API and triggers trust score recalculation.
- Bank statement upload (`/app/merchant/statements`): accepts `.pdf,.xls,.xlsx,.xlsb,.csv`, uploads to `/bank-statements/upload/`, displays parsed transactions, and updates local `user.profile.trust_score` from API response.
- Loan flow:
  - Merchant side: apply for loans at `/app/merchant/loans` (POST `/loans/`) and view applications.
  - Loan department side: review pending applications at `/app/loans/applied` (POST `/loans/{id}/review/`).
- Admin pages scaffolded: user management, staff management, statements, loans.

API helpers (frontend)

See `Frontend/src/lib/api.ts` for helper functions:
- `uploadBankStatement(file, merchantId)` — uploads file and returns parsed statement and trust score.
- `submitPsychometric`, `submitBehavioral`, `addGuarantor` — onboarding helpers.
- `submitLoan`, `listLoans`, `reviewLoan` — loan flows.

Testing and CI recommendations

Backend tests: run `python manage.py test` in a dedicated virtualenv; existing `Backend/core/tests.py` includes basic workflow tests.
Frontend tests: consider `vitest` + `@testing-library/react` to validate UI components and flows.

Notes on CI: You requested not to use CI. If you later want CI, prefer a workflow that mirrors your Supabase production environment (sets `DATABASE_URL` to a test Supabase instance or uses temporary managed Postgres). For now this repo contains local setup instructions only.

Next suggested work items

- Add unit/integration tests for frontend flows (upload, onboarding, loan apply).
- Improve UX: progress indicators, validation, confirmation modals.
- Add audit logs and notification triggers on loan reviews.
- Add CSV fallback parsing on backend for malformed Excel files.

If you'd like, I can:
- Add a CI GitHub Actions workflow (backend test + frontend build).
- Implement frontend tests for the onboarding and statement upload flows.
- Add confirmation modals and better validation for loan review actions.

Tell me which of these you'd like next and I will proceed step-by-step.
