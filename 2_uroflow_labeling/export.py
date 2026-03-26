import pandas as pd

def save_labeled_dataset(df: pd.DataFrame, path: str = "labeled_dataset.csv") -> None:
    """
    Saves the labled dataset as .csv
    """
    df.to_csv(path, index=False)
    print(f"Saved: {path}  ({len(df)} lines)\n")
    print_summary(df)


def print_summary(df: pd.DataFrame) -> None:
    """Returns a short summary of the labels and their distribution."""
    if "auto_label" not in df.columns:
        print("No column 'auto_label' found.")
        return

    counts = df["auto_label"].value_counts()
    total  = len(df)

    print("Label distribution:")
    for label, n in counts.items():
        bar = "█" * int(n / total * 30)
        print(f"  {label:<12} {n:>5}  {bar}")

    if "label_rule" in df.columns:
        print("\Triggered rules:")
        print(df["label_rule"].value_counts().to_string())
