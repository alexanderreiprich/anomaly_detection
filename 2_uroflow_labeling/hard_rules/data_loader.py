import sqlite3
import pandas as pd

# Mapping from db column names to internal names.
COLUMN_RENAME: dict[str, str] = {
    "AvgFlow": "avg_flow",
    "MaxFlow": "max_flow",
    "Volume":  "urine_volume",
}

NUMERIC_COLUMNS = ["avg_flow", "max_flow", "urine_volume"]


def load_measurements(db_path: str, table: str = "measurements") -> pd.DataFrame:
    """
    Loads table from database and normalizes the column names and data types.

    Returns:
    pd.DataFrame
        DataFrame mit normalisierten Spalten.
    """
    with sqlite3.connect(db_path) as conn:
        df = pd.read_sql_query(f"SELECT * FROM {table}", conn)

    df = df.rename(columns={k: v for k, v in COLUMN_RENAME.items() if k in df.columns})

    for col in NUMERIC_COLUMNS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    return df
