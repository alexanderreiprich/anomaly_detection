## Active Learning Backend

This module uses the components from 2_uroflow_labeling to build a backend that is connected to a Supabase instance where the database is hosted.
This allows local testing as well as communication between the 3_labeling_webapp to the actual training module.

### Prerequisites

- Python 3.11
- `.env` file structured like .env.example

### How to run

1. Make sure the information in the `.env` is valid and correct
2. Run `pip install -r 4_al_backend/requirements.txt`
3. Run `cd 4_al_backend && uvicorn service.api:app --reload`

You can now access http://localhost:8000/docs#/ and check using the /health endpoint if everything works as intended.