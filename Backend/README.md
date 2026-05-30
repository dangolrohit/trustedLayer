# Alternative Trust Layer Backend

Production-oriented Django 5 + DRF backend for phone-first trust scoring of unbanked micro-merchants.

## Setup

```powershell
cd Backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Configure `.env` with the external Supabase PostgreSQL connection string and Supabase service role key. Create a private Supabase Storage bucket named `bank-statements`.

## Key Endpoints

- `POST /api/auth/register/`
- `POST /api/auth/login/`
- `POST /api/auth/refresh/`
- `GET /api/auth/me/`
- `GET /api/profiles/dashboard/`
- `POST /api/bank-statements/upload/`
- `GET /api/bank-statements/`
- `POST /api/psychometric/`
- `POST /api/guarantors/`
- `GET /api/trust-score/`
- `GET /api/trust-score/history/`
- `POST /api/trust-score/simulate/`
- `POST /api/loans/`
- `POST /api/loans/{id}/review/`

## Bank Statement Upload

Send multipart form-data:

```text
file=<PDF, max 5MB>
```

The backend uploads the PDF to Supabase Storage, creates a signed URL, extracts text with `pdfplumber`, parses common credit/debit transaction rows, stores analysis JSON, and recalculates the merchant trust score.
