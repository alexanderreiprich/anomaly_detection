## Pseudonymization

This module takes and formats the original data and pseudonymizes sensitive information. The `config.yaml` file describes the tables and columns created with the pseudonymized data as well as the pseudonymization method used.

### Prerequisites 

- Python 3.11
- Data stored as .csv in `data/raw` that follows the same structure (table names, columns, ...) as needed in the `config.yaml`

### How to run

1. Create `/db/pseudonymized.db` in this folder.
2. Create `/mappings/id_mapping.enc` in this folder.
3. Create a `.env` file in this folder with the content `MAPPING_KEY=`.
4. Run the following command to create a mapping key:
```python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"```
5. Set the value of `MAPPING_KEY` in `.env` to the created key. 
6. Run the scripts in numerical order: `python 01_import.py`, ...  

The pseudonymized information is stored in `data/out/`, the database  