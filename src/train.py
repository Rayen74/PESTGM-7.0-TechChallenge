"""
Main training pipeline.

Loads the raw data, engineers features, splits chronologically, scales
where needed, trains every model in the registry, evaluates each one on
the VALIDATION set only, and saves trained models + a comparison table.

The TEST set is intentionally not touched here — see evaluate_on_test.py,
which is run once, at the very end, on the single best model chosen from
the validation comparison. This mirrors real practice: tune/compare on
val, report a final, honest number on test exactly once.

Run from the project root with:
    python -m src.train
"""

import time

import joblib

from src import config
from src.data_loader import load_raw_data
from src.feature_engineering import build_features, get_feature_columns
from src.split import chronological_split, make_xy
from src.scaling import scale_features
from src.models import get_model_registry
from src.evaluate import evaluate, save_metrics_table


def main(nrows: int = None, subsample_large_models: bool = True):
    """
    Parameters
    ----------
    nrows : int, optional
        Load only the first N rows of the CSV. Useful for a fast smoke
        test of the whole pipeline before committing to a full 4M-row run.
    subsample_large_models : bool
        If True, models with a `max_train_rows` cap in the registry
        (SVR, GradientBoosting) are subsampled to that cap. Set to False
        only if you have the time/hardware to train them on the full set.
    """
    print("Loading raw data...")
    df = load_raw_data(nrows=nrows)
    print(f"Loaded {len(df):,} rows, {df['location'].nunique()} governorates.\n")

    print("Engineering features...")
    df = build_features(df)
    feature_cols = get_feature_columns(df)
    print(f"{len(feature_cols)} features: {feature_cols}\n")

    print("Splitting chronologically...")
    train_df, val_df, test_df = chronological_split(df)
    print()

    X_train, y_train = make_xy(train_df, feature_cols)
    X_val, y_val = make_xy(val_df, feature_cols)
    X_test, y_test = make_xy(test_df, feature_cols)

    print("Fitting scaler on training features (used by SVR / MLP only)...")
    X_train_scaled, X_val_scaled, X_test_scaled, scaler = scale_features(X_train, X_val, X_test)
    print()

    registry = get_model_registry()
    all_metrics = []

    for name, spec in registry.items():
        print(f"===== Training: {name} =====")
        model = spec["model"]
        needs_scaling = spec["needs_scaling"]
        max_rows = spec.get("max_train_rows")

        Xtr = X_train_scaled if needs_scaling else X_train
        Xval = X_val_scaled if needs_scaling else X_val
        ytr = y_train

        if max_rows and len(Xtr) > max_rows and subsample_large_models:
            print(f"Subsampling '{name}' training set: {len(Xtr):,} -> {max_rows:,} rows "
                  f"(required for tractable training time).")
            Xtr = Xtr.sample(n=max_rows, random_state=config.RANDOM_STATE)
            ytr = ytr.loc[Xtr.index]

        start = time.time()
        model.fit(Xtr, ytr)
        elapsed = time.time() - start
        print(f"Trained in {elapsed:.1f}s")

        val_pred = model.predict(Xval)
        val_metrics = evaluate(y_val, val_pred, set_name=f"{name} - Validation")
        val_metrics["model"] = name
        val_metrics["train_time_s"] = round(elapsed, 1)
        all_metrics.append(val_metrics)

        model_path = config.MODELS_DIR / f"{name}.joblib"
        joblib.dump(model, model_path, compress=3)
        print(f"Model saved to {model_path}\n")

    results_df = save_metrics_table(all_metrics)
    print("===== Summary (validation set, sorted by RMSE) =====")
    print(results_df.sort_values("RMSE")[["model", "MAE", "RMSE", "R2", "MAPE_%", "train_time_s"]]
          .to_string(index=False))

    return results_df


if __name__ == "__main__":
    main()
