import pandas as pd
import sqlite3
import yaml

with open("../config.yaml") as f:
    config = yaml.safe_load(f)

conn = sqlite3.connect("../db/pseudonymized.db")

for table_name, table_cfg in config["tables"].items():
    df = pd.read_csv(table_cfg["file"])
    df.to_sql(table_name, conn, if_exists="replace", index=False)
    print(f"'{table_name}' successfully imported ({len(df)} entries, {len(df.columns)} columns)")

conn.close()