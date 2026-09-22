"""
Loads the raw, concatenated (24 governorates x 2005-2023) CSV into a
pandas DataFrame.

Dtypes are explicitly downcast on load. With ~4M rows, letting pandas
infer float64/int64 for everything roughly doubles memory usage for no
benefit here (P, temperatures, etc. don't need float64 precision).
"""

import pandas as pd

from src import config

DTYPES = {
    "year": "int16",
    "month": "int8",
    "day": "int8",
    "hour": "int8",
    "location": "category",
    "latitude": "float32",
    "longitude": "float32",
    "G(i)": "float32",
    "H_sun": "float32",
    "T2m": "float32",
    "WS10m": "float32",
    "relative_humidity_2m": "float32",
    "cloud_cover": "float32",
    "wind_direction_10m": "float32",
    "pressure_msl": "float32",
    "precipitation": "float32",
    "dew_point_2m": "float32",
    "cloud_cover_low": "float32",
    "cloud_cover_mid": "float32",
    "cloud_cover_high": "float32",
    "P": "float32",
}


def load_raw_data(path=None, nrows=None) -> pd.DataFrame:
    """
    Load the raw merged dataset.

    Parameters
    ----------
    path : str or Path, optional
        Overrides config.RAW_CSV_PATH (useful for testing on a sample file).
    nrows : int, optional
        Read only the first N rows — handy for a quick pipeline smoke test
        without loading the full 4M-row file.
    """
    path = path or config.RAW_CSV_PATH
    df = pd.read_csv(path, dtype=DTYPES, nrows=nrows)
    return df


if __name__ == "__main__":
    df = load_raw_data()
    print("Shape:", df.shape)
    print("\nDtypes:\n", df.dtypes)
    print(f"\nMemory usage: {df.memory_usage(deep=True).sum() / 1e6:.1f} MB")
    print("\nGovernorates:", df['location'].nunique())
    print("Year range:", df['year'].min(), "-", df['year'].max())
