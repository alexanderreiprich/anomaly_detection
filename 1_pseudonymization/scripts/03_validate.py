import pandas as pd
import sqlite3

conn = sqlite3.connect("./db/pseudonymized.db")
tables = ["patients"]

for table in tables:
    orig = pd.read_sql(f"SELECT * FROM {table} LIMIT 100", conn)
    pseudo = pd.read_sql(f"SELECT * FROM {table}_pseudo LIMIT 100", conn)

    # Avoid dropped columns
    common_cols = set(orig.columns) & set(pseudo.columns)
    dropped_cols = set(orig.columns) - set(pseudo.columns)

    print(f"\n Verifying {table}:")

    if dropped_cols:
        print(f"Unchecked columns (due to being dropped or renamed): {dropped_cols}")

    for col in common_cols:
        overlap = set(orig[col].astype(str)) & set(pseudo[col].astype(str))
        if overlap:
            print(f"'{col}': {len(overlap)} Original value still present! {list(overlap)[:3]}")

conn.close()
print("\nVerification complete.");