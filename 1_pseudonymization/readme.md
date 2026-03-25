## Pseudonymization

This module takes and formats the original data and pseudonymizes sensitive information.

### Prerequisites 

- Python 3.11
- Data stored as .csv in data/raw that follows the same structure (table names, columns, ...) as needed in the config.yaml

### How to run

1. Create a virtual environment using `python -m venv venv`
2. Activate the environment using `source venv/bin/activate` 
3. Install the requirements using `pip install -r requirements.txt`
4. Run the scripts in numerical order: `python 01_import.py`, ...  

