from data_loader import load_measurements
from labeling import AutoLabeler
from export import save_labeled_dataset


def main():
    db = "./data/db/data.db"
    table = "measurements_pseudo"
    out_file = "./data/out/labeled.csv"

    print(f"Loading data from: {db} (Table: {table})")
    df_raw = load_measurements(db, table=table)
    print(f"  {len(df_raw)} measurements found.\n")

    labeler    = AutoLabeler()
    df_labeled = labeler.label_dataframe(df_raw)

    save_labeled_dataset(df_labeled, path=out_file)


if __name__ == "__main__":
    main()
