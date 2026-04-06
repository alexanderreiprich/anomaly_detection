## Labeling - Active Learning

This module takes a SQLite database containing the measurements and labels them in the categories "Critical", "Warning" and "Acceptable" through an active learning process. The user completes a seed labeling with 50 measurements first. The model then classifies the remaining measurements with the knowledge obtained through the seed labeling. If the confidence score of a label is less than a certain threshold, the user has to classify the measurements. The result gets sent back to the model to improve future labels.

Random Forest and Gradient Boosting are supported.

### Prerequisites 

- Python 3.11

Optional:
- Database stored as .csv in `data/db` that follows the same structure (table names, columns, ...) as the data in module `1_pseudonymization`. If this isn't present, a database with mock data will be created.

### How to run

1. Make sure the database is formatted correctly and all steps from the base README.md are completed.
2. Run `main.py`.

The labeled data is stored in `data/out`.