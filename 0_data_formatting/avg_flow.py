import pandas as pd

# Adds the "avg_flow" column to the data, calculates the average flow of every measurement.

input_file = "./1_pseudonymization/data/raw/measurement_202603211747.csv" 
output_file = "output.csv"

df = pd.read_csv(input_file)

df["avg_flow"] = (df["urine_volume"] / df["micturition_time"]).round(2)
df["avg_flow"] = df["avg_flow"].replace([float("inf"), -float("inf")], pd.NA)

df.to_csv(output_file, index=False)

print("File saved:", output_file)