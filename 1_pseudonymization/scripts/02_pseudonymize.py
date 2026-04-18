import pandas as pd
import sqlite3
import yaml
import hashlib
import json
import os
from cryptography.fernet import Fernet
from dotenv import load_dotenv
from tqdm import tqdm

load_dotenv()

# Mapping definitions
MAPPING_FILE = "./mappings/id_mapping.enc"
fernet = Fernet(os.environ["MAPPING_KEY"].encode())

def load_mapping():
    if os.path.exists(MAPPING_FILE):
        with open(MAPPING_FILE, "rb") as f:
            content = f.read()
        if not content:
            return {}
        return json.loads(fernet.decrypt(content))
    return {}

def save_mapping(mapping):
    with open(MAPPING_FILE, "wb") as f:
        f.write(fernet.encrypt(json.dumps(mapping).encode()))

id_map = load_mapping()

# Pseudonymization definition
def pseudonymize(value, method, col_name):
    val = str(value)

    if method == "consistent_id":
        key = f"{col_name}::{val}"
        if key not in id_map:
            id_map[key] = f"{col_name.upper()}-{hashlib.sha256(key.encode()).hexdigest()[:8].upper()}"
        return id_map[key]

    elif method == "hash":
        return hashlib.sha256(val.encode()).hexdigest()[:16]
    
    elif method == "age_range":
      try:
          birth_date = pd.to_datetime(val)
          today = pd.Timestamp.today()
          age = (today - birth_date).days // 365
          lower = (age // 10) * 10
          return f"{lower}-{lower + 9}"   # e.g. "60-69"
      except Exception:
          return val

    elif method == "weight_range":
        try:
            weight = float(val)
            lower = (int(weight) // 10) * 10
            return f"{lower}-{lower + 9}"  # e.g. "80-89" in years
        except Exception:
            return val
        
    elif method == "height_range":
        try:
            weight = float(val)
            lower = (int(weight) // 10) * 10
            return f"{lower}-{lower + 9}"  # e.g. "180-189" in cm
        except Exception:
            return val

    return value  # Fallback: no changes

# ---

with open("./config.yaml") as f:
    config = yaml.safe_load(f)

conn = sqlite3.connect("./db/pseudonymized.db")

for table_name, table_cfg in config["tables"].items():
    df = pd.read_sql(f"SELECT * FROM {table_name}", conn)
    print(f"\n Current table: '{table_name}' ({len(df)} entries)...")

    cols_to_drop = table_cfg.get("drop", [])
    df = df.drop(columns=[c for c in cols_to_drop if c in df.columns])
    if cols_to_drop:
        print(f"Dropped the following columns: {cols_to_drop}")

    rename_map = table_cfg.get("rename", {})
    df = df.rename(columns=rename_map)
    if rename_map:
        print(f"Renamed the following columns: {rename_map}")

    for col, method in tqdm(table_cfg.get("columns", {}).items(), desc=table_name):
        if col in df.columns:
            df[col] = df[col].apply(lambda v: pseudonymize(v, method, col))

    df.to_sql(f"{table_name}_pseudo", conn, if_exists="replace", index=False)
    df.to_csv(f"./data/out/{table_name}_pseudo.csv", index=False)

save_mapping(id_map)
conn.close()
print("\n Pseudonymization complete.")