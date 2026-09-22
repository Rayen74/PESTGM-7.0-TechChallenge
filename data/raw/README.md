Place `final_merged_dataset.csv` in this folder before running the pipeline.

The dataset itself is not included in this project package (it's ~380MB —
too large to ship as source, and every real project keeps large data files
out of version control). `src/config.py` expects it at:

    data/raw/final_merged_dataset.csv
