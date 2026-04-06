## Labeling - Hard Rules

This module takes a SQLite database containing the measurements and labels them in the categories "Critical", "Warning" and "Acceptable" according to specific rules defined in `labeling/rules.py`.

### Prerequisites 

- Python 3.11
- Database stored as .csv in `data/db` that follows the same structure (table names, columns, ...) as the data in module `1_pseudonymization`.

### How to run

1. Make sure the database is formatted correctly and all steps from the base README.md are completed.
2. Run the individual cells in the Jupyter Notebook `uro_active_learning.ipynb`.

The labeled data is stored in `data/out`.

