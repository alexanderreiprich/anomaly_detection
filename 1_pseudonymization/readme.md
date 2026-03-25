## Pseudonymization

This module takes and formats the original data and pseudonymizes sensitive information. The `config.yaml` file describes the tables and columns created with the pseudonymized data as well as the pseudonymization method used.

### Prerequisites 

- Python 3.11
- Data stored as .csv in `data/raw` that follows the same structure (table names, columns, ...) as needed in the `config.yaml`

### How to run

1. Create a virtual environment using `python -m venv venv`.
2. Activate the environment using `source venv/bin/activate`.
3. Install the requirements using `pip install -r requirements.txt`.
4. Create `/mappings/id_mapping.enc` in this folder.
5. Create a `.env` file in this folder with the content `MAPPING_KEY=`.
6. Run the following command to create a mapping key:
```python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"```
7. Set the value of `MAPPING_KEY` in `.env` to the created key. 
8. Run the scripts in numerical order: `python 01_import.py`, ...  

